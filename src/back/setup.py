"""
Load cards catalog and generate setup events when game starts.
"""
import json
import os
import random
from pathlib import Path

from domain.events import (
    FirstPlayerChosen,
    LeaderDealt,
    MarkersPlaced,
    DeckShuffled,
    TavernFilled,
    HeroDrawn,
    HeroPutFaceDown,
    HeroDiscardedToWilderness,
    StartingHandSet,
)
from domain.state import GameState
from domain.constants import DECK_HERO_COUNT, TAVERN_SLOTS

CARDS_PATH = Path(__file__).parent / "data" / "cards.json"


def load_cards_catalog() -> dict[str, dict]:
    """Return card_id -> {name, faction, fraction_1?, fraction_2?, leader_number?, ability_id?, red_delta?, green_delta?}."""
    with open(CARDS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    catalog = {}
    for L in data.get("leaders", []):
        cid = L["id"]
        catalog[cid] = {
            "name": L["name"],
            "faction": "Leader",
            "fraction_1": L["fraction_1"],
            "fraction_2": L["fraction_2"],
            "leader_number": L["leader_number"],
        }
    heroes = data.get("heroes", [])
    deceased_id = data.get("deceased_emperor_id", "deceased_emperor")
    catalog[deceased_id] = {"name": "Deceased Emperor", "faction": "Joker", "ability_id": "none", "red_delta": 0, "green_delta": 0}
    # Expand heroes to DECK_HERO_COUNT (9 copies of each of 8) for full deck
    hero_ids = [h["id"] for h in heroes]
    while len(hero_ids) < DECK_HERO_COUNT:
        hero_ids.extend([h["id"] for h in heroes])
    hero_ids = hero_ids[:DECK_HERO_COUNT]
    for h in heroes:
        catalog[h["id"]] = {
            "name": h["name"],
            "faction": h["faction"],
            "ability_id": h.get("ability_id", "move_markers"),
            "red_delta": h.get("red_delta", 0),
            "green_delta": h.get("green_delta", 0),
        }
    return catalog


def build_harbor_and_tavern(hero_ids: list[str], deceased_id: str, seed: int | None = None) -> tuple[list[str], list[str], list[str]]:
    """Returns (harbor_shuffled, tavern_3_cards, graveyard_initial). Harbor excludes deceased; graveyard = [deceased]."""
    rng = random.Random(seed)
    harbor = [cid for cid in hero_ids if cid != deceased_id]
    rng.shuffle(harbor)
    tavern = []
    for _ in range(TAVERN_SLOTS):
        if harbor:
            tavern.append(harbor.pop(0))
    return harbor, tavern, [deceased_id]


def generate_setup_events(state: GameState, catalog: dict, seed: int | None = None) -> list[tuple[str, dict]]:
    """
    Generate setup events: LeaderDealt, FirstPlayerChosen, MarkersPlaced, DeckShuffled,
    GraveyardInitialized, TavernFilled, then per player: 5 draws, 1 put face-down, 1 discard, StartingHandSet(3).
    """
    from domain.events import GraveyardInitialized

    rng = random.Random(seed)
    events: list[tuple[str, dict]] = []
    leader_ids = [c for c in catalog if catalog.get(c, {}).get("fraction_1")]
    rng.shuffle(leader_ids)
    for i, p in enumerate(state.players):
        if i < len(leader_ids):
            events.append(("LeaderDealt", LeaderDealt(player_id=p.player_id, leader_card_id=leader_ids[i]).to_payload()))
    first_idx = rng.randint(0, len(state.players) - 1) if state.players else 0
    events.append(("FirstPlayerChosen", FirstPlayerChosen(player_index=first_idx, seed=seed).to_payload()))
    events.append(("MarkersPlaced", MarkersPlaced(red_position=1, green_position=1).to_payload()))
    hero_ids_unique = [c for c in catalog if catalog.get(c, {}).get("faction") not in ("Leader", "Joker") and c != "deceased_emperor"]
    # Rules: 72 hero cards in full game (73 with Deceased Emperor). Expand to 72.
    hero_ids = []
    while len(hero_ids) < DECK_HERO_COUNT:
        hero_ids.extend(hero_ids_unique)
    hero_ids = hero_ids[:DECK_HERO_COUNT]
    deceased_id = "deceased_emperor"
    harbor, tavern_cards, _ = build_harbor_and_tavern(hero_ids, deceased_id, seed)
    events.append(("DeckShuffled", DeckShuffled(harbor_card_ids=harbor, source="initial").to_payload()))
    events.append(("GraveyardInitialized", GraveyardInitialized(card_id=deceased_id).to_payload()))
    events.append(("TavernFilled", TavernFilled(tavern_slot_indices=list(range(TAVERN_SLOTS)), card_ids=tavern_cards).to_payload()))
    # Per-player: draw 5 from harbor (we simulate order), then 1 face-down, 1 discard, 3 in hand
    harbor_copy = list(harbor)
    for p in state.players:
        drawn = []
        for _ in range(5):
            if harbor_copy:
                drawn.append(harbor_copy.pop(0))
        if len(drawn) < 5:
            break
        face_down_id = drawn[0]
        discard_id = drawn[1]
        hand_ids = drawn[2:5]
        for cid in drawn:
            events.append(("HeroDrawn", HeroDrawn(player_id=p.player_id, card_id=cid, source="harbor").to_payload()))
        events.append(("HeroPutFaceDown", HeroPutFaceDown(player_id=p.player_id, card_id=face_down_id).to_payload()))
        events.append(("HeroDiscardedToWilderness", HeroDiscardedToWilderness(player_id=p.player_id, card_id=discard_id).to_payload()))
        events.append(("StartingHandSet", StartingHandSet(player_id=p.player_id, hand_card_ids=hand_ids).to_payload()))
    return events
