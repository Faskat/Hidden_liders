"""Focused repro: replay seed's game turn by turn, print every play_card call
(card, ability, targets) and the resulting event list, stop at first duplicate."""
import sys
sys.path.insert(0, ".")
import random
from domain.state import GameState, TurnPhase
from domain.reducer import apply_event
from domain.exceptions import CommandRejected
from domain.events import PlayerJoined
from setup import load_cards_catalog, generate_setup_events
from command_handlers import (
    handle_play_card, handle_discard_cards, handle_draw_from_tavern,
    handle_draw_from_harbor, handle_refill_tavern,
)
from domain.commands import (
    PlayCardCommand, DiscardCardsCommand, DrawFromTavernCommand,
    DrawFromHarborCommand, RefillTavernCommand,
)
from _selfplay_sim import random_targets, choose_slot_with_card, check_invariants, apply_all, bugs

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 49
MAX_TURNS = int(sys.argv[2]) if len(sys.argv) > 2 else 20

cards_catalog = load_cards_catalog()
rng = random.Random(SEED)
state = GameState(room_id=f"dbg{SEED}", num_players=2, game_mode="full", cards=cards_catalog)
for pid, name in [("p1", "Alice"), ("p2", "Bob")]:
    state = apply_event(state, "PlayerJoined", PlayerJoined(player_id=pid, name=name, player_token=pid + "_tok").to_payload())
state.cards = cards_catalog
for et, payload in generate_setup_events(state, cards_catalog, seed=SEED):
    state = apply_event(state, et, payload)
state.current_phase = TurnPhase.PLAY
state.cards = cards_catalog

turn = 0
while turn < MAX_TURNS and not state.game_ended:
    turn += 1
    cur = state.players[state.current_player_index]
    opp = state.players[1 - state.current_player_index]
    if state.current_phase == TurnPhase.PLAY:
        if not cur.hand_card_ids:
            print("empty hand, stop"); break
        hand_order = list(cur.hand_card_ids)
        rng.shuffle(hand_order)
        played = False
        for card_id in hand_order:
            card = cards_catalog.get(card_id, {})
            ability = card.get("ability")
            targets = random_targets(ability, state, cur, opp, cards_catalog, rng)
            cmd = PlayCardCommand(room_id=state.room_id, player_id=cur.player_id, card_id=card_id, targets=targets)
            try:
                events = handle_play_card(state, cmd)
            except CommandRejected as e:
                continue
            print(f"\n--- turn {turn}: {cur.name} plays {card.get('name')} ({card_id}) action={ability.get('action') if ability else None} target_player={ability.get('target_player') if ability else None} targets={targets}")
            print(f"    before: {cur.name}.hand={cur.hand_card_ids} open={[r.card_id for r in cur.open_heroes]} hidden={[r.card_id for r in cur.hidden_heroes]}")
            print(f"    before: {opp.name}.hand={opp.hand_card_ids} open={[r.card_id for r in opp.open_heroes]} hidden={[r.card_id for r in opp.hidden_heroes]}")
            print(f"    events: {events}")
            state = apply_all(state, events)
            state.cards = cards_catalog
            cur2 = state.get_player(cur.player_id)
            opp2 = state.get_player(opp.player_id)
            print(f"    after:  {cur2.name}.hand={cur2.hand_card_ids} open={[r.card_id for r in cur2.open_heroes]} hidden={[r.card_id for r in cur2.hidden_heroes]}")
            print(f"    after:  {opp2.name}.hand={opp2.hand_card_ids} open={[r.card_id for r in opp2.open_heroes]} hidden={[r.card_id for r in opp2.hidden_heroes]}")
            before_bugs = len(bugs)
            check_invariants(state, SEED, turn, 72)
            if len(bugs) > before_bugs:
                print("!!! INVARIANT VIOLATION DETECTED ABOVE - stopping !!!")
                sys.exit(1)
            played = True
            break
        if not played:
            print("no playable card"); break
    if state.current_phase == TurnPhase.DRAW:
        cur = state.get_player(cur.player_id)
        if state.harbor:
            events = handle_draw_from_harbor(state, DrawFromHarborCommand(room_id=state.room_id, player_id=cur.player_id))
        else:
            slot = choose_slot_with_card(state.tavern, rng)
            if slot is None:
                print("deck exhausted"); break
            events = handle_draw_from_tavern(state, DrawFromTavernCommand(room_id=state.room_id, player_id=cur.player_id, slot_index=slot))
        state = apply_all(state, events)
        state.cards = cards_catalog
    if state.current_phase == TurnPhase.DISCARD:
        cur = state.get_player(cur.player_id)
        n = len(cur.hand_card_ids) - 3
        if n > 0:
            to_discard = rng.sample(cur.hand_card_ids, n)
            events = handle_discard_cards(state, DiscardCardsCommand(room_id=state.room_id, player_id=cur.player_id, card_ids=to_discard))
            state = apply_all(state, events)
            state.cards = cards_catalog
    if state.current_phase == TurnPhase.REFILL_TAVERN:
        events = handle_refill_tavern(state, RefillTavernCommand(room_id=state.room_id, player_id=cur.player_id))
        state = apply_all(state, events)
        state.cards = cards_catalog

print("done, no bug found in range" if turn >= MAX_TURNS else "")
