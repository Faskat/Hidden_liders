"""
Projection: project_state_for_player(state, player_id) -> view without leaking hidden info.
"""
from typing import Any

from domain.state import GameState, PlayerInState, HeroRef


def project_state_for_player(state: GameState, player_id: str) -> dict[str, Any]:
    """
    Return a JSON-serializable view for the given player.
    - Own hand, open_heroes, hidden_heroes (full), own leader (no number until game end).
    - Others: open_heroes (full), hidden_heroes count + order only, leader hidden until game end.
    """
    me = state.get_player(player_id)
    if not me:
        return {"error": "player_not_in_room"}

    def leader_view(p: PlayerInState, is_self: bool) -> dict:
        if state.game_ended and p.player_id in state.revealed_leaders:
            r = state.revealed_leaders[p.player_id]
            return {
                "leader_card_id": p.leader_card_id,
                "name": state.cards.get(p.leader_card_id, {}).get("name", ""),
                "fraction_1": r.get("fraction_1", ""),
                "fraction_2": r.get("fraction_2", ""),
                "leader_number": r.get("leader_number", 0),
            }
        if is_self:
            card = state.cards.get(p.leader_card_id, {})
            return {
                "leader_card_id": p.leader_card_id,
                "name": card.get("name", ""),
                "fraction_1": card.get("fraction_1", ""),
                "fraction_2": card.get("fraction_2", ""),
                "leader_number": None,
            }
        return {"leader_card_id": None, "name": None, "fraction_1": None, "fraction_2": None, "leader_number": None}

    def hero_ref_view(ref: HeroRef, card_catalog: dict) -> dict:
        c = card_catalog.get(ref.card_id, {})
        return {"card_id": ref.card_id, "faction": c.get("faction"), "name": c.get("name")}

    players_view = []
    for p in state.players:
        is_self = p.player_id == player_id
        if is_self:
            hand = list(p.hand_card_ids)
            open_heroes = [hero_ref_view(h, state.cards) for h in p.open_heroes]
            hidden_heroes = [hero_ref_view(h, state.cards) for h in p.hidden_heroes]
        else:
            hand = []
            open_heroes = [hero_ref_view(h, state.cards) for h in p.open_heroes]
            hidden_heroes = [{"count": len(p.hidden_heroes), "order": list(range(len(p.hidden_heroes)))}]
        players_view.append({
            "player_id": p.player_id,
            "name": p.name,
            "leader": leader_view(p, is_self),
            "hand_card_ids": hand,
            "hand_count": len(p.hand_card_ids) if not is_self else len(hand),
            "open_heroes": open_heroes,
            "hidden_heroes": hidden_heroes,
        })

    # Tavern: card ids and public card info
    tavern_view = []
    for slot in state.tavern:
        if slot:
            c = state.cards.get(slot, {})
            tavern_view.append({"card_id": slot, "faction": c.get("faction"), "name": c.get("name")})
        else:
            tavern_view.append(None)

    creator = state.creator_player_id
    if creator is None and state.players:
        creator = state.players[0].player_id

    return {
        "room_id": state.room_id,
        "creator_player_id": creator,
        "current_phase": state.current_phase.value,
        "current_player_index": state.current_player_index,
        "current_player_id": (
            state.players[state.current_player_index].player_id
            if state.players and 0 <= state.current_player_index < len(state.players)
            else None
        ),
        "red_marker": state.red_marker,
        "green_marker": state.green_marker,
        "players": players_view,
        "tavern": tavern_view,
        "harbor_count": len(state.harbor),
        "wilderness_count": len(state.wilderness),
        "graveyard_count": len(state.graveyard),
        "graveyard_top": (
            {"card_id": state.graveyard[-1], **state.cards.get(state.graveyard[-1], {})}
            if state.graveyard
            else None
        ),
        "game_ended": state.game_ended,
        "winner_faction": state.winner_faction,
        "winner_player_id": state.winner_player_id,
        "revealed_leaders": state.revealed_leaders if state.game_ended else {},
        "cards": dict(state.cards),
    }
