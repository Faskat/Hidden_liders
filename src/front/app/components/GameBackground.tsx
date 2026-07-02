"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

const IMG = {
  main: "/images/dead king01.avif",
  conflict: "/images/conflict.avif",
  sixLeaders: "/images/six_leaders_hidden_leaders_2.avif",
} as const;

const ORB_COUNT = 4;
const ORB_UPDATE_MS = 7000;
const ORB_CYCLE_SEC = 7;
const ORB_PEAK_OPACITY = 0.13;

function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  (e.target as HTMLImageElement).style.display = "none";
}

function randomPercent(min = 15, max = 85) {
  return min + Math.random() * (max - min);
}

export default function GameBackground() {
  const pathname = usePathname();
  const isRoomPage = pathname?.startsWith("/room/") ?? false;
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const [mounted, setMounted] = useState(false);
  const [orbs, setOrbs] = useState<Array<{ id: number; x: number; y: number }>>(() =>
    Array.from({ length: ORB_COUNT }, (_, i) => ({
      id: i,
      x: randomPercent(),
      y: randomPercent(),
    }))
  );
  const orbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setOrbs((prev) =>
        prev.map((o) => ({ ...o, x: randomPercent(), y: randomPercent() }))
      );
    }, ORB_UPDATE_MS);
    return () => clearInterval(interval);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    startRef.current = performance.now() / 1000;
    const tick = () => {
      const t = performance.now() / 1000 - startRef.current;
      const period = ORB_CYCLE_SEC;
      orbRefs.current.forEach((el, i) => {
        if (!el) return;
        const phase = (i * Math.PI * 0.5);
        const raw = Math.sin((2 * Math.PI * t) / period + phase);
        const opacity = Math.max(0, raw * ORB_PEAK_OPACITY);
        el.style.opacity = String(opacity);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  const onMove = useCallback((e: MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    setMouse({ x, y });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mounted, onMove]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Base: dark gradient + game-colored orbs + diagonal depth + pulse */}
      <div
        className="absolute inset-0 animate-bg-shift"
        style={{
          background: `
            linear-gradient(160deg, rgba(15,14,18,0.6) 0%, transparent 40%),
            linear-gradient(340deg, rgba(18,15,20,0.5) 0%, transparent 45%),
            linear-gradient(135deg, transparent 0%, rgba(201, 162, 39, 0.06) 100%),
            radial-gradient(ellipse 120% 70% at 50% -5%, rgba(201, 162, 39, 0.22) 0%, transparent 40%),
            radial-gradient(ellipse 60% 45% at 85% 75%, rgba(184, 74, 74, 0.14) 0%, transparent 50%),
            radial-gradient(ellipse 60% 45% at 15% 75%, rgba(61, 143, 61, 0.14) 0%, transparent 50%),
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(30, 28, 35, 0.65) 0%, transparent 55%),
            linear-gradient(180deg, #0c0b10 0%, #080709 35%, #060508 100%)
          `,
        }}
      />
      {/* Subtle grain for texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Cursor-following soft glow — theme gold */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(
            ellipse 80vmax 60vmax at ${mouse.x}% ${mouse.y}%,
            rgba(201, 162, 39, 0.14) 0%,
            rgba(201, 162, 39, 0.06) 25%,
            transparent 55%
          )`,
        }}
      />
      {/* Random orbs: position from state, opacity from requestAnimationFrame (sine wave, no keyframes) */}
      {orbs.map((orb, i) => (
        <div
          key={orb.id}
          className="absolute inset-0 pointer-events-none"
          style={{
            ["--orb-x" as string]: `${orb.x}%`,
            ["--orb-y" as string]: `${orb.y}%`,
          }}
          aria-hidden
        >
          <div
            ref={(el) => {
              orbRefs.current[i] = el;
            }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse 55vmax 40vmax at var(--orb-x) var(--orb-y),
                rgba(201, 162, 39, 0.14) 0%,
                rgba(201, 162, 39, 0.05) 30%,
                transparent 55%
              )`,
            }}
          />
        </div>
      ))}
      {/* Hero image: centered — hidden on room page so game UI (track, tavern) is clear */}
      {!isRoomPage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-[min(85vw,720px)] h-[min(75vh,560px)] opacity-[0.62]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={IMG.main}
              alt=""
              className="w-full h-full object-contain object-center"
              onError={hideOnError}
            />
          </div>
        </div>
      )}
      {/* Overlay: darken center for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 90% 80% at 50% 50%, transparent 35%, rgba(6,6,8,0.5) 70%, rgba(6,6,8,0.88) 100%)`,
        }}
      />
      {/* Side art — left: inset from corner; right: closer to edge, bigger */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[5%] bottom-[10%] w-[min(40vw,380px)] h-[52vh] max-h-[400px] opacity-[0.38]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.conflict} alt="" className="w-full h-full object-contain object-bottom" onError={hideOnError} />
        </div>
        <div className="absolute right-[1%] top-[6%] w-[min(54vw,520px)] h-[68vh] max-h-[540px] opacity-[0.42]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.sixLeaders} alt="" className="w-full h-full object-contain object-top" onError={hideOnError} />
        </div>
      </div>
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 48%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </div>
  );
}
