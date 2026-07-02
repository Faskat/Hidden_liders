"use client";

import { useState, useCallback } from "react";
import type { CardCatalogEntry, GameStateView, PlayCardTargets } from "@/lib/types";
import { GameCard } from "./Card";
import {
  getAbilityTargetSteps,
  getCardCandidates,
  type TargetStep,
} from "@/lib/abilityTargets";
import { useCardsCatalog } from "@/app/contexts/CardsCatalogContext";

export function PlayCardTargetModal({
  cardId,
  card,
  state,
  myPlayerId,
  onConfirm,
  onCancel,
}: {
  cardId: string;
  card: CardCatalogEntry;
  state: GameStateView;
  myPlayerId: string | null;
  onConfirm: (targets: PlayCardTargets) => void;
  onCancel: () => void;
}) {
  const catalog = useCardsCatalog();
  const steps = getAbilityTargetSteps(card, state, myPlayerId);
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<Partial<PlayCardTargets>>({});

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;
  const otherPlayers = state.players.filter((p) => p.player_id !== myPlayerId);

  const handlePlayerSelect = useCallback((playerId: string) => {
    setSelections((prev) => ({ ...prev, target_player_id: playerId }));
    setStepIndex((i) => i + 1);
  }, []);

  const handleCardSelect = useCallback(
    (candidate: { cardId?: string; isOpen: boolean; index?: number }, step?: TargetStep) => {
      const next: Partial<PlayCardTargets> = { ...selections };
      if (step?.type === "perform_target_card") {
        if (candidate.index !== undefined) next.perform_target_hidden_index = candidate.index;
        if (candidate.cardId) next.perform_target_card_id = candidate.cardId;
      } else if (step?.type === "hand_card" && (step as { handCardForSwap?: boolean }).handCardForSwap) {
        if (candidate.cardId) next.swap_hand_card_id = candidate.cardId;
      } else {
        if (candidate.index !== undefined) next.target_hidden_index = candidate.index;
        if (candidate.cardId) next.target_card_id = candidate.cardId;
      }
      setSelections(next);
      setStepIndex((i) => i + 1);
    },
    [selections]
  );

  const handleTavernSlotSelect = useCallback((slot: number) => {
    setSelections((prev) => ({ ...prev, tavern_slot: slot }));
    setStepIndex((i) => i + 1);
  }, []);

  const handleTavernSlotsSelect = useCallback((slot: number) => {
    setSelections((prev) => {
      const arr = prev.tavern_slots ?? [];
      const idx = arr.indexOf(slot);
      const next = idx >= 0 ? arr.filter((_, i) => i !== idx) : [...arr, slot];
      return { ...prev, tavern_slots: next };
    });
  }, []);

  const handleMarkerChoiceSelect = useCallback((value: string, step?: TargetStep) => {
    const next: Partial<PlayCardTargets> = { ...selections };
    if (step?.type === "marker_choice" && "andOrSide" in step && step.andOrSide) {
      next.marker_choice = "or";
      next.marker_choice_side = value;
    } else {
      next.marker_choice = value;
    }
    setSelections(next);
    setStepIndex((i) => i + 1);
  }, [selections]);

  const handleMoveMarkersOptionSelect = useCallback((index: number) => {
    setSelections((prev) => ({ ...prev, move_markers_option: index }));
    setStepIndex((i) => i + 1);
  }, []);

  const handleSourceChoiceSelect = useCallback((choice: string) => {
    setSelections((prev) => ({ ...prev, source_choice: choice }));
    setStepIndex((i) => i + 1);
  }, []);

  const handleFlipOrLookChoiceSelect = useCallback((choice: "flip" | "look") => {
    setSelections((prev) => ({ ...prev, flip_or_look_choice: choice }));
    setStepIndex((i) => i + 1);
  }, []);

  const handleTakeOrSwapChoiceSelect = useCallback((choice: "take" | "swap") => {
    setSelections((prev) => ({ ...prev, take_or_swap_choice: choice }));
    setStepIndex((i) => i + 1);
  }, []);

  const GUESS_FACTION_OPTIONS: { value: string; label: string }[] = [
    { value: "Imperials", label: "Імперія" },
    { value: "Highlanders", label: "Племена" },
    { value: "Waterfolk", label: "Водний народ" },
    { value: "Undead", label: "Невмерлі" },
  ];
  const handleFactionGuessSelect = useCallback((faction: string) => {
    setSelections((prev) => ({ ...prev, target_guessed_faction: faction }));
    setStepIndex((i) => i + 1);
  }, []);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else {
      onCancel();
    }
  }, [stepIndex, onCancel]);

  const stepTargetPlayerId =
    (currentStep?.type === "card" && ((currentStep as { targetPlayerId?: string }).targetPlayerId ?? (card.ability?.target_player !== "other" ? myPlayerId ?? undefined : undefined))) ??
    (currentStep?.type === "hidden_index" && (currentStep as { targetPlayerId?: string }).targetPlayerId);
  const currentIdx =
    state.players.length > 0 && typeof state.current_player_index === "number"
      ? Math.max(0, Math.min(state.current_player_index, state.players.length - 1))
      : state.current_player_id != null
        ? state.players.findIndex((p) => p.player_id === state.current_player_id)
        : -1;
  const opponentByIndex =
    state.players.length === 2 && currentIdx >= 0
      ? state.players[1 - currentIdx]?.player_id
      : undefined;
  const isHiddenIndexOther =
    currentStep?.type === "hidden_index" && card.ability?.target_player === "other";
  const performTargetPlayerId = currentStep?.type === "perform_target_card" ? (currentStep as { targetPlayerId?: string }).targetPlayerId : undefined;
  const me = state.players.find((p) => p.player_id === myPlayerId);
  const performedCardIdFromTop = card.ability?.action === "Perform_Top" ? state.graveyard_top?.card_id : undefined;
  const performedCardRef = (me?.hidden_heroes ?? [])[selections.target_hidden_index ?? 0];
  const performedCardIdFromHidden = typeof performedCardRef === "object" && performedCardRef !== null && "card_id" in performedCardRef ? (performedCardRef as { card_id: string }).card_id : undefined;
  const performedCardId = performedCardIdFromTop ?? performedCardIdFromHidden;
  const performedAbility = performedCardId && state.cards?.[performedCardId]?.ability;

  const targetPlayerId =
    selections.target_player_id ??
    (isHiddenIndexOther && state.players.length === 2 ? opponentByIndex : undefined) ??
    stepTargetPlayerId ??
    performTargetPlayerId ??
    (otherPlayers.length === 1 ? otherPlayers[0]?.player_id : undefined) ??
    (isHiddenIndexOther ? opponentByIndex : undefined) ??
    (isHiddenIndexOther && state.players.length === 2
      ? state.players.find((p) => p.player_id !== myPlayerId)?.player_id
      : undefined);
  const candidates = currentStep?.type === "perform_target_card" && performTargetPlayerId && performedAbility
    ? getCardCandidates(state, performTargetPlayerId, performedAbility)
    : targetPlayerId && currentStep?.type === "card"
      ? getCardCandidates(state, targetPlayerId, card.ability!)
      : targetPlayerId && currentStep?.type === "hidden_index"
        ? getCardCandidates(state, targetPlayerId, { ...card.ability!, visibility: "face_down" })
        : [];

  const handCardCandidates =
    currentStep?.type === "hand_card" && me?.hand_card_ids
      ? me.hand_card_ids.filter((id: string) => id !== cardId).map((id: string) => ({ cardId: id, isOpen: true as const, label: "" }))
      : [];

  const canSubmit = (() => {
    if (!currentStep) return stepIndex >= steps.length && steps.length > 0;
    if (currentStep.type === "player") return false;
    if (currentStep.type === "card" || currentStep.type === "hidden_index" || currentStep.type === "guess_faction") return false;
    if (currentStep.type === "hand_card" && !(currentStep as { handCardForSwap?: boolean }).handCardForSwap) return false;
    if (currentStep.type === "perform_target_card") {
      if (candidates.length > 0) return selections.perform_target_card_id !== undefined || selections.perform_target_hidden_index !== undefined;
    }
    if (currentStep.type === "tavern_slot") return selections.tavern_slot !== undefined;
    if (currentStep.type === "tavern_slots") {
      const count = "count" in currentStep ? (currentStep as { count: number }).count : 0;
      return (selections.tavern_slots?.length ?? 0) === count;
    }
    if (currentStep.type === "marker_choice") return selections.marker_choice !== undefined || selections.marker_choice_side !== undefined;
    if (currentStep.type === "move_markers_option") return selections.move_markers_option !== undefined;
    if (currentStep.type === "source_choice") return selections.source_choice !== undefined;
    if (currentStep.type === "flip_or_look_choice") return selections.flip_or_look_choice !== undefined;
    if (currentStep.type === "take_or_swap_choice") return selections.take_or_swap_choice !== undefined;
    if (currentStep.type === "hand_card" && (currentStep as { handCardForSwap?: boolean }).handCardForSwap) {
      return selections.take_or_swap_choice === "take" || selections.swap_hand_card_id !== undefined;
    }
    return true;
  })();

  const tavernSlotsComplete =
    currentStep?.type === "tavern_slots" &&
    (selections.tavern_slots?.length ?? 0) === ("count" in currentStep ? (currentStep as { count: number }).count : 0);
  const showConfirmButton =
    (stepIndex >= steps.length && steps.length > 0) ||
    (steps.length === 0) ||
    (currentStep?.type === "perform_target_card" && candidates.length === 0) ||
    tavernSlotsComplete;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <h3 className="font-display text-lg font-semibold text-[var(--accent)]">
            Оберіть ціль
          </h3>
          <p className="text-sm text-[var(--text-muted)]">{card.name}</p>

          {currentStep?.type === "player" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex flex-col gap-2">
                {otherPlayers.map((p) => (
                  <button
                    key={p.player_id}
                    type="button"
                    onClick={() => handlePlayerSelect(p.player_id)}
                    className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep?.type === "hand_card" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              {(currentStep as { handCardForSwap?: boolean }).handCardForSwap && selections.take_or_swap_choice === "take" ? (
                <p className="text-sm text-[var(--text-muted)] py-2">
                  Ви обрали просто забрати карту. Натисніть «Підтвердити».
                </p>
              ) : handCardCandidates.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-2">
                  Немає інших карт на руці для обміну (цією картою грають зараз).
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {handCardCandidates.map((c) => (
                    <button
                      key={c.cardId}
                      type="button"
                      onClick={() => handleCardSelect(c, currentStep)}
                      className="rounded-lg overflow-hidden hover:ring-2 hover:ring-[var(--accent)] transition-all"
                    >
                      <GameCard
                        cardId={c.cardId!}
                        variant="open"
                        size="small"
                        catalog={catalog}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(currentStep?.type === "card" || currentStep?.type === "hidden_index" || currentStep?.type === "perform_target_card") && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              {candidates.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-2">
                  {currentStep?.type === "perform_target_card"
                    ? "Немає цілей для здібності обраного героя на столі супротивника — можна підтвердити без цілі."
                    : (() => {
                        const targetSelf = card.ability?.target_player !== "other" || targetPlayerId === myPlayerId;
                        const who = targetSelf ? "своїх героїв" : "героїв супротивника";
                        return card.ability?.visibility === "face_down"
                          ? `Ця здібність цілить лише прихованих героїв (лицьовою вниз). Серед ${who} на столі зараз немає прихованих — усі лицьовою вгору. Натисніть «Скасувати» та оберіть іншу карту.`
                          : `Немає героїв для вибору серед ${who} на столі. Натисніть «Скасувати», щоб закрити вікно та обрати іншу карту.`;
                      })()}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {candidates.map((c) => (
                    <button
                      key={c.isOpen ? c.cardId : `hidden-${c.index}`}
                      type="button"
                      onClick={() => handleCardSelect(c, currentStep)}
                      className="rounded-lg overflow-hidden hover:ring-2 hover:ring-[var(--accent)] transition-all"
                    >
                      {c.isOpen && c.cardId ? (
                        <GameCard
                          cardId={c.cardId}
                          variant="open"
                          size="small"
                          catalog={catalog}
                        />
                      ) : (
                        <div className="w-[100px] h-[140px] rounded-lg border-2 border-[#1e3a5f] flex items-center justify-center bg-[#1e3a5f]/10 px-1">
                          <span className="text-[var(--text-muted)] text-sm text-center leading-tight">
                            {c.cardId && catalog?.[c.cardId]?.name ? catalog[c.cardId].name : c.label}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep?.type === "tavern_slot" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex gap-2">
                {state.tavern.map((slot, i) =>
                  slot ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleTavernSlotSelect(i)}
                      className="rounded-lg overflow-hidden hover:ring-2 hover:ring-[var(--accent)] transition-all"
                    >
                      <GameCard
                        cardId={slot.card_id}
                        variant="open"
                        name={slot.name}
                        faction={slot.faction}
                        size="small"
                        catalog={catalog}
                      />
                    </button>
                  ) : null
                )}
              </div>
            </div>
          )}

          {currentStep?.type === "tavern_slots" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Обрано: {(selections.tavern_slots?.length ?? 0)} / {"count" in currentStep ? (currentStep as { count: number }).count : 0}
              </p>
              <div className="flex gap-2 flex-wrap">
                {state.tavern.map((slot, i) =>
                  slot ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleTavernSlotsSelect(i)}
                      className={`rounded-lg overflow-hidden transition-all ${
                        (selections.tavern_slots?.indexOf(i) ?? -1) >= 0
                          ? "ring-2 ring-[var(--accent)]"
                          : "hover:ring-2 hover:ring-[var(--accent)]/60"
                      }`}
                    >
                      <GameCard
                        cardId={slot.card_id}
                        variant="open"
                        name={slot.name}
                        faction={slot.faction}
                        size="small"
                        catalog={catalog}
                      />
                    </button>
                  ) : null
                )}
              </div>
            </div>
          )}

          {currentStep?.type === "marker_choice" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex flex-col gap-2">
                {currentStep.choices.map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => handleMarkerChoiceSelect(ch.value, currentStep)}
                    className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep?.type === "move_markers_option" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex flex-col gap-2">
                {currentStep.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleMoveMarkersOptionSelect(i)}
                    className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep?.type === "source_choice" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex flex-col gap-2">
                {currentStep.choices.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => handleSourceChoiceSelect(ch)}
                    className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                  >
                    {ch === "Tavern" ? "Таверна" : ch === "Harbor" ? "Гавань" : ch}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep?.type === "flip_or_look_choice" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleFlipOrLookChoiceSelect("flip")}
                  className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                >
                  Перевернути (відкрити карту)
                </button>
                <button
                  type="button"
                  onClick={() => handleFlipOrLookChoiceSelect("look")}
                  className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                >
                  Підглянути (лише переглянути)
                </button>
              </div>
            </div>
          )}

          {currentStep?.type === "take_or_swap_choice" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleTakeOrSwapChoiceSelect("take")}
                  className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                >
                  Просто забрати собі в руку
                </button>
                <button
                  type="button"
                  onClick={() => handleTakeOrSwapChoiceSelect("swap")}
                  className="panel rounded-xl px-4 py-3 text-left hover:ring-2 hover:ring-[var(--accent)] transition-all"
                >
                  Обміняти на карту з вашої руки
                </button>
              </div>
            </div>
          )}

          {currentStep?.type === "guess_faction" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{currentStep.label}</p>
              <div className="flex flex-wrap gap-2">
                {GUESS_FACTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleFactionGuessSelect(opt.value)}
                    className="panel rounded-xl px-4 py-3 hover:ring-2 hover:ring-[var(--accent)] transition-all"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!currentStep && !showConfirmButton && (
            <p className="text-sm text-[var(--text-muted)]">Немає цілей для вибору.</p>
          )}
          {!currentStep && showConfirmButton && (
            <p className="text-sm text-[var(--text-muted)]">Усі вибори зроблено. Натисніть «Підтвердити».</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="btn-soft flex-1 py-2.5 px-4 text-sm rounded-xl"
            >
              {stepIndex > 0 ? "Назад" : "Скасувати"}
            </button>
            {showConfirmButton && (
              <button
                type="button"
                onClick={() => {
                  const payload = { ...selections };
                  if ((card.ability?.action === "Perform" || card.ability?.action === "Perform_Self") && payload.target_hidden_index === undefined) {
                    payload.target_hidden_index = 0;
                  }
                  onConfirm(payload as PlayCardTargets);
                }}
                className="btn-main flex-1 py-2.5 px-4 text-sm rounded-xl"
              >
                Підтвердити
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
