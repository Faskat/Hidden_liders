"""
Resolve card markers to (red_delta, green_delta) for CardPlayed/MarkerMoved events.
Supports AND, OR, OR_NEG, OR_NEG_DECIDE_LEFT, AND_OR, LEADING_MARKER and X/-X values.
"""
from typing import Any

from domain.constants import MARKER_MIN, MARKER_MAX
from domain.state import GameState


def _card_faction(card_entry: dict) -> str:
    """Return faction from catalog entry; cards.json uses 'fraction', setup normalizes to 'faction'."""
    return card_entry.get("faction") or card_entry.get("fraction") or ""


def _to_int(val: Any, x_val: int) -> int:
    """Convert marker value to int; 'X' -> x_val, '-X' -> -x_val, else int(val)."""
    if val == "X":
        return x_val
    if val == "-X":
        return -x_val
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def compute_x(state: GameState, card: dict, ability: dict | None, targets: dict | None) -> int:
    """
    Compute X for Calculation abilities / markers. Uses ability['x_source'] and state.
    targets may contain target_player_id, target_card_id for context.
    """
    targets = targets or {}
    ability = ability or {}
    x_source = ability.get("x_source")
    if not x_source:
        return 0

    cards_catalog = state.cards
    if x_source == "graveyard_count":
        return len(state.graveyard)

    if x_source == "tavern_not_red":
        # Count cards in tavern that are not Imperials (red)
        n = 0
        for cid in state.tavern:
            if cid and _card_faction(cards_catalog.get(cid, {})) != "Imperials":
                n += 1
        return n

    if x_source == "tavern_not_green":
        n = 0
        for cid in state.tavern:
            if cid and _card_faction(cards_catalog.get(cid, {})) != "Highlanders":
                n += 1
        return n

    target_player_id = targets.get("target_player_id")
    if x_source == "target_party_markers":
        # Sum of markers implied by target party cards (simplified: count of cards in that party)
        if not target_player_id:
            return 0
        p = state.get_player(target_player_id)
        if not p:
            return 0
        return len(p.open_heroes) + len(p.hidden_heroes)

    if x_source == "target_face_up_green":
        if not target_player_id:
            return 0
        p = state.get_player(target_player_id)
        if not p:
            return 0
        return sum(1 for ref in p.open_heroes if _card_faction(cards_catalog.get(ref.card_id, {})) == "Highlanders")

    if x_source == "target_face_up_blue":
        if not target_player_id:
            return 0
        p = state.get_player(target_player_id)
        if not p:
            return 0
        return sum(1 for ref in p.open_heroes if _card_faction(cards_catalog.get(ref.card_id, {})) == "Waterfolk")

    if x_source == "target_face_down_count":
        if not target_player_id:
            return 0
        p = state.get_player(target_player_id)
        if not p:
            return 0
        return len(p.hidden_heroes)

    return 0


def resolve_markers(
    state: GameState,
    card: dict,
    targets: dict | None,
    *,
    x_value: int | None = None,
) -> tuple[int, int]:
    """
    Resolve card markers to (red_delta, green_delta).
    targets: optional dict from PlayCardCommand (marker_choice, move_markers_option, etc.).
    x_value: if provided, use for X/-X instead of computing from ability (used when ability runs after markers).
    """
    targets = targets or {}
    markers = card.get("markers")
    if not markers:
        # Old format: use red_delta / green_delta from card
        return (card.get("red_delta", 0), card.get("green_delta", 0))

    logic = markers.get("logic", "AND")
    red_raw = markers.get("red", 0)
    green_raw = markers.get("green", 0)
    red_alt = markers.get("red_alt")
    green_alt = markers.get("green_alt")

    # Compute X if needed (for markers with "X" or "-X")
    need_x = red_raw in ("X", "-X") or green_raw in ("X", "-X")
    if need_x and x_value is None:
        x_value = compute_x(state, card, card.get("ability"), targets)
    elif x_value is None:
        x_value = 0

    def r(raw: Any) -> int:
        return _to_int(raw, x_value)

    if logic == "AND":
        return (r(red_raw), r(green_raw))

    if logic == "LEADING_MARKER":
        # Effect is applied in Move_Markers ability; no fixed deltas here
        return (0, 0)

    if logic == "OR":
        choice = targets.get("marker_choice")
        if choice == "green_alt" and green_alt is not None:
            return (r(red_raw), r(green_alt))
        if choice == "red_alt" and red_alt is not None:
            return (r(red_alt), r(green_raw))
        # Default: use primary (red, green)
        return (r(red_raw), r(green_raw))

    if logic == "OR_NEG":
        choice = targets.get("marker_choice")
        if choice == "neg":
            return (-r(red_raw), -r(green_raw))
        return (r(red_raw), r(green_raw))

    if logic == "OR_NEG_DECIDE_LEFT":
        choice = targets.get("marker_choice")
        if choice == "left":
            return (r(red_raw), r(green_raw))
        if choice == "right":
            return (-r(red_raw), -r(green_raw))
        return (r(red_raw), r(green_raw))

    if logic == "AND_OR":
        # Apply only ONE of the two (red or green), never both
        side = targets.get("marker_choice_side") or (
            targets.get("marker_choice") if targets.get("marker_choice") in ("red", "green") else None
        )
        if side == "green":
            return (0, r(green_raw))
        return (r(red_raw), 0)

    return (r(red_raw), r(green_raw))
