/**
 * Виведення архетипу й настрою з назви карти.
 *
 * Назви героїв — це готовий опис зовнішності: іменник каже, хто це
 * («Sharpshooter», «Necromancer», «Turtle»), прикметник — з яким виразом
 * обличчя («Furious», «Depressed», «Curious»). Тому рецепт не треба писати
 * руками для кожної з 72 карт: маленька таблиця ключових слів покриває всі.
 *
 * Перевірено на реальному каталозі: 72/72 героїв розкладаються на архетипи,
 * настрій промахується на шести — вони в MOOD_OVERRIDES нижче.
 */

export type Archetype = "bones" | "caster" | "beast" | "knight" | "rogue" | "brute";
export type Mood = "angry" | "sad" | "curious" | "grim" | "tired" | "smug" | "wide" | "sly";

/**
 * ПОРЯДОК ВАЖИТЬ — спрацьовує перший збіг, тому це масив, а не об'єкт:
 * на порядок ключів об'єкта закладатися не можна.
 *
 * `bones` мусить іти раніше за `knight`, інакше Wrapped Warrior стане лицарем.
 * `beast` — раніше за `knight`, інакше Vegetarian Sharkguard стане лицарем.
 */
export const ARCHETYPE_KEYWORDS: readonly (readonly [Archetype, readonly string[]])[] = [
  ["bones", ["skeleton", "bony", "mummy", "bone", "wrapped"]],
  ["caster", [
    "wizard", "witch", "shaman", "druid", "oracle", "priest", "priestess", "preacher",
    "voodoo", "necromancer", "mystic", "sage", "scholar", "whisperer", "hermit", "bard",
    "granny",
  ]],
  ["beast", [
    "troll", "goblin", "pigman", "cat", "bull", "ram", "gorgon", "lizard", "frog",
    "salamander", "eel", "blowfish", "krill", "shark", "whale", "turtle",
    "slimemonster", "raven", "tentacled",
  ]],
  ["knight", [
    "knight", "cavalier", "guard", "soldier", "squire", "warrior", "rearguard",
    "battle maid", "quartermaster", "chief", "honorguard",
  ]],
  ["rogue", [
    "assassin", "deserter", "mercenary", "loner", "handler", "fighter", "impaler",
    "sharpshooter",
  ]],
  ["brute", [
    "barbarian", "viking", "executioner", "northman", "tribesman", "monsterslayer",
    "connoisseur", "keeper", "target practice", "fishman", "whaleman",
  ]],
];

/**
 * Прикметник у назві — це вираз обличчя.
 *
 * Спершу настроїв було три, і 72 герої дивилися одним із трьох поглядів. Вісім
 * дають вже помітну різницю, а слова в назвах їх покривають без натяжок:
 * «Groggy» — це не сум, а втома, «Insidious» — не лють, а хитрість.
 *
 * Порядок списків = пріоритет: перший збіг виграє.
 */
const MOOD_WORDS: readonly (readonly [Mood, readonly string[]])[] = [
  ["angry", ["furious", "angry", "hangry", "bludgeoning", "spirited"]],
  ["grim", ["intimidating", "fearsome", "nightmarish", "ghastly", "righteous", "notorious", "wrapped"]],
  ["sly", ["insidious", "will-bending", "voodoo", "underestimated", "underpaid", "apish", "whiskered"]],
  ["smug", ["ace", "gorgeous", "queer", "modest", "resilient", "well-aged", "androgynous"]],
  ["tired", ["groggy", "sluggish", "apathetic", "bored", "aimless", "half-eaten", "unconfident", "drowned"]],
  ["wide", ["shaky", "leery", "sun-shy", "short-sighted", "flailing", "half-headed", "doubtful"]],
  ["sad", ["depressed", "joyless", "pessimistic", "bony", "canned"]],
  ["curious", ["curious", "dreamy", "hopeful", "familiar", "long-eared", "deep sea", "tentacled"]],
];

/** Шість карт, де прикметник нічого не каже про настрій. */
export const MOOD_OVERRIDES: Record<string, Mood> = {
  "Battle Connoisseur": "curious",
  "Bony Target Practice": "sad",
  "Mummy Mystic": "curious",
  "Wrapped Warrior": "angry",
  "Drowned Deserter": "sad",
  "Voodoo Witch": "angry",
};

/** null = жодне ключове слово не збіглося. Галерея рахує саме такі промахи. */
export function matchArchetype(name: string): Archetype | null {
  const n = name.toLowerCase();
  for (const [archetype, words] of ARCHETYPE_KEYWORDS) {
    if (words.some((w) => n.includes(w))) return archetype;
  }
  return null;
}

/** null = ні прикметник, ні ручний виняток нічого не сказали про настрій. */
export function matchMood(name: string): Mood | null {
  const forced = MOOD_OVERRIDES[name];
  if (forced) return forced;
  const n = name.toLowerCase();
  for (const [mood, words] of MOOD_WORDS) {
    if (words.some((w) => n.includes(w))) return mood;
  }
  return null;
}

export function deriveArchetype(name: string): Archetype {
  return matchArchetype(name) ?? "rogue";
}

export function deriveMood(name: string): Mood {
  return matchMood(name) ?? "curious";
}
