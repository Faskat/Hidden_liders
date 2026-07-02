/**
 * Short Ukrainian labels for card ability actions, conditions and marker display.
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
  Guess_Kill: "Вгадати й вбити",
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
  Perform: "Виконати здібність героя",
  Perform_Top: "Виконати з цвинтаря",
  Perform_Self: "Виконати свою карту",
  Bury_Perform: "Поховати й виконати",
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

/** Target for Flip/Look: чию карту, де. */
function formatFlipLookTarget(ability: AbilityDef): string {
  const isOther = ability.target_player === "other";
  const inParty = ability.target_zone?.toLowerCase().includes("party");
  const faceDown = ability.visibility === "face_down" || !ability.visibility;
  const face = faceDown ? "приховану карту" : "карту";
  if (isOther) return `${face} супротивника${inParty ? " серед його героїв на столі" : ""}`.trim();
  if (ability.action === "Look") {
    return "одну зі своїх прихованих карт серед героїв на столі (побачити її). Маркери застосовуються";
  }
  return `${face} серед ваших героїв на столі (власну)`.trim();
}

/** Parse one Move_Markers effect e.g. "-1 leading" -> "лидируючий −1". */
function formatMoveEffect(opt: string): string {
  const s = (opt || "").trim();
  const match = s.match(/^([+-]?\d+)\s+(leading|behind)$/i);
  if (!match) return opt;
  const delta = match[1].startsWith("+") ? match[1] : match[1] === "0" ? "0" : `−${match[1].replace("-", "")}`;
  const which = match[2].toLowerCase() === "leading" ? "лидируючий маркер" : "маркер той що позаду";
  return `${which} ${delta}`;
}

/** Human-readable condition: when the ability triggers. */
const CONDITION_LABELS: Record<string, string> = {
  no_red_in_tavern: "Якщо в таверні немає червоних",
  no_undead: "Якщо серед ваших героїв на столі немає невмерлих",
  green_behind_red: "Якщо зелений маркер позаду червоного",
  red_behind_green: "Якщо червоний маркер позаду зеленого",
  has_red_party: "Якщо серед ваших героїв на столі є червоні",
  has_blue_black_party: "Якщо серед ваших героїв на столі є сині/чорні",
  has_face_down_undead: "Якщо є прихований невмерлий",
  has_face_down_green: "Якщо є прихований зелений",
};

/** What X is based on (for Calculation ability). */
const X_SOURCE_LABELS: Record<string, string> = {
  target_party_markers: "за кількістю героїв обраного гравця на столі",
  target_face_up_green: "за кількістю зелених лицьовою вгору (Highlanders) серед героїв обраного гравця на столі",
  target_face_up_blue: "за кількістю синіх лицьовою вгору (Waterfolk) серед героїв обраного гравця на столі",
  target_face_down_count: "за кількістю прихованих героїв обраного гравця на столі",
  graveyard_count: "за кількістю карт у цвинтарі",
  tavern_not_red: "за кількістю не-червоних карт у таверні",
  tavern_not_green: "за кількістю не-зелених карт у таверні",
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
    const suffix = needsTargetPlayer ? " При 3+ гравцях оберіть гравця." : "";
    const parts: string[] = [];
    const r = markers?.red;
    const g = markers?.green;
    if (r === "X" || r === "-X") parts.push(`Черв. ${r === "X" ? "+X" : "−X"}`);
    if (g === "X" || g === "-X") parts.push(`Зел. ${g === "X" ? "+X" : "−X"}`);
    if (parts.length) return `${parts.join(", ")} ${sourceText}.${suffix}`;
    return `Маркери X ${sourceText}.${suffix}`;
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
          : "Перевернути або підглянути";
    return `${verb} ${target}`;
  }
  if (ability.action === "Guess_Kill") {
    return "Вгадати фракцію прихованого героя супротивника серед його героїв на столі — якщо вгадали, вбити його";
  }
  if (ability.action === "Kill") {
    const isOther = ability.target_player === "other";
    const faceDown = ability.visibility === "face_down" || !ability.visibility;
    const zone = ability.target_zone?.toLowerCase().includes("party") ? " на столі" : "";
    const factionFilter = ability.filters?.fraction as string | undefined;
    const factionLabel = factionFilter ? ` (фракція ${factionFilter === "Waterfolk" ? "Водний народ" : factionFilter === "Imperials" ? "Імперія" : factionFilter === "Highlanders" ? "Племена" : factionFilter === "Undead" ? "Невмерлі" : factionFilter})` : "";
    if (isOther) {
      const face = faceDown ? "прихованого героя супротивника серед його героїв" : "героя супротивника серед його героїв";
      return `Вбити ${face}${zone}`.trim();
    }
    const face = faceDown ? "одного зі своїх прихованих героїв" : "одного зі своїх героїв";
    return `Вбити ${face}${factionLabel}${zone}`.trim();
  }
  if (ability.action === "Bury") {
    const who = ability.target_player === "other" ? "супротивника" : "свого";
    const zone = ability.target_zone?.toLowerCase().includes("party") ? "серед героїв на столі" : "";
    return `Поховати героя ${who} ${zone}`.trim();
  }
  if (ability.action === "Kill_Dual") {
    const targets = ability.targets ?? [];
    if (
      targets.includes("self_face_down") &&
      targets.includes("other_face_down")
    ) {
      return "Вбити одного свого прихованого героя та одного прихованого героя супротивника";
    }
  }
  if (ability.action === "Move_Markers") {
    const options = ability.options ?? [];
    const effects = ability.effects ?? [];
    if (options.length > 0) {
      const list = options.map(formatMoveEffect).join(" або ");
      return options.length > 1
        ? `Рух маркерів: оберіть — ${list}`
        : `Рух маркерів: ${list}`;
    }
    if (effects.length > 0) {
      const list = effects.map(formatMoveEffect).join(", ");
      return `Рух маркерів: ${list}`;
    }
  }
  if (ability.action === "Perform_Self") {
    return "Виконати здібність однієї зі своїх прихованих карт серед героїв на столі (оберіть яку)";
  }
  if (ability.action === "Perform") {
    return "Виконати здібність обраного прихованого героя серед ваших героїв на столі";
  }
  if (ability.action === "Perform_Top") {
    return "Виконати здібність верхньої карти з цвинтаря";
  }
  if (ability.action === "Bury_Perform") {
    return "Поховати карту з таверни й виконати її здібність";
  }
  if (ability.action === "Place") {
    const src = String(ability.source ?? "hand").toLowerCase();
    const tgt = String(ability.target ?? "Party").toLowerCase();
    const faceDown = ability.visibility === "face_down";
    if (src === "hand" && tgt.includes("party")) {
      return faceDown
        ? "Зіграти цю карту на стіл лицьовою вниз (приховано). Маркери застосовуються."
        : "Покласти цю карту з руки на стіл лицьовою вгору";
    }
    return "Викласти карту на стіл (у свій ряд героїв)";
  }
  if (ability.action === "Swap") {
    const src = String(ability.source ?? "").toLowerCase();
    const tgt = String(ability.target ?? "").toLowerCase();
    if ((src === "other_party" || src.includes("other")) && (tgt === "self_hand" || tgt.includes("hand") || tgt.includes("self"))) {
      return "Забрати 1 лицьову карту з героїв супротивника на столі собі в руку або обміняти її на карту з вашої руки (оберіть яку)";
    }
    if (src === "hand" && tgt.includes("party_face_down")) {
      return "Обміняти карту з руки на приховану карту серед ваших героїв на столі";
    }
  }
  if (ability.action === "PlayExtra") {
    return "Після гри цієї карти можна зіграти ще одного героя (додатковий хід)";
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
    const rNum = typeof r === "number" ? r : 0;
    const gNum = typeof g === "number" ? g : 0;
    const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const rLabel = "черв.";
    const gLabel = "зел.";
    if (rNum !== 0 || gNum !== 0) {
      const parts: string[] = [];
      if (rNum !== 0) parts.push(`${fmt(rNum)} ${rLabel}`);
      if (gNum !== 0) parts.push(`${fmt(gNum)} ${gLabel}`);
      if (parts.length) {
        const negParts: string[] = [];
        if (rNum !== 0) negParts.push(`${fmt(-rNum)} ${rLabel}`);
        if (gNum !== 0) negParts.push(`${fmt(-gNum)} ${gLabel}`);
        return `${parts.join(", ")} або ${negParts.join(", ")} (на вибір)`;
      }
    }
    return "Плюс або мінус (на вибір)";
  } else if (logic === "OR_NEG_DECIDE_LEFT") {
    const rNum = typeof r === "number" ? r : 0;
    const gNum = typeof g === "number" ? g : 0;
    const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const parts: string[] = [];
    if (rNum !== 0) parts.push(`червоний ${fmt(rNum)} або червоний ${fmt(-rNum)}`);
    if (gNum !== 0) parts.push(`зелений ${fmt(gNum)} або зелений ${fmt(-gNum)}`);
    if (parts.length) return `Оберіть один варіант маркерів: ${parts.join("; ")}`;
    return "Оберіть один з двох варіантів маркерів";
  } else if (logic === "AND_OR") {
    const rNum = typeof r === "number" ? r : 0;
    const gNum = typeof g === "number" ? g : 0;
    const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const rStr = rNum !== 0 ? `червоний ${fmt(rNum)}` : "";
    const gStr = gNum !== 0 ? `зелений ${fmt(gNum)}` : "";
    if (rStr && gStr) return `Маркери: оберіть ${rStr} або ${gStr}`;
    if (rStr || gStr) return `Маркери: ${rStr || gStr}`;
    return "Маркери: червоний або зелений (на вибір)";
  } else {
    if (typeof r === "number" && r !== 0) parts.push(`${r > 0 ? "+" : ""}${r} R`);
    if (typeof g === "number" && g !== 0) parts.push(`${g > 0 ? "+" : ""}${g} G`);
  }

  return parts.join(", ") || "";
}
