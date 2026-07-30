/**
 * Тіла: торс і обидві руки одним куском. Плечі x 24..76 на y=58,
 * звуження до x 38..62 на y=96. Верх торса — плоский край від x=42 до x=58 на
 * y=50, інакше буде видно шов шиї.
 *
 * Руки навмисно винесені за силует торса й закінчуються долонями біля точок
 * хвату handR (22,88) і handL (78,88). Перша версія малювала рукави під торсом,
 * і фігури виходили безрукими — між рукою і тілом має лишатися просвіт фону.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

const INK = 1.5;

const ARM_L = "M37 56 L28 59 L20 82 L19 90 L27 91 L29 83 L40 65 Z";
const ARM_R = "M63 56 L72 59 L80 82 L81 90 L73 91 L71 83 L60 65 Z";

/** Долоні: без них рука обривається в нікуди. */
function Hands({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g fill={fill} stroke={stroke} strokeWidth={INK}>
      <circle cx={23} cy={89} r={4} />
      <circle cx={77} cy={89} r={4} />
    </g>
  );
}

/** Мантія: широкий розкльошений силует, рукави-дзвони. */
export const robe: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d={ARM_L} fill={p.clothShade} stroke={s} />
      <path d={ARM_R} fill={p.clothShade} stroke={s} />
      <Hands fill={p.skin} stroke={s} />
      <path d="M42 50 L58 50 L63 60 L68 96 L32 96 L37 60 Z" fill={p.cloth} stroke={s} />
      {lod >= 1 && (
        <path d="M50 52 L45 96 M50 52 L55 96" stroke={p.clothShade} strokeWidth={1.2} fill="none" opacity={0.8} />
      )}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M39 70 L36 94" />
          <path d="M43 72 L41 94" />
          <path d="M61 70 L64 94" />
          <path d="M57 72 L59 94" />
        </g>
      )}
    </g>
  );
};

/** Латний обладунок: наплічники, гранчастий нагрудник. */
export const plate: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d={ARM_L} fill={p.metalShade} stroke={s} />
      <path d={ARM_R} fill={p.metalShade} stroke={s} />
      <Hands fill={p.metal} stroke={s} />
      <path d="M42 50 L58 50 L65 60 L63 96 L37 96 L35 60 Z" fill={p.metal} stroke={s} />
      {/* Наплічники поверх торса — саме вони роблять силует лицаря впізнаваним. */}
      <path d="M24 60 L36 52 L42 62 L30 70 Z" fill={p.metal} stroke={s} />
      <path d="M76 60 L64 52 L58 62 L70 70 Z" fill={p.metal} stroke={s} />
      <path d="M36 74 L64 74 L63 82 L37 82 Z" fill={p.cloth} stroke={s} />
      {lod >= 1 && <path d="M50 56 L50 74" stroke={p.metalShade} strokeWidth={1.4} fill="none" />}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.4}>
          <path d="M42 62 L45 70" />
          <path d="M58 62 L55 70" />
          <path d="M38 86 L62 86" />
          <path d="M38 90 L62 90" />
        </g>
      )}
    </g>
  );
};

/** Шкіряний обладунок: вужчий торс, широкий пояс із пряжкою. */
export const leather: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d={ARM_L} fill={p.clothShade} stroke={s} />
      <path d={ARM_R} fill={p.clothShade} stroke={s} />
      <Hands fill={p.skin} stroke={s} />
      <path d="M42 50 L58 50 L63 60 L61 96 L39 96 L37 60 Z" fill={p.cloth} stroke={s} />
      <path d="M38 78 L62 78 L62 86 L38 86 Z" fill={p.skinShade} stroke={s} />
      <path d="M46 79 L54 79 L54 85 L46 85 Z" fill={p.trim} stroke={s} strokeWidth={1} />
      {lod >= 1 && (
        <path d="M42 52 L58 68" stroke={p.clothShade} strokeWidth={1.2} fill="none" opacity={0.9} />
      )}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M42 62 L42 76" />
          <path d="M58 62 L58 76" />
          <path d="M42 90 L58 90" />
        </g>
      )}
    </g>
  );
};

/** Огрядний торс: широкий живіт, короткі руки. */
export const bulky: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M35 58 L26 62 L18 82 L18 90 L27 92 L31 84 L40 68 Z" fill={p.clothShade} stroke={s} />
      <path d="M65 58 L74 62 L82 82 L82 90 L73 92 L69 84 L60 68 Z" fill={p.clothShade} stroke={s} />
      <g fill={p.skin} stroke={s}>
        <circle cx={23} cy={91} r={4.5} />
        <circle cx={77} cy={91} r={4.5} />
      </g>
      <path d="M42 50 L58 50 L70 62 L72 84 L66 96 L34 96 L28 84 L30 62 Z" fill={p.cloth} stroke={s} />
      <path d="M32 80 L68 80 L68 88 L32 88 Z" fill={p.skinShade} stroke={s} />
      <path d="M45 81 L55 81 L55 87 L45 87 Z" fill={p.trim} stroke={s} strokeWidth={1} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M40 62 L38 78" />
          <path d="M60 62 L62 78" />
        </g>
      )}
    </g>
  );
};

/** Сутула постать: голова подана вперед, спина горбиться. */
export const hunched: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M38 58 L30 62 L22 86 L21 93 L29 94 L33 86 L42 68 Z" fill={p.clothShade} stroke={s} />
      <path d="M64 60 L72 66 L79 86 L79 92 L71 93 L67 85 L60 70 Z" fill={p.clothShade} stroke={s} />
      <g fill={p.skin} stroke={s}>
        <circle cx={25} cy={93} r={4} />
        <circle cx={75} cy={92} r={4} />
      </g>
      {/* Горб вище лінії плечей — саме він читається як сутулість. */}
      <path d="M42 50 L58 50 L68 56 L66 70 L62 96 L38 96 L34 70 L34 58 Z" fill={p.cloth} stroke={s} />
      <path d="M56 52 L68 54 L70 66 L58 62 Z" fill={p.clothShade} stroke={s} />
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M40 70 L38 92" />
          <path d="M58 72 L60 92" />
        </g>
      )}
    </g>
  );
};

/** Грудна клітка: хребет, ребра, таз. Скелети. */
export const ribcage: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M39 57 L33 60 L24 84 L23 90 L28 91 L31 84 L41 66 Z" fill={p.skin} stroke={s} />
      <path d="M61 57 L67 60 L76 84 L77 90 L72 91 L69 84 L59 66 Z" fill={p.skin} stroke={s} />
      <circle cx={25} cy={90} r={3.6} fill={p.skin} stroke={s} />
      <circle cx={75} cy={90} r={3.6} fill={p.skin} stroke={s} />
      {/* Хребет заодно закриває шов шиї на x 44..56, y 50..54. */}
      <path d="M42 50 L58 50 L56 96 L44 96 Z" fill={p.skin} stroke={s} />
      <path d="M36 58 L64 58 L62 64 L38 64 Z" fill={p.skinShade} stroke={s} />
      <path d="M35 68 L65 68 L63 74 L37 74 Z" fill={p.skinShade} stroke={s} />
      <path d="M37 78 L63 78 L61 84 L39 84 Z" fill={p.skinShade} stroke={s} />
      <path d="M40 88 L60 88 L58 98 L42 98 Z" fill={p.skinShade} stroke={s} />
    </g>
  );
};

/** Панцир: черепахи й ракоподібні. */
export const shellBody: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d="M39 60 L31 64 L22 84 L21 90 L27 91 L31 84 L41 68 Z" fill={p.skinShade} stroke={s} />
      <path d="M61 60 L69 64 L78 84 L79 90 L73 91 L69 84 L59 68 Z" fill={p.skinShade} stroke={s} />
      <circle cx={24} cy={90} r={4} fill={p.skin} stroke={s} />
      <circle cx={76} cy={90} r={4} fill={p.skin} stroke={s} />
      <path d="M42 50 L58 50 L70 64 L68 88 L58 97 L42 97 L32 88 L30 64 Z" fill={p.metalShade} stroke={s} />
      {lod >= 1 && (
        <g fill={p.metal} stroke={s} strokeWidth={1}>
          <path d="M50 62 L58 67 L58 77 L50 82 L42 77 L42 67 Z" />
          <path d="M38 70 L42 72 L42 80 L37 82 L34 76 Z" />
          <path d="M62 70 L58 72 L58 80 L63 82 L66 76 Z" />
        </g>
      )}
    </g>
  );
};

/** Голий торс: м'язи й пов'язка на стегнах. Для звірів і берсерків. */
export const barechest: PartComponent = ({ p, lod }) => {
  const s = lod >= 1 ? p.ink : "none";
  return (
    <g strokeWidth={INK} strokeLinejoin="round">
      <path d={ARM_L} fill={p.skinShade} stroke={s} />
      <path d={ARM_R} fill={p.skinShade} stroke={s} />
      <Hands fill={p.skin} stroke={s} />
      <path d="M42 50 L58 50 L67 62 L64 84 L61 96 L39 96 L36 84 L33 62 Z" fill={p.skin} stroke={s} />
      {/* Пов'язка на стегнах: єдине, що тут є з тканини. */}
      <path d="M36 84 L64 84 L62 96 L38 96 Z" fill={p.cloth} stroke={s} />
      {lod >= 1 && (
        <g stroke={p.skinShade} fill="none" strokeWidth={1.3}>
          <path d="M43 64 L45 74 L50 76 L55 74 L57 64" />
          <path d="M50 76 L50 84" />
        </g>
      )}
      {lod >= 2 && (
        <g stroke={p.ink} fill="none" strokeWidth={0.9} opacity={0.35}>
          <path d="M60 66 L62 80" />
          <path d="M57 68 L59 80" />
          <path d="M44 88 L44 95" />
          <path d="M56 88 L56 95" />
        </g>
      )}
    </g>
  );
};
