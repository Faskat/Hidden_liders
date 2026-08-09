"""
Анімації, які вмикають здібності карт.

Вбивство героя, переворот, обмін руками, перетасовка гавані, узагальнений
перенос — усе це залежить від того, яка карта кому дісталася, а це вирішує
`random` на бекенді. Дочекатися потрібної здібності живою грою означало б
грати наосліп до посиніння й усе одно лишити тест плаваючим.

Тому події подаються режисерові напряму, через шов `window.__hlFeed`. Це не
підміна живих сценаріїв — розіграш, добір, скид і роздача перевіряються
справжньою грою в сусідніх файлах. Тут перевіряється рівно одне: отримавши
таку подію, режисер везе карту звідти й туди.
"""
import itertools
import time

from conftest import (
    deal, feed, flights, inplace, open_room, probe_reset, wait_flights, wait_for,
)

#: Синтетичні події мають бути «новішими» за все, що вже програв режисер.
_seq = itertools.count(900_001)


def event(event_type, **fields):
    return dict(event_type=event_type, seq=next(_seq), **fields)


def dealt(driver, table):
    """Роздати й вийти на чистий спостерігач. Повертає (свій id, чужий id)."""
    me = open_room(driver, table)
    deal(driver, table)
    probe_reset(driver)
    return me, table.pid(1)


def test_a_killed_hero_flies_to_the_graveyard(driver, table):
    me, _ = dealt(driver, table)

    feed(driver, [event("HeroKilled", player_id=me, card_id="hero_0")])

    flight = wait_flights(driver, 1, "вбитий герой нікуди не полетів")[0]
    assert flight["from"] == f"party:{me}", flight
    assert flight["to"] == "graveyard", flight


def test_a_revealed_hero_turns_face_up_on_the_way_to_the_party(driver, table):
    me, _ = dealt(driver, table)

    feed(driver, [event("HeroRevealed", player_id=me, card_id="hero_0")])

    flight = wait_flights(driver, 1, "розкритий герой нікуди не полетів")[0]
    assert flight["from"] == f"hidden:{me}", flight
    assert flight["to"] == f"party:{me}", flight
    assert flight["flip"], "герой має показати обличчя дорогою"


def test_swapping_hands_sends_two_backs_across_the_table(driver, table):
    me, other = dealt(driver, table)

    feed(driver, [event("HandsSwapped", player_id_1=me, player_id_2=other)])

    got = wait_flights(driver, 2, "обмін руками показав менше двох дуг")
    routes = {(f["from"], f["to"]) for f in got}
    assert routes == {(f"hand:{me}", f"hand:{other}"), (f"hand:{other}", f"hand:{me}")}, routes
    # Що саме помінялося, знають лише учасники — обидві карти мусять бути безликі.
    assert all(f["cards"] == ["back"] for f in got), got


def test_a_reshuffle_shakes_the_harbor(driver, table):
    """Пустош перетасували в гавань: стос хитається, а не мовчки міняє лічильник."""
    dealt(driver, table)

    feed(driver, [event("DeckShuffled", source="wilderness", count=12)])

    wait_for(
        driver,
        "return window.__hlProbe.inplace().some(r => r.zone === 'harbor')",
        "гавань не відреагувала на перетасовку",
    )
    shake = [r for r in inplace(driver) if r["zone"] == "harbor"]
    assert any("transform" in r["props"] for r in shake), shake


def test_the_generic_move_follows_the_zones_of_the_event(driver, table):
    """
    `CardMoved` — узагальнений перенос, яким користуються рідкісні здібності.

    Словник зон у події збігається з реєстром навмисно, і саме це тут і
    перевіряється: подія лягає на анімацію без окремої таблиці відповідностей.
    """
    me, _ = dealt(driver, table)
    card = table.state(0)["tavern"][0]["card_id"]

    feed(driver, [event(
        "CardMoved", card_id=card,
        from_zone="tavern_0", to_zone="party_open", to_player_id=me,
    )])

    flight = wait_flights(driver, 1, "перенос картки не показав польоту")[0]
    assert flight["from"] == "tavern:0", flight
    assert flight["to"] == f"party:{me}", flight


def test_a_leader_reveal_never_turns_into_a_flight(driver, table):
    """
    Плашка лідера розгортається на місці — і лише якщо вона взагалі є.

    Посеред партії її немає ні в кого: чужого лідера ховає проєкція до кінця
    гри, а власного гравець і так знає, і замість картки в його панелі стоїть
    ім'я. Тобто анімувати нічого — і головне тут, що режисер від цього не
    вигадує політ карти й не падає. Саме розгортання перевіряється там, де
    воно й буває, — на кінці гри (`test_board_effects.py`).
    """
    _, other = dealt(driver, table)

    feed(driver, [event("LeaderRevealed", player_id=other, leader_card_id="whatever")])
    time.sleep(1.0)

    assert flights(driver) == [], "лідер нікуди не летить"
    assert driver.execute_script("return window.__hlProbe.hiddenCards()") == []
