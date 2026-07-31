"use client";

/**
 * Піктограми зон і маркерів — за легендою оригінальної гри.
 *
 * Потрібні в підписах здібностей: «взяти з таверни» читається набагато швидше,
 * коли поруч зі словом стоїть кухоль, а «+1 R» — коли замість літери червоний
 * щит. Саме так зроблено на друкованих картах.
 *
 * Малюються на сітці 16×16, одним кольором, без обводок і градієнтів: на 11px
 * у підписі виживає тільки суцільна пляма. Колір приходить ззовні, тому одна
 * піктограма працює і на світлій, і на темній підкладці.
 */

import type { ReactElement } from "react";

export type IconKey =
  | "faceUp"
  | "faceDown"
  | "harbor"
  | "wilderness"
  | "tavern"
  | "graveyard"
  | "player"
  | "redMarker"
  | "greenMarker";

type IconProps = { size?: number; color?: string; title?: string };

function Svg({ size = 12, color = "currentColor", title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill={color}
      role={title ? "img" : "presentation"}
      aria-label={title}
      style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/**
 * Лицьова й прихована карта — карта з оком на ній.
 *
 * Саме карта, а не саме око: піктограма стоїть у підписах про карти, і форма
 * має називати предмет, а вже потім стан. Око всередині розрізняє стани —
 * розплющене проти перекресленого видно силуетом навіть на висоті рядка.
 *
 * Око не намальоване поверх карти, а вибите з неї через `fill-rule: evenodd`:
 * піктограма суцільна (на 11px тонкі обриси не виживають), а колір підкладки їй
 * невідомий, тож «білим» очей не намалюєш. Дірка ж працює на будь-якому тлі.
 * Зіниця — третій підшлях усередині ока: непарна кількість перетинів знову дає
 * заливку, і зіниця стає чорнильною плямою в прорізі.
 */
const CARD_BODY =
  "M4.4 1.8h7.2a1.4 1.4 0 0 1 1.4 1.4v9.6a1.4 1.4 0 0 1-1.4 1.4H4.4a1.4 1.4 0 0 1-1.4-1.4V3.2a1.4 1.4 0 0 1 1.4-1.4z";
/**
 * Око майже на всю ширину карти (8 з 10 одиниць нутра).
 *
 * Менше воно й пробувалося: при половині ширини на 12px проріз сходився до
 * плями 4×2px, і карта читалася просто як карта з подряпиною. Око має бути
 * головним, що видно, — карту називає силует, а стан називає око.
 */
const EYE_HOLE = "M4 8Q8 4.2 12 8Q8 11.8 4 8Z";
const PUPIL = "M8 6.6a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8z";

export const IconFaceUp = (p: IconProps) => (
  <Svg {...p} title={p.title ?? "Лицьова карта"}>
    <path d={`${CARD_BODY} ${EYE_HOLE} ${PUPIL}`} fillRule="evenodd" />
  </Svg>
);

/**
 * Та сама карта, але око порожнє й перекреслене.
 *
 * Перекреслення — теж проріз, а не лінія поверх: суцільною карту не
 * перекреслиш, бо лінія тим самим кольором на ній не видно. У прорізі ока смуга
 * знову перетинає парну кількість меж і стає чорнильною — вийшла риска саме
 * там, де вона й потрібна.
 */
const SLASH_HOLE = "M5.26 12.94L12.06 4.74L10.75 3.66L3.95 11.86Z";

export const IconFaceDown = (p: IconProps) => (
  <Svg {...p} title={p.title ?? "Прихована карта"}>
    <path d={`${CARD_BODY} ${EYE_HOLE} ${SLASH_HOLE}`} fillRule="evenodd" />
  </Svg>
);

/** Гавань — колода добору. Якір. */
export const IconHarbor = (p: IconProps) => (
  <Svg {...p} title={p.title ?? "Гавань"}>
    <path d="M7.1 1.8h1.8v12.4H7.1z" />
    <path d="M4.2 4.1h7.6v1.7H4.2z" />
    <circle cx="8" cy="2.1" r="1.6" fill="none" stroke={p.color ?? "currentColor"} strokeWidth="1.1" />
    <path d="M1.6 9.2h1.7c0 2.2 2 3.6 4.7 3.6s4.7-1.4 4.7-3.6h1.7c0 3.4-2.9 5.5-6.4 5.5S1.6 12.6 1.6 9.2z" />
  </Svg>
);

/** Пустош — скид. Багаття. */
export const IconWilderness = (p: IconProps) => (
  <Svg {...p} title={p.title ?? "Пустош"}>
    <path d="M8 0.6c1.1 2.4-.4 3.3-.4 4.7 0 .9.6 1.5 1.3 1.5.9 0 1.4-.7 1.3-1.8 1.5 1.4 2.1 2.9 2.1 4.3 0 2.4-2 4-4.3 4S3.7 11.7 3.7 9.3c0-3.1 3.2-4.2 4.3-8.7z" />
    <path d="M1.4 13.1l13.2-1.4.2 1.6-13.2 1.4z" />
    <path d="M14.4 13.3L1.6 11.7l-.2 1.6 12.8 1.6z" opacity={0.75} />
  </Svg>
);

/** Таверна — відкрита вітрина. Кухоль. */
export const IconTavern = (p: IconProps) => (
  <Svg {...p} title={p.title ?? "Таверна"}>
    <path d="M2 4h8v10H2z" />
    <path d="M2 1.6h8v2.1H2z" opacity={0.55} />
    <path d="M10.6 5.4h2.2a1.8 1.8 0 0 1 0 3.6h-2.2V7.4h2a.4.4 0 0 0 0-.8h-2z" />
  </Svg>
);

/** Цвинтар — купа вбитих. Рука з-під землі. */
export const IconGraveyard = (p: IconProps) => (
  <Svg {...p} title={p.title ?? "Цвинтар"}>
    <path d="M6.6 3.2h1.5v6.4H6.6zM4.4 4.8h1.4v4.8H4.4zM8.9 4.4h1.4v5.2H8.9zM11 6h1.4v3.6H11z" />
    <path d="M3.4 9.2h9.2l-.9 2.4H4.3z" />
    <path d="M1.4 12.4h13.2v1.9H1.4z" opacity={0.6} />
  </Svg>
);

/** Гравець — ви або суперник. */
export const IconPlayer = (p: IconProps) => (
  <Svg {...p} title={p.title ?? "Гравець"}>
    <path d="M8 1.6a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    <path d="M8 8.6c3.1 0 5.6 2.3 5.6 5.2v.6H2.4v-.6C2.4 10.9 4.9 8.6 8 8.6z" />
  </Svg>
);

/**
 * Червоний маркер — Імперія. Щит із білою вежею.
 *
 * Порожній щит нічого не називав: щит носять усі, і піктограма трималася лише
 * на кольорі, а поруч у тому самому рядку стоїть зелений маркер такого ж
 * розміру. Вежа — та сама емблема, що на жетоні треку й на бейджі фракції, тож
 * усі три місця тепер показують одну річ.
 *
 * Зубці й корпус перекриваються по вертикалі навмисно: між ними лишалася щілина
 * в частку пікселя, і на 12px корона відривалася від вежі.
 */
export const IconRedMarker = (p: IconProps) => {
  const c = p.color ?? "var(--red)";
  return (
    <Svg {...p} color={c} title={p.title ?? "Червоний маркер"}>
      <path d="M8 1.2l5.6 1.9v4.6c0 3.2-2.3 5.6-5.6 7.1-3.3-1.5-5.6-3.9-5.6-7.1V3.1z" />
      {/* Вежа займає весь прямий проліт щита (y 3.1..7.7) і трохи нижче, поки
          щит не почав звужуватися до вістря. Зубці ширші за проміжки між ними:
          на 11px рівні зубець і проміжок по 0.7px злипаються в сіру смугу,
          а так лишається видно, що верх вежі зубчастий. */}
      <g fill="#ffffff">
        <path d="M4.6 3.9h1.6v1.1h1V3.9h1.6v1.1h1V3.9h1.6v2.3H4.6z" />
        <path d="M5 6h6v5.3H5z" />
      </g>
      {/* Ворота й вікна — кольором щита: вибиті з вежі, а не домальовані. */}
      <g fill={c}>
        <path d="M7.2 8.6h1.6v2.7H7.2z" />
        <path d="M5.9 7h1v1.2h-1zm3.2 0h1v1.2h-1z" />
      </g>
    </Svg>
  );
};

/** Зелений маркер — Племена. Гори. */
export const IconGreenMarker = (p: IconProps) => (
  <Svg {...p} color={p.color ?? "var(--green)"} title={p.title ?? "Зелений маркер"}>
    <circle cx="8" cy="8" r="7.2" opacity={0.9} />
    <path d="M4 10.4l2.4-4 1.6 2.4 1.4-2.2 2.6 3.8z" fill="#ffffff" />
  </Svg>
);

const ICONS: Record<IconKey, (p: IconProps) => ReactElement> = {
  faceUp: IconFaceUp,
  faceDown: IconFaceDown,
  harbor: IconHarbor,
  wilderness: IconWilderness,
  tavern: IconTavern,
  graveyard: IconGraveyard,
  player: IconPlayer,
  redMarker: IconRedMarker,
  greenMarker: IconGreenMarker,
};

export function Icon({ name, ...rest }: { name: IconKey } & IconProps) {
  const C = ICONS[name];
  return <C {...rest} />;
}
