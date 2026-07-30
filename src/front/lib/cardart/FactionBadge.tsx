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
  // Корона на щиті.
  Imperials: (
    <g fill="#ffffff">
      <path d="M4 5.4l1.6 1.5L8 3.9l2.4 3 1.6-1.5v5.2H4z" />
      <path d="M4 11.4h8v1.4H4z" />
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
      aria-label={faction}
      style={{ display: "block", flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="7.4" fill={colorA} />
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
