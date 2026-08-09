/**
 * Спостерігач анімацій столу.
 *
 * Вставляється в сторінку ДО того, як завантажиться застосунок (CDP
 * `Page.addScriptToEvaluateOnNewDocument`), і підмінює `Element.animate`.
 * Це єдина точка, через яку проходить кожен рух на столі: і польоти карт із
 * шару, і анімації «на місці» — підсвітка панелі, тремтіння гавані, спалах
 * треку. Тому перевіряти анімації можна, не дивлячись на пікселі: скільки їх
 * було, звідки й куди, чи переверталася карта.
 *
 * Дивитися на пікселі тут було б і повільніше, і брехливіше: карта в польоті
 * не має жодної ознаки в DOM, за яку можна вхопитися посеред руху, а
 * скриншот-порівняння падало б від кожної правки арту.
 *
 * Зони беруться з реєстру самого застосунку (`window.__hlDebug`, шов у
 * `ZoneAnchors.tsx`), тому назви в очікуваннях тестів — це ті самі назви, що
 * в коді режисера: `hand:<id>`, `party:<id>`, `tavern:0`, `harbor`.
 */
(() => {
  const rec = [];
  /** Вузли, чий політ уже записано: StrictMode проганяє ефект двічі. */
  const seen = new WeakSet();

  const dbg = () => window.__hlDebug;

  /** Центр карти з першого/останнього кадру польоту. */
  const point = (transform, w, h) => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
    return m ? { x: +m[1] + w / 2, y: +m[2] + h / 2 } : null;
  };

  const zoneRects = () => {
    const d = dbg();
    const out = [];
    if (!d) return out;
    d.zones.forEach((_el, key) => {
      const r = d.rect(key);
      if (r) out.push([key, r]);
    });
    return out;
  };

  /**
   * Яка зона під цією точкою.
   *
   * Спершу — найменша з тих, що накривають точку: зони вкладені (рука лежить
   * усередині панелі гравця), і найменша з них і є відповідь. Якщо не накрила
   * жодна — найближча за центром, бо стос гавані вужчий за свою панель, і
   * політ «у центр стосу» цілком може лягти на пів пікселя повз.
   */
  const zoneAt = (p) => {
    if (!p) return null;
    const rects = zoneRects();
    const inside = rects.filter(([, r]) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    if (inside.length) {
      inside.sort((a, b) => a[1].w * a[1].h - b[1].w * b[1].h);
      return inside[0][0];
    }
    let best = null;
    let bd = Infinity;
    for (const [key, r] of rects) {
      const d = Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2));
      if (d < bd) { bd = d; best = key; }
    }
    return best;
  };

  /**
   * Зона, елемент якої анімують на місці.
   *
   * Спершу точний збіг — режисер бере елемент саме із реєстру, тож майже
   * завжди спрацьовує він. Далі — найтісніша з тих, що охоплюють: панель
   * гравця містить і його руку, і плашку лідера, і відповідь «панель» на
   * запитання про плашку була б формально правдива й нікому не потрібна.
   */
  const zoneOfElement = (el) => {
    const d = dbg();
    if (!d) return null;
    let exact = null;
    const wrapping = [];
    d.zones.forEach((zoneEl, key) => {
      if (!zoneEl) return;
      if (zoneEl === el) exact = key;
      else if (zoneEl.contains(el)) wrapping.push([key, zoneEl]);
    });
    if (exact) return exact;
    if (!wrapping.length) return null;
    wrapping.sort((a, b) => a[1].querySelectorAll("*").length - b[1].querySelectorAll("*").length);
    return wrapping[0][0];
  };

  const record = (el, frames) => {
    const d = dbg();
    const layer = d && d.layer();
    const t = Math.round(performance.now());

    if (layer && layer.contains(el)) {
      // Усередині шару анімуються три вузли на політ: сама карта і два боки
      // для перевороту. Політ упізнається по `translate` у першому кадрі.
      if (seen.has(el)) return;
      const first = frames && frames[0] && frames[0].transform;
      if (typeof first !== "string" || first.indexOf("translate(") !== 0) return;
      seen.add(el);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      rec.push({
        kind: "flight",
        t,
        cards: Array.from(el.querySelectorAll("[data-card-id]")).map((c) => c.dataset.cardId),
        from: zoneAt(point(first, w, h)),
        to: zoneAt(point(frames[frames.length - 1].transform, w, h)),
        // Другий бік домальовується лише тоді, коли карта перевертається.
        flip: el.children.length > 1,
      });
      return;
    }

    const zone = zoneOfElement(el);
    if (!zone) return;
    rec.push({ kind: "inplace", t, zone, props: Object.keys(frames && frames[0] ? frames[0] : {}) });
  };

  const original = Element.prototype.animate;
  Element.prototype.animate = function (frames, options) {
    // Спостерігач не має права ламати сторінку: що б тут не сталося,
    // анімація мусить запуститися.
    try { record(this, frames); } catch (e) { /* ignore */ }
    return original.call(this, frames, options);
  };

  const notInLayer = (el) => {
    const d = dbg();
    const layer = d && d.layer();
    return !layer || !layer.contains(el);
  };

  const isHidden = (el) => {
    let e = el;
    while (e && e !== document.body) {
      if (e.style && e.style.visibility === "hidden") return true;
      e = e.parentElement;
    }
    return false;
  };

  /**
   * Знімки столу через рівні проміжки.
   *
   * Потрібні там, де перевіряється не факт руху, а що саме було видно ПОКИ він
   * ішов: карта має з'явитися в руці лише тоді, коли політ її туди доніс.
   * Опитувати з боку Selenium запізно — кожен виклик коштує кілька мілісекунд
   * і половина польоту проходить між двома вимірами.
   */
  let sampler = null;
  const samples = [];

  const startSampling = (everyMs) => {
    samples.length = 0;
    if (sampler) clearInterval(sampler);
    sampler = setInterval(() => {
      samples.push({
        t: Math.round(performance.now()),
        hidden: window.__hlProbe.hiddenCards(),
        cards: window.__hlProbe.tableCards(),
        flights: window.__hlProbe.liveFlights(),
      });
    }, everyMs || 20);
  };

  window.__hlProbe = {
    all: () => rec,
    flights: () => rec.filter((r) => r.kind === "flight"),
    inplace: () => rec.filter((r) => r.kind === "inplace"),
    reset: () => { rec.length = 0; },
    /** Карти на столі (без шару польотів) — id усіх і id прихованих. */
    tableCards: () => Array.from(document.querySelectorAll("[data-card-id]"))
      .filter(notInLayer).map((c) => c.dataset.cardId),
    hiddenCards: () => Array.from(document.querySelectorAll("[data-card-id]"))
      .filter(notInLayer).filter(isHidden).map((c) => c.dataset.cardId),
    liveFlights: () => {
      const d = dbg();
      const layer = d && d.layer();
      return layer ? layer.children.length : -1;
    },
    ready: () => !!dbg(),
    sample: startSampling,
    samples: () => samples,
    stopSampling: () => { if (sampler) clearInterval(sampler); sampler = null; },
  };
})();
