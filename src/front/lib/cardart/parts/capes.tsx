/**
 * Плащі. Малюються за фігурою, кріпляться до shoulderL/shoulderR (y=58).
 *
 * Оскільки плащ ззаду, з-під тіла видно лише його краї — тому він навмисно
 * ширший за торс, інакше його просто не буде видно.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

const INK = 1.5;

/** Короткий плащ до пояса. */
export const shortCloak: PartComponent = ({ p, lod }) => (
  <g strokeWidth={INK} strokeLinejoin="round">
    <path
      d="M31 54 L69 54 L82 98 L74 102 L50 94 L26 102 L18 98 Z"
      fill={p.clothShade}
      stroke={lod >= 1 ? p.ink : "none"}
    />
    {lod >= 2 && (
      <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.3}>
        <path d="M36 58 L28 96" />
        <path d="M64 58 L72 96" />
      </g>
    )}
  </g>
);

/** Довгий плащ до землі: лідери та джокер. */
export const longCape: PartComponent = ({ p, lod }) => (
  <g strokeWidth={INK} strokeLinejoin="round">
    <path
      d="M31 52 L69 52 L88 132 L78 136 L50 128 L22 136 L12 132 Z"
      fill={p.clothShade}
      stroke={lod >= 1 ? p.ink : "none"}
    />
    {lod >= 1 && <path d="M31 52 L69 52 L72 62 L28 62 Z" fill={p.trim} stroke={p.ink} />}
    {lod >= 2 && (
      <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.3}>
        <path d="M36 64 L24 130" />
        <path d="M64 64 L76 130" />
        <path d="M50 64 L50 126" />
      </g>
    )}
  </g>
);
