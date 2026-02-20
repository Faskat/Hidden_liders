"""
Full game flow test: run server then execute this script.
Set PORT=8001 (or BASE_URL=http://127.0.0.1:8001) if server is not on 8000.
Tests: POST /rooms, join x2, start, GET state, full turn (play/draw/discard/refill), rejoin, error cases.
"""
import os
import sys
from pathlib import Path

import requests

PORT = os.environ.get("PORT", "8000")
BASE = os.environ.get("BASE_URL", f"http://127.0.0.1:{PORT}")
API = f"{BASE.rstrip('/')}/v1"
TIMEOUT = 10

def main():
    errors = []
    def ok(name, r):
        if r.status_code >= 400:
            msg = f"{name}: {r.status_code} {r.text[:300]}"
            errors.append(msg)
            print("FAIL", msg)
            return False
        return True

    # --- 1. Create room ---
    r = requests.post(f"{API}/rooms", json={"num_players": 2, "game_mode": "full"}, timeout=TIMEOUT)
    if not ok("POST /rooms", r):
        print("FAIL POST /rooms"); return 1
    room_id = r.json()["room_id"]
    print("OK POST /rooms", room_id[:8] + "...")

    # --- 2. Join two players ---
    r1 = requests.post(f"{API}/rooms/{room_id}/join", json={"name": "Alice"}, timeout=TIMEOUT)
    if not ok("POST /join (Alice)", r1):
        return 1
    j1 = r1.json()
    token1 = j1["player_token"]
    player_id1 = j1["player_id"]
    print("OK POST /join Alice", player_id1[:8] + "...")

    r2 = requests.post(f"{API}/rooms/{room_id}/join", json={"name": "Bob"}, timeout=TIMEOUT)
    if not ok("POST /join (Bob)", r2):
        return 1
    j2 = r2.json()
    token2 = j2["player_token"]
    player_id2 = j2["player_id"]
    print("OK POST /join Bob")

    # --- 3. Start game ---
    r = requests.post(f"{API}/rooms/{room_id}/start", headers={"X-Player-Token": token1}, timeout=TIMEOUT)
    if not ok("POST /start", r):
        return 1
    state = r.json()["state"]
    assert state["current_phase"] == "PLAY"
    assert state["harbor_count"] > 0
    print("OK POST /start phase=PLAY harbor_count=", state["harbor_count"])

    # --- 4. GET state and determine current player (must use that player's token to see their hand) ---
    r = requests.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token1}, timeout=TIMEOUT)
    if not ok("GET /state", r):
        return 1
    state = r.json()
    current_id = state["current_player_id"]
    token = token1 if current_id == player_id1 else token2
    r = requests.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token}, timeout=TIMEOUT)
    if not ok("GET /state (current)", r):
        return 1
    state = r.json()
    me = next(p for p in state["players"] if p["player_id"] == current_id)
    hand = me["hand_card_ids"]
    assert len(hand) == 3, f"expected 3 cards got {len(hand)}"
    print("OK GET /state hand_count=3 current_player=", "Alice" if current_id == player_id1 else "Bob")

    # --- 5. Full turn: Play card (as current player) ---
    card_id = hand[0]
    r = requests.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "PlayCard", "payload": {"card_id": card_id}},
        timeout=TIMEOUT,
    )
    if not ok("POST PlayCard", r):
        return 1
    state = r.json()["state"]
    assert state["current_phase"] == "DRAW"
    print("OK PlayCard -> phase=DRAW")

    # --- 6. Draw to 4 (as same current player - use same token) ---
    for _ in range(4):
        state = requests.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token}, timeout=TIMEOUT).json()
        if state["current_phase"] != "DRAW":
            break
        me = next((p for p in state["players"] if p["player_id"] == current_id), None)
        my_hand = me["hand_card_ids"] if me else []
        if len(my_hand) >= 4:
            break
        if state["harbor_count"] > 0:
            r = requests.post(
                f"{API}/rooms/{room_id}/commands",
                headers={"X-Player-Token": token},
                json={"command": "DrawFromHarbor", "payload": {}},
                timeout=TIMEOUT,
            )
        else:
            tavern = state["tavern"]
            slot = next((i for i, s in enumerate(tavern) if s is not None), None)
            if slot is None:
                break
            r = requests.post(
                f"{API}/rooms/{room_id}/commands",
                headers={"X-Player-Token": token},
                json={"command": "DrawFromTavern", "payload": {"slot_index": slot}},
                timeout=TIMEOUT,
            )
        if not ok("POST Draw", r):
            return 1
    state = requests.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token}, timeout=TIMEOUT).json()
    my_hand = next(p["hand_card_ids"] for p in state["players"] if p["player_id"] == current_id)
    assert len(my_hand) == 4, f"expected 4 cards got {len(my_hand)}"
    assert state["current_phase"] == "DISCARD"
    print("OK Draw to 4 -> phase=DISCARD")

    # --- 7. Discard to 3 ---
    state = requests.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token}, timeout=TIMEOUT).json()
    my_hand = next(p["hand_card_ids"] for p in state["players"] if p["player_id"] == current_id)
    discard_ids = my_hand[:1]
    r = requests.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "DiscardCards", "payload": {"card_ids": discard_ids}},
        timeout=TIMEOUT,
    )
    if not ok("POST DiscardCards", r):
        return 1
    state = r.json()["state"]
    assert state["current_phase"] == "REFILL_TAVERN"
    print("OK Discard to 3 -> phase=REFILL_TAVERN")

    # --- 8. Refill tavern ---
    r = requests.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "RefillTavern", "payload": {}},
        timeout=TIMEOUT,
    )
    if not ok("POST RefillTavern", r):
        return 1
    state = r.json()["state"]
    assert state["current_phase"] == "PLAY"
    next_id = state["current_player_id"]
    assert next_id != current_id
    print("OK RefillTavern -> phase=PLAY, next player=", "Alice" if next_id == player_id1 else "Bob")

    # --- 9. Rejoin (player 1) ---
    r = requests.post(
        f"{API}/rooms/{room_id}/rejoin",
        json={"player_token": token1},
        timeout=TIMEOUT,
    )
    if not ok("POST /rejoin", r):
        return 1
    assert "state" in r.json()
    print("OK POST /rejoin")

    # --- 10. Error cases ---
    r = requests.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": "invalid-token"}, timeout=TIMEOUT)
    if r.status_code != 401:
        errors.append(f"Expected 401 for invalid token, got {r.status_code}")
    else:
        print("OK GET /state invalid token -> 401")

    r = requests.get(f"{API}/rooms/00000000-0000-0000-0000-000000000000/state", headers={"X-Player-Token": token1}, timeout=TIMEOUT)
    if r.status_code != 404:
        errors.append(f"Expected 404 for unknown room, got {r.status_code}")
    else:
        print("OK GET /state unknown room -> 404")

    # --- Summary ---
    if errors:
        print("\nFAILURES:")
        for e in errors:
            print(" ", e)
        return 1
    print("\nAll flow tests passed.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
