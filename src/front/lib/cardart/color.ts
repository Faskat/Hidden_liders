/**
 * Робота з кольором для рушія арту.
 *
 * Потрібна рівно заради одного: щоб колонка з 18 карт однієї фракції не
 * виглядала як одні шпалери. Базовий колір фракції лишається впізнаваним, але
 * кожна карта детерміновано зсуває його відтінок, насиченість і світлоту.
 *
 * Усі функції чисті: hex на вході, hex на виході. Жодного `Math.random` —
 * джитер рахується від хешу імені карти.
 */

type Hsl = { h: number; s: number; l: number };

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function hexToHsl(hex: string): Hsl {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: hue * 360, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hn = ((h % 360) + 360) / 360 % 1;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, hn + 1 / 3);
    g = hueToRgb(p, q, hn);
    b = hueToRgb(p, q, hn - 1 / 3);
  }
  const to = (v: number) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Зсув кольору. `dh` у градусах, `ds` і `dl` — абсолютні добавки до частки 0..1.
 * Світлота підрізається знизу й зверху, щоб дуже темні фракції (Undead) не
 * провалювались у чорне, а світлі не вигоряли в білий.
 */
export function shift(hex: string, dh: number, ds: number, dl: number): string {
  const c = hexToHsl(hex);
  return hslToHex({
    h: c.h + dh,
    s: clamp(c.s + ds, 0.04, 0.95),
    l: clamp(c.l + dl, 0.08, 0.93),
  });
}

/** Перетворює хеш на значення в діапазоні [-span, +span] з кроком у 16 позицій. */
export function spread(hash: number, span: number): number {
  return ((hash % 16) / 15) * 2 * span - span;
}

/**
 * Те саме, але з несиметричним діапазоном.
 *
 * Потрібне для світлоти: симетричний джитер тягнув половину карт у бруд —
 * темні фракції провалювались у чорне, і фігура зливалася з фоном. Тому
 * освітлення завжди дозволяємо сильніше за затемнення.
 */
export function spreadRange(hash: number, lo: number, hi: number): number {
  return lo + ((hash % 16) / 15) * (hi - lo);
}

/** Не даємо кольору стати темнішим за поріг: фон мусить лишатися середнім. */
export function atLeastLight(hex: string, minL: number): string {
  const c = hexToHsl(hex);
  return c.l >= minL ? hex : hslToHex({ ...c, l: minL });
}
