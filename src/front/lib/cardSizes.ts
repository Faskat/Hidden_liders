/**
 * Єдина таблиця розмірів карт.
 *
 * До цього розміри були продубльовані в п'яти файлах і встигли розійтися:
 * CardFan рахував геометрію віяла для карти 130×182, а PlayerZone малював у
 * ньому xlarge 160×224. Тепер усі числа живуть тут.
 *
 * Тут навмисно лише числа — жодних рядків з класами Tailwind. Каталог `lib/`
 * не входить у `content`-globs (`./pages`, `./components`, `./app`), тому будь-який
 * клас звідси мовчки вичистить purge.
 */

export type CardSizeToken =
  | "graveyard"
  | "leaderMini"
  | "tiny"
  | "small"
  | "normal"
  | "large"
  | "xlarge";

export type CardSizeSpec = {
  w: number;
  h: number;
  /** Внутрішній відступ вмісту від рамки. */
  pad: number;
  /** Нахлист карт у віялі; null = цей розмір ніколи не віялиться. */
  overlap: number | null;
  /**
   * Висота арт-бокса в пікселях. Фіксована, а не «скільки лишилось»: підпис
   * здібності буває на три рядки і з'їдає весь вільний простір, після чого арт
   * схлопується в смужку 8px. Тепер арт бере своє, а текст — решту.
   */
  artH: number;
  nameFontPx: number;
  /**
   * Стеля рядків під назву — саме стеля, а не резерв: коротка назва все одно
   * займе один рядок.
   *
   * Скрізь три. Двох вистачало, поки в рядку не з'явився бейдж фракції: він
   * з'їдає початок першого рядка, і «Консервований Кавалерист» уже не влазив.
   * Третій рядок нічого не коштує коротким назвам і рятує довгі.
   */
  nameLines: 2 | 3;
  footerFontPx: number;
  /** Скільки рядків підпису здібності показуємо, поки не обріжемо. */
  abilityLines: 2 | 3 | 4;
  /**
   * false = показуємо лише маркери, без тексту здібності. На дрібній карті
   * підпис у 10px на ширину 54px — це два слова в рядок, користі з нього нема,
   * а місце він з'їдає в арту. Повний текст усе одно є в підказці й у прев'ю.
   */
  showAbility: boolean;
  /** false = підпис здібності й маркери не показуємо взагалі. */
  showFooter: boolean;
};

export const CARD_ASPECT = 1.4;

export const CARD_SIZES: Record<CardSizeToken, CardSizeSpec> = {
  graveyard:  { w:  60, h:  84, pad:  4, overlap: null, artH: 36, nameFontPx:  8, nameLines: 3, footerFontPx:  0, abilityLines: 2, showAbility: false, showFooter: false },
  leaderMini: { w:  52, h:  73, pad:  4, overlap: null, artH: 26, nameFontPx:  8, nameLines: 3, footerFontPx:  8, abilityLines: 2, showAbility: false, showFooter: false },
  tiny:       { w:  80, h: 112, pad:  6, overlap:  32,  artH: 44, nameFontPx: 10, nameLines: 3, footerFontPx:  9, abilityLines: 2, showAbility: false, showFooter: true  },
  small:      { w: 100, h: 140, pad:  7, overlap:  40,  artH: 48, nameFontPx: 11, nameLines: 3, footerFontPx: 10, abilityLines: 3, showAbility: true,  showFooter: true  },
  normal:     { w: 100, h: 140, pad:  7, overlap:  40,  artH: 48, nameFontPx: 11, nameLines: 3, footerFontPx: 10, abilityLines: 3, showAbility: true,  showFooter: true  },
  large:      { w: 130, h: 182, pad:  9, overlap:  52,  artH: 68, nameFontPx: 13, nameLines: 3, footerFontPx: 11, abilityLines: 3, showAbility: true,  showFooter: true  },
  xlarge:     { w: 160, h: 224, pad: 11, overlap:  64,  artH: 88, nameFontPx: 15, nameLines: 3, footerFontPx: 13, abilityLines: 4, showAbility: true,  showFooter: true  },
};

/** Крок віяла: наскільки лівий край наступної карти зсунуто відносно попередньої. */
export function fanStep(token: CardSizeToken): number {
  const spec = CARD_SIZES[token];
  return spec.w - (spec.overlap ?? Math.round(spec.w * 0.4));
}
