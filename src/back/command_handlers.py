"""
Command handlers: validate command against state, return list of (event_type, payload).
Abilities: start with marker movement only; extend later.
"""
from domain.state import GameState, TurnPhase
from domain.commands import (
    PlayCardCommand,
    DiscardCardsCommand,
    DrawFromTavernCommand,
    DrawFromHarborCommand,
    RefillTavernCommand,
)
import random
from domain.events import (
    CardPlayed,
    CardsDiscarded,
    DeckShuffled,
    MarkerMoved,
    CardDrawn,
    TavernRefilled,
    TurnPhaseChanged,
)


class CommandRejected(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message


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
    red_delta = card.get("red_delta", 0)
    green_delta = card.get("green_delta", 0)
    events = []
    events.append(("CardPlayed", CardPlayed(
        player_id=cmd.player_id,
        card_id=cmd.card_id,
        red_delta=red_delta,
        green_delta=green_delta,
        as_open=True,
    ).to_payload()))
    if red_delta or green_delta:
        events.append(("MarkerMoved", MarkerMoved(red_delta=red_delta, green_delta=green_delta).to_payload()))
    next_idx = (state.current_player_index + 1) % len(state.players)
    events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.DRAW.value, current_player_index=state.current_player_index).to_payload()))
    return events


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
    for slot in range(len(state.tavern)):
        if state.tavern[slot] is None and state.harbor:
            card_id = state.harbor[0]
            events.append(("TavernRefilled", TavernRefilled(slot_index=slot, card_id=card_id).to_payload()))
    # Step 4 done: always advance to next player's PLAY phase
    next_idx = (state.current_player_index + 1) % len(state.players)
    events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.PLAY.value, current_player_index=next_idx).to_payload()))
    return events
