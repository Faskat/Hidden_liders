"""
Стрічка подій через HTTP: курсор, редакція під глядача, каскад кінця гри.

Форма скопійована з test_flow_api.py — той самий модульний TestClient (щоб
відпрацював lifespan) і та сама заглушка `_ready`, бо тести ходять у справжній
data/cards.json.
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


def _ready(client):
    return client.get("/ready").status_code == 200


def _started_room(client):
    """Кімната на двох із роздачею; повертає (room_id, token1, pid1, token2, pid2)."""
    room_id = client.post(f"{API}/rooms", json={"num_players": 2, "game_mode": "full"}).json()["room_id"]
    j1 = client.post(f"{API}/rooms/{room_id}/join", json={"name": "Alice"}).json()
    j2 = client.post(f"{API}/rooms/{room_id}/join", json={"name": "Bob"}).json()
    r = client.post(f"{API}/rooms/{room_id}/start", headers={"X-Player-Token": j1["player_token"]})
    assert r.status_code == 200
    return room_id, j1["player_token"], j1["player_id"], j2["player_token"], j2["player_id"]


def _state(client, room_id, token, since=None):
    params = {} if since is None else {"since": since}
    r = client.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token}, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_initial_load_gives_cursor_but_no_history(client):
    """Без `since` стрічка порожня: заходячи в кімнату, не програємо всю партію заново."""
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id, token1, *_ = _started_room(client)
    view = _state(client, room_id, token1)
    assert view["events"] == []
    assert view["event_cursor"] > 0
    assert view["events_truncated"] is False


def test_since_zero_replays_setup(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id, token1, *_ = _started_room(client)
    view = _state(client, room_id, token1, since=0)
    types = [e["event_type"] for e in view["events"]]
    assert "GameCreated" in types
    assert "TavernFilled" in types
    assert "StartingHandSet" in types
    seqs = [e["seq"] for e in view["events"]]
    assert seqs == sorted(seqs), "події мають приходити за порядком sequence"
    assert seqs[-1] == view["event_cursor"]


def test_start_returns_the_setup_batch_itself(client):
    """
    Відповідь на «Почати» несе саму роздачу, а не лише стан.

    Інакше той, хто натиснув кнопку, побачив би сцену роздачі аж із наступним
    опитуванням — тобто через кілька секунд після того, як стіл уже заповнився.
    """
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id = client.post(f"{API}/rooms", json={"num_players": 2, "game_mode": "full"}).json()["room_id"]
    j1 = client.post(f"{API}/rooms/{room_id}/join", json={"name": "Alice"}).json()
    client.post(f"{API}/rooms/{room_id}/join", json={"name": "Bob"})

    view = client.post(
        f"{API}/rooms/{room_id}/start", headers={"X-Player-Token": j1["player_token"]}
    ).json()["state"]

    types = [e["event_type"] for e in view["events"]]
    assert "TavernFilled" in types
    assert "HeroDrawn" in types
    assert "StartingHandSet" in types
    # Події лобі (GameCreated, PlayerJoined) сюди не потрапляють: курсор
    # знімається перед генерацією, тож приїжджає рівно розклад.
    assert "PlayerJoined" not in types
    assert view["events"][-1]["seq"] == view["event_cursor"]
    # А з цього курсора вже порожньо — сцену не програють двічі.
    assert _state(client, room_id, j1["player_token"], since=view["event_cursor"])["events"] == []


def test_no_tokens_or_seed_anywhere_in_the_feed(client):
    """Найдорожчий клас витоку: токен сесії і seed генератора."""
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id, token1, _, token2, _ = _started_room(client)
    for token in (token1, token2):
        for event in _state(client, room_id, token, since=0)["events"]:
            assert "player_token" not in event, event
            assert "seed" not in event, event
            assert "harbor_card_ids" not in event, event


def test_leader_and_hand_redacted_for_the_other_player(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id, token1, pid1, token2, pid2 = _started_room(client)
    mine = _state(client, room_id, token1, since=0)["events"]
    theirs = _state(client, room_id, token2, since=0)["events"]

    def leader_of(events, player_id):
        return next(e for e in events if e["event_type"] == "LeaderDealt" and e["player_id"] == player_id)

    assert "leader_card_id" in leader_of(mine, pid1), "власний лідер має бути видний"
    assert "leader_card_id" not in leader_of(theirs, pid1), "чужий лідер — ні"

    def hand_of(events, player_id):
        return next(e for e in events if e["event_type"] == "StartingHandSet" and e["player_id"] == player_id)

    assert "hand_card_ids" in hand_of(mine, pid1)
    other_view = hand_of(theirs, pid1)
    assert "hand_card_ids" not in other_view
    assert other_view["count"] == 3


def test_cursor_advances_and_command_returns_its_own_events(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id, token1, pid1, token2, pid2 = _started_room(client)
    before = _state(client, room_id, token1)
    cursor = before["event_cursor"]
    current_id = before["current_player_id"]
    token = token1 if current_id == pid1 else token2

    me = next(p for p in _state(client, room_id, token)["players"] if p["player_id"] == current_id)
    card_id = me["hand_card_ids"][0]
    r = client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "PlayCard", "payload": {"card_id": card_id}},
        params={"since": cursor},
    )
    assert r.status_code == 200, r.text
    state = r.json()["state"]
    assert state["event_cursor"] > cursor, "курсор має посунутись"
    types = [e["event_type"] for e in state["events"]]
    assert "CardPlayed" in types
    assert "TurnPhaseChanged" in types

    # Повторне опитування з нового курсора — порожньо: подій двічі не буває.
    assert _state(client, room_id, token, since=state["event_cursor"])["events"] == []


def test_harbor_draw_hidden_from_the_other_player(client):
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id, token1, pid1, token2, pid2 = _started_room(client)
    before = _state(client, room_id, token1)
    cursor = before["event_cursor"]
    current_id = before["current_player_id"]
    token = token1 if current_id == pid1 else token2
    other = token2 if current_id == pid1 else token1

    me = next(p for p in _state(client, room_id, token)["players"] if p["player_id"] == current_id)
    client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "PlayCard", "payload": {"card_id": me["hand_card_ids"][0]}},
    )
    r = client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "DrawFromHarbor", "payload": {}},
    )
    if r.status_code != 200:
        pytest.skip(f"здібність зіграної карти не пустила у фазу добору: {r.text}")

    def harbor_draws(view_token):
        return [
            e for e in _state(client, room_id, view_token, since=cursor)["events"]
            if e["event_type"] == "CardDrawn" and e.get("source") == "harbor"
        ]

    mine = harbor_draws(token)
    assert mine and "card_id" in mine[-1], "власний добір із гавані має бути видний"
    theirs = harbor_draws(other)
    assert theirs and "card_id" not in theirs[-1], "чужий добір із гавані — сліпий"


def test_endgame_cascade_reaches_the_feed(client):
    """
    Каскад кінця гри дописується всередині persist_and_apply і в списку подій,
    що повертає хендлер, його немає. Курсор його бачить — це й перевіряємо.
    """
    if not _ready(client):
        pytest.skip("backend not ready (cards not loaded)")
    room_id, token1, pid1, token2, pid2 = _started_room(client)
    cursor = _state(client, room_id, token1)["event_cursor"]
    r = client.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token1},
        json={"command": "EndGame", "payload": {}},
        params={"since": cursor},
    )
    assert r.status_code == 200, r.text
    types = [e["event_type"] for e in r.json()["state"]["events"]]
    assert "GameEndTriggered" in types
    assert "LeaderRevealed" in types
    assert "WinnerDetermined" in types
