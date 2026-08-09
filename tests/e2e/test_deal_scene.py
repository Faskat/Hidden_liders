"""
Сцена початкової роздачі.

Найдовша анімація в грі й єдина, яку бачить кожен гравець кожної партії.
Перевіряється не «щось поворухнулося», а маршрут кожної карти: звідки вилетіла
й де опинилася.
"""
from collections import Counter

from conftest import deal, open_room


def test_every_card_of_the_deal_leaves_the_harbor(driver, table):
    """
    Уся роздача йде з гавані — і нізвідки більше.

    Це не прискіпливість. Бекенд роздає п'ять карт, і дві з них тут-таки
    відкладає: одну сорочкою в загін, другу в пустош (`setup.py:130-131`). У
    руці їх не бачив ніхто — стан приїжджає вже поділеним. Якщо ці дві полетять
    «із руки», гравець побачить, як карта вилітає з руки, якої в неї не було.
    """
    open_room(driver, table)
    got = deal(driver, table)

    sources = Counter(f["from"] for f in got)
    assert set(sources) == {"harbor"}, f"роздача стартувала не лише з гавані: {sources}"


def test_the_deal_puts_every_card_where_it_belongs(driver, table):
    """Кожен політ роздачі закінчується там, де карта справді лежить."""
    me = open_room(driver, table)
    other = table.pid(1)
    got = deal(driver, table)

    targets = Counter(f["to"] for f in got)
    assert targets["graveyard"] == 1, "цвинтар заповнюється рівно однією картою"
    assert targets["tavern:0"] == 1 and targets["tavern:1"] == 1 and targets["tavern:2"] == 1
    assert targets["wilderness"] == 2, "по одному скиду на гравця"
    assert targets[f"hand:{me}"] == 3, "у руці лишається три карти з п'яти"
    assert targets[f"hand:{other}"] == 3
    # Прихований герой лягає в бейдж прихованих; поки їх нема, режисер цілиться
    # в загін, тож приймаємо будь-який із двох.
    for pid in (me, other):
        assert targets[f"hidden:{pid}"] + targets[f"party:{pid}"] == 1, f"прихований герой {pid[:6]}"


def test_the_tavern_fills_left_to_right(driver, table):
    """
    Таверна набирається зліва направо.

    Бекенд віддає всі три слоти однією подією `TavernFilled`, і без розрізання
    на слот вони спалахнули б одночасно.
    """
    open_room(driver, table)
    got = deal(driver, table)

    slots = [f["to"] for f in got if f["to"].startswith("tavern:")]
    assert slots == ["tavern:0", "tavern:1", "tavern:2"], slots


def test_the_tavern_cards_land_face_up(driver, table):
    """З гавані виїжджає сорочка й перевертається лицем уже в слоті."""
    open_room(driver, table)
    got = deal(driver, table)

    tavern = [f for f in got if f["to"].startswith("tavern:")]
    assert all(f["flip"] for f in tavern), "карта таверни має перевертатися в польоті"


def test_the_deal_scales_with_the_table(driver, table4):
    """Скільки гравців — стільки й рук: сцена не губить нікого за столом."""
    open_room(driver, table4)
    got = deal(driver, table4)

    assert len(got) == 4 + 5 * 4, "стіл на чотирьох роздає 24 карти"
    hands = Counter(f["to"] for f in got if f["to"].startswith("hand:"))
    assert len(hands) == 4 and set(hands.values()) == {3}, hands


def test_the_deal_is_over_in_a_few_seconds(driver, table):
    """
    Роздача триває стільки, скільки її не шкода дивитися.

    Крок сцени підганяється під кількість подій саме заради цього: на шістьох
    гравців кроків утричі більше, ніж на двох, і зі сталим кроком партія
    починалася б із десятисекундної заставки.
    """
    open_room(driver, table)
    got = deal(driver, table)

    span = got[-1]["t"] - got[0]["t"]
    assert span < 4000, f"сцена розтягнулася на {span} мс"
    assert span > 500, f"сцена злилася в одну мить ({span} мс) — кроків не видно"
