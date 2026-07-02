"""
Reducer: apply_event(state, event_type, payload) -> new GameState.
Pure: no DB, no side effects. Game end check is done in application layer after apply.
"""
from copy import deepcopy

from domain.events import parse_event
from domain.state import GameState, PlayerInState, HeroRef, TurnPhase
from domain.game_end import get_winning_faction
from domain.constants import MARKER_MIN, MARKER_MAX, TAVERN_SLOTS


def _clamp_marker(v: int) -> int:
    return max(MARKER_MIN, min(MARKER_MAX, v))


def apply_event(state: GameState, event_type: str, payload: dict) -> GameState:
    ev = parse_event(event_type, payload)
    if ev is None:
        return state
    # Work on a copy
    s = state.model_copy(deep=True)

    if event_type == "GameCreated":
        s.room_id = getattr(ev, "room_id", s.room_id)
        s.num_players = getattr(ev, "num_players", s.num_players)
        s.game_mode = getattr(ev, "game_mode", s.game_mode)
        return s

    if event_type == "PlayerJoined":
        pid = getattr(ev, "player_id", "")
        name = getattr(ev, "name", "")
        token = getattr(ev, "player_token", "")
        s.players.append(PlayerInState(
            player_id=pid,
            name=name,
            leader_card_id="",
            hand_card_ids=[],
            open_heroes=[],
            hidden_heroes=[],
            player_token=token,
        ))
        if s.creator_player_id is None:
            s.creator_player_id = pid
        return s

    if event_type == "PlayerLeft":
        pid = getattr(ev, "player_id", "")
        was_creator = s.creator_player_id == pid
        s.players = [p for p in s.players if p.player_id != pid]
        if was_creator and s.players:
            s.creator_player_id = s.players[0].player_id
        elif was_creator:
            s.creator_player_id = None
        return s

    if event_type == "BackToLobby":
        s.current_phase = TurnPhase.WAITING_FOR_PLAYERS
        s.game_ended = False
        s.winner_faction = None
        s.winner_player_id = None
        s.current_player_index = 0
        s.red_marker = 1
        s.green_marker = 1
        s.harbor = []
        s.wilderness = []
        s.tavern = [None] * TAVERN_SLOTS
        s.graveyard = []
        s.revealed_leaders = {}
        for p in s.players:
            p.leader_card_id = ""
            p.hand_card_ids = []
            p.open_heroes = []
            p.hidden_heroes = []
        return s

    if event_type == "FirstPlayerChosen":
        s.current_player_index = getattr(ev, "player_index", 0)
        s.current_phase = TurnPhase.PLAY
        return s

    if event_type == "LeaderDealt":
        pid = getattr(ev, "player_id", "")
        leader_id = getattr(ev, "leader_card_id", "")
        for p in s.players:
            if p.player_id == pid:
                p.leader_card_id = leader_id
                break
        return s

    if event_type == "MarkersPlaced":
        s.red_marker = _clamp_marker(getattr(ev, "red_position", 1))
        s.green_marker = _clamp_marker(getattr(ev, "green_position", 1))
        return s

    if event_type == "DeckShuffled":
        s.harbor = list(getattr(ev, "harbor_card_ids", []))
        if getattr(ev, "source", "") == "wilderness":
            s.wilderness = []
        return s

    if event_type == "GraveyardInitialized":
        s.graveyard.append(getattr(ev, "card_id", ""))
        return s

    if event_type == "TavernFilled":
        card_ids = getattr(ev, "card_ids", [])
        indices = getattr(ev, "tavern_slot_indices", [0, 1, 2])
        for i, idx in enumerate(indices):
            if idx < len(s.tavern) and i < len(card_ids):
                s.tavern[idx] = card_ids[i]
        return s

    if event_type == "HeroDrawn" or event_type == "CardDrawn":
        pid = getattr(ev, "player_id", "")
        card_id = getattr(ev, "card_id", "")
        source = getattr(ev, "source", "harbor")
        for p in s.players:
            if p.player_id == pid:
                p.hand_card_ids.append(card_id)
                break
        if source == "harbor" and s.harbor and s.harbor[0] == card_id:
            s.harbor = s.harbor[1:]
        elif source == "tavern":
            slot = getattr(ev, "tavern_slot", None)
            if slot is not None and 0 <= slot < len(s.tavern) and s.tavern[slot] == card_id:
                s.tavern[slot] = None
        return s

    if event_type == "HeroPutFaceDown":
        pid = getattr(ev, "player_id", "")
        card_id = getattr(ev, "card_id", "")
        for p in s.players:
            if p.player_id == pid:
                if card_id in p.hand_card_ids:
                    p.hand_card_ids.remove(card_id)
                p.hidden_heroes.append(HeroRef(card_id=card_id))
                break
        return s

    if event_type == "HeroDiscardedToWilderness":
        pid = getattr(ev, "player_id", "")
        card_id = getattr(ev, "card_id", "")
        for p in s.players:
            if p.player_id == pid:
                if card_id in p.hand_card_ids:
                    p.hand_card_ids.remove(card_id)
                break
        s.wilderness.append(card_id)
        return s

    if event_type == "StartingHandSet":
        pid = getattr(ev, "player_id", "")
        hand = getattr(ev, "hand_card_ids", [])
        for p in s.players:
            if p.player_id == pid:
                p.hand_card_ids = list(hand)
                break
        return s

    if event_type == "CardPlayed":
        pid = getattr(ev, "player_id", "")
        card_id = getattr(ev, "card_id", "")
        as_open = getattr(ev, "as_open", True)
        for p in s.players:
            if p.player_id == pid:
                if card_id in p.hand_card_ids:
                    p.hand_card_ids.remove(card_id)
                if as_open:
                    p.open_heroes.append(HeroRef(card_id=card_id))
                else:
                    p.hidden_heroes.append(HeroRef(card_id=card_id))
                break
        return s

    if event_type == "CardsDiscarded":
        pid = getattr(ev, "player_id", "")
        card_ids = getattr(ev, "card_ids", [])
        for p in s.players:
            if p.player_id == pid:
                for cid in card_ids:
                    if cid in p.hand_card_ids:
                        p.hand_card_ids.remove(cid)
                break
        s.wilderness.extend(card_ids)
        return s

    if event_type == "MarkerMoved":
        red_d = getattr(ev, "red_delta", 0)
        green_d = getattr(ev, "green_delta", 0)
        s.red_marker = _clamp_marker(s.red_marker + red_d)
        s.green_marker = _clamp_marker(s.green_marker + green_d)
        return s

    if event_type == "HeroRevealed":
        pid = getattr(ev, "player_id", "")
        card_id = getattr(ev, "card_id", "")
        from_idx = getattr(ev, "from_hidden_index", None)
        for p in s.players:
            if p.player_id == pid:
                if from_idx is not None and 0 <= from_idx < len(p.hidden_heroes):
                    ref = p.hidden_heroes.pop(from_idx)
                    p.open_heroes.append(ref)
                else:
                    # Find and move first matching hidden
                    for i, ref in enumerate(p.hidden_heroes):
                        if ref.card_id == card_id:
                            p.hidden_heroes.pop(i)
                            p.open_heroes.append(ref)
                            break
                break
        return s

    if event_type == "HeroKilled":
        pid = getattr(ev, "player_id", "")
        card_id = getattr(ev, "card_id", "")
        # Only send to wilderness when explicitly False; default is graveyard (Bury, Kill, etc.)
        to_graveyard = getattr(ev, "to_graveyard", True)
        if to_graveyard is not True and to_graveyard is not False:
            to_graveyard = True  # normalize 0/None/other to graveyard
        for p in s.players:
            if p.player_id == pid:
                for ref in list(p.open_heroes):
                    if ref.card_id == card_id:
                        p.open_heroes.remove(ref)
                        break
                else:
                    for ref in list(p.hidden_heroes):
                        if ref.card_id == card_id:
                            p.hidden_heroes.remove(ref)
                            break
                break
        if to_graveyard is False:
            s.wilderness.append(card_id)
        else:
            s.graveyard.append(card_id)
        return s

    if event_type == "TavernRefilled":
        slot = getattr(ev, "slot_index", 0)
        card_id = getattr(ev, "card_id", "")
        if 0 <= slot < len(s.tavern):
            s.tavern[slot] = card_id
            if s.harbor and s.harbor[0] == card_id:
                s.harbor = s.harbor[1:]
        return s

    if event_type == "CardMoved":
        card_id = getattr(ev, "card_id", "")
        from_zone = getattr(ev, "from_zone", "")
        to_zone = getattr(ev, "to_zone", "")
        from_pid = getattr(ev, "from_player_id", None)
        to_pid = getattr(ev, "to_player_id", None)
        slot_from = getattr(ev, "tavern_slot_from", None)
        slot_to = getattr(ev, "tavern_slot_to", None)

        def remove_from_zone():
            if from_zone == "hand" and from_pid:
                for p in s.players:
                    if p.player_id == from_pid and card_id in p.hand_card_ids:
                        p.hand_card_ids.remove(card_id)
                        return
            if from_zone == "party_open" and from_pid:
                for p in s.players:
                    if p.player_id == from_pid:
                        for ref in list(p.open_heroes):
                            if ref.card_id == card_id:
                                p.open_heroes.remove(ref)
                                return
            if from_zone == "party_hidden" and from_pid:
                for p in s.players:
                    if p.player_id == from_pid:
                        for ref in list(p.hidden_heroes):
                            if ref.card_id == card_id:
                                p.hidden_heroes.remove(ref)
                                return
            if from_zone.startswith("tavern_") and slot_from is not None and 0 <= slot_from < len(s.tavern):
                if s.tavern[slot_from] == card_id:
                    s.tavern[slot_from] = None
            if from_zone == "harbor" and s.harbor and card_id in s.harbor:
                s.harbor = [c for c in s.harbor if c != card_id]
            if from_zone == "graveyard" and s.graveyard and card_id in s.graveyard:
                s.graveyard = [c for c in s.graveyard if c != card_id]

        def add_to_zone():
            if to_zone == "hand" and to_pid:
                for p in s.players:
                    if p.player_id == to_pid:
                        p.hand_card_ids.append(card_id)
                        return
            if to_zone == "party_open" and to_pid:
                for p in s.players:
                    if p.player_id == to_pid:
                        p.open_heroes.append(HeroRef(card_id=card_id))
                        return
            if to_zone == "party_hidden" and to_pid:
                for p in s.players:
                    if p.player_id == to_pid:
                        p.hidden_heroes.append(HeroRef(card_id=card_id))
                        return
            if to_zone.startswith("tavern_") and slot_to is not None and 0 <= slot_to < len(s.tavern):
                s.tavern[slot_to] = card_id
            if to_zone == "harbor":
                s.harbor.insert(0, card_id)
            if to_zone == "graveyard":
                s.graveyard.append(card_id)
            if to_zone == "wilderness":
                s.wilderness.append(card_id)

        remove_from_zone()
        add_to_zone()
        return s

    if event_type == "HeroFlippedFaceDown":
        pid = getattr(ev, "player_id", "")
        card_id = getattr(ev, "card_id", "")
        for p in s.players:
            if p.player_id == pid:
                for ref in list(p.open_heroes):
                    if ref.card_id == card_id:
                        p.open_heroes.remove(ref)
                        p.hidden_heroes.append(ref)
                        break
                break
        return s

    if event_type == "HandsSwapped":
        pid1 = getattr(ev, "player_id_1", "")
        pid2 = getattr(ev, "player_id_2", "")
        p1 = next((p for p in s.players if p.player_id == pid1), None)
        p2 = next((p for p in s.players if p.player_id == pid2), None)
        if p1 and p2:
            p1.hand_card_ids, p2.hand_card_ids = p2.hand_card_ids, p1.hand_card_ids
        return s

    if event_type == "TurnPhaseChanged":
        phase = getattr(ev, "phase", s.current_phase.value)
        try:
            s.current_phase = TurnPhase(phase)
        except ValueError:
            pass
        if getattr(ev, "current_player_index", None) is not None:
            s.current_player_index = ev.current_player_index
        return s

    if event_type == "GameEndTriggered":
        s.game_ended = True
        s.winner_faction = get_winning_faction(s.red_marker, s.green_marker)
        return s

    if event_type == "LeaderRevealed":
        pid = getattr(ev, "player_id", "")
        s.revealed_leaders[pid] = {
            "leader_card_id": getattr(ev, "leader_card_id", ""),
            "fraction_1": getattr(ev, "fraction_1", ""),
            "fraction_2": getattr(ev, "fraction_2", ""),
            "leader_number": getattr(ev, "leader_number", 0),
        }
        return s

    if event_type == "WinnerDetermined":
        s.winner_player_id = getattr(ev, "winner_player_id", None)
        return s

    return state
