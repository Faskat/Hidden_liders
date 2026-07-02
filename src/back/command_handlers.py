"""
Command handlers: validate command against state, return list of (event_type, payload).
"""
import random

from domain.state import GameState, TurnPhase
from domain.exceptions import CommandRejected
from domain.commands import (
    PlayCardCommand,
    PassPlayCommand,
    DiscardCardsCommand,
    DrawFromTavernCommand,
    DrawFromHarborCommand,
    RefillTavernCommand,
)
from domain.events import (
    CardPlayed,
    CardsDiscarded,
    DeckShuffled,
    MarkerMoved,
    CardDrawn,
    TavernRefilled,
    TurnPhaseChanged,
)
from domain.marker_resolver import resolve_markers
from domain.conditions import evaluate_condition
from domain import abilities as abilities_module


def _current_player_id(state: GameState) -> str:
    if not state.players or state.current_player_index >= len(state.players):
        return ""
    return state.players[state.current_player_index].player_id


def handle_play_card(state: GameState, cmd: PlayCardCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.PLAY:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза гри (PLAY)")
    player = state.get_player(cmd.player_id)
    if not player or cmd.card_id not in player.hand_card_ids:
        raise CommandRejected("CARD_NOT_IN_HAND", "Карти немає на руці")
    card = state.cards.get(cmd.card_id, {})
    ability = card.get("ability")

    # For cards with condition: evaluate first; if false, no markers and no ability
    condition_met = True
    if ability and ability.get("condition"):
        condition_met = evaluate_condition(
            ability["condition"], state, {"player_id": cmd.player_id, **(cmd.targets or {})}
        )

    # Resolve marker deltas (new format: markers + logic; old format: red_delta/green_delta)
    # Also: for Calculation with target_* x_source and 2 players, fill target_player_id
    targets = dict(cmd.targets or {})
    # Normalize camelCase from API (e.g. targetPlayerId -> target_player_id, markerChoiceSide -> marker_choice_side)
    if not targets.get("target_player_id") and targets.get("targetPlayerId"):
        targets["target_player_id"] = targets["targetPlayerId"]
    if targets.get("markerChoiceSide") is not None and targets.get("marker_choice_side") is None:
        targets["marker_choice_side"] = targets["markerChoiceSide"]
    if targets.get("markerChoice") is not None and targets.get("marker_choice") is None:
        targets["marker_choice"] = targets["markerChoice"]
    if targets.get("targetHiddenIndex") is not None and targets.get("target_hidden_index") is None:
        targets["target_hidden_index"] = targets["targetHiddenIndex"]
    if targets.get("targetCardId") is not None and targets.get("target_card_id") is None:
        targets["target_card_id"] = targets["targetCardId"]
    if targets.get("performTargetCardId") is not None and targets.get("perform_target_card_id") is None:
        targets["perform_target_card_id"] = targets["performTargetCardId"]
    if targets.get("performTargetHiddenIndex") is not None and targets.get("perform_target_hidden_index") is None:
        targets["perform_target_hidden_index"] = targets["performTargetHiddenIndex"]
    if targets.get("flipOrLookChoice") is not None and targets.get("flip_or_look_choice") is None:
        targets["flip_or_look_choice"] = targets["flipOrLookChoice"]
    if targets.get("takeOrSwapChoice") is not None and targets.get("take_or_swap_choice") is None:
        targets["take_or_swap_choice"] = targets["takeOrSwapChoice"]
    if targets.get("swapHandCardId") is not None and targets.get("swap_hand_card_id") is None:
        targets["swap_hand_card_id"] = targets["swapHandCardId"]
    if ability and condition_met:
        x_source = ability.get("x_source")
        if x_source in ("target_party_markers", "target_face_up_green", "target_face_up_blue", "target_face_down_count"):
            if len(state.players) == 2 and not targets.get("target_player_id"):
                for p in state.players:
                    if p.player_id != cmd.player_id:
                        targets["target_player_id"] = p.player_id
                        break

    if card.get("markers") and condition_met:
        red_delta, green_delta = resolve_markers(state, card, targets)
    elif card.get("markers") and not condition_met:
        red_delta, green_delta = 0, 0
    else:
        red_delta = card.get("red_delta", 0) if condition_met else 0
        green_delta = card.get("green_delta", 0) if condition_met else 0

    # Card goes to open or hidden by default; Place or Swap hand<->party_face_down -> face down
    as_open = True
    if ability:
        tgt = (ability.get("target") or "").lower().replace(" ", "_")
        if ability.get("action") == "Place" and tgt in ("party", "party_face_down"):
            as_open = False
        if ability.get("action") == "Swap" and ability.get("source") == "hand" and "party_face_down" in tgt:
            as_open = False

    events = []
    events.append(("CardPlayed", CardPlayed(
        player_id=cmd.player_id,
        card_id=cmd.card_id,
        red_delta=red_delta,
        green_delta=green_delta,
        as_open=as_open,
    ).to_payload()))
    if red_delta or green_delta:
        events.append(("MarkerMoved", MarkerMoved(red_delta=red_delta, green_delta=green_delta).to_payload()))

    # Execute ability if present and condition (if any) is satisfied; skip Place when we already played face down
    run_ability = ability and ability.get("action") != "Place" and condition_met
    if run_ability:
        try:
            ability_events = abilities_module.execute_ability(
                state, cmd.card_id, ability, cmd.player_id, targets
            )
            events.extend(ability_events)
        except CommandRejected:
            raise

    # PlayExtra: do not end turn — same player keeps phase PLAY and can play another card
    if not (run_ability and ability and ability.get("action") == "PlayExtra"):
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.DRAW.value, current_player_index=state.current_player_index).to_payload()))
    return events


def handle_pass_play(state: GameState, cmd: PassPlayCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.PLAY:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза гри (PLAY)")
    return [
        (
            "TurnPhaseChanged",
            TurnPhaseChanged(
                phase=TurnPhase.DRAW.value,
                current_player_index=state.current_player_index,
            ).to_payload(),
        ),
    ]


def handle_discard_cards(state: GameState, cmd: DiscardCardsCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase not in (TurnPhase.PLAY, TurnPhase.DISCARD):
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза гри або скидання карт")
    player = state.get_player(cmd.player_id)
    if not player:
        raise CommandRejected("PLAYER_NOT_FOUND", "Гравця немає в кімнаті")
    for cid in cmd.card_ids:
        if cid not in player.hand_card_ids:
            raise CommandRejected("CARD_NOT_IN_HAND", f"Карти {cid} немає на руці")
    events = [
        ("CardsDiscarded", CardsDiscarded(player_id=cmd.player_id, card_ids=cmd.card_ids).to_payload()),
    ]
    if state.current_phase == TurnPhase.PLAY:
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.DRAW.value).to_payload()))
    else:
        # DISCARD phase: after discard must have exactly 3 cards
        if len(player.hand_card_ids) - len(cmd.card_ids) != 3:
            raise CommandRejected("MUST_DISCARD_TO_THREE", "Потрібно скинути до 3 карт")
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.REFILL_TAVERN.value).to_payload()))
    return events


def handle_draw_from_tavern(state: GameState, cmd: DrawFromTavernCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.DRAW:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза взяття карт (DRAW)")
    if cmd.slot_index < 0 or cmd.slot_index >= len(state.tavern):
        raise CommandRejected("INVALID_SLOT", "Невірний слот таверни")
    card_id = state.tavern[cmd.slot_index]
    if not card_id:
        raise CommandRejected("EMPTY_SLOT", "Слот таверни порожній")
    player = state.get_player(cmd.player_id)
    events = [
        ("CardDrawn", CardDrawn(
            player_id=cmd.player_id,
            card_id=card_id,
            source="tavern",
            tavern_slot=cmd.slot_index,
        ).to_payload()),
    ]
    if player and len(player.hand_card_ids) + 1 >= 4:
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.DISCARD.value).to_payload()))
    return events


def handle_draw_from_harbor(state: GameState, cmd: DrawFromHarborCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.DRAW:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза взяття карт (DRAW)")
    # Rules: if Harbor is empty, shuffle Wilderness to form new Harbor
    harbor = list(state.harbor)
    if not harbor and state.wilderness:
        shuffled = list(state.wilderness)
        random.shuffle(shuffled)
        events = [
            ("DeckShuffled", DeckShuffled(harbor_card_ids=shuffled, source="wilderness").to_payload()),
            ("CardDrawn", CardDrawn(player_id=cmd.player_id, card_id=shuffled[0], source="harbor").to_payload()),
        ]
    elif harbor:
        events = [
            ("CardDrawn", CardDrawn(player_id=cmd.player_id, card_id=harbor[0], source="harbor").to_payload()),
        ]
    else:
        raise CommandRejected("HARBOR_EMPTY", "Гавань і дикі землі порожні")
    player = state.get_player(cmd.player_id)
    if player and len(player.hand_card_ids) + 1 >= 4:
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.DISCARD.value).to_payload()))
    return events


def handle_refill_tavern(state: GameState, cmd: RefillTavernCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.REFILL_TAVERN:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза поповнення таверни")
    events = []
    harbor = list(state.harbor)  # карты снимаються по очердеи
    for slot in range(len(state.tavern)):
        if state.tavern[slot] is None and harbor:
            card_id = harbor.pop(0)  # убираеться верхняя карта
            events.append(("TavernRefilled", TavernRefilled(slot_index=slot, card_id=card_id).to_payload()))
    next_idx = (state.current_player_index + 1) % len(state.players)
    events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.PLAY.value, current_player_index=next_idx).to_payload()))
    return events
