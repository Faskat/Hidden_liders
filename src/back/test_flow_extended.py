"""
Extended flow: 4 players, multiple full rounds (each player: play -> draw -> discard -> refill).
Set PORT=8000 or BASE_URL=... to match server. NUM_ROUNDS=3 (default) = 12 full turns.
"""
import os
import sys

import requests

PORT = os.environ.get("PORT", "8000")
BASE = os.environ.get("BASE_URL", f"http://127.0.0.1:{PORT}")
API = f"{BASE.rstrip('/')}/v1"
TIMEOUT = 15
NUM_PLAYERS = 4
NAMES = ["Alice", "Bob", "Carol", "Dave"]
NUM_ROUNDS = int(os.environ.get("NUM_ROUNDS", "3"))


def ok(name, r, errors):
    if r.status_code >= 400:
        msg = f"{name}: {r.status_code} {r.text[:200]}"
        errors.append(msg)
        print("FAIL", msg)
        return False
    return True


def get_state(room_id, token):
    r = requests.get(f"{API}/rooms/{room_id}/state", headers={"X-Player-Token": token}, timeout=TIMEOUT)
    return r.json() if r.status_code == 200 else None


def do_full_turn(room_id, current_id, token, player_tokens, errors):
    """Execute one full turn for current_id: play card -> draw to 4 -> discard to 3 -> refill."""
    state = get_state(room_id, token)
    if not state or state.get("game_ended"):
        return False
    if state["current_player_id"] != current_id:
        return True
    if state["current_phase"] != "PLAY":
        return True

    me = next((p for p in state["players"] if p["player_id"] == current_id), None)
    if not me:
        return True
    hand = me["hand_card_ids"]

    # Play one card
    if not hand:
        errors.append("Current player has no cards in hand")
        return False
    card_id = hand[0]
    r = requests.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "PlayCard", "payload": {"card_id": card_id}},
        timeout=TIMEOUT,
    )
    if not ok("PlayCard", r, errors):
        return False

    state = get_state(room_id, token)
    if state.get("game_ended"):
        return False

    # Draw to 4
    for _ in range(5):
        state = get_state(room_id, token)
        if not state or state.get("game_ended"):
            return False
        if state["current_phase"] != "DRAW":
            break
        me = next((p for p in state["players"] if p["player_id"] == current_id), None)
        if me and len(me["hand_card_ids"]) >= 4:
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
        if not ok("Draw", r, errors):
            return False

    # Discard to 3
    state = get_state(room_id, token)
    if not state or state.get("game_ended"):
        return False
    if state["current_phase"] != "DISCARD":
        return True
    me = next(p for p in state["players"] if p["player_id"] == current_id)
    my_hand = me["hand_card_ids"]
    to_discard = my_hand[: len(my_hand) - 3] if len(my_hand) > 3 else []
    if to_discard:
        r = requests.post(
            f"{API}/rooms/{room_id}/commands",
            headers={"X-Player-Token": token},
            json={"command": "DiscardCards", "payload": {"card_ids": to_discard}},
            timeout=TIMEOUT,
        )
        if not ok("DiscardCards", r, errors):
            return False

    # Refill tavern
    state = get_state(room_id, token)
    if not state or state.get("game_ended"):
        return False
    if state["current_phase"] != "REFILL_TAVERN":
        return True
    r = requests.post(
        f"{API}/rooms/{room_id}/commands",
        headers={"X-Player-Token": token},
        json={"command": "RefillTavern", "payload": {}},
        timeout=TIMEOUT,
    )
    if not ok("RefillTavern", r, errors):
        return False
    return True


def main():
    errors = []
    print(f"Extended flow: {NUM_PLAYERS} players, {NUM_ROUNDS} rounds (base={BASE})")
    print("---")

    # Create room
    r = requests.post(
        f"{API}/rooms",
        json={"num_players": NUM_PLAYERS, "game_mode": "full"},
        timeout=TIMEOUT,
    )
    if not ok("POST /rooms", r, errors):
        return 1
    room_id = r.json()["room_id"]
    print("OK POST /rooms", room_id[:8] + "...")

    # Join all players
    players = []
    for name in NAMES:
        r = requests.post(f"{API}/rooms/{room_id}/join", json={"name": name}, timeout=TIMEOUT)
        if not ok(f"POST /join ({name})", r, errors):
            return 1
        j = r.json()
        players.append({"name": name, "player_id": j["player_id"], "token": j["player_token"]})
    print("OK POST /join x", NUM_PLAYERS)

    # Start
    r = requests.post(
        f"{API}/rooms/{room_id}/start",
        headers={"X-Player-Token": players[0]["token"]},
        timeout=TIMEOUT,
    )
    if not ok("POST /start", r, errors):
        return 1
    state = r.json()["state"]
    assert state["current_phase"] == "PLAY"
    print("OK POST /start phase=PLAY harbor_count=", state["harbor_count"])

    pid_to_token = {p["player_id"]: p["token"] for p in players}
    turn_count = 0
    round_count = 0

    while round_count < NUM_ROUNDS:
        state = get_state(room_id, players[0]["token"])
        if not state:
            errors.append("GET /state failed")
            break
        if state.get("game_ended"):
            print("Game ended after", turn_count, "turns")
            break
        current_id = state["current_player_id"]
        token = pid_to_token.get(current_id)
        if not token:
            errors.append("Unknown current_player_id")
            break
        name = next(p["name"] for p in players if p["player_id"] == current_id)
        if not do_full_turn(room_id, current_id, token, pid_to_token, errors):
            break
        turn_count += 1
        # One round = each player played once
        if current_id == players[-1]["player_id"]:
            round_count += 1
            print("  round", round_count, "done (turns so far:", turn_count, ")")
    if errors:
        print("\nFAILURES:")
        for e in errors:
            print(" ", e)
        return 1
    state = get_state(room_id, players[0]["token"])
    print("---")
    print("OK Extended flow: ", turn_count, "turns,", round_count, "rounds, game_ended=", state.get("game_ended", False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
