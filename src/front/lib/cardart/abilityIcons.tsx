"use client";

/**
 * Підстановка піктограм у підписи здібностей.
 *
 * Текст підписів генерує наш власний код (`lib/cardDescription.ts`), тому
 * словник у ньому закритий і зіставлення за словами надійне — це не розбір
 * довільної мови користувача.
 *
 * Назви зон піктограма СУПРОВОДЖУЄ, а не замінює: підписи в нас — повноцінні
 * українські речення, і викинути з них іменник означало б зламати відмінки.
 * А ось літери маркерів «R» і «G» саме замінюються — там слова й не було,
 * і щит із горою читаються швидше за латиницю.
 */

import { Fragment, type ReactNode } from "react";
import { Icon, type IconKey } from "./icons";

type Rule = {
  /** Джерело регулярки без прапорів. */
  re: string;
  icon: IconKey;
  /** true = прибрати позначку маркера з тексту, лишивши число. */
  replaceMarker?: boolean;
};

/**
 * Закінчення слова.
 *
 * Саме клас кирилиці, а не `\w`: у JS `\w` — це [A-Za-z0-9_], тож із ним
 * «гаван\w*» збіглося б лише з основою і піктограма стрибала б у середину слова.
 */
const END = "[а-яіїєґА-ЯІЇЄҐ’']*";

/** Порядок важить: перше правило, що збіглося, і спрацьовує. */
const RULES: readonly Rule[] = [
  // «X» поряд із числами: у здібностях Calculation величина маркера невідома
  // наперед і записується саме літерою.
  { re: "[+\\u2212-]?[\\dX]+\\s*R\\b", icon: "redMarker", replaceMarker: true },
  { re: "[+\\u2212-]?[\\dX]+\\s*G\\b", icon: "greenMarker", replaceMarker: true },
  { re: `гаван${END}`, icon: "harbor" },
  { re: `таверн${END}`, icon: "tavern" },
  { re: `цвинтар${END}`, icon: "graveyard" },
  { re: `пустош${END}`, icon: "wilderness" },
  { re: `прихован${END}`, icon: "faceDown" },
  { re: `лицьов${END}`, icon: "faceUp" },
  { re: `супротивник${END}`, icon: "player" },
  { re: `гравц${END}|гравець`, icon: "player" },
  { re: `черв\\.|червон${END}`, icon: "redMarker" },
  { re: `зел\\.|зелен${END}`, icon: "greenMarker" },
];

const COMBINED = new RegExp(RULES.map((r) => `(${r.re})`).join("|"), "gi");

/** Індекс правила, що дало збіг: перша визначена група. */
function ruleOf(m: RegExpExecArray): Rule | undefined {
  for (let i = 1; i < m.length; i++) {
    if (m[i] !== undefined) return RULES[i - 1];
  }
  return undefined;
}

/**
 * Розбиває підпис на текст і піктограми.
 * Повертає масив вузлів — придатний для прямої вставки в JSX.
 */
export function withIcons(text: string, size = 11): ReactNode[] {
  if (!text) return [];
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  COMBINED.lastIndex = 0;

  for (let m = COMBINED.exec(text); m !== null; m = COMBINED.exec(text)) {
    const rule = ruleOf(m);
    if (!rule) continue;
    if (m.index > last) out.push(text.slice(last, m.index));

    if (rule.replaceMarker) {
      // Лишаємо число, латинську позначку віддаємо піктограмі.
      const num = m[0].replace(/\s*[RG]\b/i, "");
      out.push(
        <Fragment key={`i${key++}`}>
          {num}
          <Icon name={rule.icon} size={size} />
        </Fragment>
      );
    } else {
      out.push(
        <Fragment key={`i${key++}`}>
          {m[0]}
          <Icon name={rule.icon} size={size} />
        </Fragment>
      );
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}
