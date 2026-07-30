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
  /** Ширина вертикальної смуги фракції біля лівого краю. */
  spine: number;
  /** Нахлист карт у віялі; null = цей розмір ніколи не віялиться. */
  overlap: number | null;
  /**
   * Висота арт-бокса в пікселях. Фіксована, а не «скільки лишилось»: підпис
   * здібності буває на три рядки і з'їдає весь вільний простір, після чого арт
   * схлопується в смужку 8px. Тепер арт бере своє, а текст — решту.
   */
  artH: number;
  nameFontPx: number;
  footerFontPx: number;
  /** Скільки рядків підпису здібності показуємо, поки не обріжемо. */
  abilityLines: 2 | 3;
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
  graveyard:  { w:  60, h:  84, pad:  4, spine:  5, overlap: null, artH:  50, nameFontPx:  9, footerFontPx:  0, abilityLines: 2, showAbility: false, showFooter: false },
  leaderMini: { w:  52, h:  73, pad:  4, spine:  5, overlap: null, artH:  48, nameFontPx:  9, footerFontPx:  8, abilityLines: 2, showAbility: false, showFooter: false },
  tiny:       { w:  80, h: 112, pad:  8, spine:  6, overlap:  32,  artH:  60, nameFontPx: 11, footerFontPx: 10, abilityLines: 2, showAbility: false, showFooter: true  },
  small:      { w: 100, h: 140, pad:  8, spine:  8, overlap:  40,  artH:  66, nameFontPx: 12, footerFontPx: 10, abilityLines: 2, showAbility: true,  showFooter: true  },
  normal:     { w: 100, h: 140, pad:  8, spine:  8, overlap:  40,  artH:  66, nameFontPx: 12, footerFontPx: 10, abilityLines: 2, showAbility: true,  showFooter: true  },
  large:      { w: 130, h: 182, pad: 10, spine: 10, overlap:  52,  artH:  88, nameFontPx: 14, footerFontPx: 12, abilityLines: 3, showAbility: true,  showFooter: true  },
  xlarge:     { w: 160, h: 224, pad: 12, spine: 12, overlap:  64,  artH: 116, nameFontPx: 16, footerFontPx: 14, abilityLines: 3, showAbility: true,  showFooter: true  },
};

/** Крок віяла: наскільки лівий край наступної карти зсунуто відносно попередньої. */
export function fanStep(token: CardSizeToken): number {
  const spec = CARD_SIZES[token];
  return spec.w - (spec.overlap ?? Math.round(spec.w * 0.4));
}
