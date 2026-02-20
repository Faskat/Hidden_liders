"""Tests for command handlers: validation and rejection."""
import sys
from pathlib import Path

_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

import pytest
from domain.state import GameState, PlayerInState, HeroRef, TurnPhase
from domain.commands import PlayCardCommand, DiscardCardsCommand, DrawFromTavernCommand, DrawFromHarborCommand, RefillTavernCommand
from command_handlers import (
    handle_play_card,
    handle_discard_cards,
    handle_draw_from_tavern,
    handle_draw_from_harbor,
    handle_refill_tavern,
    CommandRejected,
)
from tests.conftest import two_player_state, make_catalog


class TestPlayCard:
    def test_rejects_when_not_your_turn(self):
        state = two_player_state()
        cmd = PlayCardCommand(room_id="r1", player_id="p2", card_id="hero_g")
        with pytest.raises(CommandRejected) as exc:
            handle_play_card(state, cmd)
        assert exc.value.code == "NOT_YOUR_TURN"

    def test_rejects_when_wrong_phase(self):
        state = two_player_state()
        state.current_phase = TurnPhase.DRAW
        cmd = PlayCardCommand(room_id="r1", player_id="p1", card_id="hero_r")
        with pytest.raises(CommandRejected) as exc:
            handle_play_card(state, cmd)
        assert exc.value.code == "INVALID_PHASE"

    def test_rejects_when_card_not_in_hand(self):
        state = two_player_state()
        cmd = PlayCardCommand(room_id="r1", player_id="p1", card_id="nonexistent")
        with pytest.raises(CommandRejected) as exc:
            handle_play_card(state, cmd)
        assert exc.value.code == "CARD_NOT_IN_HAND"

    def test_produces_card_played_and_marker_moved(self):
        state = two_player_state()
        cmd = PlayCardCommand(room_id="r1", player_id="p1", card_id="hero_r")
        events = handle_play_card(state, cmd)
        types = [e[0] for e in events]
        assert "CardPlayed" in types
        assert "MarkerMoved" in types
        assert "TurnPhaseChanged" in types


class TestDiscardCards:
    def test_rejects_when_not_play_phase(self):
        state = two_player_state()
        state.current_phase = TurnPhase.DRAW
        cmd = DiscardCardsCommand(room_id="r1", player_id="p1", card_ids=["hero_r"])
        with pytest.raises(CommandRejected) as exc:
            handle_discard_cards(state, cmd)
        assert exc.value.code == "INVALID_PHASE"

    def test_rejects_when_card_not_in_hand(self):
        state = two_player_state()
        cmd = DiscardCardsCommand(room_id="r1", player_id="p1", card_ids=["hero_g"])
        with pytest.raises(CommandRejected) as exc:
            handle_discard_cards(state, cmd)
        assert exc.value.code == "CARD_NOT_IN_HAND"

    def test_discard_phase_must_discard_to_exactly_three(self):
        state = two_player_state()
        state.current_phase = TurnPhase.DISCARD
        state.players[0].hand_card_ids = ["a", "b", "c", "d"]
        # Discarding 2 leaves 2 in hand; must have exactly 3, so this should be rejected
        cmd = DiscardCardsCommand(room_id="r1", player_id="p1", card_ids=["a", "b"])
        with pytest.raises(CommandRejected) as exc:
            handle_discard_cards(state, cmd)
        assert exc.value.code == "MUST_DISCARD_TO_THREE"


class TestDrawFromTavern:
    def test_rejects_empty_slot(self):
        state = two_player_state()
        state.current_phase = TurnPhase.DRAW
        state.tavern = [None, "hero_g", None]
        cmd = DrawFromTavernCommand(room_id="r1", player_id="p1", slot_index=0)
        with pytest.raises(CommandRejected) as exc:
            handle_draw_from_tavern(state, cmd)
        assert exc.value.code == "EMPTY_SLOT"


class TestDrawFromHarbor:
    def test_rejects_when_harbor_and_wilderness_empty(self):
        state = two_player_state()
        state.current_phase = TurnPhase.DRAW
        state.harbor = []
        state.wilderness = []
        cmd = DrawFromHarborCommand(room_id="r1", player_id="p1")
        with pytest.raises(CommandRejected) as exc:
            handle_draw_from_harbor(state, cmd)
        assert exc.value.code == "HARBOR_EMPTY"

    def test_produces_deck_shuffled_then_draw_when_harbor_empty_but_wilderness_not(self):
        state = two_player_state()
        state.current_phase = TurnPhase.DRAW
        state.harbor = []
        state.wilderness = ["c1", "c2"]
        cmd = DrawFromHarborCommand(room_id="r1", player_id="p1")
        events = handle_draw_from_harbor(state, cmd)
        assert events[0][0] == "DeckShuffled"
        assert events[0][1].get("source") == "wilderness"
        assert events[1][0] == "CardDrawn"


class TestRefillTavern:
    def test_rejects_when_wrong_phase(self):
        state = two_player_state()
        state.current_phase = TurnPhase.PLAY
        cmd = RefillTavernCommand(room_id="r1", player_id="p1")
        with pytest.raises(CommandRejected) as exc:
            handle_refill_tavern(state, cmd)
        assert exc.value.code == "INVALID_PHASE"
