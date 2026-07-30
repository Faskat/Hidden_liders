/**
 * Зброя. Тримається правою рукою — точка хвату handR (22,88), у межах x 2..50.
 *
 * Це найважливіші деталі в усій бібліотеці: на 80×112 контуру й обличчя вже
 * немає, і саме силует зброї відрізняє мага від лицаря.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

const INK = 1.5;

/** Посох із навершям: маги, шамани, жерці. */
export const staff: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M19 30 L25 30 L25 126 L19 126 Z" fill={p.metalShade} stroke={s} />
      <circle cx={22} cy={26} r={7} fill={p.trim} stroke={s} />
      {lod >= 1 && <circle cx={22} cy={26} r={3} fill={p.glow} stroke="none" />}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M19 50 L25 50" />
          <path d="M19 78 L25 78" />
          <path d="M19 104 L25 104" />
        </g>
      )}
    </g>
  );
};

/** Меч вістрям угору: лицарі. */
export const sword: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M22 28 L28 42 L28 80 L16 80 L16 42 Z" fill={p.metal} stroke={s} />
      <path d="M10 80 L34 80 L34 86 L10 86 Z" fill={p.trim} stroke={s} />
      <path d="M18 86 L26 86 L26 97 L18 97 Z" fill={p.metalShade} stroke={s} />
      <circle cx={22} cy={100} r={4} fill={p.trim} stroke={s} />
      {lod >= 1 && <path d="M22 34 L22 78" stroke={p.metalShade} strokeWidth={1.3} fill="none" />}
    </g>
  );
};

/** Двобічна сокира: варвари. Найширший силует із усієї зброї. */
export const axe: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M19 40 L25 40 L25 124 L19 124 Z" fill={p.metalShade} stroke={s} />
      <path d="M25 42 L40 38 L43 54 L34 64 L25 62 Z" fill={p.metal} stroke={s} />
      <path d="M19 42 L6 38 L3 54 L12 64 L19 62 Z" fill={p.metal} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M30 44 L38 44" />
          <path d="M14 44 L6 44" />
        </g>
      )}
    </g>
  );
};

/** Кинджал: розбійники й убивці. Навмисно короткий — контраст із мечем. */
export const dagger: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M22 56 L27 66 L27 82 L17 82 L17 66 Z" fill={p.metal} stroke={s} />
      <path d="M13 82 L31 82 L31 87 L13 87 Z" fill={p.trim} stroke={s} />
      <path d="M18 87 L26 87 L26 96 L18 96 Z" fill={p.metalShade} stroke={s} />
    </g>
  );
};

/**
 * Дубина: звірі. Груша нагорі й чітке держално.
 * Перша версія була просто трапецією на всю висоту і читалася як сіра плита —
 * силует дубини тримається саме на переході «товста голова → тонка ручка».
 */
export const club: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M19 62 L27 62 L26 106 L20 106 Z" fill={p.metalShade} stroke={s} />
      <path d="M12 42 L32 38 L35 58 L27 68 L16 66 L9 56 Z" fill={p.metalShade} stroke={s} />
      {lod >= 1 && (
        <g fill={p.ink} opacity={0.55}>
          <circle cx={16} cy={52} r={2.2} />
          <circle cx={27} cy={48} r={2.2} />
          <circle cx={22} cy={60} r={2.2} />
        </g>
      )}
    </g>
  );
};

/** Лук: стрільці. Найвужчий силует із усієї зброї, тому впізнається одразу. */
export const bow: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M30 28 Q6 62 30 118 Q18 62 30 28 Z" fill={p.metalShade} stroke={s} />
      <path d="M30 28 L30 118" stroke={p.trim} strokeWidth={1.4} fill="none" />
      <path d="M14 68 L44 68 L44 71 L14 71 Z" fill={p.metal} stroke={s} strokeWidth={1} />
    </g>
  );
};

/** Спис: вартові й списоносці. Найдовше древко, вістря аж угорі. */
export const spear: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M19 22 L25 22 L25 130 L19 130 Z" fill={p.metalShade} stroke={s} />
      <path d="M22 2 L30 20 L22 26 L14 20 Z" fill={p.metal} stroke={s} />
      <path d="M16 28 L28 28 L28 33 L16 33 Z" fill={p.trim} stroke={s} strokeWidth={1} />
    </g>
  );
};

/** Три клинки з однієї руків'я. Triple Sword Lizard — назва просить буквальності. */
export const swordTriple: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M8 34 L13 44 L13 78 L4 78 L4 44 Z" fill={p.metal} stroke={s} />
      <path d="M22 26 L27 38 L27 78 L17 78 L17 38 Z" fill={p.metal} stroke={s} />
      <path d="M36 34 L41 44 L41 78 L32 78 L32 44 Z" fill={p.metal} stroke={s} />
      <path d="M2 78 L43 78 L43 85 L2 85 Z" fill={p.trim} stroke={s} />
      <path d="M18 85 L26 85 L26 97 L18 97 Z" fill={p.metalShade} stroke={s} />
    </g>
  );
};

/** Коса: нежить. Півмісяць леза виносимо вліво, щоб силует не плутався з посохом. */
export const scythe: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M19 28 L25 28 L25 126 L19 126 Z" fill={p.metalShade} stroke={s} />
      <path d="M23 30 Q0 38 4 64 Q13 44 25 41 Z" fill={p.metal} stroke={s} />
      {lod >= 2 && <path d="M21 35 Q6 42 8 58" stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4} />}
    </g>
  );
};
