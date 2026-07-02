"use client";

import { getWinningFaction, WIN_CONDITIONS } from "./constants";

const FACTION_LABEL: Record<string, string> = {
  Undead: "Невмерлі",
  Waterfolk: "Водний народ",
  Imperials: "Імперія",
  Highlanders: "Племена",
};

export function CurrentVictor({
  redMarker,
  greenMarker,
  compact = false,
}: {
  redMarker: number;
  greenMarker: number;
  compact?: boolean;
}) {
  const faction = getWinningFaction(redMarker, greenMarker);
  const condition = faction ? WIN_CONDITIONS.find((c) => c.faction === faction)?.condition : null;

  return (
    <div
      className="rounded-xl glass-panel px-2.5 py-1.5 border border-[var(--zone-label)]/30"
      title={condition ? `${faction}: ${condition}` : undefined}
    >
      <p className="text-[10px] uppercase tracking-wider text-[var(--zone-label)] mb-0.5 font-semibold">
        Поточний переможець
      </p>
      {faction ? (
        <p className={`font-medium text-[var(--accent)] ${compact ? "text-xs" : "text-sm"}`}>
          {FACTION_LABEL[faction] ?? faction}
        </p>
      ) : (
        <p className="text-[var(--text-muted)] text-xs italic">—</p>
      )}
    </div>
  );
}
