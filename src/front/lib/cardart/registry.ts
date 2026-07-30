/**
 * Реєстр деталей.
 *
 * Оголошений через `satisfies`, тому тип рецепта виводиться з нього автоматично:
 * `{ head: "skul" }` стає помилкою компіляції, а не мовчки порожнім слотом.
 * На 50 деталях і 79 рецептах це різниця між робочою системою і непоміченою опискою.
 */

import * as backdrop from "./parts/backdrops";
import * as cape from "./parts/capes";
import * as legs from "./parts/legs";
import * as body from "./parts/bodies";
import * as offhand from "./parts/offhands";
import * as head from "./parts/heads";
import * as face from "./parts/faces";
import * as headwear from "./parts/headwear";
import * as weapon from "./parts/weapons";
import * as fx from "./parts/fx";
import type { PartComponent, Slot } from "./types";

export const REGISTRY = {
  backdrop,
  cape,
  legs,
  body,
  offhand,
  head,
  face,
  headwear,
  weapon,
  fx,
} satisfies Record<Slot, Record<string, PartComponent>>;

export type PartIdFor<S extends Slot> = Extract<keyof (typeof REGISTRY)[S], string>;

/** Рецепт карти. `null` = слот навмисно порожній (перебиває значення за замовчуванням). */
export type CardRecipe = { [S in Slot]?: PartIdFor<S> | null };

/** Пошук деталі. Промах повертає undefined — композитор просто пропустить слот. */
export function getPart(slot: Slot, id: string | null | undefined): PartComponent | undefined {
  if (!id) return undefined;
  return (REGISTRY[slot] as Record<string, PartComponent>)[id];
}

/** Усі зареєстровані деталі по слотах — для листа деталей у dev-галереї. */
export function listParts(): { slot: Slot; id: string; Part: PartComponent }[] {
  const out: { slot: Slot; id: string; Part: PartComponent }[] = [];
  for (const slot of Object.keys(REGISTRY) as Slot[]) {
    const mod = REGISTRY[slot] as Record<string, PartComponent>;
    for (const id of Object.keys(mod)) out.push({ slot, id, Part: mod[id] });
  }
  return out;
}
