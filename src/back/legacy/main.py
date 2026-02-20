import random
from entities import Player, Leader, UndeadCard, WaterfolkCard, ImperialsCard, HighlandersCard
from game import Game

# ==== ДОСКА ====
def draw_board(red, green):
    print("\n=== ДОСКА ===")
    print(" 1    2   3   4    5   6   7  8   [9] [10] [11][12]  <- мертвая зона")
    print("  ---------------------------------------------")
    line = ""
    for pos in range(1, 13):
        cell = "   "
        if pos == red and pos == green:
            cell = "RG"
        elif pos == red:
            cell = "R  "
        elif pos == green:
            cell = "G  "
        line += f"|{cell}"
    print(line + "|")
    print("  ---------------------------------------------")

# ==== ЛИДЕРЫ ====
leader1 = Leader("Pavyr", "Highlanders", "Imperials", 5)
leader2 = Leader("Myrad", "Undead", "Highlanders", 3)
leader3 = Leader("Lemron", "Waterfolk", "Highlanders", 1)
leader4 = Leader("Cyra", "Waterfolk", "Imperials", 2)
leader5 = Leader("Xiadul", "Imperials", "Undead", 4)
leader6 = Leader("Enned", "Waterfolk", "Undead", 6)

# ==== ИГРОКИ ====
leaders = [leader1, leader2, leader3, leader4, leader5, leader6]
p1_leader = random.choice(leaders)
remaining_leaders = [l for l in leaders if l != p1_leader]
p2_leader = random.choice(remaining_leaders)

p1 = Player("Ти", role=None, leader=p1_leader)
p2 = Player("Бот", role=None, leader=p2_leader)

# ==== ПОРТ ====
fractions = [UndeadCard, WaterfolkCard, ImperialsCard, HighlandersCard]
types = ["attack", "support", "spell", "move"]
deck = []
for i in range(80):
    fraction_class = random.choice(fractions)
    card_type = random.choice(types)
    card_name = f"Карта {i + 1}"
    deck.append(fraction_class(card_name, card_type))

# ==== ИГРА ====
g = Game(players=[p1, p2], zone={"deck": deck})
g.red_marker = 4
g.green_marker = 4

# ==== ЭФФЕКТ КАРТЫ ====
def card_effect(game, player, card):
    target = random.choice(["red", "green"])
    value = random.choice([-2, -1, 1, 2])
    if target == "red":
        game.red_marker += value
        mark = "красный"
    else:
        game.green_marker += value
        mark = "зелёный"
    game.red_marker = max(1, min(12, game.red_marker))
    game.green_marker = max(1, min(12, game.green_marker))
    direction = "поднимает" if value > 0 else "понижает"
    print(f"{player.name} сыграл {card.name} ({card.fraction}) -> {direction} {mark} маркер на {abs(value)}")
    draw_board(game.red_marker, game.green_marker)

def new_play_card(self, card, game):
    if card in self.hand:
        self.hand.remove(card)
        if getattr(card, "type", None) == "spell":
            game.move_card_to_graveyard(card)
        else:
            card.visible = True
            self.played_cards.append(card)
        card_effect(game, self, card)

Player.play_card = new_play_card

# ==== СТАРТ ИГРЫ ====
g.start()
for p in g.players:
    p.hand.clear()
    g.player_draw(p, 5)

# Предстарт: скрытая карта + скинуть лишнюю + оставить 3
for p in g.players:
    print(f"\n{p.name}, твой лидер: {p.leader.name} ({p.leader.fraction_1}/{p.leader.fraction_2})")
    print("Твои карты:" if p.name == "Ти" else "Карты бота:")
    for i, c in enumerate(p.hand):
        print(f"{i + 1}. {c.name} ({c.fraction})")
    if p.name == "Ти":
        try:
            choice = int(input("Выбери одну карту для скрытия (номер): ")) - 1
            if choice < 0 or choice >= len(p.hand):
                choice = 0
        except Exception:
            choice = 0
        hidden = p.hand.pop(choice)
        hidden.visible = False
        p.hidden_card = hidden
        print(f"Скрытая карта: {hidden.name}")
    else:
        leader_fr = [p.leader.fraction_1, p.leader.fraction_2]
        candidates = [c for c in p.hand if c.fraction in leader_fr]
        hidden = random.choice(candidates) if candidates else random.choice(p.hand)
        p.hand.remove(hidden)
        hidden.visible = False
        p.hidden_card = hidden
        print("Бот скрыл карту")
    if p.name == "Ти":
        print("Оставшиеся карты:")
        for i, c in enumerate(p.hand):
            print(f"{i + 1}. {c.name} ({c.fraction})")
        try:
            discard_idx = int(input("Скинь одну карту (номер): ")) - 1
            if discard_idx < 0 or discard_idx >= len(p.hand):
                discard_idx = 0
        except Exception:
            discard_idx = 0
        card_to_bin = p.hand.pop(discard_idx)
        g.move_card_to_discard(card_to_bin)
        print(f"Скинул: {card_to_bin.name}")
    else:
        discard_card = random.choice(p.hand)
        p.hand.remove(discard_card)
        g.move_card_to_discard(discard_card)
        print("Бот скинул карту")
    while len(p.hand) > 3:
        card = p.hand.pop()
        g.move_card_to_discard(card)

print("\n=== Подготовка завершена ===")
draw_board(g.red_marker, g.green_marker)

def show_table(p, is_player=False):
    print(f"--- СТОЛ {p.name} ---")
    if is_player:
        print(f"Лидер: {p.leader.name} ({p.leader.fraction_1}/{p.leader.fraction_2})")
        if hasattr(p, "hidden_card"):
            print(f"Скрытая карта: {p.hidden_card.name} ({p.hidden_card.fraction})")
    else:
        print("Лидер: (скрыт)" if hasattr(p, "hidden_card") else f"Лидер: {p.leader.name}")
        if hasattr(p, "hidden_card"):
            print("Скрытая карта: (скрыта)")
    print("Сыгранные карты:", [f"{c.name}({c.fraction})" for c in p.played_cards])

def discard_cards(p, g, multi=True):
    if not p.hand:
        print("Нет карт для сброса")
        return
    print("Твои карты:")
    for i, c in enumerate(p.hand):
        print(f"{i + 1}. {c.name} ({c.fraction})")
    s = input("Номера карт для сброса (например 13): ") if multi else input("Номер карты: ")
    to_bin = []
    for ch in s:
        try:
            n = int(ch) - 1
            if 0 <= n < len(p.hand):
                to_bin.append(p.hand[n])
        except ValueError:
            pass
    if not to_bin:
        print("Неверный ввод")
        return
    for c in to_bin:
        p.hand.remove(c)
        g.move_card_to_discard(c)
        print(f"Сбросил {c.name}")

def draw_from_tavern(p, g, count=1):
    for _ in range(count):
        if not g.zone["tavern"]:
            if g.zone["deck"]:
                g.player_draw(p, 1)
            return
        print("\nТаверна:")
        for i, tc in enumerate(g.zone["tavern"]):
            print(f"{i + 1}. {tc.name} ({tc.fraction})")
        try:
            t_idx = int(input("Номер карты: ")) - 1
        except Exception:
            t_idx = 0
        if 0 <= t_idx < len(g.zone["tavern"]):
            chosen = g.zone["tavern"].pop(t_idx)
            chosen.visible = True
            p.hand.append(chosen)
            if g.zone["deck"]:
                new_card = g.zone["deck"].pop(0)
                new_card.visible = True
                g.zone["tavern"].append(new_card)
        else:
            if g.zone["deck"]:
                g.player_draw(p, 1)

def draw_phase(p, g):
    while len(p.hand) < 4:
        if not g.zone["deck"] and not g.zone["tavern"]:
            print("Нет доступных карт")
            break
        print("\nВыбери откуда добирать карту: 1. Порт 2. Таверна")
        try:
            d = int(input("Ваш выбор: "))
        except Exception:
            d = 1
        if d == 2:
            try:
                n = int(input("Сколько карт из таверны (1-3): "))
            except Exception:
                n = 1
            draw_from_tavern(p, g, min(3, n))
        else:
            g.player_draw(p, 1)

def hand_limit(p, g):
    while len(p.hand) > 3:
        print(f"\nУ тебя {len(p.hand)} карт, нужно сбросить {len(p.hand)-3}")
        discard_cards(p, g, multi=True)

# основной цикл
while True:
    cur = g.players[g.current_player_index]
    print(f"\nХод игрока: {cur.name}")
    show_table(cur, is_player=(cur.name == "Ти"))
    print("\nТаверна:")
    for i, tc in enumerate(g.zone["tavern"]):
        print(f"{i + 1}. {tc.name} ({tc.fraction})")

    if cur.name == "Ти":
        print("\nТвои карты:")
        for i, c in enumerate(cur.hand):
            print(f"{i + 1}. {c.name} ({c.fraction})")
        print("0. Пропустить ход / сбросить")
        try:
            choice = int(input("Номер карты (0 чтобы сбросить): "))
        except Exception:
            choice = -1

        if choice == 0:
            discard_cards(cur, g)
            draw_phase(cur, g)
            print("\nПосле добора сбрось до 3 карт:")
            for i, c in enumerate(cur.hand):
                print(f"{i + 1}. {c.name} ({c.fraction})")
            try:
                drop_choice = int(input("Выбери карту для сброса: "))
                if 1 <= drop_choice <= len(cur.hand):
                    card_to_drop = cur.hand.pop(drop_choice - 1)
                    g.move_card_to_discard(card_to_drop)
                    print(f"Ты сбросил {card_to_drop.name}")
            except Exception:
                pass
            g.current_player_index += 1
            if g.current_player_index >= len(g.players):
                g.current_player_index = 0
            continue

        if 1 <= choice <= len(cur.hand):
            card = cur.hand[choice - 1]
            cur.play_card(card, g)
        draw_phase(cur, g)
        hand_limit(cur, g)

    else:
        if cur.hand:
            c = random.choice(cur.hand)
            cur.play_card(c, g)
            print("Бот сыграл карту")
        else:
            print("Бот пропустил ход")
        leader_fr = [cur.leader.fraction_1, cur.leader.fraction_2]
        candidates = [c for c in g.zone["tavern"] if c.fraction in leader_fr]
        if candidates:
            ch = random.choice(candidates)
            g.zone["tavern"].remove(ch)
            ch.visible = True
            cur.hand.append(ch)
            if g.zone["deck"]:
                nc = g.zone["deck"].pop(0)
                nc.visible = True
                g.zone["tavern"].append(nc)
            print("Бот взял карту из таверны")
        else:
            if g.zone["deck"]:
                g.player_draw(cur, 1)
                print("Бот взял из порта")
        while len(cur.hand) > 3:
            c = random.choice(cur.hand)
            cur.hand.remove(c)
            g.move_card_to_discard(c)
        print("Бот сбросил лишние карты")

    while len(g.zone["tavern"]) < 3 and g.zone["deck"]:
        card = g.zone["deck"].pop(0)
        card.visible = True
        g.zone["tavern"].append(card)

    if g.check_min_played():
        winner = g.check_victory()
        if winner:
            print(f"\n=== ПОБЕДИТЕЛЬ: {winner} ===")
            break

    g.current_player_index += 1
    if g.current_player_index >= len(g.players):
        g.current_player_index = 0

print("\n=== Конец игры ===")
print(f"Финальные маркеры: красный = {g.red_marker}, зелёный = {g.green_marker}")
draw_board(g.red_marker, g.green_marker)
