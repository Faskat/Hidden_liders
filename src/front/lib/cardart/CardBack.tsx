"use client";

/**
 * Рубашка карти.
 *
 * Одна на все: колода, закриті герої, закритий лідер. Окрема рубашка для лідера
 * видавала б «ось ця схована карта — лідер», тобто рівно ту інформацію, яку
 * гра ховає. Це правило гри, а не смак.
 *
 * Без тексту: гра україномовна, а безсловесна рубашка знімає і залежність від
 * перекладу, і мигтіння шрифту.
 */

import { memo } from "react";
import type { CardSizeToken } from "../cardSizes";
import { ART_VIEWBOX } from "./types";

const { w: VW, h: VH } = ART_VIEWBOX;

/** Той самий темно-синій, що вже захардкожений на столі, — щоб рубашка збіглася. */
export const CARD_BACK_FIELD = "#1e3a5f";
const GOLD = "#c9a227";

const CX = 50;
const CY = 70;
const R = 28;

/** Промінь троянди вітрів: вістря на радіусі R, основа завширшки 2·halfBase. */
function ray(angleDeg: number, r: number, halfBase: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const perp = a + Math.PI / 2;
  const tipX = CX + r * Math.cos(a);
  const tipY = CY + r * Math.sin(a);
  const b1x = CX + halfBase * Math.cos(perp);
  const b1y = CY + halfBase * Math.sin(perp);
  const b2x = CX - halfBase * Math.cos(perp);
  const b2y = CY - halfBase * Math.sin(perp);
  return `M${tipX.toFixed(2)} ${tipY.toFixed(2)}L${b1x.toFixed(2)} ${b1y.toFixed(2)}L${b2x.toFixed(2)} ${b2y.toFixed(2)}Z`;
}

/** Шість довгих променів через 60°, між ними шість коротких. */
const LONG_RAYS = [0, 1, 2, 3, 4, 5].map((i) => ray(-90 + i * 60, R, 4.6));
const SHORT_RAYS = [0, 1, 2, 3, 4, 5].map((i) => ray(-60 + i * 60, R * 0.55, 3));

/** Кутова дуга з відступом 12 від краю. */
function corner(x: number, y: number, sx: number, sy: number): string {
  return `M${x + 10 * sx} ${y}Q${x} ${y} ${x} ${y + 10 * sy}`;
}

/**
 * Малюнок один на всі розміри, без рівнів деталізації.
 *
 * Доти дрібні рубашки (чужа рука, лідер) губили кільця, короткі промені й кутові
 * дуги — на столі поруч опинялися дві різні сорочки, і закрита карта суперника
 * не збігалася з колодою гавані. Різні рубашки — це натяк, що карти різні, а
 * рівно цього гра й не має говорити.
 *
 * Коштує це небагато: композиція фіксована, і навіть повністю це 19 фігур —
 * менше, ніж у будь-якої відкритої карти з фігурою й фоном.
 */
export const CardBack = memo(function CardBack({ size: _size }: { size: CardSizeToken }) {
  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      role="presentation"
      style={{ display: "block" }}
    >
      <rect x={0} y={0} width={VW} height={VH} fill={CARD_BACK_FIELD} />

      <g fill="none" stroke={GOLD} opacity={0.35}>
        <circle cx={CX} cy={CY} r={36} strokeWidth={0.8} />
        <circle cx={CX} cy={CY} r={32} strokeWidth={0.8} />
        <g strokeWidth={1.2} strokeLinecap="round">
          <path d={corner(12, 12, 1, 1)} />
          <path d={corner(VW - 12, 12, -1, 1)} />
          <path d={corner(12, VH - 12, 1, -1)} />
          <path d={corner(VW - 12, VH - 12, -1, -1)} />
        </g>
      </g>

      {SHORT_RAYS.map((d, i) => <path key={`s${i}`} d={d} fill={GOLD} opacity={0.45} />)}
      {LONG_RAYS.map((d, i) => <path key={`l${i}`} d={d} fill={GOLD} opacity={0.85} />)}
      <circle cx={CX} cy={CY} r={5} fill={CARD_BACK_FIELD} stroke={GOLD} strokeWidth={1.4} />

      <rect x={0} y={0} width={VW} height={VH} fill="var(--card-art-veil)" />
    </svg>
  );
});
