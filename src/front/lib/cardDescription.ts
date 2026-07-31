/**
 * Короткі українські підписи здібностей і маркерів.
 *
 * Підписи навмисно телеграфні. Перша версія писала повні речення
 * («Вбити прихованого героя супротивника серед його героїв на столі»), і на
 * карті 100×140 вони обрізалися на півслові — гравець бачив початок фрази й
 * три крапки, що гірше за відсутність тексту.
 *
 * Орієнтир — друковані карти: там короткий дієслівний зворот плюс піктограма
 * зони. Піктограми підставляє `lib/cardart/abilityIcons.tsx` за словами, тож
 * назви зон із підписів прибирати не можна — саме до них чіпляються значки.
 */

import type { AbilityDef } from "./types";

type MarkersObj = {
  red?: number | string;
  green?: number | string;
  logic?: string;
  green_alt?: number;
  red_alt?: number;
} | undefined;

const ACTION_LABELS: Record<string, string> = {
  Kill: "Вбити героя",
  Bury: "Поховати героя",
  Guess_Kill: "Вгадати фракцію й вбити",
  Flip: "Перевернути карту",
  Look: "Підглянути карту",
  Flip_Or_Look: "Перевернути або підглянути",
  Swap: "Обміняти карти",
  Swap_Hand: "Обміняти руки",
  Draw: "Взяти карту",
  Place: "Викласти на стіл",
  Move_Markers: "Рух маркерів",
  Condition: "Умова",
  Calculation: "Маркери за ефектом",
  Kill_Random: "Вбити випадкового",
  Kill_Dual: "Вбити двох",
  PlayExtra: "Додатковий хід",
  Perform: "Повторити здібність",
  Perform_Top: "Здібність з цвинтаря",
  Perform_Self: "Здібність своєї карти",
  Bury_Perform: "Поховати з таверни й повторити",
  Draw_All_Tavern: "Забрати всю таверну",
  Reveal_Harbor: "Показати гавань",
};

/** Draw source: звідки брати карти. */
const DRAW_SOURCE_LABELS: Record<string, string> = {
  Harbor: "з гавані",
  Tavern: "з таверни",
  Graveyard: "з цвинтаря",
  other_hand: "з руки супротивника",
};

function formatDrawSource(source: string | string[] | undefined): string {
  if (!source) return "з гавані або таверни";
  if (Array.isArray(source)) {
    const parts = source.map((s) => DRAW_SOURCE_LABELS[s] ?? s);
    return parts.length > 1 ? parts.join(" або ") : parts[0] ?? "";
  }
  return DRAW_SOURCE_LABELS[source as string] ?? (source as string);
}

/** Target for Flip/Look: чию карту. */
function formatFlipLookTarget(ability: AbilityDef): string {
  const isOther = ability.target_player === "other";
  const faceDown = ability.visibility === "face_down" || !ability.visibility;
  const face = faceDown ? "приховану" : "лицьову";
  // У «Перевернути/підглянути» саме дієслово вже займає пів рядка, тож власника
  // карти опускаємо — ця здібність і так завжди спрямована на супротивника.
  if (isOther) return ability.action === "Flip_Or_Look" ? face : `${face} супротивника`;
  if (ability.action === "Look") return "свою приховану";
  return `свою ${face}`;
}

/** Parse one Move_Markers effect e.g. "-1 leading" -> "лидируючий −1". */
function formatMoveEffect(opt: string): string {
  const s = (opt || "").trim();
  const match = s.match(/^([+-]?\d+)\s+(leading|behind)$/i);
  if (!match) return opt;
  const delta = match[1].startsWith("+") ? match[1] : match[1] === "0" ? "0" : `−${match[1].replace("-", "")}`;
  const which = match[2].toLowerCase() === "leading" ? "провідний" : "задній";
  return `${which} ${delta}`;
}

/** Human-readable condition: when the ability triggers. */
const CONDITION_LABELS: Record<string, string> = {
  no_red_in_tavern: "Якщо в таверні немає червоних",
  no_undead: "Якщо у вас немає невмерлих",
  green_behind_red: "Якщо зелений позаду червоного",
  red_behind_green: "Якщо червоний позаду зеленого",
  has_red_party: "Якщо у вас є червоні",
  has_blue_black_party: "Якщо у вас є сині або чорні",
  has_face_down_undead: "Якщо є прихований невмерлий",
  has_face_down_green: "Якщо є прихований зелений",
};

/** What X is based on (for Calculation ability). */
const X_SOURCE_LABELS: Record<string, string> = {
  target_party_markers: "за героями",
  target_face_up_green: "за зеленими лицьовими",
  target_face_up_blue: "за синіми лицьовими",
  target_face_down_count: "за прихованими",
  graveyard_count: "за картами в цвинтарі",
  tavern_not_red: "за не-червоними в таверні",
  tavern_not_green: "за не-зеленими в таверні",
};

/** One-line label for ability. For Calculation, pass markers so we can describe ±X and x_source. */
export function getAbilityLabel(
  ability: AbilityDef | undefined,
  markers?: MarkersObj
): string {
  if (!ability?.action) return "";
  if (ability.action === "Condition" && ability.condition) {
    return CONDITION_LABELS[ability.condition] ?? `Умова: ${ability.condition}`;
  }
  if (ability.action === "Calculation" && ability.x_source) {
    const xSource = ability.x_source;
    const sourceText = X_SOURCE_LABELS[xSource] ?? xSource;
    const needsTargetPlayer = [
      "target_party_markers",
      "target_face_up_green",
      "target_face_up_blue",
      "target_face_down_count",
    ].includes(xSource);
    // Підказку «оберіть гравця» не пишемо: під час гри вона й так з'являється
    // в діалозі вибору цілі, а на карті вона з'їдала цілий рядок.
    const suffix = "";
    void needsTargetPlayer;
    const parts: string[] = [];
    const r = markers?.red;
    const g = markers?.green;
    if (r === "X" || r === "-X") parts.push(`${r === "X" ? "+X" : "−X"} R`);
    if (g === "X" || g === "-X") parts.push(`${g === "X" ? "+X" : "−X"} G`);
    if (parts.length) return `${parts.join(", ")} ${sourceText}`;
    return `Маркери X ${sourceText}${suffix}`;
  }
  if (ability.action === "Draw") {
    const src = formatDrawSource(ability.source as string | string[] | undefined);
    const count = ability.count;
    const n = count && count > 1 ? `${count} карти ` : "";
    return `Взяти ${n}${src}`.trim();
  }
  if (ability.action === "Flip" || ability.action === "Look" || ability.action === "Flip_Or_Look") {
    const target = formatFlipLookTarget(ability);
    const verb =
      ability.action === "Flip"
        ? "Перевернути"
        : ability.action === "Look"
          ? "Підглянути"
          : "Перевернути/підглянути";
    return `${verb} ${target}`;
  }
  if (ability.action === "Guess_Kill") {
    return "Вгадати фракцію прихованої й вбити";
  }
  if (ability.action === "Kill") {
    const isOther = ability.target_player === "other";
    const faceDown = ability.visibility === "face_down" || !ability.visibility;
    const zone = ability.target_zone?.toLowerCase().includes("party") ? " на столі" : "";
    const factionFilter = ability.filters?.fraction as string | undefined;
    // Фракцію-фільтр скорочуємо: разом із «Вбити … супротивника» повна назва
    // перекидала підпис на третій рядок, а він на карті 100×140 не поміщається.
    const factionLabel = factionFilter ? ` (${factionFilter === "Waterfolk" ? "Водні" : factionFilter === "Imperials" ? "Імперія" : factionFilter === "Highlanders" ? "Плем." : factionFilter === "Undead" ? "Невм." : factionFilter})` : "";
    if (isOther) {
      return `Вбити ${faceDown ? "приховану" : "лицьову"} супротивника${factionLabel}`;
    }
    return `Вбити свою ${faceDown ? "приховану" : "лицьову"}${factionLabel}`;
  }
  if (ability.action === "Bury") {
    return ability.target_player === "other"
      ? "Поховати героя супротивника"
      : "Поховати свого героя";
  }
  if (ability.action === "Kill_Dual") {
    const targets = ability.targets ?? [];
    if (
      targets.includes("self_face_down") &&
      targets.includes("other_face_down")
    ) {
      return "Вбити свою приховану і супротивника";
    }
  }
  if (ability.action === "Move_Markers") {
    const options = ability.options ?? [];
    const effects = ability.effects ?? [];
    if (options.length > 0) {
      // Без «Оберіть:» — саме «або» вже каже, що це вибір, а слово з'їдало рядок.
      return options.map(formatMoveEffect).join(" або ");
    }
    if (effects.length > 0) {
      const list = effects.map(formatMoveEffect).join(", ");
      return list;
    }
  }
  if (ability.action === "Perform_Self") {
    return "Повторити свою приховану";
  }
  if (ability.action === "Perform") {
    return "Повторити приховану карту";
  }
  if (ability.action === "Perform_Top") {
    return "Повторити верхню карту цвинтаря";
  }
  if (ability.action === "Bury_Perform") {
    return "Поховати карту з таверни й повторити її";
  }
  if (ability.action === "Place") {
    const src = String(ability.source ?? "hand").toLowerCase();
    const tgt = String(ability.target ?? "Party").toLowerCase();
    const faceDown = ability.visibility === "face_down";
    if (src === "hand" && tgt.includes("party")) {
      return faceDown ? "Зіграти приховано" : "Зіграти лицьовою вгору";
    }
    return "Викласти карту на стіл";
  }
  if (ability.action === "Swap") {
    const src = String(ability.source ?? "").toLowerCase();
    const tgt = String(ability.target ?? "").toLowerCase();
    if ((src === "other_party" || src.includes("other")) && (tgt === "self_hand" || tgt.includes("hand") || tgt.includes("self"))) {
      return "Забрати лицьову супротивника або обмін";
    }
    if (src === "hand" && tgt.includes("party_face_down")) {
      return "Обміняти карту з руки на свою приховану";
    }
  }
  if (ability.action === "PlayExtra") {
    return "Можна зіграти ще одного героя";
  }
  return ACTION_LABELS[ability.action] ?? ability.action;
}

/** Short text for markers: numbers, or "X за ефектом", or choice description (e.g. "+1 G або +2 G"). */
export function formatMarkersShort(markers: MarkersObj): string {
  if (!markers) return "";
  const r = markers.red;
  const g = markers.green;
  const logic = markers.logic;
  const green_alt = markers.green_alt;
  const red_alt = markers.red_alt;

  if (typeof r === "string" || typeof g === "string") return "";

  const parts: string[] = [];

  if (logic === "OR" && (green_alt != null || red_alt != null)) {
    const main = [];
    if (typeof g === "number" && g !== 0) main.push(`${g > 0 ? "+" : ""}${g} G`);
    if (typeof r === "number" && r !== 0) main.push(`${r > 0 ? "+" : ""}${r} R`);
    const alt = [];
    if (green_alt != null && green_alt !== 0) alt.push(`${green_alt > 0 ? "+" : ""}${green_alt} G`);
    if (red_alt != null && red_alt !== 0) alt.push(`${red_alt > 0 ? "+" : ""}${red_alt} R`);
    if (main.length && alt.length) return [...main, "або", ...alt].join(" ");
    if (main.length) parts.push(main.join(" "));
    if (alt.length) parts.push(alt.join(" "));
  } else if (logic === "OR_NEG") {
    // Позначки R і G лишаємо навмисно: на них чіпляються піктограми маркерів.
    const rNum = typeof r === "number" ? r : 0;
    const gNum = typeof g === "number" ? g : 0;
    const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const side = (sign: 1 | -1) =>
      [rNum !== 0 ? `${fmt(sign * rNum)} R` : "", gNum !== 0 ? `${fmt(sign * gNum)} G` : ""]
        .filter(Boolean)
        .join(" ");
    if (rNum !== 0 || gNum !== 0) return `${side(1)} або ${side(-1)}`;
    return "Плюс або мінус";
  } else if (logic === "OR_NEG_DECIDE_LEFT") {
    const rNum = typeof r === "number" ? r : 0;
    const gNum = typeof g === "number" ? g : 0;
    const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const parts: string[] = [];
    if (rNum !== 0) parts.push(`${fmt(rNum)} R або ${fmt(-rNum)} R`);
    if (gNum !== 0) parts.push(`${fmt(gNum)} G або ${fmt(-gNum)} G`);
    return parts.join(", ") || "Оберіть варіант маркерів";
  } else if (logic === "AND_OR") {
    const rNum = typeof r === "number" ? r : 0;
    const gNum = typeof g === "number" ? g : 0;
    const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const rStr = rNum !== 0 ? `${fmt(rNum)} R` : "";
    const gStr = gNum !== 0 ? `${fmt(gNum)} G` : "";
    if (rStr && gStr) return `${rStr} або ${gStr}`;
    return rStr || gStr || "R або G";
  } else {
    if (typeof r === "number" && r !== 0) parts.push(`${r > 0 ? "+" : ""}${r} R`);
    if (typeof g === "number" && g !== 0) parts.push(`${g > 0 ? "+" : ""}${g} G`);
  }

  return parts.join(", ") || "";
}
