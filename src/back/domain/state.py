"""
Game state (in-memory): result of reducing events.
Immutable-friendly: reducer returns new state.
"""
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from domain.constants import TAVERN_SLOTS


class TurnPhase(str, Enum):
    PLAY = "PLAY"
    DRAW = "DRAW"
    DISCARD = "DISCARD"
    REFILL_TAVERN = "REFILL_TAVERN"
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS"  # before game start


class HeroRef(BaseModel):
    card_id: str
    # faction/ability come from card catalog when needed


class PlayerInState(BaseModel):
    player_id: str
    name: str
    leader_card_id: str  # secret until game end
    hand_card_ids: list[str] = Field(default_factory=list)
    open_heroes: list[HeroRef] = Field(default_factory=list)
    hidden_heroes: list[HeroRef] = Field(default_factory=list)  # ordered stack
    player_token: str | None = None  # for rejoin


class GameState(BaseModel):
    room_id: str = ""
    num_players: int = 0
    game_mode: str = "full"
    creator_player_id: str | None = None  # first to join; transferred when they leave
    current_player_index: int = 0
    current_phase: TurnPhase = TurnPhase.WAITING_FOR_PLAYERS
    red_marker: int = 1
    green_marker: int = 1
    players: list[PlayerInState] = Field(default_factory=list)
    harbor: list[str] = Field(default_factory=list)  # card_id order (draw pile)
    wilderness: list[str] = Field(default_factory=list)  # discard pile card_ids for replay
    tavern: list[str | None] = Field(default_factory=lambda: [None] * TAVERN_SLOTS)
    graveyard: list[str] = Field(default_factory=list)  # top = last
    game_ended: bool = False
    winner_faction: str | None = None
    winner_player_id: str | None = None
    revealed_leaders: dict[str, dict[str, Any]] = Field(default_factory=dict)  # player_id -> leader info
    # Card catalog: card_id -> {faction, ability_id, name, leader_number?}; filled at room creation
    cards: dict[str, dict[str, Any]] = Field(default_factory=dict)

    model_config = {"arbitrary_types_allowed": True}

    def get_player(self, player_id: str) -> PlayerInState | None:
        for p in self.players:
            if p.player_id == player_id:
                return p
        return None

    def count_face_up_heroes(self) -> dict[str, int]:
        return {p.player_id: len(p.open_heroes) for p in self.players}

    def total_open_heroes(self) -> int:
        return sum(len(p.open_heroes) for p in self.players)
