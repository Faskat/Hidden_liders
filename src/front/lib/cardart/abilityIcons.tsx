"use client";

/**
 * Підстановка піктограм у підписи здібностей.
 *
 * Текст підписів генерує наш власний код (`lib/cardDescription.ts`), тому
 * словник у ньому закритий і зіставлення за словами надійне — це не розбір
 * довільної мови користувача.
 *
 * ПІКТОГРАМА ЗАМІНЮЄ СЛОВО, а не супроводжує його. Перша версія лишала обидва
 * («з цвинтаря» + надгробок), і це виявилося найгіршим із двох варіантів: місця
 * займає вдвічі більше, а нової інформації нуль. На друкованих картах теж стоїть
 * або значок, або слово.
 *
 * Слова, які лишаються словами: «супротивника», «свою», «гравця» — власника
 * карти піктограма передати не може, а без нього фраза стає двозначною
 * («перевернути 🂠 👤» — чию саме?). Тому правил для них тут просто немає.
 *
 * Значення заміненого слова не втрачається: кожна піктограма несе `title`, тож
 * воно лишається доступним як підказка.
 */

import { Fragment, type ReactNode } from "react";
import { Icon, type IconKey } from "./icons";

type Rule = {
  /** Джерело регулярки без прапорів. */
  re: string;
  icon: IconKey;
  /** Підказка піктограми — слово, яке вона собою замінила. */
  title: string;
  /** true = лишити число, замінити лише латинську позначку маркера. */
  markerOnly?: boolean;
};

/**
 * Закінчення слова.
 *
 * Саме клас кирилиці, а не `\w`: у JS `\w` — це [A-Za-z0-9_], тож із ним
 * «гаван\w*» збіглося б лише з основою, і піктограма з'їла б пів слова,
 * лишивши на карті хвіст «і» або «я».
 */
const END = "[а-яіїєґА-ЯІЇЄҐ’']*";

/** Порядок важить: перше правило, що збіглося, і спрацьовує. */
const RULES: readonly Rule[] = [
  // «X» поряд із числами: у здібностях Calculation величина маркера невідома
  // наперед і записується саме літерою.
  { re: "[+\\u2212-]?[\\dX]+\\s*R\\b", icon: "redMarker", title: "Червоний маркер", markerOnly: true },
  { re: "[+\\u2212-]?[\\dX]+\\s*G\\b", icon: "greenMarker", title: "Зелений маркер", markerOnly: true },
  { re: `гаван${END}`, icon: "harbor", title: "Гавань" },
  { re: `таверн${END}`, icon: "tavern", title: "Таверна" },
  { re: `цвинтар${END}`, icon: "graveyard", title: "Цвинтар" },
  { re: `пустош${END}`, icon: "wilderness", title: "Пустош" },
  { re: `прихован${END}`, icon: "faceDown", title: "Прихована карта" },
  { re: `лицьов${END}`, icon: "faceUp", title: "Лицьова карта" },
  { re: `черв\\.|червон${END}`, icon: "redMarker", title: "Червоні" },
  { re: `зел\\.|зелен${END}`, icon: "greenMarker", title: "Зелені" },
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

    // У маркерів піктограма з'їдає лише латинську позначку: число — це
    // значення, яке вона передати не може.
    const keep = rule.markerOnly ? m[0].replace(/\s*[RG]\b/i, "") : "";
    out.push(
      <Fragment key={`i${key++}`}>
        {keep}
        <Icon name={rule.icon} size={size} title={rule.title} />
      </Fragment>
    );
    last = m.index + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}
