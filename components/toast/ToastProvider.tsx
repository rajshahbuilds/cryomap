"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  /** Show a toast; returns its id (so it can be dismissed early). */
  show: (message: string, tone?: ToastTone) => number;
  success: (message: string) => number;
  error: (message: string) => number;
  warning: (message: string) => number;
  info: (message: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Auto-dismiss delay; errors linger a little longer so they aren't missed. */
const DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: "border-status-working text-status-working",
  error: "border-status-broken text-status-broken",
  warning: "border-status-noisy text-status-noisy",
  info: "border-status-planned text-status-planned",
};

/**
 * App-wide toast notifications. Wrap the tree once (in the root layout) and call
 * {@link useToast} anywhere beneath it. Toasts auto-dismiss; errors persist
 * longer. The viewport is a fixed, polite live region in the bottom-right.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      const timer = setTimeout(() => dismiss(id), DURATION[tone]);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      warning: (m) => show(m, "warning"),
      info: (m) => show(m, "info"),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-surface px-3 py-2 text-sm shadow-lg ${TONE_CLASS[toast.tone]}`}
          >
            <span className="flex-1 text-foreground">{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="text-muted transition hover:text-foreground"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Access the toast API. Must be used within a {@link ToastProvider}. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return api;
}
