"use client";

import type { CardCatalogEntry } from "@/lib/types";
import { getCardById, FACTION_COLORS } from "@/lib/cards";
import { getAbilityLabel, formatMarkersShort } from "@/lib/cardDescription";
import { CARD_SIZES, type CardSizeToken } from "@/lib/cardSizes";

export function GameCard({
  cardId,
  variant,
  name: nameProp,
  faction: factionProp,
  red_delta: redDeltaProp,
  green_delta: greenDeltaProp,
  size = "normal",
  theme = "default",
  catalog: catalogProp,
}: {
  cardId: string;
  variant: "open" | "hidden";
  name?: string;
  faction?: string;
  red_delta?: number;
  green_delta?: number;
  size?: CardSizeToken;
  theme?: "default" | "graveyard";
  catalog?: Record<string, CardCatalogEntry>;
}) {
  const resolved = getCardById(cardId, catalogProp);
  const name = nameProp ?? resolved?.name ?? cardId.replace(/^hero_|^leader_/, "");
  const faction = factionProp ?? resolved?.faction;
  const red_delta = redDeltaProp ?? resolved?.red_delta ?? 0;
  const green_delta = greenDeltaProp ?? resolved?.green_delta ?? 0;
  const hasMarkersOnly = resolved?.hasMarkersOnly ?? false;

  const borderColor = faction ? FACTION_COLORS[faction] ?? "var(--border)" : "var(--border)";
  const spec = CARD_SIZES[size];
  const isGraveyard = theme === "graveyard";

  if (variant === "hidden") {
    return (
      <div
        className="rounded-lg border-2 flex items-center justify-center bg-[#1e3a5f]/10 select-none"
        style={{
          borderColor: "#1e3a5f",
          width: spec.w,
          height: spec.h,
        }}
      >
        <span className="board-label text-[#1e3a5f]/60 text-xs">?</span>
      </div>
    );
  }

  const isLarge = size === "large" || size === "xlarge";
  const isXLarge = size === "xlarge";
  const isGraveyardSize = size === "graveyard";

  const catalogEntry = catalogProp?.[cardId];
  const abilityLabel = getAbilityLabel(catalogEntry?.ability, catalogEntry?.markers);
  const markersShort = formatMarkersShort(catalogEntry?.markers);

  const tooltipParts = [name];
  if (abilityLabel) tooltipParts.push(abilityLabel);
  if (markersShort) tooltipParts.push(markersShort);
  if (!abilityLabel && !markersShort && hasMarkersOnly) tooltipParts.push("Маркери за правилами");
  if (!abilityLabel && !markersShort && !hasMarkersOnly && (red_delta !== 0 || green_delta !== 0)) {
    const d: string[] = [];
    if (red_delta !== 0) d.push(`${red_delta > 0 ? "+" : ""}${red_delta} R`);
    if (green_delta !== 0) d.push(`${green_delta > 0 ? "+" : ""}${green_delta} G`);
    tooltipParts.push(d.join(", "));
  }
  const cardTooltip = tooltipParts.length > 1 ? tooltipParts.join("\n") : undefined;

  return (
    <div
      className={`rounded-lg border-2 flex flex-col shadow-sm overflow-hidden ${isGraveyard ? "graveyard-card-bg border-[var(--zone-graveyard-border)] text-[var(--zone-graveyard-text)]" : "bg-white/95"}`}
      style={{
        ...(isGraveyard ? {} : { borderColor }),
        width: spec.w,
        height: spec.h,
        padding: spec.pad,
      }}
      title={cardTooltip}
      translate="no"
    >
      <div className={`flex items-center justify-between gap-0.5 min-w-0 min-h-0 flex-1 overflow-hidden ${isGraveyardSize ? "flex-col justify-center text-center" : ""} ${isLarge ? "min-h-[1.5rem]" : ""}`}>
        <span
          className={`font-semibold notranslate ${isGraveyardSize ? "leading-tight line-clamp-2 break-words text-center w-full" : "truncate"} ${isGraveyard ? "zone-graveyard-text" : "text-[#1e3a5f]"}`}
          style={{ fontSize: spec.nameFontPx }}
          title={name}
        >
          {name}
        </span>
        {faction && !isGraveyardSize && (
          <span
            className={`rounded-full shrink-0 ${isXLarge ? "w-3 h-3" : "w-2 h-2"}`}
            style={{ background: borderColor }}
            title={faction}
          />
        )}
      </div>
      {spec.showFooter && (
      <div
        className="text-[#1e3a5f]/80 mt-auto space-y-0.5 min-h-0 overflow-hidden"
        style={{ fontSize: spec.footerFontPx }}
      >
        {abilityLabel && (
          <div className="font-medium text-[#1e3a5f]/90 line-clamp-3 break-words">{abilityLabel}</div>
        )}
        {markersShort && (
          <div className="flex flex-wrap gap-1">
            {markersShort.includes("R") || markersShort.includes("G") ? (
              markersShort.split(", ").map((part, i) => (
                <span
                  key={i}
                  className={part.includes("R") ? "text-[var(--red)]" : part.includes("G") ? "text-[var(--green)]" : ""}
                >
                  {part}
                </span>
              ))
            ) : (
              <span className="text-[#1e3a5f]/70">{markersShort}</span>
            )}
          </div>
        )}
        {!abilityLabel && !markersShort && hasMarkersOnly && (
          <span className="text-[#1e3a5f]/70 italic">Маркери за правилами</span>
        )}
        {!abilityLabel && !markersShort && !hasMarkersOnly && (red_delta !== 0 || green_delta !== 0) && (
          <div className="flex flex-wrap gap-1">
            {red_delta > 0 && <span className="text-[var(--red)]">+{red_delta} R</span>}
            {red_delta < 0 && <span className="text-[var(--red)]">{red_delta} R</span>}
            {green_delta > 0 && <span className="text-[var(--green)]">+{green_delta} G</span>}
            {green_delta < 0 && <span className="text-[var(--green)]">{green_delta} G</span>}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
