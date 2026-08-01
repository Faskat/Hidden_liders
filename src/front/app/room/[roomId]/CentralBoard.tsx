"use client";

import { useEffect, useRef, useState } from "react";
import type { GameStateView } from "@/lib/types";
import { useCardsCatalog } from "@/app/contexts/CardsCatalogContext";
import { GameCard } from "./Card";
import { CardBack, CARD_BACK_FIELD } from "@/lib/cardart/CardBack";
import { CARD_SIZES } from "@/lib/cardSizes";
import { hoverAnchor, type HoverHandler } from "./constants";

/** Клітинки треку сили: 1-8 звичайні, 9-12 — зона війни. */
const TRACK_CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Землі вздовж треку.
 *
 * Трек іде від води до цвинтаря: 1-4 — володіння Водного народу, 5-6 —
 * передгір'я Племен, 7-8 — імперське місто, 9-12 — зона війни, яку тримають
 * Невмерлі. Кожна ділянка має власну фактуру, а не лише відтінок: у темній темі
 * кольори зближуються, а штриховка лишається різною.
 */
function landOf(n: number): "water" | "mid" | "dead" {
  if (n <= 4) return "water";
  if (n <= 8) return "mid";
  return "dead";
}

type Land = ReturnType<typeof landOf>;

const LAND_TITLE: Record<Land, string> = {
  water: "Океан і гавань — Водний народ",
  mid: "Ліси Племен над містом Імперії",
  dead: "Зона війни — Невмерлі",
};

/**
 * Повні імена класів таблицею, а не `power-cell--${land}`.
 *
 * Tailwind шукає у вихідному коді саме повні імена й вичищає з `@layer
 * components` усе, чого не знайшов, — склеєний рядок він не бачить. Уперше на
 * ці граблі проєкт наступив із `line-clamp-${n}`.
 */
const LAND_CLASS: Record<Land, string> = {
  water: "power-cell--water",
  mid: "power-cell--mid",
  dead: "power-cell--dead",
};

/** Габарит жетона на треку: клітинка тепер 75px, і жетон росте разом із нею. */
const TOKEN_PX = 50;

/**
 * Краєвид треку — одна картина на всі дванадцять клітинок.
 *
 * Доти кожна клітинка малювала власну сцену, і на стиках земель дві різні
 * картинки доводилося зводити прозорими смугами. Виходив саме перехід між
 * картинками, а не місцевість: обрій, берегова лінія й лінія забудови в
 * сусідніх клітинках не збігалися, бо їх ніхто й не збігав.
 *
 * Тут один пейзаж на всю дошку: море ліворуч, гавань на березі, лісова тераса
 * над імперським містом, руїни й цвинтар праворуч. Клітинки лягають зверху
 * сіткою, і межа земель проходить там, де її малює сам пейзаж, а не там, де
 * закінчується клітинка.
 *
 * `preserveAspectRatio="none"` нічого не спотворює: 600×150 одиниць лягають на
 * 900×225 пікселів, тобто рівно ×1.5 по обох осях. Рівність тримається на тому,
 * що клітинка має 75×225 при 50×150 одиниць — змінивши одне, треба поправити й
 * друге.
 *
 * `id` у градієнтах тут безпечні: трек на сторінці один. Для деталей арту карт
 * правило зворотне — там до сімдесяти копій того самого малюнка, і `id` вони
 * розділили б між собою.
 */
const TRACK_W = 600;
const TRACK_H = 150;
/** Лінія обрію: вище — небо, нижче — море й суходіл. */
const HORIZON = 44;
/** Верх підпірної стіни: над нею ліс Племен, під нею місто Імперії. */
const TERRACE = 82;

const WOOD = "#7a5334";
const LEAF = "#4d7c3a";
const LEAF_DARK = "#2f5a26";
const ROOF = "#b8604c";
const WALL = "#e0cfae";
const STONE = "#9a9385";
const FOAM = "#e8f4fa";
const SAND = "#ddc9a3";
const RUIN = "#6f6a7d";

/**
 * Берегова лінія — один шлях, від якого залежить усе на стику моря й суходолу.
 *
 * Море, піщана смуга й нижня тераса міста сходяться саме по ньому, тому крива
 * винесена в константу: розійшовшись на одиницю, вони дали б наскрізну щілину.
 */
const COAST_DOWN = "C190 68 178 96 150 150";
const COAST_UP = "C178 96 190 68 196 44";
/** Де берег перетинає лінію тераси — порахована по самій кривій точка. */
const COAST_AT_TERRACE = 183;

/** Хвойний ліс верхньої тераси: [x основи, висота]. */
const PINES: readonly (readonly [number, number])[] = [
  [208, 30], [221, 24], [234, 33], [247, 26], [260, 31], [274, 23],
  [287, 32], [300, 27], [356, 26], [369, 31], [382, 25], [395, 29],
  [408, 23], [421, 27],
];

/** Сухостій на сході: у зоні війни від дерев лишилися самі стовбури. */
const SNAGS: readonly number[] = [432, 458, 484, 512, 540, 568, 594];

/**
 * Місто: [x, ширина, висота]. Задній ряд стоїть на терасі, передній — нижче.
 *
 * Забудова обривається біля x=424, тобто на початку клітинки 9: далі йде зона
 * війни, і будинки в ній уже мають бути руїнами. Проміжок 316-350 порожній —
 * там стоїть замок.
 */
const CITY_BACK: readonly (readonly [number, number, number])[] = [
  [206, 22, 26], [230, 18, 21], [250, 24, 29], [276, 19, 23],
  [297, 23, 27], [352, 18, 22], [372, 22, 28], [398, 18, 21],
];
const CITY_FRONT: readonly (readonly [number, number, number])[] = [
  [200, 26, 30], [228, 22, 25], [252, 28, 33], [282, 23, 27],
  [307, 27, 31], [352, 22, 26], [376, 26, 32], [404, 20, 24],
];

/** Руїни: ті самі будинки, але без дахів і з обваленим верхом. */
const RUINS: readonly (readonly [number, number, number])[] = [
  [418, 22, 24], [446, 17, 16], [470, 25, 29], [502, 19, 20],
  [528, 23, 24], [556, 20, 22], [584, 16, 18],
];

/** Надгробки: [x, ширина, висота]. */
const GRAVES: readonly (readonly [number, number, number])[] = [
  [440, 10, 13], [466, 12, 16], [498, 10, 13], [524, 13, 18],
  [552, 9, 12], [580, 12, 16],
];

/** Хвиля з періодом 24 одиниці, обрізана там, де починається берег. */
function wave(y: number, until: number): string {
  let d = `M0 ${y}`;
  for (let x = 0; x + 24 <= until; x += 24) d += "q6 -3 12 0t12 0";
  return d;
}

function House({ x, w, h, base }: { x: number; w: number; h: number; base: number }) {
  return (
    <g>
      <rect x={x} y={base - h} width={w} height={h} fill={WALL} />
      <path
        d={`M${x - 3} ${base - h}L${x + w / 2} ${base - h - w * 0.42}L${x + w + 3} ${base - h}Z`}
        fill={ROOF}
      />
      <rect x={x + w / 2 - 2} y={base - h + 6} width="4" height="6" fill={WOOD} opacity="0.55" />
    </g>
  );
}

/** Хатина на дереві — те, за чим ліс Племен і впізнається. */
function TreeHut({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y="56" width="17" height="12" fill={WOOD} />
      <path d={`M${x - 3} 56L${x + 8.5} 46L${x + 20} 56Z`} fill={ROOF} />
      <rect x={x + 6} y="60" width="5" height="8" fill={LEAF_DARK} />
      <g stroke={WOOD} strokeWidth="1.3">
        <path
          d={`M${x + 4} 68v${TERRACE - 68}M${x + 11} 68v${TERRACE - 68}M${x + 4} 72h7M${x + 4} 77h7`}
        />
      </g>
    </g>
  );
}

function TrackPanorama() {
  return (
    <svg
      className="power-track-scene"
      viewBox={`0 0 ${TRACK_W} ${TRACK_H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="hl-trk-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={TRACK_W} y2="0">
          <stop offset="0" stopColor="#c3dcea" />
          <stop offset="0.3" stopColor="#cfe1e6" />
          <stop offset="0.52" stopColor="#e6d6bb" />
          <stop offset="0.7" stopColor="#b3a3a6" />
          <stop offset="0.86" stopColor="#6c6478" />
          <stop offset="1" stopColor="#413c50" />
        </linearGradient>
        <linearGradient id="hl-trk-sea" gradientUnits="userSpaceOnUse" x1="0" y1={HORIZON} x2="0" y2={TRACK_H}>
          <stop offset="0" stopColor="#7ab6d2" />
          <stop offset="0.45" stopColor="#4a90b8" />
          <stop offset="1" stopColor="#2a688f" />
        </linearGradient>
        {/* Зелень має згаснути до x=430, тобто до початку клітинки 9: далі
            йде зона війни. Тому перелом у градієнтах припадає на 0.5-0.7, а не
            на самий кінець — інакше трава доживала б до одинадцятої клітинки. */}
        <linearGradient id="hl-trk-grass" gradientUnits="userSpaceOnUse" x1="180" y1="0" x2={TRACK_W} y2="0">
          <stop offset="0" stopColor="#bcd9a0" />
          <stop offset="0.34" stopColor="#a8cf8a" />
          <stop offset="0.52" stopColor="#8aa878" />
          <stop offset="0.68" stopColor="#5a5b63" />
          <stop offset="1" stopColor="#484257" />
        </linearGradient>
        <linearGradient id="hl-trk-ground" gradientUnits="userSpaceOnUse" x1="150" y1="0" x2={TRACK_W} y2="0">
          <stop offset="0" stopColor="#dbc9a6" />
          <stop offset="0.33" stopColor="#cbb894" />
          <stop offset="0.55" stopColor="#a3958a" />
          <stop offset="0.7" stopColor="#4c4557" />
          <stop offset="1" stopColor="#36314a" />
        </linearGradient>
        {/* Сутінки над сходом: один шар на всю картину замість зведення двох
            картинок. Саме він робить зону війни зоною війни, а не окремим
            малюнком, приклеєним до міста. */}
        <linearGradient id="hl-trk-dusk" gradientUnits="userSpaceOnUse" x1="368" y1="0" x2="520" y2="0">
          <stop offset="0" stopColor="#2b2636" stopOpacity="0" />
          <stop offset="0.5" stopColor="#2b2636" stopOpacity="0.42" />
          <stop offset="1" stopColor="#2b2636" stopOpacity="0.72" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={TRACK_W} height={HORIZON} fill="url(#hl-trk-sky)" />

      {/* Море: від обрію до низу, праворуч обрізане берегом. */}
      <path d={`M0 ${HORIZON}H196${COAST_DOWN}H0Z`} fill="url(#hl-trk-sea)" />
      <g fill="none" stroke={FOAM} strokeWidth="1.3" opacity="0.45">
        <path d={wave(58, 186)} />
        <path d={wave(76, 180)} />
        <path d={wave(96, 170)} />
        <path d={wave(116, 160)} />
        <path d={wave(134, 150)} />
      </g>

      {/* Далеке вітрило біля обрію. */}
      <g>
        <path d="M24 56V46l7 10Z" fill="#ffffff" opacity="0.85" />
        <path d="M21 56h11l-2 3h-7z" fill={WOOD} />
      </g>
      {/* Скеля з води. */}
      <g>
        <path d="M104 84L112 66L120 84Z" fill={STONE} />
        <path d="M112 66L116 74L112 77L108 74Z" fill="#ffffff" opacity="0.5" />
      </g>
      {/* Човен під вітрилом. */}
      <g>
        <path d="M71 84v28l21-14Z" fill="#ffffff" opacity="0.92" />
        <rect x="68.6" y="82" width="2.4" height="32" fill={WOOD} />
        <path d="M52 114h36l-6 8h-24z" fill={WOOD} />
      </g>

      {/* Суходіл однією плитою, тож лінія берега в лісу й міста спільна. */}
      <path d={`M196 ${HORIZON}H${TRACK_W}V${TRACK_H}H150${COAST_UP}Z`} fill="url(#hl-trk-grass)" />
      <path
        d={`M${COAST_AT_TERRACE} ${TERRACE}H${TRACK_W}V${TRACK_H}H150C165 124 176 102 ${COAST_AT_TERRACE} ${TERRACE}Z`}
        fill="url(#hl-trk-ground)"
      />

      {/* Піщана смуга вздовж берега й піна на самій лінії. */}
      <path d={`M196 ${HORIZON}${COAST_DOWN}H164C192 96 204 68 209 ${HORIZON}Z`} fill={SAND} opacity="0.75" />
      <path d={`M196 ${HORIZON}${COAST_DOWN}`} fill="none" stroke={FOAM} strokeWidth="2" opacity="0.7" />

      {/* Ліс Племен на верхній терасі. */}
      {PINES.map(([x, h]) => (
        <g key={`p${x}`}>
          <rect x={x - 1.4} y={TERRACE - 6} width="2.8" height="6" fill={WOOD} />
          <path
            d={`M${x - h * 0.3} ${TERRACE - 3}L${x} ${TERRACE - h}L${x + h * 0.3} ${TERRACE - 3}Z`}
            fill={LEAF}
          />
          <path
            d={`M${x} ${TERRACE - h}L${x + h * 0.16} ${TERRACE - h * 0.45}L${x} ${TERRACE - h * 0.32}L${x - h * 0.16} ${TERRACE - h * 0.45}Z`}
            fill={LEAF_DARK}
            opacity="0.5"
          />
        </g>
      ))}
      {/* Хатини стоять між соснами, але не на замку: він займає 316-348. */}
      <TreeHut x={238} />
      <TreeHut x={282} />

      {/* Підпірна стіна: межа лісу й міста, наскрізна через усю дошку. */}
      <rect x={COAST_AT_TERRACE} y={TERRACE} width={430 - COAST_AT_TERRACE} height="7" fill={STONE} />
      {/* На сході стіна вже розсипалася — лишилися окремі ділянки. */}
      <g fill={STONE} opacity="0.8">
        <rect x="438" y={TERRACE} width="16" height="7" />
        <rect x="464" y={TERRACE + 1} width="12" height="6" />
        <rect x="488" y={TERRACE} width="22" height="7" />
        <rect x="520" y={TERRACE + 2} width="10" height="5" />
        <rect x="548" y={TERRACE + 1} width="18" height="6" />
      </g>
      <path
        d={`M${COAST_AT_TERRACE} ${TERRACE + 3.5}H430`}
        stroke={WALL}
        strokeWidth="0.7"
        opacity="0.35"
        fill="none"
      />

      {/* Гавань: поміст на палях, пакгауз і кран. */}
      <g>
        <g fill={WOOD}>
          <rect x="128" y="112" width="68" height="5" />
          <rect x="133" y="117" width="3.4" height="24" />
          <rect x="148" y="117" width="3.4" height="21" />
          <rect x="163" y="117" width="3.4" height="17" />
        </g>
        <rect x="180" y="96" width="26" height="24" fill={WALL} />
        <path d="M177 96L193 86L209 96Z" fill={ROOF} />
        <rect x="189" y="108" width="7" height="12" fill={WOOD} />
        <g fill={WOOD}>
          <rect x="212" y="88" width="3.4" height="32" />
          <path d="M213.7 90h20v4l-14 4z" />
          <rect x="229" y="99" width="1.2" height="9" />
          <rect x="225" y="108" width="9" height="8" />
        </g>
      </g>

      {/* Місто Імперії: два ряди для глибини. */}
      {CITY_BACK.map(([x, w, h]) => (
        <House key={`b${x}`} x={x} w={w} h={h} base={120} />
      ))}
      {/* Замок вищий за все місто й пробиває лінію тераси — його видно й з лісу. */}
      <g>
        <path d="M316 54h8v5h4v-5h8v5h4v-5h8v11h-32z" fill={STONE} />
        <rect x="319" y="63" width="26" height="87" fill={STONE} />
        <rect x="328" y="74" width="8" height="12" fill="#37324a" opacity="0.5" />
        <rect x="326" y="132" width="12" height="18" fill={WOOD} />
      </g>
      {CITY_FRONT.map(([x, w, h]) => (
        <House key={`f${x}`} x={x} w={w} h={h} base={TRACK_H} />
      ))}

      {/* Схід: ті самі будинки, але без дахів і з обваленим верхом. */}
      {RUINS.map(([x, w, h]) => (
        <path
          key={`r${x}`}
          d={`M${x} ${TRACK_H}V${TRACK_H - h}l${w * 0.28} ${h * 0.22}l${w * 0.22} ${-h * 0.3}l${w * 0.26} ${h * 0.34}l${w * 0.24} ${-h * 0.16}V${TRACK_H}Z`}
          fill={RUIN}
        />
      ))}
      {SNAGS.map((x) => (
        <path
          key={`s${x}`}
          d={`M${x} ${TRACK_H}V${TRACK_H - 34}M${x} ${TRACK_H - 22}l-8 -9M${x} ${TRACK_H - 28}l9 -11M${x} ${TRACK_H - 14}l-7 -6`}
          stroke="#8f8aa0"
          strokeWidth="1.8"
          fill="none"
          opacity="0.75"
          strokeLinecap="round"
        />
      ))}
      {GRAVES.map(([x, w, h]) => (
        <path
          key={`g${x}`}
          d={`M${x} ${TRACK_H}v${-h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0v${h - w / 2}z`}
          fill="#b4b0c4"
          opacity="0.7"
        />
      ))}

      <rect x="0" y="0" width={TRACK_W} height={TRACK_H} fill="url(#hl-trk-dusk)" />
      {/* Туман лягає поверх сутінків — інакше вони його гасять. */}
      <g fill="#ffffff" opacity="0.09">
        <rect x="410" y="112" width="190" height="5" />
        <rect x="430" y="130" width="170" height="4" />
      </g>
    </svg>
  );
}

/**
 * Розміри бічної колони.
 *
 * Таверна — найбільша: саме там гравець обирає карту, і читати її треба, не
 * наводячи мишу. Колоди гавані, пустоші й цвинтаря — на щабель менші: у них
 * важлива не назва, а те, що це стопка й скільки в ній карт.
 */
const TAVERN_SLOT = CARD_SIZES.large;
const SLOT = CARD_SIZES.small;

const ZONE_PANEL = "zone-frame rounded-xl p-2";
const ZONE_HEADER = "text-xs font-semibold uppercase tracking-wider board-label zone-header mb-1 relative";

/**
 * Декор зони — не прямокутник із прозорістю, а натяк на місце.
 *
 * Гавань: хвилі й щогла. Пустош: сухі дерева й каміння. Цвинтар: надгробки в
 * тумані. Малюється в підвалі панелі під вмістом, тому картам не заважає.
 *
 * `preserveAspectRatio="none"` навмисно: смуга розтягується на всю ширину
 * панелі, а форми тут настільки прості, що спотворення не читається.
 */
function ZoneArt({ kind }: { kind: "harbor" | "wilderness" | "graveyard" }) {
  return (
    <svg
      className="zone-frame-art"
      viewBox="0 0 120 40"
      preserveAspectRatio="none"
      aria-hidden
    >
      {kind === "harbor" && (
        <>
          {/* Хмарки над щоглою. Заливкою, а не обрисом: на 40px заввишки
              обведене коло перетворюється на кільце, а не на хмару. */}
          <g fill="currentColor" opacity="0.5">
            <path d="M12 12q2-5 6-3 1-4 6-3t5 6H12z" />
            <path d="M88 8q2-4 5-2.5 1-3.5 5-2.5t4 5H88z" />
          </g>
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M-4 30 Q8 25 20 30 T44 30 T68 30 T92 30 T116 30 T140 30" />
            <path d="M-4 36 Q8 31 20 36 T44 36 T68 36 T92 36 T116 36 T140 36" />
            <path d="M60 6 L60 27" />
            <path d="M60 9 L74 15 L60 20" fill="currentColor" strokeWidth="1" />
            <path d="M46 27 L74 27" />
          </g>
        </>
      )}
      {kind === "wilderness" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M-4 34 H140" />
          <path d="M24 34 L24 14 M24 22 L16 15 M24 20 L32 12 M24 27 L18 23" />
          <path d="M92 34 L92 18 M92 24 L100 17 M92 22 L85 16" />
          <path d="M52 34 q6 -7 12 0 z" fill="currentColor" stroke="none" opacity="0.7" />
          <path d="M68 34 q4 -4 8 0 z" fill="currentColor" stroke="none" opacity="0.5" />
        </g>
      )}
      {kind === "graveyard" && (
        <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M-4 34 H140" />
          <path d="M18 34 V20 a6 6 0 0 1 12 0 v14 z" />
          <path d="M24 24 v7 M21 27 h6" />
          <path d="M56 34 V16 a7 7 0 0 1 14 0 v18 z" />
          <path d="M63 21 v8 M59.5 24.5 h7" />
          <path d="M94 34 V22 a5 5 0 0 1 10 0 v12 z" />
        </g>
      )}
    </svg>
  );
}

/**
 * Фішка маркера — карбований жетон, а не квадратик із символом.
 *
 * Малюється SVG, бо потрібні концентричні кола, насічений обід і блік: усе це
 * прямокутною плашкою з текстовим символом не зобразити. Ідентифікаторів і
 * градієнтів усередині немає — на полі одночасно живуть до шести жетонів, і
 * `id` вони б розділили між собою. Об'єм робиться накладанням кіл з
 * прозорістю, тінь — CSS-фільтром зовні (`.marker-3d`).
 *
 * Емблеми взято з фракцій, чиї маркери ці: ромб — Імперія, вістря — Племена.
 * Експортується для PhaseBar.
 */
export function MarkerToken({
  variant,
  className = "",
  title,
  trail = false,
  preview = false,
  size = 22,
}: {
  variant: "red" | "green";
  className?: string;
  title?: string;
  trail?: boolean;
  preview?: boolean;
  size?: number;
}) {
  const isRed = variant === "red";
  const base = isRed ? "var(--red)" : "var(--green)";
  const rim = isRed ? "#7b2b2b" : "#22551f";
  return (
    <span
      className={`inline-flex shrink-0 ${trail ? "marker-trail absolute" : ""} ${className}`}
      style={{ width: size, height: size, opacity: preview ? 0.65 : 1 }}
      title={title}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: "block" }}>
        <circle cx="16" cy="16" r="15.2" fill={rim} />
        <circle cx="16" cy="16" r="12.6" fill={base} />
        {/* Блік верхньої півсфери — жетон має читатися опуклим. */}
        <path d="M3.4 16a12.6 12.6 0 0 1 25.2 0z" fill="#ffffff" opacity="0.2" />
        {/* Насічки обода тут немає. Пунктирне коло по краю читалося не як
            карбування, а як брудна штрихова обвідка навколо емблеми, і
            конкурувало з нею за увагу: емблема біла, і риски були білі. Обід
            тримається кольором `rim` і бліком — цього досить. */}
        {isRed ? (
          // Вежа з зубцями: Імперія. Ромб нічого не позначав — тепер жетон на
          // треку й бейдж фракції на картах показують ту саму річ.
          //
          // Зубці й корпус навмисно перекриваються по вертикалі: у першій
          // версії між ними лишалася щілина в чверть пікселя, і на жетоні це
          // читалося як відірвана від вежі корона.
          <g fill="#ffffff">
            <path d="M11 9.6h2v1.7h2V9.6h2v1.7h2V9.6h2v3.8H11z" />
            <path d="M11.9 12.8h8.2v9.8h-8.2z" />
            <path d="M14.7 17.4h2.6v5.2h-2.6z" fill={rim} />
            <path d="M13 15h1.6v2h-1.6zm4.4 0h1.6v2h-1.6z" fill={rim} />
          </g>
        ) : (
          // Гори: Племена. Один суцільний силует із двома вершинами. Снігові
          // шапки другим тоном пробувалися й не пройшли — на 22px вони з'їдають
          // самі вершини, тобто те, за чим гори й упізнаються.
          <path d="M5.6 23 L12.6 9.4 L17.4 17.6 L20.6 12.2 L26.4 23 Z" fill="#ffffff" />
        )}
      </svg>
    </span>
  );
}

/**
 * Стопка закритих карт: справжня рубашка, а не знак питання.
 *
 * Рубашка каже те саме («що там — невідомо»), але ще й показує, що це колода
 * карт, а не порожній слот, і збігається з усіма іншими закритими картами на
 * столі. Обведення лишається кольором зони — саме воно й розрізняє гавань,
 * пустош і цвинтар.
 */
function CardStack({ borderColor }: { borderColor: string }) {
  return (
    <div className="relative" style={{ width: SLOT.w, height: SLOT.h }}>
      {/* Друга карта під першою — стопка має читатися як стопка. */}
      <div
        className="absolute inset-0 rounded-lg border-2 bg-black/25"
        style={{ transform: "translate(2px, 2px)", borderColor }}
      />
      <div
        className="relative rounded-lg border-2 overflow-hidden shadow-md w-full h-full"
        style={{ borderColor }}
      >
        <CardBack size="small" />
      </div>
    </div>
  );
}

/**
 * Стопка зони з лічильником.
 *
 * Підпису під стопкою немає: назва зони вже стоїть у заголовку панелі, за
 * сантиметр вище, і другий раз тим самим словом нічого не додавала — виходило
 * «Пустош … Пустош … 2». Лишається саме число, бо воно єдине, чого в заголовку
 * немає. Гавань так і була влаштована — тепер усі три зони однакові.
 */
function CardStackPlaceholder({
  count,
  accent = "default",
}: {
  count: number;
  accent?: "default" | "harbor" | "wilderness" | "graveyard";
}) {
  const isHarbor = accent === "harbor";
  const isWilderness = accent === "wilderness";
  const isGraveyard = accent === "graveyard";
  const borderColor = isHarbor
    ? "var(--zone-harbor-border)"
    : isWilderness || isGraveyard
      ? "var(--zone-wilderness-border)"
      : CARD_BACK_FIELD;
  const textCl = isHarbor ? "zone-harbor-text" : isWilderness || isGraveyard ? "zone-wilderness-text" : "text-[var(--zone-label)]/80";

  return (
    <div className="flex flex-col items-center">
      <CardStack borderColor={borderColor} />
      <span className={`mt-0.5 text-xs font-bold ${textCl}`}>{count}</span>
    </div>
  );
}

export function CentralBoard({
  state,
  isMyTurn,
  phase,
  loading,
  onDrawFromTavern,
  onDrawFromHarbor,
  previewRed = null,
  previewGreen = null,
  onHoverCard,
}: {
  state: GameStateView;
  isMyTurn: boolean;
  phase: string;
  loading: boolean;
  onDrawFromTavern: (slotIndex: number) => void;
  onDrawFromHarbor: () => void;
  previewRed?: number | null;
  previewGreen?: number | null;
  onHoverCard?: HoverHandler;
}) {
  const catalog = useCardsCatalog();
  const canDraw = phase === "DRAW" && isMyTurn && !loading;
  const top = state.graveyard_top;
  const bothInWarArea = state.red_marker >= 9 && state.green_marker >= 9;

  const [trail, setTrail] = useState<{ red?: number; green?: number }>({});
  const prevRedRef = useRef(state.red_marker);
  const prevGreenRef = useRef(state.green_marker);
  useEffect(() => {
    const tr: { red?: number; green?: number } = {};
    if (state.red_marker !== prevRedRef.current) {
      tr.red = prevRedRef.current;
      prevRedRef.current = state.red_marker;
    }
    if (state.green_marker !== prevGreenRef.current) {
      tr.green = prevGreenRef.current;
      prevGreenRef.current = state.green_marker;
    }
    if (Object.keys(tr).length > 0) {
      setTrail(tr);
      const t = setTimeout(() => setTrail({}), 500);
      return () => clearTimeout(t);
    }
  }, [state.red_marker, state.green_marker]);

  const showPreview =
    (previewRed != null && previewRed !== state.red_marker) ||
    (previewGreen != null && previewGreen !== state.green_marker);

  return (
    <div className="flex flex-row w-full min-h-0 gap-0 self-start">
      {/* Center: Field + Power Track — cream board, War Area pulse when both markers there */}
      <div className="flex-1 min-w-0 flex flex-col justify-center items-center px-4 py-3" style={{ minHeight: 120 }}>
        {/* Підпису над треком немає: дошка з номерами й жетонами не потребує
            назви, а рядок заголовка з'їдав висоту в найтіснішому місці столу. */}
        <div className="power-track w-full">
          <div className="power-track-inner flex">
            {/* Пейзаж лежить під усіма клітинками одним шаром, а не в кожній
                окремо: інакше межі земель проходили б там, де закінчується
                клітинка, а не там, де їх малює місцевість. */}
            <TrackPanorama />
            {TRACK_CELLS.map((n) => {
              const isWarCell = n >= 9;
              const pulse = isWarCell && bothInWarArea;
              const occupied = state.red_marker === n || state.green_marker === n;
              const land = landOf(n);
              return (
                <div
                  key={n}
                  title={LAND_TITLE[land]}
                  className={`power-cell ${LAND_CLASS[land]} ${isWarCell ? "power-cell--war" : ""} ${occupied ? "power-cell--active" : ""} ${pulse ? "war-area-pulse" : ""}`}
                >
                  {/* Зона війни відділяється хвилястою межею, а не прямою
                      лінією, — так само як на дошці. Форма несе те саме, що й
                      колір, і лишається помітною, коли колір гасне в темній темі. */}
                  {isWarCell && (
                    <svg className="power-cell-edge" viewBox="0 0 8 100" preserveAspectRatio="none" aria-hidden>
                      <path
                        d="M4 0 Q0 12 4 25 Q8 38 4 50 Q0 62 4 75 Q8 88 4 100"
                        fill="none" stroke="currentColor" strokeWidth="2"
                      />
                    </svg>
                  )}
                  <div className="power-cell-slot">
                    <span className="power-cell-socket" aria-hidden />
                    {trail.red === n && <MarkerToken variant="red" size={TOKEN_PX} trail title="Червоний (Імперія)" />}
                    {trail.green === n && <MarkerToken variant="green" size={TOKEN_PX} trail title="Зелений (Племена)" />}
                    {showPreview && previewRed === n && (
                      <MarkerToken variant="red" size={TOKEN_PX} preview title="Прев’ю: червоний" />
                    )}
                    {showPreview && previewGreen === n && (
                      <MarkerToken variant="green" size={TOKEN_PX} preview title="Прев’ю: зелений" />
                    )}
                    {state.red_marker === n && (
                      <MarkerToken variant="red" size={TOKEN_PX} className="marker-3d" title="Червоний (Імперія)" />
                    )}
                    {state.green_marker === n && (
                      <MarkerToken variant="green" size={TOKEN_PX} className="marker-3d" title="Зелений (Племена)" />
                    )}
                  </div>
                  {/* Номер унизу, як на дошці: жетон стоїть у верхній частині
                      клітинки, і номер під ним не доводиться шукати за фішкою. */}
                  {/* Без `board-label`: декоративний шрифт дошки має нерівні
                      бічні відступи в цифр, і одинична цифра з'їжджала з центру
                      кола. Шрифт і колір номера задає `.power-cell-num`. */}
                  <span className="power-cell-num">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar: Tavern row + Harbor / Wilderness / Graveyard row — harmonious grid */}
      <div className="flex flex-col gap-3 shrink-0 pl-3 w-auto min-w-[200px] border-l border-[var(--border)]/50">
        {/* Row 1: Tavern — three slots in a row, breathing when drawable */}
        <div className={`${ZONE_PANEL} zone-tavern-panel`}>
          <p className={ZONE_HEADER}>Таверна</p>
          <div className={`flex flex-row gap-2 justify-center flex-wrap ${canDraw ? "tavern-breathe" : ""}`}>
            {state.tavern.map((slot, i) =>
              slot ? (
                // Наведення слухає обгортка, а не кнопка. Кнопка вимкнена поза
                // фазою «Брати», а вимкнений елемент не породжує подій миші —
                // саме через це прев'ю карти таверни працювало лише в того, чий
                // зараз хід, хоча дивитися на таверну має право будь-хто.
                <span
                  key={i}
                  className="inline-block shrink-0"
                  onMouseEnter={(e) =>
                    onHoverCard?.({ cardId: slot.card_id, isPlayed: false, anchor: hoverAnchor(e.currentTarget) })
                  }
                  onMouseLeave={() => onHoverCard?.(null)}
                >
                  <button
                    type="button"
                    disabled={!canDraw}
                    onClick={() => canDraw && onDrawFromTavern(i)}
                    className="shrink-0 text-left rounded-lg overflow-hidden shadow-md disabled:cursor-not-allowed hover:ring-2 hover:ring-[var(--accent)] transition-all disabled:opacity-90"
                  >
                    <GameCard
                      cardId={slot.card_id}
                      variant="open"
                      name={slot.name}
                      faction={slot.faction}
                      size="large"
                      catalog={catalog}
                    />
                  </button>
                </span>
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={!canDraw}
                  onClick={() => canDraw && onDrawFromTavern(i)}
                  // Порожній слот того ж розміру, що й зайнятий: доти він був
                  // розміром із карту цвинтаря, і ряд таверни стрибав по висоті,
                  // щойно карту забирали.
                  className="rounded-lg border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent)]/50 shrink-0 bg-[var(--bg-panel)]/40"
                  style={{ width: TAVERN_SLOT.w, height: TAVERN_SLOT.h }}
                >
                  <span className="text-[10px] text-[var(--text-muted)]">—</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Row 2: Harbor, Wilderness, Graveyard — one horizontal row */}
        <div className="flex flex-row gap-3 items-stretch justify-center flex-wrap">
          {/* Harbor */}
          <div className={`${ZONE_PANEL} zone-harbor-panel flex flex-col items-center flex-1 min-w-0`}>
            <ZoneArt kind="harbor" />
            <p className={`${ZONE_HEADER} zone-harbor-text`}>Гавань</p>
            {/* Окремої кнопки «Брати» немає: колода й була кнопкою, тож поруч
                стояли два елементи з однією дією. Лишилася сама стопка —
                клацання по ній і бере карту. Обвід на наведенні показує, що
                вона натискається, замість підпису.

                Вимкнена кнопка не гасне. Гасіння тут не позначало «не можна
                натиснути», а вибілювало саму колоду: гавань стояла поруч із
                пустошем і цвинтарем, у яких стопки не в кнопках, і рубашка в
                ній була блідішою за ті самі рубашки за два сантиметри. Стан
                кнопки несе курсор і відсутність обводу на наведенні. */}
            <button
              type="button"
              disabled={!canDraw}
              onClick={() => canDraw && onDrawFromHarbor()}
              title={canDraw ? "Взяти карту з гавані" : "Гавань"}
              className="flex flex-col items-center rounded-lg transition-all disabled:cursor-not-allowed enabled:hover:ring-2 enabled:hover:ring-[var(--accent)]"
            >
              <CardStack borderColor="var(--zone-harbor-border)" />
            </button>
            <span className="mt-0.5 text-xs font-bold zone-harbor-text">{state.harbor_count}</span>
          </div>

          {/* Wilderness */}
          <div className={`${ZONE_PANEL} zone-wilderness-panel flex flex-col items-center flex-1 min-w-0`}>
            <ZoneArt kind="wilderness" />
            <p className={`${ZONE_HEADER} zone-wilderness-text`}>Пустош</p>
            <CardStackPlaceholder count={state.wilderness_count} accent="wilderness" />
          </div>

          {/* Graveyard — top card visible or placeholder "Проклятий імператор", count below */}
          <div className={`${ZONE_PANEL} zone-graveyard-panel flex flex-col items-center flex-1 min-w-0`} translate="no">
            <ZoneArt kind="graveyard" />
            <p className={`${ZONE_HEADER} zone-graveyard-text`}>Цвинтар</p>
            <div className="flex flex-col items-center">
              <div
                className="rounded-lg overflow-hidden shadow-md shrink-0"
                style={{ width: SLOT.w, height: SLOT.h }}
                onMouseEnter={(e) =>
                  top?.card_id &&
                  onHoverCard?.({ cardId: top.card_id, isPlayed: true, anchor: hoverAnchor(e.currentTarget) })
                }
                onMouseLeave={() => onHoverCard?.(null)}
              >
                {top?.card_id ? (
                  <GameCard
                    cardId={top.card_id}
                    variant="open"
                    name={top.name}
                    faction={top.faction}
                    size="small"
                    theme="graveyard"
                    catalog={catalog}
                  />
                ) : (
                  <div
                    className="graveyard-card-bg rounded-lg border-2 flex flex-col items-center justify-center text-center box-border shadow-sm h-full w-full notranslate"
                    style={{
                      padding: 4,
                      borderColor: "var(--zone-graveyard-border)",
                      color: "var(--zone-graveyard-text)",
                    }}
                  >
                    <span className="text-[9px] leading-tight italic zone-graveyard-text line-clamp-2 break-words text-center" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
                      Проклятий імператор
                    </span>
                  </div>
                )}
              </div>
              {/* Назва зони стоїть у заголовку панелі — під картою лишається
                  тільки лічильник, як у гавані та пустоші. */}
              <span className="mt-0.5 text-xs font-bold zone-graveyard-text">{state.graveyard_count ?? (top ? 1 : 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
