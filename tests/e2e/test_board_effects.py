"""
Анімації, які нічого не переносять: підсвітка панелі, спалах треку, лідери.

Вони не проходять через шар польотів — режисер анімує самі елементи зон. Тому
й перевіряються окремо: спостерігач ловить їх за зоною, чий елемент рухається.
"""
import pytest

from conftest import (
    deal, inplace, open_room, probe_reset, wait_for, wait_for_turn, wait_settled,
)

#: Скільки ходів дати на те, щоб жетон таки зрушив.
MARKER_ATTEMPTS = 4


def _play_until_a_marker_moves(driver, table):
    """
    Зіграти карту, від якої справді їде жетон, — і почати відлік саме з неї.

    Однієї спроби мало. Дельта є в каталозі в 58 героїв із 72, але в частини
    вона під умовою («якщо в таверні немає червоних»), і карта цілком може
    лягти, нічого не зрушивши. Тому ходів дається кілька, а спостерігач
    скидається перед тією спробою, яка врешті спрацює.
    """
    for _ in range(MARKER_ATTEMPTS):
        table.hand_turn_to(0)
        wait_for_turn(driver, table.pid(0))
        wait_settled(driver)
        probe_reset(driver)

        before = table.state(0)
        table.play_any_card(0, prefer_markers=True)
        after = table.state(0)
        if (after["red_marker"], after["green_marker"]) != (before["red_marker"], before["green_marker"]):
            return
        table.finish_turn(0)
    pytest.skip(f"за {MARKER_ATTEMPTS} ходів жоден жетон не зрушив")


def test_the_marker_slides_to_its_new_cell(driver, table):
    """
    Жетон переїжджає в сусідню клітинку, а не перестрибує.

    Єдина анімація столу, що живе не в режисері: маркери рухає сама дошка, від
    зміни числа в стані (`CentralBoard.tsx`, `MARKER_SLIDE_MS`). Через це вона
    найлегше й губиться при переробці треку — тому й ловиться тим самим
    спостерігачем, що й решта.
    """
    open_room(driver, table)
    deal(driver, table)
    _play_until_a_marker_moves(driver, table)

    wait_for(
        driver,
        "return window.__hlProbe.inplace().some(r => r.zone === 'track')",
        "жетон не поїхав по треку",
    )
    moves = [r for r in inplace(driver) if r["zone"] == "track"]
    assert any("transform" in r["props"] for r in moves), moves
    assert any("boxShadow" in r["props"] for r in moves), "клітинка прибуття не підсвітилася"


def test_the_panel_pulses_when_the_turn_comes_around(driver, table):
    """
    Хід перейшов — панель того, хто ходить, коротко спалахує.

    Саме при зміні гравця, а не фази: фаза міняється по чотири рази за хід, і
    панель блимала б майже безперервно.
    """
    open_room(driver, table)
    deal(driver, table)
    # Хто ходить першим, вирішує жеребкування на бекенді. Щоб перевіряти саме
    # передачу ходу, її треба спершу влаштувати: віддати хід суперникові й
    # дочекатися, поки він поверне його назад.
    table.hand_turn_to(1)
    wait_for_turn(driver, table.pid(1))
    probe_reset(driver)

    table.finish_turn(1)
    wait_for_turn(driver, table.pid(0))

    me = table.pid(0)
    wait_for(
        driver,
        f"return window.__hlProbe.inplace().some(r => r.zone === 'panel:{me}')",
        "панель активного гравця не спалахнула",
    )
    pulses = [r for r in inplace(driver) if r["zone"] == f"panel:{me}"]
    assert any("boxShadow" in r["props"] for r in pulses), pulses


def test_the_end_of_the_game_flashes_the_track_and_opens_the_leaders(driver, table):
    """
    Кінець гри: спалах уздовж треку, потім плашки лідерів розгортаються.

    Каскад кінця гри дописується всередині обробника команди, і в списку, який
    той повертає, його немає — до столу він доїжджає лише курсором стрічки.
    Тобто цей тест заразом перевіряє, що курсор його справді доносить.
    """
    open_room(driver, table)
    deal(driver, table)
    probe_reset(driver)

    table.command(0, "EndGame")

    wait_for(
        driver,
        "return window.__hlProbe.inplace().some(r => r.zone === 'track')",
        "трек не спалахнув на кінці гри",
    )
    records = inplace(driver)
    assert any(r["zone"] == "track" and "filter" in r["props"] for r in records), records

    # Плашка є лише в чужих панелей: власного лідера гравець і так знає, і в
    # його панелі замість картки стоїть просто ім'я.
    other = table.pid(1)
    wait_for(
        driver,
        f"return window.__hlProbe.inplace().some(r => r.zone === 'leader:{other}')",
        "плашка лідера суперника не розгорнулася",
    )
