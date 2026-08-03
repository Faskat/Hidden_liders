"""
Редакція подій під конкретного глядача.

Клієнт отримує стрічку подій, щоб анімувати те, що сталося. Сирі події —
це внутрішній журнал: у них лежать токени сесій, seed генератора, увесь
порядок колоди й id прихованих героїв. Тому кожна подія перед відправкою
проходить через `redact_event_for_player`.

Два правила, з яких випливає все інше:

1. **Редакція оцінюється проти ПОТОЧНОГО стану, а не стану на момент запису.**
   Стрічка — це реплей історії. Карта, яку вже перевернули лицем угору,
   має бути видною і в старій події `HeroPutFaceDown`, інакше клієнт, що
   опитав пізно, отримав би менше, ніж йому вже дає `project_state_for_player`.

2. **Що приховує проекція — те приховує й стрічка.** Список нижче дзеркалить
   `domain/projection.py`: рука чужого гравця, його приховані герої, чужий
   лідер до кінця гри, вміст гавані, пустоші й цвинтаря (крім верхньої карти).
   Розходження між цими двома файлами і є витік.

`None` на виході означає «цьому гравцеві події не показувати взагалі».
"""
from typing import Any

from domain.state import GameState

#: Ключі, які не має бачити ніхто й ніколи — навіть власник.
#: `player_token` — це ключ від сесії; `seed` детермінує весь `generate_setup_events`,
#: тобто відновлює лідерів усіх гравців, порядок гавані та всіх прихованих героїв.
ALWAYS_STRIP = ("player_token", "seed")

#: Зони з `CardMoved`, вміст яких публічний: таверна відкрита в проекції,
#: верх цвинтаря теж, відкритий загін — тим паче.
PUBLIC_ZONES = ("party_open", "graveyard", "tavern_0", "tavern_1", "tavern_2")


def _strip(payload: dict[str, Any], *keys: str) -> dict[str, Any]:
    return {k: v for k, v in payload.items() if k not in keys}


def _leader_is_public(state: GameState, player_id: str) -> bool:
    return state.game_ended or player_id in state.revealed_leaders


def _card_is_public_in_party(state: GameState, owner_id: str, card_id: str) -> bool:
    """
    Чи стала карта, покладена сорочкою вгору, згодом видимою всім.

    Публічна, якщо вона тепер у відкритому загоні (її перевернули),
    або якщо її вже немає серед прихованих (вбита — пішла на цвинтар),
    або якщо гра скінчилася.
    """
    if state.game_ended:
        return True
    owner = state.get_player(owner_id)
    if not owner:
        return True
    if any(h.card_id == card_id for h in owner.open_heroes):
        return True
    return not any(h.card_id == card_id for h in owner.hidden_heroes)


def redact_event_for_player(
    state: GameState,
    player_id: str,
    event_type: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    """
    Повертає безпечний для `player_id` варіант payload або None, щоб подію пропустити.

    Ключі, які прибрано, саме прибрано, а не занулено: `_payload()` у
    `domain/events.py` теж викидає None-и, тож клієнт уже вміє читати
    відсутні поля, і «є ключ зі значенням null» не плутається з «є значення».
    """
    p = _strip(payload, *ALWAYS_STRIP)
    owner = p.get("player_id")
    is_mine = owner == player_id

    if event_type == "DeckShuffled":
        # Увесь порядок колоди. Клієнту для анімації потрібна лише кількість.
        ids = payload.get("harbor_card_ids") or []
        return {**_strip(p, "harbor_card_ids"), "count": len(ids)}

    if event_type == "LeaderDealt":
        if is_mine or _leader_is_public(state, owner or ""):
            return p
        return _strip(p, "leader_card_id")

    if event_type in ("StartingHandSet", "CardsDiscarded"):
        if is_mine:
            return p
        key = "hand_card_ids" if event_type == "StartingHandSet" else "card_ids"
        ids = payload.get(key) or []
        return {**_strip(p, key), "count": len(ids)}

    if event_type in ("HeroDiscardedToWilderness",):
        # Пустош у проекції — самий лічильник, тож картку бачить лише той, хто скинув.
        return p if is_mine else _strip(p, "card_id")

    if event_type == "HeroPutFaceDown":
        if is_mine or _card_is_public_in_party(state, owner or "", payload.get("card_id") or ""):
            return p
        return _strip(p, "card_id")

    if event_type in ("HeroDrawn", "CardDrawn"):
        # Таверна відкрита всім (projection.py: tavern_view), гавань — ні.
        if is_mine or payload.get("source") == "tavern":
            return p
        return _strip(p, "card_id")

    if event_type == "CardPlayed":
        if payload.get("as_open") or is_mine:
            return p
        if _card_is_public_in_party(state, owner or "", payload.get("card_id") or ""):
            return p
        # Дельти маркерів — теж відбиток карти, і не гірший за назву.
        # Сам рух маркерів однаково приїде публічною подією MarkerMoved.
        return _strip(p, "card_id", "red_delta", "green_delta")

    if event_type == "CardMoved":
        from_zone = payload.get("from_zone") or ""
        to_zone = payload.get("to_zone") or ""
        if from_zone in PUBLIC_ZONES and to_zone in PUBLIC_ZONES:
            return p
        involved = {payload.get("from_player_id"), payload.get("to_player_id")}
        if player_id in involved:
            return p
        return _strip(p, "card_id")

    return p
