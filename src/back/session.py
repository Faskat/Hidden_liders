"""
GameSession (in-memory) and SessionManager. Load from events, apply commands, persist events.
Lock per room for concurrent command handling.
"""
import threading
import uuid
from typing import Any

from domain.state import GameState, TurnPhase
from domain.reducer import apply_event
from domain.game_end import check_game_end_after_event, determine_winner
from domain.events import parse_event
from event_store import EventStore, init_db


class GameSession:
    """One room: state in memory, commands produce events then persist and apply."""

    def __init__(self, room_id: str, state: GameState):
        self.room_id = room_id
        self.state = state

    def apply_event_to_state(self, event_type: str, payload: dict) -> None:
        self.state = apply_event(self.state, event_type, payload)

    def load_from_events(self, events: list[tuple[str, str, dict, int]]) -> None:
        """Replay events in order to rebuild state."""
        for _id, event_type, payload, _seq in events:
            self.state = apply_event(self.state, event_type, payload)


def load_from_events(room_id: str, event_store: EventStore, cards_catalog: dict[str, dict]) -> GameSession | None:
    """Load session by reading all events for room and reducing. cards_catalog: card_id -> {faction, ability_id, ...}."""
    events = event_store.get_events_for_room(room_id)
    if not events:
        return None
    state = GameState(room_id=room_id, cards=cards_catalog)
    session = GameSession(room_id=room_id, state=state)
    session.load_from_events(events)
    session.state.cards = session.state.cards or cards_catalog
    return session


class SessionManager:
    """In-memory cache of up to 10 rooms; load from event store on miss."""

    MAX_ROOMS = 10
    MAX_IDEMPOTENCY_KEYS_PER_ROOM = 500

    def __init__(self, event_store: EventStore, cards_catalog: dict[str, dict]):
        self._event_store = event_store
        self._cards = cards_catalog
        self._sessions: dict[str, GameSession] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._lock = threading.Lock()
        self._idempotency: dict[str, set[tuple[str, str]]] = {}  # room_id -> set of (player_id, key)

    def _room_lock(self, room_id: str) -> threading.Lock:
        with self._lock:
            if room_id not in self._locks:
                self._locks[room_id] = threading.Lock()
            return self._locks[room_id]

    def get_or_load(self, room_id: str) -> GameSession | None:
        with self._lock:
            if room_id in self._sessions:
                return self._sessions[room_id]
        session = load_from_events(room_id, self._event_store, self._cards)
        if not session:
            return None
        with self._lock:
            if room_id in self._sessions:
                return self._sessions[room_id]
            if len(self._sessions) >= self.MAX_ROOMS:
                return session
            self._sessions[room_id] = session
        return session

    def put(self, room_id: str, session: GameSession) -> None:
        with self._lock:
            if len(self._sessions) >= self.MAX_ROOMS and room_id not in self._sessions:
                return
            self._sessions[room_id] = session

    def put_if_capacity(self, room_id: str, session: GameSession) -> bool:
        """Put session in cache only if under MAX_ROOMS. Returns True if added."""
        with self._lock:
            if len(self._sessions) >= self.MAX_ROOMS and room_id not in self._sessions:
                return False
            self._sessions[room_id] = session
            return True

    def check_can_create_room(self) -> None:
        """Raise RuntimeError if cache is at capacity (call before creating a new room)."""
        with self._lock:
            if len(self._sessions) >= self.MAX_ROOMS:
                raise RuntimeError("TOO_MANY_ROOMS")

    def is_idempotent_command_processed(self, room_id: str, player_id: str, idempotency_key: str) -> bool:
        """True if this (room, player, key) was already applied. Call with room lock held."""
        s = self._idempotency.get(room_id)
        return s is not None and (player_id, idempotency_key) in s

    def record_idempotent_command(self, room_id: str, player_id: str, idempotency_key: str) -> None:
        """Record that this command was applied. Call with room lock held. Evicts oldest if over limit."""
        if room_id not in self._idempotency:
            self._idempotency[room_id] = set()
        s = self._idempotency[room_id]
        s.add((player_id, idempotency_key))
        while len(s) > self.MAX_IDEMPOTENCY_KEYS_PER_ROOM:
            s.pop()

    def persist_and_apply(self, session: GameSession, events: list[tuple[str, dict]]) -> None:
        """Append events to store (atomically) then apply each to session.state. Call with room lock held."""
        from domain.events import GameEndTriggered, LeaderRevealed, WinnerDetermined

        room_id = session.room_id
        if events:
            self._event_store.append_many(room_id, events)
            for event_type, payload in events:
                session.apply_event_to_state(event_type, payload)

        if session.state.game_ended:
            return
        if not check_game_end_after_event(session.state):
            return
        # Game-end events must be applied in order so determine_winner() sees revealed_leaders
        self._event_store.append(room_id, "GameEndTriggered", GameEndTriggered(reason="hero_limit").to_payload())
        session.apply_event_to_state("GameEndTriggered", {"reason": "hero_limit"})
        for p in session.state.players:
            card = session.state.cards.get(p.leader_card_id, {})
            pl = LeaderRevealed(
                player_id=p.player_id,
                leader_card_id=p.leader_card_id,
                fraction_1=card.get("fraction_1", ""),
                fraction_2=card.get("fraction_2", ""),
                leader_number=card.get("leader_number", 0),
            ).to_payload()
            self._event_store.append(room_id, "LeaderRevealed", pl)
            session.apply_event_to_state("LeaderRevealed", pl)
        winner_id = determine_winner(session.state)
        wd = WinnerDetermined(
            winner_player_id=winner_id,
            winner_faction=session.state.winner_faction or "",
        ).to_payload()
        self._event_store.append(room_id, "WinnerDetermined", wd)
        session.apply_event_to_state("WinnerDetermined", wd)

    def force_finish_game(self, session: GameSession) -> None:
        """Force end the game (for testing). Appends GameEndTriggered, LeaderRevealed, WinnerDetermined. Call with room lock held."""
        from domain.events import GameEndTriggered, LeaderRevealed, WinnerDetermined

        if session.state.game_ended:
            return
        room_id = session.room_id
        self._event_store.append(room_id, "GameEndTriggered", GameEndTriggered(reason="test").to_payload())
        session.apply_event_to_state("GameEndTriggered", {"reason": "test"})
        for p in session.state.players:
            card = session.state.cards.get(p.leader_card_id, {})
            pl = LeaderRevealed(
                player_id=p.player_id,
                leader_card_id=p.leader_card_id,
                fraction_1=card.get("fraction_1", ""),
                fraction_2=card.get("fraction_2", ""),
                leader_number=card.get("leader_number", 0),
            ).to_payload()
            self._event_store.append(room_id, "LeaderRevealed", pl)
            session.apply_event_to_state("LeaderRevealed", pl)
        winner_id = determine_winner(session.state)
        wd = WinnerDetermined(
            winner_player_id=winner_id,
            winner_faction=session.state.winner_faction or "",
        ).to_payload()
        self._event_store.append(room_id, "WinnerDetermined", wd)
        session.apply_event_to_state("WinnerDetermined", wd)
