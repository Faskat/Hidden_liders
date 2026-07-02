"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string };

const ToastContext = createContext<((message: string) => void) | null>(null);

const TOAST_DURATION_MS = 5000;

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) return () => {};
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    const t = timeoutsRef.current.get(id);
    if (t) clearTimeout(t);
    timeoutsRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message }]);
      const t = setTimeout(() => removeToast(id), TOAST_DURATION_MS);
      timeoutsRef.current.set(id, t);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className="fixed top-0 right-0 z-[100] p-4 sm:p-5 flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
        aria-label="Сповіщення"
      >
        <div className="flex flex-col gap-3 pointer-events-auto">
          {toasts.map((t) => (
            <ToastItem
              key={t.id}
              message={t.message}
              onClose={() => removeToast(t.id)}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-[var(--red)]/40 bg-[var(--bg-panel)] px-4 py-3.5 shadow-lg shadow-black/30 animate-toast-in min-w-[280px] max-w-[min(100vw-2rem,380px)]"
    >
      <span className="flex-1 text-sm text-[var(--text)] leading-snug">
        {message}
      </span>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
        aria-label="Закрити"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M12 4L4 12M4 4l8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
