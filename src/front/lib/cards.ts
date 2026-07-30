/**
 * Card catalog for game board: heroes and leaders.
 * Prefers API catalog (state.cards) when provided; falls back to data/cards.json.
 */

import type { CardCatalogEntry } from "./types";
import cardsData from "@/data/cards.json";

export interface HeroCard {
  id: string;
  name: string;
  faction: string;
  ability_id?: string;
  red_delta: number;
  green_delta: number;
}

export interface LeaderCard {
  id: string;
  name: string;
  fraction_1: string;
  fraction_2: string;
  leader_number: number;
}

const heroesById = new Map<string, HeroCard>(
  ((cardsData as { heroes?: HeroCard[] }).heroes ?? []).map((h) => [h.id, h])
);

const leadersById = new Map<string, LeaderCard>(
  ((cardsData as { leaders?: LeaderCard[] }).leaders ?? []).map((l) => [l.id, l])
);

export function getHeroById(id: string): HeroCard | undefined {
  return heroesById.get(id);
}

export function getLeaderById(id: string): LeaderCard | undefined {
  return leadersById.get(id);
}

export interface CardDisplayInfo {
  name: string;
  faction?: string;
  /** Лише для лідерів: дві фракції, які вони поєднують. */
  fraction_1?: string;
  fraction_2?: string;
  red_delta?: number;
  green_delta?: number;
  hasMarkersOnly?: boolean;
}

/** Get card display info from API catalog. For entries with only markers (no red_delta/green_delta), returns hasMarkersOnly. */
export function getCardFromCatalog(
  catalog: Record<string, CardCatalogEntry> | undefined,
  cardId: string
): CardDisplayInfo | undefined {
  if (!catalog) return undefined;
  const c = catalog[cardId];
  if (!c) return undefined;
  const name = c.name ?? cardId.replace(/^hero_|^leader_/, "");
  if (c.fraction_1) {
    // Лідер: віддаємо обидві фракції — вони потрібні і для кольору, і для арту.
    return { name, faction: c.faction ?? "Leader", fraction_1: c.fraction_1, fraction_2: c.fraction_2 };
  }
  const hasMarkersOnly = Boolean(c.markers) && c.red_delta === undefined && c.green_delta === undefined;
  return {
    name,
    faction: c.faction,
    red_delta: c.red_delta,
    green_delta: c.green_delta,
    hasMarkersOnly,
  };
}

/** Resolve any card for display. Prefers catalog when provided; falls back to local data/cards.json. */
export function getCardById(
  id: string,
  catalog?: Record<string, CardCatalogEntry>
): CardDisplayInfo | undefined {
  const fromCatalog = catalog ? getCardFromCatalog(catalog, id) : undefined;
  if (fromCatalog) return fromCatalog;

  const hero = getHeroById(id);
  if (hero) {
    return {
      name: hero.name,
      faction: hero.faction,
      red_delta: hero.red_delta,
      green_delta: hero.green_delta,
    };
  }
  const leader = getLeaderById(id);
  if (leader) return { name: leader.name };
  if (id === (cardsData as { deceased_emperor_id?: string }).deceased_emperor_id) {
    return { name: "Проклятий імператор" };
  }
  return undefined;
}

/**
 * Єдине джерело кольору фракції: рамка карти, смуга фракції, бейджі.
 *
 * `Leader` і `Joker` — псевдофракції з каталогу бекенда (`setup.py`). Без них
 * лідер і Проклятий імператор малювалися нейтральним `var(--border)`.
 */
export const FACTION_COLORS: Record<string, string> = {
  Imperials: "var(--red)",
  Highlanders: "var(--green)",
  Waterfolk: "var(--faction-waterfolk)",
  Undead: "var(--faction-undead)",
  Leader: "var(--faction-leader)",
  Joker: "var(--faction-joker)",
};
