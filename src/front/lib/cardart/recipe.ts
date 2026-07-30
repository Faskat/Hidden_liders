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

import { deriveArchetype, deriveMood, type Archetype, type Mood } from "./keywords";
import type { CardRecipe } from "./registry";
import type { Slot } from "./types";

const MOOD_FACE: Record<Mood, CardRecipe["face"]> = {
  angry: "faceAngry",
  sad: "faceSad",
  curious: "faceCurious",
};

/**
 * Базовий вигляд архетипу. Розширюється з кожним етапом: убори та зброя
 * додаються, щойно з'являються відповідні деталі.
 */
const BASE: Record<Archetype, CardRecipe> = {
  caster: { body: "robe", legs: "robeSkirt", head: "human", headwear: "pointedHat", weapon: "staff" },
  knight: { body: "plate", legs: "greaves", head: "human", headwear: "helm", weapon: "sword", offhand: "shield" },
  brute: { body: "barechest", legs: "boots", head: "human", headwear: "horned", weapon: "axe" },
  rogue: { body: "leather", legs: "boots", head: "human", headwear: "hood", weapon: "dagger" },
  beast: { body: "barechest", legs: "clawFeet", head: "snout", headwear: null, weapon: "club" },
  bones: { body: "robe", legs: "robeSkirt", head: "skull", headwear: null, weapon: "scythe" },
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
  if (faction === "Waterfolk") {
    if (out.legs && WALKING_LEGS.has(out.legs)) out.legs = "finTail";
    if (out.head === "snout") out.head = "fishHead";
  } else if (faction === "Undead") {
    if (out.head === "human") out.head = "gaunt";
    if (out.body === "barechest") out.body = "ribcage";
    if (out.legs && WALKING_LEGS.has(out.legs)) out.legs = "boneLegs";
  } else if (faction === "Highlanders") {
    if (out.legs === "boots") out.legs = "furBoots";
  }
  return out;
}

/** Ручні винятки: там, де ключове слово промахується або назва просить конкретики. */
export const OVERRIDES: Record<string, CardRecipe> = {};

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
  const recipe: CardRecipe = {
    ...applyFactionTweaks({ ...FALLBACK, ...BASE[archetype] }, faction),
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
