"""Game constants: marker range, tavern slots, hand sizes, hero limit, deck size."""

# Marker track 1..12
MARKER_MIN = 1
MARKER_MAX = 12

# Tavern has 3 slots
TAVERN_SLOTS = 3

# Hand: 3 cards after refill, draw up to 4
HAND_SIZE = 3
HAND_SIZE_AFTER_DRAW = 4

# Full deck: 72 hero cards (9 copies of 8 heroes)
DECK_HERO_COUNT = 72

# Face-up hero count to trigger game end: (full_game, basic_game) by num_players
HERO_LIMIT: dict[int, tuple[int, int]] = {
    2: (8, 7),
    3: (7, 6),
    4: (7, 6),
    5: (6, 5),
    6: (5, 4),
}

# Both markers in 9–12 → Undead wins
DARK_WAR_SPACES = (9, 10, 11, 12)
