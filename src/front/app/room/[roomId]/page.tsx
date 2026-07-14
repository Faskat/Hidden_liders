"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  getState,
  startGame,
  sendCommand,
  joinRoom,
  rejoin,
  addBot,
  leaveRoom,
  leaveRoomBeacon,
  kickPlayer,
  backToLobby,
  ApiError,
} from "@/lib/api";
import type { GameStateView, CommandResponse } from "@/lib/types";
import { useToast } from "@/app/components/Toast";
import RulesModal from "@/components/RulesModal";
import { CardsCatalogProvider } from "@/app/contexts/CardsCatalogContext";
import { PhaseBar } from "./GameBoard";
import { CentralBoard } from "./CentralBoard";
import { PlayerZone } from "./PlayerZone";
import { CurrentVictor } from "./CurrentVictor";
import { GameCard } from "./Card";
import { PHASE_STEPS } from "./constants";
import { getCardById } from "@/lib/cards";
import { abilityNeedsTargetSelection } from "@/lib/abilityTargets";
import type { PlayCardTargets } from "@/lib/types";
import { PlayCardTargetModal } from "./PlayCardTargetModal";
import { RevealPeekModal } from "./RevealPeekModal";

const STORAGE_TOKEN = (roomId: string) => `hl_token_${roomId}`;
const STORAGE_PLAYER = (roomId: string) => `hl_player_${roomId}`;
const POLL_INTERVAL_MS = 4000;

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const isCreator = searchParams.get("creator") === "1";

  const [state, setState] = useState<GameStateView | null>(null);
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const showToast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [sessionLost, setSessionLost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<{ cardId: string; isPlayed: boolean } | null>(null);
  const [selectedForDiscard, setSelectedForDiscard] = useState<string[]>([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [hideGameOverScreen, setHideGameOverScreen] = useState(false);
  const [pendingPlayCardId, setPendingPlayCardId] = useState<string | null>(null);
  const [playCardExtra, setPlayCardExtra] = useState<{
    reveal_harbor?: string[];
    peek_card?: Record<string, unknown>;
  } | null>(null);
  const panStartRef = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 });
  const gameTableWrapperRef = useRef<HTMLDivElement>(null);
  const gameTableContentRef = useRef<HTMLDivElement>(null);
  const [panBounds, setPanBounds] = useState<{ minX: number; maxX: number; minY: number; maxY: number } | null>(null);

  const ZOOM_MIN = 0.65;
  const ZOOM_MAX = 1.4;
  const ZOOM_STEP = 0.12;
  const rejoinAttemptedRef = useRef(false);
  const creatorAutoJoinAttemptedRef = useRef(false);
  const leaveOnUnloadRef = useRef<{ roomId: string; token: string } | null>(null);
  const leaveBeaconSentRef = useRef(false);
  const autoRefillSentRef = useRef(false);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: pan.x, y: pan.y, clientX: e.clientX, clientY: e.clientY };
  }, [pan.x, pan.y]);

  const handlePanMove = useCallback((e: MouseEvent) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    let x = panStartRef.current.x + dx;
    let y = panStartRef.current.y + dy;
    if (panBounds) {
      x = Math.max(panBounds.minX, Math.min(panBounds.maxX, x));
      y = Math.max(panBounds.minY, Math.min(panBounds.maxY, y));
    }
    setPan({ x, y });
  }, [panBounds]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    window.addEventListener("mousemove", handlePanMove);
    window.addEventListener("mouseup", handlePanEnd);
    return () => {
      window.removeEventListener("mousemove", handlePanMove);
      window.removeEventListener("mouseup", handlePanEnd);
    };
  }, [isPanning, handlePanMove, handlePanEnd]);

  const PAN_PADDING_PX = 300;

  // Edge-scrolling: pan when cursor is near viewport edge (mouse must be over game area)
  const edgeScrollRef = useRef({ clientX: 0, clientY: 0, isInside: false });
  const pointerOverPanButtonsRef = useRef(false);
  const EDGE_ZONE_PX = 56;
  const EDGE_PAN_SPEED = 6;

  useEffect(() => {
    if (!panBounds) return;
    let rafId: number;
    const tick = () => {
      if (isPanning || !edgeScrollRef.current.isInside || pointerOverPanButtonsRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const wrapper = gameTableWrapperRef.current;
      if (!wrapper) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const { clientX, clientY } = edgeScrollRef.current;
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      let dx = 0,
        dy = 0;
      if (localX < EDGE_ZONE_PX) dx = EDGE_PAN_SPEED;
      else if (localX > rect.width - EDGE_ZONE_PX) dx = -EDGE_PAN_SPEED;
      if (localY < EDGE_ZONE_PX) dy = EDGE_PAN_SPEED;
      else if (localY > rect.height - EDGE_ZONE_PX) dy = -EDGE_PAN_SPEED;
      if (dx !== 0 || dy !== 0) {
        setPan((prev) => ({
          x: Math.max(panBounds.minX, Math.min(panBounds.maxX, prev.x + dx)),
          y: Math.max(panBounds.minY, Math.min(panBounds.maxY, prev.y + dy)),
        }));
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [panBounds, isPanning]);

  const handleGameAreaMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    edgeScrollRef.current = { clientX: e.clientX, clientY: e.clientY, isInside: true };
  }, []);
  const handleGameAreaMouseLeave = useCallback(() => {
    edgeScrollRef.current.isInside = false;
  }, []);

  useEffect(() => {
    const wrapper = gameTableWrapperRef.current;
    if (!wrapper) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)));
    };
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const wrapper = gameTableWrapperRef.current;
    const content = gameTableContentRef.current;
    if (!wrapper || !content) return;
    const updateBounds = () => {
      const vw = wrapper.clientWidth;
      const vh = wrapper.clientHeight;
      const cw = content.scrollWidth;
      const ch = content.scrollHeight;
      const effectiveCw = cw * zoom;
      const effectiveCh = ch * zoom;
      const pad = PAN_PADDING_PX;
      let minX: number, maxX: number, minY: number, maxY: number;
      if (vw >= effectiveCw) {
        minX = -pad;
        maxX = pad;
      } else {
        minX = vw - effectiveCw - pad;
        maxX = pad;
      }
      if (vh >= effectiveCh) {
        minY = -pad;
        maxY = pad;
      } else {
        minY = vh - effectiveCh - pad;
        maxY = pad;
      }
      setPanBounds({ minX, maxX, minY, maxY });
    };
    updateBounds();
    const ro = new ResizeObserver(updateBounds);
    ro.observe(wrapper);
    ro.observe(content);
    return () => ro.disconnect();
  }, [state, zoom]);

  useEffect(() => {
    if (!panBounds) return;
    setPan((prev) => ({
      x: Math.max(panBounds.minX, Math.min(panBounds.maxX, prev.x)),
      y: Math.max(panBounds.minY, Math.min(panBounds.maxY, prev.y)),
    }));
  }, [panBounds]);

  useEffect(() => {
    if (typeof window === "undefined" || !roomId) return;
    setToken(localStorage.getItem(STORAGE_TOKEN(roomId)));
    setJoinName(localStorage.getItem("hl_username") || "");
  }, [roomId]);

  // Творець кімнати: автоматично приєднатися з збереженим ніком, щоб не вводити повторно.
  // Не викликати joinRoom, якщо в localStorage вже є токен для кімнати (перезавантаження сторінки).
  useEffect(() => {
    if (!roomId || !isCreator || token || creatorAutoJoinAttemptedRef.current) return;
    const storedToken = typeof window !== "undefined" ? localStorage.getItem(STORAGE_TOKEN(roomId)) : null;
    if (storedToken) return; // вже є сесія — не додавати гравця повторно
    const name = (typeof window !== "undefined" ? localStorage.getItem("hl_username") : null) || joinName;
    if (!name?.trim()) return;
    creatorAutoJoinAttemptedRef.current = true;
    setLoading(true);
    joinRoom(roomId, name.trim())
      .then((data) => {
        localStorage.setItem(STORAGE_TOKEN(roomId), data.player_token);
        localStorage.setItem(STORAGE_PLAYER(roomId), data.player_id);
        setToken(data.player_token);
        setState(data.state);
      })
      .catch(() => {
        creatorAutoJoinAttemptedRef.current = false;
      })
      .finally(() => setLoading(false));
  }, [roomId, isCreator, token, joinName]);

  const tryRejoin = useCallback(() => {
    if (!roomId || !token) return;
    if (rejoinAttemptedRef.current) {
      setSessionLost(true);
      return;
    }
    rejoinAttemptedRef.current = true;
    rejoin(roomId, token)
      .then((data: { state: GameStateView; player_token?: string; player_id?: string }) => {
        setState(data.state);
        if (data.player_token) {
          localStorage.setItem(STORAGE_TOKEN(roomId), data.player_token);
          setToken(data.player_token);
        }
        if (data.player_id) {
          localStorage.setItem(STORAGE_PLAYER(roomId), data.player_id);
        }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          setSessionLost(true);
        } else {
          rejoinAttemptedRef.current = false;
          showToast(e instanceof Error ? e.message : "Помилка з'єднання");
        }
      });
  }, [roomId, token, showToast]);

  useEffect(() => {
    if (!roomId || !token) return;
    let cancelled = false;
    getState(roomId, token)
      .then((s) => {
        if (cancelled) return;
        if ("error" in (s as object)) tryRejoin();
        else setState(s as GameStateView);
      })
      .catch(() => {
        if (!cancelled) tryRejoin();
      });
    return () => { cancelled = true; };
  }, [roomId, token, tryRejoin]);

  useEffect(() => {
    if (state && typeof state === "object" && !("error" in state) && !(state as GameStateView).game_ended) {
      setHideGameOverScreen(false);
    }
  }, [state]);

  useEffect(() => {
    if (!roomId || !token || !state || sessionLost) return;
    const interval = setInterval(() => {
      getState(roomId, token)
        .then((next) => {
          if ("error" in (next as object)) tryRejoin();
          else setState(next as GameStateView);
        })
        .catch(() => tryRejoin());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [roomId, token, state, sessionLost, tryRejoin]);

  // При виході зі сторінки (закриття вкладки, «назад», перехід по посиланню) — вийти з кімнати в лобі
  useEffect(() => {
    if (!state || "error" in state) return;
    const s = state as GameStateView;
    if (s.current_phase === "WAITING_FOR_PLAYERS" && token) {
      leaveOnUnloadRef.current = { roomId, token };
    } else {
      leaveOnUnloadRef.current = null;
    }
  }, [roomId, token, state]);

  useEffect(() => {
    const sendLeaveIfNeeded = () => {
      if (leaveBeaconSentRef.current) return;
      const cur = leaveOnUnloadRef.current;
      if (cur) {
        leaveBeaconSentRef.current = true;
        leaveRoomBeacon(cur.roomId, cur.token);
      }
    };
    window.addEventListener("beforeunload", sendLeaveIfNeeded);
    window.addEventListener("pagehide", sendLeaveIfNeeded);
    return () => {
      window.removeEventListener("beforeunload", sendLeaveIfNeeded);
      window.removeEventListener("pagehide", sendLeaveIfNeeded);
      sendLeaveIfNeeded();
    };
  }, []);

  // Вимкнути скрол сторінки під час гри (тільки коли показується ігровий стіл)
  useEffect(() => {
    if (!state || "error" in state) return;
    const s = state as GameStateView;
    const isGameTableView = s.current_phase !== "WAITING_FOR_PLAYERS" && !s.game_ended;
    if (!isGameTableView) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [state]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await joinRoom(roomId, joinName.trim());
      localStorage.setItem(STORAGE_TOKEN(roomId), data.player_token);
      localStorage.setItem(STORAGE_PLAYER(roomId), data.player_id);
      setToken(data.player_token);
      setState(data.state);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося приєднатися");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await startGame(roomId, token);
      setState(data.state);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося почати гру");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBot = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await addBot(roomId, token);
      setState(data.state);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося додати бота");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await leaveRoom(roomId, token);
      localStorage.removeItem(STORAGE_TOKEN(roomId));
      localStorage.removeItem(STORAGE_PLAYER(roomId));
      setToken(null);
      setState(null);
      router.push("/");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося вийти з кімнати");
    } finally {
      setLoading(false);
    }
  };

  const handleKick = async (playerId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await kickPlayer(roomId, token, playerId);
      const next = await getState(roomId, token);
      setState(next as GameStateView);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося вилучити гравця");
    } finally {
      setLoading(false);
    }
  };

  const handleCommand = async (
    command: string,
    payload: Record<string, unknown>
  ) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = (await sendCommand(roomId, token, command, payload)) as CommandResponse;
      setState(data.state);
      if (command === "PlayCard" && (data.reveal_harbor?.length || data.peek_card)) {
        setPlayCardExtra({
          ...(data.reveal_harbor?.length ? { reveal_harbor: data.reveal_harbor } : {}),
          ...(data.peek_card ? { peek_card: data.peek_card as Record<string, unknown> } : {}),
        });
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка дії");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = (cardId: string) => {
    if (!state || typeof state !== "object" || "error" in state) return;
    const s = state as GameStateView;
    const card = s.cards?.[cardId];
    if (abilityNeedsTargetSelection(card, s)) {
      setPendingPlayCardId(cardId);
    } else {
      handleCommand("PlayCard", { card_id: cardId });
    }
  };

  const handlePlayCardWithTargets = (targets: PlayCardTargets) => {
    if (!pendingPlayCardId || !token) return;
    setLoading(true);
    sendCommand(roomId, token, "PlayCard", { card_id: pendingPlayCardId, targets })
      .then((data: CommandResponse) => {
        setState(data.state);
        setPendingPlayCardId(null);
        if (data.reveal_harbor?.length || data.peek_card) {
          setPlayCardExtra({
            ...(data.reveal_harbor?.length ? { reveal_harbor: data.reveal_harbor } : {}),
            ...(data.peek_card ? { peek_card: data.peek_card as Record<string, unknown> } : {}),
          });
        }
      })
      .catch((e) => {
        showToast(e instanceof Error ? e.message : "Помилка дії");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!state || typeof state !== "object" || "error" in state) return;
    if ((state as GameStateView).current_phase !== "DISCARD") setSelectedForDiscard([]);
  }, [state]);

  const handleToggleDiscardCard = useCallback((cardId: string) => {
    setSelectedForDiscard((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      const s = state && typeof state === "object" && !("error" in state) ? (state as GameStateView) : null;
      const myId = roomId ? localStorage.getItem(STORAGE_PLAYER(roomId)) : null;
      const handLen = s?.players?.find((p) => p.player_id === myId)?.hand_card_ids?.length ?? 0;
      const needToDiscard = handLen - 3;
      if (prev.length >= needToDiscard) return prev;
      return [...prev, cardId];
    });
  }, [state, roomId]);

  // Auto-refill tavern when it's the right phase and our turn (no button click needed)
  useEffect(() => {
    if (!state || typeof state !== "object" || "error" in state) return;
    const s = state as GameStateView;
    if (s.current_phase !== "REFILL_TAVERN") {
      autoRefillSentRef.current = false;
      return;
    }
    const myId = roomId ? localStorage.getItem(STORAGE_PLAYER(roomId)) : null;
    if (s.current_player_id !== myId || !token) return;
    if (autoRefillSentRef.current) return;
    autoRefillSentRef.current = true;
    sendCommand(roomId!, token, "RefillTavern", {})
      .then((data) => setState(data.state))
      .catch(() => {
        autoRefillSentRef.current = false;
      });
  }, [state, roomId, token]);

  if (!roomId) return <main className="min-h-screen flex items-center justify-center"><p className="text-[var(--text-muted)]">Невірна кімната</p></main>;

  if (sessionLost) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 py-14">
        <div className="panel rounded-2xl px-6 py-6 max-w-md w-full text-center space-y-4">
          <p className="text-[var(--text-muted)]">Сесія закінчилась. Приєднайтесь до кімнати знову з головної сторінки.</p>
          <button type="button" onClick={() => router.push("/")} className="btn-main py-3 px-6 text-sm rounded-xl">
            На головну
          </button>
        </div>
      </main>
    );
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  if (!token) {
    return (
      <main className="min-h-screen flex flex-col justify-center px-5 sm:px-8 py-14">
        <div className="w-full max-w-lg mx-auto space-y-6">
          <div className="text-center sm:text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--accent)] animate-title-glow">
              Кімната
            </h2>
            <p className="mt-2 text-[var(--text-muted)] text-sm uppercase tracking-wide">
              Введіть ім'я, щоб увійти в лобі
            </p>
          </div>

          <div className="panel rounded-2xl px-6 py-5 border border-[var(--accent)]/20">
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-3">
              Код кімнати
            </p>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <code
                className="text-3xl sm:text-4xl font-mono font-semibold tracking-[0.25em] text-[var(--accent)] select-all tabular-nums"
                title={roomId}
              >
                {roomId}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                className={`py-2.5 px-4 text-sm shrink-0 rounded-xl font-medium min-w-[120px] transition-colors ${copied ? "text-[var(--green)] bg-[var(--green)]/10" : "btn-soft"}`}
              >
                {copied ? "Скопійовано!" : "Копіювати"}
              </button>
            </div>
            <p className="text-[var(--text-muted)] text-xs mt-3">
              Поділіться кодом з друзями
            </p>
          </div>

          <div className="panel rounded-2xl p-5 sm:p-6 space-y-4">
            <form onSubmit={handleJoin} className="space-y-4">
              <label className="block text-sm font-medium text-[var(--text)]/90 mb-1">
                Ваше ім'я
              </label>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Введіть ім'я"
                required
                className="input-minimal rounded-xl"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-main w-full py-3 px-4 text-sm rounded-xl"
              >
                {loading ? "Входимо…" : "Увійти"}
              </button>
            </form>
          </div>
          <button type="button" onClick={() => router.push("/")} className="link-muted text-sm block w-fit hover:underline">
            На головну
          </button>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 sm:px-8 py-14">
        <p className="text-[var(--text-muted)] animate-pulse">Завантаження…</p>
      </main>
    );
  }

  if ("error" in state) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 py-14">
        <div className="panel rounded-2xl px-6 py-6 max-w-md w-full text-center space-y-4">
          <p className="text-[var(--red)] text-sm">Ви не в кімнаті. Поверніться на головну та приєднайтесь знову.</p>
          <button type="button" onClick={() => router.push("/")} className="btn-soft py-2.5 px-4 text-sm rounded-xl w-full sm:w-auto">
            На головну
          </button>
        </div>
      </main>
    );
  }

  const s = state as GameStateView;
  const isWaiting = s.current_phase === "WAITING_FOR_PLAYERS";
  const myPlayerId = localStorage.getItem(STORAGE_PLAYER(roomId));
  const me = s.players.find((p) => p.player_id === myPlayerId);
  const isMyTurn = s.current_player_id === myPlayerId;
  const canStart = isWaiting && s.players.length >= 2;
  const isCreatorNow = Boolean(myPlayerId && s.creator_player_id === myPlayerId);

  if (isWaiting) {
    const STAGGER_MS = 100;
    return (
      <main className="min-h-screen flex flex-col justify-center px-5 sm:px-8 py-14">
        <div className="w-full max-w-lg mx-auto space-y-8">
          <div className="text-center sm:text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--accent)] animate-title-glow">
              Лобі
            </h2>
            <p className="mt-2 text-[var(--text-muted)] text-sm uppercase tracking-wide">
              Кімната чекає гравців
            </p>
          </div>

          <div className="panel rounded-2xl px-6 py-5 border border-[var(--accent)]/20">
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-3">
              Код кімнати
            </p>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <code
                className="text-3xl sm:text-4xl font-mono font-semibold tracking-[0.25em] text-[var(--accent)] select-all tabular-nums"
                title={roomId}
              >
                {roomId}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                className={`py-2.5 px-4 text-sm shrink-0 rounded-xl font-medium min-w-[120px] transition-colors ${copied ? "text-[var(--green)] bg-[var(--green)]/10" : "btn-soft"}`}
              >
                {copied ? "Скопійовано!" : "Копіювати"}
              </button>
            </div>
            <p className="text-[var(--text-muted)] text-xs mt-3">Поділіться кодом з друзями</p>
          </div>

          <div>
            <h3 className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-3">
              Гравці ({s.players.length}{s.num_players ? `/${s.num_players}` : ""})
            </h3>
            <ul className="space-y-3">
              {s.players.map((p, i) => {
                const isCreator = p.player_id === s.creator_player_id;
                return (
                  <li
                    key={p.player_id}
                    className={`panel rounded-xl px-4 py-3.5 flex items-center gap-4 opacity-0 animate-fade-in-up transition-colors ${p.player_id === myPlayerId ? "ring-1 ring-[var(--accent)]/25" : ""} ${isCreator ? "border-l-4 border-l-[var(--accent)]" : ""}`}
                    style={{ animationDelay: `${i * STAGGER_MS}ms`, animationFillMode: "forwards" }}
                  >
                    <span
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-[var(--accent)] font-display text-lg font-semibold shrink-0 bg-[var(--accent-soft)] ${isCreator ? "ring-2 ring-[var(--accent)]/50" : ""}`}
                      aria-hidden
                      title={isCreator ? "Власник кімнати" : undefined}
                    >
                      {p.name.trim().slice(0, 1).toUpperCase() || "?"}
                    </span>
                    <span className="font-medium text-[var(--text)] flex-1 truncate">{p.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {isCreator && (
                        <span className="bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-medium px-2.5 py-1 rounded-md border border-[var(--accent)]/30">
                          Власник
                        </span>
                      )}
                      {p.player_id === myPlayerId && (
                        <span className="bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-medium px-2.5 py-1 rounded-md">
                          Ви
                        </span>
                      )}
                      {isCreatorNow && p.player_id !== myPlayerId && (
                        <button
                          type="button"
                          onClick={() => handleKick(p.player_id)}
                          disabled={loading}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--red)] border border-[var(--border)] hover:border-[var(--red)]/50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          title="Вилучити з лобі"
                        >
                          Вилучити
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {canStart && isCreatorNow && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="btn-main w-full py-3.5 px-5 text-base font-semibold rounded-xl"
            >
              {loading ? "Починаємо…" : "Почати гру"}
            </button>
          )}
          {!canStart && s.players.length < 2 && (
            <div className="panel rounded-xl px-4 py-3 text-center space-y-3">
              <p className="text-[var(--text-muted)] text-sm">Чекаємо ще гравців…</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">Потрібно мінімум 2 гравці</p>
              <button
                type="button"
                onClick={handleAddBot}
                disabled={loading}
                className="btn-soft py-2.5 px-4 text-sm rounded-xl"
              >
                {loading ? "…" : "Додати бота (тест)"}
              </button>
            </div>
          )}
          {canStart && isCreatorNow && (
            <button
              type="button"
              onClick={handleAddBot}
              disabled={loading}
              className="btn-soft w-full py-2.5 px-4 text-sm rounded-xl"
            >
              {loading ? "…" : "Додати бота (тест)"}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setRulesOpen(true)} className="link-muted text-sm hover:underline">
              Як грати
            </button>
            <button
              type="button"
              onClick={handleLeave}
              disabled={loading}
              className="link-muted text-sm hover:underline"
            >
              Вийти з кімнати
            </button>
            <button
              type="button"
              onClick={() => handleLeave()}
              disabled={loading}
              className="link-muted text-sm hover:underline"
            >
              На головну
            </button>
          </div>
        </div>
        <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
      </main>
    );
  }

  if (s.game_ended && !hideGameOverScreen) {
    const winnerPlayer = s.winner_player_id
      ? s.players.find((p) => p.player_id === s.winner_player_id)
      : null;
    return (
      <main className="min-h-screen flex flex-col justify-center px-5 sm:px-8 py-14">
        <div className="w-full max-w-lg mx-auto space-y-8">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--accent)] animate-title-glow text-center">
            Кінець гри
          </h2>
          <div className="panel rounded-2xl px-6 py-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">
                Переможець
              </p>
              <p className="text-[var(--text)] font-medium text-xl">
                {s.winner_faction ?? "—"}
              </p>
              {winnerPlayer && (
                <p className="text-[var(--accent)] font-display text-lg">
                  {winnerPlayer.name}
                </p>
              )}
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-[var(--text-muted)] text-sm text-center">
                Фінальні маркери: <span className="text-[var(--red)] font-medium">{s.red_marker}</span>
                {" · "}
                <span className="text-[var(--green)] font-medium">{s.green_marker}</span>
              </p>
            </div>
            {s.players.length > 0 && (
              <ul className="space-y-2 pt-2">
                {s.players.map((p) => (
                  <li
                    key={p.player_id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${p.player_id === s.winner_player_id ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium" : "bg-[var(--bg-hover)]/50 text-[var(--text-muted)]"}`}
                  >
                    <span>{p.name}</span>
                    {p.player_id === s.winner_player_id && <span className="text-xs">Переможець</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setHideGameOverScreen(true)}
              className="btn-soft flex-1 py-3.5 px-5 text-sm rounded-xl font-semibold"
            >
              Повернутися в кімнату
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn-main flex-1 py-3.5 px-5 text-sm rounded-xl font-semibold"
            >
              На головну
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (s.game_ended && hideGameOverScreen) {
    const handleBackToLobby = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await backToLobby(roomId, token);
        setState(data.state);
        setHideGameOverScreen(false);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Не вдалося повернутися в лобі");
      } finally {
        setLoading(false);
      }
    };
    return (
      <main className="min-h-screen flex flex-col justify-center px-5 sm:px-8 py-14">
        <div className="w-full max-w-lg mx-auto space-y-8">
          <div className="text-center sm:text-left">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--accent)] animate-title-glow">
              Кімната
            </h2>
            <p className="mt-2 text-[var(--text-muted)] text-sm uppercase tracking-wide">
              Гра завершена. Можна почати нову.
            </p>
          </div>
          <div className="panel rounded-2xl px-6 py-5 border border-[var(--accent)]/20">
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-3">
              Код кімнати
            </p>
            <code
              className="text-2xl font-mono font-semibold tracking-[0.2em] text-[var(--accent)] block"
              title={roomId}
            >
              {roomId}
            </code>
          </div>
          <div>
            <h3 className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-3">
              Гравці ({s.players.length})
            </h3>
            <ul className="space-y-2">
              {s.players.map((p) => (
                <li
                  key={p.player_id}
                  className="panel rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--accent)] font-display font-semibold shrink-0 bg-[var(--accent-soft)]">
                    {p.name.trim().slice(0, 1).toUpperCase() || "?"}
                  </span>
                  <span className="font-medium text-[var(--text)] truncate">{p.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleBackToLobby}
              disabled={loading}
              className="btn-main flex-1 py-3.5 px-5 text-base font-semibold rounded-xl"
            >
              {loading ? "Повертаємо…" : "Почати гру ще раз"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn-soft flex-1 py-3.5 px-5 text-base font-semibold rounded-xl"
            >
              На головну
            </button>
          </div>
        </div>
      </main>
    );
  }

  const hand = me?.hand_card_ids || [];
  const phase = s.current_phase;
  const n = s.players.length;

  // Round table: order players so current user is always at index 0 (bottom)
  const meIndex = s.players.findIndex((p) => p.player_id === myPlayerId);
  const viewPlayers =
    meIndex < 0
      ? s.players
      : [...s.players.slice(meIndex), ...s.players.slice(0, meIndex)];

  // Зіграні карти: всі відкриті та приховані герої у партіях гравців
  const playedCardsCount = s.players.reduce((sum, p) => {
    const open = p.open_heroes.filter((h) => typeof h === "object" && h !== null && "card_id" in h).length;
    const hiddenFirst = Array.isArray(p.hidden_heroes) ? p.hidden_heroes[0] : null;
    const hidden =
      hiddenFirst && typeof hiddenFirst === "object" && "count" in hiddenFirst
        ? (hiddenFirst as { count: number }).count
        : (p.hidden_heroes?.length ?? 0);
    return sum + open + hidden;
  }, 0);

  const cardPreview = hoveredCard ? getCardById(hoveredCard.cardId, s.cards) : null;
  const showInfluence = hoveredCard && !hoveredCard.isPlayed && cardPreview && !cardPreview.hasMarkersOnly;
  const previewRed =
    showInfluence && cardPreview && cardPreview.red_delta != null
      ? Math.min(12, Math.max(1, s.red_marker + (cardPreview.red_delta ?? 0)))
      : null;
  const previewGreen =
    showInfluence && cardPreview && cardPreview.green_delta != null
      ? Math.min(12, Math.max(1, s.green_marker + (cardPreview.green_delta ?? 0)))
      : null;

  return (
    <main className="h-dvh max-h-dvh flex flex-col overflow-hidden px-2 sm:px-4 py-2">
      <CardsCatalogProvider catalog={s.cards}>
      <div className="w-full flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Header: PhaseBar + links + compact Win conditions & Turn steps */}
        <header className="shrink-0 space-y-1 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1.5">
            <PhaseBar state={s} myPlayerId={myPlayerId} />
            <CurrentVictor redMarker={s.red_marker} greenMarker={s.green_marker} compact playedCount={playedCardsCount} />
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative z-[9999] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCommand("EndGame", {})}
                  disabled={loading}
                  className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--red)] border border-[var(--text-muted)]/30 hover:border-[var(--red)]/50 px-2 py-1 rounded transition-colors"
                  title="Тільки для тесту: завершити гру одразу"
                >
                  Завершити гру
                </button>
                <button type="button" onClick={() => setRulesOpen(true)} className="cursor-pointer link-muted text-sm hover:underline">
                  Як грати
                </button>
                <button type="button" onClick={() => router.push("/")} className="cursor-pointer link-muted text-sm hover:underline">
                  На головну
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Centered big card preview when hovering over another player's card */}
        {hoveredCard && cardPreview && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <div className="bg-black/50 rounded-2xl p-4 shadow-2xl pointer-events-none">
              <GameCard
                cardId={hoveredCard.cardId}
                variant="open"
                name={cardPreview.name}
                faction={cardPreview.faction}
                red_delta={hoveredCard.isPlayed ? undefined : cardPreview.red_delta}
                green_delta={hoveredCard.isPlayed ? undefined : cardPreview.green_delta}
                size="xlarge"
                catalog={s.cards}
              />
            </div>
          </div>
        )}

        {/* Game area: pannable viewport (drag to pan), bounded, no page scroll */}
        <div
          ref={gameTableWrapperRef}
          className="game-table-wrapper flex-1 min-h-0 min-w-0 overflow-hidden cursor-grab active:cursor-grabbing relative rounded-xl"
          onMouseDown={handlePanStart}
          onMouseMove={handleGameAreaMouseMove}
          onMouseLeave={handleGameAreaMouseLeave}
          style={{ touchAction: "none" }}
        >
          {/* Pan to edge: show only when can still move in that direction */}
          {panBounds && (
            <div
              className="absolute bottom-3 right-3 z-30 flex flex-col items-center gap-0.5 pointer-events-auto"
              onMouseEnter={() => { pointerOverPanButtonsRef.current = true; }}
              onMouseLeave={() => { pointerOverPanButtonsRef.current = false; }}
            >
              {pan.y < panBounds.maxY - 4 && (
                <button
                  type="button"
                  onClick={() => setPan((p) => ({ ...p, y: panBounds!.maxY }))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-panel)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border)] shadow text-[var(--text)] transition-colors cursor-pointer"
                  title="Прогорнути вгору"
                  aria-label="Прогорнути вгору"
                >
                  <span className="text-sm font-bold">↑</span>
                </button>
              )}
              <div className="flex items-center gap-0.5">
                {pan.x < panBounds.maxX - 4 && (
                  <button
                    type="button"
                    onClick={() => setPan((p) => ({ ...p, x: panBounds!.maxX }))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-panel)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border)] shadow text-[var(--text)] transition-colors cursor-pointer"
                    title="Прогорнути вліво"
                    aria-label="Прогорнути вліво"
                  >
                    <span className="text-sm font-bold">←</span>
                  </button>
                )}
                {pan.x > panBounds.minX + 4 && (
                  <button
                    type="button"
                    onClick={() => setPan((p) => ({ ...p, x: panBounds!.minX }))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-panel)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border)] shadow text-[var(--text)] transition-colors cursor-pointer"
                    title="Прогорнути вправо"
                    aria-label="Прогорнути вправо"
                  >
                    <span className="text-sm font-bold">→</span>
                  </button>
                )}
              </div>
              {pan.y > panBounds.minY + 4 && (
                <button
                  type="button"
                  onClick={() => setPan((p) => ({ ...p, y: panBounds!.minY }))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-panel)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border)] shadow text-[var(--text)] transition-colors cursor-pointer"
                  title="Прогорнути вниз"
                  aria-label="Прогорнути вниз"
                >
                  <span className="text-sm font-bold">↓</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setPan({
                    x: (panBounds.minX + panBounds.maxX) / 2,
                    y: (panBounds.minY + panBounds.maxY) / 2,
                  })
                }
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-panel)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border)] shadow text-[var(--text)] transition-colors cursor-pointer mt-1"
                title="Центрувати поле"
                aria-label="Центрувати поле"
              >
                <span className="text-sm font-bold" aria-hidden>⊙</span>
              </button>
              <div className="flex items-center gap-0.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                  disabled={zoom <= ZOOM_MIN}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-panel)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border)] shadow text-[var(--text)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Віддалити (або Ctrl+колесо)"
                  aria-label="Віддалити"
                >
                  <span className="text-sm font-bold">−</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                  disabled={zoom >= ZOOM_MAX}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-panel)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border)] shadow text-[var(--text)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Приблизити (або Ctrl+колесо)"
                  aria-label="Приблизити"
                >
                  <span className="text-sm font-bold">+</span>
                </button>
              </div>
            </div>
          )}
          <div
            ref={gameTableContentRef}
            className="game-table grid gap-2 min-h-full min-w-full w-max max-w-none h-max max-h-none origin-top-left"
            style={{
              gridTemplateColumns: "1fr minmax(340px, 2fr) 1fr",
              gridTemplateRows: "auto minmax(520px, 1fr) auto",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isPanning ? "none" : "transform 0.15s ease-out",
            }}
          >
          {/* Row 1: three cells — topLeft (col 1), top (col 2), topRight (col 3) */}
          {/* topLeft: n=5 → viewPlayers[2], n=6 → viewPlayers[2] */}
          {n >= 5 && viewPlayers[2] && (
            <div className="zone-top-left flex justify-center items-end" style={{ gridColumn: 1, gridRow: 1 }}>
              <PlayerZone
                player={viewPlayers[2]}
                position="topLeft"
                isMe={false}
                isMyTurn={isMyTurn}
                phase={phase}
                loading={loading}
                onPlayCard={handlePlayCard}
                gameEnded={s.game_ended}
                totalPlayers={n}
                winnerPlayerId={s.winner_player_id}
                onHoverCard={setHoveredCard}
              />
            </div>
          )}
          {/* top (center): n===2 → viewPlayers[1]; n===4 → viewPlayers[2]; n===6 → viewPlayers[3] */}
          {(n === 2 || n === 4 || n === 6) && viewPlayers[n === 2 ? 1 : n === 4 ? 2 : 3] && (
            <div className="zone-top flex justify-center" style={{ gridColumn: 2, gridRow: 1 }}>
              <PlayerZone
                player={viewPlayers[n === 2 ? 1 : n === 4 ? 2 : 3]!}
                position="top"
                isMe={false}
                isMyTurn={isMyTurn}
                phase={phase}
                loading={loading}
                onPlayCard={handlePlayCard}
                gameEnded={s.game_ended}
                totalPlayers={n}
                winnerPlayerId={s.winner_player_id}
                onHoverCard={setHoveredCard}
              />
            </div>
          )}
          {/* topRight: n=5 → viewPlayers[3], n=6 → viewPlayers[4] */}
          {n >= 5 && viewPlayers[n === 5 ? 3 : 4] && (
            <div className="zone-top-right flex justify-center items-end" style={{ gridColumn: 3, gridRow: 1 }}>
              <PlayerZone
                player={viewPlayers[n === 5 ? 3 : 4]!}
                position="topRight"
                isMe={false}
                isMyTurn={isMyTurn}
                phase={phase}
                loading={loading}
                onPlayCard={handlePlayCard}
                gameEnded={s.game_ended}
                totalPlayers={n}
                winnerPlayerId={s.winner_player_id}
                onHoverCard={setHoveredCard}
              />
            </div>
          )}
          {/* Left: n>=3 → viewPlayers[1] */}
          {n >= 3 && viewPlayers[1] && (
            <div className="zone-left flex justify-center items-center" style={{ gridColumn: 1, gridRow: 2 }}>
              <PlayerZone
                player={viewPlayers[1]}
                position="left"
                isMe={false}
                isMyTurn={isMyTurn}
                phase={phase}
                loading={loading}
                onPlayCard={handlePlayCard}
                gameEnded={s.game_ended}
                totalPlayers={n}
                winnerPlayerId={s.winner_player_id}
                onHoverCard={setHoveredCard}
              />
            </div>
          )}
          <div className="zone-board flex flex-row w-full min-w-0 items-stretch" style={{ gridColumn: 2, gridRow: 2 }}>
            <CentralBoard
              state={s}
              isMyTurn={isMyTurn}
              phase={phase}
              loading={loading}
              onDrawFromTavern={(i) => handleCommand("DrawFromTavern", { slot_index: i })}
              onDrawFromHarbor={() => handleCommand("DrawFromHarbor", {})}
              previewRed={previewRed}
              previewGreen={previewGreen}
              onHoverCard={setHoveredCard}
            />
          </div>
          {/* Right: n>=3 → viewPlayers[2] for 3p, viewPlayers[3] for 4p, viewPlayers[4] for 5p, viewPlayers[5] for 6p */}
          {n >= 3 && viewPlayers[n === 3 ? 2 : n - 1] && (
            <div className="zone-right flex justify-center items-center" style={{ gridColumn: 3, gridRow: 2 }}>
              <PlayerZone
                player={viewPlayers[n === 3 ? 2 : n - 1]!}
                position="right"
                isMe={false}
                isMyTurn={isMyTurn}
                phase={phase}
                loading={loading}
                onPlayCard={handlePlayCard}
                gameEnded={s.game_ended}
                totalPlayers={n}
                winnerPlayerId={s.winner_player_id}
                onHoverCard={setHoveredCard}
              />
            </div>
          )}
          {/* Bottom (me): always viewPlayers[0] — closer to power track */}
          {viewPlayers[0] && (
            <div className="zone-bottom flex justify-center items-end pb-0 -mt-12" style={{ gridColumn: 2, gridRow: 3 }}>
              <PlayerZone
                player={me ?? viewPlayers[0]}
                position="bottom"
                isMe={viewPlayers[0].player_id === myPlayerId}
                isMyTurn={isMyTurn}
                phase={phase}
                loading={loading}
                onPlayCard={handlePlayCard}
                gameEnded={s.game_ended}
                totalPlayers={n}
                winnerPlayerId={s.winner_player_id}
                onHoverCard={setHoveredCard}
                discardMode={phase === "DISCARD" && isMyTurn && hand.length > 3}
                selectedForDiscard={selectedForDiscard}
                onToggleDiscardCard={handleToggleDiscardCard}
              />
            </div>
          )}
          </div>
        </div>

        {/* Footer: phase hint + action buttons — compact, no separate strip */}
        <footer className="shrink-0 flex flex-col items-center justify-center gap-1 py-1.5">
          {isMyTurn && (() => {
            const step = PHASE_STEPS.find((st) => st.key === phase);
            return step ? (
              <p className="text-sm text-[var(--text-muted)] text-center w-full min-h-[1.25rem]">
                {step.description}
              </p>
            ) : (
              <p className="min-h-[1.25rem]" aria-hidden />
            );
          })()}
          <div className="flex flex-wrap gap-2 justify-center">
          {phase === "PLAY" && isMyTurn && (
            <button
              onClick={() => handleCommand("PassPlay", {})}
              disabled={loading}
              className="btn-soft min-w-[140px] py-2 px-3 text-sm"
              title="Не грати карту й перейти до добирання та скиду"
            >
              Пропустити хід
            </button>
          )}
          {phase === "DRAW" && isMyTurn && (
            <>
              <button
                onClick={() => handleCommand("DrawFromHarbor", {})}
                disabled={loading}
                className="btn-main min-w-[120px] py-2 px-3 text-sm"
              >
                Брати з гавані
              </button>
              {s.tavern.map((slot, i) =>
                slot ? (
                  <button
                    key={i}
                    onClick={() => handleCommand("DrawFromTavern", { slot_index: i })}
                    disabled={loading}
                    className="btn-soft min-w-[100px] py-2 px-3 text-sm"
                  >
                    Таверна {i + 1}
                  </button>
                ) : null
              )}
            </>
          )}
          {phase === "DISCARD" && isMyTurn && hand.length > 3 && (
            <>
              <p className="text-[var(--accent)] text-sm w-full text-center">
                Оберіть {hand.length - 3} карт(и) для скидання (залишиться 3 у руці).
              </p>
              <button
                onClick={() => handleCommand("DiscardCards", { card_ids: selectedForDiscard })}
                disabled={loading || selectedForDiscard.length !== hand.length - 3}
                className="btn-soft py-3 px-4 text-sm disabled:opacity-50"
              >
                Скинути вибрані ({selectedForDiscard.length}/{hand.length - 3})
              </button>
            </>
          )}
          {phase === "REFILL_TAVERN" && isMyTurn && (
            <p className="text-[var(--text-muted)] text-sm">Поповнення таверни…</p>
          )}
          </div>
        </footer>
      </div>
        {pendingPlayCardId && s.cards?.[pendingPlayCardId] && (
          <PlayCardTargetModal
            cardId={pendingPlayCardId}
            card={s.cards[pendingPlayCardId]!}
            state={s}
            myPlayerId={myPlayerId}
            onConfirm={handlePlayCardWithTargets}
            onCancel={() => setPendingPlayCardId(null)}
          />
        )}
      </CardsCatalogProvider>
      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
      {s && playCardExtra && (
        <RevealPeekModal
          revealHarborCardIds={playCardExtra.reveal_harbor ?? null}
          peekCard={playCardExtra.peek_card ?? null}
          state={s}
          onClose={() => setPlayCardExtra(null)}
        />
      )}
    </main>
  );
}
