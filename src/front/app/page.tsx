"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom } from "@/lib/api";
import RulesModal from "@/components/RulesModal";
import { useToast } from "@/app/components/Toast";


const USERNAME_KEY = "hl_username";

const STAGGER = { hero: 0, form: 120, rules: 220 };

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [username, setUsername] = useState("");
  const [numPlayers, setNumPlayers] = useState(2);
  const [roomId, setRoomId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsername(localStorage.getItem(USERNAME_KEY) || "");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && username.trim()) {
      localStorage.setItem(USERNAME_KEY, username.trim());
    }
  }, [username]);

  useEffect(() => {
    setJoinName(username);
  }, [username, mode]);

  async function handleCreate() {
    if (!username.trim()) {
      showToast("Спочатку введіть ім'я");
      return;
    }
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(USERNAME_KEY, username.trim());
      }
      const { room_id } = await createRoom(numPlayers, "full");
      router.push(`/room/${room_id}?creator=1`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося створити кімнату");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    const nameToUse = joinName.trim() || username.trim();
    if (!roomId.trim() || !nameToUse) {
      showToast("Введіть код кімнати та своє ім'я");
      return;
    }
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(USERNAME_KEY, nameToUse);
      }
      const data = await joinRoom(roomId.trim(), nameToUse);
      if (typeof window !== "undefined") {
        localStorage.setItem(`hl_token_${data.room_id}`, data.player_token);
        localStorage.setItem(`hl_player_${data.room_id}`, data.player_id);
        localStorage.setItem(`hl_name_${data.room_id}`, nameToUse);
      }
      router.push(`/room/${data.room_id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося приєднатися до кімнати");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 min-h-screen flex flex-col md:flex-row md:items-center md:justify-center gap-12 px-5 sm:px-8 py-14 md:py-20">
      {/* On large screens: centered container so content isn't pushed to edges */}
      <div className="w-full max-w-sm md:max-w-none md:w-full md:max-w-4xl lg:max-w-5xl md:grid md:grid-cols-[1fr_1fr] md:items-center md:gap-14 lg:gap-20">
        {/* Left: brand + context (desktop) / top (mobile) */}
        <header
          className="min-w-0 opacity-0 animate-fade-in-up"
          style={{ animationDelay: `${STAGGER.hero}ms`, animationFillMode: "forwards" }}
        >
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-[var(--text)]">
            Таємні{" "}
            <span className="text-[var(--accent)] animate-title-glow">Лідери</span>
          </h1>
          <p className="mt-3 sm:mt-4 text-[var(--text)]/70 text-sm sm:text-base tracking-wide uppercase max-w-md">
            Стратегія · Таємні фракції · Один переможець
          </p>
          <button
            onClick={() => setRulesOpen(true)}
            className="mt-6 link-muted text-sm sm:text-base opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${STAGGER.rules}ms`, animationFillMode: "forwards" }}
          >
            Як грати
          </button>
        </header>

        {/* Right: form — equal column on large screens, full width of column */}
        <section
          className="w-full min-w-0 md:pl-10 lg:pl-14 md:border-l border-[var(--border)] opacity-0 animate-fade-in-up"
          style={{ animationDelay: `${STAGGER.form}ms`, animationFillMode: "forwards" }}
        >
          <div className="space-y-5 max-w-sm md:max-w-none">
          <div>
            <label className="block text-sm font-medium text-[var(--text)]/80 mb-2">
              Ваше ім'я
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введіть ім'я"
              className="input-minimal py-3 text-base w-full"
              maxLength={32}
            />
          </div>

          {mode === "choose" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("create")}
                className="rounded-xl border border-[var(--border)] bg-transparent py-3.5 px-4 text-left transition-all duration-200 hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]"
              >
                <span className="font-display text-sm font-medium text-[var(--text)]">Створити</span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Нова кімната</p>
              </button>
              <button
                onClick={() => setMode("join")}
                className="rounded-xl border border-[var(--border)] bg-transparent py-3.5 px-4 text-left transition-all duration-200 hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]"
              >
                <span className="font-display text-sm font-medium text-[var(--text)]">Приєднатися</span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">За кодом</p>
              </button>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-4 opacity-0 animate-slide-in" style={{ animationFillMode: "forwards" }}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-[var(--text)]/80">
                    Гравці
                  </label>
                  <span className="font-display text-xl font-semibold text-[var(--accent)] tabular-nums">
                    {numPlayers}
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={numPlayers}
                  onChange={(e) => setNumPlayers(Number(e.target.value))}
                  className="slider-gold"
                  style={{ "--slider-fill": `${((numPlayers - 2) / 4) * 100}%` } as React.CSSProperties}
                  aria-label="Кількість гравців"
                />
                <div className="flex justify-between mt-1.5 px-0.5">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <span
                      key={n}
                      className={`text-xs tabular-nums transition-colors ${n === numPlayers ? "text-[var(--accent)] font-semibold" : "text-[var(--text-muted)]"}`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="btn-main flex-1 py-3 px-4 text-sm"
                >
                  {loading ? "…" : "Створити кімнату"}
                </button>
                <button
                  onClick={() => setMode("choose")}
                  className="btn-soft py-3 px-4 text-sm"
                >
                  Назад
                </button>
              </div>
            </div>
          )}

      

          {mode === "join" && (
            <div className="space-y-4 opacity-0 animate-slide-in" style={{ animationFillMode: "forwards" }}>
              <div>
                <label className="block text-sm font-medium text-[var(--text)]/80 mb-2">
                  Код кімнати
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    // Прибираємо невалідні символи і з DOM: інакше React не перезапише
                    // значення, коли state не змінився, і сміття лишиться в полі.
                    e.target.value = digits;
                    setRoomId(digits);
                  }}
                  placeholder="4 цифри"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  autoComplete="off"
                  className="input-minimal py-3 text-base w-full"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleJoin}
                  disabled={loading}
                  className="btn-main flex-1 py-3 px-4 text-sm"
                >
                  {loading ? "…" : "Увійти"}
                </button>
                <button
                  onClick={() => setMode("choose")}
                  className="btn-soft py-3 px-4 text-sm"
                >
                  Назад
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      </div>

      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />

      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 text-2xl text-[var(--text-muted)]">
        By Skripnik Oleksiy
      </footer>
    </main>
  );
}
