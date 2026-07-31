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
 *
 * ГОЛОВНЕ ПРАВИЛО: жодного підпису «взагалі». У колоді 50 різних форм
 * здібностей, і кожна мусить мати свій текст. Загальні заглушки на кшталт
 * «Обміняти карти» гірші за нуль: гравець бачить підпис, вірить йому й не
 * дізнається ні що з чим міняється, ні куди підуть карти. Тому `ACTION_LABELS`
 * — це аварійний вихід для форм, яких у даних немає, а не робочий шлях.
 */

import type { AbilityDef } from "./types";

type MarkersObj = {
  red?: number | string;
  green?: number | string;
  logic?: string;
  green_alt?: number;
  red_alt?: number;
} | undefined;

/** Останній рубіж: форма здібності, якої немає в жодній із 72 карт колоди. */
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

/** Скорочені назви фракцій: повні не вміщаються в рядок разом із дієсловом. */
const FRACTION_SHORT: Record<string, string> = {
  Waterfolk: "Водні",
  Imperials: "Імперія",
  Highlanders: "Плем.",
  Undead: "Невм.",
};

/**
 * Родовий відмінок — для зворотів на кшталт «крім …».
 *
 * Окрема таблиця, а не відмінювання на льоту: назв усього чотири, а будь-яке
 * правило дало б «крім Імперія».
 */
const FRACTION_GENITIVE: Record<string, string> = {
  Waterfolk: "Водних",
  Imperials: "Імперії",
  Highlanders: "Племен",
  Undead: "Невмерлих",
};

function shortFraction(f: unknown): string {
  const s = String(f ?? "");
  return FRACTION_SHORT[s] ?? s;
}

function genitiveFraction(f: unknown): string {
  const s = String(f ?? "");
  return FRACTION_GENITIVE[s] ?? s;
}

/** Звідки брати карти. */
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

/**
 * Куди лягають узяті карти.
 *
 * Це не декоративна подробиця: «взяти 2 з таверни» і «взяти 2 з таверни, одна
 * на стіл, одна в пустош» — різні ходи, а старий підпис показував їх однаково.
 */
const ZONE_SHORT: Record<string, string> = {
  Party: "на стіл",
  Party_face_down: "приховано",
  Wilderness: "у пустош",
  Hand: "у руку",
  hand: "у руку",
};

function formatDistribution(dist: Record<string, number | "rest"> | undefined): string {
  if (!dist) return "";
  const parts = Object.entries(dist).map(([zone, n]) => {
    const where = ZONE_SHORT[zone] ?? zone;
    return n === "rest" ? `решта ${where}` : `${n} ${where}`;
  });
  return parts.join(", ");
}

/** Чию карту чіпаємо. Порожній рядок = будь-чию (у даних це відсутній target_player). */
function ownerSuffix(ability: AbilityDef): string {
  if (ability.target_player === "other") return " супротивника";
  if (ability.target_player === "self") return " свою";
  return "";
}

function faceWord(ability: AbilityDef, plural = false): string {
  const faceDown = ability.visibility === "face_down" || !ability.visibility;
  if (plural) return faceDown ? "приховані" : "лицьові";
  return faceDown ? "приховану" : "лицьову";
}

/** Ціль Flip/Look: чию карту. */
function formatFlipLookTarget(ability: AbilityDef): string {
  const isOther = ability.target_player === "other";
  const face = faceWord(ability);
  // У «Перевернути/підглянути» саме дієслово вже займає пів рядка, тож власника
  // карти опускаємо — ця здібність і так завжди спрямована на супротивника.
  if (isOther) return ability.action === "Flip_Or_Look" ? face : `${face} супротивника`;
  if (ability.action === "Look") return "свою приховану";
  return `свою ${face}`;
}

/** Один ефект Move_Markers: «-1 leading» → «провідний −1». */
function formatMoveEffect(opt: string): string {
  const s = (opt || "").trim();
  const match = s.match(/^([+-]?\d+)\s+(leading|behind)$/i);
  if (!match) return opt;
  const delta = match[1].startsWith("+") ? match[1] : match[1] === "0" ? "0" : `−${match[1].replace("-", "")}`;
  const which = match[2].toLowerCase() === "leading" ? "провідний" : "задній";
  return `${which} ${delta}`;
}

/**
 * Склеює ефекти Move_Markers, не повторюючи назву маркера двічі.
 *
 * «провідний −1 або провідний −3» — технічно правильно й нечитабельно; на карті
 * це два зайвих слова там, де кожне на рахунку. Якщо всі ефекти про один і той
 * самий маркер, називаємо його один раз.
 */
function joinMoveEffects(list: readonly string[], sep: string): string {
  const parts = list.map(formatMoveEffect);
  const heads = parts.map((s) => s.split(" ")[0]);
  const same = heads.every((h) => h === heads[0]) && parts.length > 1;
  if (!same) return parts.join(sep);
  const tails = parts.map((s) => s.slice(heads[0].length + 1));
  return `${heads[0]} ${tails.join(sep)}`;
}

/** Коли здібність спрацьовує. */
const CONDITION_LABELS: Record<string, string> = {
  no_red_in_tavern: "Якщо в таверні немає червоних",
  no_undead: "якщо немає невмерлих",
  green_behind_red: "Якщо зелений позаду червоного",
  red_behind_green: "Якщо червоний позаду зеленого",
  has_red_party: "Якщо у вас є червоні",
  has_blue_black_party: "Якщо у вас є сині або чорні",
  has_face_down_undead: "Якщо є прихований невмерлий",
  has_face_down_green: "Якщо є прихований зелений",
};

/** Від чого рахується X у здібності Calculation. */
const X_SOURCE_LABELS: Record<string, string> = {
  target_party_markers: "за героями цілі",
  target_face_up_green: "за зеленими лицьовими",
  target_face_up_blue: "за синіми лицьовими",
  target_face_down_count: "за прихованими",
  graveyard_count: "за картами цвинтаря",
  tavern_not_red: "за не-червоними в таверні",
  tavern_not_green: "за не-зеленими в таверні",
};

/** Куди кладемо взяту карту (для Draw з явним target). */
function drawTargetSuffix(ability: AbilityDef): string {
  const tgt = String(ability.target ?? "").toLowerCase();
  if (!tgt) return "";
  const faceDown = ability.visibility === "face_down";
  if (tgt.includes("party")) return faceDown ? " і зіграти приховано" : " і зіграти на стіл";
  return "";
}

/** Однорядковий підпис здібності. */
export function getAbilityLabel(
  ability: AbilityDef | undefined,
  markers?: MarkersObj
): string {
  if (!ability?.action) return "";
  const a: AbilityDef & { action: string } = { ...ability, action: ability.action };

  if (a.action === "Condition" && a.condition) {
    const label = CONDITION_LABELS[a.condition] ?? `Умова: ${a.condition}`;
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  if (a.action === "Calculation" && a.x_source) {
    const sourceText = X_SOURCE_LABELS[a.x_source] ?? a.x_source;
    const parts: string[] = [];
    const r = markers?.red;
    const g = markers?.green;
    if (r === "X" || r === "-X") parts.push(`${r === "X" ? "+X" : "−X"} R`);
    if (g === "X" || g === "-X") parts.push(`${g === "X" ? "+X" : "−X"} G`);
    // Підказку «оберіть гравця» не пишемо: під час гри вона й так з'являється
    // в діалозі вибору цілі, а на карті вона з'їдала цілий рядок.
    if (parts.length) return `${parts.join(", ")} ${sourceText}`;
    return `Маркери X ${sourceText}`;
  }

  if (a.action === "Draw") {
    const src = formatDrawSource(a.source as string | string[] | undefined);
    const dist = formatDistribution(a.distribution);
    const n = a.count && a.count > 1 ? `${a.count} карти ` : "";
    if (dist) return `Взяти ${n}${src}: ${dist}`;
    return `Взяти ${n}${src}${drawTargetSuffix(a)}`.trim();
  }

  if (a.action === "Draw_All_Tavern") {
    const dist = formatDistribution(a.distribution);
    return dist ? `Забрати всю таверну: ${dist}` : "Забрати всю таверну";
  }

  if (a.action === "Flip" || a.action === "Look" || a.action === "Flip_Or_Look") {
    const target = formatFlipLookTarget(a);
    const count = a.action === "Look" && a.count && a.count > 1 ? `${a.count} ` : "";
    const plural = count ? faceWord(a, true) : target;
    const verb =
      a.action === "Flip"
        ? "Перевернути"
        : a.action === "Look"
          ? "Підглянути"
          : "Перевернути/підглянути";
    if (count) return `${verb} ${count}${plural} супротивника`;
    return `${verb} ${target}`;
  }

  if (a.action === "Guess_Kill") {
    return "Вгадати фракцію прихованої й вбити";
  }

  if (a.action === "Kill" || a.action === "Kill_Random") {
    const filter = a.filters?.fraction as string | undefined;
    const tag = filter ? ` (${shortFraction(filter)})` : "";
    const rnd = a.action === "Kill_Random" ? "випадкову " : "";
    // Власник опускається навмисно, коли його немає в даних: у цих карт ціль —
    // будь-який гравець, і дописати «свою» означало б збрехати про правило.
    return `Вбити ${rnd}${faceWord(a)}${ownerSuffix(a)}${tag}`;
  }

  if (a.action === "Kill_Dual") {
    const t = a.targets ?? [];
    if (t.includes("self_face_down") && t.includes("other_face_down")) {
      return "Вбити свою приховану і супротивника";
    }
    return "Вбити двох прихованих";
  }

  if (a.action === "Bury") {
    return a.target_player === "other" ? "Поховати героя супротивника" : "Поховати свого героя";
  }

  if (a.action === "Move_Markers") {
    const options = a.options ?? [];
    const effects = a.effects ?? [];
    // `options` — гравець обирає один варіант; `effects` — застосовуються разом,
    // якщо logic не каже інакше. Раніше обидва склеювались комою, і «або»
    // мовчки перетворювалось на «і».
    const join = String(a.logic ?? "AND").toUpperCase() === "OR" ? " або " : " і ";
    if (options.length > 0) return joinMoveEffects(options, " або ");
    if (effects.length > 0) return joinMoveEffects(effects, join);
  }

  if (a.action === "Perform_Self") return "Повторити свою приховану";
  if (a.action === "Perform") return "Повторити свою приховану";
  if (a.action === "Perform_Top") return "Повторити верхню карту цвинтаря";
  if (a.action === "Bury_Perform") return "Поховати карту з таверни й повторити її";

  if (a.action === "Reveal_Harbor") {
    // «Показати N карт гавані» не влазить у три рядки разом з умовою, та ще й
    // вимагає узгодження числівника. «Відкрити N з гавані» коротше і працює
    // з будь-яким N.
    const n = a.count ? `${a.count} ` : "";
    const cond = a.condition ? `, ${CONDITION_LABELS[a.condition] ?? a.condition}` : "";
    return `Відкрити ${n}з гавані${cond}`;
  }

  if (a.action === "Place") {
    const src = String(a.source ?? "hand").toLowerCase();
    const tgt = String(a.target ?? "Party").toLowerCase();
    const faceDown = a.visibility === "face_down";
    if (src === "hand" && tgt.includes("party")) {
      return faceDown ? "Зіграти ще одного приховано" : "Зіграти ще одного лицьовою";
    }
    return "Викласти карту на стіл";
  }

  if (a.action === "Swap") {
    // Шість різних обмінів у колоді. Кожен має свій текст: що з чим міняється —
    // це і є вся суть здібності, і саме її з'їдала заглушка «Обміняти карти».
    const src = String(a.source ?? "").toLowerCase();
    const tgt = String(a.target ?? "").toLowerCase();
    if (src === "other_party" && tgt.includes("hand")) return "Забрати лицьову супротивника або обмін";
    if (src === "face_up_party" && tgt.includes("hand")) return "Забрати лицьову на руку або обмін";
    if (src === "hand" && tgt.includes("party_face_down")) return "Обміняти карту з руки на свою приховану";
    if (src === "tavern" && tgt.startsWith("other")) return "Обміняти карту таверни на приховану супротивника";
    if (src === "tavern" && tgt.startsWith("self")) return "Обміняти карту таверни на свою приховану";
    if (src === "graveyard_top" && tgt.startsWith("self")) return "Обміняти верх цвинтаря на свою приховану";
  }

  if (a.action === "Swap_Hand") {
    return a.target_player === "other" ? "Обміняти руки з супротивником" : "Обміняти руки";
  }

  if (a.action === "PlayExtra") {
    const not = a.filters?.not_fraction as string | undefined;
    return not ? `Ще один герой, крім ${genitiveFraction(not)}` : "Можна зіграти ще одного героя";
  }

  const action = a.action;
  return ACTION_LABELS[action] ?? action;
}

/** Короткий текст маркерів: числа, «X за ефектом» або опис вибору. */
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
