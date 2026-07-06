"""
Card-level correctness checker + game statistics.

Plays many full 2-player games through the domain layer. For every card played it
re-derives, INDEPENDENTLY of the engine code, what should happen:
  - whether the card's condition holds (own re-implementation of each condition),
  - the expected marker deltas (incl. OR/OR_NEG/AND_OR logic and X calculations),
  - the expected ability effects (kill/bury target validity vs filters+visibility,
    flip, draws from harbor/tavern/graveyard, swap hands, place face-down,
    Move_Markers leading/behind parsing, PlayExtra keeping the turn, ...),
then compares with the events the engine actually emitted and the resulting state.
Zone invariants (each card in exactly one zone, 72 total) are checked after every step.

Also records per-game outcomes (winner faction, winner player, turns) and per-card
coverage (times played, condition true/false counts).

Usage: python _card_checker_sim.py [max_games] [target_plays_per_card]
"""
import random
import sys
import traceback
from collections import Counter, defaultdict

sys.path.insert(0, ".")

from domain.state import GameState, TurnPhase
from domain.reducer import apply_event
from domain.exceptions import CommandRejected
from domain.events import PlayerJoined
from domain.game_end import check_game_end_after_event, determine_winner
from setup import load_cards_catalog, generate_setup_events
from command_handlers import (
    handle_play_card,
    handle_pass_play,
    handle_discard_cards,
    handle_draw_from_tavern,
    handle_draw_from_harbor,
    handle_refill_tavern,
)
from domain.commands import (
    PlayCardCommand,
    PassPlayCommand,
    DiscardCardsCommand,
    DrawFromTavernCommand,
    DrawFromHarborCommand,
    RefillTavernCommand,
)
from _selfplay_sim import random_targets, choose_slot_with_card

TAVERN_SLOTS = 3

# ---------------------------------------------------------------- oracles

def faction_of(cards, cid):
    e = cards.get(cid, {}) or {}
    return (e.get("faction") or e.get("fraction") or "").strip()


def oracle_condition(cond, state, pid, cards):
    """Independent re-implementation of every ability condition."""
    if cond == "no_red_in_tavern":
        return all(faction_of(cards, c) != "Imperials" for c in state.tavern if c)
    if cond == "no_undead":
        if any(faction_of(cards, c) == "Undead" for c in state.tavern if c):
            return False
        p = state.get_player(pid)
        if p and any(faction_of(cards, r.card_id) == "Undead" for r in p.open_heroes + p.hidden_heroes):
            return False
        return True
    if cond == "green_behind_red":
        return state.green_marker < state.red_marker
    if cond == "red_behind_green":
        return state.red_marker < state.green_marker
    cur_pid = state.players[state.current_player_index].player_id if state.players else None
    if cond == "has_red_party":
        if pid != cur_pid:
            return False
        p = state.get_player(pid)
        return bool(p) and any(faction_of(cards, r.card_id).lower() == "imperials" for r in p.open_heroes + p.hidden_heroes)
    if cond == "has_blue_black_party":
        if pid != cur_pid:
            return False
        p = state.get_player(pid)
        return bool(p) and any(faction_of(cards, r.card_id).lower() in ("waterfolk", "undead") for r in p.open_heroes + p.hidden_heroes)
    if cond == "has_face_down_undead":
        return any(faction_of(cards, r.card_id) == "Undead" for p in state.players for r in p.hidden_heroes)
    if cond == "has_face_down_green":
        return any(faction_of(cards, r.card_id) == "Highlanders" for p in state.players for r in p.hidden_heroes)
    return False


def oracle_x(state, card, targets, actor_id, cards):
    xs = (card.get("ability") or {}).get("x_source")
    if not xs:
        return 0
    if xs == "graveyard_count":
        return len(state.graveyard)
    if xs == "tavern_not_red":
        return sum(1 for c in state.tavern if c and faction_of(cards, c) != "Imperials")
    if xs == "tavern_not_green":
        return sum(1 for c in state.tavern if c and faction_of(cards, c) != "Highlanders")
    tid = targets.get("target_player_id")
    if not tid and len(state.players) == 2:
        tid = next((p.player_id for p in state.players if p.player_id != actor_id), None)
    p = state.get_player(tid) if tid else None
    if not p:
        return 0
    if xs == "target_party_markers":
        return len(p.open_heroes) + len(p.hidden_heroes)
    if xs == "target_face_up_green":
        return sum(1 for r in p.open_heroes if faction_of(cards, r.card_id) == "Highlanders")
    if xs == "target_face_up_blue":
        return sum(1 for r in p.open_heroes if faction_of(cards, r.card_id) == "Waterfolk")
    if xs == "target_face_down_count":
        return len(p.hidden_heroes)
    return 0


def oracle_deltas(state, card, targets, actor_id, cards):
    """Independent expected (red_delta, green_delta) for the card's own markers."""
    m = card.get("markers")
    if not m:
        return (card.get("red_delta", 0), card.get("green_delta", 0))
    logic = m.get("logic", "AND")
    raw_r, raw_g = m.get("red", 0), m.get("green", 0)
    x = 0
    if raw_r in ("X", "-X") or raw_g in ("X", "-X"):
        x = oracle_x(state, card, targets, actor_id, cards)

    def val(v):
        if v == "X":
            return x
        if v == "-X":
            return -x
        try:
            return int(v)
        except (TypeError, ValueError):
            return 0

    r, g = val(raw_r), val(raw_g)
    choice = targets.get("marker_choice")
    if logic == "AND":
        return (r, g)
    if logic == "LEADING_MARKER":
        return (0, 0)
    if logic == "OR":
        if choice == "green_alt" and m.get("green_alt") is not None:
            return (r, val(m["green_alt"]))
        if choice == "red_alt" and m.get("red_alt") is not None:
            return (val(m["red_alt"]), g)
        return (r, g)
    if logic == "OR_NEG":
        return (-r, -g) if choice == "neg" else (r, g)
    if logic == "OR_NEG_DECIDE_LEFT":
        return (-r, -g) if choice == "right" else (r, g)
    if logic == "AND_OR":
        side = targets.get("marker_choice_side") or (choice if choice in ("red", "green") else None)
        return (0, g) if side == "green" else (r, 0)
    return (r, g)


def parse_move_effect(s):
    s = (s or "").strip()
    if not s:
        return None
    sign = 1
    if s.startswith("-"):
        sign, s = -1, s[1:].strip()
    elif s.startswith("+"):
        s = s[1:].strip()
    parts = s.split()
    if len(parts) < 2:
        return None
    try:
        n = int(parts[0])
    except ValueError:
        return None
    return (sign * n, parts[1].lower())


def party_candidates(player, visibility, cards, filters):
    """(card_id, is_open) matching visibility + fraction filters — mirror of the rules text."""
    out = []
    if visibility != "face_up":
        for r in player.hidden_heroes:
            f = faction_of(cards, r.card_id)
            if filters and "fraction" in filters and f != filters["fraction"]:
                continue
            if filters and "not_fraction" in filters and f == filters["not_fraction"]:
                continue
            out.append((r.card_id, False))
    if visibility != "face_down":
        for r in player.open_heroes:
            f = faction_of(cards, r.card_id)
            if filters and "fraction" in filters and f != filters["fraction"]:
                continue
            if filters and "not_fraction" in filters and f == filters["not_fraction"]:
                continue
            out.append((r.card_id, True))
    return out


# ---------------------------------------------------------------- verification

def verify_play(pre, post, card, card_id, targets, actor_id, events, cards, problems):
    """Compare emitted events/state change against oracle. Append problem strings."""
    name = card.get("name", card_id)
    ability = card.get("ability") or {}
    action = ability.get("action")

    cond = ability.get("condition")
    cond_ok = oracle_condition(cond, pre, actor_id, cards) if cond else True

    # --- 1. Card marker deltas ---
    exp_r, exp_g = oracle_deltas(pre, card, targets, actor_id, cards) if cond_ok else (0, 0)
    cp = next((p for t, p in events if t == "CardPlayed"), None)
    if cp is None:
        problems.append(f"{name}: no CardPlayed event")
        return cond_ok
    if (cp.get("red_delta", 0), cp.get("green_delta", 0)) != (exp_r, exp_g):
        problems.append(
            f"{name}: marker deltas mismatch: engine=({cp.get('red_delta')},{cp.get('green_delta')}) expected=({exp_r},{exp_g}) "
            f"cond={cond}={cond_ok} targets_choice={targets.get('marker_choice')}/{targets.get('marker_choice_side')} markers={card.get('markers')}"
        )
    # First MarkerMoved right after CardPlayed must equal card deltas (present iff nonzero)
    mm_card = events[1][1] if len(events) > 1 and events[1][0] == "MarkerMoved" else None
    if (exp_r or exp_g):
        if not mm_card or (mm_card.get("red_delta", 0), mm_card.get("green_delta", 0)) != (exp_r, exp_g):
            problems.append(f"{name}: card MarkerMoved missing/mismatch, expected ({exp_r},{exp_g}) got {mm_card}")
    elif mm_card is not None and action not in ("Move_Markers", "Perform", "Perform_Top", "Perform_Self", "Bury_Perform"):
        problems.append(f"{name}: unexpected MarkerMoved {mm_card} (card deltas should be 0, no marker ability)")

    ability_events = [(t, p) for t, p in events if t not in ("CardPlayed", "TurnPhaseChanged")]
    if mm_card is not None and (exp_r or exp_g):
        # drop the card's own MarkerMoved from ability events; when the card's own deltas
        # are zero, events[1] (if MarkerMoved) belongs to the ability (e.g. Move_Markers)
        seen = False
        tmp = []
        for t, p in ability_events:
            if not seen and t == "MarkerMoved" and p is mm_card:
                seen = True
                continue
            tmp.append((t, p))
        ability_events = tmp

    # --- 2. Condition gating: condition false => no ability events at all ---
    if cond and not cond_ok and ability_events:
        problems.append(f"{name}: condition '{cond}' is FALSE but ability produced events: {[t for t, _ in ability_events]}")
        return cond_ok
    if not cond_ok:
        return cond_ok

    # --- 3. Per-action effect checks ---
    kills = [p for t, p in events if t == "HeroKilled"]
    reveals = [p for t, p in events if t == "HeroRevealed"]

    if action in ("Kill", "Bury", "Kill_Random", "Guess_Kill"):
        tgt_is_other = ability.get("target_player") == "other"
        vis = ability.get("visibility", "face_down")
        filters = ability.get("filters")
        if len(kills) > 1:
            problems.append(f"{name}: {action} killed {len(kills)} heroes (max 1)")
        for k in kills:
            victim_pid, victim_cid = k.get("player_id"), k.get("card_id")
            vp = pre.get_player(victim_pid)
            cands = party_candidates(vp, vis, cards, filters) if vp else []
            if victim_cid not in {c[0] for c in cands}:
                problems.append(
                    f"{name}: {action} killed invalid target {victim_cid} ({faction_of(cards, victim_cid)}) "
                    f"— not a legal candidate (visibility={vis}, filters={filters})"
                )
            if tgt_is_other and victim_pid == actor_id:
                problems.append(f"{name}: {action} target_player=other but killed own hero")
            if action == "Guess_Kill":
                guessed = (targets.get("target_guessed_faction") or "").strip().lower()
                actual = faction_of(cards, victim_cid).lower()
                if guessed != actual:
                    problems.append(f"{name}: Guess_Kill killed although guess '{guessed}' != actual '{actual}'")
            if victim_cid not in post.graveyard:
                problems.append(f"{name}: {action} victim {victim_cid} not in graveyard after")

    if action == "Kill_Dual":
        tlist = ability.get("targets", [])
        exp_victims = set()
        actor_pre = pre.get_player(actor_id)
        other_pre = next((p for p in pre.players if p.player_id != actor_id), None)
        if "self_face_down" in tlist and actor_pre and actor_pre.hidden_heroes:
            exp_victims.add((actor_id, actor_pre.hidden_heroes[0].card_id))
        if "other_face_down" in tlist and other_pre and other_pre.hidden_heroes:
            exp_victims.add((other_pre.player_id, other_pre.hidden_heroes[0].card_id))
        got = {(k.get("player_id"), k.get("card_id")) for k in kills}
        if got != exp_victims:
            problems.append(f"{name}: Kill_Dual victims {got} != expected {exp_victims}")

    if action == "Flip" or (action == "Flip_Or_Look" and targets.get("flip_or_look_choice") == "flip"):
        for r in reveals:
            rp = pre.get_player(r.get("player_id"))
            if not rp or r.get("card_id") not in [h.card_id for h in rp.hidden_heroes]:
                problems.append(f"{name}: {action} revealed {r.get('card_id')} which was not hidden in target party")
    if action == "Flip_Or_Look" and targets.get("flip_or_look_choice") != "flip" and reveals:
        problems.append(f"{name}: Flip_Or_Look choice=look but HeroRevealed emitted")
    if action == "Look" and ability_events:
        problems.append(f"{name}: Look must not change state, got {[t for t, _ in ability_events]}")

    if action == "Move_Markers":
        mms = [p for t, p in ability_events if t == "MarkerMoved"]
        options = ability.get("options")
        effects = ability.get("effects", [])
        logic = ability.get("logic", "OR")
        exp = (0, 0)
        chosen = None
        if options:
            ci = targets.get("move_markers_option", 0)
            if not (isinstance(ci, int) and 0 <= ci < len(options)):
                ci = 0
            chosen = parse_move_effect(options[ci])
        elif effects:
            if logic == "AND":
                tot_r = tot_g = 0
                for e in effects:
                    pe = parse_move_effect(e)
                    if pe:
                        d, kind = pe
                        lead_red = pre.red_marker >= pre.green_marker
                        if kind == "leading":
                            tot_r, tot_g = (tot_r + d, tot_g) if lead_red else (tot_r, tot_g + d)
                        else:
                            tot_r, tot_g = (tot_r, tot_g + d) if lead_red else (tot_r + d, tot_g)
                exp = (tot_r, tot_g)
                chosen = "AND_DONE"
            else:
                ci = targets.get("move_markers_option", 0)
                if not (isinstance(ci, int) and 0 <= ci < len(effects)):
                    ci = 0
                chosen = parse_move_effect(effects[ci])
        if chosen and chosen != "AND_DONE":
            d, kind = chosen
            lead_red = pre.red_marker >= pre.green_marker
            if kind == "leading":
                exp = (d, 0) if lead_red else (0, d)
            else:
                exp = (0, d) if lead_red else (d, 0)
        got = (sum(m.get("red_delta", 0) for m in mms), sum(m.get("green_delta", 0) for m in mms))
        if got != exp:
            problems.append(f"{name}: Move_Markers delta {got} != expected {exp} (options={options}, effects={effects}, choice={targets.get('move_markers_option')})")

    if action == "Draw":
        src = ability.get("source")
        if isinstance(src, list):
            src = targets.get("source_choice") or src[0]
        count = ability.get("count", 1)
        drawn = [p for t, p in events if t == "CardDrawn"]
        moved_gy = [p for t, p in events if t == "CardMoved" and p.get("from_zone") == "graveyard"]
        if str(src).lower() == "graveyard":
            exp_ids = list(reversed(pre.graveyard[-min(count, len(pre.graveyard)):]))
            got_ids = [m.get("card_id") for m in moved_gy]
            if got_ids != exp_ids:
                problems.append(f"{name}: Draw graveyard got {got_ids} expected {exp_ids}")
        elif src == "Harbor":
            exp_ids = pre.harbor[: min(count, len(pre.harbor))]
            got_ids = [d.get("card_id") for d in drawn]
            if got_ids != exp_ids:
                problems.append(f"{name}: Draw harbor got {got_ids} expected prefix {exp_ids}")
        elif src == "Tavern":
            if len(drawn) > count:
                problems.append(f"{name}: Draw tavern drew {len(drawn)} > count {count}")
            for d in drawn:
                sl = d.get("tavern_slot")
                if sl is None or pre.tavern[sl] != d.get("card_id"):
                    problems.append(f"{name}: Draw tavern slot {sl} mismatch {d.get('card_id')}")
        # every drawn card ends in actor's hand
        for d in drawn:
            if d.get("card_id") not in (post.get_player(actor_id).hand_card_ids if post.get_player(actor_id) else []):
                problems.append(f"{name}: Draw card {d.get('card_id')} not in actor hand after")

    if action == "Draw_All_Tavern":
        drawn = {p.get("card_id") for t, p in events if t == "CardDrawn"}
        exp = {c for c in pre.tavern if c}
        if drawn != exp:
            problems.append(f"{name}: Draw_All_Tavern drew {drawn} expected {exp}")

    if action == "Swap_Hand":
        actor_pre = pre.get_player(actor_id)
        other_pre = next((p for p in pre.players if p.player_id != actor_id), None)
        actor_post = post.get_player(actor_id)
        other_post = post.get_player(other_pre.player_id) if other_pre else None
        if actor_pre and other_pre and actor_post and other_post:
            exp_actor = [c for c in other_pre.hand_card_ids]
            exp_other = [c for c in actor_pre.hand_card_ids if c != card_id]
            if sorted(actor_post.hand_card_ids) != sorted(exp_actor) or sorted(other_post.hand_card_ids) != sorted(exp_other):
                problems.append(
                    f"{name}: Swap_Hand wrong hands after: actor={actor_post.hand_card_ids} (exp {exp_actor}), "
                    f"other={other_post.hand_card_ids} (exp {exp_other})"
                )

    if action == "Place":
        actor_post = post.get_player(actor_id)
        if cp.get("as_open") is not False:
            problems.append(f"{name}: Place should play the card face-down (as_open=False), got as_open={cp.get('as_open')}")
        elif actor_post and card_id not in [h.card_id for h in actor_post.hidden_heroes]:
            problems.append(f"{name}: Place: played card not in own hidden party after")

    if action == "PlayExtra":
        if post.current_phase != TurnPhase.PLAY:
            problems.append(f"{name}: PlayExtra should keep phase PLAY, got {post.current_phase}")
        if post.current_player_index != pre.current_player_index:
            problems.append(f"{name}: PlayExtra changed current player")

    if action in ("Condition", "Calculation", "Reveal_Harbor") and ability_events:
        problems.append(f"{name}: {action} must not emit ability events, got {[t for t, _ in ability_events]}")

    return cond_ok


# ---------------------------------------------------------------- invariants

def zone_violations(state, cards_total_expected):
    locations = Counter()
    zones = defaultdict(list)

    def note(cid, z):
        if cid == "deceased_emperor":
            return
        locations[cid] += 1
        zones[cid].append(z)

    for p in state.players:
        for cid in p.hand_card_ids:
            note(cid, f"hand:{p.name}")
        for r in p.open_heroes:
            note(r.card_id, f"open:{p.name}")
        for r in p.hidden_heroes:
            note(r.card_id, f"hidden:{p.name}")
    for cid in state.harbor:
        note(cid, "harbor")
    for cid in state.wilderness:
        note(cid, "wilderness")
    for cid in state.tavern:
        if cid:
            note(cid, "tavern")
    for cid in state.graveyard:
        note(cid, "graveyard")

    out = []
    dupes = {cid: locs for cid, locs in zones.items() if len(locs) > 1}
    if dupes:
        out.append(f"DUPLICATE_CARD {dupes}")
    if sum(locations.values()) != cards_total_expected:
        out.append(f"CARD_COUNT {sum(locations.values())} != {cards_total_expected}")
    if not (1 <= state.red_marker <= 12) or not (1 <= state.green_marker <= 12):
        out.append(f"MARKER_RANGE red={state.red_marker} green={state.green_marker}")
    return out


# ---------------------------------------------------------------- game loop

def finish_game(state, cards):
    """Emulate session game-end: GameEndTriggered + LeaderRevealed + WinnerDetermined."""
    state = apply_event(state, "GameEndTriggered", {"reason": "hero_limit"})
    state.cards = cards
    for p in state.players:
        c = cards.get(p.leader_card_id, {})
        state = apply_event(state, "LeaderRevealed", {
            "player_id": p.player_id,
            "leader_card_id": p.leader_card_id,
            "fraction_1": c.get("fraction_1", ""),
            "fraction_2": c.get("fraction_2", ""),
            "leader_number": c.get("leader_number", 0),
        })
        state.cards = cards
    winner_id = determine_winner(state)
    state = apply_event(state, "WinnerDetermined", {"winner_player_id": winner_id, "winner_faction": state.winner_faction or ""})
    state.cards = cards
    return state


def run_game(seed, max_turns, cards, stats, card_stats, problems_by_card):
    rng = random.Random(seed)
    state = GameState(room_id=f"chk{seed}", num_players=2, game_mode="full", cards=cards)
    for pid, nm in [("p1", "Alice"), ("p2", "Bob")]:
        state = apply_event(state, "PlayerJoined", PlayerJoined(player_id=pid, name=nm, player_token=pid + "t").to_payload())
    state.cards = cards
    for et, pl in generate_setup_events(state, cards, seed=seed):
        state = apply_event(state, et, pl)
    state.current_phase = TurnPhase.PLAY
    state.cards = cards

    turn = 0
    end_reason = "cutoff"
    while turn < max_turns and not state.game_ended:
        turn += 1
        cur = state.players[state.current_player_index]
        opp = state.players[1 - state.current_player_index]

        if state.current_phase == TurnPhase.PLAY:
            hand = list(cur.hand_card_ids)
            rng.shuffle(hand)
            played = False
            for cid in hand:
                card = cards.get(cid, {})
                targets = random_targets(card.get("ability"), state, cur, opp, cards, rng)
                cmd = PlayCardCommand(room_id=state.room_id, player_id=cur.player_id, card_id=cid, targets=targets)
                try:
                    events = handle_play_card(state, cmd)
                except CommandRejected:
                    continue
                except Exception as e:
                    problems_by_card[card.get("name", cid)].append(f"EXCEPTION on play: {e}\n{traceback.format_exc()}")
                    played = True
                    break
                pre = state
                for et, pl in events:
                    state = apply_event(state, et, pl)
                state.cards = cards
                probs = []
                cond_ok = verify_play(pre, state, card, cid, targets, cur.player_id, events, cards, probs)
                cs = card_stats[card.get("name", cid)]
                cs["plays"] += 1
                if card.get("ability") and card["ability"].get("condition"):
                    cs["cond_true" if cond_ok else "cond_false"] += 1
                for pr in probs:
                    problems_by_card[card.get("name", cid)].append(pr + f" [seed={seed} turn={turn}]")
                for v in zone_violations(state, 72):
                    problems_by_card[card.get("name", cid)].append(f"INVARIANT after play: {v} [seed={seed} turn={turn}]")
                played = True
                break
            if not played:
                # no playable card -> pass (real players can pass)
                events = handle_pass_play(state, PassPlayCommand(room_id=state.room_id, player_id=cur.player_id))
                for et, pl in events:
                    state = apply_event(state, et, pl)
                state.cards = cards
            if check_game_end_after_event(state):
                state = finish_game(state, cards)
                end_reason = "hero_limit"
                break

        if state.current_phase == TurnPhase.DRAW:
            try:
                if state.harbor:
                    events = handle_draw_from_harbor(state, DrawFromHarborCommand(room_id=state.room_id, player_id=cur.player_id))
                else:
                    slot = choose_slot_with_card(state.tavern, rng)
                    if slot is None:
                        end_reason = "deck_empty"
                        break
                    events = handle_draw_from_tavern(state, DrawFromTavernCommand(room_id=state.room_id, player_id=cur.player_id, slot_index=slot))
            except CommandRejected:
                end_reason = "deck_empty"
                break
            for et, pl in events:
                state = apply_event(state, et, pl)
            state.cards = cards

        if state.current_phase == TurnPhase.DISCARD:
            me = state.get_player(cur.player_id)
            n = len(me.hand_card_ids) - 3
            if n > 0:
                to_discard = rng.sample(me.hand_card_ids, n)
                events = handle_discard_cards(state, DiscardCardsCommand(room_id=state.room_id, player_id=cur.player_id, card_ids=to_discard))
                for et, pl in events:
                    state = apply_event(state, et, pl)
                state.cards = cards

        if state.current_phase == TurnPhase.REFILL_TAVERN:
            events = handle_refill_tavern(state, RefillTavernCommand(room_id=state.room_id, player_id=cur.player_id))
            for et, pl in events:
                state = apply_event(state, et, pl)
            state.cards = cards

        if check_game_end_after_event(state):
            state = finish_game(state, cards)
            end_reason = "hero_limit"
            break

    winner_name = None
    if state.winner_player_id:
        wp = state.get_player(state.winner_player_id)
        winner_name = wp.name if wp else None
    stats.append({
        "seed": seed,
        "turns": turn,
        "ended": state.game_ended,
        "end_reason": end_reason,
        "winner_faction": state.winner_faction,
        "winner_player": winner_name,
        "red": state.red_marker,
        "green": state.green_marker,
    })


# ---------------------------------------------------------------- main

def bar(n, total, width=40):
    filled = int(round(width * n / total)) if total else 0
    return "#" * filled + "." * (width - filled)


def main():
    max_games = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    target_plays = int(sys.argv[2]) if len(sys.argv) > 2 else 25
    cards = load_cards_catalog()
    hero_names = [v.get("name") for k, v in cards.items() if k.startswith("hero_")]

    stats = []
    card_stats = defaultdict(lambda: {"plays": 0, "cond_true": 0, "cond_false": 0})
    problems_by_card = defaultdict(list)

    games = 0
    for seed in range(max_games):
        run_game(seed, 200, cards, stats, card_stats, problems_by_card)
        games += 1
        if games % 100 == 0:
            min_plays = min((card_stats[n]["plays"] for n in hero_names), default=0)
            print(f"  ... {games} games, min plays per card = {min_plays}")
            if min_plays >= target_plays:
                break

    # ---------- report ----------
    print("\n" + "=" * 70)
    print(f"GAMES: {games}")
    ended = [s for s in stats if s["ended"]]
    print(f"  ended by hero limit: {len(ended)}, deck empty/cutoff: {games - len(ended)}")
    print(f"  avg turns: {sum(s['turns'] for s in stats)/max(1,games):.1f}  min={min(s['turns'] for s in stats)} max={max(s['turns'] for s in stats)}")

    print("\nWINNING FACTIONS:")
    fac = Counter((s["winner_faction"] or "None") for s in ended)
    for f, c in fac.most_common():
        print(f"  {f:<12} {c:>4}  {bar(c, len(ended))}  {100*c/max(1,len(ended)):.1f}%")

    print("\nWINNING PLAYER:")
    wp = Counter((s["winner_player"] or "no aligned player") for s in ended)
    for f, c in wp.most_common():
        print(f"  {f:<18} {c:>4}  {100*c/max(1,len(ended)):.1f}%")

    print("\nFINAL MARKERS (red,green) top-10:")
    fm = Counter((s["red"], s["green"]) for s in ended)
    for (r, g), c in fm.most_common(10):
        print(f"  R={r:<2} G={g:<2}: {c}")

    print("\nCARD COVERAGE:")
    plays = sorted(((card_stats[n]["plays"], n) for n in hero_names))
    print(f"  cards: {len(hero_names)}, min plays: {plays[0][0]} ({plays[0][1]}), max: {plays[-1][0]} ({plays[-1][1]})")
    zero = [n for c, n in plays if c == 0]
    if zero:
        print(f"  NEVER PLAYED: {zero}")

    cond_cards = [(n, card_stats[n]) for n in hero_names if card_stats[n]["cond_true"] + card_stats[n]["cond_false"] > 0]
    print(f"\nCONDITION CARDS ({len(cond_cards)}): times condition TRUE / FALSE")
    for n, cs in sorted(cond_cards):
        print(f"  {n:<28} true={cs['cond_true']:<4} false={cs['cond_false']:<4}")

    print("\n" + "=" * 70)
    total_problems = sum(len(v) for v in problems_by_card.values())
    print(f"PROBLEMS FOUND: {total_problems} across {len(problems_by_card)} cards")
    for cname, plist in sorted(problems_by_card.items(), key=lambda kv: -len(kv[1])):
        uniq = {}
        for p in plist:
            key = p.split(" [seed=")[0][:150]
            uniq.setdefault(key, [0, p])
            uniq[key][0] += 1
        print(f"\n--- {cname}: {len(plist)} problem(s), {len(uniq)} unique ---")
        for key, (cnt, sample) in list(uniq.items())[:5]:
            print(f"  x{cnt}: {sample[:400]}")
    return 1 if total_problems else 0


if __name__ == "__main__":
    sys.exit(main())
