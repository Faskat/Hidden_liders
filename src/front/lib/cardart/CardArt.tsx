"use client";

/**
 * Композитор арту карти.
 *
 * Малює фон фракції, поверх нього фігуру, зібрану з деталей за рецептом,
 * і зверху одну вуаль, що реагує на тему.
 *
 * `preserveAspectRatio="xMidYMin slice"` — обрізка йде знизу, тож голова завжди
 * в кадрі, а ноги зникають першими на низькому арт-боксі. Саме це дозволяє
 * одному холсту 100×140 обслуговувати і 47×64, і 124×112.
 */

import { memo } from "react";
import type { CardSizeToken } from "../cardSizes";
import { getLeaderPalette, getPalette } from "./palette";
import { ART_VIEWBOX, type Palette } from "./types";

const { w: VW, h: VH } = ART_VIEWBOX;

/**
 * Фон: чотири плоскі прямокутники замість `<linearGradient>`.
 * Градієнту потрібен `id`, а ідентифікатори заборонені — на екрані до 70 карт,
 * і вони б зіткнулися.
 */
function Background({ p }: { p: Palette }) {
  return (
    <g>
      <rect x={0} y={0} width={VW} height={VH} fill={p.bgFrom} />
      <rect x={0} y={63} width={VW} height={VH - 63} fill={p.bgTo} opacity={0.4} />
      <rect x={0} y={91} width={VW} height={VH - 91} fill={p.bgTo} opacity={0.7} />
      <rect x={0} y={112} width={VW} height={VH - 112} fill={p.bgTo} />
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
  fraction1,
  fraction2,
}: CardArtProps) {
  const isLeader = Boolean(fraction1 || fraction2);
  const palette = isLeader
    ? getLeaderPalette(artKey, fraction1, fraction2)
    : getPalette(artKey, faction);

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMin slice"
      width="100%"
      height="100%"
      role="presentation"
      style={{ display: "block" }}
    >
      <Background p={palette} />
      {/* Вуаль теми — єдине, що тут реагує на світлу/темну тему. */}
      <rect x={0} y={0} width={VW} height={VH} fill="var(--card-art-veil)" />
    </svg>
  );
});
