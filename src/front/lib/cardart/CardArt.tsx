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
 */

import { memo } from "react";
import type { CardSizeToken } from "../cardSizes";
import { ART_LOD } from "./lod";
import { getLeaderPalette, getPalette } from "./palette";
import { recipeSlots, resolveRecipe } from "./recipe";
import { getPart } from "./registry";
import { ART_VIEWBOX, type Palette } from "./types";

const { w: VW, h: VH } = ART_VIEWBOX;

/** Фон навмисно ширший за viewBox: із `meet` він має закрити поля з боків. */
const BG_X = -100;
const BG_W = VW + 200;

/**
 * Фон: чотири плоскі прямокутники замість `<linearGradient>`.
 * Градієнту потрібен `id`, а ідентифікатори заборонені — на екрані до 70 карт,
 * і вони б зіткнулися.
 */
function Background({ p }: { p: Palette }) {
  return (
    <g>
      <rect x={BG_X} y={-40} width={BG_W} height={VH + 80} fill={p.bgFrom} />
      <rect x={BG_X} y={63} width={BG_W} height={VH} fill={p.bgTo} opacity={0.4} />
      <rect x={BG_X} y={91} width={BG_W} height={VH} fill={p.bgTo} opacity={0.7} />
      <rect x={BG_X} y={112} width={BG_W} height={VH} fill={p.bgTo} />
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

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="presentation"
      style={{ display: "block" }}
    >
      <Background p={palette} />

      {recipeSlots(recipe, slots).map(([slot, id]) => {
        const Part = getPart(slot, id);
        if (!Part) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[cardart] невідома деталь ${slot}.${id} (карта «${artKey}»)`);
          }
          return null;
        }
        return <Part key={slot} p={palette} lod={lod} />;
      })}

      {/* Вуаль теми — єдине, що тут реагує на світлу/темну тему. */}
      <rect x={BG_X} y={-40} width={BG_W} height={VH + 80} fill="var(--card-art-veil)" />
    </svg>
  );
});
