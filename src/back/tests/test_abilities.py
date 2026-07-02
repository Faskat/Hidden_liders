"""Tests for domain.abilities: execute_ability."""
import sys
from pathlib import Path

_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

import pytest
from domain.state import GameState, PlayerInState, HeroRef
from domain.exceptions import CommandRejected
from domain.abilities import execute_ability
from tests.conftest import make_catalog_with_markers


def _state_two_players():
    catalog = make_catalog_with_markers()
    return GameState(
        room_id="r1",
        cards=catalog,
        red_marker=5,
        green_marker=4,
        players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", hand_card_ids=["hero_4"], open_heroes=[], hidden_heroes=[]),
            PlayerInState(player_id="p2", name="B", leader_card_id="l2", hand_card_ids=[], open_heroes=[], hidden_heroes=[HeroRef(card_id="hero_1"), HeroRef(card_id="hero_0")]),
        ],
        harbor=["hero_2", "hero_3"],
        tavern=["hero_0", None, None],
        graveyard=[],
    )


class TestExecuteAbilityKill:
    def test_produces_hero_killed(self):
        state = _state_two_players()
        ability = {"action": "Kill", "target_player": "other", "target_zone": "Party", "visibility": "face_down"}
        events = execute_ability(state, "hero_4", ability, "p1", {"target_player_id": "p2"})
        assert len(events) >= 1
        assert events[0][0] == "HeroKilled"
        assert events[0][1]["player_id"] == "p2"
        assert events[0][1]["card_id"] in ("hero_1", "hero_0")

    def test_with_target_card_id(self):
        state = _state_two_players()
        ability = {"action": "Kill", "target_player": "other", "target_zone": "Party", "visibility": "face_down"}
        events = execute_ability(state, "hero_4", ability, "p1", {"target_player_id": "p2", "target_card_id": "hero_1"})
        assert len(events) == 1
        assert events[0][0] == "HeroKilled"
        assert events[0][1]["card_id"] == "hero_1"


class TestExecuteAbilitySwapHand:
    def test_produces_hands_swapped(self):
        state = _state_two_players()
        ability = {"action": "Swap_Hand", "target_player": "other"}
        events = execute_ability(state, "hero_4", ability, "p1", None)
        assert len(events) == 1
        assert events[0][0] == "HandsSwapped"
        assert set(events[0][1].keys()) >= {"player_id_1", "player_id_2"}


class TestExecuteAbilityMoveMarkers:
    def test_produces_marker_moved(self):
        state = _state_two_players()
        ability = {"action": "Move_Markers", "options": ["-1 leading", "+2 behind"]}
        events = execute_ability(state, "hero_5", ability, "p1", {"move_markers_option": 0})
        assert any(e[0] == "MarkerMoved" for e in events)


class TestExecuteAbilityDraw:
    def test_draw_from_harbor_produces_card_drawn(self):
        state = _state_two_players()
        ability = {"action": "Draw", "source": "Harbor", "count": 1}
        events = execute_ability(state, "hero_4", ability, "p1", None)
        assert any(e[0] == "CardDrawn" for e in events)
        assert any(e[1].get("source") == "harbor" for e in events if e[0] == "CardDrawn")

    def test_draw_from_graveyard_produces_card_moved(self):
        state = _state_two_players()
        state.graveyard = ["hero_0", "hero_1", "hero_2"]
        ability = {"action": "Draw", "source": "Graveyard", "count": 3}
        events = execute_ability(state, "hero_4", ability, "p1", None)
        moved = [e for e in events if e[0] == "CardMoved"]
        assert len(moved) == 3
        assert all(e[1].get("from_zone") == "graveyard" and e[1].get("to_zone") == "hand" for e in moved)
        assert set(e[1]["card_id"] for e in moved) == {"hero_0", "hero_1", "hero_2"}

    def test_draw_from_graveyard_empty_rejects(self):
        state = _state_two_players()
        state.graveyard = []
        ability = {"action": "Draw", "source": "Graveyard", "count": 3}
        with pytest.raises(CommandRejected) as exc:
            execute_ability(state, "hero_4", ability, "p1", None)
        assert exc.value.code == "EMPTY_GRAVEYARD"


class TestExecuteAbilityNoAction:
    def test_empty_ability_returns_empty(self):
        state = _state_two_players()
        events = execute_ability(state, "hero_4", {}, "p1", None)
        assert events == []

    def test_condition_action_returns_empty(self):
        state = _state_two_players()
        ability = {"action": "Condition", "condition": "no_red_in_tavern"}
        events = execute_ability(state, "hero_4", ability, "p1", None)
        assert events == []


class TestExecuteAbilityKillDual:
    def test_produces_two_hero_killed_when_both_have_face_down(self):
        state = _state_two_players()
        ability = {"action": "Kill_Dual", "targets": ["self_face_down", "other_face_down"]}
        state.players[0].hidden_heroes = [HeroRef(card_id="hero_2")]
        events = execute_ability(state, "hero_4", ability, "p1", None)
        assert sum(1 for e in events if e[0] == "HeroKilled") == 2
