"""Tests for projection: no leak of hidden info, own vs other view."""
import sys
from pathlib import Path

_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

from domain.state import GameState, PlayerInState, HeroRef
from domain.projection import project_state_for_player
from tests.conftest import make_catalog


def test_unknown_player_returns_error():
    catalog = make_catalog()
    state = GameState(
        room_id="r1",
        cards=catalog,
        players=[PlayerInState(player_id="p1", name="A", leader_card_id="leader_a")],
    )
    out = project_state_for_player(state, "p99")
    assert out.get("error") == "player_not_in_room"


def test_own_player_sees_hand_and_hidden_heroes():
    catalog = make_catalog()
    state = GameState(
        room_id="r1",
        cards=catalog,
        players=[
            PlayerInState(
                player_id="p1",
                name="Alice",
                leader_card_id="leader_a",
                hand_card_ids=["hero_r"],
                open_heroes=[HeroRef(card_id="hero_g")],
                hidden_heroes=[HeroRef(card_id="hero_u")],
            ),
            PlayerInState(player_id="p2", name="Bob", leader_card_id="leader_b", hand_card_ids=[]),
        ],
    )
    view = project_state_for_player(state, "p1")
    assert "error" not in view
    alice = next(p for p in view["players"] if p["player_id"] == "p1")
    assert alice["hand_card_ids"] == ["hero_r"]
    assert len(alice["open_heroes"]) == 1
    assert alice["open_heroes"][0]["card_id"] == "hero_g"
    assert len(alice["hidden_heroes"]) == 1
    assert alice["hidden_heroes"][0]["card_id"] == "hero_u"
    assert alice["leader"]["fraction_1"] == "Imperials"
    assert alice["leader"]["leader_number"] is None


def test_other_player_hidden_heroes_only_count_and_order():
    catalog = make_catalog()
    state = GameState(
        room_id="r1",
        cards=catalog,
        players=[
            PlayerInState(player_id="p1", name="Alice", leader_card_id="leader_a", hand_card_ids=[]),
            PlayerInState(
                player_id="p2",
                name="Bob",
                leader_card_id="leader_b",
                hand_card_ids=["hero_r"],
                open_heroes=[HeroRef(card_id="hero_g")],
                hidden_heroes=[HeroRef(card_id="c1"), HeroRef(card_id="c2")],
            ),
        ],
    )
    view = project_state_for_player(state, "p1")
    bob = next(p for p in view["players"] if p["player_id"] == "p2")
    assert bob["hand_card_ids"] == []
    assert bob["hand_count"] == 1
    assert bob["hidden_heroes"] == [{"count": 2, "order": [0, 1]}]
    assert bob["leader"]["leader_card_id"] is None
    assert bob["leader"]["fraction_1"] is None


def test_after_game_end_revealed_leaders_visible_to_all():
    catalog = make_catalog()
    state = GameState(
        room_id="r1",
        game_ended=True,
        winner_faction="Imperials",
        winner_player_id="p1",
        cards=catalog,
        players=[
            PlayerInState(player_id="p1", name="Alice", leader_card_id="leader_a"),
            PlayerInState(player_id="p2", name="Bob", leader_card_id="leader_b"),
        ],
        revealed_leaders={
            "p1": {"leader_card_id": "leader_a", "fraction_1": "Imperials", "fraction_2": "Undead", "leader_number": 5},
            "p2": {"leader_card_id": "leader_b", "fraction_1": "Highlanders", "fraction_2": "Waterfolk", "leader_number": 3},
        },
    )
    view1 = project_state_for_player(state, "p1")
    view2 = project_state_for_player(state, "p2")
    for view in (view1, view2):
        assert view["game_ended"] is True
        assert view["winner_faction"] == "Imperials"
        assert view["winner_player_id"] == "p1"
    alice_in_view2 = next(p for p in view2["players"] if p["player_id"] == "p1")
    assert alice_in_view2["leader"]["fraction_1"] == "Imperials"
    assert alice_in_view2["leader"]["leader_number"] == 5


def test_tavern_and_markers_in_view():
    catalog = make_catalog()
    state = GameState(
        room_id="r1",
        cards=catalog,
        red_marker=5,
        green_marker=7,
        tavern=["hero_r", "hero_g", None],
        harbor=["hero_u"],
        wilderness=["x"],
        players=[PlayerInState(player_id="p1", name="A", leader_card_id="leader_a")],
    )
    view = project_state_for_player(state, "p1")
    assert view["red_marker"] == 5
    assert view["green_marker"] == 7
    assert view["harbor_count"] == 1
    assert view["wilderness_count"] == 1
    assert len(view["tavern"]) == 3
    assert view["tavern"][0]["card_id"] == "hero_r"
    assert view["tavern"][2] is None


def test_view_includes_cards_catalog():
    catalog = make_catalog()
    state = GameState(
        room_id="r1",
        cards=catalog,
        players=[PlayerInState(player_id="p1", name="A", leader_card_id="leader_a")],
    )
    view = project_state_for_player(state, "p1")
    assert "cards" in view
    assert view["cards"] == catalog
    assert view["cards"].get("hero_r", {}).get("name") == "Red"
    assert view["cards"].get("hero_r", {}).get("faction") == "Imperials"
