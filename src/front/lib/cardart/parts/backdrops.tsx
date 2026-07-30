/**
 * Фони: сосни, знамено, надгробок, водорості, трон. Лише LOD >= 1.
 *
 * Малюються найпершими, одразу за заливкою фону, тому мусять бути стриманими:
 * їхня робота — дати фракції місце дії, а не сперечатися з фігурою. Звідси
 * низька непрозорість і кольори з фонової пари, а не з одягу.
 *
 * Фон навмисно ширший за viewBox (x від -40 до 140): композитор малює SVG у
 * режимі `meet`, і з боків лишаються поля, які теж треба заповнити.
 *
 * Контракт деталі — у ../types.ts. Коротко: жодних id, defs, transform на
 * кореневому <g>, className і літеральних кольорів. Тільки чисті функції.
 */

import type { PartComponent } from "../types";

/** Хвойний ліс: горяни. */
export const pines: PartComponent = ({ p }) => (
  <g fill={p.bgTo} opacity={0.45}>
    <path d="M-20 108 L-6 58 L8 108 Z" />
    <path d="M6 112 L20 70 L34 112 Z" />
    <path d="M66 112 L80 70 L94 112 Z" />
    <path d="M92 108 L106 58 L120 108 Z" />
  </g>
);

/** Знамено на держаку: імперія. */
export const banner: PartComponent = ({ p }) => (
  <g opacity={0.5}>
    <path d="M18 8 L82 8 L82 12 L18 12 Z" fill={p.bgTo} />
    <path d="M26 12 L74 12 L74 82 L50 70 L26 82 Z" fill={p.bgTo} />
    <path d="M38 26 L62 26 L62 34 L38 34 Z" fill={p.trim} opacity={0.7} />
  </g>
);

/** Надгробок: нежить. */
export const tombstone: PartComponent = ({ p }) => (
  <g opacity={0.5}>
    <path d="M24 122 L24 40 L34 26 L66 26 L76 40 L76 122 Z" fill={p.bgTo} />
    <path d="M44 44 L56 44 L56 56 L68 56 L68 66 L56 66 L56 92 L44 92 L44 66 L32 66 L32 56 L44 56 Z" fill={p.bgFrom} opacity={0.35} />
  </g>
);

/** Водорості: водний народ. */
export const kelp: PartComponent = ({ p }) => (
  <g stroke={p.bgTo} fill="none" strokeWidth={5} strokeLinecap="round" opacity={0.4}>
    <path d="M-4 140 Q6 108 -2 78 Q-8 56 2 34" />
    <path d="M16 140 Q26 112 18 88 Q12 70 20 52" />
    <path d="M84 140 Q74 112 82 88 Q88 70 80 52" />
    <path d="M104 140 Q94 108 102 78 Q108 56 98 34" />
  </g>
);

/** Трон: Проклятий імператор. */
export const throne: PartComponent = ({ p }) => (
  <g opacity={0.55}>
    <path d="M22 130 L22 24 L30 12 L70 12 L78 24 L78 130 Z" fill={p.bgTo} />
    <path d="M30 130 L30 30 L70 30 L70 130 Z" fill={p.bgFrom} opacity={0.3} />
    <path d="M14 60 L22 60 L22 130 L14 130 Z M86 60 L78 60 L78 130 L86 130 Z" fill={p.bgTo} />
  </g>
);

/**
 * Дві фракції по діагоналі: лідери.
 *
 * Кольори беруться з палітри лідера, де фон уже від fraction_1, а одяг — від
 * fraction_2, тож розділений трон показує обидві фракції без окремих пропів.
 */
export const throneSplit: PartComponent = ({ p }) => (
  <g>
    <path d="M-40 -20 L140 -20 L-40 160 Z" fill={p.bgFrom} opacity={0.55} />
    <path d="M140 -20 L140 160 L-40 160 Z" fill={p.cloth} opacity={0.4} />
    <path d="M22 130 L22 24 L30 12 L70 12 L78 24 L78 130 Z" fill={p.bgTo} opacity={0.45} />
  </g>
);
