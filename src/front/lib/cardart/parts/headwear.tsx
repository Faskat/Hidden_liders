/**
 * Головні убори. Габарит x 20..80, y 0..26.
 *
 * Нижня межа саме 26, а не 32: убір малюється ПІСЛЯ обличчя (див. SLOT_ORDER),
 * а очі сидять на y 27..35 — крислатий капелюх, опущений нижче, просто закрив
 * би їх. Виняток — наносник шолома: він вузький і проходить між очима.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

const INK = 1.5;

/** Гострокутний капелюх мага: криси плюс конус. */
export const pointedHat: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M57 0 L66 19 L36 19 Z" fill={p.cloth} stroke={s} />
      <path d="M40 13 L60 13 L61 19 L39 19 Z" fill={p.trim} stroke={s} />
      <path d="M22 18 L78 18 L75 24 L25 24 Z" fill={p.clothShade} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M45 17 L50 4" />
          <path d="M52 17 L56 6" />
        </g>
      )}
    </g>
  );
};

/** Шолом із наносником: найпізнаваніший силует лицаря. */
export const helm: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M34 24 L35 15 L42 8 L58 8 L65 15 L66 24 Z" fill={p.metal} stroke={s} />
      <path d="M46 8 L50 1 L54 8 Z" fill={p.trim} stroke={s} />
      {/* Наносник проходить рівно між очима — тому єдиний опускається нижче 26. */}
      <path d="M47 22 L53 22 L52 34 L48 34 Z" fill={p.metal} stroke={s} />
      {lod >= 1 && <path d="M34 20 L66 20" stroke={p.metalShade} strokeWidth={1.4} fill="none" />}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M40 12 L38 22" />
          <path d="M60 12 L62 22" />
        </g>
      )}
    </g>
  );
};

/** Каптур: обрамляє обличчя з боків, лишаючи отвір під очі й рот. */
export const hood: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      {/* Гострий верх, інакше каптур читається як зачіска-каре. */}
      <path
        d="M50 2 L70 20 L71 46 L64 46 L64 22 L36 22 L36 46 L29 46 L30 20 Z"
        fill={p.cloth}
        stroke={s}
      />
      {lod >= 1 && <path d="M35 22 L65 22 L65 27 L35 27 Z" fill={p.clothShade} stroke="none" />}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M31 22 L31 44" />
          <path d="M69 22 L69 44" />
        </g>
      )}
    </g>
  );
};

/** Рогатий обруч: варвари й берсерки. */
export const horned: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M35 21 L27 10 L21 1 L31 8 L40 18 Z" fill={p.skinShade} stroke={s} />
      <path d="M65 21 L73 10 L79 1 L69 8 L60 18 Z" fill={p.skinShade} stroke={s} />
      <path d="M33 20 L67 20 L67 26 L33 26 Z" fill={p.clothShade} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M30 8 L34 16" />
          <path d="M70 8 L66 16" />
        </g>
      )}
    </g>
  );
};

/** Бандана: простолюд, пірати, робітники. */
export const bandana: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M35 24 L36 14 L50 9 L64 14 L65 24 Z" fill={p.cloth} stroke={s} />
      <path d="M65 20 L76 24 L72 30 L64 25 Z" fill={p.clothShade} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M42 13 L43 23" />
          <path d="M50 11 L50 23" />
          <path d="M58 13 L57 23" />
        </g>
      )}
    </g>
  );
};

/** Вузол волосся: шамани, мисливці, аскети. */
export const topknot: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M37 22 L38 15 L50 10 L62 15 L63 22 Z" fill={p.skinShade} stroke={s} />
      <path d="M46 10 L54 10 L56 2 L50 -2 L44 2 Z" fill={p.skinShade} stroke={s} />
      <path d="M45 8 L55 8 L55 12 L45 12 Z" fill={p.trim} stroke={s} strokeWidth={1} />
    </g>
  );
};

/** Крислатий капелюх: мандрівники, наглядачі, слідопити. */
export const wideBrim: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M38 18 L38 8 L50 3 L62 8 L62 18 Z" fill={p.cloth} stroke={s} />
      <path d="M18 18 L82 18 L78 25 L22 25 Z" fill={p.clothShade} stroke={s} />
      <path d="M38 14 L62 14 L62 18 L38 18 Z" fill={p.trim} stroke={s} strokeWidth={1} />
    </g>
  );
};

/**
 * Кістяна маска: Voodoo Witch.
 * Єдиний убір, що навмисно заходить на очі — маска й має їх закривати, тому
 * прорізи для очей намальовані прямо в ній.
 */
export const boneMask: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M38 12 L62 12 L65 24 L61 38 L50 44 L39 38 L35 24 Z" fill={p.skinShade} stroke={s} />
      <g fill={p.ink}>
        <path d="M41 24 L48 26 L47 32 L41 30 Z" />
        <path d="M59 24 L52 26 L53 32 L59 30 Z" />
        <path d="M47 36 L53 36 L52 41 L48 41 Z" />
      </g>
      <path d="M44 6 L47 14 L41 13 Z M56 6 L53 14 L59 13 Z" fill={p.trim} stroke={s} strokeWidth={1} />
    </g>
  );
};

/** Корона: лідери та Проклятий імператор. */
export const crown: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M35 18 L37 5 L43 13 L50 3 L57 13 L63 5 L65 18 Z" fill={p.trim} stroke={s} />
      <path d="M35 18 L65 18 L65 25 L35 25 Z" fill={p.trim} stroke={s} />
      {lod >= 1 && (
        <g fill={p.cloth}>
          <circle cx={41} cy={21.5} r={1.7} />
          <circle cx={50} cy={21.5} r={1.7} />
          <circle cx={59} cy={21.5} r={1.7} />
        </g>
      )}
    </g>
  );
};
