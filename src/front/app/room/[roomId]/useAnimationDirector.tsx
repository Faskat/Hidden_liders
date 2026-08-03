"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { GameEvent, GameStateView, CardCatalogEntry } from "@/lib/types";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { CardSizeToken } from "@/lib/cardSizes";
import { GameCard } from "./Card";
import { CARD_TOTAL_ROTATION, handCardSize } from "./constants";
import { FLIGHT_MS, type Flight } from "./FlightLayer";
import { rectOfCardIn, rectOfZone, zoneHand, zoneParty, type ContentRect, type ZoneKey } from "./ZoneAnchors";

/** Пауза між подіями однієї пачки. */
const STAGGER_MS = 140;

/**
 * Понад стільки подій за раз — не анімуємо взагалі.
 *
 * Опитування раз на 4 с означає, що за один тік може прилетіти цілий хід
 * суперника, а після перепідключення — і кілька ходів. Показувати їх усі
 * по черзі гірше, ніж не показувати: доки черга догравала б, стан на дошці
 * уже втретє змінився б.
 */
const MAX_BATCH = 12;

/**
 * Хто саме зараз летить: `"<зона>|<card_id>"`.
 *
 * Стан застосовується ДО анімації — карта вже намальована в загоні, коли
 * подія про неї тільки приїхала. Політ через це декоративний і йде поверх
 * уже правильної дошки, тож ціль на час польоту треба ховати, інакше карта
 * видима двічі: і на місці, і в повітрі.
 */
type InFlightSet = ReadonlySet<string>;

const InFlightContext = createContext<InFlightSet>(new Set());

export const flightKey = (zone: ZoneKey, cardId: string) => `${zone}|${cardId}`;

/** Чи ховати цю карту зараз, бо її представляє летюча копія. */
export function useIsInFlight(zone: ZoneKey, cardId: string): boolean {
  return useContext(InFlightContext).has(flightKey(zone, cardId));
}

export function InFlightProvider({ value, children }: { value: InFlightSet; children: React.ReactNode }) {
  return <InFlightContext.Provider value={value}>{children}</InFlightContext.Provider>;
}

/**
 * Ховає карту, доки її представляє летюча копія.
 *
 * Саме `visibility`, а не умовний рендер: карта має лишитися в потоці й
 * зберегти своє місце у віялі. Прибрати її з DOM означало б, що віяло
 * миттєво перекладеться під меншу кількість карт, а за 420 мс — назад,
 * і політ прилетів би не туди, де карта врешті опиниться.
 *
 * Окремий компонент потрібен, бо хук не можна викликати всередині `.map`
 * у JSX батька.
 */
export function InFlightHide({
  zone,
  cardId,
  children,
}: {
  zone: ZoneKey;
  cardId: string;
  children: React.ReactNode;
}) {
  const hidden = useIsInFlight(zone, cardId);
  return <span className="inline-block" style={hidden ? { visibility: "hidden" } : undefined}>{children}</span>;
}

/** Куди сідає гравець на цьому екрані — потрібно, щоб знати кут повороту його зон. */
export type SeatMap = Record<string, string>;

type Ctx = {
  state: GameStateView;
  seats: SeatMap;
  catalog?: Record<string, CardCatalogEntry>;
};

let nextFlightId = 1;

export function useAnimationDirector(ctx: Ctx) {
  const reduced = useReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [inFlight, setInFlight] = useState<InFlightSet>(new Set());

  const queue = useRef<GameEvent[]>([]);
  const running = useRef(false);
  const timers = useRef<number[]>([]);
  /**
   * Найбільший `seq`, який уже пішов в анімацію.
   *
   * Курсор у запиті від подвоєння не рятує. Опитування вилітає зі значенням
   * курсора на момент старту; якщо доки воно летіло, гравець зіграв карту, то
   * і відповідь на команду, і відповідь на опитування принесуть ту саму подію,
   * бо обидві питали з однієї позиції. У живій грі це видно як дві однакові
   * карти, що летять поруч.
   */
  const lastSeq = useRef(0);
  /** Свіжий контекст для відкладених кроків: черга переживає кілька рендерів. */
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const release = useCallback((keys: string[]) => {
    setInFlight((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }, []);

  const onFlightDone = useCallback((id: number) => {
    setFlights((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /**
   * Прямокутник, з якого стартує політ.
   *
   * Спершу шукаємо саму карту в зоні-джерелі: якщо стан ще не встиг
   * застосуватися, вона там є, і політ почнеться рівно з її місця у віялі.
   * Якщо карти вже немає — беремо центр зони. Це не запасний варіант «аби
   * що»: для гавані й пустоші інакше й не буває, бо клієнт про їхній вміст
   * не знає нічого, крім кількості.
   */
  const rectFor = useCallback((zone: ZoneKey, cardId?: string): ContentRect | null => {
    if (cardId) {
      const exact = rectOfCardIn(zone, cardId);
      if (exact) return exact;
    }
    return rectOfZone(zone);
  }, []);

  const seatOf = useCallback((playerId?: string) => {
    return (playerId && ctxRef.current.seats[playerId]) || "bottom";
  }, []);

  const rotationOf = useCallback((playerId?: string): number => {
    return CARD_TOTAL_ROTATION[seatOf(playerId)] ?? 0;
  }, [seatOf]);

  /** Один крок сценарію. Повертає ключі, які треба відпустити після польоту. */
  const play = useCallback((ev: GameEvent): string[] => {
    const { state, catalog } = ctxRef.current;

    if (ev.event_type === "CardPlayed" && ev.player_id) {
      const owner = ev.player_id;
      const handSize: CardSizeToken = handCardSize(seatOf(owner));
      const target = zoneParty(owner);
      const from = rectFor(zoneHand(owner), ev.card_id);
      // Карта вже в загоні — саме туди й летимо, з точністю до її місця у віялі.
      const to = ev.card_id ? rectFor(target, ev.card_id) : rectOfZone(target);
      if (!from || !to) return [];

      const rot = rotationOf(owner);
      const face = ev.card_id ? (
        <GameCard cardId={ev.card_id} variant="open" size={handSize} catalog={catalog ?? state.cards} />
      ) : (
        <GameCard cardId="hidden" variant="hidden" size={handSize} />
      );

      setFlights((prev) => [...prev, {
        id: nextFlightId++,
        from, to,
        fromRotation: rot,
        toRotation: rot,
        fromSize: handSize,
        toSize: "tiny",
        node: face,
      }]);

      if (!ev.card_id) return [];
      const key = flightKey(target, ev.card_id);
      setInFlight((prev) => new Set(prev).add(key));
      return [key];
    }

    return [];
  }, [rectFor, rotationOf, seatOf]);

  const drain = useCallback(() => {
    if (running.current) return;
    const batch = queue.current;
    queue.current = [];
    if (!batch.length) return;
    running.current = true;

    batch.forEach((ev, i) => {
      const t = window.setTimeout(() => {
        const keys = play(ev);
        if (keys.length) {
          window.setTimeout(() => release(keys), FLIGHT_MS);
        }
        if (i === batch.length - 1) {
          running.current = false;
          // Поки грала ця пачка, могла накопичитися наступна.
          if (queue.current.length) drain();
        }
      }, i * STAGGER_MS);
      timers.current.push(t);
    });
  }, [play, release]);

  /**
   * Прийняти нову пачку подій.
   *
   * Викликається з того самого місця, що й `setState`, — і з відповіді на
   * команду, і з опитування. Розрізняти їх не треба: карту в загін могли
   * покласти і своїм ходом, і чужим, а виглядати це має однаково.
   */
  const push = useCallback((events: GameEvent[] | undefined, truncated?: boolean) => {
    if (!events?.length) return;
    const maxSeq = events[events.length - 1].seq;

    // Курсор рухаємо навіть тоді, коли не анімуємо: інакше пропущена пачка
    // повернулася б наступним запитом і зіграла б давно застарілі події.
    const fresh = events.filter((e) => e.seq > lastSeq.current);
    if (typeof maxSeq === "number") lastSeq.current = Math.max(lastSeq.current, maxSeq);

    if (reduced || truncated || !fresh.length || fresh.length > MAX_BATCH) return;
    queue.current.push(...fresh);
    drain();
  }, [reduced, drain]);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  return { flights, inFlight, push, onFlightDone };
}
