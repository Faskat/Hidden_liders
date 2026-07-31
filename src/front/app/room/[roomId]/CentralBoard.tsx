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
 * Краєвид клітинки.
 *
 * Замість штриховки — намальована місцевість, і саме поклітинно, а не смугою на
 * весь трек: смуга не збігалася з межами клітинок, і кордон земель припадав на
 * середину клітинки. Тепер кожна сцена живе у власній клітинці, а сусідні
 * стикуються по краях (хвилі, лінія землі, дахи йдуть наскрізь).
 *
 * `preserveAspectRatio="none"` безпечний: клітинка має фіксовані 75×225, тобто
 * рівно пропорції viewBox (1:3).
 *
 * Жодних `id` і градієнтів: на треку дванадцять таких сцен, ідентифікатори
 * зіткнулися б — те саме правило, що й для деталей арту карт.
 */
const SKY = "#c3dcea";
const SEA = "#4a90b8";
const SEA_DEEP = "#2f6f96";
const FOAM = "#e8f4fa";
const WOOD = "#7a5334";
const LEAF = "#4d7c3a";
const LEAF_DARK = "#2f5a26";
const ROOF = "#b8604c";
const WALL = "#e0cfae";
const STONE = "#9a9385";
const DEAD_SKY = "#4a4458";
const DEAD_GROUND = "#37324a";
const DEAD_STONE = "#b4b0c4";

/** Хвиля на всю ширину клітинки: період дорівнює 50, тож сусідні стикуються. */
function wave(y: number): string {
  return `M0 ${y}Q12.5 ${y - 3} 25 ${y}T50 ${y}`;
}

function CellScenery({ n }: { n: number }) {
  const land = landOf(n);
  return (
    <svg className="power-cell-scene" viewBox="0 0 50 150" preserveAspectRatio="none" aria-hidden>
      {land === "water" && (
        <>
          <rect x="0" y="0" width="50" height="58" fill={SKY} />
          <rect x="0" y="58" width="50" height="92" fill={SEA} />
          <rect x="0" y="104" width="50" height="46" fill={SEA_DEEP} opacity="0.5" />
          <g fill="none" stroke={FOAM} strokeWidth="1.4" opacity="0.55">
            <path d={wave(74)} />
            <path d={wave(96)} />
            <path d={wave(120)} />
            <path d={wave(142)} />
          </g>
          {n === 1 && (
            <g>
              {/* Далеке вітрило на обрії. */}
              <path d="M20 58 L20 44 L29 58 Z" fill="#ffffff" opacity="0.85" />
              <path d="M17 58 h9 l-1.6 3 h-6.4 Z" fill={WOOD} />
            </g>
          )}
          {n === 2 && (
            <g>
              {/* Скеля з води. */}
              <path d="M8 70 L15 50 L23 70 Z" fill={STONE} />
              <path d="M15 50 L18.4 59.5 L15 62 L11.6 59.5 Z" fill="#ffffff" opacity="0.5" />
              <path d="M30 70 L34 60 L38 70 Z" fill={STONE} opacity="0.8" />
            </g>
          )}
          {n === 3 && (
            <g>
              {/* Човен під вітрилом. */}
              <path d="M25 40 L25 66 L38 66 Z" fill="#ffffff" opacity="0.9" />
              <path d="M23.4 40 h1.6 v26 h-1.6 Z" fill={WOOD} />
              <path d="M14 66 h24 l-4 7 h-16 Z" fill={WOOD} />
            </g>
          )}
          {n === 4 && (
            <g>
              {/* Порт: пакгауз, кран і поміст на палях. */}
              <rect x="4" y="30" width="20" height="22" fill={WALL} />
              <path d="M2 30 L14 20 L26 30 Z" fill={ROOF} />
              <rect x="11" y="40" width="6" height="12" fill={WOOD} />
              <rect x="32" y="24" width="3" height="32" fill={WOOD} />
              <path d="M33.5 26 L46 26 L46 30 L37 34 Z" fill={WOOD} />
              <path d="M45 30 v9" stroke={WOOD} strokeWidth="1.2" />
              <rect x="42" y="39" width="6" height="6" fill={ROOF} />
              <rect x="0" y="52" width="50" height="5" fill={WOOD} />
              <g fill={WOOD}>
                <rect x="6" y="57" width="3.4" height="26" />
                <rect x="24" y="57" width="3.4" height="30" />
                <rect x="41" y="57" width="3.4" height="24" />
              </g>
            </g>
          )}
        </>
      )}

      {land === "mid" && (
        <>
          {/* Верхня половина — ліс Племен. */}
          <rect x="0" y="0" width="50" height="75" fill="#a8cf8a" />
          <rect x="0" y="0" width="50" height="24" fill={SKY} opacity="0.8" />
          <g fill={LEAF}>
            <path d="M2 68 L11 24 L20 68 Z" />
            <path d="M28 70 L37 32 L46 70 Z" />
          </g>
          <g fill={LEAF_DARK} opacity="0.5">
            <path d="M11 24 L16 48 L11 52 L6 48 Z" />
            <path d="M37 32 L41 52 L37 55 L33 52 Z" />
          </g>
          <g fill={WOOD}>
            <rect x="9.4" y="62" width="3.2" height="11" />
            <rect x="35.4" y="64" width="3.2" height="9" />
          </g>
          {n % 2 === 1 ? (
            <g>
              {/* Хатина на дереві з драбиною — те, за чим ліс і впізнається. */}
              <rect x="4" y="40" width="14" height="10" fill={WOOD} />
              <path d="M2 40 L11 32 L20 40 Z" fill={ROOF} opacity="0.9" />
              <rect x="9" y="44" width="4" height="6" fill={LEAF_DARK} />
              <g stroke={WOOD} strokeWidth="1.2">
                <path d="M9 50 v22M14 50 v22M9 55 h5M9 61 h5M9 67 h5" />
              </g>
            </g>
          ) : (
            <g>
              <rect x="30" y="44" width="13" height="9" fill={WOOD} />
              <path d="M28 44 L36.5 37 L45 44 Z" fill={ROOF} opacity="0.9" />
              <rect x="34.6" y="47" width="4" height="6" fill={LEAF_DARK} />
              <g stroke={WOOD} strokeWidth="1.2">
                <path d="M33 53 v20M38 53 v20M33 58 h5M33 64 h5M33 70 h5" />
              </g>
            </g>
          )}

          {/* Нижня половина — щільно забудоване місто Імперії. Межа рівно по
              середині й наскрізна через усі чотири клітинки. */}
          <rect x="0" y="75" width="50" height="75" fill="#cbb894" />
          <rect x="0" y="73" width="50" height="3" fill={WOOD} opacity="0.55" />
          <g>
            <rect x="1" y="90" width="14" height="16" fill={WALL} />
            <path d="M-1 90 L8 82 L17 90 Z" fill={ROOF} />
            <rect x="18" y="93" width="13" height="13" fill={WALL} />
            <path d="M16 93 L24.5 86 L33 93 Z" fill={ROOF} />
            <rect x="34" y="88" width="15" height="18" fill={WALL} />
            <path d="M32 88 L41.5 80 L51 88 Z" fill={ROOF} />
          </g>
          <g>
            <rect x="-2" y="114" width="16" height="20" fill={WALL} />
            <path d="M-4 114 L6 106 L16 114 Z" fill={ROOF} />
            <rect x="17" y="118" width="14" height="16" fill={WALL} />
            <path d="M15 118 L24 111 L33 118 Z" fill={ROOF} />
            <rect x="35" y="116" width="16" height="18" fill={WALL} />
            <path d="M33 116 L43 108 L53 116 Z" fill={ROOF} />
          </g>
          {n === 7 && (
            <g>
              {/* Замок: вежа з зубцями вища за все місто навколо. */}
              <rect x="19" y="86" width="14" height="48" fill={STONE} />
              <path d="M18 86h3v-4h3v4h3v-4h3v4h3v-5H18z" fill={STONE} />
              <rect x="24" y="94" width="4" height="6" fill={DEAD_GROUND} opacity="0.55" />
              <rect x="23" y="120" width="6" height="14" fill={WOOD} />
            </g>
          )}
          <rect x="0" y="132" width="50" height="18" fill={STONE} opacity="0.4" />
          <g stroke={WALL} strokeWidth="0.8" opacity="0.45">
            <path d="M0 138 H50M0 144 H50M8 132 V150M20 132 V150M32 132 V150M44 132 V150" />
          </g>
        </>
      )}

      {land === "dead" && (
        <>
          <rect x="0" y="0" width="50" height="150" fill={DEAD_SKY} />
          <rect x="0" y="86" width="50" height="64" fill={DEAD_GROUND} />
          {/* Туман: три смуги, що не доходять до країв. */}
          <g fill="#ffffff" opacity="0.12">
            <rect x="0" y="82" width="50" height="6" />
            <rect x="0" y="102" width="50" height="4" />
          </g>
          {(n === 9 || n === 11) && (
            <g>
              {/* Надгробок із хрестом. */}
              <path d="M10 108 V90 a7 7 0 0 1 14 0 v18 z" fill={DEAD_STONE} opacity="0.85" />
              <g stroke={DEAD_GROUND} strokeWidth="1.6">
                <path d="M17 94 v10M13 98 h8" />
              </g>
              <path d="M30 108 V96 a5 5 0 0 1 10 0 v12 z" fill={DEAD_STONE} opacity="0.6" />
            </g>
          )}
          {(n === 10 || n === 12) && (
            <g>
              {/* Сухе дерево й похилена плита. */}
              <g stroke={DEAD_STONE} strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round">
                <path d="M14 108 V74M14 88 L6 78M14 82 L23 70M14 94 L7 88" />
              </g>
              <path d="M30 108 V92 h11 v16 z" fill={DEAD_STONE} opacity="0.55" />
            </g>
          )}
          <g fill="#ffffff" opacity="0.08">
            <rect x="0" y="126" width="50" height="5" />
          </g>
        </>
      )}
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
        {/* Насічка обода: пунктирне коло дешевше за вісім окремих рисок. */}
        <circle
          cx="16" cy="16" r="13.9" fill="none"
          stroke="#ffffff" strokeWidth="1.1" opacity="0.38" strokeDasharray="2 2.7"
        />
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

function CardStackPlaceholder({
  count,
  label,
  accent = "default",
}: {
  count: number;
  label: string;
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
      <span className={`mt-0.5 text-[10px] board-label ${textCl}`}>{label}</span>
      <span className={`text-xs font-semibold ${textCl}`}>{count}</span>
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
                  <CellScenery n={n} />
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
                вона натискається, замість підпису. */}
            <button
              type="button"
              disabled={!canDraw}
              onClick={() => canDraw && onDrawFromHarbor()}
              title={canDraw ? "Взяти карту з гавані" : "Гавань"}
              className="flex flex-col items-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-60 enabled:hover:ring-2 enabled:hover:ring-[var(--accent)]"
            >
              <CardStack borderColor="var(--zone-harbor-border)" />
            </button>
            <span className="mt-0.5 text-xs font-bold zone-harbor-text">{state.harbor_count}</span>
          </div>

          {/* Wilderness */}
          <div className={`${ZONE_PANEL} zone-wilderness-panel flex flex-col items-center flex-1 min-w-0`}>
            <ZoneArt kind="wilderness" />
            <p className={`${ZONE_HEADER} zone-wilderness-text`}>Пустош</p>
            <CardStackPlaceholder count={state.wilderness_count} label="Пустош" accent="wilderness" />
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
              <span className="mt-0.5 text-[10px] board-label zone-graveyard-text">Цвинтар</span>
              <span className="text-xs font-semibold zone-graveyard-text">{state.graveyard_count ?? (top ? 1 : 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
