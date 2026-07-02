"""
Evaluate ability condition strings against game state.
Used to decide whether an ability triggers (e.g. no_red_in_tavern, green_behind_red).
"""
from typing import Any

from domain.state import GameState

# Faction mapping: "red" = Imperials, "green" = Highlanders, "blue/black" = Waterfolk/Undead
RED_FACTIONS = {"Imperials"}
GREEN_FACTIONS = {"Highlanders"}
BLUE_BLACK_FACTIONS = {"Waterfolk", "Undead"}
# Lowercased for case-insensitive comparison (catalog may vary)
RED_FACTIONS_LOWER = {s.lower() for s in RED_FACTIONS}
GREEN_FACTIONS_LOWER = {s.lower() for s in GREEN_FACTIONS}
BLUE_BLACK_FACTIONS_LOWER = {s.lower() for s in BLUE_BLACK_FACTIONS}


def _card_faction(card_entry: dict) -> str:
    """Return faction from catalog entry; cards.json uses 'fraction', setup normalizes to 'faction'."""
    return (card_entry.get("faction") or card_entry.get("fraction") or "").strip()


def evaluate_condition(
    condition: str,
    state: GameState,
    context: dict[str, Any] | None = None,
) -> bool:
    """
    Return True if the condition is satisfied. context may contain player_id, target_player_id, etc.
    """
    context = context or {}
    cards = state.cards

    if condition == "no_red_in_tavern":
        for cid in state.tavern:
            if cid and _card_faction(cards.get(cid, {})) in RED_FACTIONS:
                return False
        return True

    if condition == "no_undead":
        for cid in state.tavern:
            if cid and _card_faction(cards.get(cid, {})) == "Undead":
                return False
        actor_id = context.get("player_id")
        if actor_id:
            p = state.get_player(actor_id)
            if p:
                for ref in p.open_heroes + p.hidden_heroes:
                    if _card_faction(cards.get(ref.card_id, {})) == "Undead":
                        return False
        return True

    if condition == "green_behind_red":
        return state.green_marker < state.red_marker

    if condition == "red_behind_green":
        return state.red_marker < state.green_marker

    def _current_player_id() -> str | None:
        if not state.players or state.current_player_index < 0 or state.current_player_index >= len(state.players):
            return None
        return state.players[state.current_player_index].player_id

    if condition == "has_red_party":
        actor_id = context.get("player_id")
        if not actor_id or actor_id != _current_player_id():
            return False
        p = state.get_player(actor_id)
        if not p:
            return False
        for ref in p.open_heroes + p.hidden_heroes:
            fac = _card_faction(cards.get(ref.card_id, {})).lower()
            if fac in RED_FACTIONS_LOWER:
                return True
        return False

    if condition == "has_blue_black_party":
        actor_id = context.get("player_id")
        if not actor_id or actor_id != _current_player_id():
            return False
        p = state.get_player(actor_id)
        if not p:
            return False
        for ref in p.open_heroes + p.hidden_heroes:
            fac = _card_faction(cards.get(ref.card_id, {})).lower()
            if fac in BLUE_BLACK_FACTIONS_LOWER:
                return True
        return False

    if condition == "has_face_down_undead":
        for p in state.players:
            for ref in p.hidden_heroes:
                if _card_faction(cards.get(ref.card_id, {})) == "Undead":
                    return True
        return False

    if condition == "has_face_down_green":
        for p in state.players:
            for ref in p.hidden_heroes:
                if _card_faction(cards.get(ref.card_id, {})) in GREEN_FACTIONS:
                    return True
        return False

    return False
