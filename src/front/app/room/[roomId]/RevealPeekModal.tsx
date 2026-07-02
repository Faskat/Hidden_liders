"use client";

import { useEffect } from "react";
import type { GameStateView } from "@/lib/types";
import { GameCard } from "./Card";

type PeekCardPayload = Record<string, unknown> & { card_id?: string; name?: string; faction?: string };

export function RevealPeekModal({
  revealHarborCardIds,
  peekCard,
  state,
  onClose,
}: {
  revealHarborCardIds: string[] | null;
  peekCard: PeekCardPayload | null;
  state: GameStateView | null;
  onClose: () => void;
}) {
  const catalog = state?.cards ?? undefined;
  const isReveal = Array.isArray(revealHarborCardIds) && revealHarborCardIds.length > 0;
  const peekId = peekCard && (peekCard.card_id ?? (peekCard as { card_id?: string }).card_id);
  const isPeek = !!peekId;
  const isOpen = isReveal || isPeek;

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cardId = peekId ?? "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-peek-title"
    >
      <div
        className="flex flex-col w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--bg)]">
          <h2 id="reveal-peek-title" className="font-display text-lg font-semibold text-[var(--accent)]">
            {isReveal && isPeek ? "Гавань та підглянута карта" : isReveal ? "Гавань" : "Підглянута карта"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
            aria-label="Закрити"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 flex flex-col items-center gap-4">
          {isReveal && (
            <div className="flex flex-wrap justify-center gap-3">
              {revealHarborCardIds!.map((cid) => (
                <GameCard
                  key={cid}
                  cardId={cid}
                  variant="open"
                  size="small"
                  catalog={catalog}
                />
              ))}
            </div>
          )}
          {isPeek && cardId && (
            <GameCard
              cardId={cardId}
              variant="open"
              size="large"
              catalog={catalog}
              name={peekCard?.name as string | undefined}
              faction={peekCard?.faction as string | undefined}
            />
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-main py-2 px-4 text-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
