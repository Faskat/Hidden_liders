"""
Ability execution: given state, card, ability def, actor and targets, produce list of (event_type, payload).
Raises CommandRejected when required targets are missing or invalid.
"""
import random
from typing import Any

from domain.state import GameState
from domain.events import (
    HeroKilled,
    HeroRevealed,
    HeroPutFaceDown,
    HeroDiscardedToWilderness,
    CardDrawn,
    TavernRefilled,
    MarkerMoved,
    CardMoved,
    HeroFlippedFaceDown,
    HandsSwapped,
)
from domain.exceptions import CommandRejected
from domain.constants import TAVERN_SLOTS, MARKER_MIN, MARKER_MAX


def _other_player_id(state: GameState, actor_id: str) -> str | None:
    """The single opponent (for 2p); for 3+ pick first other."""
    for p in state.players:
        if p.player_id != actor_id:
            return p.player_id
    return None


def _actor_player(state: GameState, actor_id: str) -> Any:
    return state.get_player(actor_id)


def _target_player(state: GameState, ability: dict, actor_id: str, targets: dict) -> Any:
    tid = targets.get("target_player_id")
    if tid:
        return state.get_player(tid)
    if ability.get("target_player") == "other":
        oid = _other_player_id(state, actor_id)
        return state.get_player(oid) if oid else None
    return _actor_player(state, actor_id)


def _matches_filters(card_data: dict, filters: dict | None) -> bool:
    if not filters:
        return True
    if "fraction" in filters and card_data.get("faction") != filters["fraction"]:
        return False
    if "not_fraction" in filters and card_data.get("faction") == filters["not_fraction"]:
        return False
    return True


def _candidates_party(player: Any, visibility: str | None, cards: dict, filters: dict | None) -> list[tuple[str, bool]]:
    """Return list of (card_id, is_open) for cards matching visibility and filters."""
    out = []
    if visibility != "face_up":
        for ref in player.hidden_heroes:
            c = cards.get(ref.card_id, {})
            if _matches_filters(c, filters):
                out.append((ref.card_id, False))
    if visibility != "face_down":
        for ref in player.open_heroes:
            c = cards.get(ref.card_id, {})
            if _matches_filters(c, filters):
                out.append((ref.card_id, True))
    return out


def _parse_move_effect(s: str) -> tuple[int, str] | None:
    """Parse '-1 leading' or '+2 behind' -> (delta, 'red'|'green'). leading = higher position = red if red > green else green."""
    s = (s or "").strip()
    if not s:
        return None
    sign = 1
    if s.startswith("-"):
        sign = -1
        s = s[1:].strip()
    elif s.startswith("+"):
        s = s[1:].strip()
    parts = s.split()
    if len(parts) < 2:
        return None
    try:
        n = int(parts[0])
    except ValueError:
        return None
    kind = parts[1].lower()
    if kind == "leading":
        return (sign * n, "leading")
    if kind == "behind":
        return (sign * n, "behind")
    return None


def _leading_behind_deltas(state: GameState, red_d: int, green_d: int) -> tuple[int, int]:
    """Apply red_d to leading marker, green_d to behind. Leading = marker with higher position."""
    if state.red_marker >= state.green_marker:
        return (red_d, green_d)
    return (green_d, red_d)


def execute_ability(
    state: GameState,
    card_id: str,
    ability: dict,
    actor_player_id: str,
    targets: dict | None,
) -> list[tuple[str, dict]]:
    """
    Produce list of (event_type, payload) for this ability. Raises CommandRejected if targets invalid.
    """
    targets = targets or {}
    action = ability.get("action")
    if not action:
        return []

    cards = state.cards
    actor = _actor_player(state, actor_player_id)
    if not actor:
        raise CommandRejected("PLAYER_NOT_FOUND", "Гравця не знайдено")

    events: list[tuple[str, dict]] = []

    # ---- Kill (pick target in party, kill to graveyard) ----
    if action == "Kill":
        target_player = _target_player(state, ability, actor_player_id, targets)
        if not target_player:
            raise CommandRejected("INVALID_TARGET", "Немає цільового гравця")
        visibility = ability.get("visibility", "face_down")
        filters = ability.get("filters")
        candidates = _candidates_party(target_player, visibility, cards, filters)
        if not candidates:
            return []
        target_card_id = None
        if targets.get("_perform_depth") is not None:
            target_card_id = targets.get("perform_target_card_id") or targets.get("performTargetCardId")
            if target_card_id is None:
                pidx = targets.get("perform_target_hidden_index", targets.get("performTargetHiddenIndex", 0))
                if isinstance(pidx, int) and 0 <= pidx < len(candidates):
                    target_card_id = candidates[pidx][0]
        if target_card_id is None:
            target_card_id = targets.get("target_card_id") or targets.get("targetCardId") or targets.get("target_hidden_index")
        if target_card_id is not None:
            if isinstance(target_card_id, int):
                if 0 <= target_card_id < len(candidates):
                    target_card_id = candidates[target_card_id][0]
                else:
                    target_card_id = candidates[0][0] if candidates else None
            if target_card_id and any(c[0] == target_card_id for c in candidates):
                events.append(("HeroKilled", HeroKilled(player_id=target_player.player_id, card_id=target_card_id, to_graveyard=True).to_payload()))
        else:
            card_id_kill = candidates[0][0]
            events.append(("HeroKilled", HeroKilled(player_id=target_player.player_id, card_id=card_id_kill, to_graveyard=True).to_payload()))
        return events

    # ---- Guess_Kill (pick target, guess faction; kill only if guess matches) ----
    if action == "Guess_Kill":
        target_player = _target_player(state, ability, actor_player_id, targets)
        if not target_player:
            raise CommandRejected("INVALID_TARGET", "Немає цільового гравця")
        visibility = ability.get("visibility", "face_down")
        filters = ability.get("filters")
        candidates = _candidates_party(target_player, visibility, cards, filters)
        if not candidates:
            return []
        idx = targets.get("target_hidden_index", 0)
        if not (0 <= idx < len(candidates)):
            idx = 0
        target_card_id = candidates[idx][0]
        card_data = cards.get(target_card_id, {})
        card_faction = (card_data.get("faction") or card_data.get("fraction") or "").strip()
        guessed = (targets.get("target_guessed_faction") or targets.get("guess_faction") or "").strip()
        if guessed and card_faction and guessed.lower() == card_faction.lower():
            events.append(("HeroKilled", HeroKilled(player_id=target_player.player_id, card_id=target_card_id, to_graveyard=True).to_payload()))
        return events

    # ---- Bury (same as Kill to graveyard) ----
    if action == "Bury":
        target_player = _target_player(state, ability, actor_player_id, targets)
        if not target_player:
            raise CommandRejected("INVALID_TARGET", "Немає цільового гравця")
        visibility = ability.get("visibility", "face_down")
        candidates = _candidates_party(target_player, visibility, cards, ability.get("filters"))
        if not candidates:
            return []
        # When called from Perform, use perform_target_* so we don't clash with target_hidden_index (which selects which of my hidden to perform)
        cid = None
        if targets.get("_perform_depth") is not None:
            cid = targets.get("perform_target_card_id") or targets.get("performTargetCardId")
            if cid is None:
                pidx = targets.get("perform_target_hidden_index", targets.get("performTargetHiddenIndex", 0))
                if isinstance(pidx, int) and 0 <= pidx < len(candidates):
                    cid = candidates[pidx][0]
        if cid is None:
            cid = targets.get("target_card_id") or targets.get("targetCardId")
        if cid is None:
            idx = targets.get("target_hidden_index", 0)
            if 0 <= idx < len(candidates):
                cid = candidates[idx][0]
            else:
                cid = candidates[0][0]
        events.append(("HeroKilled", HeroKilled(player_id=target_player.player_id, card_id=cid, to_graveyard=True).to_payload()))
        return events

    # ---- Flip (reveal: hidden -> open) ----
    if action == "Flip":
        target_player = _target_player(state, ability, actor_player_id, targets)
        if not target_player:
            raise CommandRejected("INVALID_TARGET", "Немає цільового гравця")
        idx = targets.get("target_hidden_index", 0)
        if target_player.hidden_heroes and 0 <= idx < len(target_player.hidden_heroes):
            ref = target_player.hidden_heroes[idx]
            events.append(("HeroRevealed", HeroRevealed(player_id=target_player.player_id, card_id=ref.card_id, from_hidden_index=idx).to_payload()))
        return events

    # ---- Move_Markers ----
    if action == "Move_Markers":
        options = ability.get("options")
        effects = ability.get("effects", [])
        logic = ability.get("logic", "OR")
        red_d, green_d = 0, 0
        if options:
            choice_idx = targets.get("move_markers_option", 0)
            if 0 <= choice_idx < len(options):
                parsed = _parse_move_effect(options[choice_idx])
                if parsed:
                    delta, kind = parsed
                    if kind == "leading":
                        red_d, green_d = _leading_behind_deltas(state, delta, 0)
                    else:
                        red_d, green_d = _leading_behind_deltas(state, 0, delta)
        elif effects:
            for eff in effects:
                parsed = _parse_move_effect(eff)
                if parsed:
                    d, kind = parsed
                    if kind == "leading":
                        rd, gd = _leading_behind_deltas(state, d, 0)
                    else:
                        rd, gd = _leading_behind_deltas(state, 0, d)
                    if logic == "AND":
                        red_d += rd
                        green_d += gd
                    else:
                        red_d, green_d = rd, gd
                        break
        if red_d or green_d:
            events.append(("MarkerMoved", MarkerMoved(red_delta=red_d, green_delta=green_d).to_payload()))
        return events

    # ---- Draw (from Harbor, Tavern, or Graveyard) ----
    if action == "Draw":
        source = ability.get("source")
        if isinstance(source, list):
            source = targets.get("source_choice") or source[0]
        source_str = str(source).strip() if source else ""
        count = ability.get("count", 1)
        distribution = ability.get("distribution")
        target_zone = ability.get("target")
        visibility = ability.get("visibility")

        if source_str.lower() == "graveyard":
            if not state.graveyard:
                raise CommandRejected(
                    "EMPTY_GRAVEYARD",
                    "Цвинтар порожній — не можна взяти карти",
                )
            to_take = state.graveyard[-min(count, len(state.graveyard)):]
            for cid in reversed(to_take):
                events.append(
                    (
                        "CardMoved",
                        CardMoved(
                            card_id=cid,
                            from_zone="graveyard",
                            to_zone="hand",
                            from_player_id=None,
                            to_player_id=actor_player_id,
                        ).to_payload(),
                    )
                )
            return events

        if source == "Tavern":
            slot = targets.get("tavern_slot")
            tavern_slots = targets.get("tavern_slots")
            if isinstance(tavern_slots, list) and len(tavern_slots) >= count:
                # User chose specific slots in modal (e.g. Raven Whisperer: pick 2)
                for i in tavern_slots[:count]:
                    if isinstance(i, int) and 0 <= i < TAVERN_SLOTS and state.tavern[i]:
                        cid = state.tavern[i]
                        events.append(("CardDrawn", CardDrawn(player_id=actor_player_id, card_id=cid, source="tavern", tavern_slot=i).to_payload()))
            elif slot is None and count == 1:
                for i in range(TAVERN_SLOTS):
                    if state.tavern[i]:
                        slot = i
                        break
            if slot is not None and 0 <= slot < TAVERN_SLOTS and state.tavern[slot] and not events:
                for _ in range(min(count, 1)):
                    cid = state.tavern[slot]
                    events.append(("CardDrawn", CardDrawn(player_id=actor_player_id, card_id=cid, source="tavern", tavern_slot=slot).to_payload()))
                    if distribution:
                        break
            elif count > 1 and not events:
                # Draw from first available slots; skip slot being buried by Bury_Perform if provided
                skip_slot = targets.get("_bury_tavern_slot")
                drawn = 0
                for i in range(TAVERN_SLOTS):
                    if drawn >= count:
                        break
                    if i == skip_slot:
                        continue
                    if state.tavern[i]:
                        events.append(("CardDrawn", CardDrawn(player_id=actor_player_id, card_id=state.tavern[i], source="tavern", tavern_slot=i).to_payload()))
                        drawn += 1
        elif source == "Harbor" and state.harbor:
            for i in range(min(count, len(state.harbor))):
                cid = state.harbor[i]
                events.append(("CardDrawn", CardDrawn(player_id=actor_player_id, card_id=cid, source="harbor").to_payload()))
        elif source == "other_hand":
            other_id = _other_player_id(state, actor_player_id)
            other = state.get_player(other_id) if other_id else None
            if other and other.hand_card_ids:
                cid = other.hand_card_ids[0]
                events.append(("CardDrawn", CardDrawn(player_id=actor_player_id, card_id=cid, source="tavern").to_payload()))
                events.append(("CardMoved", CardMoved(card_id=cid, from_zone="hand", to_zone="hand", from_player_id=other_id, to_player_id=actor_player_id).to_payload()))
            # Simplified: we need to remove from other hand and add to actor; CardDrawn adds to actor, so we need remove from other. So better: emit CardMoved from other_hand to actor hand. But CardMoved in reducer expects both remove and add. So emit CardMoved(from_zone=hand, from_player_id=other, to_zone=hand, to_player_id=actor). That moves one card. So for Draw from other_hand we emit CardMoved only (no CardDrawn). Let me fix: Draw from other_hand = take one card from other's hand to actor's hand. So CardMoved(card_id, from_zone=hand, to_zone=hand, from_player_id=other, to_player_id=actor). But then we're not using CardDrawn. So we use CardMoved. I'll add that.
                events.clear()
                events.append(("CardMoved", CardMoved(card_id=cid, from_zone="hand", to_zone="hand", from_player_id=other_id, to_player_id=actor_player_id).to_payload()))
        if distribution and events:
            # After first draw, put to party_face_down or wilderness per distribution
            pass  # For now leave cards in hand; full distribution would need extra events
        return events

    # ---- Place (hand -> party face down) ----
    if action == "Place":
        source = ability.get("source", "hand")
        target = ability.get("target", "Party")
        if source == "hand" and actor.hand_card_ids:
            cid = targets.get("target_card_id") or actor.hand_card_ids[0]
            if cid in actor.hand_card_ids:
                events.append(("HeroPutFaceDown", HeroPutFaceDown(player_id=actor_player_id, card_id=cid).to_payload()))
        return events

    # ---- Swap ----
    if action == "Swap":
        source = ability.get("source")
        target = (ability.get("target") or "").lower().replace(" ", "_")
        target_lower = (ability.get("target") or "").lower()
        # Special case: hand <-> Party_face_down (two-card swap, or one card from party to hand when only played card in hand)
        if source == "hand" and ("party_face_down" in target_lower or target == "party_face_down"):
            card_from_hand = targets.get("target_card_id") or next(
                (c for c in actor.hand_card_ids if c != card_id), None
            )
            idx = targets.get("target_hidden_index", 0)
            card_from_party = (
                actor.hidden_heroes[idx].card_id
                if actor.hidden_heroes and 0 <= idx < len(actor.hidden_heroes)
                else None
            )
            # Played card is placed face-down by CardPlayed when as_open=False
            if not card_from_party:
                raise CommandRejected(
                    "INVALID_TARGET",
                    "Для обміну потрібна принаймні одна прихована карта в партії",
                )
            if card_from_hand and card_from_hand != card_from_party:
                events.append(
                    (
                        "CardMoved",
                        CardMoved(
                            card_id=card_from_hand,
                            from_zone="hand",
                            to_zone="party_hidden",
                            from_player_id=actor_player_id,
                            to_player_id=actor_player_id,
                        ).to_payload(),
                    )
                )
            events.append(
                (
                    "CardMoved",
                    CardMoved(
                        card_id=card_from_party,
                        from_zone="party_hidden",
                        to_zone="hand",
                        from_player_id=actor_player_id,
                        to_player_id=actor_player_id,
                    ).to_payload(),
                )
            )
            return events

        # General Swap (single card move)
        from_zone, from_pid, slot_from = _resolve_zone(state, actor_player_id, source, targets)
        to_zone, to_pid, slot_to = _resolve_zone(state, actor_player_id, ability.get("target"), targets)
        card_id_swap = targets.get("target_card_id")
        if not card_id_swap and source == "Tavern":
            for i in range(TAVERN_SLOTS):
                if state.tavern[i]:
                    card_id_swap = state.tavern[i]
                    slot_from = i
                    break
        if not card_id_swap and source == "Graveyard_top" and state.graveyard:
            card_id_swap = state.graveyard[-1]
        if not card_id_swap and "party" in (source or "").lower():
            tplayer = _target_player(state, ability, actor_player_id, targets)
            if tplayer and tplayer.open_heroes:
                card_id_swap = tplayer.open_heroes[0].card_id
                from_zone = "party_open"
                from_pid = tplayer.player_id
        if card_id_swap:
            events.append(("CardMoved", CardMoved(
                card_id=card_id_swap,
                from_zone=from_zone or "hand",
                to_zone=to_zone or "hand",
                from_player_id=from_pid,
                to_player_id=to_pid,
                tavern_slot_from=slot_from,
                tavern_slot_to=slot_to,
            ).to_payload()))
            # other_party -> self_hand with "swap": also move a card from actor hand to other's party_open
            take_or_swap = targets.get("take_or_swap_choice") or targets.get("takeOrSwapChoice")
            if take_or_swap == "swap" and from_pid and to_pid == actor_player_id:
                swap_hand_card = targets.get("swap_hand_card_id") or targets.get("swapHandCardId")
                if swap_hand_card and swap_hand_card in actor.hand_card_ids:
                    events.append((
                        "CardMoved",
                        CardMoved(
                            card_id=swap_hand_card,
                            from_zone="hand",
                            to_zone="party_open",
                            from_player_id=actor_player_id,
                            to_player_id=from_pid,
                        ).to_payload(),
                    ))
        return events

    # ---- Swap_Hand ----
    if action == "Swap_Hand":
        other_id = _other_player_id(state, actor_player_id)
        if not other_id:
            raise CommandRejected("INVALID_TARGET", "Немає супротивника")
        events.append(("HandsSwapped", HandsSwapped(player_id_1=actor_player_id, player_id_2=other_id).to_payload()))
        return events

    # ---- Kill_Random ----
    if action == "Kill_Random":
        target_player = _target_player(state, ability, actor_player_id, targets)
        if not target_player:
            return []
        visibility = ability.get("visibility", "face_down")
        candidates = _candidates_party(target_player, visibility, cards, ability.get("filters"))
        if candidates:
            cid = random.choice(candidates)[0]
            events.append(("HeroKilled", HeroKilled(player_id=target_player.player_id, card_id=cid, to_graveyard=True).to_payload()))
        return events

    # ---- Kill_Dual ----
    if action == "Kill_Dual":
        targets_list = ability.get("targets", [])
        if "self_face_down" in targets_list and actor.hidden_heroes:
            cid = actor.hidden_heroes[0].card_id
            events.append(("HeroKilled", HeroKilled(player_id=actor_player_id, card_id=cid, to_graveyard=True).to_payload()))
        other_id = _other_player_id(state, actor_player_id)
        other = state.get_player(other_id) if other_id else None
        if other and "other_face_down" in targets_list and other.hidden_heroes:
            cid = other.hidden_heroes[0].card_id
            events.append(("HeroKilled", HeroKilled(player_id=other_id, card_id=cid, to_graveyard=True).to_payload()))
        return events

    # ---- Look: no state change (client-only reveal). ----
    if action == "Look":
        return []

    # ---- Flip_Or_Look: if user chose "flip", reveal (hidden -> open); else no state change (look/peek). ----
    if action == "Flip_Or_Look":
        if targets.get("flip_or_look_choice") == "flip":
            target_player = _target_player(state, ability, actor_player_id, targets)
            if target_player and target_player.hidden_heroes:
                idx = targets.get("target_hidden_index", 0)
                if 0 <= idx < len(target_player.hidden_heroes):
                    ref = target_player.hidden_heroes[idx]
                    events.append(
                        ("HeroRevealed", HeroRevealed(player_id=target_player.player_id, card_id=ref.card_id, from_hidden_index=idx).to_payload())
                    )
        return events

    # ---- Condition, Calculation: no events. ----
    if action in ("Condition", "Calculation"):
        return []

    # ---- PlayExtra: no ability events; turn not ended is handled in command_handlers. ----
    if action == "PlayExtra":
        return []

    # ---- Perform, Perform_Top, Perform_Self, Bury_Perform: execute another card's ability (one level only). ----
    perform_depth = targets.get("_perform_depth", 0)
    if perform_depth >= 1 and action in ("Perform", "Perform_Top", "Perform_Self", "Bury_Perform"):
        return []

    if action == "Bury_Perform":
        events_bury = []
        slot = targets.get("tavern_slot")
        if slot is None:
            for i in range(TAVERN_SLOTS):
                if state.tavern[i]:
                    slot = i
                    break
        if slot is not None and 0 <= slot < TAVERN_SLOTS and state.tavern[slot]:
            card_id = state.tavern[slot]
            other_ability = cards.get(card_id, {}).get("ability")
            if other_ability:
                events_bury.append(("CardMoved", CardMoved(
                    card_id=card_id,
                    from_zone=f"tavern_{slot}",
                    to_zone="graveyard",
                    tavern_slot_from=slot,
                ).to_payload()))
                # Do not pass tavern_slot; pass _bury_tavern_slot so performed ability (e.g. Draw) can exclude this slot
                sub_targets = {k: v for k, v in (targets or {}).items() if k not in ("_perform_depth", "tavern_slot")}
                sub_targets["_perform_depth"] = 1
                sub_targets["_bury_tavern_slot"] = slot
                events_bury.extend(execute_ability(state, card_id, other_ability, actor_player_id, sub_targets))
        return events_bury

    if action == "Perform" or action == "Perform_Self":
        # Target: actor's party, face_down. Pick card by target_hidden_index or first.
        visibility = ability.get("visibility", "face_down")
        target_zone = ability.get("target_zone") or "self_party_face_down"
        if "party" in (target_zone or "").lower() or target_zone == "Party":
            if not actor.hidden_heroes:
                return []
            idx = targets.get("target_hidden_index", 0)
            if 0 <= idx < len(actor.hidden_heroes):
                ref = actor.hidden_heroes[idx]
                other_ability = cards.get(ref.card_id, {}).get("ability")
                if other_ability:
                    sub_targets = {k: v for k, v in (targets or {}).items() if k != "_perform_depth"}
                    sub_targets["_perform_depth"] = 1
                    return execute_ability(state, ref.card_id, other_ability, actor_player_id, sub_targets)
        return []

    if action == "Perform_Top":
        source = ability.get("source", "Graveyard")
        if source in ("Graveyard", "Graveyard_top") and state.graveyard:
            card_id = state.graveyard[-1]
            other_ability = cards.get(card_id, {}).get("ability")
            if other_ability:
                sub_targets = {k: v for k, v in (targets or {}).items() if k != "_perform_depth"}
                sub_targets["_perform_depth"] = 1
                return execute_ability(state, card_id, other_ability, actor_player_id, sub_targets)
        return []

    # ---- Draw_All_Tavern, Reveal_Harbor: multi-card; simplified ----
    if action == "Draw_All_Tavern":
        for i in range(TAVERN_SLOTS):
            if state.tavern[i]:
                events.append(("CardDrawn", CardDrawn(player_id=actor_player_id, card_id=state.tavern[i], source="tavern", tavern_slot=i).to_payload()))
        return events

    if action == "Reveal_Harbor":
        return []

    return []


def _resolve_zone(state: GameState, actor_id: str, zone: str, targets: dict) -> tuple[str | None, str | None, int | None]:
    """Return (from_zone, from_player_id, tavern_slot) or (to_zone, to_player_id, tavern_slot)."""
    if not zone:
        return (None, None, None)
    if zone == "hand" or zone == "self_hand":
        return ("hand", actor_id, None)
    if zone == "Tavern":
        slot = targets.get("tavern_slot", 0)
        return (f"tavern_{slot}", None, slot)
    if zone == "Harbor":
        return ("harbor", None, None)
    if zone == "Graveyard_top" or zone == "Graveyard":
        return ("graveyard", None, None)
    if zone == "Party" or zone == "Party_face_down":
        return ("party_hidden", actor_id, None)
    if zone == "face_up_party":
        return ("party_open", actor_id, None)
    if zone == "other_party" or zone == "other_party_face_down":
        other_id = _other_player_id(state, actor_id)
        return ("party_open" if "face_down" not in zone else "party_hidden", other_id, None)
    if zone == "self_party_face_down":
        return ("party_hidden", actor_id, None)
    return (zone, actor_id, None)
