/**
 * Палітри фракцій.
 *
 * Пігмент фігури однаковий у світлій і темній темі — як фарба на друкованій
 * карті. На тему реагує лише верхня вуаль `--card-art-veil`, і саме через
 * CSS-змінну, а не через JS: `ThemeSwitcher` виставляє `data-theme` вже після
 * монтування, тож будь-яка гілка по темі в рендері дала б розсинхрон гідратації.
 *
 * Фони навмисно середні за світлотою, включно з Undead: фігура малюється майже
 * чорним контуром і мусить читатися на 60×84. Чорноту Undead несе рамка карти.
 */

import type { Palette } from "./types";
import { fnv1a } from "./hash";
import { atLeastLight, shift, spread, spreadRange } from "./color";

/** Фон мусить лишатися середнім за світлотою, інакше фігура зливається з ним. */
const MIN_BG_LIGHT = 0.3;

type FactionKey = "Highlanders" | "Imperials" | "Undead" | "Waterfolk" | "Joker";

/** Три варіанти одягу на фракцію: та сама фракція, але карти не зливаються. */
type ClothVariant = { cloth: string; clothShade: string };

type FactionArt = Omit<Palette, "cloth" | "clothShade"> & {
  cloths: readonly ClothVariant[];
};

/**
 * Метал оздоблення обирається на карту, а не на фракцію.
 *
 * Раніше золото було в усіх без винятку, і пояси, корони та навершя виглядали
 * однаково на всіх 79 картах. Лідерам золото повертаємо примусово — там воно
 * означає статус.
 */
const TRIMS = ["#c9a227", "#c3c8cc", "#a9713f", "#b0553a", "#8f9e6b"] as const;

const FACTION_ART: Record<FactionKey, FactionArt> = {
  Highlanders: {
    skin: "#d8b48c", skinShade: "#b2895f",
    metal: "#9aa3a8", metalShade: "#6c7479",
    trim: "#c9a227", ink: "#23201c",
    bgFrom: "#9ecb72", bgTo: "#3f7a34", glow: "#e8f79a",
    cloths: [
      { cloth: "#3d8f3d", clothShade: "#276b27" },
      { cloth: "#5b7d2a", clothShade: "#3d551a" },
      { cloth: "#2f8a63", clothShade: "#1d6244" },
      { cloth: "#7a6a34", clothShade: "#544721" },
      { cloth: "#8a4a2a", clothShade: "#63321b" },
    ],
  },
  Imperials: {
    skin: "#e3c1a0", skinShade: "#c39a76",
    metal: "#ccc6b6", metalShade: "#948e80",
    trim: "#d8b44a", ink: "#2a1d1d",
    bgFrom: "#e8a878", bgTo: "#a03f2e", glow: "#ffd47a",
    cloths: [
      { cloth: "#c0403f", clothShade: "#8f2b2a" },
      { cloth: "#b05a2a", clothShade: "#7f3d18" },
      { cloth: "#93334f", clothShade: "#6b2138" },
      { cloth: "#4b3f8f", clothShade: "#332a66" },
      { cloth: "#2f5f8f", clothShade: "#1f4266" },
    ],
  },
  Undead: {
    skin: "#cfd3c4", skinShade: "#a3a894",
    metal: "#6e6a5f", metalShade: "#47443c",
    trim: "#7a6f4a", ink: "#14121a",
    // Фон навмисно набагато світліший за фракційний колір рамки: нежить носить
    // темне, і на темному фоні фігура просто тонула.
    bgFrom: "#9a8fb0", bgTo: "#4a4066", glow: "#9df5c8",
    // Одяг нежиті свідомо світліший, ніж проситься за настроєм: у першій версії
    // він був майже чорним, і фігура зливалася з власною тінню на фоні.
    cloths: [
      { cloth: "#5f5182", clothShade: "#3e3459" },
      { cloth: "#77435a", clothShade: "#4e2b3a" },
      { cloth: "#3f6459", clothShade: "#28423a" },
      { cloth: "#454e7d", clothShade: "#2d3354" },
      { cloth: "#8a8372", clothShade: "#5d584c" },
    ],
  },
  Waterfolk: {
    skin: "#8fc7c9", skinShade: "#63a0a6",
    metal: "#a9c4cc", metalShade: "#74959e",
    trim: "#cfa94a", ink: "#102836",
    bgFrom: "#86c6dd", bgTo: "#245f85", glow: "#8ef0ff",
    cloths: [
      { cloth: "#2f6fae", clothShade: "#1d4d7d" },
      { cloth: "#2f9e9e", clothShade: "#1d6d6d" },
      { cloth: "#4450b0", clothShade: "#2d357a" },
      { cloth: "#2fae7d", clothShade: "#1d7a55" },
      { cloth: "#c46a3a", clothShade: "#8c4623" },
    ],
  },
  Joker: {
    skin: "#d9d6cc", skinShade: "#a8a49a",
    metal: "#b9b2a0", metalShade: "#847e70",
    trim: "#c9a227", ink: "#181420",
    bgFrom: "#6b5b8a", bgTo: "#241d33", glow: "#ffd76b",
    cloths: [
      { cloth: "#5b3f6e", clothShade: "#3d2a4a" },
      { cloth: "#6b414a", clothShade: "#472a31" },
      { cloth: "#3f4a6b", clothShade: "#2a3247" },
    ],
  },
};

/** Запасний варіант для невідомої фракції — нейтральний сірувато-коричневий. */
const GENERIC: FactionArt = {
  skin: "#d5bda2", skinShade: "#ab947c",
  metal: "#a5a5a5", metalShade: "#767676",
  trim: "#c9a227", ink: "#221f1c",
  bgFrom: "#b0a894", bgTo: "#5d564a", glow: "#e8dcb8",
  cloths: [
    { cloth: "#6b6152", clothShade: "#4a4238" },
    { cloth: "#5c5f6b", clothShade: "#3e414a" },
    { cloth: "#6b5450", clothShade: "#4a3a37" },
  ],
};

function artFor(faction: string | undefined): FactionArt {
  if (faction && faction in FACTION_ART) return FACTION_ART[faction as FactionKey];
  return GENERIC;
}

function assemble(base: FactionArt, cloth: ClothVariant): Palette {
  const { cloths: _cloths, ...rest } = base;
  return { ...rest, ...cloth };
}

/**
 * Детермінований зсув відтінку по всій палітрі.
 *
 * Без цього всі 18 карт фракції мали однаковий фон і три варіанти одягу на всіх,
 * і колонка виглядала як одні шпалери. Тепер кожна карта зсуває базовий колір
 * фракції в межах, де фракція ще впізнавана: фон і одяг гуляють помітно, шкіра
 * й метал — ледь-ледь, бо це «матеріали», а не «фарба».
 *
 * Кожна роль бере власний потік хешу, інакше зсуви йшли б синхронно й вийшов би
 * просто інший однорідний колір.
 */
function jitter(p: Palette, artKey: string): Palette {
  const bg = fnv1a(`${artKey}:bg`);
  const cl = fnv1a(`${artKey}:cloth`);
  const sk = fnv1a(`${artKey}:skin`);
  const mt = fnv1a(`${artKey}:metal`);

  // Фон зсуваємо однаково для обох тонів, щоб градієнт лишався цілісним.
  const bgH = spread(bg, 16);
  const bgS = spread(bg >> 4, 0.1);
  const bgL = spreadRange(bg >> 8, -0.03, 0.11);

  const clH = spread(cl, 20);
  const clS = spread(cl >> 4, 0.13);
  const clL = spreadRange(cl >> 8, -0.04, 0.1);

  const skH = spread(sk, 7);
  const skL = spreadRange(sk >> 4, -0.04, 0.07);
  const mtL = spreadRange(mt, -0.04, 0.08);

  return {
    ...p,
    skin: shift(p.skin, skH, 0, skL),
    skinShade: shift(p.skinShade, skH, 0, skL),
    cloth: shift(p.cloth, clH, clS, clL),
    clothShade: shift(p.clothShade, clH, clS, clL),
    metal: shift(p.metal, 0, 0, mtL),
    metalShade: shift(p.metalShade, 0, 0, mtL),
    trim: shift(TRIMS[mt % TRIMS.length], 0, 0, spread(mt >> 8, 0.05)),
    bgFrom: atLeastLight(shift(p.bgFrom, bgH, bgS, bgL), MIN_BG_LIGHT),
    bgTo: shift(p.bgTo, bgH, bgS, bgL),
    glow: shift(p.glow, bgH, 0, 0),
  };
}

/** Палітра звичайної карти. Варіант одягу детермінований від ключа арту. */
export function getPalette(artKey: string, faction: string | undefined): Palette {
  const base = artFor(faction);
  const flat = assemble(base, base.cloths[fnv1a(artKey) % base.cloths.length]);
  return jitter(flat, artKey);
}

/**
 * Палітра лідера: людина однієї фракції в кольорах іншої — рівно те, що лідер
 * і означає за правилами. Структура (шкіра, контур, фон) від `fraction_1`,
 * одяг і метал від `fraction_2`, золото в усіх шістьох однакове.
 */
export function getLeaderPalette(
  artKey: string,
  fraction1: string | undefined,
  fraction2: string | undefined
): Palette {
  const a = artFor(fraction1);
  const b = artFor(fraction2);
  const cloth = b.cloths[fnv1a(artKey) % b.cloths.length];
  return {
    ...jitter(assemble(a, cloth), artKey),
    metal: b.metal,
    metalShade: b.metalShade,
    trim: "#c9a227",
  };
}
