import type { CardSizeToken } from "@/lib/cardSizes";

/**
 * Наведення на карту для великого прев'ю.
 *
 * `anchor` — прямокутник самої карти у координатах вікна. Прев'ю ставиться
 * поруч із ним, а не в фіксований кут екрана: карти живуть у столі, який
 * рухається паном і зумом, тому єдина надійна позиція — та, що вимірюється в
 * момент наведення.
 */
export type HoverAnchor = { left: number; top: number; width: number; height: number };
export type HoverPayload = { cardId: string; isPlayed: boolean; anchor: HoverAnchor };
export type HoverHandler = (payload: HoverPayload | null) => void;

/**
 * Прямокутник елемента під курсором.
 *
 * Саме `getBoundingClientRect`, а не координати миші: карта на чужому місці
 * повернута на 90-180°, і прямокутник уже враховує поворот, а курсор — ні.
 */
export function hoverAnchor(el: Element): HoverAnchor {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Поворот панелі гравця цілком. */
export const POSITION_ROTATION: Record<string, string> = {
  bottom: "0deg",
  left: "90deg",
  top: "180deg",
  right: "-90deg",
  topLeft: "135deg",
  topRight: "-135deg",
};

/** Внутрішній поворот шапки, щоб нік читався з місця власника. */
export const CONTENT_INNER_ROTATION: Record<string, string> = {
  bottom: "0deg",
  left: "180deg",
  top: "180deg",
  right: "180deg",
  topLeft: "180deg",
  topRight: "180deg",
};

/** Додатковий поворот блоку карт усередині вже повернутої панелі. */
export const CARD_FACE_ROTATION: Record<string, string> = {
  bottom: "0deg",
  left: "180deg",
  top: "180deg",
  right: "90deg",
  topLeft: "90deg",
  topRight: "45deg",
};

/**
 * Розмір карт у руці залежно від місця.
 *
 * Своя рука велика, чужі — дрібні сорочки. Правило спільне для панелі гравця й
 * для шару польотів: політ мусить стартувати рівно тим розміром, яким карта
 * лежала в руці, інакше вона стрибне в перший же кадр анімації.
 */
export const handCardSize = (seat: string): CardSizeToken =>
  seat === "bottom" ? "xlarge" : "tiny";

/**
 * Розсадка за столом: місце гравця за його індексом у `viewPlayers`
 * (де нульовий — завжди сам глядач, унизу).
 *
 * Та сама розкладка, яку задають умови в розмітці столу; тут вона зібрана
 * таблицею, бо анімаціям потрібно швидко відповісти на питання «під яким кутом
 * лежать карти цього гравця», не читаючи DOM. Якщо розсадка колись зміниться —
 * міняти доведеться обидва місця, тому таблиця стоїть поруч із кутами повороту.
 */
export const SEAT_LAYOUT: Record<number, readonly string[]> = {
  2: ["bottom", "top"],
  3: ["bottom", "left", "right"],
  4: ["bottom", "left", "top", "right"],
  5: ["bottom", "left", "topLeft", "topRight", "right"],
  6: ["bottom", "left", "topLeft", "top", "topRight", "right"],
};

/**
 * Під яким кутом карта реально лежить на екрані — сума двох поворотів вище.
 *
 * Потрібно шару польотів: карта, що летить у панель ліворуч, має прибути
 * поверненою на 270°, інакше вона ляже впоперек цілі. Розкладати накопичену
 * матрицю трансформацій заради цього не треба — числа вже є тут, і саме вони
 * малюють дошку.
 */
export const CARD_TOTAL_ROTATION: Record<string, number> = {
  bottom: 0,
  left: 270,
  top: 0,
  right: 0,
  topLeft: 225,
  topRight: -90,
};

export const PHASE_STEPS = [
  { key: "PLAY", label: "Гра", description: "Зіграйте героя з руки на стіл або натисніть «Пропустити хід»." },
  { key: "DRAW", label: "Брати", description: "Візьміть 1 карту з гавані або з одного з слотів таверни." },
  { key: "DISCARD", label: "Скинути", description: "Скиньте зайві карти, щоб у руці залишилось не більше 3." },
  { key: "REFILL_TAVERN", label: "Поповнити таверну", description: "Заповніть порожні слоти таверни з колоди." },
];

/** Локалізовані назви фракцій. */
export const FACTION_LABEL: Record<string, string> = {
  Undead: "Невмерлі",
  Waterfolk: "Водний народ",
  Imperials: "Імперія",
  Highlanders: "Племена",
};

/** Кольорові стилі бейджів фракцій (Tailwind-класи). */
export const FACTION_STYLE: Record<string, string> = {
  Imperials: "bg-[var(--red)]/20 text-[var(--red)] border-[var(--red)]/40",
  Highlanders: "bg-[var(--green)]/20 text-[var(--green)] border-[var(--green)]/40",
  Waterfolk: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  Undead: "bg-[#2d2d2d] text-gray-300 border-gray-500/40",
};

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
