/**
 * Голови. Габарит x 30..70, y 8..50; знизу плоский край по x 44..56 на y=50.
 *
 * Риси обличчя тут НЕ малюються — за них відповідає слот `face`. Голова дає
 * лише форму черепа, тому будь-яке обличчя лягає на будь-яку голову.
 *
 * Звідси головна вимога до нової голови: вона мусить бути НЕПРОЗОРОЮ на всьому
 * вікні обличчя — очі x 41..59 / y 27..36 і рот x 45..55 / y 39..45 (див.
 * `faces.tsx`). Інакше брови й куточки рота вилізуть за контур.
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

/** Кругла, м'ясиста голова: товстуни й добряки. */
export const roundHead: PartComponent = ({ p, lod }) => (
  <g>
    <path
      d="M50 9 L63 15 L67 28 L64 40 L57 47 L57 50 L43 50 L43 47 L36 40 L33 28 L37 15 Z"
      fill={p.skin}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    {lod >= 1 && <path d="M42 44 Q50 50 58 44" fill="none" stroke={p.skinShade} strokeWidth={1.4} />}
    {lod >= 2 && (
      <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
        <path d="M63 26 L65 35" />
        <path d="M60 27 L62 36" />
      </g>
    )}
  </g>
);

/**
 * Вузька витягнута голова: сухорляві типи.
 *
 * Вилиці навмисно не звужуються раніше y=41: при спуску з y=40 ліве ребро на
 * рівні очей (y=36) заходило всередину до x=41.1 і крайній піксель ока лягав
 * просто на контур.
 */
export const longHead: PartComponent = ({ p, lod }) => (
  <g>
    <path
      d="M50 6 L59 13 L61 27 L59 41 L54 48 L54 50 L46 50 L46 48 L41 41 L39 27 L41 13 Z"
      fill={p.skin}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    {lod >= 2 && (
      <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
        <path d="M57 24 L59 34" />
        <path d="M44 44 L56 44" />
      </g>
    )}
  </g>
);

/** Голова з бородою: старійшини, ковалі, північани. */
export const bearded: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M50 10 L61 15 L64 27 L62 38 L56 46 L56 50 L44 50 L44 46 L38 38 L36 27 L39 15 Z" fill={p.skin} stroke={s} />
      {/* Борода нижче підборіддя — єдина деталь голови, що заходить на торс. */}
      <path d="M38 34 L40 46 L44 56 L50 60 L56 56 L60 46 L62 34 L58 44 L56 40 L44 40 L42 44 Z" fill={p.skinShade} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M45 46 L46 55" />
          <path d="M50 47 L50 57" />
          <path d="M55 46 L54 55" />
        </g>
      )}
    </g>
  );
};

/** Виснажене обличчя нежиті: вужче за людське, із загостреним підборіддям. */
export const gaunt: PartComponent = ({ p, lod }) => (
  <g>
    <path
      d="M50 10 L60 16 L62 28 L59 38 L54 47 L54 50 L46 50 L46 47 L41 38 L38 28 L40 16 Z"
      fill={p.skin}
      stroke={lod >= 1 ? p.ink : "none"}
      strokeWidth={INK}
      strokeLinejoin="round"
    />
    {lod >= 2 && (
      <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.45}>
        <path d="M42 30 L44 40" />
        <path d="M58 30 L56 40" />
        <path d="M46 44 L54 44" />
      </g>
    )}
  </g>
);

/** Риб'яча голова: спинний гребінь, зябра, морда вперед. */
export const fishHead: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M47 12 L49 1 L57 14 Z" fill={p.skinShade} stroke={s} />
      <path d="M46 12 L58 16 L64 28 L60 40 L56 46 L56 50 L44 50 L43 44 L34 40 L28 32 L34 23 L40 17 Z" fill={p.skin} stroke={s} />
      <path d="M28 32 L34 30 L34 36 Z" fill={p.ink} opacity={0.75} />
      {lod >= 1 && (
        <g stroke={p.skinShade} fill="none" strokeWidth={1.3}>
          <path d="M52 26 L52 38" />
          <path d="M56 26 L56 38" />
          <path d="M60 27 L60 37" />
        </g>
      )}
    </g>
  );
};

/** Голова ящера: витягнута морда й гребінь на потилиці. */
export const lizardHead: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M44 14 L46 3 L52 12 L58 5 L59 16 Z" fill={p.skinShade} stroke={s} />
      <path d="M44 14 L58 16 L64 26 L62 36 L57 43 L56 50 L44 50 L43 43 L32 40 L26 33 L36 27 L40 20 Z" fill={p.skin} stroke={s} />
      <path d="M26 33 L32 31 L32 37 Z" fill={p.ink} opacity={0.75} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M36 30 L44 32" />
          <path d="M36 35 L44 36" />
        </g>
      )}
    </g>
  );
};

/** Голова черепахи: маленька, на шиї, з дзьобом. */
export const turtleHead: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M46 22 L58 24 L63 32 L59 41 L56 46 L56 50 L44 50 L44 46 L42 41 L38 32 L40 26 Z" fill={p.skin} stroke={s} />
      <path d="M38 31 L29 34 L38 39 Z" fill={p.skinShade} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M46 44 L54 44" />
          <path d="M47 47 L53 47" />
        </g>
      )}
    </g>
  );
};

/** Півголови: ліва половина жива, права — голий череп. Half-headed Wizard. */
export const halfSkull: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M50 10 L50 50 L44 50 L44 46 L38 38 L36 27 L39 15 Z" fill={p.skin} stroke={s} />
      <path d="M50 10 L61 15 L64 27 L62 38 L56 46 L56 50 L50 50 Z" fill={p.skinShade} stroke={s} />
      {lod >= 1 && (
        <g stroke={p.ink} strokeWidth={0.9} opacity={0.5}>
          <path d="M52 46 L52 50 M55 46 L55 50 M58 45 L58 49" fill="none" />
        </g>
      )}
    </g>
  );
};

/** Морда з шаблезубими іклами. Saber Tooth Troll. */
export const saberSnout: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M41 16 L36 5 L48 11 Z M59 17 L67 8 L66 20 Z" fill={p.skinShade} stroke={s} />
      <path d="M45 12 L58 15 L64 26 L62 37 L57 43 L56 50 L44 50 L43 43 L34 41 L30 34 L39 29 L40 19 Z" fill={p.skin} stroke={s} />
      <path d="M30 34 L36 31 L37 37 Z" fill={p.ink} opacity={0.8} />
      <path d="M34 39 L32 52 L38 41 Z M41 40 L40 53 L45 42 Z" fill={p.metal} stroke={s} strokeWidth={1} />
    </g>
  );
};

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
