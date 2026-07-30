/**
 * Друга рука: щити тощо. Точка хвату handL (78,88), у межах x 50..98.
 *
 * Малюється ДО голови (див. SLOT_ORDER), тож не має заходити вище y≈60,
 * інакше перекриє плече й вухо.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

const INK = 1.5;

/** Каплеподібний щит. */
export const shield: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M62 64 L96 64 L95 88 Q79 108 63 88 Z" fill={p.metal} stroke={s} />
      <path d="M66 68 L92 68 L91 87 Q79 102 67 87 Z" fill={p.cloth} stroke="none" />
      <circle cx={79} cy={80} r={5} fill={p.trim} stroke={s} />
      {lod >= 1 && (
        <path d="M79 68 L79 96 M67 80 L91 80" stroke={p.metal} strokeWidth={1.6} fill="none" opacity={0.7} />
      )}
    </g>
  );
};
