/**
 * Helpers for determining when PlayCard needs target selection and what steps to show.
 */

import type { AbilityDef, CardCatalogEntry, GameStateView, PlayCardTargets } from "./types";

export type TargetStep =
  | { type: "player"; label: string }
  | { type: "card"; label: string; targetPlayerId?: string }
  | { type: "hand_card"; label: string; handCardForSwap?: boolean }
  | { type: "hidden_index"; label: string; targetPlayerId?: string }
  | { type: "guess_faction"; label: string }
  | { type: "perform_target_card"; label: string; targetPlayerId?: string }
  | { type: "tavern_slot"; label: string }
  | { type: "tavern_slots"; label: string; count: number }
  | { type: "marker_choice"; label: string; choices: { value: string; label: string }[]; andOrSide?: boolean }
  | { type: "move_markers_option"; label: string; options: string[] }
  | { type: "source_choice"; label: string; choices: string[] }
  | { type: "flip_or_look_choice"; label: string }
  | { type: "take_or_swap_choice"; label: string };

/** Whether the card/ability requires showing the target selection modal before PlayCard. */
export function abilityNeedsTargetSelection(
  card: CardCatalogEntry | undefined,
  state: GameStateView
): boolean {
  if (!card) return false;
  const ability = card.ability;
  const action = ability?.action;
  const numPlayers = state.players.length;
  const markers = card.markers;

  // Marker choice only (no ability): AND_OR, OR_NEG, etc. — still need modal
  if (markers) {
    const logic = markers.logic;
    if (logic === "OR" && (markers.green_alt != null || markers.red_alt != null)) return true;
    if (logic === "OR_NEG") return true;
    if (logic === "OR_NEG_DECIDE_LEFT") return true;
    if (logic === "AND_OR") return true;
  }

  if (!ability) return false;
  // Swap_Hand: no targets (single opponent)
  if (action === "Swap_Hand") return false;
  if (action === "Condition" || action === "Calculation") return false;
  if (action === "Place" && !ability.target_zone) return false;

  // Perform, Perform_Self: need modal when we have hidden heroes so we can collect target for performed ability (e.g. Bury)
  if (action === "Perform" || action === "Perform_Self") {
    const me = state.players.find((p) => p.player_id === state.current_player_id);
    if (me && getHiddenCount(me) >= 1) return true;
  }
  // Perform_Top: need modal only when top of graveyard has an ability that needs a target (Kill/Bury/Guess_Kill on opponent)
  if (action === "Perform_Top") {
    const topId = state.graveyard_top?.card_id;
    const topAbility = topId && state.cards?.[topId]?.ability;
    if (topAbility && (topAbility.action === "Kill" || topAbility.action === "Bury" || topAbility.action === "Guess_Kill") && topAbility.target_player === "other") {
      const other = state.players.find((p) => p.player_id !== state.current_player_id);
      if (other) return true;
    }
  }
  // Bury_Perform: need tavern_slot when multiple slots filled
  if (action === "Bury_Perform") {
    const filled = state.tavern.filter(Boolean).length;
    return filled > 1;
  }

  // Guess_Kill: always need modal when opponent has any hidden hero (to guess faction)
  if (action === "Guess_Kill") {
    const other = state.players.find((p) => p.player_id !== state.current_player_id);
    if (!other) return false;
    if (getHiddenCount(other) >= 1) return true;
    return false;
  }

  // Kill, Bury, Kill_Random, Flip, Look, Flip_Or_Look: need target if 3+ players or multiple cards
  if (action === "Kill" || action === "Bury" || action === "Kill_Random" || action === "Flip" || action === "Look" || action === "Flip_Or_Look") {
    if (numPlayers >= 3) return true;
    if (action === "Kill_Random") return false;
    const other = state.players.find((p) => p.player_id !== state.current_player_id);
    if (!other) return false;
    const hiddenCount = getHiddenCount(other);
    const openCount = getOpenHeroes(other).length;
    if (action === "Flip" || action === "Look") return hiddenCount > 1;
    if (action === "Flip_Or_Look") return hiddenCount >= 1;
    return openCount + hiddenCount > 1;
  }

  // Swap: need target when source/target involve other player or tavern, or hand <-> party_face_down
  if (action === "Swap") {
    const src = ability.source;
    const tgt = (ability.target ?? "").toString().toLowerCase();
    if (typeof src === "string" && (src.includes("other") || src === "Tavern")) return true;
    if (Array.isArray(src) && src.length > 1) return true;
    if (typeof ability.target === "string" && ability.target.includes("other")) return true;
    const tavernSlots = state.tavern.filter(Boolean).length;
    if (src === "Tavern" && tavernSlots > 1) return true;
    // hand <-> party_face_down: choose card from hand and/or which hidden
    if (src === "hand" && (tgt.includes("party_face_down") || tgt.includes("party"))) {
      const me = state.players.find((p) => p.player_id === state.current_player_id);
      const handCount = me?.hand_card_ids?.length ?? 0;
      const selfHiddenCount = me ? getHiddenCount(me) : 0;
      if (handCount > 1 || selfHiddenCount > 1) return true;
    }
    return false;
  }

  // Draw: need choice when source is array or multiple tavern slots (or multi-pick when count > 1)
  if (action === "Draw") {
    const src = ability.source;
    const drawCount = Math.max(1, Number(ability.count) || 1);
    if (Array.isArray(src) && src.length > 1) return true;
    if (src === "Tavern") {
      const filled = state.tavern.filter(Boolean).length;
      if (drawCount > 1) return filled >= drawCount;
      return filled > 1;
    }
    return false;
  }

  // Move_Markers: need choice when options exist
  if (action === "Move_Markers" && ability.options && ability.options.length > 1) return true;

  // Calculation with X/-X markers: need target_player_id when x_source requires it
  const xSource = ability.x_source;
  const needsTargetForX =
    xSource &&
    (xSource === "target_party_markers" ||
      xSource === "target_face_up_green" ||
      xSource === "target_face_up_blue" ||
      xSource === "target_face_down_count");
  if (needsTargetForX && markers && (markers.red === "X" || markers.red === "-X" || markers.green === "X" || markers.green === "-X")) {
    if (numPlayers >= 3) return true;
  }

  return false;
}

function getOpenHeroes(p: GameStateView["players"][number]): { card_id: string }[] {
  return (p.open_heroes ?? []).filter(
    (x): x is { card_id: string } => typeof x === "object" && x !== null && "card_id" in x
  );
}

function getHiddenCount(p: GameStateView["players"][number]): number {
  const raw = p.hidden_heroes ?? [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return 0;
    const first = raw[0];
    if (typeof first === "object" && first !== null && "count" in first) return (first as { count: number }).count;
    return raw.length;
  }
  if (typeof raw === "object" && raw !== null && "count" in raw) return (raw as { count: number }).count;
  return 0;
}

/** Get the steps to show in the target modal for this ability. */
export function getAbilityTargetSteps(
  card: CardCatalogEntry | undefined,
  state: GameStateView,
  myPlayerId: string | null
): TargetStep[] {
  const steps: TargetStep[] = [];
  if (!card) return steps;
  const ability = card.ability;
  const action = ability?.action;
  const numPlayers = state.players.length;
  const markers = card.markers;

  const otherPlayers = state.players.filter((p) => p.player_id !== myPlayerId);

  const xSource = ability?.x_source;
  const needsTargetForX =
    xSource &&
    ["target_party_markers", "target_face_up_green", "target_face_up_blue", "target_face_down_count"].includes(xSource);
  const hasXMarkers =
    markers && (markers.red === "X" || markers.red === "-X" || markers.green === "X" || markers.green === "-X");

  // Step 0: Select player for Calculation X (when 3+ players and markers use X from target)
  if (numPlayers >= 3 && needsTargetForX && hasXMarkers) {
    steps.push({ type: "player", label: "Оберіть гравця (для ефекту маркерів)" });
  }

  // Step 1: Select player (for 3+ players when target is "other")
  if (
    ability &&
    numPlayers >= 3 &&
    (action === "Kill" || action === "Bury" || action === "Guess_Kill" || action === "Kill_Random" || action === "Flip" || action === "Look" || action === "Flip_Or_Look" || action === "Swap")
  ) {
    const needsPlayer =
      action === "Swap"
        ? (typeof ability.source === "string" && ability.source.includes("other")) ||
          (typeof ability.target === "string" && ability.target.includes("other"))
        : ability.target_player === "other" || action === "Kill" || action === "Bury" || action === "Guess_Kill" || action === "Kill_Random";
    if (needsPlayer && otherPlayers.length > 1) {
      steps.push({ type: "player", label: "Оберіть гравця" });
    }
  }

  // Step 2: Select card or hidden index
  if (ability && (action === "Kill" || action === "Bury" || action === "Guess_Kill")) {
    const isOther = ability.target_player === "other";
    const targetId = isOther && otherPlayers.length === 1
      ? otherPlayers[0]?.player_id
      : isOther && state.players.length === 2 && state.players.length > 0
        ? state.players[1 - Math.max(0, Math.min(state.current_player_index ?? 0, state.players.length - 1))]?.player_id
        : undefined;
    const faceDown = ability.visibility === "face_down" || !ability.visibility;
    const cardStepLabel =
      action === "Guess_Kill"
        ? "Оберіть героя на столі"
        : isOther
          ? (faceDown ? "Оберіть прихованого героя супротивника на столі" : "Оберіть героя супротивника на столі")
          : (faceDown ? "Оберіть свого прихованого героя на столі" : "Оберіть свого героя на столі");
    // Always set targetPlayerId so modal uses correct player (self vs other); for self-target always pass myPlayerId
    steps.push({
      type: "card",
      label: cardStepLabel,
      ...(isOther ? (targetId ? { targetPlayerId: targetId } : {}) : { targetPlayerId: myPlayerId ?? undefined }),
    });
    if (action === "Guess_Kill") {
      steps.push({ type: "guess_faction", label: "Вгадайте фракцію обраного героя" });
    }
  }
  if (ability && (action === "Flip" || action === "Look" || action === "Flip_Or_Look")) {
    let flipTargetId: string | undefined;
    if (ability.target_player === "other") {
      if (otherPlayers.length === 1) {
        flipTargetId = otherPlayers[0]?.player_id;
      } else if (state.players.length === 2 && state.players.length > 0) {
        const curIdx = Math.max(0, Math.min(state.current_player_index ?? 0, state.players.length - 1));
        const otherIdx = 1 - curIdx;
        flipTargetId = state.players[otherIdx]?.player_id;
      }
    }
    steps.push({
      type: "hidden_index",
      label: ability.target_player === "other" ? "Оберіть приховану карту супротивника" : "Оберіть приховану карту",
      ...(flipTargetId ? { targetPlayerId: flipTargetId } : {}),
    });
    if (action === "Flip_Or_Look") {
      steps.push({ type: "flip_or_look_choice", label: "Оберіть дію: перевернути чи лише підглянути" });
    }
  }
  if (ability && (action === "Perform" || action === "Perform_Self")) {
    const me = state.players.find((p) => p.player_id === myPlayerId);
    const selfHiddenCount = me ? getHiddenCount(me) : 0;
    // Always show "choose your hidden hero" first (even when only one), so performed ability target comes after
    if (selfHiddenCount >= 1) {
      steps.push({
        type: "hidden_index",
        label: action === "Perform_Self" ? "Оберіть яку зі своїх прихованих карт на столі" : "Оберіть приховану карту (вашу)",
        targetPlayerId: myPlayerId ?? undefined,
      });
    }
    const otherId = otherPlayers.length === 1 ? otherPlayers[0]?.player_id : state.players.length === 2 ? state.players[1 - Math.max(0, Math.min(state.current_player_index ?? 0, state.players.length - 1))]?.player_id : undefined;
    if (otherId) {
      steps.push({
        type: "perform_target_card",
        label: "Оберіть ціль здібності обраного героя (герой супротивника)",
        targetPlayerId: otherId,
      });
    }
  }
  if (ability && action === "Perform_Top") {
    const topId = state.graveyard_top?.card_id;
    const topAbility = topId && state.cards?.[topId]?.ability;
    const needsTarget = topAbility && (topAbility.action === "Kill" || topAbility.action === "Bury" || topAbility.action === "Guess_Kill") && topAbility.target_player === "other";
    const otherId = otherPlayers.length === 1 ? otherPlayers[0]?.player_id : state.players.length === 2 ? state.players[1 - Math.max(0, Math.min(state.current_player_index ?? 0, state.players.length - 1))]?.player_id : undefined;
    if (needsTarget && otherId) {
      steps.push({
        type: "perform_target_card",
        label: "Оберіть ціль здібності верхньої карти з цвинтаря (герой супротивника)",
        targetPlayerId: otherId,
      });
    }
  }
  if (ability && action === "Bury_Perform") {
    const filled = state.tavern.filter(Boolean).length;
    if (filled > 1) steps.push({ type: "tavern_slot", label: "Оберіть карту в таверні" });
  }
  if (ability && action === "Swap") {
    const src = ability.source;
    const tgt = (ability.target ?? "").toString().toLowerCase();
    if (src === "Tavern") {
      const filled = state.tavern.filter(Boolean).length;
      if (filled > 1) steps.push({ type: "tavern_slot", label: "Оберіть слот таверни" });
    } else if (typeof src === "string" && src.includes("other") && (src.includes("party") || src === "other_party")) {
      const otherId = myPlayerId && otherPlayers.length === 1 ? otherPlayers[0]?.player_id : undefined;
      steps.push({
        type: "card",
        label: "Оберіть героя супротивника на столі",
        ...(otherId ? { targetPlayerId: otherId } : {}),
      });
      if (tgt === "self_hand" || (tgt.includes("self") && tgt.includes("hand"))) {
        steps.push({ type: "take_or_swap_choice", label: "Забрати карту собі в руку чи обміняти на карту з вашої руки?" });
        steps.push({ type: "hand_card", label: "Оберіть карту з руки для обміну (якщо обрали обміняти)", handCardForSwap: true });
      }
    } else if (typeof src === "string" && src.includes("other")) {
      const otherId = myPlayerId && otherPlayers.length === 1 ? otherPlayers[0]?.player_id : undefined;
      steps.push({
        type: "card",
        label: "Оберіть героя супротивника на столі",
        ...(otherId ? { targetPlayerId: otherId } : {}),
      });
    } else if (src === "hand" && (tgt.includes("party_face_down") || tgt.includes("party"))) {
      const me = state.players.find((p) => p.player_id === myPlayerId);
      const handCount = me?.hand_card_ids?.length ?? 0;
      const selfHiddenCount = me ? getHiddenCount(me) : 0;
      if (handCount > 1) steps.push({ type: "hand_card", label: "Оберіть карту з руки для обміну" });
      if (selfHiddenCount > 1) steps.push({ type: "hidden_index", label: "Оберіть приховану карту на столі", targetPlayerId: myPlayerId ?? undefined });
    }
  }

  // Draw: source choice or tavern slot(s)
  if (action === "Draw") {
    const src = ability.source;
    const drawCount = Math.max(1, Number(ability.count) || 1);
    if (Array.isArray(src) && src.length > 1) {
      steps.push({
        type: "source_choice",
        label: "Оберіть джерело",
        choices: src,
      });
    } else if (src === "Tavern") {
      const filled = state.tavern.filter(Boolean).length;
      if (drawCount > 1 && filled >= drawCount) {
        steps.push({
          type: "tavern_slots",
          label: drawCount === 2 ? "Оберіть дві карти в таверні" : `Оберіть ${drawCount} карти в таверні`,
          count: drawCount,
        });
      } else if (filled > 1) {
        steps.push({ type: "tavern_slot", label: "Оберіть слот таверни" });
      }
    }
  }

  // Move_Markers: option index
  if (ability && action === "Move_Markers" && ability.options && ability.options.length > 1) {
    steps.push({
      type: "move_markers_option",
      label: "Оберіть варіант ефекту",
      options: ability.options,
    });
  }

  // Marker choice: OR / OR_NEG / AND_OR
  if (markers) {
    const logic = markers.logic;
    if (logic === "OR" && (markers.green_alt != null || markers.red_alt != null)) {
      const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "0");
      const primaryParts: string[] = [];
      if (typeof markers.red === "number" && markers.red !== 0) primaryParts.push(`${fmt(markers.red)} R`);
      if (typeof markers.green === "number" && markers.green !== 0) primaryParts.push(`${fmt(markers.green)} G`);
      const primaryLabel = primaryParts.length ? primaryParts.join(", ") : "Основний";
      const choices: { value: string; label: string }[] = [{ value: "primary", label: primaryLabel }];
      if (markers.red_alt != null) {
        choices.push({ value: "red_alt", label: `${fmt(markers.red_alt)} R` });
      }
      if (markers.green_alt != null) {
        choices.push({ value: "green_alt", label: `${fmt(markers.green_alt)} G` });
      }
      steps.push({
        type: "marker_choice",
        label: "Оберіть варіант маркерів",
        choices,
      });
    }
    if (logic === "OR_NEG") {
      steps.push({
        type: "marker_choice",
        label: "Оберіть напрямок",
        choices: [
          { value: "primary", label: "Плюс" },
          { value: "neg", label: "Мінус" },
        ],
      });
    }
    if (logic === "OR_NEG_DECIDE_LEFT") {
      const r = typeof markers.red === "number" ? markers.red : 0;
      const g = typeof markers.green === "number" ? markers.green : 0;
      const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
      const leftParts: string[] = [];
      const rightParts: string[] = [];
      if (r !== 0) {
        leftParts.push(`${fmt(r)} черв.`);
        rightParts.push(`${fmt(-r)} черв.`);
      }
      if (g !== 0) {
        leftParts.push(`${fmt(g)} зел.`);
        rightParts.push(`${fmt(-g)} зел.`);
      }
      const leftLabel = leftParts.length && rightParts.length ? leftParts.join(", ") : leftParts[0] || "Варіант 1";
      const rightLabel = rightParts.length ? rightParts.join(", ") : rightParts[0] || "Варіант 2";
      steps.push({
        type: "marker_choice",
        label: "Оберіть один варіант маркерів",
        choices: [
          { value: "left", label: leftLabel },
          { value: "right", label: rightLabel },
        ],
      });
    }
    if (logic === "AND_OR") {
      steps.push({
        type: "marker_choice",
        label: "Оберіть маркер",
        andOrSide: true,
        choices: [
          { value: "red", label: "Червоний" },
          { value: "green", label: "Зелений" },
        ],
      });
    }
  }

  return steps;
}

function matchesAbilityFilters(
  cardId: string | undefined,
  cards: Record<string, { faction?: string }> | undefined,
  filters: Record<string, unknown> | undefined
): boolean {
  if (!filters || !cardId) return true;
  const entry = cards?.[cardId];
  const faction = (entry?.faction ?? "").trim();
  const wantFraction = typeof filters.fraction === "string" ? (filters.fraction as string).trim() : "";
  const notFraction = typeof filters.not_fraction === "string" ? (filters.not_fraction as string).trim() : "";
  if (wantFraction && faction !== wantFraction) return false;
  if (notFraction && faction === notFraction) return false;
  return true;
}

/** Get candidates for card selection (open + hidden by index). Used for Kill, Bury, Swap. Applies ability filters (fraction, not_fraction) so only valid targets are shown. */
export function getCardCandidates(
  state: GameStateView,
  targetPlayerId: string,
  ability: AbilityDef
): { cardId?: string; isOpen: boolean; index?: number; label: string }[] {
  const p = state.players.find((x) => x.player_id === targetPlayerId);
  if (!p) return [];
  const out: { cardId?: string; isOpen: boolean; index?: number; label: string }[] = [];
  const visibility = ability.visibility ?? "face_down";
  const filters = ability.filters;
  const catalog = state.cards ?? {};
  const openHeroes = getOpenHeroes(p);
  const hiddenCount = getHiddenCount(p);
  const hiddenRefs = (p.hidden_heroes ?? []).filter(
    (x): x is { card_id: string } => typeof x === "object" && x !== null && "card_id" in x
  );

  if (visibility !== "face_up") {
    for (let i = 0; i < hiddenCount; i++) {
      const cardId = hiddenRefs[i]?.card_id;
      if (!matchesAbilityFilters(cardId, catalog, filters)) continue;
      out.push({ cardId, isOpen: false, index: i, label: `Прихована ${i + 1}` });
    }
  }
  if (visibility !== "face_down") {
    openHeroes.forEach((h) => {
      if (!matchesAbilityFilters(h.card_id, catalog, filters)) return;
      out.push({ cardId: h.card_id, isOpen: true, label: h.card_id });
    });
  }
  return out;
}
