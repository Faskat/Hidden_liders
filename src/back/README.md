# Hidden Leaders — Backend

Event-sourcing backend: FastAPI, in-memory game sessions, SQLite (or Postgres) event store.

## Configuration

Copy `.env.example` to `.env` and adjust. Env vars (all optional):

- **DATABASE_URL**: Default `sqlite:///./data/events.db`. Use e.g. `postgresql://user:pass@localhost/hidden_leaders` for Postgres.
- **LOG_LEVEL**: `DEBUG`, `INFO`, `WARNING`, `ERROR`. Default `INFO`.
- **PORT**: Port for the server. Default `8000`.
- **CORS_ORIGINS**: Comma-separated list of allowed origins, or `*` (default). Example: `https://myapp.com,https://www.myapp.com`.
- **Cards data**: `data/cards.json` must exist (leaders + heroes). Loaded at startup; if missing, `/ready` and game start return 503 until the file is added.

## Run

From this directory (`src/back`):

```bash
pip install -r requirements.txt
python run.py
```

Or with uvicorn directly:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

- API docs: http://localhost:8000/docs
- **GET /health** — liveness (process alive).
- **GET /ready** — readiness (DB + cards loaded).
- All game endpoints are under **/v1** (e.g. `POST /v1/rooms`).

## Flow (rules-aligned)

1. **POST /v1/rooms** — create room (num_players 2–6, game_mode full/basic).
2. **POST /v1/rooms/{room_id}/join** — join with name; response includes `player_token` and `player_id`. Store token for later requests.
3. **POST /v1/rooms/{room_id}/start** — once N players have joined, any player sends this (with header `X-Player-Token: <token>`). Setup: leaders dealt, markers placed, 72-card harbor shuffled, Deceased Emperor in graveyard, 3 in tavern, each player gets 5 → 1 face-down, 1 to wilderness, 3 in hand.
4. **GET /v1/rooms/{room_id}/state** — projected state (header `X-Player-Token`).
5. **POST /v1/rooms/{room_id}/commands** — body `{ "command": "PlayCard"|"DiscardCards"|"DrawFromTavern"|"DrawFromHarbor"|"RefillTavern", "payload": {...} }` with `X-Player-Token`. Payloads are validated (e.g. PlayCard requires `card_id`, DrawFromTavern `slot_index` 0–2). Optional header **Idempotency-Key** (e.g. UUID): if the same key was already used for this room+player, the server returns 200 with current state without re-applying the command.

Turn phases: PLAY → (play 1 or discard up to 3) → DRAW (to 4 cards) → DISCARD (to 3) → REFILL_TAVERN → next player. If Harbor is empty when drawing, Wilderness is shuffled into Harbor (DeckShuffled) per rules.

Game end: when any player reaches the face-up hero limit (by table), winning faction is resolved (Undead > Water > Empire > Tribes), then tie-break (most heroes of winning faction, fewer total heroes, higher leader number).

## Tests

From `src/back`:

```bash
pip install -r requirements.txt
python -m pytest tests -v
```

Unit tests cover: game end (winning faction order, hero limit, tie-break), event reducer (all event types), projection (no leak of hidden info), command handlers (validation and rejection).

**Integration tests** (no server needed; use TestClient):

```bash
python -m pytest tests/integration -v
```

**Full game flow** (run server first, e.g. `python run.py`):

```bash
pip install requests
python test_flow.py
```

Uses `BASE_URL` and `PORT` env (default `http://127.0.0.1:8000`); calls go to `/v1/...`. Runs: create room, join 2 players, start, full turn, rejoin, and error cases (401, 404).

## Future

- **Abilities**: Events `HeroRevealed` and `HeroKilled` exist; command handlers for abilities (reveal/kill) are not implemented yet. Currently only marker-moving effects are applied.
