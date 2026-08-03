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

/**
 * Підкладка під текст.
 *
 * Напівпрозора навмисно: фон арту тепер заливає карту цілком, і суцільна біла
 * плашка вирізала б із нього дві смуги. Крізь 0.82 фон читається як єдине
 * полотно, а темно-синій текст на ньому лишається контрастним навіть на
 * найтемнішій підкладці (Невмерлі).
 */
const PLATE = "rgba(255,255,255,0.82)";
const PLATE_NAME = "rgba(255,255,255,0.88)";

/**
 * Класи обрізки за кількістю рядків.
 *
 * Таблицею, а не конкатенацією рядка: Tailwind шукає повні імена класів у
 * вихідному коді, і `line-clamp-${n}` він просто не побачить.
 */
const NAME_CLAMP: Record<2 | 3 | 4, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
};

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
        data-card-id={cardId}
      >
        <CardBack size={size} />
      </div>
    );
  }

  const isGraveyardSize = size === "graveyard";
  /**
   * На плитках 52-60px бейдж лишається в куті арту. У рядку назви він зсуває
   * перший рядок, а на такій ширині довге слово в цей залишок уже не влазить —
   * рядок просто лишається порожнім, і назва втрачає цілу смугу.
   *
   * З 80px (`tiny`) бейдж повернувся в рядок назви: без капітелі слово в тому
   * самому кеглі стало помітно вужчим і в залишок після відступу вже влазить.
   */
  const badgeInName = !isGraveyardSize && size !== "leaderMini";

  /** Ключ арту — англійське ім'я з каталогу, а не card_id: див. lib/cardart/types.ts. */
  const artKey = catalogProp?.[cardId]?.name ?? resolved?.name ?? name;
  // Нижня межа 11, а не 9: на найдрібніших картах підпис має кегль 10, і значок
  // карти зі стану («прихована» / «лицьова») на цьому розмірі переставав
  // читатися — залишалася пляма без ока.
  const iconPx = Math.max(11, spec.footerFontPx);
  // Нижня межа — щоб зменшений кегль назви не потягнув за собою бейдж у нечитне.
  const badgePx = Math.max(11, Math.round(spec.nameFontPx * 1.25));
  /** Показуємо українською, а рушій арту й далі ключується англійською назвою. */
  const shownName = displayName(artKey) || name;

  const catalogEntry = catalogProp?.[cardId];
  const abilityLabel = getAbilityLabel(catalogEntry?.ability, catalogEntry?.markers);
  const markersShort = formatMarkersShort(catalogEntry?.markers);

  /**
   * Проклятий імператор рахується за всі чотири фракції одразу, тому в нього
   * і бейдж на чверті, і окремий рядок у підписі: сам колір рамки цього не
   * скаже, а карта лежить на цвинтарі відкритою всю партію.
   */
  const isAllFactions = faction === "Joker";

  const tooltipParts = [shownName];
  if (isAllFactions) tooltipParts.push("Усі фракції: Імперія, Племена, Водний народ, Невмерлі");
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

  const badge = faction ? (
    <FactionBadge faction={faction} size={badgePx} fraction2={resolved?.fraction_2} />
  ) : null;

  const artFilter = isGraveyard ? { filter: "saturate(0.25) brightness(0.85)" } : {};

  return (
    <div
      className={`rounded-lg border-2 shadow-sm overflow-hidden relative ${isGraveyard ? "border-[var(--zone-graveyard-border)] text-[var(--zone-graveyard-text)]" : ""}`}
      style={{
        ...(isGraveyard ? {} : { borderColor }),
        width: spec.w,
        height: spec.h,
      }}
      title={cardTooltip}
      translate="no"
      // Ручка для шару польотів: інакше знайти в DOM саме ту карту, на яку має
      // прилетіти анімація, немає по чому — розмітка карти всюди однакова.
      data-card-id={cardId}
    >
      {/* Шар 1 — фон арту на всю карту, під назвою й підписом. */}
      <div className="absolute inset-0" style={artFilter} aria-hidden>
        <CardArt
          artKey={artKey}
          faction={faction}
          size={size}
          fraction1={resolved?.fraction_1}
          fraction2={resolved?.fraction_2}
          layer="background"
        />
      </div>

      {/* Шар 2 — вміст. Геометрія та сама, що й до повноекранного фону: висоти
          перевірені на всіх семи розмірах, тому чіпати їх не варто. */}
      <div className="relative h-full w-full flex flex-col" style={{ padding: spec.pad }}>
        {/* Бейдж фракції стоїть у рядку назви, але не в потоці: назву він
            посуває через `text-indent`, а той діє лише на перший рядок. Через
            flex-сусідство бейдж з'їдав би ширину на всіх трьох рядках, і назви
            на кшталт «Приборкувач Фамільярів» переставали вміщатися. */}
        <div
          className={`shrink-0 min-w-0 relative rounded-[3px] ${isGraveyardSize ? "text-center" : ""}`}
          style={{ background: PLATE_NAME, paddingInline: 2, paddingBlock: 1 }}
        >
          {badgeInName && badge && (
            <span className="absolute" style={{ left: 2, top: 1 }}>
              {badge}
            </span>
          )}
          <span
            // `block` тут стояти не може: він перебиває display:-webkit-box, на
            // якому тримається line-clamp, і назва мовчки росла в третій рядок.
            className={`font-card-title notranslate min-w-0 break-words text-[#16324f] ${NAME_CLAMP[spec.nameLines]} ${isGraveyardSize ? "text-center w-full" : ""}`}
            style={{
              fontSize: spec.nameFontPx,
              // Явний інтерліньяж, а не `leading-tight`: у Oswald високі
              // виносні елементи, і при 1.25 рядок вилазив за власний бокс —
              // вимірювання ловило переповнення там, де візуально його не було.
              lineHeight: 1.3,
              ...(badgeInName && badge ? { textIndent: badgePx + 3 } : {}),
            }}
            title={shownName}
          >
            {shownName}
          </span>
        </div>

        {/* Шар 2б — фігура. Живе саме в проміжку між назвою й підписом, тому
            текст ніколи на неї не лягає. Фон сюди не малюється: він уже під нею.

            Висота гнучка: `artH` — це бажаний розмір, а не жорсткий. Раніше вона
            була фіксованою, і підпис на три рядки плюс рядок маркерів просто не
            вміщався — нижній рядок обрізало на пів висоти. Тепер зайве віддає
            арт, і це майже безкоштовно: фон карти малюється на весь її розмір,
            тож менший бокс фігури не лишає по собі порожнечі. */}
        <div
          className="relative"
          style={{
            // `1 1` , а не `0 1`: арт і росте, і стискається. Тільки-но підпис
            // виявлявся коротким, під ним лишалася мертва смуга в 20-30px —
            // тепер її забирає фігура й стає більшою.
            flex: `1 1 ${spec.artH}px`,
            minHeight: Math.round(spec.artH * 0.3),
            marginTop: 3,
            marginBottom: spec.showFooter ? 3 : 0,
            ...artFilter,
          }}
        >
          <CardArt
            artKey={artKey}
            faction={faction}
            size={size}
            fraction1={resolved?.fraction_1}
            fraction2={resolved?.fraction_2}
            layer="figure"
          />
          {!badgeInName && badge && (
            <span className="absolute" style={{ left: 0, top: 0 }}>
              {badge}
            </span>
          )}
        </div>

        {spec.showFooter && (
          <div
            // shrink-0: підпис бере стільки, скільки треба його рядкам, і не
            // ділить залишок з артом. Верхню межу задає line-clamp.
            className="font-card-text text-[#16324f] shrink-0 space-y-0.5 overflow-hidden rounded-[3px]"
            style={{ fontSize: spec.footerFontPx, background: PLATE, paddingInline: 2, paddingBlock: 1 }}
          >
            {isAllFactions && (
              <div className="flex items-center gap-1 font-semibold">
                <FactionBadge faction="Joker" size={iconPx + 1} />
                <span>Усі фракції</span>
              </div>
            )}
            {abilityLabel && spec.showAbility && (
              <div
                className={`font-medium break-words leading-snug ${
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
