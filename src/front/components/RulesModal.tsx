"use client";

import { useEffect, useRef, useState } from "react";

const RULES_SECTIONS = [
  {
    id: "goal",
    title: "Мета",
    content:
      "Перемогти, маючи найбільший вплив на момент закінчення гри. Гра закінчується, коли в будь-якого гравця 7 героїв лицьовою стороною вгору (у грі на 4 гравці).",
  },
  {
    id: "setup",
    title: "Підготовка",
    items: [
      "2–6 гравців. Кожен отримує таємного Лідера (дві фракції).",
      "72 карти героїв: гавань (колода), таверна (3 відкриті), дикі землі (сметка).",
      "Червоні та зелені маркери починають з 1; рух по полю 1–12.",
    ],
  },
  {
    id: "turn-order",
    title: "Хід гравця",
    numbered: true,
    items: [
      "ГРАТИ — Викласти одну карту героя (лицем догори) або скинути до 3. Маркери (червоний/зелений) рухаються за ефектом карти.",
      "БРАТИ — Добрати до 4 карт (з гавані або таверни). Якщо гавань порожня, дикі землі перемішують у гавань.",
      "СКИНУТИ — Скинути до 3 карт у руці.",
      "ПОПОВНИТИ ТАВЕРНУ — Заповнити порожні місця в таверні з гавані. Далі хід наступного гравця.",
    ],
  },
  {
    id: "winning-faction",
    title: "Переможна фракція (на кінець гри)",
    intro: "За фінальним положенням маркерів:",
    items: [
      "Нежить — Обидва маркери в 9–12 (темна війна).",
      "Водний народ — Маркери сусідні або однакові (≤1 крок).",
      "Імперійці — Червоний ≥ Зелений + 2.",
      "Гірці — Зелений ≥ Червоний + 2.",
    ],
  },
  {
    id: "winner",
    title: "Переможець",
    content:
      "Серед гравців, чий лідер у переможній фракції: виграє той, у кого більше героїв цієї фракції. При нічиїй: менше всього героїв, потім більший номер лідера.",
  },
] as const;

function formatRuleItem(item: string) {
  const sep = " — ";
  const i = item.indexOf(sep);
  if (i === -1) return { term: null, rest: item };
  return {
    term: item.slice(0, i).trim(),
    rest: item.slice(i + sep.length).trim(),
  };
}

export default function RulesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = RULES_SECTIONS.length;

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentPage > 0) scrollToPage(currentPage - 1);
      if (e.key === "ArrowRight" && currentPage < totalPages - 1) scrollToPage(currentPage + 1);
    };
    document.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, currentPage, totalPages]);

  const scrollToPage = (index: number) => {
    const el = pagesRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    el.scrollTo({ left: w * index, behavior: "smooth" });
    setCurrentPage(index);
  };

  const goPrev = () => {
    if (currentPage > 0) scrollToPage(currentPage - 1);
  };

  const goNext = () => {
    if (currentPage < totalPages - 1) scrollToPage(currentPage + 1);
  };

  useEffect(() => {
    const el = pagesRef.current;
    if (!el || !isOpen) return;
    const onScroll = () => {
      const w = el.offsetWidth;
      const index = Math.round(el.scrollLeft / w);
      if (index >= 0 && index < totalPages) setCurrentPage(index);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isOpen, totalPages]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-lg max-h-[90vh] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden animate-rules-window-in"
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.45)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3.5 bg-[var(--bg)]">
          <h2 className="font-display text-lg font-semibold text-[var(--accent)]">
            Правила
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
            aria-label="Закрити"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Horizontal pages */}
        <div
          ref={pagesRef}
          className="rules-pages flex-1 min-h-0"
        >
          {RULES_SECTIONS.map((section, index) => (
            <div key={section.id} className="rules-page flex flex-col">
              <div className="flex-1 overflow-y-auto rules-scroll px-5 py-6 flex flex-col justify-center min-h-[50vh]">
                <div
                  className={`rules-section-card max-w-xl mx-auto ${
                    currentPage === index ? "opacity-0 animate-rule-page-in" : "opacity-100"
                  }`}
                >
                  <h3 className="font-display text-base font-semibold uppercase tracking-wider text-[var(--accent)] mb-4">
                    {section.title}
                  </h3>
                  <div className="rules-body space-y-3">
                    {"content" in section && section.content && (
                      <p className="text-[var(--text)]/95">{section.content}</p>
                    )}
                    {"intro" in section && section.intro && (
                      <p className="text-[var(--text)]/90">{section.intro}</p>
                    )}
                    {"items" in section &&
                      section.items?.map((item, i) => {
                        const { term, rest } = formatRuleItem(item);
                        const delay = 80 + i * 60;
                        const isActive = currentPage === index;
                        return (
                          <div
                            key={i}
                            className={`flex gap-3 ${isActive ? "opacity-0 animate-rule-item-in" : ""}`}
                            style={
                              isActive
                                ? { animationDelay: `${delay}ms`, animationFillMode: "forwards" }
                                : undefined
                            }
                          >
                            {"numbered" in section && section.numbered ? (
                              <span className="text-[var(--accent)] shrink-0 font-semibold tabular-nums w-6">
                                {i + 1}.
                              </span>
                            ) : (
                              <span className="text-[var(--accent)]/70 shrink-0">•</span>
                            )}
                            <span>
                              {term ? (
                                <>
                                  <span className="rules-term">{term}</span>
                                  {" — "}
                                  {rest}
                                </>
                              ) : (
                                item
                              )}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: dots + prev/next */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--border)] px-5 py-3.5 bg-[var(--bg)]">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            ← Назад
          </button>
          <div className="flex gap-1.5">
            {RULES_SECTIONS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToPage(i)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === currentPage
                    ? "w-6 bg-[var(--accent)]"
                    : "w-2 bg-[var(--border)] hover:bg-[var(--text-muted)]"
                }`}
                aria-label={`Сторінка ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage === totalPages - 1}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Далі →
          </button>
        </div>
      </div>
    </div>
  );
}
