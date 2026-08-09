"""
Анімації звичайного ходу: розіграш, добір, скид, поповнення таверни.

Хід ведеться через HTTP, а не кліками. Це навмисно: половина карт відкриває
вікно вибору цілі, і клікати по ньому означало б перевіряти верстку модалок
там, де перевіряються польоти. Браузер тут — глядач, і дивиться він рівно те,
що побачить живий гравець: свій хід і чужий приходять тим самим шляхом.
"""
from conftest import (
    deal, open_room, probe_reset, ready_to_act, wait_flight, wait_flights, wait_settled,
)


def test_playing_a_card_flies_it_out_of_the_hand(driver, table):
    me = ready_to_act(driver, table)
    before = table.cursor(0)
    table.play_any_card(0)
    played = next(e for e in table.events_since(before) if e["event_type"] == "CardPlayed")

    flight = wait_flights(driver, 1, "розіграш не показав польоту")[0]
    assert flight["from"] == f"hand:{me}"
    if played.get("as_open") is False:
        # Прихованого героя кладуть сорочкою вгору: карта перевертається в дорозі.
        assert flight["to"] in (f"hidden:{me}", f"party:{me}"), flight
        assert flight["flip"], "прихований герой має перевернутися в польоті"
    else:
        assert flight["to"] == f"party:{me}", flight
        assert not flight["flip"], "відкрита карта в загоні не перевертається"


def test_drawing_from_the_tavern_flies_into_the_hand(driver, table):
    me = ready_to_act(driver, table)
    table.command(0, "PassPlay")
    table.command(0, "DrawFromTavern", {"slot_index": 1})

    flight = wait_flights(driver, 1, "добір із таверни не показав польоту")[0]
    assert flight["from"] == "tavern:1", flight
    assert flight["to"] == f"hand:{me}", flight


def test_drawing_from_the_harbor_flies_into_the_hand(driver, table):
    me = ready_to_act(driver, table)
    table.command(0, "PassPlay")
    table.command(0, "DrawFromHarbor")

    flight = wait_flights(driver, 1, "добір із гавані не показав польоту")[0]
    assert flight["from"] == "harbor", flight
    assert flight["to"] == f"hand:{me}", flight


def test_discarding_sends_the_card_to_the_wilderness(driver, table):
    me = ready_to_act(driver, table)
    table.command(0, "PassPlay")
    table.command(0, "DrawFromTavern", {"slot_index": 0})
    wait_flights(driver, 1, "добір не показав польоту")
    probe_reset(driver)

    table.command(0, "DiscardCards", {"card_ids": table.hand(0)[:1]})

    flight = wait_flights(driver, 1, "скид не показав польоту")[0]
    assert flight["from"] == f"hand:{me}", flight
    assert flight["to"] == "wilderness", flight


def test_refilling_the_tavern_pulls_a_card_from_the_harbor(driver, table):
    """
    Спорожнілий слот таверни набирається сам.

    Команду шле сам стіл, щойно доходить фаза (авто-поповнення в `page.tsx`),
    тож тест її й не надсилає — інакше вони перегнали б одне одного, і чия
    команда дійде першою, залежало б від мережі. Тест лише звільняє слот і
    дивиться, що з гавані туди приїхала карта.
    """
    ready_to_act(driver, table)
    table.command(0, "PassPlay")
    table.command(0, "DrawFromTavern", {"slot_index": 2})
    if table.phase(0) == "DISCARD":
        table.command(0, "DiscardCards", {"card_ids": table.hand(0)[:1]})

    refill = wait_flight(driver, to="tavern:2")[0]
    assert refill["from"] == "harbor", refill
    assert refill["flip"], "карта прилітає сорочкою й відкривається в слоті"


def test_the_opponents_draw_is_visible_but_faceless(driver, table):
    """
    Чужий хід видно так само, як свій, — але без вмісту.

    Це головна причина, заради якої анімації взагалі робилися: без руху хід
    суперника зводиться до того, що на столі мовчки змінилися числа.
    """
    open_room(driver, table)
    deal(driver, table)
    table.hand_turn_to(1)
    wait_settled(driver)
    probe_reset(driver)

    table.command(1, "PassPlay")
    table.command(1, "DrawFromTavern", {"slot_index": 0})

    flight = wait_flights(driver, 1, "чужий добір не показав польоту")[0]
    assert flight["from"] == "tavern:0", flight
    assert flight["to"] == f"hand:{table.pid(1)}", flight
