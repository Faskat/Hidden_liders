"use client";

import { useEffect, useRef, useState } from "react";
import type { GameStateView } from "@/lib/types";
import { useCardsCatalog } from "@/app/contexts/CardsCatalogContext";
import { GameCard } from "./Card";

const WAR_AREA_BG = "rgba(30, 58, 95, 0.35)";

const ZONE_PANEL = "rounded-xl glass-panel p-2";
const ZONE_HEADER = "text-xs font-semibold uppercase tracking-wider board-label zone-header mb-1";

/** Game-style token for red (Imperials) and green (Highlanders) markers. Exported for PhaseBar. */
export function MarkerToken({
  variant,
  className = "",
  title,
  trail = false,
  preview = false,
}: {
  variant: "red" | "green";
  className?: string;
  title?: string;
  trail?: boolean;
  preview?: boolean;
}) {
  const color = variant === "red" ? "var(--red)" : "var(--green)";
  const symbol = variant === "red" ? "◆" : "▲";
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${trail ? "marker-trail absolute" : ""} ${className}`}
      style={{
        width: 22,
        height: 22,
        borderRadius: "6px",
        background: color,
        border: `2px solid ${variant === "red" ? "rgba(184,74,74,0.6)" : "rgba(61,143,61,0.6)"}`,
        boxShadow: preview
          ? "0 2px 4px rgba(0,0,0,0.2)"
          : "0 2px 6px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.15) inset",
        color: "rgba(255,255,255,0.9)",
        fontSize: 10,
        fontWeight: 700,
        opacity: preview ? 0.7 : 1,
      }}
      title={title}
      aria-hidden
    >
      {symbol}
    </span>
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
  const stackStyle =
    accent === "harbor"
      ? { background: "var(--zone-harbor-bg)", borderColor: "var(--zone-harbor-border)", color: "var(--zone-harbor-text)" }
      : accent === "wilderness" || accent === "graveyard"
        ? { background: "var(--zone-wilderness-bg)", borderColor: "var(--zone-wilderness-border)", color: "var(--zone-wilderness-text)" }
        : undefined;
  const textCl = isHarbor ? "zone-harbor-text" : isWilderness || isGraveyard ? "zone-wilderness-text" : "text-[var(--zone-label)]/80";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[60px]">
        <div
          className="absolute inset-0 rounded border-2 bg-black/10"
          style={{ transform: "translate(2px, 2px)" }}
        />
        <div
          className="relative rounded-lg border-2 flex items-center justify-center board-label shadow-sm"
          style={{
            width: 60,
            height: 84,
            ...(stackStyle ?? { background: "rgba(30, 58, 95, 0.15)", borderColor: "var(--zone-label)", color: "var(--zone-label)" }),
          }}
        >
          <span style={stackStyle ? { color: "inherit", opacity: 0.8 } : undefined}>?</span>
        </div>
      </div>
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
  onHoverCard?: (payload: { cardId: string; isPlayed: boolean } | null) => void;
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
        <div className="track-3d w-full max-w-2xl">
          <div
            className="track-3d-inner w-full flex overflow-hidden min-h-[80px] border-2"
            style={{
              borderColor: "rgba(30, 74, 110, 0.4)",
              background: "var(--board-cream)",
            }}
          >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
            const isWarCell = n >= 9;
            const pulse = isWarCell && bothInWarArea;
            return (
              <div
                key={n}
                className={`track-cell-3d flex-1 min-w-0 flex flex-col items-center justify-end py-3 px-1 rounded-none ${pulse ? "war-area-pulse" : ""}`}
                style={{
                  background: isWarCell ? WAR_AREA_BG : "rgba(255,255,255,0.7)",
                }}
              >
                <span className="board-label text-sm font-semibold">{n}</span>
                <div className="flex flex-col gap-1 mt-1.5 w-full items-center relative">
                  {trail.red === n && <MarkerToken variant="red" trail title="Червоний (Імперія)" />}
                  {trail.green === n && <MarkerToken variant="green" trail title="Зелений (Племена)" />}
                  {showPreview && previewRed === n && (
                    <MarkerToken variant="red" preview title="Прев’ю: червоний" />
                  )}
                  {showPreview && previewGreen === n && (
                    <MarkerToken variant="green" preview title="Прев’ю: зелений" />
                  )}
                  {state.red_marker === n && (
                    <MarkerToken variant="red" className="marker-3d" title="Червоний (Імперія)" />
                  )}
                  {state.green_marker === n && (
                    <MarkerToken variant="green" className="marker-3d" title="Зелений (Племена)" />
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
                <button
                  key={i}
                  type="button"
                  disabled={!canDraw}
                  onClick={() => canDraw && onDrawFromTavern(i)}
                  onMouseEnter={() => onHoverCard?.({ cardId: slot.card_id, isPlayed: false })}
                  onMouseLeave={() => onHoverCard?.(null)}
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
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={!canDraw}
                  onClick={() => canDraw && onDrawFromTavern(i)}
                  className="w-[60px] h-[84px] rounded-lg border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent)]/50 shrink-0 bg-[var(--bg-panel)]/40"
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
              <div className="relative w-[60px]">
                <div className="absolute inset-0 rounded-lg border-2 bg-black/15" style={{ transform: "translate(2px, 2px)", borderColor: "var(--zone-harbor-border)" }} />
                <div className="relative rounded-lg border-2 flex items-center justify-center board-label shadow-md zone-harbor-text" style={{ width: 60, height: 84, background: "var(--zone-harbor-bg)", borderColor: "var(--zone-harbor-border)" }}>
                  ?
                </div>
              </div>
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
              <div className="rounded-lg overflow-hidden shadow-md shrink-0" style={{ width: 60, height: 84 }}>
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
