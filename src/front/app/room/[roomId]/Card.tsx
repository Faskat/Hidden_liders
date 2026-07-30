"use client";

import type { CardCatalogEntry } from "@/lib/types";
import { getCardById, FACTION_COLORS } from "@/lib/cards";
import { getAbilityLabel, formatMarkersShort } from "@/lib/cardDescription";
import { CARD_SIZES, type CardSizeToken } from "@/lib/cardSizes";
import { CardArt } from "@/lib/cardart/CardArt";
import { CardBack, CARD_BACK_FIELD } from "@/lib/cardart/CardBack";
import { FactionBadge } from "@/lib/cardart/FactionBadge";
import { withIcons } from "@/lib/cardart/abilityIcons";
import { displayName } from "@/lib/cardNames";

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
  const iconPx = Math.max(9, spec.footerFontPx);
  const badgePx = Math.round(spec.nameFontPx * 1.2);
  /** Показуємо українською, а рушій арту й далі ключується англійською назвою. */
  const shownName = displayName(artKey) || name;

  const catalogEntry = catalogProp?.[cardId];
  const abilityLabel = getAbilityLabel(catalogEntry?.ability, catalogEntry?.markers);
  const markersShort = formatMarkersShort(catalogEntry?.markers);

  const tooltipParts = [shownName];
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
      <div className="flex-1 min-w-0 flex flex-col" style={{ padding: spec.pad }}>
      {/* Назва на всю ширину. Українські назви довші за англійські, і бейдж,
          що стояв тут поруч, з'їдав чверть рядка — тому він переїхав у кут
          арту, як на друкованих картах. */}
      <div className={`shrink-0 min-w-0 flex items-start ${isGraveyardSize ? "justify-center" : ""}`}>
        <span
          // `block` тут стояти не може: він перебиває display:-webkit-box, на
          // якому тримається line-clamp, і назва мовчки росла в третій рядок.
          className={`font-semibold notranslate min-w-0 leading-tight break-words ${spec.nameLines === 3 ? "line-clamp-3" : "line-clamp-2"} ${isGraveyardSize ? "text-center w-full" : ""} ${isGraveyard ? "zone-graveyard-text" : "text-[#1e3a5f]"}`}
          style={{ fontSize: spec.nameFontPx }}
          title={shownName}
        >
          {shownName}
        </span>
      </div>

      {/* Арт забирає собі весь вільний простір, який раніше з'їдав рядок імені. */}
      <div
        className="shrink-0 overflow-hidden rounded-[3px] relative"
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
        {faction && !isGraveyardSize && (
          <span className="absolute" style={{ left: 2, top: 2 }}>
            <FactionBadge faction={faction} size={badgePx} fraction2={resolved?.fraction_2} />
          </span>
        )}
      </div>

      {spec.showFooter && (
      <div
        className="text-[#1e3a5f]/80 flex-1 space-y-0.5 min-h-0 overflow-hidden"
        style={{ fontSize: spec.footerFontPx }}
      >
        {abilityLabel && spec.showAbility && (
          <div
            className={`font-medium text-[#1e3a5f]/90 break-words leading-snug ${
              spec.abilityLines === 2 ? "line-clamp-2" : spec.abilityLines === 3 ? "line-clamp-3" : "line-clamp-4"
            }`}
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
