"use client";

/**
 * Композитор арту карти.
 *
 * Малює фон фракції, поверх нього фігуру, зібрану з деталей за рецептом,
 * і зверху одну вуаль, що реагує на тему.
 *
 * `preserveAspectRatio="xMidYMid meet"` — фігура вписується цілком.
 *
 * Спершу тут стояв `slice`, і це була помилка розрахунку: арт-бокс на всіх
 * розмірах ширший, ніж вищий (наприклад 124×116 на xlarge), тож обрізка знизу
 * з'їдала все нижче y≈78 зі 140 — ноги не було видно взагалі на жодному розмірі.
 * З `meet` фігура вужча, зате видно її повністю, а порожнечу з боків заповнює
 * фон, навмисно намальований ширшим за viewBox.
 *
 * Усі трансформації належать композитору. Деталі лишаються чистими й нічого не
 * знають ні про дзеркало, ні про зріст — інакше контракт точок кріплення
 * розсипався б.
 */

import { memo } from "react";
import type { CardSizeToken } from "../cardSizes";
import { fnv1a } from "./hash";
import { spread } from "./color";
import { ART_LOD } from "./lod";
import { getLeaderPalette, getPalette } from "./palette";
import { recipeSlots, resolveRecipe } from "./recipe";
import { getPart } from "./registry";
import { ART_VIEWBOX, type Palette, type Slot } from "./types";

const { w: VW, h: VH } = ART_VIEWBOX;

/** Фон навмисно ширший за viewBox: із `meet` він має закрити поля з боків. */
const BG_X = -100;
const BG_W = VW + 200;

/** Слоти, що масштабуються разом із головою. */
const HEAD_GROUP: readonly Slot[] = ["head", "face", "headwear"];

/**
 * Композиційні відхилення карти. Усе рахується від хешу імені, тому однакове
 * на сервері й на клієнті — це та сама гарантія від розсинхрону гідратації,
 * що й у палітрі.
 */
function variationOf(artKey: string) {
  const h = fnv1a(`${artKey}:pose`);
  return {
    // Дзеркало міняє руку зі зброєю і напрямок морди — найдешевший спосіб
    // подвоїти видиме різноманіття, не малюючи жодної нової деталі.
    mirror: (h & 1) === 1,
    build: 1 + spread(h >> 1, 0.07),
    headScale: 1 + spread(h >> 5, 0.1),
    lift: spread(h >> 9, 3),
    // Легкий нахил: без нього 79 фігур стоять як солдати на плацу.
    lean: spread(fnv1a(`${artKey}:lean`), 4),
    horizon: 96 + spread(fnv1a(`${artKey}:sky`), 9),
    discX: 22 + ((fnv1a(`${artKey}:disc`) % 56)),
    discY: 20 + ((fnv1a(`${artKey}:discy`) % 18)),
    discR: 6 + ((fnv1a(`${artKey}:discr`) % 6)),
  };
}

type Variation = ReturnType<typeof variationOf>;

/**
 * Фон: плоскі прямокутники замість `<linearGradient>` — градієнту потрібен `id`,
 * а ідентифікатори заборонені: на екрані до 70 карт, і вони б зіткнулися.
 *
 * Лінія горизонту й диск світила зсуваються від карти до карти. Без цього всі
 * 18 карт фракції мали буквально однакову підкладку.
 */
function Background({ p, v }: { p: Palette; v: Variation }) {
  const band = v.horizon;
  return (
    <g>
      <rect x={BG_X} y={-40} width={BG_W} height={VH + 80} fill={p.bgFrom} />
      <circle cx={v.discX} cy={v.discY} r={v.discR} fill={p.glow} opacity={0.28} />
      {/* Смуги навмисно не доходять до повної непрозорості: інакше нижня
          третина карти ставала майже чорною і фігура тонула в ній. */}
      <rect x={BG_X} y={band - 34} width={BG_W} height={VH} fill={p.bgTo} opacity={0.28} />
      <rect x={BG_X} y={band - 14} width={BG_W} height={VH} fill={p.bgTo} opacity={0.5} />
      <rect x={BG_X} y={band + 8} width={BG_W} height={VH} fill={p.bgTo} opacity={0.7} />
    </g>
  );
}

export type CardArtProps = {
  /** Ім'я карти з каталогу — стабільний ключ арту. */
  artKey: string;
  faction?: string;
  size: CardSizeToken;
  /** Для лідерів: двофракційна палітра. */
  fraction1?: string;
  fraction2?: string;
};

export const CardArt = memo(function CardArt({
  artKey,
  faction,
  size,
  fraction1,
  fraction2,
}: CardArtProps) {
  const isLeader = Boolean(fraction1 || fraction2);
  const palette = isLeader
    ? getLeaderPalette(artKey, fraction1, fraction2)
    : getPalette(artKey, faction);
  const { lod, slots } = ART_LOD[size];
  const recipe = resolveRecipe(artKey, faction);
  const v = variationOf(artKey);

  const render = ([slot, id]: [Slot, string]) => {
    const Part = getPart(slot, id);
    if (!Part) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[cardart] невідома деталь ${slot}.${id} (карта «${artKey}»)`);
      }
      return null;
    }
    return <Part key={slot} p={palette} lod={lod} />;
  };

  const used = recipeSlots(recipe, slots);
  const backdrop = used.filter(([s]) => s === "backdrop");
  const beforeHead = used.filter(([s]) => s !== "backdrop" && !HEAD_GROUP.includes(s) && s !== "weapon" && s !== "fx");
  const headGroup = used.filter(([s]) => HEAD_GROUP.includes(s));
  const afterHead = used.filter(([s]) => s === "weapon" || s === "fx");

  // Масштаб фігури — навколо точки землі, щоб ноги лишались на місці.
  // Масштаб голови — навколо шиї, щоб голова не від'їхала від плечей.
  const sx = v.mirror ? -v.build : v.build;
  const figure = `translate(0 ${v.lift}) translate(50 138) rotate(${v.lean.toFixed(2)}) scale(${sx.toFixed(3)} ${v.build.toFixed(3)}) translate(-50 -138)`;
  const headTf = `translate(50 50) scale(${v.headScale.toFixed(3)}) translate(-50 -50)`;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="presentation"
      style={{ display: "block" }}
    >
      <Background p={palette} v={v} />
      {backdrop.map(render)}

      <g transform={figure}>
        {beforeHead.map(render)}
        <g transform={headTf}>{headGroup.map(render)}</g>
        {afterHead.map(render)}
      </g>

      {/* Вуаль теми — єдине, що тут реагує на світлу/темну тему. */}
      <rect x={BG_X} y={-40} width={BG_W} height={VH + 80} fill="var(--card-art-veil)" />
    </svg>
  );
});
