'use client';

import { CheckCircle2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

const ToastContext = createContext<(tone: Toast['tone'], message: string) => void>(() => undefined);

/** Notifications éphémères (« Véhicule enregistré »…). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const notify = useCallback(
    (tone: Toast['tone'], message: string) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all, { id, tone, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg bg-white p-3 text-sm shadow-lg ring-1 ring-slate-200"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="size-5 shrink-0 text-red-600" aria-hidden />
            )}
            <p className="flex-1 text-slate-700">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  return {
    success: (message: string) => notify('success', message),
    error: (message: string) => notify('error', message),
  };
}
