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
 * Габарит жетона на треку.
 *
 * Впирається в ширину клітинки, а не у смак: центр дошки віддає треку близько
 * 330px на дванадцять клітинок, тож на жетон лишається 22px разом із відступами.
 */
const TOKEN_PX = 22;

/** Колоди, порожні слоти таверни й цвинтар — усі розміром із карту цвинтаря. */
const SLOT = CARD_SIZES.graveyard;

const ZONE_PANEL = "rounded-xl glass-panel p-2";
const ZONE_HEADER = "text-xs font-semibold uppercase tracking-wider board-label zone-header mb-1";

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
          <path d="M16 8.4 L21.4 16 L16 23.6 L10.6 16 Z" fill="#ffffff" opacity="0.9" />
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
        <CardBack size="graveyard" />
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
        <div className="power-track w-full max-w-2xl">
          <div className="power-track-inner w-full flex">
            {TRACK_CELLS.map((n) => {
              const isWarCell = n >= 9;
              const pulse = isWarCell && bothInWarArea;
              const occupied = state.red_marker === n || state.green_marker === n;
              return (
                <div
                  key={n}
                  className={`power-cell ${isWarCell ? "power-cell--war" : ""} ${occupied ? "power-cell--active" : ""} ${pulse ? "war-area-pulse" : ""}`}
                >
                  {/* Позначка зони війни живе у самій клітинці, а не підписом
                      збоку: підпис під треком губиться, а нахил дошки ще й
                      відсуває його від клітинок, на які він показує. */}
                  {isWarCell && <span className="power-cell-war-glyph" aria-hidden>⚔</span>}
                  <span className="power-cell-num board-label">{n}</span>
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
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar: Tavern row + Harbor / Wilderness / Graveyard row — harmonious grid */}
      <div className="flex flex-col gap-3 shrink-0 pl-3 w-auto min-w-[200px] border-l border-[var(--border)]/50">
        {/* Row 1: Tavern — three slots in a row, breathing when drawable */}
        <div className={ZONE_PANEL}>
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
                      size="tiny"
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
                  className="rounded-lg border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent)]/50 shrink-0 bg-[var(--bg-panel)]/40"
                  style={{ width: SLOT.w, height: SLOT.h }}
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
            <p className={`${ZONE_HEADER} zone-wilderness-text`}>Пустош</p>
            <CardStackPlaceholder count={state.wilderness_count} label="Пустош" accent="wilderness" />
          </div>

          {/* Graveyard — top card visible or placeholder "Проклятий імператор", count below */}
          <div className={`${ZONE_PANEL} zone-graveyard-panel flex flex-col items-center flex-1 min-w-0`} translate="no">
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
                    size="graveyard"
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
