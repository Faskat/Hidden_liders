/**
 * Ноги. Габарит x 30..70, y 94..140; верх перекриває x 38..62 на y=96.
 *
 * Низ навмисно доходить до самого краю холсту: арт-бокс обрізає його знизу
 * (`xMidYMin slice`), і видимий шматок ніг залежить від розміру карти.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

const INK = 1.5;

/** Штани й чоботи: дві ноги, стопи назовні. */
export const boots: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M37 94 L48 94 L47 122 L45 122 L44 94 Z" fill={p.cloth} stroke={s} />
      <path d="M63 94 L52 94 L53 122 L55 122 L56 94 Z" fill={p.cloth} stroke={s} />
      <path d="M36 94 L48 94 L47 124 L48 134 L31 134 L34 124 Z" fill={p.clothShade} stroke={s} />
      <path d="M64 94 L52 94 L53 124 L52 134 L69 134 L66 124 Z" fill={p.clothShade} stroke={s} />
      {/* Халяви чобіт: темніший блок, який і читається на дрібних картах. */}
      <path d="M34 118 L48 118 L48 134 L31 134 Z" fill={p.ink} opacity={0.75} stroke={s} />
      <path d="M66 118 L52 118 L52 134 L69 134 Z" fill={p.ink} opacity={0.75} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M38 100 L38 114" />
          <path d="M62 100 L62 114" />
        </g>
      )}
    </g>
  );
};

/** Латні поножі: наколінники й металеві гомілки. */
export const greaves: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M37 94 L48 94 L47 116 L38 116 Z" fill={p.cloth} stroke={s} />
      <path d="M63 94 L52 94 L53 116 L62 116 Z" fill={p.cloth} stroke={s} />
      <path d="M36 112 L48 112 L48 122 L36 122 Z" fill={p.metal} stroke={s} />
      <path d="M64 112 L52 112 L52 122 L64 122 Z" fill={p.metal} stroke={s} />
      <path d="M37 120 L48 120 L48 132 L30 134 L34 124 Z" fill={p.metalShade} stroke={s} />
      <path d="M63 120 L52 120 L52 132 L70 134 L66 124 Z" fill={p.metalShade} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M38 126 L46 126" />
          <path d="M62 126 L54 126" />
        </g>
      )}
    </g>
  );
};

/** Пальцехідні лапи зі зворотним коліном і кігтями. */
export const clawFeet: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M38 94 L48 94 L46 110 L39 124 L47 129 L31 131 L33 116 Z" fill={p.skin} stroke={s} />
      <path d="M62 94 L52 94 L54 110 L61 124 L53 129 L69 131 L67 116 Z" fill={p.skin} stroke={s} />
      <g fill={p.ink} opacity={0.8}>
        <path d="M31 131 L25 136 L32 133 Z" />
        <path d="M36 131 L32 137 L39 133 Z" />
        <path d="M69 131 L75 136 L68 133 Z" />
        <path d="M64 131 L68 137 L61 133 Z" />
      </g>
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M40 100 L44 100" />
          <path d="M60 100 L56 100" />
        </g>
      )}
    </g>
  );
};

/** Поділ мантії: трапеція до землі, ніг не видно. */
export const robeSkirt: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M36 94 L64 94 L74 132 L26 132 Z" fill={p.cloth} stroke={s} />
      <path d="M26 132 L74 132 L75 138 L25 138 Z" fill={p.clothShade} stroke={s} />
      {lod >= 1 && (
        <g stroke={p.clothShade} fill="none" strokeWidth={1.2} opacity={0.9}>
          <path d="M44 96 L40 131" />
          <path d="M56 96 L60 131" />
        </g>
      )}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.3}>
          <path d="M33 108 L30 131" />
          <path d="M67 108 L70 131" />
          <path d="M50 100 L50 131" />
        </g>
      )}
    </g>
  );
};
