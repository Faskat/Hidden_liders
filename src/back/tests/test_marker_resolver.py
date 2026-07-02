"""Tests for domain.marker_resolver: resolve_markers and compute_x."""
import sys
from pathlib import Path

_back = Path(__file__).resolve().parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

import pytest
from domain.state import GameState, PlayerInState, HeroRef
from domain.marker_resolver import resolve_markers, compute_x
from tests.conftest import make_catalog, make_catalog_with_markers


def _state_with_catalog(catalog):
    return GameState(
        room_id="r1",
        cards=catalog,
        red_marker=5,
        green_marker=4,
        players=[
            PlayerInState(player_id="p1", name="A", leader_card_id="l1", hand_card_ids=[], open_heroes=[HeroRef(card_id="hero_0")], hidden_heroes=[]),
            PlayerInState(player_id="p2", name="B", leader_card_id="l2", hand_card_ids=[], open_heroes=[], hidden_heroes=[HeroRef(card_id="hero_1")]),
        ],
        harbor=[],
        tavern=["hero_1", "hero_0", None],
        graveyard=["c1", "c2", "c3"],
    )


class TestResolveMarkersOldFormat:
    """Cards without 'markers' use red_delta/green_delta."""
    def test_uses_red_delta_green_delta(self):
        catalog = make_catalog()
        state = GameState(room_id="r1", cards=catalog)
        card = catalog["hero_r"]
        rd, gd = resolve_markers(state, card, None)
        assert rd == 1
        assert gd == 0

    def test_zero_deltas(self):
        catalog = make_catalog()
        state = GameState(room_id="r1", cards=catalog)
        card = catalog["hero_u"]
        rd, gd = resolve_markers(state, card, None)
        assert rd == 0
        assert gd == 0


class TestResolveMarkersAND:
    def test_and_numeric(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        card = catalog["hero_0"]
        rd, gd = resolve_markers(state, card, None)
        assert rd == 1
        assert gd == 0

    def test_and_both_nonzero(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        card = catalog["hero_1"]
        rd, gd = resolve_markers(state, card, None)
        assert rd == 0
        assert gd == 2


class TestResolveMarkersOR:
    def test_or_default_primary(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        card = catalog["hero_3"]
        rd, gd = resolve_markers(state, card, None)
        assert rd == 1
        assert gd == 0

    def test_or_choice_red_alt(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        card = catalog["hero_3"]
        rd, gd = resolve_markers(state, card, {"marker_choice": "red_alt"})
        assert rd == 2
        assert gd == 0


class TestResolveMarkersLeadingMarker:
    def test_leading_marker_returns_zero(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        card = catalog["hero_5"]
        rd, gd = resolve_markers(state, card, None)
        assert rd == 0
        assert gd == 0


class TestComputeX:
    def test_graveyard_count(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        card = catalog["hero_2"]
        x = compute_x(state, card, card.get("ability"), None)
        assert x == 3

    def test_tavern_not_red(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        state.tavern = ["hero_0", "hero_1", "hero_2"]
        card = catalog["hero_2"]
        ability = {"x_source": "tavern_not_red"}
        x = compute_x(state, card, ability, None)
        assert x == 2

    def test_tavern_not_green(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        state.tavern = ["hero_0", "hero_1", None]
        card = catalog["hero_2"]
        ability = {"x_source": "tavern_not_green"}
        x = compute_x(state, card, ability, None)
        assert x == 1


class TestResolveMarkersWithX:
    def test_x_substituted_from_ability(self):
        catalog = make_catalog_with_markers()
        state = _state_with_catalog(catalog)
        card = catalog["hero_2"]
        rd, gd = resolve_markers(state, card, None)
        assert rd == 3
        assert gd == 0
