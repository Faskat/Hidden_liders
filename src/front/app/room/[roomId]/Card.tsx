"use client";

import type { CardCatalogEntry } from "@/lib/types";
import { getCardById, FACTION_COLORS } from "@/lib/cards";
import { getAbilityLabel, formatMarkersShort } from "@/lib/cardDescription";
import { CARD_SIZES, type CardSizeToken } from "@/lib/cardSizes";
import { CardArt } from "@/lib/cardart/CardArt";
import { CardBack, CARD_BACK_FIELD } from "@/lib/cardart/CardBack";
import { FactionBadge } from "@/lib/cardart/FactionBadge";
import { withIcons } from "@/lib/cardart/abilityIcons";
import { FACTION_LABEL } from "./constants";

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
        className="rounded-lg border-2 overflow-hidden select-none"
        style={{ borderColor: CARD_BACK_FIELD, width: spec.w, height: spec.h }}
      >
        <CardBack size={size} />
      </div>
    );
  }

  const isLarge = size === "large" || size === "xlarge";
  const isXLarge = size === "xlarge";
  const isGraveyardSize = size === "graveyard";

  /** Ключ арту — англійське ім'я з каталогу, а не card_id: див. lib/cardart/types.ts. */
  const artKey = catalogProp?.[cardId]?.name ?? resolved?.name ?? name;
  const spineColor = isGraveyard ? "var(--zone-graveyard-border)" : borderColor;
  const spineLabel = faction ? FACTION_LABEL[faction] : undefined;
  const iconPx = Math.max(9, spec.footerFontPx);
  const badgePx = Math.round(spec.nameFontPx * 1.15);

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
      className={`rounded-lg border-2 flex flex-row shadow-sm overflow-hidden ${isGraveyard ? "graveyard-card-bg border-[var(--zone-graveyard-border)] text-[var(--zone-graveyard-text)]" : "bg-white/95"}`}
      style={{
        ...(isGraveyard ? {} : { borderColor }),
        width: spec.w,
        height: spec.h,
      }}
      title={cardTooltip}
      translate="no"
    >
      {/* Смуга фракції: замінює собою колишню кольорову крапку в рядку імені. */}
      <div
        className="shrink-0 h-full flex items-center justify-center overflow-hidden"
        style={{ width: spec.spine, background: spineColor }}
        title={faction}
      >
        {isLarge && spineLabel && (
          <span
            aria-hidden
            className="board-label whitespace-nowrap tracking-wider uppercase"
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: Math.max(7, spec.spine - 3),
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {spineLabel}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col" style={{ padding: spec.pad }}>
      {/* Круглий бейдж фракції ліворуч від назви — як на друкованих картах. */}
      <div className={`shrink-0 min-w-0 overflow-hidden flex items-center gap-1 ${isGraveyardSize ? "justify-center" : ""} ${isLarge ? "min-h-[1.5rem]" : ""}`}>
        {faction && !isGraveyardSize && (
          <FactionBadge faction={faction} size={badgePx} fraction2={resolved?.fraction_2} />
        )}
        <span
          className={`font-semibold notranslate block min-w-0 ${isGraveyardSize ? "leading-tight line-clamp-2 break-words text-center w-full" : "truncate"} ${isGraveyard ? "zone-graveyard-text" : "text-[#1e3a5f]"}`}
          style={{ fontSize: spec.nameFontPx }}
          title={name}
        >
          {name}
        </span>
      </div>

      {/* Арт забирає собі весь вільний простір, який раніше з'їдав рядок імені. */}
      <div
        className="shrink-0 overflow-hidden rounded-[3px]"
        style={{
          height: spec.artH,
          marginTop: 3,
          marginBottom: spec.showFooter ? 3 : 0,
          ...(isGraveyard ? { filter: "saturate(0.25) brightness(0.85)" } : {}),
        }}
      >
        <CardArt
          artKey={artKey}
          faction={faction}
          size={size}
          fraction1={resolved?.fraction_1}
          fraction2={resolved?.fraction_2}
        />
      </div>

      {spec.showFooter && (
      <div
        className="text-[#1e3a5f]/80 flex-1 space-y-0.5 min-h-0 overflow-hidden"
        style={{ fontSize: spec.footerFontPx }}
      >
        {abilityLabel && spec.showAbility && (
          <div
            className={`font-medium text-[#1e3a5f]/90 break-words ${spec.abilityLines === 2 ? "line-clamp-2" : "line-clamp-3"}`}
          >
            {withIcons(abilityLabel, iconPx)}
          </div>
        )}
        {markersShort && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold">
            {withIcons(markersShort, iconPx + 1)}
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
    </div>
  );
}
