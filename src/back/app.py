"""
FastAPI app: rooms, join, state, commands. Player auth via X-Player-Token.
"""
import random
import threading
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Body, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from config import settings, get_cors_origins_list
from event_store import init_db, EventStore
from session import SessionManager, GameSession, load_from_events
from domain.state import GameState, TurnPhase
from domain.reducer import apply_event
from domain.projection import project_state_for_player
from domain.events import GameCreated, PlayerJoined, PlayerLeft, BackToLobby
from setup import generate_setup_events
from domain.exceptions import CommandRejected
from domain.conditions import evaluate_condition
from command_handlers import (
    handle_play_card,
    handle_pass_play,
    handle_discard_cards,
    handle_draw_from_tavern,
    handle_draw_from_harbor,
    handle_refill_tavern,
)
from domain.commands import (
    PlayCardCommand,
    PassPlayCommand,
    DiscardCardsCommand,
    DrawFromTavernCommand,
    DrawFromHarborCommand,
    RefillTavernCommand,
)

def _log_level() -> int:
    name = getattr(settings, "log_level", "INFO").upper()
    level = getattr(logging, name, None)
    return level if isinstance(level, int) else logging.INFO


logging.basicConfig(level=_log_level())
logger = logging.getLogger(__name__)

# Cards catalog: loaded in lifespan from data/cards.json
CARDS_CATALOG: dict = {}

event_store = EventStore()
session_manager: SessionManager | None = None
_room_creation_lock = threading.Lock()


def _generate_room_id() -> str:
    """Unique 4-digit room code."""
    for _ in range(100):
        code = str(random.randint(1000, 9999))
        if not event_store.get_events_for_room(code):
            return code
    raise HTTPException(503, detail={"code": "NO_ROOM_ID", "message": "Не вдалося згенерувати унікальний код кімнати"})


@asynccontextmanager
async def lifespan(app: FastAPI):
    global session_manager, CARDS_CATALOG
    init_db()
    try:
        from setup import load_cards_catalog
        CARDS_CATALOG = load_cards_catalog()
        logger.info("loaded_cards_catalog count=%s", len(CARDS_CATALOG))
    except FileNotFoundError as e:
        logger.warning("cards.json not found: %s; game start will fail until data is present", e)
    except Exception as e:
        logger.exception("failed to load cards catalog: %s", e)
    session_manager = SessionManager(event_store, CARDS_CATALOG)
    yield
    session_manager = None


app = FastAPI(
    title="Hidden Leaders API",
    description="Event-sourcing backend for Hidden Leaders board game. Create rooms, join, start, send commands.",
    version="1.0.0",
    lifespan=lifespan,
)
router = APIRouter(prefix="/v1", tags=["game"])


def get_session_manager() -> SessionManager:
    if session_manager is None:
        raise RuntimeError("SessionManager not initialized")
    return session_manager


# --- DTOs ---
class CreateRoomRequest(BaseModel):
    num_players: int = 2
    game_mode: str = "full"


class JoinRoomRequest(BaseModel):
    name: str


class RejoinRequest(BaseModel):
    player_token: str


class LeaveRequest(BaseModel):
    """Optional body for leave; used by sendBeacon (no custom headers on unload)."""
    player_token: str | None = None


class KickRequest(BaseModel):
    """Creator kicks a player from the lobby."""
    player_id: str


class CommandRequest(BaseModel):
    command: str
    payload: dict


# Command payloads (strict validation per command)
class PlayCardPayload(BaseModel):
    card_id: str
    targets: dict | None = None


class DiscardCardsPayload(BaseModel):
    card_ids: list[str] = Field(..., min_length=1, max_length=3)


class DrawFromTavernPayload(BaseModel):
    slot_index: int = Field(..., ge=0, le=2)


class DrawFromHarborPayload(BaseModel):
    pass


class RefillTavernPayload(BaseModel):
    pass


# --- Helpers ---
def _player_id_from_token(session: GameSession, token: str) -> str | None:
    for p in session.state.players:
        if p.player_token == token:
            return p.player_id
    return None


# --- Health (no prefix, for load balancers) ---
@app.get("/health", summary="Liveness")
def health():
    """Process is alive."""
    return {"status": "ok"}


@app.get("/ready", summary="Readiness")
def ready():
    """Ready to serve: DB and cards catalog loaded."""
    try:
        get_session_manager()
    except RuntimeError:
        raise HTTPException(503, detail={"code": "NOT_READY", "message": "Менеджер сесій не ініціалізовано"})
    if not CARDS_CATALOG:
        raise HTTPException(503, detail={"code": "CARDS_NOT_LOADED", "message": "Каталог карт не завантажено"})
    return {"status": "ready"}


# --- Routes (v1) ---
@router.post("/rooms", summary="Create room", response_model=dict)
def create_room(body: CreateRoomRequest):
    if body.num_players < 2 or body.num_players > 6:
        raise HTTPException(400, detail={"code": "INVALID_NUM_PLAYERS", "message": "Кількість гравців має бути від 2 до 6"})
    mgr = get_session_manager()
    try:
        mgr.check_can_create_room()
    except RuntimeError as e:
        if str(e) == "TOO_MANY_ROOMS":
            raise HTTPException(503, detail={"code": "TOO_MANY_ROOMS", "message": "Досягнуто максимум кімнат"})
        raise
    with _room_creation_lock:
        room_id = _generate_room_id()
        event_store.append(room_id, "GameCreated", GameCreated(
            room_id=room_id,
            num_players=body.num_players,
            game_mode=body.game_mode,
        ).to_payload())
        state = GameState(room_id=room_id, num_players=body.num_players, game_mode=body.game_mode, cards=CARDS_CATALOG)
        state = state.model_copy(deep=True)
        for row in event_store.get_events_for_room(room_id):
            state = apply_event(state, row[1], row[2])
        state.cards = CARDS_CATALOG
        session = GameSession(room_id=room_id, state=state)
        if not mgr.put_if_capacity(room_id, session):
            raise HTTPException(503, detail={"code": "TOO_MANY_ROOMS", "message": "Досягнуто максимум кімнат"})
    logger.info("room_created room_id=%s num_players=%s", room_id, body.num_players)
    return {"room_id": room_id}


@router.post("/rooms/{room_id}/join", summary="Join room")
def join_room(room_id: str, body: JoinRoomRequest):
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    if len(session.state.players) >= session.state.num_players:
        raise HTTPException(409, detail={"code": "ROOM_FULL", "message": "Кімната заповнена"})
    name_normalized = (body.name or "").strip().lower()
    if name_normalized and any((p.name or "").strip().lower() == name_normalized for p in session.state.players):
        raise HTTPException(409, detail={"code": "NAME_TAKEN", "message": "Гравець з таким ім'ям вже в кімнаті"})
    player_id = str(uuid.uuid4())
    player_token = str(uuid.uuid4())
    with mgr._room_lock(room_id):
        session = mgr.get_or_load(room_id)
        if not session:
            raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
        event_store.append(room_id, "PlayerJoined", PlayerJoined(
            player_id=player_id,
            name=body.name,
            player_token=player_token,
        ).to_payload())
        session.apply_event_to_state("PlayerJoined", {
            "player_id": player_id,
            "name": body.name,
            "player_token": player_token,
        })
    view = project_state_for_player(session.state, player_id)
    logger.info("player_joined room_id=%s player_id=%s", room_id[:8], player_id[:8])
    return {
        "room_id": room_id,
        "player_id": player_id,
        "player_token": player_token,
        "state": view,
    }


@router.post("/rooms/{room_id}/start", summary="Start game")
def start_game(room_id: str, x_player_token: str = Header(..., alias="X-Player-Token")):
    """Start the game once num_players have joined. Generates setup events (leaders, deck, hands)."""
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    player_id = _player_id_from_token(session, x_player_token)
    if not player_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})
    if session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
        raise HTTPException(409, detail={"code": "GAME_ALREADY_STARTED", "message": "Гра вже почалась"})
    if len(session.state.players) < 2:
        raise HTTPException(400, detail={"code": "NOT_ENOUGH_PLAYERS", "message": "Потрібно щонайменше 2 гравців для старту"})
    if not session.state.cards:
        raise HTTPException(503, detail={"code": "CARDS_NOT_LOADED", "message": "Каталог карт не завантажено"})

    with mgr._room_lock(room_id):
        session = mgr.get_or_load(room_id)
        if not session or session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
            raise HTTPException(409, detail={"code": "GAME_ALREADY_STARTED", "message": "Гра вже почалась"})
        seed = random.randint(0, 2**31 - 1)
        events = generate_setup_events(session.state, session.state.cards, seed=seed)
        for event_type, payload in events:
            event_store.append(room_id, event_type, payload)
            session.apply_event_to_state(event_type, payload)
    view = project_state_for_player(session.state, player_id)
    logger.info("game_started room_id=%s", room_id[:8])
    return {"state": view}


@router.post("/rooms/{room_id}/add_bot", summary="Add bot (testing)")
def add_bot(room_id: str, x_player_token: str = Header(..., alias="X-Player-Token")):
    """Add a bot player to the room. Only in lobby, only if room not full. For testing."""
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    player_id = _player_id_from_token(session, x_player_token)
    if not player_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})
    if session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
        raise HTTPException(409, detail={"code": "GAME_ALREADY_STARTED", "message": "Бота можна додати лише в лобі"})
    if len(session.state.players) >= session.state.num_players:
        raise HTTPException(409, detail={"code": "ROOM_FULL", "message": "Кімната заповнена"})

    bot_count = sum(1 for p in session.state.players if (p.name or "").strip().startswith("Бот "))
    bot_name = f"Бот {bot_count + 1}"
    bot_player_id = str(uuid.uuid4())
    bot_token = str(uuid.uuid4())

    with mgr._room_lock(room_id):
        session = mgr.get_or_load(room_id)
        if not session or session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
            raise HTTPException(409, detail={"code": "GAME_ALREADY_STARTED", "message": "Бота можна додати лише в лобі"})
        if len(session.state.players) >= session.state.num_players:
            raise HTTPException(409, detail={"code": "ROOM_FULL", "message": "Кімната заповнена"})
        event_store.append(room_id, "PlayerJoined", PlayerJoined(
            player_id=bot_player_id,
            name=bot_name,
            player_token=bot_token,
        ).to_payload())
        session.apply_event_to_state("PlayerJoined", {
            "player_id": bot_player_id,
            "name": bot_name,
            "player_token": bot_token,
        })
    view = project_state_for_player(session.state, player_id)
    logger.info("add_bot room_id=%s bot_id=%s", room_id[:8], bot_player_id[:8])
    return {"state": view}


@router.post("/rooms/{room_id}/rejoin", summary="Rejoin with token")
def rejoin_room(room_id: str, body: RejoinRequest):
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    player_id = _player_id_from_token(session, body.player_token)
    if not player_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})
    view = project_state_for_player(session.state, player_id)
    return {"room_id": room_id, "player_id": player_id, "state": view}


@router.get("/rooms/{room_id}/state", summary="Get game state")
def get_state(room_id: str, x_player_token: str = Header(..., alias="X-Player-Token")):
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    player_id = _player_id_from_token(session, x_player_token)
    if not player_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})
    view = project_state_for_player(session.state, player_id)
    return view


@router.post("/rooms/{room_id}/leave", summary="Leave room (lobby only)")
def leave_room(
    room_id: str,
    x_player_token: str | None = Header(None, alias="X-Player-Token"),
    body: LeaveRequest | None = Body(None),
):
    """Leave the room. Only allowed in lobby (WAITING_FOR_PLAYERS). Token: header X-Player-Token or body.player_token (for sendBeacon on unload)."""
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    token = x_player_token or (body.player_token if body else None)
    if not token:
        raise HTTPException(401, detail={"code": "MISSING_TOKEN", "message": "Потрібен токен гравця (X-Player-Token або body.player_token)"})
    player_id = _player_id_from_token(session, token)
    if not player_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})
    if session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
        raise HTTPException(409, detail={"code": "GAME_STARTED", "message": "Не можна вийти під час гри"})

    with mgr._room_lock(room_id):
        session = mgr.get_or_load(room_id)
        if not session or session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
            raise HTTPException(409, detail={"code": "GAME_STARTED", "message": "Не можна вийти під час гри"})
        if not any(p.player_id == player_id for p in session.state.players):
            return {}
        event_store.append(room_id, "PlayerLeft", PlayerLeft(player_id=player_id).to_payload())
        session.apply_event_to_state("PlayerLeft", {"player_id": player_id})
    logger.info("player_left room_id=%s player_id=%s", room_id[:8], player_id[:8])
    return {}


@router.post("/rooms/{room_id}/kick", summary="Kick a player from the lobby (creator only)")
def kick_player(
    room_id: str,
    x_player_token: str = Header(..., alias="X-Player-Token"),
    body: KickRequest = Body(...),
):
    """Remove a player from the room. Only the room creator can kick. Only in lobby (WAITING_FOR_PLAYERS)."""
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    caller_id = _player_id_from_token(session, x_player_token)
    if not caller_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})
    if session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
        raise HTTPException(409, detail={"code": "GAME_STARTED", "message": "Вилучати гравців можна лише в лобі"})
    if session.state.creator_player_id != caller_id:
        raise HTTPException(403, detail={"code": "NOT_CREATOR", "message": "Лише власник кімнати може вилучати гравців"})
    target_id = body.player_id
    if target_id == caller_id:
        raise HTTPException(400, detail={"code": "CANNOT_KICK_SELF", "message": "Не можна вилучити себе; використовуйте «Вийти»"})
    if not any(p.player_id == target_id for p in session.state.players):
        raise HTTPException(404, detail={"code": "PLAYER_NOT_IN_ROOM", "message": "Гравця не знайдено в кімнаті"})

    with mgr._room_lock(room_id):
        session = mgr.get_or_load(room_id)
        if not session or session.state.current_phase != TurnPhase.WAITING_FOR_PLAYERS:
            raise HTTPException(409, detail={"code": "GAME_STARTED", "message": "Вилучати гравців можна лише в лобі"})
        if not any(p.player_id == target_id for p in session.state.players):
            return {}
        event_store.append(room_id, "PlayerLeft", PlayerLeft(player_id=target_id).to_payload())
        session.apply_event_to_state("PlayerLeft", {"player_id": target_id})
    logger.info("player_kicked room_id=%s target_id=%s by=%s", room_id[:8], target_id[:8], caller_id[:8])
    return {}


@router.post("/rooms/{room_id}/back_to_lobby", summary="Back to lobby after game end")
def back_to_lobby(room_id: str, x_player_token: str = Header(..., alias="X-Player-Token")):
    """Reset room to lobby (same players) so they can start a new game. Only when game has ended."""
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    player_id = _player_id_from_token(session, x_player_token)
    if not player_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})
    if not session.state.game_ended:
        raise HTTPException(409, detail={"code": "GAME_NOT_ENDED", "message": "Гра ще не завершена"})
    with mgr._room_lock(room_id):
        session = mgr.get_or_load(room_id)
        if not session or not session.state.game_ended:
            raise HTTPException(409, detail={"code": "GAME_NOT_ENDED", "message": "Гра ще не завершена"})
        event_store.append(room_id, "BackToLobby", BackToLobby().to_payload())
        session.apply_event_to_state("BackToLobby", {"event_version": 1})
    view = project_state_for_player(session.state, player_id)
    logger.info("back_to_lobby room_id=%s", room_id[:8])
    return {"state": view}


@router.post("/rooms/{room_id}/commands", summary="Send command")
def post_command(
    room_id: str,
    body: CommandRequest,
    x_player_token: str = Header(..., alias="X-Player-Token"),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    mgr = get_session_manager()
    session = mgr.get_or_load(room_id)
    if not session:
        raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
    player_id = _player_id_from_token(session, x_player_token)
    if not player_id:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})

    with mgr._room_lock(room_id):
        session = mgr.get_or_load(room_id)
        if not session:
            raise HTTPException(404, detail={"code": "ROOM_NOT_FOUND", "message": "Кімнату не знайдено"})
        player_id = _player_id_from_token(session, x_player_token)
        if not player_id:
            raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Недійсний або прострочений токен"})

        if idempotency_key and mgr.is_idempotent_command_processed(room_id, player_id, idempotency_key):
            view = project_state_for_player(session.state, player_id)
            return {"state": view}

        play_card_pl = None
        response_extras = {}
        try:
            cmd_name = (body.command or "").strip()
            # EndGame — тестова команда (примусово завершити гру); перевіряємо першим і приймаємо будь-який регістр
            if cmd_name.lower() == "endgame":
                if session.state.game_ended:
                    view = project_state_for_player(session.state, player_id)
                    return {"state": view}
                mgr.force_finish_game(session)
                view = project_state_for_player(session.state, player_id)
                return {"state": view}
            if cmd_name == "PlayCard":
                pl = PlayCardPayload.model_validate(body.payload)
                play_card_pl = pl
                cmd = PlayCardCommand(room_id=room_id, player_id=player_id, card_id=pl.card_id, targets=pl.targets)
                events = handle_play_card(session.state, cmd)
            elif cmd_name == "DiscardCards":
                pl = DiscardCardsPayload.model_validate(body.payload)
                cmd = DiscardCardsCommand(room_id=room_id, player_id=player_id, card_ids=pl.card_ids)
                events = handle_discard_cards(session.state, cmd)
            elif cmd_name == "DrawFromTavern":
                pl = DrawFromTavernPayload.model_validate(body.payload)
                cmd = DrawFromTavernCommand(room_id=room_id, player_id=player_id, slot_index=pl.slot_index)
                events = handle_draw_from_tavern(session.state, cmd)
            elif cmd_name == "DrawFromHarbor":
                DrawFromHarborPayload.model_validate(body.payload)
                cmd = DrawFromHarborCommand(room_id=room_id, player_id=player_id)
                events = handle_draw_from_harbor(session.state, cmd)
            elif cmd_name == "RefillTavern":
                RefillTavernPayload.model_validate(body.payload)
                cmd = RefillTavernCommand(room_id=room_id, player_id=player_id)
                events = handle_refill_tavern(session.state, cmd)
            elif cmd_name == "PassPlay":
                cmd = PassPlayCommand(room_id=room_id, player_id=player_id)
                events = handle_pass_play(session.state, cmd)
            else:
                raise HTTPException(400, detail={"code": "UNKNOWN_COMMAND", "message": f"Невідома команда: {body.command}"})
        except CommandRejected as e:
            raise HTTPException(400, detail={"code": e.code, "message": e.message})
        except ValidationError as e:
            raise HTTPException(422, detail={"code": "INVALID_PAYLOAD", "message": "Невірні дані команди", "errors": e.errors()})

        mgr.persist_and_apply(session, events)
        if idempotency_key:
            mgr.record_idempotent_command(room_id, player_id, idempotency_key)
        logger.info("command room_id=%s player_id=%s command=%s", room_id[:8], player_id[:8], body.command)
        if cmd_name == "PlayCard" and play_card_pl is not None:
            card_data = session.state.cards.get(play_card_pl.card_id, {})
            ability = (card_data.get("ability") or {})
            action = ability.get("action")
            if action == "Reveal_Harbor":
                if not ability.get("condition") or evaluate_condition(
                    ability["condition"], session.state, {"player_id": player_id}
                ):
                    response_extras["reveal_harbor"] = list(session.state.harbor[: ability.get("count", 2)])
            # Perform_Self / Perform: if the performed card had Reveal_Harbor, return harbor in response
            if action in ("Perform_Self", "Perform"):
                targets = play_card_pl.targets or {}
                idx = targets.get("target_hidden_index", 0)
                actor = session.state.get_player(player_id)
                if actor and 0 <= idx < len(actor.hidden_heroes):
                    performed_card_id = actor.hidden_heroes[idx].card_id
                    performed_ability = (session.state.cards.get(performed_card_id) or {}).get("ability") or {}
                    if performed_ability.get("action") == "Reveal_Harbor":
                        if not performed_ability.get("condition") or evaluate_condition(
                            performed_ability["condition"], session.state, {"player_id": player_id}
                        ):
                            response_extras["reveal_harbor"] = list(
                                session.state.harbor[: performed_ability.get("count", 2)]
                            )
            # Bury_Perform: performed card was in tavern; find it from events and add reveal_harbor if needed
            if action == "Bury_Perform":
                slot = (play_card_pl.targets or {}).get("tavern_slot", 0)
                for ev_type, payload in events:
                    if ev_type == "CardMoved" and (payload.get("from_zone") or "").startswith("tavern_"):
                        performed_card_id = payload.get("card_id")
                        if performed_card_id:
                            performed_ability = (session.state.cards.get(performed_card_id) or {}).get("ability") or {}
                            if performed_ability.get("action") == "Reveal_Harbor":
                                if not performed_ability.get("condition") or evaluate_condition(
                                    performed_ability["condition"], session.state, {"player_id": player_id}
                                ):
                                    response_extras["reveal_harbor"] = list(
                                        session.state.harbor[: performed_ability.get("count", 2)]
                                    )
                        break
            # Perform_Top: performed card is top of graveyard (still there after apply)
            if action == "Perform_Top" and session.state.graveyard:
                performed_card_id = session.state.graveyard[-1]
                performed_ability = (session.state.cards.get(performed_card_id) or {}).get("ability") or {}
                if performed_ability.get("action") == "Reveal_Harbor":
                    if not performed_ability.get("condition") or evaluate_condition(
                        performed_ability["condition"], session.state, {"player_id": player_id}
                    ):
                        response_extras["reveal_harbor"] = list(
                            session.state.harbor[: performed_ability.get("count", 2)]
                        )
            if action in ("Look", "Flip_Or_Look"):
                targets = play_card_pl.targets or {}
                tid = targets.get("target_player_id")
                if not tid:
                    # "Look at your party" (e.g. Minor Fishguard): no target_player or target_player !== "other" -> self
                    if ability.get("target_player") != "other":
                        tid = player_id
                    elif len(session.state.players) == 2:
                        for p in session.state.players:
                            if p.player_id != player_id:
                                tid = p.player_id
                                break
                if tid:
                    tp = session.state.get_player(tid)
                    if tp and getattr(tp, "hidden_heroes", None):
                        idx = targets.get("target_hidden_index", 0)
                        if 0 <= idx < len(tp.hidden_heroes):
                            cid = tp.hidden_heroes[idx].card_id
                            response_extras["peek_card"] = session.state.cards.get(cid, {"card_id": cid})
    view = project_state_for_player(session.state, player_id)
    return {"state": view, **response_extras}


# Mount v1 router and CORS
app.include_router(router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
