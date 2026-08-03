"use client";

import { useCallback } from "react";

/**
 * Реєстр зон столу: звідки й куди летять карти.
 *
 * Ключі навмисно дзеркалять словник зон бекенда (`from_zone`/`to_zone` у події
 * `CardMoved`), щоб узагальнена подія лягала на анімацію без окремої таблиці
 * відповідностей. Єдина розбіжність — до зон гравця дописується його id:
 * на бекенді «чия рука» лежить окремим полем, а тут це має бути частиною
 * адреси.
 *
 * Реєструються КОНТЕЙНЕРИ, а не окремі карти. Це не спрощення: гавань і
 * пустош у проекції взагалі не мають карт, лише лічильники, тож політ до них
 * можливий винятково як «до центру стосу». Точна позиція окремої карти
 * дошукується вже в момент польоту, по `data-card-id`.
 *
 * Реєстр — модульний одинак, а не React-контекст. Контекст вимагав би, щоб
 * провайдер стояв НАД компонентом, який запускає анімації, — а це та сама
 * сторінка кімнати, де живе стан гри. Розділяти її навпіл заради порядку
 * провайдерів довелося б лише через обмеження контексту; таблиця на сторінці
 * все одно рівно одна.
 */
export type ZoneKey = string;

export const zoneHand = (playerId: string) => `hand:${playerId}`;
export const zoneParty = (playerId: string) => `party:${playerId}`;
export const zoneHidden = (playerId: string) => `hidden:${playerId}`;
export const zoneTavern = (slot: number) => `tavern:${slot}`;
export const zoneLeader = (playerId: string) => `leader:${playerId}`;
export const ZONE_HARBOR = "harbor";
export const ZONE_WILDERNESS = "wilderness";
export const ZONE_GRAVEYARD = "graveyard";
export const ZONE_TRACK = "track";

/** Прямокутник у координатах вмісту столу — до `translate(pan) scale(zoom)`. */
export type ContentRect = { x: number; y: number; w: number; h: number };

const zones = new Map<ZoneKey, HTMLElement>();
let layer: HTMLElement | null = null;

export function registerZone(key: ZoneKey, el: HTMLElement | null) {
  if (el) zones.set(key, el);
  else zones.delete(key);
}

export function setFlightLayer(el: HTMLElement | null) {
  layer = el;
}

/**
 * Масштаб столу, виведений із самого шару польотів.
 *
 * Шар розтягнутий на весь стіл (`inset: 0`), тому його `offsetWidth` — це
 * ширина до трансформації, а `getBoundingClientRect().width` — після. Їхнє
 * відношення і є поточний зум. Отже, ні `pan`, ні `zoom` зі сторінки передавати
 * сюди не треба, і розсинхрону між намальованим і порахованим бути не може
 * за побудовою.
 */
export function tableZoom(): number {
  if (!layer || !layer.offsetWidth) return 1;
  return layer.getBoundingClientRect().width / layer.offsetWidth;
}

function toContent(r: DOMRect): ContentRect | null {
  if (!layer) return null;
  const base = layer.getBoundingClientRect();
  const k = tableZoom() || 1;
  return {
    x: (r.left - base.left) / k,
    y: (r.top - base.top) / k,
    w: r.width / k,
    h: r.height / k,
  };
}

/**
 * Сам елемент зони — для анімацій на місці.
 *
 * Картку лідера в панелі не можна відправити через шар польотів: вона нікуди
 * не летить, і її «лице» — це не `GameCard`, а власна плашка з назвою та
 * фракціями. Дублювати цю розмітку в режисері заради перевороту було б гірше,
 * ніж перевернути сам елемент на місці.
 */
export function elementOfZone(key: ZoneKey): HTMLElement | null {
  const el = zones.get(key);
  return el && el.isConnected ? el : null;
}

/** Прямокутник контейнера зони, або null, якщо зони зараз немає на екрані. */
export function rectOfZone(key: ZoneKey): ContentRect | null {
  const el = zones.get(key);
  if (!el || !el.isConnected) return null;
  return toContent(el.getBoundingClientRect());
}

/** Прямокутник конкретної карти всередині зони, якщо вона є в DOM. */
export function rectOfCardIn(key: ZoneKey, cardId: string): ContentRect | null {
  const el = zones.get(key);
  if (!el || !el.isConnected) return null;
  // CSS.escape не потрібен: card_id — це hero_N / leader_slug з каталогу.
  const card = el.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
  if (!card) return null;
  return toContent(card.getBoundingClientRect());
}

/**
 * Реф-колбек, який реєструє контейнер зони й прибирає його за собою.
 *
 * Саме реф-колбек, а не `useEffect` із `ref.current`: React викликає його і
 * при монтуванні, і при розмонтуванні з `null`, тож зона зникає з реєстру
 * рівно тоді, коли зникає з дошки.
 */
export function useZoneRef(key: ZoneKey) {
  return useCallback((el: HTMLElement | null) => registerZone(key, el), [key]);
}
