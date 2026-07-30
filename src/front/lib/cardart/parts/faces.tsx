/**
 * Обличчя: лише очі й рот. Шар настрою, вмикається з розміру small.
 *
 * Настрій виводиться з прикметника в назві карти — «Furious», «Depressed»,
 * «Curious». Геометрія навмисно однакова для всіх голів: очі на y≈30 біля
 * x=43 і x=57, рот на y≈41. Тому будь-яке обличчя лягає на будь-яку голову,
 * а на черепі темні кутасті очі читаються як очниці.
 *
 * На LOD 0 обличчя не малюється взагалі: дві крапки по 1.5 одиниці на арті
 * висотою 46px — це шум, а неправильно прочитане обличчя гірше за відсутнє.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

/** Лють: брови до перенісся, очі вузькі, рот кутиками вниз. */
export const faceAngry: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <path d="M39 27 L47 31 L46 34 L39 32 Z" />
    <path d="M61 27 L53 31 L54 34 L61 32 Z" />
    <path d="M44 43 L50 41 L56 43 L56 45 L50 43.5 L44 45 Z" />
  </g>
);

/** Смуток: зовнішні кутики очей опущені, рот дугою вниз. */
export const faceSad: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <path d="M39 31 L46 28 L47 32 L40 34 Z" />
    <path d="M61 31 L54 28 L53 32 L60 34 Z" />
    <path d="M44 44 Q50 39 56 44 L56 42.5 Q50 37.5 44 42.5 Z" />
  </g>
);

/** Цікавість: круглі очі, ледь усміхнений рот. Стан за замовчуванням. */
export const faceCurious: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <path d="M43 27 L46 29 L46 33 L43 35 L40 33 L40 29 Z" />
    <path d="M57 27 L60 29 L60 33 L57 35 L54 33 L54 29 Z" />
    <path d="M44 41 Q50 46 56 41 L56 42.5 Q50 47.5 44 42.5 Z" />
  </g>
);

/** Похмурість: важкі брови, очі-щілини, прямий рот. */
export const faceGrim: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <path d="M38 25 L48 28 L48 30.5 L38 27.5 Z" />
    <path d="M62 25 L52 28 L52 30.5 L62 27.5 Z" />
    <path d="M40 31 L47 32 L47 34 L40 33 Z" />
    <path d="M60 31 L53 32 L53 34 L60 33 Z" />
    <path d="M43 43 L57 43 L57 45 L43 45 Z" />
  </g>
);

/** Втома: приспущені повіки, рот кутиком униз. */
export const faceTired: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <path d="M39 29 L47 29 L47 31 L39 31 Z" />
    <path d="M61 29 L53 29 L53 31 L61 31 Z" />
    <path d="M40 32 L46 32 L46 33.5 L40 33.5 Z" opacity={0.6} />
    <path d="M60 32 L54 32 L54 33.5 L60 33.5 Z" opacity={0.6} />
    <path d="M45 44 L56 42 L56 43.6 L45 45.6 Z" />
  </g>
);

/** Самовдоволення: одна брова вгору, кривий усміх. */
export const faceSmug: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <path d="M38 24 L48 26 L48 28 L38 26 Z" />
    <path d="M40 30 L46 31 L46 34 L40 33 Z" />
    <path d="M60 30 L54 31 L54 34 L60 33 Z" />
    <path d="M43 43 Q50 46 57 40 L57 41.8 Q50 48 43 44.8 Z" />
  </g>
);

/** Переляк: великі круглі очі, маленький округлий рот. */
export const faceWide: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <circle cx={43} cy={31} r={4} />
    <circle cx={57} cy={31} r={4} />
    <circle cx={44.2} cy={29.8} r={1.3} fill={p.skin} />
    <circle cx={58.2} cy={29.8} r={1.3} fill={p.skin} />
    <ellipse cx={50} cy={43.5} rx={3} ry={3.6} />
  </g>
);

/** Хитрість: примружені очі, довгий однобічний вищир. */
export const faceSly: PartComponent = ({ p }) => (
  <g fill={p.ink}>
    <path d="M39 32 Q43 27 47 31 Q43 30 39 32 Z" />
    <path d="M61 32 Q57 27 53 31 Q57 30 61 32 Z" />
    <path d="M42 42 L58 40 L58 41.8 L42 43.8 Z" />
    <path d="M56 39 L59 40.5 L57 42 Z" />
  </g>
);
