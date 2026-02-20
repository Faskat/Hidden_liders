# Legacy CLI game

This folder contains the original console (CLI) implementation of Hidden Leaders:

- **entities.py** — `Player`, `Card`, leaders, faction card classes
- **game.py** — `Game` with zones (deck, tavern, discard, graveyard) and turn logic
- **main.py** — Interactive 2-player game (human vs bot) with Russian UI

It is **not** used by the FastAPI event-sourcing backend. The main API lives in `../app.py` and uses `domain/`, `session.py`, `event_store.py`, etc.

To run the legacy CLI game from this folder:

```bash
cd legacy
python main.py
```

Or from the backend root:

```bash
python -m legacy.main
```

(Ensure the parent directory is on `PYTHONPATH` or run from `src/back`.)
