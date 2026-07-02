export const PHASE_STEPS = [
  { key: "PLAY", label: "Гра", description: "Зіграйте героя з руки на стіл або натисніть «Пропустити хід»." },
  { key: "DRAW", label: "Брати", description: "Візьміть 1 карту з гавані або з одного з слотів таверни." },
  { key: "DISCARD", label: "Скинути", description: "Скиньте зайві карти, щоб у руці залишилось не більше 3." },
  { key: "REFILL_TAVERN", label: "Поповнити таверну", description: "Заповніть порожні слоти таверни з колоди." },
];

export const WIN_CONDITIONS = [
  { faction: "Undead", condition: "Обидва маркери на 9–12" },
  { faction: "Waterfolk", condition: "|R−G| ≤ 1" },
  { faction: "Imperials", condition: "R ≥ G+2" },
  { faction: "Highlanders", condition: "G ≥ R+2" },
];

/** Face-up hero count to trigger game end (full game mode). Keys = num_players. */
export const HERO_LIMIT: Record<number, number> = {
  2: 8,
  3: 7,
  4: 7,
  5: 6,
  6: 5,
};

export function getHeroLimit(numPlayers: number): number {
  return HERO_LIMIT[numPlayers] ?? 7;
}

/** Current winning faction by marker positions, or null if none. */
export function getWinningFaction(red: number, green: number): string | null {
  const DARK_WAR = [9, 10, 11, 12];
  if (DARK_WAR.includes(red) && DARK_WAR.includes(green)) return "Undead";
  if (Math.abs(red - green) <= 1) return "Waterfolk";
  if (red >= green + 2) return "Imperials";
  if (green >= red + 2) return "Highlanders";
  return null;
}
