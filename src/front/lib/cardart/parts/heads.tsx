/**
 * Голови. Габарит x 30..70, y 8..50; знизу плоский край по x 44..56 на y=50.
 *
 * Риси обличчя тут НЕ малюються — за них відповідає слот `face`. Голова дає
 * лише форму черепа, тому будь-яке обличчя лягає на будь-яку голову.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

const INK = 1.5;

/** Людська голова: фасетований череп, без органічних кривих. */
export const human: PartComponent = ({ p, lod }) => (
  <g>
    <path
      d="M50 10 L61 15 L64 27 L62 38 L56 46 L56 50 L44 50 L44 46 L38 38 L36 27 L39 15 Z"
      fill={p.skin}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    {lod >= 2 && (
      <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
        <path d="M60 24 L62 33" />
        <path d="M57.5 25 L59.5 34" />
        <path d="M55 27 L57 35" />
      </g>
    )}
  </g>
);

/** Голий череп: та сама фасетка, але вужча, плюс окрема щелепа. */
export const skull: PartComponent = ({ p, lod }) => (
  <g>
    <path
      d="M50 11 L62 17 L65 29 L61 40 L57 44 L57 47 L43 47 L43 44 L39 40 L35 29 L38 17 Z"
      fill={p.skin}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    {/* Щелепа заодно закриває шов шиї на x 44..56, y=50. */}
    <path
      d="M41 46 L59 46 L57 53 L43 53 Z"
      fill={p.skinShade}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    {lod >= 2 && (
      <g stroke={p.ink} strokeWidth={0.9} opacity={0.55}>
        <path d="M46 47 L46 52 M50 47 L50 52 M54 47 L54 52" />
      </g>
    )}
  </g>
);

/** Звірина морда: витягнута вліво, з двома вухами. */
export const snout: PartComponent = ({ p, lod }) => (
  <g>
    {/* Вуха малюємо першими, щоб контур голови їх перекривав. */}
    <path
      d="M41 16 L36 5 L48 11 Z M59 17 L67 8 L66 20 Z"
      fill={p.skinShade}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    <path
      d="M45 12 L58 15 L64 26 L62 37 L57 43 L56 50 L44 50 L43 43 L34 41 L30 34 L39 29 L40 19 Z"
      fill={p.skin}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    <path d="M30 34 L36 31 L37 37 Z" fill={p.ink} opacity={0.8} />
    {lod >= 2 && (
      <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
        <path d="M39 30 L44 32" />
        <path d="M39 34 L44 35" />
        <path d="M40 38 L45 38" />
      </g>
    )}
  </g>
);
