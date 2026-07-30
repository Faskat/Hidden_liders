/**
 * Рушій арту карток: базовий контракт.
 *
 * Ключування арту йде за ІМЕНЕМ карти (`name` з каталогу), а не за `card_id`.
 * Ідентифікатори героїв `hero_0..hero_71` присвоює `src/back/setup.py` за
 * позицією в масиві — вони поїдуть при будь-якому перевпорядкуванні cards.json.
 * Усі 72 імені унікальні, тож саме вони є стабільним ключем.
 *
 * Наслідок, про який варто пам'ятати: якщо імена карт колись перекладуть
 * українською, рецепти доведеться перевести на окреме поле `art_key` у проєкції.
 */

import type { ReactElement } from "react";

/** Спільний холст усіх деталей. Пропорція 5:7, як у самої карти. */
export const ART_VIEWBOX = { w: 100, h: 140 } as const;

/**
 * Точки кріплення в одиницях холсту. Зафіксовані — деталі малюються відносно
 * них, тому зміна будь-якого числа тут зсуває всю бібліотеку.
 */
export const ANCHORS = {
  headTop:    { x: 50, y: 10 },
  brow:       { x: 50, y: 26 },
  headCenter: { x: 50, y: 30 },
  chin:       { x: 50, y: 46 },
  neck:       { x: 50, y: 50 },
  shoulderL:  { x: 30, y: 58 },
  shoulderR:  { x: 70, y: 58 },
  handR:      { x: 22, y: 88 },
  handL:      { x: 78, y: 88 },
  waist:      { x: 50, y: 96 },
  ground:     { x: 50, y: 138 },
} as const;

export type Slot =
  | "backdrop"
  | "cape"
  | "legs"
  | "body"
  | "offhand"
  | "head"
  | "face"
  | "headwear"
  | "weapon"
  | "fx";

/** Порядок малювання, ззаду наперед. */
export const SLOT_ORDER = [
  "backdrop",
  "cape",
  "legs",
  "body",
  "offhand",
  "head",
  "face",
  "headwear",
  "weapon",
  "fx",
] as const satisfies readonly Slot[];

export type Palette = {
  skin: string;
  skinShade: string;
  cloth: string;
  clothShade: string;
  metal: string;
  metalShade: string;
  /** Золото: облямівка, корони, оздоблення. */
  trim: string;
  /** Увесь контур і гравюрна штриховка. */
  ink: string;
  bgFrom: string;
  bgTo: string;
  /** Світіння ефектів і очей. */
  glow: string;
};

/**
 * Рівень деталізації.
 * 0 — плоский силует без контуру (дрібні карти).
 * 1 — плюс чернильний контур.
 * 2 — плюс гравюрна штриховка (лише найбільший розмір).
 */
export type Lod = 0 | 1 | 2;

export type PartProps = { p: Palette; lod: Lod };

/**
 * Деталь. Контракт, якого зобов'язана дотримуватись кожна:
 *
 * 1. Жодних `id`, `<defs>`, `url(#…)` — на екрані буває до 70 карт, і
 *    ідентифікатори зіткнуться. Тому плоскі двотонові матеріали замість градієнтів.
 * 2. Жодного `transform` на кореневому `<g>` — позиціює композитор.
 * 3. Жодних `className` — `lib/` поза `content`-globs Tailwind, класи вичистить purge.
 * 4. Кольори лише з `p`. Жодного літерального hex усередині деталі.
 * 5. Чиста функція: без хуків, `Math.random` і `Date`. Це гарантія від
 *    розсинхрону гідратації.
 * 6. Товщина ліній в одиницях холсту: 1.5 для контуру, 0.9–1.0 для штриховки.
 */
export type PartComponent = (props: PartProps) => ReactElement | null;
