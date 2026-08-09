"""
Що видно на столі, поки карта в дорозі.

Стан застосовується раніше за анімацію: коли подія про добір тільки приїхала,
карта вже намальована в руці. Політ через це декоративний і йде поверх уже
правильної дошки — тому ціль на час польоту ховається, інакше карта видима
двічі, а в руці з'являється тоді, коли ще тільки летить до неї.

Тут же — дві протилежні поведінки: коли рухи вимкнено системно, і коли гравець
обірвав сцену сам.
"""
import time

from conftest import (
    deal, flights, open_room, probe_reset, ready_to_act, sample, samples,
    start_game, wait_flights, wait_for, wait_settled,
)

#: Знімки йдуть раз на 20 мс, і кілька кадрів між приходом стану й сокриттям
#: цілі — плата за те, що позицію в чужій руці не порахувати до коміту React.
FLASH_BUDGET_SAMPLES = 5


def test_the_drawn_card_shows_up_only_when_it_lands(driver, table):
    """
    Добір саме з гавані, а не з таверни.

    Карта таверни лежить на столі ще до добору, і за нею не видно, коли вона
    з'явилася в руці. У гавані ж лише сорочка стосу без жодного id, тож перша
    поява цього id у розмітці — це і є та мить, коли карта опинилася в руці.
    """
    ready_to_act(driver, table)
    table.command(0, "PassPlay")
    before = table.cursor(0)

    sample(driver, 20)
    table.command(0, "DrawFromHarbor")
    drawn = next(e for e in table.events_since(before) if e["event_type"] == "CardDrawn")["card_id"]
    wait_flights(driver, 1, "добір не показав польоту")
    wait_settled(driver)
    shots = samples(driver)

    in_dom = [s for s in shots if drawn in s["cards"]]
    assert in_dom, f"карта {drawn} так і не з'явилася на столі"
    hidden = [s for s in in_dom if drawn in s["hidden"]]
    assert hidden, "карта з'явилася в руці, не чекаючи польоту"

    span = hidden[-1]["t"] - hidden[0]["t"]
    assert span > 300, f"карта була прихована лише {span} мс — політ триває довше"
    assert drawn not in in_dom[-1]["hidden"], "карта так і лишилася прихованою"

    flashed = [s for s in in_dom if s["t"] < hidden[0]["t"]]
    assert len(flashed) <= FLASH_BUDGET_SAMPLES, (
        f"карта світилася в руці {len(flashed)} кадрів до того, як її сховали"
    )


def test_nothing_stays_hidden_after_the_deal(driver, table):
    """
    Найдорожча помилка цього механізму — карта, яку сховали й забули.

    Ключ знімається таймером кроку, тож навіть політ, який не відбувся (зони
    ще не було на екрані), не має лишити на столі дірку.
    """
    open_room(driver, table)
    deal(driver, table)

    assert driver.execute_script("return window.__hlProbe.hiddenCards()") == []


def test_reduced_motion_moves_nothing(driver, table, reduced_motion):
    """
    `prefers-reduced-motion: reduce` — це не «швидше», а «взагалі ні».

    Стіл при цьому мусить заповнитися повністю: анімації декоративні, і
    вимкнення руху не має права з'їсти жодної карти.
    """
    open_room(driver, table)
    probe_reset(driver)
    start_game(driver)
    wait_for(driver, "return window.__hlProbe.tableCards().length >= 10", "стіл не заповнився")
    time.sleep(1.5)

    assert flights(driver) == [], "при вимкнених рухах не має летіти нічого"
    assert driver.execute_script("return window.__hlProbe.hiddenCards()") == []


def test_a_click_skips_the_deal(driver, table):
    """
    Роздачу можна обірвати кліком — вона триває майже три секунди.

    Стан від цього не страждає: анімації йдуть поверх уже правильної дошки,
    тож пропуск має лишити стіл рівно таким, яким він і був би наприкінці.
    """
    open_room(driver, table)
    probe_reset(driver)
    start_game(driver)
    wait_flights(driver, 3, "сцена роздачі не почалася")

    driver.execute_script(
        "document.querySelector('.game-table').dispatchEvent(new MouseEvent('click', {bubbles: true}))"
    )
    time.sleep(0.5)
    stopped_at = len(flights(driver))
    time.sleep(1.5)

    assert len(flights(driver)) == stopped_at, "сцена продовжилася попри пропуск"
    assert driver.execute_script("return window.__hlProbe.hiddenCards()") == [], "карта лишилася схованою"
    assert len(driver.execute_script("return window.__hlProbe.tableCards()")) >= 10, "стіл недорозданий"
