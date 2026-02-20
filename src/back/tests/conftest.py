"""Shared fixtures for game logic tests."""
import sys
from pathlib import Path

# Ensure src/back is on path so "domain" resolves when running pytest from repo root
_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

from domain.state import GameState, PlayerInState, HeroRef, TurnPhase


def make_catalog():
    """Minimal card catalog for tests."""
    return {
        "leader_a": {"name": "A", "faction": "Leader", "fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
        "leader_b": {"name": "B", "faction": "Leader", "fraction_1": "Highlanders", "fraction_2": "Waterfolk", "leader_number": 3},
        "hero_r": {"name": "Red", "faction": "Imperials", "red_delta": 1, "green_delta": 0},
        "hero_g": {"name": "Green", "faction": "Highlanders", "red_delta": 0, "green_delta": 1},
        "hero_u": {"name": "U", "faction": "Undead", "red_delta": 0, "green_delta": 0},
    }


def two_player_state(catalog=None) -> GameState:
    """State with 2 players, leaders dealt, phase PLAY, current player 0."""
    catalog = catalog or make_catalog()
    state = GameState(
        room_id="r1",
        num_players=2,
        game_mode="full",
        cards=catalog,
        current_phase=TurnPhase.PLAY,
        current_player_index=0,
        red_marker=1,
        green_marker=1,
        players=[
            PlayerInState(player_id="p1", name="Alice", leader_card_id="leader_a", hand_card_ids=["hero_r"], player_token="t1"),
            PlayerInState(player_id="p2", name="Bob", leader_card_id="leader_b", hand_card_ids=["hero_g"], player_token="t2"),
        ],
        harbor=["hero_u"],
        tavern=["hero_r", None, None],
        wilderness=[],
        graveyard=[],
    )
    return state
