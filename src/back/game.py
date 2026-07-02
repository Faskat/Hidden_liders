class Game:
    def __init__(self, players, zone=None):
        self.players = players
        self.current_player_index = 0
        self.red_marker = 0
        self.green_marker = 0

        # Зоны игры
        self.zone = {
            "deck": [],        # колода карт все скрыты
            "tavern": [],      # порт максимум 3 карты все видимые
            "discard": [],     # сброс все карты скрыты
            "graveyard": []    # кладбище видно только верхнюю карту
        }
        if zone:
            for key in zone:
                self.zone[key] = zone[key]

        # минимальное число сыгранных карт для каждого числа игроков
        self.min_played_cards_dict = {2: 8, 3: 7, 4: 7, 5: 6, 6: 5}

    # старт игры: раздать карты и подготовить таверну
    def start(self):
        # раздаем карты игрокам
        for player_index in range(len(self.players)):
            player = self.players[player_index]
            self.player_draw(player, 4)

        # все карты колоды скрыты
        for i in range(len(self.zone["deck"])):
            self.zone["deck"][i].visible = False

        # формируем таверну из 3 карт, все видимые
        for i in range(3):
            if len(self.zone["deck"]) > 0:
                card = self.zone["deck"].pop(0)
                card.visible = True
                self.zone["tavern"].append(card)

    # ход текущего игрока
    def next_turn(self):
        player = self.players[self.current_player_index]

        if player.name != "Ти":  # добавляем проверку
            if len(player.hand) >= 1:
                card = player.hand[0]
                player.play_card(card, game=self)
            elif len(player.hand) >= 3:
                for i in range(3):
                    card_to_bin = player.hand[0]
                    player.bin_card(card_to_bin, game=self)
                self.red_marker += 1
                self.green_marker += 1

        # добор карт до 4 сброс и таверна остаются

        # 2. Добор карт до 4
        while len(player.hand) < 4:
            if len(self.zone["deck"]) > 0:
                self.player_draw(player, 1)
            else:
                break

        # 3. сброс карт пока в руке больше 3
        while len(player.hand) > 3:
            card_to_bin = player.hand[0]
            player.bin_card(card_to_bin, game=self)

        # 4. пополнение таверны
        while len(self.zone["tavern"]) < 3:
            if len(self.zone["deck"]) > 0:
                card = self.zone["deck"].pop(0)
                card.visible = True
                self.zone["tavern"].append(card)
            else:
                break

        # переход к следующему игроку
        self.current_player_index += 1
        if self.current_player_index >= len(self.players):
            self.current_player_index = 0

    # метод перемещения карты в сброс
    def move_card_to_discard(self, card):
        card.visible = False
        self.zone["discard"].append(card)

    # метод перемещения карты в кладбище
    def move_card_to_graveyard(self, card):
        card.visible = True
        self.zone["graveyard"].append(card)
        # Все карты, кроме верхней, скрываем
        for i in range(len(self.zone["graveyard"]) - 1):
            self.zone["graveyard"][i].visible = False

    # метод перемещения карты в таверну
    def play_card_to_tavern(self, card):
        card.visible = True
        self.zone["tavern"].append(card)
        # Максимум 3 карты на столе
        if len(self.zone["tavern"]) > 3:
            old_card = self.zone["tavern"].pop(0)
            self.move_card_to_discard(old_card)

    # добор карт из колоды
    def player_draw(self, player, n):
        for i in range(n):
            if len(self.zone["deck"]) > 0:
                card = self.zone["deck"].pop(0)
                card.visible = False  # карты игрока скрыты
                player.hand.append(card)

    # проверка минимального количества сыгранных карт
    def check_min_played(self):
        num_players = len(self.players)
        min_required = self.min_played_cards_dict[num_players]
        for i in range(len(self.players)):
            player = self.players[i]
            if hasattr(player, 'played_cards') and len(player.played_cards) >= min_required:
                return True
        return False

    def check_victory(self):
        dark_zone = [9, 10, 11, 12]
        winner_faction = None

        # 1. определяем победившую фракцию по положениям маркеров
        if self.red_marker in dark_zone and self.green_marker in dark_zone:
            winner_faction = "Undead"
        elif abs(self.red_marker - self.green_marker) <= 1:
            winner_faction = "Waterfolk"
        elif self.red_marker >= self.green_marker + 2:
            winner_faction = "Imperials"
        elif self.green_marker >= self.red_marker + 2:
            winner_faction = "Highlanders"

        # 2. если фракция победила
        if winner_faction:
            # ищем игроков чьи лидеры принадлежат этой фракции
            faction_players = []
            for p in self.players:
                if p.leader.fraction_1 == winner_faction or p.leader.fraction_2 == winner_faction:
                    count_played = sum(1 for c in p.played_cards if c.fraction == winner_faction)
                    count_hidden = sum(1 for c in p.hand if not c.visible and c.fraction == winner_faction)
                    total_faction = count_played + count_hidden
                    total_all = len(p.played_cards)
                    faction_players.append((p, total_faction, total_all))

            # 3 выбираем среди лидеров того у кого больше карт этой фракции
            max_faction = max(x[1] for x in faction_players)
            contenders = [x for x in faction_players if x[1] == max_faction]

            if len(contenders) == 1:
                return contenders[0][0].name

            # 4 если равенство побеждает тот у кого меньше сыгранных карт всего
            min_total_played = min(x[2] for x in contenders)
            final_contenders = [x for x in contenders if x[2] == min_total_played]

            if len(final_contenders) == 1:
                return final_contenders[0][0].name

            # 5 если снова равенство побеждает тот у кого номер лидера больше
            winner = max(final_contenders, key=lambda x: x[0].leader.number)
            return winner[0].name