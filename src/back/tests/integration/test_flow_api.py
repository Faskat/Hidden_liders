"""
Integration tests: full flow using TestClient (no manual server).
Requires data/cards.json when running flow tests. Run from src/back: python -m pytest tests/integration -v
Uses "with TestClient(app)" so lifespan runs (session manager + cards loaded).
"""
import sys
from pathlib import Path

import pytest

_back = Path(__file__).resolve().parent.parent.parent
if str(_back) not in sys.path:
    sys.path.insert(0, str(_back))

from fastapi.testclient import TestClient

from app import app

API = "/v1"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ready_after_startup(client):
    r = client.get("/ready")
    if r.status_code == 503:
        detail = r.json().get("detail", {})
        if detail.get("code") in ("CARDS_NOT_LOADED", "NOT_READY"):
            pytest.skip("backend not ready (cards or session manager); run from src/back with data/cards.json")
    assert r.status_code == 200
    assert r.json() == {"status": "ready"}


def _ready(client):
    r = client.get("/ready")
    return r.status_code == 200


def _create_room(client):
    r = client.post(f"{API}/rooms", json={"num_players": 2, "game_mode": "full"})
    assert r.status_code == 200
    return r.json()["room_id"]


def test_create_room(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id = _create_room(client)
    # Backend uses 4-digit room code, not UUID
    assert room_id and len(room_id) == 4 and room_id.isdigit()


def test_join_and_start_and_one_turn(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id = _create_room(client)
    r1 = client.post(f"{API}/rooms/{room_id}/join", json={"name": "Alice"})
    assert r1.status_code == 200
    j1 = r1.json()
    token1 = j1["player_token"]
    player_id1 = j1["player_id"]

    r2 = client.post(f"{API}/rooms/{room_id}/join", json={"name": "Bob"})
    assert r2.status_code == 200
    j2 = r2.json()
    token2 = j2["player_token"]
    player_id2 = j2["player_id"]

    r = client.post(f"{API}/rooms/{room_id}/start", headers={"X-Player-Token": token1})
    assert r.status_code == 200
    state = r.json()["state"]
    assert state["current_phase"] == "PLAY"
    assert state["harbor_count"] > 0

    # Get state with current player's token so we see their hand_card_ids (projection hides other players' hands)
    r = client.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token1})
    assert r.status_code == 200
    state = r.json()
    current_id = state["current_player_id"]
    token = token1 if current_id == player_id1 else token2
    r = client.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token})
    assert r.status_code == 200
    state = r.json()
    me = next(p for p in state["players"] if p["player_id"] == current_id)
    hand = me["hand_card_ids"]
    assert len(hand) == 3

    card_id = hand[0]
    r = client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "PlayCard", "payload": {"card_id": card_id}},
    )
    assert r.status_code == 200
    assert r.json()["state"]["current_phase"] == "DRAW"


def test_idempotency_duplicate_ignored(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id = _create_room(client)
    j1 = client.post(f"{API}/rooms/{room_id}/join", json={"name": "A"}).json()
    client.post(f"{API}/rooms/{room_id}/join", json={"name": "B"})
    client.post(f"{API}/rooms/{room_id}/start", headers={"X-Player-Token": j1["player_token"]})
    r = client.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": j1["player_token"]})
    assert r.status_code == 200
    state = r.json()
    current_id = state["current_player_id"]
    token = j1["player_token"] if current_id == j1["player_id"] else None
    if not token:
        pytest.skip("need current player to be first joiner")
    me = next(p for p in state["players"] if p["player_id"] == current_id)
    card_id = me["hand_card_ids"][0]
    key = "idem-test-key-1"
    r1 = client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token, "Idempotency-Key": key},
        json={"command": "PlayCard", "payload": {"card_id": card_id}},
    )
    assert r1.status_code == 200
    hand_after_first = next(p["hand_card_ids"] for p in r1.json()["state"]["players"] if p["player_id"] == current_id)
    r2 = client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token, "Idempotency-Key": key},
        json={"command": "PlayCard", "payload": {"card_id": card_id}},
    )
    assert r2.status_code == 200
    hand_after_second = next(p["hand_card_ids"] for p in r2.json()["state"]["players"] if p["player_id"] == current_id)
    assert hand_after_second == hand_after_first, "duplicate command should not change state"


def test_invalid_command_payload_422(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id = _create_room(client)
    j1 = client.post(f"{API}/rooms/{room_id}/join", json={"name": "A"}).json()
    client.post(f"{API}/rooms/{room_id}/join", json={"name": "B"})
    client.post(f"{API}/rooms/{room_id}/start", headers={"X-Player-Token": j1["player_token"]})
    r = client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": j1["player_token"]},
        json={"command": "PlayCard", "payload": {}},
    )
    assert r.status_code == 422
    detail = r.json().get("detail", {})
    assert detail.get("code") == "INVALID_PAYLOAD" or "errors" in detail


def test_unknown_room_404(client):
    r = client.get(
        f"{API}/rooms/00000000-0000-0000-0000-000000000000/state",
        headers={"X-Player-Token": "any"},
    )
    assert r.status_code == 404, r.text


def test_invalid_token_401(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id = _create_room(client)
    r = client.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": "invalid-token"})
    assert r.status_code == 401
