"""Tests for domain.conditions: evaluate_condition."""
import sys
from pathlib import Path

_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

from domain.state import GameState, PlayerInState, HeroRef
from domain.conditions import evaluate_condition
from tests.conftest import make_catalog_with_markers


def _base_state():
    catalog = make_catalog_with_markers()
    return GameState(
        room_id="r1",
        cards=catalog,
        red_marker=5,
        green_marker=4,
        players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", open_heroes=[HeroRef(card_id="hero_0")], hidden_heroes=[HeroRef(card_id="hero_1")]),
            PlayerInState(player_id="p2", name="B", leader_card_id="l2", open_heroes=[], hidden_heroes=[]),
        ],
        tavern=["hero_1", "hero_3", None],
        graveyard=[],
    )


class TestNoRedInTavern:
    def test_true_when_no_imperials_in_tavern(self):
        state = _base_state()
        state.tavern = ["hero_1", "hero_2", "hero_3"]
        assert evaluate_condition("no_red_in_tavern", state) is True

    def test_false_when_imperials_in_tavern(self):
        state = _base_state()
        state.tavern = ["hero_0", "hero_1", None]
        assert evaluate_condition("no_red_in_tavern", state) is False


class TestGreenBehindRed:
    def test_true_when_green_less_than_red(self):
        state = _base_state()
        state.green_marker = 3
        state.red_marker = 5
        assert evaluate_condition("green_behind_red", state) is True

    def test_false_when_green_greater_or_equal_red(self):
        state = _base_state()
        state.green_marker = 5
        state.red_marker = 5
        assert evaluate_condition("green_behind_red", state) is False


class TestRedBehindGreen:
    def test_true_when_red_less_than_green(self):
        state = _base_state()
        state.red_marker = 2
        state.green_marker = 5
        assert evaluate_condition("red_behind_green", state) is True

    def test_false_when_red_greater_or_equal_green(self):
        state = _base_state()
        state.red_marker = 5
        state.green_marker = 5
        assert evaluate_condition("red_behind_green", state) is False


class TestHasRedParty:
    def test_true_when_imperials_in_party(self):
        state = _base_state()
        assert evaluate_condition("has_red_party", state, {"player_id": "p1"}) is True

    def test_false_when_no_imperials(self):
        state = _base_state()
        state.players[0].open_heroes = [HeroRef(card_id="hero_1")]
        state.players[0].hidden_heroes = [HeroRef(card_id="hero_2")]
        assert evaluate_condition("has_red_party", state, {"player_id": "p1"}) is False

    def test_false_when_no_context(self):
        state = _base_state()
        assert evaluate_condition("has_red_party", state) is False


class TestHasBlueBlackParty:
    def test_true_when_waterfolk_or_undead_in_party(self):
        state = _base_state()
        state.players[0].open_heroes = [HeroRef(card_id="hero_3")]
        assert evaluate_condition("has_blue_black_party", state, {"player_id": "p1"}) is True


class TestHasFaceDownUndead:
    def test_true_when_hidden_undead(self):
        state = _base_state()
        state.players[0].hidden_heroes = [HeroRef(card_id="hero_2")]
        assert evaluate_condition("has_face_down_undead", state) is True

    def test_false_when_no_hidden_undead(self):
        state = _base_state()
        state.players[0].hidden_heroes = [HeroRef(card_id="hero_0")]
        assert evaluate_condition("has_face_down_undead", state) is False


class TestNoUndead:
    def test_true_when_no_undead_anywhere(self):
        state = _base_state()
        state.tavern = ["hero_0", "hero_1", "hero_3"]
        state.players[0].open_heroes = [HeroRef(card_id="hero_0")]
        state.players[0].hidden_heroes = [HeroRef(card_id="hero_1")]
        assert evaluate_condition("no_undead", state, {"player_id": "p1"}) is True

    def test_false_when_undead_in_tavern(self):
        state = _base_state()
        state.tavern = ["hero_2", None, None]
        assert evaluate_condition("no_undead", state) is False


class TestUnknownCondition:
    def test_returns_false(self):
        state = _base_state()
        assert evaluate_condition("unknown_condition", state) is False
