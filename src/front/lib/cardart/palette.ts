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

type FactionKey = "Highlanders" | "Imperials" | "Undead" | "Waterfolk" | "Joker";

/** Три варіанти одягу на фракцію: та сама фракція, але карти не зливаються. */
type ClothVariant = { cloth: string; clothShade: string };

type FactionArt = Omit<Palette, "cloth" | "clothShade"> & {
  cloths: readonly [ClothVariant, ClothVariant, ClothVariant];
};

const FACTION_ART: Record<FactionKey, FactionArt> = {
  Highlanders: {
    skin: "#d8b48c", skinShade: "#b2895f",
    metal: "#9aa3a8", metalShade: "#6c7479",
    trim: "#c9a227", ink: "#23201c",
    bgFrom: "#a8c98a", bgTo: "#4e7a44", glow: "#d6f08a",
    cloths: [
      { cloth: "#3d8f3d", clothShade: "#2a6a2b" },
      { cloth: "#4f7a3a", clothShade: "#35562a" },
      { cloth: "#2f7d55", clothShade: "#205a3c" },
    ],
  },
  Imperials: {
    skin: "#e3c1a0", skinShade: "#c39a76",
    metal: "#c9c3b4", metalShade: "#948e80",
    trim: "#d8b44a", ink: "#2a1d1d",
    bgFrom: "#e0a888", bgTo: "#a5523f", glow: "#ffcf6b",
    cloths: [
      { cloth: "#b84a4a", clothShade: "#8c3535" },
      { cloth: "#a8543a", clothShade: "#7d3b28" },
      { cloth: "#8f3f52", clothShade: "#6b2c3c" },
    ],
  },
  Undead: {
    skin: "#cfd3c4", skinShade: "#a3a894",
    metal: "#6e6a5f", metalShade: "#47443c",
    trim: "#7a6f4a", ink: "#14121a",
    bgFrom: "#6b6478", bgTo: "#2b2733", glow: "#8ef0c0",
    cloths: [
      { cloth: "#3a3446", clothShade: "#241f2e" },
      { cloth: "#443a3a", clothShade: "#2b2424" },
      { cloth: "#2f3a42", clothShade: "#1e262c" },
    ],
  },
  Waterfolk: {
    skin: "#8fc7c9", skinShade: "#63a0a6",
    metal: "#a9c4cc", metalShade: "#74959e",
    trim: "#cfa94a", ink: "#102836",
    bgFrom: "#7fb6cc", bgTo: "#2f5f80", glow: "#7ee6ff",
    cloths: [
      { cloth: "#2f6fae", clothShade: "#1f4f80" },
      { cloth: "#2f8a9e", clothShade: "#1f6070" },
      { cloth: "#3f5aa8", clothShade: "#2a3d78" },
    ],
  },
  Joker: {
    skin: "#d9d6cc", skinShade: "#a8a49a",
    metal: "#b9b2a0", metalShade: "#847e70",
    trim: "#c9a227", ink: "#181420",
    bgFrom: "#3b3348", bgTo: "#191521", glow: "#c9a227",
    cloths: [
      { cloth: "#4a3f5c", clothShade: "#332a42" },
      { cloth: "#55414a", clothShade: "#3a2b31" },
      { cloth: "#3f4a5c", clothShade: "#2a3242" },
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

/** Палітра звичайної карти. Варіант одягу детермінований від ключа арту. */
export function getPalette(artKey: string, faction: string | undefined): Palette {
  const base = artFor(faction);
  return assemble(base, base.cloths[fnv1a(artKey) % base.cloths.length]);
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
    ...assemble(a, cloth),
    metal: b.metal,
    metalShade: b.metalShade,
    trim: "#c9a227",
  };
}
