"""Commands: validated at application layer against current state."""
from typing import Any

from pydantic import BaseModel, Field


class PlayCardCommand(BaseModel):
    room_id: str
    player_id: str
    card_id: str
    targets: dict[str, Any] | None = None  # e.g. {"target_player_id": "...", "target_card_id": "..."}


class DiscardCardsCommand(BaseModel):
    room_id: str
    player_id: str
    card_ids: list[str] = Field(..., min_length=1, max_length=3)


class DrawFromTavernCommand(BaseModel):
    room_id: str
    player_id: str
    slot_index: int  # 0..2


class DrawFromHarborCommand(BaseModel):
    room_id: str
    player_id: str


class RefillTavernCommand(BaseModel):
    room_id: str
    player_id: str
    # Optional: server can infer empty slots
