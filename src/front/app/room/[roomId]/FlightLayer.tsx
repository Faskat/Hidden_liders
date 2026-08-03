"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CARD_SIZES, type CardSizeToken } from "@/lib/cardSizes";
import { setFlightLayer, type ContentRect } from "./ZoneAnchors";

/** Скільки летить карта. Менше — не встигаєш прочитати, більше — гра гальмує. */
export const FLIGHT_MS = 420;

/** Наскільки карту підкидає в середині шляху, у частках дистанції. */
const ARC_RATIO = 0.12;

/** Мінімальний і максимальний підйом дуги, щоб короткий політ не був плаский, а довгий не йшов за екран. */
const ARC_MIN = 14;
const ARC_MAX = 90;

export type Flight = {
  id: number;
  from: ContentRect;
  to: ContentRect;
  fromRotation: number;
  toRotation: number;
  fromSize: CardSizeToken;
  toSize: CardSizeToken;
  /** Що малюємо в польоті. Готовий вузол, бо карта може летіти і лицем, і сорочкою. */
  node: ReactNode;
  /** Перевернути карту на середині шляху: другий бік малюється з `flipTo`. */
  flipTo?: ReactNode;
};

function center(r: ContentRect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Одна летюча карта.
 *
 * Анімується через Web Animations API, а не CSS-класом: from/to в кожного
 * польоту свої, і виразити їх класом можна було б хіба що через купу
 * інлайнових CSS-змінних. `element.animate()` до того ж віддає `finished`,
 * тобто прибирання за собою не потребує окремого слухача `animationend`.
 */
function FlightCard({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const faceRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      onDone(flight.id);
      return;
    }
    const a = center(flight.from);
    const b = center(flight.to);
    const specFrom = CARD_SIZES[flight.fromSize];
    const specTo = CARD_SIZES[flight.toSize];
    const scaleTo = specTo.w / specFrom.w;

    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const arc = Math.min(ARC_MAX, Math.max(ARC_MIN, dist * ARC_RATIO));

    /**
     * Кут інтерполюємо найкоротшим шляхом.
     *
     * Панель ліворуч має 270°, нижня — 0°. Наївне 0 → 270 крутило б карту на
     * три чверті обороту проти годинникової; насправді вона просто повернута
     * на 90° в інший бік.
     */
    let dr = ((flight.toRotation - flight.fromRotation) % 360 + 540) % 360 - 180;
    const r0 = flight.fromRotation;
    const r1 = r0 + dr;

    const frame = (t: number, lift: number) => ({
      transform:
        `translate(${a.x + (b.x - a.x) * t - specFrom.w / 2}px, ` +
        `${a.y + (b.y - a.y) * t - lift - specFrom.h / 2}px) ` +
        `rotate(${r0 + dr * t}deg) scale(${1 + (scaleTo - 1) * t})`,
    });

    const anim = el.animate(
      [frame(0, 0), { ...frame(0.5, arc), offset: 0.5 }, frame(1, 0)],
      { duration: FLIGHT_MS, easing: "cubic-bezier(.2,.8,.25,1)", fill: "forwards" }
    );

    // Переворот: обидва боки лежать один на одному, і на середині шляху
    // видимість міняється місцями. Це дешевше за 3D-трансформ і, головне,
    // не вимагає `transform-style: preserve-3d` на предку — а предок тут
    // спільний зі столом, у якого свій `scale`.
    const flips: Animation[] = [];
    if (flight.flipTo && faceRef.current && backRef.current) {
      const opts: KeyframeAnimationOptions = { duration: FLIGHT_MS, easing: "linear", fill: "forwards" };
      flips.push(
        faceRef.current.animate(
          [{ transform: "scaleX(1)" }, { transform: "scaleX(0)", offset: 0.5 }, { transform: "scaleX(0)" }],
          opts
        ),
        backRef.current.animate(
          [{ transform: "scaleX(0)" }, { transform: "scaleX(0)", offset: 0.5 }, { transform: "scaleX(1)" }],
          opts
        )
      );
    }

    let alive = true;
    /**
     * Запобіжник.
     *
     * Якщо вкладку згорнули, браузер ставить анімації на паузу, і `finished`
     * не настане, доки на неї не повернуться. Карту-ціль на цей час приховано,
     * тож без таймера вона зникла б із дошки назавжди.
     */
    const guard = window.setTimeout(() => {
      if (alive) { alive = false; onDone(flight.id); }
    }, FLIGHT_MS + 1200);

    anim.finished
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        alive = false;
        window.clearTimeout(guard);
        onDone(flight.id);
      });

    return () => {
      alive = false;
      window.clearTimeout(guard);
      anim.cancel();
      flips.forEach((f) => f.cancel());
    };
  }, [flight, onDone]);

  const spec = CARD_SIZES[flight.fromSize];
  return (
    <div
      ref={ref}
      className="absolute left-0 top-0"
      style={{ width: spec.w, height: spec.h, transformOrigin: "center center", willChange: "transform" }}
    >
      <div ref={faceRef} className="absolute inset-0" style={{ transformOrigin: "center center" }}>
        {flight.node}
      </div>
      {flight.flipTo && (
        <div ref={backRef} className="absolute inset-0" style={{ transformOrigin: "center center", transform: "scaleX(0)" }}>
          {flight.flipTo}
        </div>
      )}
    </div>
  );
}

/**
 * Шар польотів.
 *
 * Лежить усередині `.game-table` останньою дитиною, а не в `body` через
 * портал, — і це навмисно протилежне до того, що роблять модалки панелі
 * гравця. Їм `position: fixed` треба рахувати від вікна, тому вони й
 * портальовані; польоту ж треба рахуватися саме від столу, щоб
 * `translate(pan) scale(zoom)` дістався йому задарма й карта не від'їжджала
 * від дошки при зсуві чи зумі.
 */
export function FlightLayer({
  flights,
  onDone,
  skip,
}: {
  flights: Flight[];
  onDone: (id: number) => void;
  /** Обірвати все, що зараз грає: сцена роздачі триває кілька секунд. */
  skip?: () => void;
}) {
  /**
   * Клік ловиться на самому столі, а не на шарі.
   *
   * Шар має `pointer-events: none` — інакше він накрив би всю дошку й забрав
   * кліки в карт. Тому слухач вішається на батька в фазі перехоплення: він
   * спрацьовує до того, як клік дійде до карти, але карті не заважає.
   */
  useEffect(() => {
    if (!skip) return;
    const table = document.querySelector(".game-table");
    if (!table) return;
    const onClick = () => skip();
    table.addEventListener("click", onClick, { capture: true });
    return () => table.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, [skip]);

  return (
    <div
      ref={setFlightLayer}
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 60 }}
    >
      {flights.map((f) => (
        <FlightCard key={f.id} flight={f} onDone={onDone} />
      ))}
    </div>
  );
}
