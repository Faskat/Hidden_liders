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

/** Габарит жетона на треку: клітинка тепер 50px, і жетон росте разом із нею. */
const TOKEN_PX = 34;

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
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M-4 30 Q8 25 20 30 T44 30 T68 30 T92 30 T116 30 T140 30" />
          <path d="M-4 36 Q8 31 20 36 T44 36 T68 36 T92 36 T116 36 T140 36" />
          <path d="M60 6 L60 27" />
          <path d="M60 9 L74 15 L60 20" fill="currentColor" strokeWidth="1" />
          <path d="M46 27 L74 27" />
        </g>
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
          <g fill="#ffffff" opacity="0.92">
            <path d="M10.4 8.6h2.2v1.8h1.3V8.6h2.2v1.8h1.3V8.6h2.2v3H10.4z" />
            <path d="M11.3 12h9.4v11.4h-9.4z" />
            <path d="M14.8 17.4h2.4v6h-2.4z" fill={rim} opacity="0.75" />
            <path d="M12.6 13.6h1.7v2.2h-1.7zm5.1 0h1.7v2.2h-1.7z" fill={rim} opacity="0.75" />
          </g>
        ) : (
          <path d="M16 8.2 L23 22.4 L9 22.4 Z" fill="#ffffff" opacity="0.9" />
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
        <p className="board-label zone-header text-sm font-semibold uppercase tracking-wider mb-2 text-center">
          Поле · Трек сили
        </p>
        <div className="power-track w-full">
          <div className="power-track-inner flex">
            {/* Кайма «менше впливу»: на друкованій дошці трек починається саме
                шестикутником з мінусом, і без нього ліва межа читається як
                випадковий обрив. */}
            <div className="power-cap power-cap--minus" title="Менше впливу">
              <span className="power-cap-sign" aria-hidden>−</span>
            </div>
            {TRACK_CELLS.map((n) => {
              const isWarCell = n >= 9;
              const pulse = isWarCell && bothInWarArea;
              const occupied = state.red_marker === n || state.green_marker === n;
              return (
                <div
                  key={n}
                  className={`power-cell ${isWarCell ? "power-cell--war" : ""} ${occupied ? "power-cell--active" : ""} ${pulse ? "war-area-pulse" : ""}`}
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
                  {isWarCell && <span className="power-cell-war-glyph" aria-hidden>⚔</span>}
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
                  <span className="power-cell-num board-label">{n}</span>
                </div>
              );
            })}
            <div className="power-cap power-cap--plus" title="Більше впливу">
              <span className="power-cap-sign" aria-hidden>+</span>
            </div>
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
            <button
              type="button"
              disabled={!canDraw}
              onClick={() => canDraw && onDrawFromHarbor()}
              className="flex flex-col items-center disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-100 transition-opacity"
            >
              <CardStack borderColor="var(--zone-harbor-border)" />
            </button>
            <span className="mt-0.5 text-xs font-bold zone-harbor-text">{state.harbor_count}</span>
            <button
              type="button"
              disabled={!canDraw}
              onClick={() => canDraw && onDrawFromHarbor()}
              className="btn-soft mt-0.5 py-1 px-2 text-[10px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Брати
            </button>
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
