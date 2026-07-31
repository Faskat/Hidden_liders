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
  // 80×112 — найчастіший розмір на столі (таверна, чужі партії). Додаємо ноги,
  // зброю й обличчя: саме силует зброї відрізняє мага від лицаря, а без очей і
  // рота герой читався як манекен — на цьому розмірі обличчя вже помітне.
  // Контуру ще нема: на 44px висоти арту він з'їдає деталі, а не додає їх.
  tiny:       { lod: 0, slots: ["legs", "body", "head", "face", "headwear", "weapon"] },
  // Зі 100×140 вмикаються контур, обличчя, плащ і щит — і декорація фракції.
  // Раніше вона починалася лише з `large`, бо малювалася за фігурою й на менших
  // картах перетворювалась на пляму. Тепер вона на шарі фону, коштує 2-4 шляхи
  // і працює як колірна мітка фракції вже на столі.
  small:      { lod: 1, slots: ["backdrop", ...FIGURE] },
  normal:     { lod: 1, slots: ["backdrop", ...FIGURE] },
  large:      { lod: 1, slots: ["backdrop", ...FIGURE] },
  // 160×224: усе плюс гравюрна штриховка.
  xlarge:     { lod: 2, slots: SLOT_ORDER },
  preview:    { lod: 2, slots: SLOT_ORDER },
};
