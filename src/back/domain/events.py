"""
Domain events: payloads for event store.

Schema evolution:
- Each payload includes "event_version": 1. When changing the shape of an event:
  1. Bump event_version in the new payloads.
  2. In the reducer (or a dedicated upcast layer), when replaying old events
     with event_version < N, apply an upcast function to produce the new shape
     before applying the event. New events use the current shape.
  3. parse_event() already ignores unknown fields (model_validate with model_fields),
     so adding optional fields is backward-compatible without upcast.
"""
from typing import Any

from pydantic import BaseModel, Field


def _payload(event_type: str, **kwargs: Any) -> dict:
    d = {"event_version": 1, "event_type": event_type, **kwargs}
    return {k: v for k, v in d.items() if v is not None}


# --- Setup ---
class GameCreated(BaseModel):
    room_id: str
    num_players: int
    game_mode: str = "full"  # full | basic
    seed: int | None = None

    def to_payload(self) -> dict:
        return _payload("GameCreated", **self.model_dump())


class PlayerJoined(BaseModel):
    player_id: str
    name: str
    player_token: str

    def to_payload(self) -> dict:
        return _payload("PlayerJoined", **self.model_dump())


class FirstPlayerChosen(BaseModel):
    player_index: int
    seed: int | None = None

    def to_payload(self) -> dict:
        return _payload("FirstPlayerChosen", **self.model_dump())


class LeaderDealt(BaseModel):
    player_id: str
    leader_card_id: str

    def to_payload(self) -> dict:
        return _payload("LeaderDealt", **self.model_dump())


class MarkersPlaced(BaseModel):
    red_position: int = 1
    green_position: int = 1

    def to_payload(self) -> dict:
        return _payload("MarkersPlaced", **self.model_dump())


class DeckShuffled(BaseModel):
    harbor_card_ids: list[str]
    source: str = "initial"  # initial | wilderness

    def to_payload(self) -> dict:
        return _payload("DeckShuffled", **self.model_dump())


class GraveyardInitialized(BaseModel):
    card_id: str  # Deceased Emperor

    def to_payload(self) -> dict:
        return _payload("GraveyardInitialized", **self.model_dump())


class TavernFilled(BaseModel):
    tavern_slot_indices: list[int]  # which slots got cards
    card_ids: list[str]

    def to_payload(self) -> dict:
        return _payload("TavernFilled", tavern_slot_indices=self.tavern_slot_indices, card_ids=self.card_ids)


class HeroDrawn(BaseModel):
    player_id: str
    card_id: str
    source: str  # harbor | tavern
    tavern_slot: int | None = None

    def to_payload(self) -> dict:
        return _payload("HeroDrawn", **self.model_dump())


class HeroPutFaceDown(BaseModel):
    player_id: str
    card_id: str

    def to_payload(self) -> dict:
        return _payload("HeroPutFaceDown", **self.model_dump())


class HeroDiscardedToWilderness(BaseModel):
    player_id: str
    card_id: str

    def to_payload(self) -> dict:
        return _payload("HeroDiscardedToWilderness", **self.model_dump())


class StartingHandSet(BaseModel):
    player_id: str
    hand_card_ids: list[str]

    def to_payload(self) -> dict:
        return _payload("StartingHandSet", **self.model_dump())


# --- Gameplay ---
class CardPlayed(BaseModel):
    player_id: str
    card_id: str
    red_delta: int = 0
    green_delta: int = 0
    as_open: bool = True  # False if goes to party face-down by ability

    def to_payload(self) -> dict:
        return _payload("CardPlayed", **self.model_dump())


class CardsDiscarded(BaseModel):
    player_id: str
    card_ids: list[str]

    def to_payload(self) -> dict:
        return _payload("CardsDiscarded", **self.model_dump())


class MarkerMoved(BaseModel):
    red_delta: int = 0
    green_delta: int = 0
    red_position: int | None = None
    green_position: int | None = None

    def to_payload(self) -> dict:
        return _payload("MarkerMoved", **self.model_dump())


class HeroRevealed(BaseModel):
    player_id: str
    card_id: str
    from_hidden_index: int | None = None

    def to_payload(self) -> dict:
        return _payload("HeroRevealed", **self.model_dump())


class HeroKilled(BaseModel):
    player_id: str
    card_id: str
    to_graveyard: bool = True

    def to_payload(self) -> dict:
        return _payload("HeroKilled", **self.model_dump())


class CardDrawn(BaseModel):
    player_id: str
    card_id: str
    source: str  # harbor | tavern
    tavern_slot: int | None = None

    def to_payload(self) -> dict:
        return _payload("CardDrawn", **self.model_dump())


class TavernRefilled(BaseModel):
    slot_index: int
    card_id: str

    def to_payload(self) -> dict:
        return _payload("TavernRefilled", **self.model_dump())


class TurnPhaseChanged(BaseModel):
    phase: str  # PLAY | DRAW | DISCARD | REFILL_TAVERN
    current_player_index: int | None = None

    def to_payload(self) -> dict:
        return _payload("TurnPhaseChanged", **self.model_dump())


# --- Finish ---
class GameEndTriggered(BaseModel):
    trigger_player_id: str | None = None
    reason: str = "hero_limit"

    def to_payload(self) -> dict:
        return _payload("GameEndTriggered", **self.model_dump())


class LeaderRevealed(BaseModel):
    player_id: str
    leader_card_id: str
    fraction_1: str
    fraction_2: str
    leader_number: int

    def to_payload(self) -> dict:
        return _payload("LeaderRevealed", **self.model_dump())


class WinnerDetermined(BaseModel):
    winner_player_id: str | None = None
    winner_faction: str

    def to_payload(self) -> dict:
        return _payload("WinnerDetermined", **self.model_dump())


# --- Parse from store payload ---
def parse_event(event_type: str, payload: dict) -> BaseModel | None:
    cls = {
        "GameCreated": GameCreated,
        "PlayerJoined": PlayerJoined,
        "FirstPlayerChosen": FirstPlayerChosen,
        "LeaderDealt": LeaderDealt,
        "MarkersPlaced": MarkersPlaced,
        "DeckShuffled": DeckShuffled,
        "GraveyardInitialized": GraveyardInitialized,
        "TavernFilled": TavernFilled,
        "HeroDrawn": HeroDrawn,
        "HeroPutFaceDown": HeroPutFaceDown,
        "HeroDiscardedToWilderness": HeroDiscardedToWilderness,
        "StartingHandSet": StartingHandSet,
        "CardPlayed": CardPlayed,
        "CardsDiscarded": CardsDiscarded,
        "MarkerMoved": MarkerMoved,
        "HeroRevealed": HeroRevealed,
        "HeroKilled": HeroKilled,
        "CardDrawn": CardDrawn,
        "TavernRefilled": TavernRefilled,
        "TurnPhaseChanged": TurnPhaseChanged,
        "GameEndTriggered": GameEndTriggered,
        "LeaderRevealed": LeaderRevealed,
        "WinnerDetermined": WinnerDetermined,
    }.get(event_type)
    if not cls:
        return None
    # Ignore unknown fields for schema evolution
    data = {k: v for k, v in payload.items() if k in cls.model_fields}
    return cls.model_validate(data)
