"""
Command handlers: validate command against state, return list of (event_type, payload).
"""
import random

from domain.state import GameState, TurnPhase
from domain.constants import HAND_SIZE, HAND_SIZE_AFTER_DRAW
from domain.exceptions import CommandRejected
from domain.commands import (
    PlayCardCommand,
    PassPlayCommand,
    DiscardCardsCommand,
    DrawFromTavernCommand,
    DrawFromHarborCommand,
    RefillTavernCommand,
)
from domain.events import (
    CardPlayed,
    CardsDiscarded,
    DeckShuffled,
    MarkerMoved,
    CardDrawn,
    TavernRefilled,
    TurnPhaseChanged,
)
from domain.marker_resolver import resolve_markers
from domain.conditions import evaluate_condition
from domain import abilities as abilities_module


def _current_player_id(state: GameState) -> str:
    if not state.players or state.current_player_index >= len(state.players):
        return ""
    return state.players[state.current_player_index].player_id


def _phase_after_draw(
    state: GameState,
    hand_after: int,
    *,
    tavern_slot_taken: int | None = None,
    harbor_taken: int = 0,
    harbor_size: int | None = None,
) -> str:
    """
    Крок 2 ходу за правилами: «добирайте з таверни та/або гавані, доки в руці не
    стане 4 карти». Тобто добір триває, поки рука не наповниться, а не рівно одну
    карту за хід.

    Доти фаза добору закінчувалась після першої ж карти. У звичайному ході це
    непомітно (зіграв одну — узяв одну — знову три), але скидання ламалося
    повністю: скинувши три карти, гравець добирав одну й лишався з рукою в одну
    карту замість трьох. Заразом зникав і сам вибір із правил — узяти дві карти
    й лишити кращу.

    Другий вихід із фази — коли добирати нізвідки. Правила такого не описують
    (карт на всіх вистачає), але зациклити хід на порожньому столі не можна.
    """
    if hand_after >= HAND_SIZE_AFTER_DRAW:
        return TurnPhase.DISCARD.value if hand_after > HAND_SIZE else TurnPhase.REFILL_TAVERN.value

    tavern_left = any(
        cid for i, cid in enumerate(state.tavern) if cid and i != tavern_slot_taken
    )
    # `harbor_size` задають, коли гавань щойно перетасувалася з пустоші: у
    # `state` вона ще порожня, а пустош — навпаки, ще повна.
    if harbor_size is None:
        harbor_size = len(state.harbor)
        wilderness_left = len(state.wilderness) > 0
    else:
        wilderness_left = False
    if tavern_left or harbor_size - harbor_taken > 0 or wilderness_left:
        return TurnPhase.DRAW.value
    return TurnPhase.DISCARD.value if hand_after > HAND_SIZE else TurnPhase.REFILL_TAVERN.value


def handle_play_card(state: GameState, cmd: PlayCardCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.PLAY:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза гри (PLAY)")
    player = state.get_player(cmd.player_id)
    if not player or cmd.card_id not in player.hand_card_ids:
        raise CommandRejected("CARD_NOT_IN_HAND", "Карти немає на руці")
    card = state.cards.get(cmd.card_id, {})
    ability = card.get("ability")

    # For cards with condition: evaluate first; if false, no markers and no ability
    condition_met = True
    if ability and ability.get("condition"):
        condition_met = evaluate_condition(
            ability["condition"], state, {"player_id": cmd.player_id, **(cmd.targets or {})}
        )

    # Resolve marker deltas (new format: markers + logic; old format: red_delta/green_delta)
    # Also: for Calculation with target_* x_source and 2 players, fill target_player_id
    targets = dict(cmd.targets or {})
    # Normalize camelCase from API (e.g. targetPlayerId -> target_player_id, markerChoiceSide -> marker_choice_side)
    if not targets.get("target_player_id") and targets.get("targetPlayerId"):
        targets["target_player_id"] = targets["targetPlayerId"]
    if targets.get("markerChoiceSide") is not None and targets.get("marker_choice_side") is None:
        targets["marker_choice_side"] = targets["markerChoiceSide"]
    if targets.get("markerChoice") is not None and targets.get("marker_choice") is None:
        targets["marker_choice"] = targets["markerChoice"]
    if targets.get("targetHiddenIndex") is not None and targets.get("target_hidden_index") is None:
        targets["target_hidden_index"] = targets["targetHiddenIndex"]
    if targets.get("targetCardId") is not None and targets.get("target_card_id") is None:
        targets["target_card_id"] = targets["targetCardId"]
    if targets.get("performTargetCardId") is not None and targets.get("perform_target_card_id") is None:
        targets["perform_target_card_id"] = targets["performTargetCardId"]
    if targets.get("performTargetHiddenIndex") is not None and targets.get("perform_target_hidden_index") is None:
        targets["perform_target_hidden_index"] = targets["performTargetHiddenIndex"]
    if targets.get("flipOrLookChoice") is not None and targets.get("flip_or_look_choice") is None:
        targets["flip_or_look_choice"] = targets["flipOrLookChoice"]
    if targets.get("takeOrSwapChoice") is not None and targets.get("take_or_swap_choice") is None:
        targets["take_or_swap_choice"] = targets["takeOrSwapChoice"]
    if targets.get("swapHandCardId") is not None and targets.get("swap_hand_card_id") is None:
        targets["swap_hand_card_id"] = targets["swapHandCardId"]
    if ability and condition_met:
        x_source = ability.get("x_source")
        if x_source in ("target_party_markers", "target_face_up_green", "target_face_up_blue", "target_face_down_count"):
            if len(state.players) == 2 and not targets.get("target_player_id"):
                for p in state.players:
                    if p.player_id != cmd.player_id:
                        targets["target_player_id"] = p.player_id
                        break

    if card.get("markers") and condition_met:
        red_delta, green_delta = resolve_markers(state, card, targets)
    elif card.get("markers") and not condition_met:
        red_delta, green_delta = 0, 0
    else:
        red_delta = card.get("red_delta", 0) if condition_met else 0
        green_delta = card.get("green_delta", 0) if condition_met else 0

    # Card goes to open or hidden by default; Place or Swap hand<->party_face_down -> face down
    as_open = True
    if ability:
        tgt = (ability.get("target") or "").lower().replace(" ", "_")
        if ability.get("action") == "Place" and tgt in ("party", "party_face_down"):
            as_open = False
        if ability.get("action") == "Swap" and ability.get("source") == "hand" and "party_face_down" in tgt:
            as_open = False

    events = []
    events.append(("CardPlayed", CardPlayed(
        player_id=cmd.player_id,
        card_id=cmd.card_id,
        red_delta=red_delta,
        green_delta=green_delta,
        as_open=as_open,
    ).to_payload()))
    if red_delta or green_delta:
        events.append(("MarkerMoved", MarkerMoved(red_delta=red_delta, green_delta=green_delta).to_payload()))

    # Execute ability if present and condition (if any) is satisfied; skip Place when we already played face down
    run_ability = ability and ability.get("action") != "Place" and condition_met
    if run_ability:
        # Ability execution runs against this pre-CardPlayed state, so the played card is
        # still nominally in the actor's hand. Thread the root card id through (also across
        # nested Perform/Perform_Top/Bury_Perform execution) so abilities.py never mistakes
        # the card being played for a valid target drawn from "the actor's hand".
        targets["_root_card_id"] = cmd.card_id
        try:
            ability_events = abilities_module.execute_ability(
                state, cmd.card_id, ability, cmd.player_id, targets
            )
            events.extend(ability_events)
        except CommandRejected as exc:
            # «Якщо якісь здібності героя виконати не можна, ви все одно можете
            # покласти героя в загін і просто пропустити ті здібності».
            #
            # Доти будь-яка відмова здібності зривала весь хід картою: героя не
            # можна було зіграти взагалі, і рука могла заклинити на картах, для
            # яких на столі просто немає цілі. Маркери при цьому теж не рухалися,
            # хоча вони — окрема, завжди виконувана частина карти.
            #
            # Пропускаємо лише відмови зі змістом «ціляти нема в що». Решта —
            # зіпсований стан або невідомий гравець — це помилка, а не правило,
            # і має лишатися видимою.
            if exc.code not in ("INVALID_TARGET", "EMPTY_GRAVEYARD"):
                raise

    # PlayExtra: do not end turn — same player keeps phase PLAY and can play another card
    if not (run_ability and ability and ability.get("action") == "PlayExtra"):
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.DRAW.value, current_player_index=state.current_player_index).to_payload()))
    return events


def handle_pass_play(state: GameState, cmd: PassPlayCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.PLAY:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза гри (PLAY)")
    return [
        (
            "TurnPhaseChanged",
            TurnPhaseChanged(
                phase=TurnPhase.DRAW.value,
                current_player_index=state.current_player_index,
            ).to_payload(),
        ),
    ]


def handle_discard_cards(state: GameState, cmd: DiscardCardsCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    # DRAW тут теж дозволений: здібності можуть дати карт у руку просто під час
    # ходу, і гравець заходить у фазу добору вже з чотирма й більше картами.
    # Добирати йому нема чого, а скидати до трьох — треба.
    if state.current_phase not in (TurnPhase.PLAY, TurnPhase.DISCARD, TurnPhase.DRAW):
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза гри або скидання карт")
    player = state.get_player(cmd.player_id)
    if not player:
        raise CommandRejected("PLAYER_NOT_FOUND", "Гравця немає в кімнаті")
    for cid in cmd.card_ids:
        if cid not in player.hand_card_ids:
            raise CommandRejected("CARD_NOT_IN_HAND", f"Карти {cid} немає на руці")
    events = [
        ("CardsDiscarded", CardsDiscarded(player_id=cmd.player_id, card_ids=cmd.card_ids).to_payload()),
    ]
    if state.current_phase == TurnPhase.PLAY:
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.DRAW.value).to_payload()))
    else:
        # DISCARD / DRAW: крок 3 ходу — скинути рівно до 3 карт.
        if len(player.hand_card_ids) - len(cmd.card_ids) != HAND_SIZE:
            raise CommandRejected("MUST_DISCARD_TO_THREE", "Потрібно скинути до 3 карт")
        events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.REFILL_TAVERN.value).to_payload()))
    return events


def handle_draw_from_tavern(state: GameState, cmd: DrawFromTavernCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.DRAW:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза взяття карт (DRAW)")
    if cmd.slot_index < 0 or cmd.slot_index >= len(state.tavern):
        raise CommandRejected("INVALID_SLOT", "Невірний слот таверни")
    card_id = state.tavern[cmd.slot_index]
    if not card_id:
        raise CommandRejected("EMPTY_SLOT", "Слот таверни порожній")
    player = state.get_player(cmd.player_id)
    events = [
        ("CardDrawn", CardDrawn(
            player_id=cmd.player_id,
            card_id=card_id,
            source="tavern",
            tavern_slot=cmd.slot_index,
        ).to_payload()),
    ]
    hand_after = (len(player.hand_card_ids) if player else 0) + 1
    events.append(("TurnPhaseChanged", TurnPhaseChanged(
        phase=_phase_after_draw(state, hand_after, tavern_slot_taken=cmd.slot_index),
    ).to_payload()))
    return events


def handle_draw_from_harbor(state: GameState, cmd: DrawFromHarborCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.DRAW:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза взяття карт (DRAW)")
    # Rules: if Harbor is empty, shuffle Wilderness to form new Harbor
    harbor = list(state.harbor)
    if not harbor and state.wilderness:
        shuffled = list(state.wilderness)
        random.shuffle(shuffled)
        events = [
            ("DeckShuffled", DeckShuffled(harbor_card_ids=shuffled, source="wilderness").to_payload()),
            ("CardDrawn", CardDrawn(player_id=cmd.player_id, card_id=shuffled[0], source="harbor").to_payload()),
        ]
    elif harbor:
        events = [
            ("CardDrawn", CardDrawn(player_id=cmd.player_id, card_id=harbor[0], source="harbor").to_payload()),
        ]
    else:
        raise CommandRejected("HARBOR_EMPTY", "Гавань і дикі землі порожні")
    player = state.get_player(cmd.player_id)
    hand_after = (len(player.hand_card_ids) if player else 0) + 1
    # Після перетасовки гавань має стільки карт, скільки було в пустоші, а
    # пустош порожня. У `state` усе ще навпаки, тому розмір передаємо явно.
    reshuffled = not harbor
    events.append(("TurnPhaseChanged", TurnPhaseChanged(
        phase=_phase_after_draw(
            state,
            hand_after,
            harbor_taken=1,
            harbor_size=len(state.wilderness) if reshuffled else None,
        ),
    ).to_payload()))
    return events


def handle_refill_tavern(state: GameState, cmd: RefillTavernCommand) -> list[tuple[str, dict]]:
    if state.game_ended:
        raise CommandRejected("GAME_ENDED", "Гра закінчилась")
    if _current_player_id(state) != cmd.player_id:
        raise CommandRejected("NOT_YOUR_TURN", "Не ваш хід")
    if state.current_phase != TurnPhase.REFILL_TAVERN:
        raise CommandRejected("INVALID_PHASE", "Потрібна фаза поповнення таверни")
    events = []
    harbor = list(state.harbor)  # карты снимаються по очердеи
    for slot in range(len(state.tavern)):
        if state.tavern[slot] is not None:
            continue
        if not harbor and state.wilderness:
            # «Якщо в гавані закінчились карти, а вам треба взяти карту,
            # перетасуйте пустош і зробіть із неї нову гавань» — поповнення
            # таверни це теж взяття карти. Доти перетасовка була лише в доборі
            # з гавані, і слоти таверни просто лишалися порожніми до кінця гри.
            harbor = list(state.wilderness)
            random.shuffle(harbor)
            events.append(("DeckShuffled", DeckShuffled(harbor_card_ids=harbor, source="wilderness").to_payload()))
        if harbor:
            card_id = harbor.pop(0)  # убираеться верхняя карта
            events.append(("TavernRefilled", TavernRefilled(slot_index=slot, card_id=card_id).to_payload()))
    next_idx = (state.current_player_index + 1) % len(state.players)
    events.append(("TurnPhaseChanged", TurnPhaseChanged(phase=TurnPhase.PLAY.value, current_player_index=next_idx).to_payload()))
    return events
