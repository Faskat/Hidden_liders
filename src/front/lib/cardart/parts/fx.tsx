/**
 * Ефекти: іскри, пузирі, дим. Малюються найостаннішими, поверх усього.
 *
 * Розкидані навмисно асиметрично й лише по краях — по центру вони заважали б
 * читати обличчя й зброю.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

/** Чотирипроменева іскра. */
function spark(x: number, y: number, r: number): string {
  const t = r * 0.28;
  return `M${x} ${y - r} L${x + t} ${y - t} L${x + r} ${y} L${x + t} ${y + t} L${x} ${y + r} L${x - t} ${y + t} L${x - r} ${y} L${x - t} ${y - t} Z`;
}

/** Іскри магії: маги й відьми. */
export const sparks: PartComponent = ({ p }) => (
  <g fill={p.glow} opacity={0.85}>
    <path d={spark(14, 40, 6)} />
    <path d={spark(30, 22, 4)} />
    <path d={spark(84, 54, 5)} />
    <path d={spark(72, 32, 3)} />
  </g>
);

/** Пузирі: водний народ. */
export const bubbles: PartComponent = ({ p }) => (
  <g fill="none" stroke={p.glow} strokeWidth={1.4} opacity={0.7}>
    <circle cx={16} cy={54} r={5} />
    <circle cx={26} cy={36} r={3} />
    <circle cx={86} cy={64} r={4.5} />
    <circle cx={78} cy={44} r={2.5} />
    <circle cx={90} cy={92} r={3} />
  </g>
);

/** Примарний серпанок: нежить. */
export const wisp: PartComponent = ({ p }) => (
  <g fill={p.glow} opacity={0.4}>
    <path d="M10 96 Q18 76 12 58 Q24 74 20 96 Z" />
    <path d="M88 100 Q80 82 86 64 Q74 80 78 100 Z" />
    <circle cx={16} cy={50} r={3.5} />
    <circle cx={84} cy={56} r={3} />
  </g>
);
