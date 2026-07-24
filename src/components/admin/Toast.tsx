'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CloseIcon } from './icons';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastState {
  kind: ToastKind;
  message: string;
  /** bump to force re-announce identical messages */
  key: number;
}

const ACCENT: Record<ToastKind, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  info: 'var(--info)',
};

/**
 * Minimal toast controller. Returns `[toast, show, clear]`. The visual region
 * is rendered by {@link ToastRegion}. Errors use `role="alert"` (assertive);
 * success/info use `role="status"` (polite). Auto-dismisses, pauses on
 * hover/focus.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const show = useCallback((kind: ToastKind, message: string) => {
    setToast({ kind, message, key: Date.now() });
  }, []);
  const clear = useCallback(() => setToast(null), []);
  return { toast, show, clear };
}

export function ToastRegion({
  toast,
  onClose,
  duration = 5000,
}: {
  toast: ToastState | null;
  onClose: () => void;
  duration?: number;
}) {
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    const start = () => {
      if (pausedRef.current) return;
      timerRef.current = setTimeout(onClose, duration);
    };
    start();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, duration, onClose]);

  if (!toast) return null;
  const accent = ACCENT[toast.kind];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      onMouseEnter={() => {
        pausedRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
        timerRef.current = setTimeout(onClose, duration);
      }}
    >
      <div
        role={toast.kind === 'error' ? 'alert' : 'status'}
        aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        className="pointer-events-auto flex max-w-md items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm shadow-[var(--elev-2)]"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: accent,
          color: 'var(--text)',
        }}
      >
        <span
          aria-hidden="true"
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent }}
        />
        <span className="flex-1 leading-snug">{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
