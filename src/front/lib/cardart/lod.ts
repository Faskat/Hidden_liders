/**
 * Рівні деталізації.
 *
 * Визначаються токеном розміру, а не вимірюванням DOM: ні `ResizeObserver`,
 * ні layout-ефекту — отже нульовий ризик для гідратації.
 */

import type { CardSizeToken } from "../cardSizes";
import { SLOT_ORDER, type Lod, type Slot } from "./types";

/** Повний набір без фону — фон з'являється лише на великих картах. */
const FIGURE: readonly Slot[] = [
  "cape", "legs", "body", "offhand", "head", "face", "headwear", "weapon",
];

export type LodSpec = { lod: Lod; slots: readonly Slot[] };

export const ART_LOD: Record<CardSizeToken, LodSpec> = {
  // На 60×84 виживає лише силует: голова, убір, торс. ~6 вузлів DOM.
  graveyard:  { lod: 0, slots: ["body", "head", "headwear"] },
  leaderMini: { lod: 0, slots: ["body", "head", "headwear"] },
  // 80×112 — найчастіший розмір на столі. Додаємо ноги і зброю: саме силует
  // зброї відрізняє мага від лицаря на цьому розмірі. Контуру й обличчя ще нема.
  tiny:       { lod: 0, slots: ["legs", "body", "head", "headwear", "weapon"] },
  // Зі 100×140 вмикаються контур, обличчя, плащ і щит.
  small:      { lod: 1, slots: FIGURE },
  normal:     { lod: 1, slots: FIGURE },
  // На 130×182 з'являється фон — карта починає читатись як ілюстрація.
  large:      { lod: 1, slots: ["backdrop", ...FIGURE] },
  // 160×224: усе плюс гравюрна штриховка.
  xlarge:     { lod: 2, slots: SLOT_ORDER },
};
