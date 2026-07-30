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
