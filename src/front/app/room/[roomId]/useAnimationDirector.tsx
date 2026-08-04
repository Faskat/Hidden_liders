"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { GameEvent, GameStateView, CardCatalogEntry } from "@/lib/types";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { CardSizeToken } from "@/lib/cardSizes";
import { GameCard } from "./Card";
import { CARD_TOTAL_ROTATION, handCardSize } from "./constants";
import { FLIGHT_MS, type Flight } from "./FlightLayer";
import {
  elementOfZone, rectOfCardIn, rectOfZone,
  zoneHand, zoneHidden, zoneLeader, zonePanel, zoneParty, zoneTavern,
  ZONE_GRAVEYARD, ZONE_HARBOR, ZONE_TRACK, ZONE_WILDERNESS,
  type ContentRect, type ZoneKey,
} from "./ZoneAnchors";

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

/** Фора, за яку React встигає змонтувати стан, що приїхав разом із подіями. */
const LEAD_IN_MS = 40;

/** Крок сцени роздачі. Коротший за звичайний: кроків багато, а сенс у ритмі. */
const SETUP_STAGGER_MS = 90;

/** На скільки розтягуємо роздачу незалежно від кількості гравців, мс. */
const SETUP_TOTAL_MS = 2600;

/** Нижче цього кроки зливаються в кашу. */
const SETUP_STAGGER_MIN_MS = 45;

/**
 * Крок сцени підганяється під її довжину.
 *
 * Кроків у роздачі — `4 + 7×гравців`: на двох це 18, на шістьох 46. З
 * фіксованим кроком роздача на шістьох тривала б утричі довше, ніж на двох,
 * тож ціль — стала загальна тривалість, а не сталий крок. Верхня межа лишає
 * малим партіям спокійний ритм замість неприродно повільного.
 */
function setupStagger(steps: number): number {
  return Math.max(SETUP_STAGGER_MIN_MS, Math.min(SETUP_STAGGER_MS, Math.round(SETUP_TOTAL_MS / steps)));
}

/**
 * Події, які анімують дошку на місці, а не польотом карти.
 *
 * Вони нічого не ховають, тож у сухому проході їх нема сенсу торкатися —
 * і не можна, бо вони мають побічні дії.
 */
const IN_PLACE_EVENTS = new Set([
  "LeaderRevealed",
  "HandsSwapped",
  "TurnPhaseChanged",
  "DeckShuffled",
  "GameEndTriggered",
]);

/** Події, за якими впізнаємо початкову роздачу. */
const SETUP_EVENTS = new Set([
  "FirstPlayerChosen",
  "MarkersPlaced",
  "GraveyardInitialized",
  "TavernFilled",
  "StartingHandSet",
  "HeroDrawn",
]);

/**
 * Порядок кроків у сцені роздачі.
 *
 * Бекенд віддає події так, як їх зручно застосовувати: спершу все спорядження
 * столу, потім гравці ПО ЧЕРЗІ, кожному одразу всі п'ять карт. Дивитися на це
 * незручно — виглядає, наче одному роздали всю руку, і лише потім згадали про
 * решту. Тому добір карт перекладається по колу: по одній карті кожному, і так
 * п'ять разів, як роздають насправді.
 *
 * Решта подій розкладу пропускається: `LeaderDealt` і `DeckShuffled` нічого не
 * рухають на екрані, а `StartingHandSet` лише повторює те, що вже показали
 * п'ять `HeroDrawn`.
 */
function dealScene(events: GameEvent[]): GameEvent[] {
  const table: GameEvent[] = [];
  const byPlayer = new Map<string, GameEvent[]>();

  for (const e of events) {
    if (e.event_type === "TavernFilled") {
      // Одна подія на всі три слоти — а показати треба, як їх викладають
      // зліва направо. Ріжемо на подію на слот, і крок сцени робить решту.
      // Безпечно: `TavernFilled` буває лише в розкладі (`setup.py:118`),
      // добір по ходу гри — це вже `TavernRefilled`.
      const slots = (e.tavern_slot_indices as number[] | undefined) ?? [];
      const ids = e.card_ids ?? [];
      slots.forEach((slot, i) => {
        table.push({ ...e, tavern_slot_indices: [slot], card_ids: [ids[i]] } as GameEvent);
      });
    } else if (e.event_type === "GraveyardInitialized") {
      table.push(e);
    } else if (e.event_type === "HeroDrawn" && e.player_id) {
      const list = byPlayer.get(e.player_id) ?? [];
      list.push(e);
      byPlayer.set(e.player_id, list);
    } else if (e.event_type === "HeroPutFaceDown" || e.event_type === "HeroDiscardedToWilderness") {
      // Ці два йдуть у кінець: спершу всі отримують карти, потім кожен
      // визначається з прихованим героєм і скидом.
      table.push({ ...e, __tail: true } as GameEvent);
    }
  }

  // Array.from, а не spread: ціль компіляції нижча за es2015, і ітератор Map
  // напряму не розкладається.
  const hands = Array.from(byPlayer.values());
  const rounds = Math.max(0, ...hands.map((h) => h.length));
  const dealt: GameEvent[] = [];
  for (let r = 0; r < rounds; r++) {
    for (const h of hands) if (h[r]) dealt.push(h[r]);
  }

  const setupTable = table.filter((e) => !("__tail" in e));
  const tail = table.filter((e) => "__tail" in e);
  return [...setupTable, ...dealt, ...tail];
}

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

/** Яким боком карта повернута: лицем чи сорочкою. */
type Face = "up" | "down";

type Ctx = {
  state: GameStateView;
  seats: SeatMap;
  /** Хто дивиться. Тільки своя рука намальована картами — решта сорочками. */
  meId?: string | null;
  catalog?: Record<string, CardCatalogEntry>;
};

let nextFlightId = 1;

export function useAnimationDirector(ctx: Ctx) {
  const reduced = useReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [inFlight, setInFlight] = useState<InFlightSet>(new Set());

  /** Черга пачок: у кожної свій крок, бо сцена роздачі йде щільніше за хід. */
  const queue = useRef<{ evs: GameEvent[]; stagger: number; scene?: boolean }[]>([]);
  const running = useRef(false);
  const timers = useRef<number[]>([]);
  /** Чи є пачка, що грає зараз, сценою роздачі: лише її дозволено пропускати. */
  const playingScene = useRef(false);
  /**
   * Сухий прохід: `play` рахує, що ховати, і нічого не рухає.
   *
   * Потрібен тому, що ховати цілі покроково — запізно. Стан приїжджає разом
   * із подіями й малюється одразу, тож карта, чия черга летіти надійде за
   * півсекунди, весь цей час уже лежить на місці. Найпомітніше це в руці:
   * карта з'являлася в ній рівно тоді, коли тільки вирушала в дорогу.
   */
  const dryRun = useRef(false);
  /** Скільки сорочок чужої руки вже розібрав сухий прохід, по гравцях. */
  const blindSeen = useRef(new Map<string, number>());
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
  /** Хто ходив останнім: підсвічуємо панель лише при зміні гравця, не фази. */
  const lastActive = useRef<string | null>(null);
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

  /**
   * Зона прихованих героїв, а якщо її ще немає — загін.
   *
   * Бейдж прихованих малюється лише тоді, коли їх хоч один, тож у момент, коли
   * гравець кладе ПЕРШОГО героя сорочкою вгору, зони-цілі ще не існує. Без
   * цього запасного варіанту саме той хід — єдиний, коли гравець уперше ховає
   * карту, — не показував би нічого.
   */
  const hiddenZoneOf = useCallback((playerId: string): ZoneKey => {
    return rectOfZone(zoneHidden(playerId)) ? zoneHidden(playerId) : zoneParty(playerId);
  }, []);

  const rotationOf = useCallback((playerId?: string): number => {
    return CARD_TOTAL_ROTATION[seatOf(playerId)] ?? 0;
  }, [seatOf]);

  /**
   * Розмір карти в зоні.
   *
   * Політ починається розміром джерела й закінчується розміром цілі, тому
   * ці числа мусять збігатися з тим, що реально малює розмітка, — інакше
   * карта стрибне в перший або останній кадр.
   */
  const sizeOfZone = useCallback((zone: ZoneKey): CardSizeToken => {
    if (zone.startsWith("hand:")) return handCardSize(seatOf(zone.slice(5)));
    if (zone.startsWith("tavern:")) return "large";
    if (zone === ZONE_GRAVEYARD) return "small";
    if (zone === ZONE_HARBOR || zone === ZONE_WILDERNESS) return "small";
    // Загін і приховані герої малюються найдрібнішим розміром.
    return "tiny";
  }, [seatOf]);

  /**
   * Хто «власник» зони — від нього залежить кут повороту карти.
   * Зони дошки нікому не належать і лежать рівно.
   */
  const ownerOfZone = (zone: ZoneKey): string | undefined => {
    const i = zone.indexOf(":");
    return i > 0 && !zone.startsWith("tavern:") ? zone.slice(i + 1) : undefined;
  };

  /**
   * Зібрати політ із зони в зону.
   *
   * `cardId` — чим малювати карту й що шукати в DOM; `undefined` означає
   * сорочку. `hideAt` — зона, в якій ціль треба сховати на час польоту
   * (там, де карта вже намальована новим станом).
   */
  const fly = useCallback((opts: {
    fromZone: ZoneKey;
    toZone: ZoneKey;
    cardId?: string;
    /** Яким боком карта летить. За замовчуванням лицем — якщо id взагалі відомий. */
    face?: Face;
    /** Другий бік: якщо заданий, карта перевертається на середині шляху. */
    flipTo?: Face;
    hideAt?: ZoneKey;
  }): string[] => {
    /**
     * Сухий прохід: жодних вимірювань, жодного польоту — лише ключ цілі.
     *
     * Навмисно без перевірки, чи зони взагалі є на екрані: пачка ховає цілі
     * до першого кроку, а на переході з лобі дошка в цю мить ще монтується.
     * Зайвий ключ безпечний — його однаково відпустить таймер свого кроку.
     */
    if (dryRun.current) {
      return opts.hideAt && opts.cardId ? [flightKey(opts.hideAt, opts.cardId)] : [];
    }

    const { state, catalog } = ctxRef.current;
    const from = rectFor(opts.fromZone, opts.cardId);
    const to = rectFor(opts.toZone, opts.cardId);
    if (!from || !to) return [];

    const fromSize = sizeOfZone(opts.fromZone);
    const toSize = sizeOfZone(opts.toZone);
    const cards = catalog ?? state.cards;
    // Без id лицьового боку не існує: карту суперника клієнту не показали.
    const side = (f: Face) =>
      f === "up" && opts.cardId
        ? <GameCard cardId={opts.cardId} variant="open" size={fromSize} catalog={cards} />
        : <GameCard cardId={opts.cardId ?? "back"} variant="hidden" size={fromSize} />;

    const startFace: Face = opts.face ?? (opts.cardId ? "up" : "down");

    setFlights((prev) => [...prev, {
      id: nextFlightId++,
      from, to,
      fromRotation: rotationOf(ownerOfZone(opts.fromZone)),
      toRotation: rotationOf(ownerOfZone(opts.toZone)),
      fromSize, toSize,
      node: side(startFace),
      // Перевертати нема сенсу, якщо обидва боки намалюються однаково —
      // тобто коли карта нам невідома й «лице» теж вийде сорочкою.
      flipTo: opts.flipTo && opts.flipTo !== startFace && opts.cardId
        ? side(opts.flipTo)
        : undefined,
    }]);

    if (!opts.hideAt || !opts.cardId) return [];
    const key = flightKey(opts.hideAt, opts.cardId);
    setInFlight((prev) => new Set(prev).add(key));
    return [key];
  }, [rectFor, rotationOf, sizeOfZone]);

  /**
   * Зона бекенда -> зона реєстру.
   *
   * Словник збігається навмисно (див. шапку ZoneAnchors), лишається тільки
   * дописати id гравця там, де на бекенді він лежить окремим полем.
   */
  const mapZone = (zone: string | undefined, playerId?: string): ZoneKey | null => {
    if (!zone) return null;
    if (zone === "hand") return playerId ? zoneHand(playerId) : null;
    if (zone === "party_open") return playerId ? zoneParty(playerId) : null;
    if (zone === "party_hidden") return playerId ? zoneHidden(playerId) : null;
    if (zone === "harbor") return ZONE_HARBOR;
    if (zone === "wilderness") return ZONE_WILDERNESS;
    if (zone === "graveyard") return ZONE_GRAVEYARD;
    const m = /^tavern_(\d)$/.exec(zone);
    return m ? zoneTavern(Number(m[1])) : null;
  };

  /**
   * Чи намальована рука цього гравця сорочками.
   *
   * Саме «чи це я», а не «чи прийшли id карт»: добір із таверни публічний, і
   * `card_id` у події є навіть тоді, коли карта їде в чужу руку — а там її
   * все одно намалюють сорочкою. Порожня власна рука теж не привід вважати
   * її чужою.
   */
  const isBlindHand = useCallback((playerId: string) => playerId !== ctxRef.current.meId, []);

  /**
   * Ключ сорочки, що приїжджає в чужу руку.
   *
   * Своя карта ховається за `card_id`, а в чужій руці id немає в розмітці
   * взагалі: там рівно `hand_count` однакових сорочок, ключованих позицією.
   * Тому ховаємо ті, що лежать останніми, — сорочки взаємозамінні, важлива
   * лише кількість. Лічильник іде з хвоста пачки (див. сухий прохід у
   * `drain`), тож остання подія забирає останню сорочку, передостання —
   * передостанню, і знати наперед, скільки їх у пачці, не треба.
   */
  const blindHandKey = useCallback((playerId: string): string[] => {
    // Лише сухий прохід: він єдиний рахує позиції, і лічильник має бути на
    // пачку, а не подвоюватися на реальному проході.
    if (!dryRun.current) return [];
    const p = ctxRef.current.state.players.find((x) => x.player_id === playerId);
    if (!p) return [];
    const seen = (blindSeen.current.get(playerId) ?? 0) + 1;
    blindSeen.current.set(playerId, seen);
    const idx = (p.hand_count ?? 0) - seen;
    return idx >= 0 ? [flightKey(zoneHand(playerId), `hidden-${idx}`)] : [];
  }, []);

  /** Один крок сценарію. Повертає ключі, які треба відпустити після польоту. */
  const play = useCallback((ev: GameEvent): string[] => {
    const owner = ev.player_id;

    // Анімації «на місці» в сухому проході пропускаються: ховати їм нічого,
    // зате вони мають побічні дії — запускають рух і зсувають `lastActive`, —
    // і виконати їх двічі не можна.
    if (dryRun.current && IN_PLACE_EVENTS.has(ev.event_type)) return [];

    switch (ev.event_type) {
      case "CardPlayed": {
        if (!owner) return [];
        // Прихованого героя кладуть сорочкою вгору — карта перевертається
        // в польоті. Для чужого гравця `card_id` відредаговано, тож летить
        // сорочка з самого початку й перевертати нема чого.
        const faceDown = ev.as_open === false;
        return fly({
          fromZone: zoneHand(owner),
          toZone: faceDown ? hiddenZoneOf(owner) : zoneParty(owner),
          cardId: ev.card_id,
          face: "up",
          flipTo: faceDown ? "down" : undefined,
          hideAt: faceDown ? undefined : zoneParty(owner),
        });
      }

      case "HeroPutFaceDown": {
        // Здібність «Place»: карта з руки лягає в приховані героїв.
        if (!owner) return [];
        return fly({
          fromZone: zoneHand(owner),
          toZone: hiddenZoneOf(owner),
          cardId: ev.card_id,
          face: "up",
          flipTo: "down",
        });
      }

      case "HeroRevealed": {
        // Прихованого героя перевертають лицем: він переїжджає з бейджа
        // прихованих у відкритий загін і по дорозі показує обличчя.
        if (!owner) return [];
        return fly({
          fromZone: hiddenZoneOf(owner),
          toZone: zoneParty(owner),
          cardId: ev.card_id,
          face: "down",
          flipTo: "up",
          hideAt: zoneParty(owner),
        });
      }

      case "LeaderRevealed": {
        /**
         * Розгортання плашки лідера на місці.
         *
         * Не переворот «лице -> сорочка -> лице»: до розкриття плашки взагалі
         * немає в розмітці. Проекція ховає `leader_card_id` чужого гравця до
         * кінця гри (`leader_view` у projection.py), тож картка лідера
         * з'являється вже відкритою — перевертати нічого. Тому вона
         * розгортається з ребра: жест той самий, а бреше менше.
         *
         * Через шар польотів це не проходить узагалі: карта нікуди не летить,
         * а її «лице» — власна плашка з назвою й фракціями, а не `GameCard`.
         */
        if (!owner) return [];
        const el = elementOfZone(zoneLeader(owner));
        el?.animate(
          [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
          { duration: FLIGHT_MS, easing: "cubic-bezier(.2,.8,.25,1)" }
        );
        return [];
      }

      case "HandsSwapped": {
        // Дві зустрічні дуги сорочками. Що саме помінялося, знають лише
        // учасники, і показувати це не можна — тому обидві карти безликі.
        const a = ev.player_id_1;
        const b = ev.player_id_2;
        if (!a || !b) return [];
        fly({ fromZone: zoneHand(a), toZone: zoneHand(b), face: "down" });
        fly({ fromZone: zoneHand(b), toZone: zoneHand(a), face: "down" });
        return [];
      }

      case "HeroDrawn":
      case "CardDrawn": {
        if (!owner) return [];
        const src = ev.source === "tavern" && typeof ev.tavern_slot === "number"
          ? zoneTavern(ev.tavern_slot)
          : ZONE_HARBOR;
        const blind = isBlindHand(owner);
        const keys = fly({
          fromZone: src,
          toZone: zoneHand(owner),
          cardId: ev.card_id,
          hideAt: blind ? undefined : zoneHand(owner),
        });
        return blind ? blindHandKey(owner) : keys;
      }

      case "TavernRefilled": {
        if (typeof ev.slot_index !== "number") return [];
        // З гавані виїжджає сорочка й перевертається лицем уже в слоті —
        // тому летить `variant="hidden"`, а сам слот показує карту.
        return fly({
          fromZone: ZONE_HARBOR,
          toZone: zoneTavern(ev.slot_index),
          cardId: ev.card_id,
          face: "down",
          flipTo: "up",
          hideAt: zoneTavern(ev.slot_index),
        });
      }

      case "CardsDiscarded":
      case "HeroDiscardedToWilderness": {
        if (!owner) return [];
        const ids = ev.card_ids ?? (ev.card_id ? [ev.card_id] : []);
        // Скид без id (чужий гравець) усе одно показуємо — стільки сорочок,
        // скільки карт пішло: рух руки суперника видно, вміст — ні.
        const items = ids.length ? ids : Array.from({ length: ev.count ?? 0 });
        const keys: string[] = [];
        items.forEach((cid) => {
          keys.push(...fly({
            fromZone: zoneHand(owner),
            toZone: ZONE_WILDERNESS,
            cardId: typeof cid === "string" ? cid : undefined,
            // Скид іде в пустош сорочкою: у проекції пустош — самий лічильник,
            // і показувати лице карти, яка туди пішла, було б більше, ніж дає стан.
            face: "down",
          }));
        });
        return keys;
      }

      case "HeroKilled": {
        if (!owner) return [];
        return fly({
          fromZone: zoneParty(owner),
          toZone: ZONE_GRAVEYARD,
          cardId: ev.card_id,
          hideAt: ZONE_GRAVEYARD,
        });
      }

      case "CardMoved": {
        const toPlayer = ev.to_player_id ?? owner;
        const fromZone = mapZone(ev.from_zone, ev.from_player_id ?? owner);
        const toZone = mapZone(ev.to_zone, toPlayer);
        if (!fromZone || !toZone) return [];
        const blind = ev.to_zone === "hand" && !!toPlayer && isBlindHand(toPlayer);
        const keys = fly({ fromZone, toZone, cardId: ev.card_id, hideAt: blind ? undefined : toZone });
        return blind && toPlayer ? blindHandKey(toPlayer) : keys;
      }

      case "TavernFilled": {
        // Розклад на старті: три карти з гавані лягають у слоти, зліва направо.
        const slots = (ev.tavern_slot_indices as number[] | undefined) ?? [];
        const ids = ev.card_ids ?? [];
        const keys: string[] = [];
        slots.forEach((slot, i) => {
          keys.push(...fly({
            fromZone: ZONE_HARBOR,
            toZone: zoneTavern(slot),
            cardId: ids[i],
            face: "down",
            flipTo: "up",
            hideAt: zoneTavern(slot),
          }));
        });
        return keys;
      }

      case "GraveyardInitialized": {
        return fly({
          fromZone: ZONE_HARBOR,
          toZone: ZONE_GRAVEYARD,
          cardId: ev.card_id,
          face: "down",
          flipTo: "up",
          hideAt: ZONE_GRAVEYARD,
        });
      }

      case "TurnPhaseChanged": {
        /**
         * Хід перейшов до іншого гравця — його панель коротко спалахує.
         *
         * Тільки при зміні гравця, а не фази: фаза міняється по 4 рази за хід,
         * і панель блимала б майже безперервно. Фаза й так написана в шапці.
         */
        const nextId = ctxRef.current.state.current_player_id;
        if (!nextId || nextId === lastActive.current) return [];
        lastActive.current = nextId;
        elementOfZone(zonePanel(nextId))?.animate(
          [
            { boxShadow: "0 0 0 0 rgba(201,162,39,0)" },
            { boxShadow: "0 0 0 4px rgba(201,162,39,0.45)", offset: 0.35 },
            { boxShadow: "0 0 0 0 rgba(201,162,39,0)" },
          ],
          { duration: 900, easing: "ease-out" }
        );
        return [];
      }

      case "DeckShuffled": {
        // Пустош перетасували в гавань. Стос коротко хитається — видно, що
        // колода не просто змінила лічильник, а зібралася заново.
        elementOfZone(ZONE_HARBOR)?.animate(
          [
            { transform: "rotate(0deg)" },
            { transform: "rotate(-3.5deg) translateY(-3px)", offset: 0.3 },
            { transform: "rotate(3deg)", offset: 0.65 },
            { transform: "rotate(0deg)" },
          ],
          { duration: 520, easing: "ease-in-out" }
        );
        return [];
      }

      case "GameEndTriggered": {
        // Спалах уздовж треку перед тим, як з'явиться вікно результатів.
        elementOfZone(ZONE_TRACK)?.animate(
          [
            { filter: "brightness(1)" },
            { filter: "brightness(1.5)", offset: 0.4 },
            { filter: "brightness(1)" },
          ],
          { duration: 700, easing: "ease-out" }
        );
        return [];
      }

      default:
        return [];
    }
  }, [fly, hiddenZoneOf, blindHandKey, isBlindHand]);

  const drain = useCallback(() => {
    if (running.current) return;
    const batch = queue.current.shift();
    if (!batch) return;
    running.current = true;
    playingScene.current = batch.scene === true;

    const hides: string[][] = batch.evs.map(() => []);

    /**
     * Сховати цілі ВСІЄЇ пачки, ще не програвши жодного кроку.
     *
     * Інакше карта, чий крок стоїть у пачці п'ятим, півсекунди лежала б на
     * своєму місці ще до того, як по неї вирушив політ, — а виглядає це так,
     * ніби карта з'явилася в руці й лише потім до неї полетіла копія.
     *
     * Прохід іде з хвоста: ховати можна в будь-якому порядку, а сорочки
     * чужої руки нумеруються з кінця (див. `blindHandKey`), і з хвоста кожна
     * знаходить свою позицію без попереднього підрахунку пачки.
     */
    const hide = () => {
      dryRun.current = true;
      blindSeen.current = new Map();
      const fresh: string[] = [];
      for (let i = batch.evs.length - 1; i >= 0; i--) {
        play(batch.evs[i]).forEach((k) => {
          if (hides[i].indexOf(k) < 0) {
            hides[i].push(k);
            fresh.push(k);
          }
        });
      }
      dryRun.current = false;

      if (!fresh.length) return;
      setInFlight((prev) => {
        const next = new Set(prev);
        fresh.forEach((k) => next.add(k));
        return next;
      });
    };

    const schedule = () => {
      batch.evs.forEach((ev, i) => {
        const t = window.setTimeout(() => {
          play(ev);
          const keys = hides[i];
          if (keys.length) {
            window.setTimeout(() => release(keys), FLIGHT_MS);
          }
          if (i === batch.evs.length - 1) {
            running.current = false;
            playingScene.current = false;
            // Поки грала ця пачка, могла накопичитися наступна.
            if (queue.current.length) drain();
          }
        }, i * batch.stagger);
        timers.current.push(t);
      });
    };

    /**
     * Фора перед першим кроком.
     *
     * Політ вимірюється по DOM: зона-джерело й зона-ціль мають уже існувати.
     * Але події приходять разом зі станом, який їх породив, і без фори перший
     * крок спрацював би до того, як React встиг змонтувати нове. Найгірше це
     * в роздачі: перехід із лобі на стіл монтує дошку цілком, і крок нуль
     * (цвинтар) тихо губився — зони ще не зареєстровані, міряти нема що.
     *
     * Саме таймер, а не `requestAnimationFrame`: у прихованій вкладці кадри
     * не йдуть узагалі, і пачка зависла б назавжди — разом із чергою, бо
     * `running` лишився б піднятим.
     *
     * Ховання ж іде двічі, і жоден із двох проходів не зайвий. Перший не
     * чекає нічого: він нічого не міряє в DOM, а кожен зайвий кадр — це кадр,
     * у якому карта вже лежить на місці. Але позицію сорочки в чужій руці він
     * порахувати ще не може — `push` викликається поруч із `setState`, і
     * свіжий стан у `ctxRef` з'являється аж після коміту. Другий прохід
     * добирає те, що проґавив перший; ключі об'єднуються, тож повторний
     * просто не додасть нічого нового.
     *
     * Порядок при однаковій затримці — це порядок реєстрації, тому другий
     * прохід гарантовано встигає до першого кроку.
     */
    timers.current.push(window.setTimeout(hide, 0));
    timers.current.push(window.setTimeout(hide, LEAD_IN_MS));
    timers.current.push(window.setTimeout(schedule, LEAD_IN_MS));
  }, [play, release]);

  /**
   * Обірвати сцену роздачі.
   *
   * Вона триває майже три секунди, і гравцеві, який уже бачив її, має бути
   * куди клацнути. Стан від цього не страждає — анімації декоративні й ідуть
   * поверх уже правильної дошки.
   *
   * Тільки сцену: слухач висить на всьому столі, тож інакше клік по власній
   * карті мимохідь обривав би показ чужого ходу — а його гравець якраз і не
   * просив пропускати.
   */
  const skip = useCallback(() => {
    if (!playingScene.current) return;
    playingScene.current = false;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    queue.current = [];
    running.current = false;
    setFlights([]);
    setInFlight(new Set());
  }, []);

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
    if (reduced || truncated || !fresh.length) return;

    /**
     * Роздача — не «завелика пачка», а окрема сцена.
     *
     * Усі події розкладу прилітають одним шматком: на двох гравців це вже
     * близько двадцяти подій, на шістьох — за п'ятдесят. Під загальне
     * обмеження вони не проходять, і без окремої гілки початок партії був би
     * єдиним моментом, коли стіл заповнюється зовсім без руху.
     */
    if (fresh.some((e) => SETUP_EVENTS.has(e.event_type))) {
      const scene = dealScene(fresh);
      if (scene.length) {
        queue.current.push({ evs: scene, stagger: setupStagger(scene.length), scene: true });
        drain();
      }
      return;
    }

    if (fresh.length > MAX_BATCH) return;
    queue.current.push({ evs: fresh, stagger: STAGGER_MS });
    drain();
  }, [reduced, drain]);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  return { flights, inFlight, push, onFlightDone, skip };
}
