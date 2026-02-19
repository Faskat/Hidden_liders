class Player:
    def __init__(self, name, role, leader):
        self.name = name
        self.role = role
        self.leader = leader
        self.hand = []
        self.played_cards = []

    def draw(self, deck, n=1):
        for _ in range(n):
            if deck:
                self.hand.append(deck.pop(0))

    def play_card(self, card):
        if card in self.hand:
            self.hand.remove(card)
            self.played_cards.append(card)
            # эффект карты, например, движение маркеров, можно добавить позже
            # card.effect(game, self)

    def bin_card(self, card, game=None):
        if card in self.hand:
            self.hand.remove(card)
            if game:
                game.move_card_to_discard(card)


class Card:
    def __init__(self, name, type, fraction, visible=True):
        self.name = name
        self.type = type
        self.fraction = fraction
        self.visible = visible

class UndeadCard(Card):
    def __init__(self, name, type, visible=True):
        super().__init__(name, type, fraction="Undead", visible=visible)
    def __generate_undead__(self, num, target, choise):
        pass

class WaterfolkCard(Card):
    def __init__(self, name, type, visible=True):
        super().__init__(name, type, fraction="Waterfolk", visible=visible)

class ImperialsCard(Card):
    def __init__(self, name, type, visible=True):
        super().__init__(name, type, fraction="Imperials", visible=visible)

class HighlandersCard(Card):
    def __init__(self, name, type, visible=True):
        super().__init__(name, type, fraction="Highlanders", visible=visible)




class Leader(Card):
    def __init__(self, name, fraction_1, fraction_2, number, visible=False):
        super().__init__(name, type="leader", fraction="Leader", visible=visible)
        self.fraction_1 = fraction_1
        self.fraction_2 = fraction_2
        self.number = number
