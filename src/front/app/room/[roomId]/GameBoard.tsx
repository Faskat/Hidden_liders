"use client";

import type { GameStateView, PlayerView } from "@/lib/types";
import { MarkerToken } from "./CentralBoard";

const PHASE_LABELS: Record<string, string> = {
  PLAY: "Гра",
  DRAW: "Брати",
  DISCARD: "Скинути",
  REFILL_TAVERN: "Поповнити таверну",
  WAITING_FOR_PLAYERS: "Очікування",
};

export function PhaseBar({
  state,
  myPlayerId,
}: {
  state: GameStateView;
  myPlayerId: string | null;
}) {
  const phase = state.current_phase;
  const isMyTurn = state.current_player_id === myPlayerId;
  const currentPlayerName = state.current_player_id
    ? state.players.find((p) => p.player_id === state.current_player_id)?.name ?? "—"
    : "—";
  return (
    <div className="flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="font-display text-lg font-semibold text-[var(--accent)]">
          Фаза: {PHASE_LABELS[phase] ?? phase}
        </span>
        <span className="text-[var(--text-muted)] text-sm">
          {isMyTurn ? "Ваш хід" : `Хід: ${currentPlayerName}`}
        </span>
      </div>
      <div className="flex gap-6 text-sm items-center">
        <span className="flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
          <MarkerToken variant="red" title="Червоний маркер" />
          <span className="text-[var(--red)]">{state.red_marker}</span>
        </span>
        <span className="flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
          <MarkerToken variant="green" title="Зелений маркер" />
          <span className="text-[var(--green)]">{state.green_marker}</span>
        </span>
      </div>
    </div>
  );
}

function getHiddenCount(p: PlayerView): number {
  if (!Array.isArray(p.hidden_heroes) || p.hidden_heroes.length === 0) return 0;
  const first = p.hidden_heroes[0];
  return typeof first === "object" && first !== null && "count" in first
    ? (first as { count: number }).count
    : p.hidden_heroes.length;
}

export function PlayerList({
  players,
  myPlayerId,
}: {
  players: PlayerView[];
  myPlayerId: string | null;
}) {
  return (
    <div>
      <h3 className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide mb-3">
        Гравці
      </h3>
      <div className="flex flex-wrap gap-3">
        {players.map((p) => {
          const isMe = p.player_id === myPlayerId;
          const handCount =
            "hand_card_ids" in p && Array.isArray(p.hand_card_ids)
              ? p.hand_card_ids.length
              : p.hand_count ?? 0;
          const hiddenCount = getHiddenCount(p);
          return (
            <div
              key={p.player_id}
              className={`panel rounded-xl px-4 py-3 min-w-[140px] ${isMe ? "ring-1 ring-[var(--accent)]/30" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--accent)] text-sm font-display font-semibold bg-[var(--accent-soft)] shrink-0">
                  {p.name.trim().slice(0, 1).toUpperCase() || "?"}
                </span>
                <span className="font-medium text-[var(--text)] truncate">{p.name}</span>
                {isMe && (
                  <span className="bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-medium px-1.5 py-0.5 rounded shrink-0">
                    Ви
                  </span>
                )}
              </div>
              <p className="text-[var(--text-muted)] text-xs">
                Карт у руці: {handCount}
                {hiddenCount > 0 && ` · Прихованих: ${hiddenCount}`}
              </p>
              {isMe && p.leader?.name && (
                <p className="text-[var(--text-muted)] text-xs mt-0.5">Лідер: {p.leader.name}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TavernSlots({
  tavern,
}: {
  tavern: ({ card_id: string; faction?: string; name?: string } | null)[];
}) {
  return (
    <div>
      <h3 className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide mb-3">
        Таверна
      </h3>
      <div className="flex gap-4 flex-wrap">
        {tavern.map((slot, i) =>
          slot ? (
            <div
              key={i}
              className="panel rounded-xl px-4 py-3 min-w-[120px] text-sm text-[var(--text)]"
            >
              {slot.name || slot.card_id}
            </div>
          ) : (
            <div
              key={i}
              className="w-[120px] h-14 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
            />
          )
        )}
      </div>
    </div>
  );
}

export function Hand({
  handCardIds,
  isMyTurn,
  phase,
  loading,
  onPlayCard,
}: {
  handCardIds: string[];
  isMyTurn: boolean;
  phase: string;
  loading: boolean;
  onPlayCard: (cardId: string) => void;
}) {
  return (
    <div>
      <h3 className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide mb-3">
        Ваша рука ({handCardIds.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {handCardIds.map((cid) => (
          <button
            key={cid}
            disabled={!isMyTurn || phase !== "PLAY" || loading}
            onClick={() => phase === "PLAY" && onPlayCard(cid)}
            className="panel px-4 py-3 rounded-xl text-sm text-[var(--text)] hover:border-[var(--accent)]/30 disabled:opacity-50 transition-colors text-left min-w-[100px]"
          >
            {cid.replace(/^hero_|^leader_/, "")}
          </button>
        ))}
      </div>
    </div>
  );
}
