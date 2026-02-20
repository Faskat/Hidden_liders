"""
Game end: winning faction by marker positions, hero limit trigger, tie-break.
Order: Undead (both on 9-12) > Water (adjacent/same) > Empire (red >= green+2) > Tribes (green >= red+2).
"""
from domain.state import GameState, PlayerInState
from domain.constants import HERO_LIMIT, DARK_WAR_SPACES


def get_winning_faction(red: int, green: int) -> str | None:
    """Returns faction name or None if no faction wins."""
    if red in DARK_WAR_SPACES and green in DARK_WAR_SPACES:
        return "Undead"
    if abs(red - green) <= 1:
        return "Waterfolk"
    if red >= green + 2:
        return "Imperials"
    if green >= red + 2:
        return "Highlanders"
    return None


def hero_limit_reached(state: GameState) -> bool:
    full, basic = HERO_LIMIT.get(state.num_players, (7, 6))
    limit = full if state.game_mode == "full" else basic
    for p in state.players:
        if len(p.open_heroes) >= limit:
            return True
    return False


def check_game_end_after_event(state: GameState) -> bool:
    """True if game should end (hero limit reached). Call after CardPlayed, HeroRevealed, etc."""
    if state.game_ended:
        return False
    return hero_limit_reached(state)


def _faction_hero_count(player: PlayerInState, faction: str, cards: dict) -> int:
    count = 0
    for ref in player.open_heroes + player.hidden_heroes:
        c = cards.get(ref.card_id, {})
        if c.get("faction") == faction:
            count += 1
    return count


def _total_hero_count(player: PlayerInState) -> int:
    return len(player.open_heroes) + len(player.hidden_heroes)


def determine_winner(state: GameState) -> str | None:
    """
    After game end: which player wins. Tie-break: most heroes of winning faction,
    then fewer total heroes, then higher leader number.
    Returns winner player_id or None if no player aligned with winning faction.
    """
    if not state.winner_faction:
        return None
    faction = state.winner_faction
    cards = state.cards
    aligned = []
    for p in state.players:
        leader_info = state.revealed_leaders.get(p.player_id)
        if not leader_info:
            continue
        f1 = leader_info.get("fraction_1")
        f2 = leader_info.get("fraction_2")
        if faction in (f1, f2):
            faction_heroes = _faction_hero_count(p, faction, cards)
            total = _total_hero_count(p)
            leader_number = leader_info.get("leader_number", 0)
            aligned.append((p.player_id, faction_heroes, total, leader_number))
    if not aligned:
        return None
    # 1) Most heroes of winning faction
    aligned.sort(key=lambda x: (-x[1], x[2], -x[3]))
    return aligned[0][0]
