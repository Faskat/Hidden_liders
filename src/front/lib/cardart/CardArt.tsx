"use client";

/**
 * Композитор арту карти.
 *
 * Малює фон фракції, поверх нього фігуру, зібрану з деталей за рецептом,
 * і зверху одну вуаль, що реагує на тему.
 *
 * `preserveAspectRatio="xMidYMid meet"` — фігура вписується цілком.
 *
 * Спершу тут стояв `slice`, і це була помилка розрахунку: арт-бокс на всіх
 * розмірах ширший, ніж вищий (наприклад 124×116 на xlarge), тож обрізка знизу
 * з'їдала все нижче y≈78 зі 140 — ноги не було видно взагалі на жодному розмірі.
 * З `meet` фігура вужча, зате видно її повністю, а порожнечу з боків заповнює
 * фон, навмисно намальований ширшим за viewBox.
 *
 * Усі трансформації належать композитору. Деталі лишаються чистими й нічого не
 * знають ні про дзеркало, ні про зріст — інакше контракт точок кріплення
 * розсипався б.
 */

import { memo, useId } from "react";
import type { CardSizeToken } from "../cardSizes";
import { fnv1a } from "./hash";
import { shift, spread } from "./color";
import { ART_LOD } from "./lod";
import { getLeaderPalette, getPalette } from "./palette";
import { recipeSlots, resolveRecipe } from "./recipe";
import { getPart } from "./registry";
import { ART_VIEWBOX, type Palette, type Slot } from "./types";

const { w: VW, h: VH } = ART_VIEWBOX;

/** Фон навмисно ширший за viewBox: із `meet` він має закрити поля з боків. */
const BG_X = -100;
const BG_W = VW + 200;

/** Слоти, що масштабуються разом із головою. */
const HEAD_GROUP: readonly Slot[] = ["head", "face", "headwear"];

/**
 * Композиційні відхилення карти. Усе рахується від хешу імені, тому однакове
 * на сервері й на клієнті — це та сама гарантія від розсинхрону гідратації,
 * що й у палітрі.
 */
function variationOf(artKey: string) {
  const h = fnv1a(`${artKey}:pose`);
  return {
    // Дзеркало міняє руку зі зброєю і напрямок морди — найдешевший спосіб
    // подвоїти видиме різноманіття, не малюючи жодної нової деталі.
    mirror: (h & 1) === 1,
    build: 1 + spread(h >> 1, 0.07),
    headScale: 1 + spread(h >> 5, 0.1),
    lift: spread(h >> 9, 3),
    // Легкий нахил: без нього 79 фігур стоять як солдати на плацу.
    lean: spread(fnv1a(`${artKey}:lean`), 4),
    horizon: 96 + spread(fnv1a(`${artKey}:sky`), 9),
    discX: 22 + ((fnv1a(`${artKey}:disc`) % 56)),
    discY: 20 + ((fnv1a(`${artKey}:discy`) % 18)),
    discR: 6 + ((fnv1a(`${artKey}:discr`) % 6)),
  };
}

type Variation = ReturnType<typeof variationOf>;

/**
 * Фон: плоскі прямокутники замість `<linearGradient>` — градієнту потрібен `id`,
 * а ідентифікатори заборонені: на екрані до 70 карт, і вони б зіткнулися.
 *
 * Лінія горизонту й диск світила зсуваються від карти до карти. Без цього всі
 * 18 карт фракції мали буквально однакову підкладку.
 */
function Background({ p, v }: { p: Palette; v: Variation }) {
  const band = v.horizon;
  return (
    <g>
      <rect x={BG_X} y={-40} width={BG_W} height={VH + 80} fill={p.bgFrom} />
      <circle cx={v.discX} cy={v.discY} r={v.discR} fill={p.glow} opacity={0.28} />
      {/* Смуги навмисно не доходять до повної непрозорості: інакше нижня
          третина карти ставала майже чорною і фігура тонула в ній. */}
      <rect x={BG_X} y={band - 34} width={BG_W} height={VH} fill={p.bgTo} opacity={0.28} />
      <rect x={BG_X} y={band - 14} width={BG_W} height={VH} fill={p.bgTo} opacity={0.5} />
      <rect x={BG_X} y={band + 8} width={BG_W} height={VH} fill={p.bgTo} opacity={0.7} />
    </g>
  );
}

/**
 * Ролі, які отримують градієнт. Тіньові тони (`*Shade`) лишаються плоскими —
 * вони й так грають роль тіні, а градієнт на градієнті дає бруд.
 */
const SHADED = ["skin", "cloth", "metal", "trim"] as const;

/**
 * Об'єм на плоских формах.
 *
 * Ідентифікатори градієнтів заборонені контрактом деталей — на екрані до 70
 * карт, і однакові id зіткнулися б. Тому градієнти оголошує композитор, один
 * набір на карту, з префіксом від `useId()`: React гарантує його унікальність
 * і сталість між сервером і клієнтом.
 *
 * Деталі при цьому не змінюються взагалі: їм у палітрі просто приходить
 * `url(#…)` замість hex.
 */
function GradientDefs({ p, gid }: { p: Palette; gid: string }) {
  return (
    <defs>
      {SHADED.map((role) => {
        const base = p[role];
        // Метал блищить сильніше за тканину й шкіру.
        const up = role === "metal" ? 0.17 : 0.1;
        const down = role === "metal" ? 0.12 : 0.08;
        return (
          <linearGradient key={role} id={`${gid}-${role}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={shift(base, 0, 0, up)} />
            <stop offset="55%" stopColor={base} />
            <stop offset="100%" stopColor={shift(base, 0, 0, -down)} />
          </linearGradient>
        );
      })}
    </defs>
  );
}

function withGradients(p: Palette, gid: string): Palette {
  const out = { ...p };
  for (const role of SHADED) out[role] = `url(#${gid}-${role})`;
  return out;
}

/**
 * Який шар малюємо.
 *
 * Карта складається з двох накладених SVG, а не з одного: фон мусить залити
 * карту цілком, під назву й підпис, а фігура — жити тільки в проміжку між ними,
 * інакше текст ліг би їй на обличчя. Одним `viewBox` це не робиться: висоту
 * смуг тексту задає перенос рядків у браузері, а не наші числа.
 *
 * `full` лишається для одиночного використання поза картою (dev-галерея).
 */
export type ArtLayer = "background" | "figure" | "full";

export type CardArtProps = {
  /** Ім'я карти з каталогу — стабільний ключ арту. */
  artKey: string;
  faction?: string;
  size: CardSizeToken;
  /** Для лідерів: двофракційна палітра. */
  fraction1?: string;
  fraction2?: string;
  layer?: ArtLayer;
};

export const CardArt = memo(function CardArt({
  artKey,
  faction,
  size,
  fraction1,
  fraction2,
  layer = "full",
}: CardArtProps) {
  const isLeader = Boolean(fraction1 || fraction2);
  const palette = isLeader
    ? getLeaderPalette(artKey, fraction1, fraction2)
    : getPalette(artKey, faction);
  const { lod, slots } = ART_LOD[size];
  const recipe = resolveRecipe(artKey, faction);
  const v = variationOf(artKey);

  // На LOD 0 градієнти вимкнені: на арті 54×60 їх усе одно не видно, а це
  // чотири зайві вузли й окремий шар растеризації на кожній із десятків карт.
  const rawId = useId();
  const gid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const shaded = lod >= 1;
  const paint = shaded ? withGradients(palette, gid) : palette;

  const render = ([slot, id]: [Slot, string]) => {
    const Part = getPart(slot, id);
    if (!Part) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[cardart] невідома деталь ${slot}.${id} (карта «${artKey}»)`);
      }
      return null;
    }
    return <Part key={slot} p={paint} lod={lod} />;
  };

  /**
   * Фон малюємо плоскою палітрою, без градієнтів.
   *
   * Не з міркувань економії: `<defs>` живуть у шарі фігури, і посилання
   * `url(#…)` із шару фону вказувало б у порожнечу — заливка стала б чорною.
   */
  const renderFlat = ([slot, id]: [Slot, string]) => {
    const Part = getPart(slot, id);
    return Part ? <Part key={slot} p={palette} lod={lod} /> : null;
  };

  const used = recipeSlots(recipe, slots);
  const backdrop = used.filter(([s]) => s === "backdrop");
  const beforeHead = used.filter(([s]) => s !== "backdrop" && !HEAD_GROUP.includes(s) && s !== "weapon" && s !== "fx");
  const headGroup = used.filter(([s]) => HEAD_GROUP.includes(s));
  const afterHead = used.filter(([s]) => s === "weapon" || s === "fx");

  // Масштаб фігури — навколо точки землі, щоб ноги лишались на місці.
  // Масштаб голови — навколо шиї, щоб голова не від'їхала від плечей.
  //
  // Нахил і зсув по висоті вимикаються на LOD 0. На 60×84 фігура заввишки
  // близько 30px, і ті самі 4° читаються вже не як жива поза, а як перекошена
  // картинка — надто мало пікселів, щоб побачити в цьому намір.
  const lean = lod >= 1 ? v.lean : 0;
  const lift = lod >= 1 ? v.lift : 0;
  const sx = v.mirror ? -v.build : v.build;
  const figure = `translate(0 ${lift}) translate(50 138) rotate(${lean.toFixed(2)}) scale(${sx.toFixed(3)} ${v.build.toFixed(3)}) translate(-50 -138)`;
  const headTf = `translate(50 50) scale(${v.headScale.toFixed(3)}) translate(-50 -50)`;

  // Фон заливає карту цілком, тому обрізати його можна як завгодно — аби не
  // лишилося полів. Фігура ж мусить поміститися повністю, звідси `meet`.
  const fit = layer === "figure" ? "xMidYMid meet" : "xMidYMid slice";

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio={fit}
      width="100%"
      height="100%"
      role="presentation"
      style={{ display: "block" }}
    >
      {shaded && layer !== "background" && <GradientDefs p={palette} gid={gid} />}

      {/* Декорація фракції (сосни, знамено, надгробок) живе на шарі фону, а не
          за фігурою. За фігурою вона й малювалася в бокс висотою в третину
          карти, де фігура закривала її майже цілком; на повній карті вона
          нарешті видно з боків і над головою. */}
      {layer !== "figure" && (
        <>
          <Background p={palette} v={v} />
          {backdrop.map(renderFlat)}
        </>
      )}

      {layer !== "background" && (
        <g transform={figure}>
          {beforeHead.map(render)}
          <g transform={headTf}>{headGroup.map(render)}</g>
          {afterHead.map(render)}
        </g>
      )}

      {/* Вуаль теми — єдине, що тут реагує на світлу/темну тему. Живе на шарі
          фону: він і так накриває карту цілком, а на шарі фігури вуаль лягла б
          другим шаром поверх першої і подвоїла б затемнення. */}
      {layer !== "figure" && (
        <rect x={BG_X} y={-40} width={BG_W} height={VH + 80} fill="var(--card-art-veil)" />
      )}
    </svg>
  );
});
