"""
Self-play simulator: runs many 2-player games driving the domain layer directly
(no HTTP server needed), picking random-but-plausible targets for every ability,
and checking invariants after every event. Any exception or invariant violation
is logged as a bug with full repro context (seed, turn, card, ability, targets).

Usage: python _selfplay_sim.py [num_games] [max_turns_per_game]
"""
import random
import sys
import traceback
from collections import Counter

sys.path.insert(0, ".")

from domain.state import GameState, TurnPhase
from domain.reducer import apply_event
from domain.exceptions import CommandRejected
from domain.events import PlayerJoined, GameCreated
from setup import load_cards_catalog, generate_setup_events
from command_handlers import (
    handle_play_card,
    handle_discard_cards,
    handle_draw_from_tavern,
    handle_draw_from_harbor,
    handle_refill_tavern,
)
from domain.commands import (
    PlayCardCommand,
    DiscardCardsCommand,
    DrawFromTavernCommand,
    DrawFromHarborCommand,
    RefillTavernCommand,
)
from domain.game_end import check_game_end_after_event

FACTIONS = ["Imperials", "Highlanders", "Waterfolk", "Undead"]

bugs = []  # list of dicts


def log_bug(kind, seed, turn, detail, exc=None):
    entry = {
        "kind": kind,
        "seed": seed,
        "turn": turn,
        "detail": detail,
        "trace": traceback.format_exc() if exc else None,
    }
    bugs.append(entry)
    print(f"\n=== BUG [{kind}] seed={seed} turn={turn} ===")
    print(detail)
    if exc:
        print(entry["trace"])


def apply_all(state, events):
    for et, payload in events:
        state = apply_event(state, et, payload)
    return state


def check_invariants(state, seed, turn, cards_total_expected):
    """All card ids must appear in exactly one zone. No duplicates. Counts add up."""
    locations = Counter()
    zones = {}

    def note(cid, zone):
        if cid == "deceased_emperor":
            return
        locations[cid] += 1
        zones.setdefault(cid, []).append(zone)

    for p in state.players:
        for cid in p.hand_card_ids:
            note(cid, f"hand:{p.name}")
        for ref in p.open_heroes:
            note(cid, f"open:{p.name}") if False else note(ref.card_id, f"open:{p.name}")
        for ref in p.hidden_heroes:
            note(ref.card_id, f"hidden:{p.name}")
    for cid in state.harbor:
        note(cid, "harbor")
    for cid in state.wilderness:
        note(cid, "wilderness")
    for cid in state.tavern:
        if cid:
            note(cid, "tavern")
    for cid in state.graveyard:
        note(cid, "graveyard")

    dupes = {cid: locs for cid, locs in zones.items() if len(locs) > 1}
    if dupes:
        log_bug("DUPLICATE_CARD", seed, turn, f"Cards in multiple zones: {dupes}")

    total = sum(locations.values())
    if total != cards_total_expected:
        log_bug(
            "CARD_COUNT_MISMATCH",
            seed,
            turn,
            f"Expected {cards_total_expected} hero cards in play, found {total}. "
            f"(harbor={len(state.harbor)}, wilderness={len(state.wilderness)}, "
            f"tavern={sum(1 for c in state.tavern if c)}, graveyard={len(state.graveyard)}, "
            f"hands={[len(p.hand_card_ids) for p in state.players]}, "
            f"open={[len(p.open_heroes) for p in state.players]}, "
            f"hidden={[len(p.hidden_heroes) for p in state.players]})",
        )
    if not (1 <= state.red_marker <= 12) or not (1 <= state.green_marker <= 12):
        log_bug("MARKER_OUT_OF_RANGE", seed, turn, f"red={state.red_marker} green={state.green_marker}")


def random_targets(ability, state, actor, opponent, cards, rng=random):
    """Build a plausible-random targets dict for the given ability. Guards in
    abilities.py fall back sanely on out-of-range / missing values, so we can
    be generous here to exercise many code paths."""
    if not ability:
        return {}
    t = {}
    action = ability.get("action")
    # generic possible fields many abilities read
    t["target_hidden_index"] = rng.randint(0, 3)
    t["marker_choice"] = rng.choice(["red_alt", "green_alt", "neg", "left", "right", None])
    t["marker_choice_side"] = rng.choice(["red", "green", None])
    t["move_markers_option"] = rng.randint(0, 2)
    t["flip_or_look_choice"] = rng.choice(["flip", "look"])
    t["tavern_slot"] = rng.choice([i for i, c in enumerate(state.tavern) if c] or [0])
    t["target_guessed_faction"] = rng.choice(FACTIONS)
    t["take_or_swap_choice"] = rng.choice(["take", "swap"])
    if actor.hand_card_ids:
        t["swap_hand_card_id"] = rng.choice(actor.hand_card_ids)
        t["target_card_id"] = rng.choice(actor.hand_card_ids)
    if ability.get("target_player") == "other" and opponent:
        t["target_player_id"] = opponent.player_id
    if action == "Draw" and isinstance(ability.get("source"), list):
        t["source_choice"] = rng.choice(ability["source"])
    # strip None values
    return {k: v for k, v in t.items() if v is not None}


def choose_slot_with_card(tavern, rng=random):
    slots = [i for i, c in enumerate(tavern) if c]
    return rng.choice(slots) if slots else None


def run_one_game(seed, max_turns, cards_catalog, cards_total_expected):
    rng = random.Random(seed)
    state = GameState(room_id=f"sim{seed}", num_players=2, game_mode="full", cards=cards_catalog)
    p1_id, p2_id = "p1", "p2"
    for pid, name in [(p1_id, "Alice"), (p2_id, "Bob")]:
        state = apply_event(state, "PlayerJoined", PlayerJoined(player_id=pid, name=name, player_token=pid + "_tok").to_payload())
    state.cards = cards_catalog

    setup_events = generate_setup_events(state, cards_catalog, seed=seed)
    for et, payload in setup_events:
        state = apply_event(state, et, payload)
    state.current_phase = TurnPhase.PLAY
    state.cards = cards_catalog

    turn = 0
    while turn < max_turns and not state.game_ended:
        turn += 1
        cur = state.players[state.current_player_index]
        opp = state.players[1 - state.current_player_index] if len(state.players) == 2 else None

        # --- PLAY phase ---
        if state.current_phase == TurnPhase.PLAY:
            if not cur.hand_card_ids:
                log_bug("EMPTY_HAND_ON_PLAY", seed, turn, f"Player {cur.name} has empty hand in PLAY phase")
                break
            # try each card in random order until one succeeds (some ability/target combos may legitimately reject)
            hand_order = list(cur.hand_card_ids)
            rng.shuffle(hand_order)
            played = False
            last_exc_detail = None
            for card_id in hand_order:
                card = cards_catalog.get(card_id, {})
                ability = card.get("ability")
                targets = random_targets(ability, state, cur, opp, cards_catalog, rng)
                cmd = PlayCardCommand(room_id=state.room_id, player_id=cur.player_id, card_id=card_id, targets=targets)
                try:
                    events = handle_play_card(state, cmd)
                except CommandRejected as e:
                    last_exc_detail = f"CommandRejected {e.code}: {e.message} (card={card.get('name')} action={ability.get('action') if ability else None} targets={targets})"
                    continue
                except Exception as e:
                    log_bug(
                        "EXCEPTION_PLAY_CARD",
                        seed,
                        turn,
                        f"card={card.get('name')} id={card_id} ability={ability} targets={targets} error={e}",
                        exc=e,
                    )
                    played = True  # stop trying more cards this turn; move on
                    break
                try:
                    state = apply_all(state, events)
                except Exception as e:
                    log_bug(
                        "EXCEPTION_APPLY_EVENTS",
                        seed,
                        turn,
                        f"card={card.get('name')} id={card_id} events={events} error={e}",
                        exc=e,
                    )
                    played = True
                    break
                state.cards = cards_catalog
                check_invariants(state, seed, turn, cards_total_expected)
                if check_game_end_after_event(state):
                    state.game_ended = True
                played = True
                break
            if not played:
                log_bug("NO_PLAYABLE_CARD", seed, turn, f"No card in hand playable. Last error: {last_exc_detail}. Hand={[cards_catalog.get(c,{}).get('name') for c in cur.hand_card_ids]}")
                break
            if state.game_ended:
                break

        # --- DRAW phase: exactly one draw action per turn (harbor or a single tavern slot) ---
        if state.current_phase == TurnPhase.DRAW:
            cur = next(p for p in state.players if p.player_id == cur.player_id)
            try:
                if state.harbor:
                    cmd = DrawFromHarborCommand(room_id=state.room_id, player_id=cur.player_id)
                    events = handle_draw_from_harbor(state, cmd)
                else:
                    slot = choose_slot_with_card(state.tavern, rng)
                    if slot is None:
                        print(f"[info] seed={seed} turn={turn}: deck exhausted (harbor+tavern empty), ending game early")
                        break
                    cmd = DrawFromTavernCommand(room_id=state.room_id, player_id=cur.player_id, slot_index=slot)
                    events = handle_draw_from_tavern(state, cmd)
            except CommandRejected as e:
                print(f"[info] seed={seed} turn={turn}: draw rejected ({e.code}: {e.message}), ending game early")
                break
            except Exception as e:
                log_bug("EXCEPTION_DRAW", seed, turn, f"error={e}", exc=e)
                break
            state = apply_all(state, events)
            state.cards = cards_catalog
            check_invariants(state, seed, turn, cards_total_expected)

        if state.game_ended:
            break

        # --- DISCARD phase ---
        if state.current_phase == TurnPhase.DISCARD:
            cur = next(p for p in state.players if p.player_id == cur.player_id)
            n_to_discard = len(cur.hand_card_ids) - 3
            if n_to_discard > 0:
                to_discard = rng.sample(cur.hand_card_ids, n_to_discard)
                cmd = DiscardCardsCommand(room_id=state.room_id, player_id=cur.player_id, card_ids=to_discard)
                try:
                    events = handle_discard_cards(state, cmd)
                except Exception as e:
                    log_bug("EXCEPTION_DISCARD", seed, turn, f"hand={cur.hand_card_ids} to_discard={to_discard} error={e}", exc=e)
                    break
                state = apply_all(state, events)
                state.cards = cards_catalog
                check_invariants(state, seed, turn, cards_total_expected)

        if state.game_ended:
            break

        # --- REFILL_TAVERN phase ---
        if state.current_phase == TurnPhase.REFILL_TAVERN:
            cmd = RefillTavernCommand(room_id=state.room_id, player_id=cur.player_id)
            try:
                events = handle_refill_tavern(state, cmd)
            except Exception as e:
                log_bug("EXCEPTION_REFILL", seed, turn, f"error={e}", exc=e)
                break
            state = apply_all(state, events)
            state.cards = cards_catalog
            check_invariants(state, seed, turn, cards_total_expected)

    return turn, state.game_ended


def main():
    num_games = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    max_turns = int(sys.argv[2]) if len(sys.argv) > 2 else 150

    cards_catalog = load_cards_catalog()
    cards_total_expected = 72  # hero cards in the 2-player game (72-card deck rule)

    ended_count = 0
    total_turns = 0
    for seed in range(num_games):
        try:
            turns, ended = run_one_game(seed, max_turns, cards_catalog, cards_total_expected)
        except Exception as e:
            log_bug("EXCEPTION_GAME_LOOP", seed, -1, f"error={e}", exc=e)
            continue
        total_turns += turns
        if ended:
            ended_count += 1

    print("\n" + "=" * 60)
    print(f"Ran {num_games} games, avg turns={total_turns / max(1,num_games):.1f}, ended={ended_count}/{num_games}")
    print(f"Total bugs logged: {len(bugs)}")
    kinds = Counter(b["kind"] for b in bugs)
    for k, c in kinds.most_common():
        print(f"  {k}: {c}")
    return 1 if bugs else 0


if __name__ == "__main__":
    sys.exit(main())
