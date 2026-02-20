"""Tests for event reducer: apply_event for each event type."""
import sys
from pathlib import Path

_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

from domain.state import GameState, PlayerInState, HeroRef, TurnPhase
from domain.reducer import apply_event
from tests.conftest import make_catalog


class TestReducerGameCreated:
    def test_sets_room_num_players_mode(self):
        state = GameState()
        out = apply_event(state, "GameCreated", {"room_id": "r1", "num_players": 4, "game_mode": "basic"})
        assert out.room_id == "r1"
        assert out.num_players == 4
        assert out.game_mode == "basic"


class TestReducerPlayerJoined:
    def test_appends_player(self):
        state = GameState(room_id="r1")
        out = apply_event(state, "PlayerJoined", {"player_id": "p1", "name": "Alice", "player_token": "t1"})
        assert len(out.players) == 1
        assert out.players[0].player_id == "p1"
        assert out.players[0].name == "Alice"
        assert out.players[0].player_token == "t1"
        assert out.players[0].hand_card_ids == []


class TestReducerMarkersPlaced:
    def test_sets_and_clamps(self):
        state = GameState()
        out = apply_event(state, "MarkersPlaced", {"red_position": 5, "green_position": 7})
        assert out.red_marker == 5
        assert out.green_marker == 7

    def test_clamps_to_1_12(self):
        state = GameState()
        out = apply_event(state, "MarkersPlaced", {"red_position": 0, "green_position": 15})
        assert out.red_marker == 1
        assert out.green_marker == 12


class TestReducerDeckShuffled:
    def test_sets_harbor(self):
        state = GameState()
        out = apply_event(state, "DeckShuffled", {"harbor_card_ids": ["a", "b", "c"], "source": "initial"})
        assert out.harbor == ["a", "b", "c"]

    def test_clears_wilderness_when_source_wilderness(self):
        state = GameState(wilderness=["x", "y"])
        out = apply_event(state, "DeckShuffled", {"harbor_card_ids": ["x", "y"], "source": "wilderness"})
        assert out.harbor == ["x", "y"]
        assert out.wilderness == []


class TestReducerCardPlayed:
    def test_removes_from_hand_adds_open_hero(self):
        catalog = make_catalog()
        state = GameState(
            cards=catalog,
            players=[PlayerInState(player_id="p1", name="A", leader_card_id="l1", hand_card_ids=["hero_r"])],
        )
        out = apply_event(state, "CardPlayed", {"player_id": "p1", "card_id": "hero_r", "as_open": True})
        p = out.get_player("p1")
        assert "hero_r" not in p.hand_card_ids
        assert len(p.open_heroes) == 1
        assert p.open_heroes[0].card_id == "hero_r"


class TestReducerMarkerMoved:
    def test_adds_delta_and_clamps(self):
        state = GameState(red_marker=5, green_marker=5)
        out = apply_event(state, "MarkerMoved", {"red_delta": 2, "green_delta": -1})
        assert out.red_marker == 7
        assert out.green_marker == 4

    def test_clamps_result(self):
        state = GameState(red_marker=12, green_marker=1)
        out = apply_event(state, "MarkerMoved", {"red_delta": 5, "green_delta": -5})
        assert out.red_marker == 12
        assert out.green_marker == 1


class TestReducerHeroPutFaceDown:
    def test_moves_card_from_hand_to_hidden(self):
        state = GameState(
            players=[PlayerInState(player_id="p1", name="A", leader_card_id="l1", hand_card_ids=["c1"])],
        )
        out = apply_event(state, "HeroPutFaceDown", {"player_id": "p1", "card_id": "c1"})
        p = out.get_player("p1")
        assert "c1" not in p.hand_card_ids
        assert len(p.hidden_heroes) == 1
        assert p.hidden_heroes[0].card_id == "c1"


class TestReducerHeroRevealed:
    def test_moves_hidden_to_open_by_card_id(self):
        state = GameState(
            players=[
                PlayerInState(
                    player_id="p1",
                    name="A",
                    leader_card_id="l1",
                    hidden_heroes=[HeroRef(card_id="c1"), HeroRef(card_id="c2")],
                ),
            ],
        )
        out = apply_event(state, "HeroRevealed", {"player_id": "p1", "card_id": "c2"})
        p = out.get_player("p1")
        assert len(p.hidden_heroes) == 1
        assert p.hidden_heroes[0].card_id == "c1"
        assert len(p.open_heroes) == 1
        assert p.open_heroes[0].card_id == "c2"


class TestReducerHeroKilled:
    def test_removes_from_open_heroes_to_graveyard(self):
        state = GameState(
            players=[PlayerInState(player_id="p1", name="A", leader_card_id="l1", open_heroes=[HeroRef(card_id="c1")])],
            graveyard=[],
        )
        out = apply_event(state, "HeroKilled", {"player_id": "p1", "card_id": "c1", "to_graveyard": True})
        p = out.get_player("p1")
        assert len(p.open_heroes) == 0
        assert out.graveyard == ["c1"]


class TestReducerHeroDrawn:
    def test_adds_to_hand_removes_from_harbor(self):
        state = GameState(
            harbor=["c1", "c2"],
            players=[PlayerInState(player_id="p1", name="A", leader_card_id="l1", hand_card_ids=[])],
        )
        out = apply_event(state, "HeroDrawn", {"player_id": "p1", "card_id": "c1", "source": "harbor"})
        p = out.get_player("p1")
        assert p.hand_card_ids == ["c1"]
        assert out.harbor == ["c2"]


class TestReducerGameEndTriggered:
    def test_sets_winner_faction_from_markers(self):
        state = GameState(red_marker=9, green_marker=10)
        out = apply_event(state, "GameEndTriggered", {"reason": "hero_limit"})
        assert out.game_ended is True
        assert out.winner_faction == "Undead"


class TestReducerLeaderRevealed:
    def test_stores_in_revealed_leaders(self):
        state = GameState(players=[PlayerInState(player_id="p1", name="A", leader_card_id="l1")])
        out = apply_event(
            state,
            "LeaderRevealed",
            {"player_id": "p1", "leader_card_id": "l1", "fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
        )
        assert "p1" in out.revealed_leaders
        assert out.revealed_leaders["p1"]["leader_number"] == 5


class TestReducerTavernRefilled:
    def test_sets_tavern_slot_and_removes_from_harbor_when_match(self):
        state = GameState(tavern=[None, None, None], harbor=["c1", "c2"])
        out = apply_event(state, "TavernRefilled", {"slot_index": 0, "card_id": "c1"})
        assert out.tavern[0] == "c1"
        assert out.harbor == ["c2"]

    def test_sets_tavern_slot_even_when_harbor_empty(self):
        """Replay scenario: harbor already emptied by previous TavernRefilled events."""
        state = GameState(tavern=[None, None, None], harbor=[])
        out = apply_event(state, "TavernRefilled", {"slot_index": 1, "card_id": "c1"})
        assert out.tavern[1] == "c1"
        assert out.harbor == []


class TestReducerFirstPlayerChosen:
    def test_sets_phase_play_and_current_player(self):
        state = GameState(
            current_phase=TurnPhase.WAITING_FOR_PLAYERS,
            players=[
                PlayerInState(player_id="p1", name="A", leader_card_id="l1"),
                PlayerInState(player_id="p2", name="B", leader_card_id="l2"),
            ],
        )
        out = apply_event(state, "FirstPlayerChosen", {"player_index": 1})
        assert out.current_phase == TurnPhase.PLAY
        assert out.current_player_index == 1
