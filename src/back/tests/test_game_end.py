"""Tests for game end: winning faction order, hero limit, tie-break."""
import sys
from pathlib import Path

_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

from domain.state import GameState, PlayerInState, HeroRef
from domain.game_end import (
    get_winning_faction,
    hero_limit_reached,
    check_game_end_after_event,
    determine_winner,
    DARK_WAR_SPACES,
    HERO_LIMIT,
)
from tests.conftest import make_catalog


class TestGetWinningFaction:
    """Rule order: Undead > Water > Empire > Tribes."""

    def test_undead_both_dark(self):
        for r in DARK_WAR_SPACES:
            for g in DARK_WAR_SPACES:
                assert get_winning_faction(r, g) == "Undead"

    def test_undead_overrides_others(self):
        assert get_winning_faction(9, 10) == "Undead"
        assert get_winning_faction(12, 12) == "Undead"

    def test_water_adjacent_or_same(self):
        assert get_winning_faction(1, 1) == "Waterfolk"
        assert get_winning_faction(1, 2) == "Waterfolk"
        assert get_winning_faction(5, 6) == "Waterfolk"

    def test_empire_red_two_ahead(self):
        assert get_winning_faction(4, 2) == "Imperials"
        assert get_winning_faction(5, 3) == "Imperials"
        # (12, 10) is Undead (both dark); use positions not in dark zone for Empire
        assert get_winning_faction(8, 6) == "Imperials"

    def test_tribes_green_two_ahead(self):
        assert get_winning_faction(2, 4) == "Highlanders"
        assert get_winning_faction(1, 3) == "Highlanders"

    def test_water_adjacent(self):
        assert get_winning_faction(4, 5) == "Waterfolk"


class TestHeroLimitReached:
    def test_full_game_2p_limit_8(self):
        state = GameState(num_players=2, game_mode="full", players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", open_heroes=[HeroRef(card_id="h") for _ in range(8)]),
        ])
        assert hero_limit_reached(state) is True

    def test_full_game_2p_7_not_triggered(self):
        state = GameState(num_players=2, game_mode="full", players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", open_heroes=[HeroRef(card_id="h") for _ in range(7)]),
        ])
        assert hero_limit_reached(state) is False

    def test_basic_game_2p_limit_7(self):
        state = GameState(num_players=2, game_mode="basic", players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", open_heroes=[HeroRef(card_id="h") for _ in range(7)]),
        ])
        assert hero_limit_reached(state) is True

    def test_hidden_heroes_not_counted(self):
        state = GameState(num_players=2, game_mode="full", players=[
            PlayerInState(
                player_id="p1",
                name="A",
                leader_card_id="l1",
                open_heroes=[HeroRef(card_id="o") for _ in range(7)],
                hidden_heroes=[HeroRef(card_id="x") for _ in range(5)],
            ),
        ])
        assert hero_limit_reached(state) is False


class TestCheckGameEndAfterEvent:
    def test_returns_false_if_already_ended(self):
        state = GameState(game_ended=True, num_players=2, players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", open_heroes=[HeroRef(card_id="h") for _ in range(8)]),
        ])
        assert check_game_end_after_event(state) is False

    def test_returns_true_when_limit_reached(self):
        state = GameState(num_players=2, game_mode="full", players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", open_heroes=[HeroRef(card_id="h") for _ in range(8)]),
        ])
        assert check_game_end_after_event(state) is True


class TestDetermineWinner:
    def test_none_if_no_winner_faction(self):
        state = GameState(winner_faction=None, players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1"),
        ])
        assert determine_winner(state) is None

    def test_none_if_no_aligned_player(self):
        catalog = make_catalog()
        state = GameState(
            winner_faction="Imperials",
            cards=catalog,
            players=[
                PlayerInState(player_id="p1", name="A", leader_card_id="leader_b"),  # Highlanders, Waterfolk
            ],
            revealed_leaders={"p1": {"fraction_1": "Highlanders", "fraction_2": "Waterfolk", "leader_number": 3}},
        )
        assert determine_winner(state) is None

    def test_single_aligned_wins(self):
        catalog = make_catalog()
        state = GameState(
            winner_faction="Imperials",
            cards=catalog,
            players=[
                PlayerInState(player_id="p1", name="A", leader_card_id="leader_a", open_heroes=[HeroRef(card_id="hero_r")]),
            ],
            revealed_leaders={"p1": {"fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5}},
        )
        assert determine_winner(state) == "p1"

    def test_tie_break_most_faction_heroes(self):
        catalog = make_catalog()
        state = GameState(
            winner_faction="Imperials",
            cards=catalog,
            players=[
                PlayerInState(player_id="p1", name="A", leader_card_id="leader_a", open_heroes=[HeroRef(card_id="hero_r"), HeroRef(card_id="hero_r")]),
                PlayerInState(player_id="p2", name="B", leader_card_id="leader_a", open_heroes=[HeroRef(card_id="hero_r")]),
            ],
            revealed_leaders={
                "p1": {"fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
                "p2": {"fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
            },
        )
        assert determine_winner(state) == "p1"

    def test_tie_break_fewer_total_heroes(self):
        catalog = make_catalog()
        state = GameState(
            winner_faction="Imperials",
            cards=catalog,
            players=[
                PlayerInState(player_id="p1", name="A", leader_card_id="leader_a", open_heroes=[HeroRef(card_id="hero_r")], hidden_heroes=[HeroRef(card_id="hero_u")]),
                PlayerInState(player_id="p2", name="B", leader_card_id="leader_a", open_heroes=[HeroRef(card_id="hero_r")], hidden_heroes=[]),
            ],
            revealed_leaders={
                "p1": {"fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
                "p2": {"fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
            },
        )
        assert determine_winner(state) == "p2"

    def test_tie_break_higher_leader_number(self):
        catalog = make_catalog()
        state = GameState(
            winner_faction="Imperials",
            cards=catalog,
            players=[
                PlayerInState(player_id="p1", name="A", leader_card_id="leader_a", open_heroes=[HeroRef(card_id="hero_r")]),
                PlayerInState(player_id="p2", name="B", leader_card_id="leader_a", open_heroes=[HeroRef(card_id="hero_r")]),
            ],
            revealed_leaders={
                "p1": {"fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 3},
                "p2": {"fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
            },
        )
        assert determine_winner(state) == "p2"
