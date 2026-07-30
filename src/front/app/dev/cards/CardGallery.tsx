"use client";

/**
 * Dev-галерея арту карток.
 *
 * Будується ДО того, як з'явилась перша деталь, а не після: розсунуті точки
 * кріплення — домінуючий вид відмови, і в зібраній фігурі вони практично не
 * видно. Лист деталей із перехрестями anchor-ів ловить їх одразу.
 *
 * Поворот і зум у панелі відтворюють реальний конверт трансформацій столу
 * (CARD_FACE_ROTATION × scale() зі сторінки кімнати) — саме там вилазять баги арту.
 */

import { useState } from "react";
import { GameCard } from "@/app/room/[roomId]/Card";
import { CARD_SIZES, type CardSizeToken } from "@/lib/cardSizes";
import { listParts } from "@/lib/cardart/registry";
import { getPalette } from "@/lib/cardart/palette";
import { ANCHORS, ART_VIEWBOX, type Lod } from "@/lib/cardart/types";
import {
  GALLERY_CATALOG,
  GALLERY_FACTIONS,
  GALLERY_HEROES,
  GALLERY_JOKER,
  GALLERY_LEADERS,
} from "@/lib/cardart/__fixtures__/heroNames";

const SIZES = Object.keys(CARD_SIZES) as CardSizeToken[];
const ROTATIONS = [0, 45, 90, 180];
const ZOOMS = [0.65, 1, 1.4];

function Control<T extends string | number>({
  label,
  value,
  options,
  onChange,
  format = String,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <div className="flex rounded border border-[var(--border)] overflow-hidden">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            onClick={() => onChange(o)}
            className={`px-2 py-1 text-xs transition-colors ${
              o === value
                ? "bg-[var(--accent)] text-black font-semibold"
                : "bg-[var(--bg-panel)] text-[var(--text)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardCell({
  card,
  size,
  rotation,
}: {
  card: { cardId: string; name: string; faction: string };
  size: CardSizeToken;
  rotation: number;
}) {
  const spec = CARD_SIZES[size];
  // Місце під повернуту карту: bbox зростає, інакше сусіди перекриються.
  const rad = (rotation * Math.PI) / 180;
  const boxW = Math.abs(spec.w * Math.cos(rad)) + Math.abs(spec.h * Math.sin(rad));
  const boxH = Math.abs(spec.w * Math.sin(rad)) + Math.abs(spec.h * Math.cos(rad));

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: boxW, height: boxH }}
      >
        <div style={{ transform: `rotate(${rotation}deg)` }}>
          <GameCard
            cardId={card.cardId}
            variant="open"
            size={size}
            catalog={GALLERY_CATALOG}
          />
        </div>
      </div>
      <span className="text-[9px] text-[var(--text-muted)] text-center max-w-[120px] leading-tight">
        {card.cardId}
      </span>
    </div>
  );
}

function CardsTab({ size, rotation, zoom }: { size: CardSizeToken; rotation: number; zoom: number }) {
  const byFaction = GALLERY_FACTIONS.map((f) => ({
    faction: f,
    cards: GALLERY_HEROES.filter((h) => h.faction === f),
  }));

  return (
    <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
      <div className="flex gap-6 items-start">
        {byFaction.map(({ faction, cards }) => (
          <div key={faction} className="flex flex-col gap-3">
            <h2 className="font-display text-sm text-[var(--accent)] sticky top-0 bg-[var(--bg)] py-1 z-10">
              {faction} · {cards.length}
            </h2>
            {cards.map((c) => (
              <CardCell key={c.cardId} card={c} size={size} rotation={rotation} />
            ))}
          </div>
        ))}
      </div>

      <h2 className="font-display text-sm text-[var(--accent)] mt-8 mb-3">Лідери та джокер</h2>
      <div className="flex gap-4 flex-wrap">
        {GALLERY_LEADERS.map((l) => (
          <CardCell key={l.cardId} card={l} size={size} rotation={rotation} />
        ))}
        <CardCell card={GALLERY_JOKER} size={size} rotation={rotation} />
      </div>

      <h2 className="font-display text-sm text-[var(--accent)] mt-8 mb-3">Рубашка в усіх розмірах</h2>
      <div className="flex gap-4 items-end flex-wrap">
        {SIZES.map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <GameCard cardId="back" variant="hidden" size={s} />
            <span className="text-[9px] text-[var(--text-muted)]">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Перехрестя точок кріплення й пунктирний габарит — щоб деталі не роз'їхались. */
function AnchorOverlay() {
  return (
    <g pointerEvents="none">
      <rect
        x={0.5}
        y={0.5}
        width={ART_VIEWBOX.w - 1}
        height={ART_VIEWBOX.h - 1}
        fill="none"
        stroke="#ff00aa"
        strokeWidth={0.6}
        strokeDasharray="3 3"
        opacity={0.5}
      />
      {Object.entries(ANCHORS).map(([key, a]) => (
        <g key={key} stroke="#ff00aa" strokeWidth={0.5} opacity={0.85}>
          <line x1={a.x - 3} y1={a.y} x2={a.x + 3} y2={a.y} />
          <line x1={a.x} y1={a.y - 3} x2={a.x} y2={a.y + 3} />
        </g>
      ))}
    </g>
  );
}

function PartsTab({ lod }: { lod: Lod }) {
  const parts = listParts();
  const palette = getPalette("part-sheet", "Highlanders");

  if (parts.length === 0) {
    return (
      <p className="text-[var(--text-muted)] text-sm">
        Жодної деталі ще не зареєстровано. Тут вони з&apos;являться разом із перехрестями
        точок кріплення, щойно потраплять у <code>lib/cardart/parts/</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      {parts.map(({ slot, id, Part }) => (
        <div key={`${slot}.${id}`} className="flex flex-col items-center gap-1">
          <svg
            viewBox={`0 0 ${ART_VIEWBOX.w} ${ART_VIEWBOX.h}`}
            width={100}
            height={140}
            className="border border-[var(--border)] bg-[#cfcabb]"
          >
            <Part p={palette} lod={lod} />
            <AnchorOverlay />
          </svg>
          <span className="text-[10px] text-[var(--text)]">{id}</span>
          <span className="text-[9px] text-[var(--text-muted)]">{slot}</span>
        </div>
      ))}
    </div>
  );
}

export function CardGallery() {
  const [tab, setTab] = useState<"cards" | "parts">("cards");
  const [size, setSize] = useState<CardSizeToken>("small");
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [lod, setLod] = useState<Lod>(2);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  function applyTheme(t: "dark" | "light") {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }

  const partCount = listParts().length;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4">
      <div className="flex flex-wrap gap-4 items-center mb-3 pb-3 border-b border-[var(--border)]">
        <h1 className="font-display text-lg text-[var(--accent)]">Галерея карт</h1>
        <Control label="Вкладка" value={tab} options={["cards", "parts"] as const} onChange={setTab} />
        <Control label="Тема" value={theme} options={["dark", "light"] as const} onChange={applyTheme} />
        {tab === "cards" ? (
          <>
            <Control label="Розмір" value={size} options={SIZES} onChange={setSize} />
            <Control label="Поворот" value={rotation} options={ROTATIONS} onChange={setRotation} format={(v) => `${v}°`} />
            <Control label="Зум" value={zoom} options={ZOOMS} onChange={setZoom} format={(v) => `${v}×`} />
          </>
        ) : (
          <Control label="LOD" value={lod} options={[0, 1, 2] as Lod[]} onChange={setLod} />
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-4">
        {GALLERY_HEROES.length} героїв · {GALLERY_LEADERS.length} лідерів · джокер ·{" "}
        {partCount} деталей у реєстрі
      </p>

      {tab === "cards" ? <CardsTab size={size} rotation={rotation} zoom={zoom} /> : <PartsTab lod={lod} />}
    </main>
  );
}
