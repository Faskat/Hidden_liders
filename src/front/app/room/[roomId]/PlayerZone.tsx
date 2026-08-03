"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { PlayerView, LeaderView } from "@/lib/types";
import { useCardsCatalog } from "@/app/contexts/CardsCatalogContext";
import { GameCard } from "./Card";
import { CardFan, type FanDirection } from "./CardFan";
import { CARD_SIZES, type CardSizeToken } from "@/lib/cardSizes";
import { CardBack } from "@/lib/cardart/CardBack";
import { displayName } from "@/lib/cardNames";
import {
  getHeroLimit, FACTION_STYLE, FACTION_LABEL, hoverAnchor, handCardSize, type HoverHandler,
  POSITION_ROTATION, CONTENT_INNER_ROTATION, CARD_FACE_ROTATION,
} from "./constants";
import { useZoneRef, zoneHand, zoneHidden, zoneLeader, zoneParty } from "./ZoneAnchors";
import { InFlightHide } from "./useAnimationDirector";

function isHeroRef(
  x: PlayerView["open_heroes"][number]
): x is { card_id: string; faction?: string; name?: string } {
  return typeof x === "object" && x !== null && "card_id" in x;
}

function getOpenHeroes(p: PlayerView): { card_id: string; faction?: string; name?: string }[] {
  // Страховка від дублікатів: той самий card_id не малюємо двічі
  const seen = new Set<string>();
  return p.open_heroes.filter(isHeroRef).filter((h) => {
    if (seen.has(h.card_id)) return false;
    seen.add(h.card_id);
    return true;
  });
}

function getHiddenCount(p: PlayerView): number {
  if (!Array.isArray(p.hidden_heroes) || p.hidden_heroes.length === 0) return 0;
  const first = p.hidden_heroes[0];
  return typeof first === "object" && first !== null && "count" in first
    ? (first as { count: number }).count
    : p.hidden_heroes.length;
}

/** For own player: hidden_heroes are full refs with card_id. Return list of card_ids. */
function getOwnHiddenCardIds(p: PlayerView): string[] {
  if (!Array.isArray(p.hidden_heroes)) return [];
  const ids = p.hidden_heroes
    .filter((x): x is { card_id: string } => typeof x === "object" && x !== null && "card_id" in x)
    .map((x) => x.card_id);
  return Array.from(new Set(ids));
}

export function PlayerZone({
  player,
  position,
  isMe,
  isMyTurn,
  phase,
  loading,
  onPlayCard,
  gameEnded,
  totalPlayers = 4,
  winnerPlayerId = null,
  onHoverCard,
  discardMode = false,
  selectedForDiscard = [],
  onToggleDiscardCard,
}: {
  player: PlayerView;
  position: "top" | "left" | "right" | "bottom" | "topLeft" | "topRight";
  isMe: boolean;
  isMyTurn: boolean;
  phase: string;
  loading: boolean;
  onPlayCard: (cardId: string) => void;
  gameEnded: boolean;
  totalPlayers?: number;
  winnerPlayerId?: string | null;
  onHoverCard?: HoverHandler;
  discardMode?: boolean;
  selectedForDiscard?: string[];
  onToggleDiscardCard?: (cardId: string) => void;
}) {
  const catalog = useCardsCatalog();
  const [peekLeader, setPeekLeader] = useState(false);
  const [showHiddenTooltip, setShowHiddenTooltip] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const hiddenBadgeRef = useRef<HTMLElement | null>(null);
  const ownHiddenCardIds = isMe ? getOwnHiddenCardIds(player) : [];
  // Зони цього гравця в реєстрі якорів: звідки й куди летять його карти.
  const partyZone = zoneParty(player.player_id);
  const partyRef = useZoneRef(partyZone);
  const handRef = useZoneRef(zoneHand(player.player_id));
  const hiddenRef = useZoneRef(zoneHidden(player.player_id));
  const leaderRef = useZoneRef(zoneLeader(player.player_id));
  const rotation = POSITION_ROTATION[position] ?? "0deg";
  const contentInnerRotation = CONTENT_INNER_ROTATION[position] ?? "0deg";
  const cardFaceRotation = CARD_FACE_ROTATION[position] ?? "0deg";
  const openHeroes = getOpenHeroes(player);
  const hiddenCount = getHiddenCount(player);
  const handCards = "hand_card_ids" in player ? player.hand_card_ids : [];
  const handCount = handCards.length > 0 ? handCards.length : player.hand_count ?? 0;
  const leader: LeaderView | undefined = player.leader;
  const leaderRevealed = gameEnded || isMe;
  const showLeaderOpen = leaderRevealed || (isMe && peekLeader);
  // Імена лідерів так само перекладені, як і назви героїв, — і так само лише на
  // показ: `leader.name` з бекенда лишається ключем арту.
  const leaderName =
    showLeaderOpen && leader?.name ? displayName(leader.name) || leader.name : null;
  const frac1 = showLeaderOpen && leader?.fraction_1 ? leader.fraction_1 : null;
  const frac2 = showLeaderOpen && leader?.fraction_2 ? leader.fraction_2 : null;

  const heroLimit = getHeroLimit(totalPlayers);
  const openCount = openHeroes.length;
  const isWinner = Boolean(winnerPlayerId && player.player_id === winnerPlayerId);

  const handlePeek = useCallback(() => {
    if (!isMe) return;
    setPeekLeader((p) => !p);
  }, [isMe]);

  const canPlayToParty = isMe && isMyTurn && phase === "PLAY" && !loading && !discardMode;

  const handlePartyDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData("text/plain");
      if (cardId && canPlayToParty && handCards.includes(cardId)) {
        onPlayCard(cardId);
      }
      e.dataTransfer.clearData();
    },
    [canPlayToParty, handCards, onPlayCard]
  );

  const handlePartyDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (canPlayToParty) e.dataTransfer.dropEffect = "move";
  }, [canPlayToParty]);

  const isMyBottom = isMe && position === "bottom";

  /** Один токен і для геометрії віяла, і для самих карт — інакше вони розходяться. */
  const handSize: CardSizeToken = handCardSize(position);

  const avatarState = gameEnded ? (isWinner ? "winner" : "ended") : isMyTurn ? "turn" : "idle";

  const headerContent = (
    <>
      {isMyBottom && <div className="flex-1 min-h-2 w-full" />}
      <div className="flex flex-col items-center gap-1">
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2 flex-wrap justify-center cursor-default" onMouseDown={(e) => e.stopPropagation()}>
            <span
              className={`avatar-sketch w-10 h-10 rounded-full flex items-center justify-center font-display text-lg font-semibold shrink-0 border-2 transition-all avatar-state--${avatarState}`}
              title={avatarState === "turn" ? "Ваш хід" : avatarState === "winner" ? "Переможець" : undefined}
            >
              {player.name.trim().slice(0, 1).toUpperCase() || "?"}
            </span>
            {/* For active player: no leader card; show name + role (leader) as text. For others: leader card. */}
            {!isMe && leader?.leader_card_id != null && (
              <span className="inline-block shrink-0">
                <button
                  ref={leaderRef as React.RefCallback<HTMLButtonElement>}
                  type="button"
                  className="rounded-lg overflow-hidden border-2 flex-shrink-0 transition-transform focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-default"
                  style={{ width: CARD_SIZES.leaderMini.w, height: CARD_SIZES.leaderMini.h }}
                >
                  {showLeaderOpen ? (
                    <div className="leader-peek w-full h-full bg-white/95 rounded border border-[var(--accent)]/40 shadow-lg">
                      <div className="p-1 flex flex-col justify-between h-full text-left">
                        <span className="text-[9px] font-semibold text-[#1e3a5f] truncate" title={leaderName ?? undefined}>{leaderName ?? "?"}</span>
                        <div className="flex gap-0.5 flex-wrap">
                          {frac1 && <span className={`text-[8px] px-1 py-0.5 rounded border ${FACTION_STYLE[frac1] ?? ""}`}>{FACTION_LABEL[frac1] ?? frac1}</span>}
                          {frac2 && frac2 !== frac1 && <span className={`text-[8px] px-1 py-0.5 rounded border ${FACTION_STYLE[frac2] ?? ""}`}>{FACTION_LABEL[frac2] ?? frac2}</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Та сама рубашка, що й у решти закритих карт: окрема сорочка
                    // для лідера видавала б, що ця карта — лідер.
                    <div className="w-full h-full overflow-hidden rounded">
                      <CardBack size="leaderMini" />
                    </div>
                  )}
                </button>
              </span>
            )}
            <span className={`font-medium text-sm truncate max-w-[120px] ${isMe ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
              {player.name}
            </span>
            {/* Бейдж прихованих героїв — і ціль для польотів «сорочкою вгору».
                Поки прихованих немає, зони теж немає: порожня обгортка з
                `display: contents` віддавала б нульовий прямокутник, а щоб мати
                свій прямокутник, їй довелося б займати місце і зсувати шапку
                на ширину проміжку. Політ у цьому випадку йде в загін — див.
                запасний варіант у режисері. */}
            {hiddenCount > 0 && (
              <span ref={hiddenRef} className="inline-flex">
              {isMe && ownHiddenCardIds.length > 0 ? (
                <button
                  type="button"
                  ref={hiddenBadgeRef as React.RefObject<HTMLButtonElement>}
                  className="relative tabular-nums text-xs font-semibold text-[var(--zone-label)] bg-[var(--zone-harbor-bg)] border border-[var(--zone-label)]/40 rounded-md px-1.5 py-0.5 shrink-0 min-w-[1.5rem] text-center cursor-pointer hover:ring-2 hover:ring-[var(--accent)] transition-all"
                  onClick={() => setShowHiddenModal(true)}
                  onMouseEnter={() => {
                    const el = hiddenBadgeRef.current;
                    if (el) {
                      const r = el.getBoundingClientRect();
                      setTooltipPos({ x: r.left + r.width / 2, y: r.top });
                    }
                    setShowHiddenTooltip(true);
                  }}
                  onMouseLeave={() => {
                    setShowHiddenTooltip(false);
                    setTooltipPos(null);
                  }}
                  title="Переглянути свої приховані карти"
                >
                  {hiddenCount}
                  {typeof document !== "undefined" &&
                    showHiddenTooltip &&
                    tooltipPos &&
                    createPortal(
                      <span
                        className="fixed z-[100] px-2 py-1.5 text-[11px] font-normal text-[var(--text)] bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-lg whitespace-nowrap pointer-events-none max-w-[220px] text-center"
                        style={{
                          left: tooltipPos.x,
                          top: tooltipPos.y - 8,
                          transform: "translate(-50%, -100%)",
                        }}
                        role="tooltip"
                      >
                        Клацніть щоб переглянути свої приховані карти
                      </span>,
                      document.body
                    )}
                </button>
              ) : (
                <span
                  ref={hiddenBadgeRef}
                  className="relative tabular-nums text-xs font-semibold text-[var(--zone-label)] bg-[var(--zone-harbor-bg)] border border-[var(--zone-label)]/40 rounded-md px-1.5 py-0.5 shrink-0 min-w-[1.5rem] text-center cursor-default"
                  onMouseEnter={() => {
                    const el = hiddenBadgeRef.current;
                    if (el) {
                      const r = el.getBoundingClientRect();
                      setTooltipPos({ x: r.left + r.width / 2, y: r.top });
                    }
                    setShowHiddenTooltip(true);
                  }}
                  onMouseLeave={() => {
                    setShowHiddenTooltip(false);
                    setTooltipPos(null);
                  }}
                >
                  {hiddenCount}
                  {typeof document !== "undefined" &&
                    showHiddenTooltip &&
                    tooltipPos &&
                    createPortal(
                      <span
                        className="fixed z-[100] px-2 py-1.5 text-[11px] font-normal text-[var(--text)] bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-lg whitespace-nowrap pointer-events-none max-w-[220px] text-center"
                        style={{
                          left: tooltipPos.x,
                          top: tooltipPos.y - 8,
                          transform: "translate(-50%, -100%)",
                        }}
                        role="tooltip"
                      >
                        Таємні герої: картки у стопці, закриті рубашкою до кінця гри
                      </span>,
                      document.body
                    )}
                </span>
              )}
              </span>
            )}
            {isMe && (
              <span className="bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-medium px-1.5 py-0.5 rounded shrink-0">
                Ви
              </span>
            )}
          </div>
          {/* Active player: leader as role + factions under the name */}
          {isMe && leader && (
            <div className="flex flex-col items-center gap-0.5 mt-0.5">
              <span className="text-[var(--text-muted)] text-xs">
                {showLeaderOpen && leaderName ? (
                  <>
                    Лідер: <span className="font-semibold text-[var(--text)]">{leaderName}</span>
                    {/* Раніше свого лідера можна було тільки прочитати назвою.
                        Карта з артом і фракціями — те саме, що бачать інші
                        гравці про своїх, тож нової інформації це не відкриває. */}
                    <button
                      type="button"
                      onClick={() => setShowLeaderModal(true)}
                      className="ml-1 text-[var(--accent)] hover:underline text-[10px] cursor-pointer"
                    >
                      Переглянути
                    </button>
                  </>
                ) : (
                  <>
                    Лідер: <span className="italic">приховано</span>
                    <button type="button" onClick={handlePeek} className="ml-1 text-[var(--accent)] hover:underline text-[10px]">Підглянути</button>
                  </>
                )}
              </span>
              {showLeaderOpen && (frac1 || frac2) && (
                <div className="flex gap-1 flex-wrap justify-center">
                  {frac1 && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${FACTION_STYLE[frac1] ?? ""}`}>{FACTION_LABEL[frac1] ?? frac1}</span>}
                  {frac2 && frac2 !== frac1 && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${FACTION_STYLE[frac2] ?? ""}`}>{FACTION_LABEL[frac2] ?? frac2}</span>}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Hero limit progress bar */}
        <div className="flex items-center gap-1.5 w-full max-w-[120px]">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)]/60 transition-all duration-300"
              style={{ width: `${Math.min(100, (openCount / heroLimit) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">
            {openCount}/{heroLimit}
          </span>
        </div>
      </div>
    </>
  );

  const cardsContent = (
    <>
      <div className="w-full flex justify-center overflow-visible">
        <div className="inline-block">
          <div
            ref={partyRef}
            onDrop={handlePartyDrop}
            onDragOver={handlePartyDragOver}
            className={`min-h-[80px] rounded-lg transition-colors ${canPlayToParty ? "bg-[var(--accent-soft)]/20" : ""}`}
          >
          {openHeroes.length > 0 && (
            <CardFan
              direction={position as FanDirection}
              interactive={true}
              // `getOpenHeroes` уже прибрав дублікати за card_id, тож ключ
              // унікальний без індексу — а саме індекс і заважав би картам
              // «переїжджати» після того, як одну з них забрали на цвинтар.
              items={openHeroes.map((h) => ({
                key: h.card_id,
                node: (
                  <span
                    className="inline-block"
                    onMouseEnter={(e) =>
                      onHoverCard?.({ cardId: h.card_id, isPlayed: true, anchor: hoverAnchor(e.currentTarget) })
                    }
                    onMouseLeave={() => onHoverCard?.(null)}
                  >
                    <InFlightHide zone={partyZone} cardId={h.card_id}>
                      <GameCard
                        cardId={h.card_id}
                        variant="open"
                        name={h.name}
                        faction={h.faction}
                        size="tiny"
                        catalog={catalog}
                      />
                    </InFlightHide>
                  </span>
                ),
              }))}
            />
          )}

          </div>
        </div>
      </div>

      <div className="w-full overflow-visible flex justify-center">
        <div className="inline-block" ref={handRef}>
        {isMe ? (
          handCards.length > 0 ? (
            <CardFan
              direction={position as FanDirection}
              interactive={true}
              cardSize={handSize}
              items={handCards.map((cid) => {
                const isSelectedForDiscard = discardMode && selectedForDiscard.includes(cid);
                return {
                  key: cid,
                  node: (
                  <button
                    type="button"
                    disabled={discardMode ? false : !canPlayToParty}
                    onClick={() => {
                      if (discardMode) onToggleDiscardCard?.(cid);
                      else if (canPlayToParty) onPlayCard(cid);
                    }}
                    // Прев'ю на власній руці не потрібне: карта вже показана
                    // найбільшим розміром у грі, а при наведенні ще й підіймається
                    // з віяла. Панель прев'ю тут лише накривала б сусідні карти.
                    draggable={canPlayToParty && !discardMode}
                    onDragStart={(e) => {
                      if (canPlayToParty && !discardMode) {
                        e.dataTransfer.setData("text/plain", cid);
                        e.dataTransfer.effectAllowed = "move";
                      }
                    }}
                    className={`rounded-lg overflow-hidden transition-all text-left ${
                      discardMode
                        ? isSelectedForDiscard
                          ? "ring-2 ring-[var(--red)] opacity-90"
                          : "hover:ring-2 hover:ring-[var(--text-muted)] cursor-pointer"
                        : canPlayToParty
                          ? "hover:ring-2 hover:ring-[var(--accent)]"
                          : "disabled:opacity-60 disabled:cursor-not-allowed"
                    }`}
                  >
                    <GameCard cardId={cid} variant="open" size={handSize} catalog={catalog} />
                  </button>
                  ),
                };
              })}
            />
          ) : (
            <p className="text-center text-[var(--text-muted)] text-xs py-1">Рука порожня</p>
          )
        ) : handCount > 0 ? (
          <CardFan
            direction={position as FanDirection}
            interactive={true}
            // Чужа рука — самі сорочки, і жодних id клієнт про неї не знає.
            // Індекс тут коректний ключ саме тому, що карти взаємозамінні:
            // «третя сорочка» — це позиція, а не конкретна карта.
            items={Array.from({ length: handCount }).map((_, i) => ({
              key: `hidden-${i}`,
              node: <GameCard cardId={`hidden-${i}`} variant="hidden" size="tiny" />,
            }))}
          />
        ) : (
          <p className="text-center text-[var(--text-muted)] text-xs py-1">
            Карт у руці: 0
          </p>
        )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]/80 p-3 min-w-0 cursor-default"
        style={{
          transform: `rotate(${rotation})`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`flex flex-col items-center gap-2 p-2 w-full ${isMyBottom ? "flex-1 justify-end" : ""}`}>
          <div style={{ transform: `rotate(${contentInnerRotation})` }}>
            {headerContent}
          </div>
          <div
            className="shrink-0"
            style={{
              transform: cardFaceRotation,
              width: "fit-content",
              alignSelf: "center",
            }}
          >
            {cardsContent}
          </div>
        </div>
      </div>
      {/**
        * Обидва вікна виносяться в `body` порталом.
        *
        * `position: fixed` рахується від вікна лише доти, доки над елементом
        * немає предка з `transform`. Панель гравця лежить у столі, а стіл
        * зсувається й масштабується, тому «на весь екран» перетворювалося на
        * «на весь стіл»: оверлей ставав 1903×1309, і вікно опинялося по центру
        * столу — тобто за нижнім краєм екрана. Доти це не впадало в око лише
        * тому, що стіл був завширшки приблизно як вікно.
        */}
      {showLeaderModal && isMe && leader?.leader_card_id && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
          onClick={() => setShowLeaderModal(false)}
        >
          <div
            className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-5 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-[var(--accent)]">Ваш лідер</h3>
            <GameCard
              cardId={leader.leader_card_id}
              variant="open"
              name={leader.name ?? undefined}
              faction="Leader"
              size="xlarge"
              catalog={catalog}
            />
            <p className="text-xs text-[var(--text-muted)] text-center">
              Перемагаєте, якщо на кінець гри виконана умова будь-якої з двох фракцій лідера.
            </p>
            <button
              type="button"
              onClick={() => setShowLeaderModal(false)}
              className="btn-soft w-full py-2.5 px-4 text-sm rounded-xl"
            >
              Закрити
            </button>
          </div>
        </div>,
        document.body
      )}
      {showHiddenModal && ownHiddenCardIds.length > 0 && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
          onClick={() => setShowHiddenModal(false)}
        >
          <div
            className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-md w-full mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-[var(--accent)] mb-3">
              Ваші приховані карти
            </h3>
            <div className="flex flex-wrap gap-2">
              {ownHiddenCardIds.map((cid) => (
                <div
                  key={cid}
                  className="rounded-lg overflow-hidden"
                >
                  <GameCard cardId={cid} variant="open" size="small" catalog={catalog} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowHiddenModal(false)}
              className="btn-soft mt-4 w-full py-2.5 px-4 text-sm rounded-xl"
            >
              Закрити
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
