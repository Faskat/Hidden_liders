/**
 * Рецепт карти: який набір деталей із неї збирається.
 *
 * Три шари, склеюються по слотах, перемагає пізніший:
 *
 *     FALLBACK  ←  deriveRecipe(name)  ←  OVERRIDES[name]
 *   (ніколи порожній)  (ключові слова)     (ручні правки)
 *
 * Ключ — ІМ'Я карти, а не card_id: `hero_0..hero_71` присвоюються за позицією
 * в масиві (`src/back/setup.py`) і поїдуть при перевпорядкуванні cards.json.
 *
 * Деградація безпечна: невідома карта отримає FALLBACK, невідомий id деталі —
 * порожній слот. Найгірший випадок — фон, ім'я і опис, тобто рівно та сама
 * карта, що була до появи арту.
 */

import { fnv1a } from "./hash";
import { deriveArchetype, deriveMood, type Archetype, type Mood } from "./keywords";
import type { CardRecipe, PartIdFor } from "./registry";
import { SLOT_ORDER, type Slot } from "./types";

const MOOD_FACE: Record<Mood, CardRecipe["face"]> = {
  angry: "faceAngry",
  sad: "faceSad",
  curious: "faceCurious",
  grim: "faceGrim",
  tired: "faceTired",
  smug: "faceSmug",
  wide: "faceWide",
  sly: "faceSly",
};

/** Набір допустимих деталей на слот. Конкретна обирається від хешу імені карти. */
type RecipeOptions = { [S in Slot]?: readonly (PartIdFor<S> | null)[] };

/**
 * Базовий вигляд архетипу — не один рецепт, а набір варіантів на кожен слот.
 *
 * Спершу тут стояло по одній деталі на слот, і всі 14 лицарів виглядали як одна
 * й та сама карта. Тепер лицар може бути в шоломі або бандані, з мечем або
 * списом, кремезний або звичайний — а архетип усе одно читається.
 *
 * Повтор значення в списку — це вага: `["sword", "spear", "sword"]` означає, що
 * меч трапляється удвічі частіше за спис.
 */
const BASE: Record<Archetype, RecipeOptions> = {
  caster: {
    body: ["robe", "robe", "hunched"],
    legs: ["robeSkirt"],
    head: ["human", "longHead", "bearded", "roundHead"],
    headwear: ["pointedHat", "pointedHat", "hood", "topknot", "wideBrim"],
    weapon: ["staff", "staff", "spear"],
    cape: ["shortCloak", null],
    fx: ["sparks"],
  },
  knight: {
    body: ["plate", "plate", "bulky"],
    legs: ["greaves"],
    head: ["human", "bearded", "longHead"],
    headwear: ["helm", "helm", "bandana"],
    weapon: ["sword", "sword", "spear"],
    offhand: ["shield", "shield", null],
    cape: ["shortCloak", null],
  },
  brute: {
    body: ["barechest", "bulky"],
    legs: ["boots", "furBoots"],
    head: ["human", "bearded", "roundHead"],
    headwear: ["horned", "bandana", "topknot"],
    weapon: ["axe", "club", "axe"],
  },
  rogue: {
    body: ["leather", "leather", "hunched"],
    legs: ["boots"],
    head: ["human", "longHead", "roundHead"],
    headwear: ["hood", "bandana", "wideBrim"],
    weapon: ["dagger", "bow", "dagger"],
    cape: ["shortCloak", null],
  },
  beast: {
    body: ["barechest", "bulky"],
    legs: ["clawFeet"],
    head: ["snout", "snout", "roundHead"],
    headwear: [null, null, "horned"],
    weapon: ["club", "axe", "club"],
  },
  bones: {
    body: ["robe", "ribcage"],
    legs: ["robeSkirt", "boneLegs"],
    head: ["skull", "skull", "longHead"],
    headwear: [null, "hood", "crown"],
    weapon: ["scythe", "scythe", "spear"],
  },
};

/** Кожен слот бере власний потік хешу — інакше вибори йшли б синхронно. */
function pickOptions(opts: RecipeOptions, artKey: string): CardRecipe {
  const out: CardRecipe = {};
  for (const slot of SLOT_ORDER) {
    const list = opts[slot] as readonly (string | null)[] | undefined;
    if (!list || list.length === 0) continue;
    const chosen = list[fnv1a(`${artKey}:${slot}`) % list.length];
    // @ts-expect-error слот і значення узгоджені за побудовою RecipeOptions
    out[slot] = chosen;
  }
  return out;
}

/** Фон закріплений за фракцією — це її «місце дії». */
const FACTION_BACKDROP: Record<string, CardRecipe["backdrop"]> = {
  Highlanders: "pines",
  Imperials: "banner",
  Undead: "tombstone",
  Waterfolk: "kelp",
};

const FALLBACK: CardRecipe = { body: "leather", legs: "boots", head: "human", face: "faceCurious" };

/** Ноги, які водний народ замінює хвостом. */
const WALKING_LEGS = new Set(["boots", "greaves", "clawFeet", "furBoots"]);

/**
 * Фракційний колорит поверх архетипу.
 *
 * Замінюємо лише те, що фракція справді змінює: водний народ ходить на хвості,
 * нежить має запалі обличчя. Тіло, зброя й убір лишаються від архетипу — інакше
 * усі 18 карт фракції злилися б в одну.
 */
function applyFactionTweaks(recipe: CardRecipe, faction: string | undefined): CardRecipe {
  const out = { ...recipe };
  if (faction) out.backdrop = FACTION_BACKDROP[faction] ?? out.backdrop;
  if (faction === "Waterfolk") {
    if (out.legs && WALKING_LEGS.has(out.legs)) out.legs = "finTail";
    if (out.head === "snout") out.head = "fishHead";
    out.fx = "bubbles";
  } else if (faction === "Undead") {
    if (out.head === "human") out.head = "gaunt";
    if (out.body === "barechest") out.body = "ribcage";
    if (out.legs && WALKING_LEGS.has(out.legs)) out.legs = "boneLegs";
    out.fx = "wisp";
  } else if (faction === "Highlanders") {
    if (out.legs === "boots") out.legs = "furBoots";
  }
  return out;
}

/**
 * Лідери. Їх лише шестеро, тож усі рецепти написані вручну — ключових слів у
 * їхніх іменах немає взагалі. Корона й довгий плащ спільні для всіх шести:
 * саме вони роблять лідера впізнаваним серед героїв.
 *
 * Двофракційність передає не рецепт, а палітра (`getLeaderPalette`) плюс фон
 * `throneSplit`: фігура однієї фракції в кольорах іншої.
 */
export const LEADER_RECIPES: Record<string, CardRecipe> = {
  Lemron: { backdrop: "throneSplit", cape: "longCape", legs: "robeSkirt", body: "plate", head: "human", face: "faceCurious", headwear: "crown", weapon: "sword" },
  Cyra: { backdrop: "throneSplit", cape: "longCape", legs: "robeSkirt", body: "robe", head: "human", face: "faceCurious", headwear: "crown", weapon: "staff" },
  Myrad: { backdrop: "throneSplit", cape: "longCape", legs: "robeSkirt", body: "robe", head: "gaunt", face: "faceAngry", headwear: "crown", weapon: "scythe" },
  Xiadul: { backdrop: "throneSplit", cape: "longCape", legs: "greaves", body: "plate", head: "gaunt", face: "faceAngry", headwear: "crown", weapon: "sword" },
  Pavyr: { backdrop: "throneSplit", cape: "longCape", legs: "greaves", body: "plate", head: "human", face: "faceCurious", headwear: "crown", weapon: "axe" },
  Enned: { backdrop: "throneSplit", cape: "longCape", legs: "finTail", body: "robe", head: "fishHead", face: "faceSad", headwear: "crown", weapon: "staff" },
};

const LEADER_FALLBACK: CardRecipe = {
  backdrop: "throneSplit", cape: "longCape", legs: "robeSkirt", body: "plate",
  head: "human", face: "faceCurious", headwear: "crown", weapon: "sword",
};

/**
 * Проклятий імператор. Визначається за `faction === "Joker"`, НІКОЛИ за іменем:
 * `getCardById` віддає для нього «Проклятий імператор», а каталог із проєкції —
 * «Deceased Emperor», тобто два кодові шляхи не сходяться в назві.
 */
const JOKER_RECIPE: CardRecipe = {
  backdrop: "throne", cape: "longCape", legs: "robeSkirt", body: "plate",
  head: "skull", face: null, headwear: "crown", weapon: null, fx: "wisp",
};

/** Ручні винятки: там, де ключове слово промахується або назва просить конкретики. */
export const OVERRIDES: Record<string, CardRecipe> = {
  // Назви, які просять буквальності.
  "Double Shielded Turtle": { head: "turtleHead", body: "shellBody", legs: "clawFeet", headwear: null, offhand: "shield", weapon: null },
  "Triple Sword Lizard": { head: "lizardHead", body: "leather", weapon: "swordTriple", headwear: null },
  "Half-headed Wizard": { head: "halfSkull", headwear: "pointedHat", weapon: "staff", face: "faceSad" },
  "Voodoo Witch": { headwear: "boneMask", weapon: "staff", fx: "sparks" },
  "Saber Tooth Troll": { head: "saberSnout" },
  "Clamped Krill Guard": { body: "shellBody", offhand: "shield" },

  // Звірі, яким пасує саме рептилія, а не загальна морда.
  "Leery Lizard": { head: "lizardHead" },
  "Furious Frog": { head: "lizardHead" },
  "Hopeful Salamander": { head: "lizardHead" },
  "Gorgeous Gorgon": { head: "lizardHead", headwear: null },

  // Рогаті звірі.
  "Half-eaten Bull": { headwear: "horned" },
  "Resurrected Ram": { headwear: "horned" },
  "Furious Pigman": { headwear: "horned" },

  // Оракул із щупальцями — усе-таки чаклун, а не звір.
  "Tentacled Oracle": { body: "robe", legs: "finTail", headwear: "hood", weapon: "staff", fx: "bubbles" },

  // Некромант і той, хто шепоче до круків, — обидва в каптурах.
  "Notorious Necromancer": { headwear: "hood", weapon: "staff", fx: "wisp" },
  "Raven Whisperer": { headwear: "hood", weapon: "staff" },
};

const cache = new Map<string, CardRecipe>();

export type ResolvedRecipe = {
  recipe: CardRecipe;
  archetype: Archetype;
  mood: Mood;
};

/** Тільки виведення, без кешу — потрібне галереї, щоб показати «чому саме так». */
export function deriveRecipe(artKey: string, faction?: string): ResolvedRecipe {
  const archetype = deriveArchetype(artKey);
  const mood = deriveMood(artKey);

  // Джокер — за фракцією, лідери — за іменем. Ключові слова до них не застосовні.
  if (faction === "Joker") return { recipe: JOKER_RECIPE, archetype, mood };
  if (faction === "Leader") {
    return { recipe: LEADER_RECIPES[artKey] ?? LEADER_FALLBACK, archetype, mood };
  }

  const recipe: CardRecipe = {
    ...applyFactionTweaks({ ...FALLBACK, ...pickOptions(BASE[archetype], artKey) }, faction),
    face: MOOD_FACE[mood],
    // Ручний виняток перебиває і архетип, і фракцію.
    ...OVERRIDES[artKey],
  };
  return { recipe, archetype, mood };
}

/** Рецепт для рендера. Ніколи не повертає undefined. */
export function resolveRecipe(artKey: string, faction?: string): CardRecipe {
  if (!artKey) return FALLBACK;
  const key = `${artKey}|${faction ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { recipe } = deriveRecipe(artKey, faction);
  cache.set(key, recipe);
  return recipe;
}

/** Слоти рецепта в порядку малювання, з відкинутими порожніми. */
export function recipeSlots(recipe: CardRecipe, allowed: readonly Slot[]): [Slot, string][] {
  const out: [Slot, string][] = [];
  for (const slot of allowed) {
    const id = recipe[slot];
    if (id) out.push([slot, id]);
  }
  return out;
}
