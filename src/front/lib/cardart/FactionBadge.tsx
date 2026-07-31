"use client";

/**
 * Круглий бейдж фракції — як на друкованих картах: череп у невмерлих, хвиля у
 * водного народу, корона в імперії, гори в племен.
 *
 * Стоїть ліворуч від назви й читається швидше за колірну смугу збоку: колір
 * доводиться пригадувати, а символ упізнається одразу.
 *
 * Лідери поєднують дві фракції, тому їхній бейдж розділений по діагоналі.
 */

import { memo } from "react";
import { FACTION_COLORS } from "../cards";

const GLYPHS: Record<string, React.ReactNode> = {
  // Череп.
  Undead: (
    <g fill="#ffffff">
      <path d="M8 3.1c2.5 0 4.3 1.9 4.3 4.3 0 1.4-.6 2.4-1.3 3.1l-.2 1.4H5.2L5 10.5C4.3 9.8 3.7 8.8 3.7 7.4c0-2.4 1.8-4.3 4.3-4.3z" />
      <circle cx="6.3" cy="7.6" r="1.3" fill="#000000" opacity="0.75" />
      <circle cx="9.7" cy="7.6" r="1.3" fill="#000000" opacity="0.75" />
      <path d="M6.4 12.2h.9v1.3h-.9zm1.2 0h.9v1.3h-.9zm1.2 0h.9v1.3h-.9z" />
    </g>
  ),
  // Хвиля.
  Waterfolk: (
    <g fill="#ffffff">
      <path d="M12.6 4.2c-3.4-1.4-6.6.4-7.6 2.9-.7 1.8.1 3.4 1.6 3.9 1.2.4 2.3-.2 2.6-1.2.2-.7-.1-1.4-.8-1.6.9-.2 1.7.4 1.8 1.3.2 1.5-1.1 2.9-3 2.9-2.4 0-4.1-2-4.1-4.4 0-3 2.6-5.4 5.8-5.4 1.4 0 2.6.4 3.7 1.6z" />
    </g>
  ),
  // Вежа з зубцями. Була корона, але корону носять і лідери, і джокер — на
  // столі три різні речі позначалися однією формою. Вежа належить лише Імперії.
  Imperials: (
    <g fill="#ffffff">
      <path d="M3.6 3.4h1.5v1.3h1.2V3.4h1.4v1.3h1.2V3.4h1.5v2.1H3.6z" />
      <path d="M4.4 5.9h7.2v7.1H4.4z" />
      <path d="M7 8.2h2v4.8H7z" fill="#000000" opacity="0.4" />
      <path d="M5.4 7.1h1.1v1.5H5.4zm4.1 0h1.1v1.5H9.5z" fill="#000000" opacity="0.4" />
    </g>
  ),
  // Гори.
  Highlanders: (
    <g fill="#ffffff">
      <path d="M3 11.6l3.1-5.4 2 3.1 1.7-2.7 3.2 5z" />
      <path d="M6.1 6.2L7.5 8 6.1 8.9 4.9 8.2z" opacity="0.55" />
    </g>
  ),
  // Джокер: корона з тріщиною.
  Joker: (
    <g fill="#ffffff">
      <path d="M3.6 6l2 1.9L8 4.2l2.4 3.7 2-1.9v5.5h-8.8z" />
      <path d="M7.6 7.4h.8v4h-.8z" fill="#000000" opacity="0.45" />
    </g>
  ),
};

function glyphFor(faction: string): React.ReactNode {
  return GLYPHS[faction] ?? GLYPHS.Imperials;
}

/**
 * Проклятий імператор належить одразу всім чотирьом фракціям — так він і
 * рахується в умовах перемоги. Одного кольору тут не досить: карта на цвинтарі
 * лежить відкритою весь час, і гравець має бачити, що вона грає за кожного.
 *
 * Чверті замальовуються чотирма трикутниками від центру — без масок і `id`,
 * як і решта бейджів.
 */
const ALL_FACTIONS = ["Imperials", "Highlanders", "Waterfolk", "Undead"] as const;
const QUARTERS = [
  "M8 8 L8 0.6 A7.4 7.4 0 0 1 15.4 8 Z",
  "M8 8 L15.4 8 A7.4 7.4 0 0 1 8 15.4 Z",
  "M8 8 L8 15.4 A7.4 7.4 0 0 1 0.6 8 Z",
  "M8 8 L0.6 8 A7.4 7.4 0 0 1 8 0.6 Z",
];

export const FactionBadge = memo(function FactionBadge({
  faction,
  size = 14,
  fraction2,
}: {
  faction: string;
  size?: number;
  /** Задано лише для лідерів: друга фракція, під діагональний поділ. */
  fraction2?: string;
}) {
  const isJoker = faction === "Joker";
  const isLeader = faction === "Leader" && Boolean(fraction2);
  const main = isLeader ? "Imperials" : faction;
  const colorA = FACTION_COLORS[isLeader ? "Leader" : faction] ?? "var(--border)";
  const colorB = fraction2 ? FACTION_COLORS[fraction2] ?? colorA : colorA;

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label={isJoker ? "Усі фракції" : faction}
      style={{ display: "block", flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="7.4" fill={colorA} />
      {isJoker &&
        QUARTERS.map((d, i) => (
          <path key={i} d={d} fill={FACTION_COLORS[ALL_FACTIONS[i]] ?? colorA} />
        ))}
      {isLeader && (
        // Друга фракція — нижня половина по діагоналі. Без градієнтів і масок:
        // трикутник поверх кола дає той самий результат і не потребує id.
        <path d="M15.4 8a7.4 7.4 0 0 1-7.4 7.4A7.4 7.4 0 0 1 .6 8z" fill={colorB} />
      )}
      <circle cx="8" cy="8" r="7.4" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      {glyphFor(main)}
    </svg>
  );
});
