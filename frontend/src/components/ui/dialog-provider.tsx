'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Paycheque, Source } from '@/types/payday';
import { cn } from '@/lib/utils';

export interface PaychequePrefill {
  sourceId?: number;
  amountCents?: number;
  paidOn?: string;
}

interface PaychequeDialogRequest {
  paycheque?: Paycheque | null;
  forceSourceId?: number | null;
  prefill?: PaychequePrefill | null;
}

interface SourceDialogRequest {
  source?: Source | null;
  onCreated?: (newSourceId: number) => void;
}

interface ToastState {
  msg: string;
  undo?: () => Promise<void>;
}

interface DialogContextValue {
  paychequeRequest: PaychequeDialogRequest | null;
  sourceRequest: SourceDialogRequest | null;
  openPaychequeDialog: (
    paycheque?: Paycheque | null,
    forceSourceId?: number | null,
    prefill?: PaychequePrefill | null
  ) => void;
  openSourceDialog: (source?: Source | null, onCreated?: (newSourceId: number) => void) => void;
  toast: (msg: string, undo?: () => Promise<void>) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [paychequeRequest, setPaychequeRequest] = useState<PaychequeDialogRequest | null>(null);
  const [sourceRequest, setSourceRequest] = useState<SourceDialogRequest | null>(null);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, undo?: () => Promise<void>) => {
    setToastState({ msg, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), undo ? 7000 : 3000);
  }, []);

  const openPaychequeDialog = useCallback(
    (
      paycheque: Paycheque | null = null,
      forceSourceId: number | null = null,
      prefill: PaychequePrefill | null = null
    ) => {
      setPaychequeRequest({ paycheque, forceSourceId, prefill });
    },
    []
  );

  const openSourceDialog = useCallback(
    (source: Source | null = null, onCreated?: (newSourceId: number) => void) => {
      setSourceRequest({ source, onCreated });
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.key.toLowerCase() === 'n' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !document.querySelector('dialog[open]') &&
        !target?.closest('input, select, textarea')
      ) {
        e.preventDefault();
        openPaychequeDialog();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openPaychequeDialog]);

  return (
    <DialogContext.Provider
      value={{
        paychequeRequest,
        sourceRequest,
        openPaychequeDialog,
        openSourceDialog,
        toast,
      }}
    >
      {children}
      <div
        id="toast"
        className={cn(
          'fixed left-1/2 bottom-6 z-60 -translate-x-1/2 flex items-center gap-2 max-w-[calc(100%-32px)] bg-ink text-white py-2 pr-2 pl-[18px] rounded-xl shadow-[0_12px_30px_rgb(31_48_56/.3)] transition-[opacity,transform] duration-200 min-h-[52px]',
          toastState
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
        role="status"
        aria-live="polite"
      >
        {toastState ? (
          <>
            <span>{toastState.msg}</span>
            {toastState.undo ? (
              <button
                type="button"
                className="cursor-pointer text-[#7fd6dd] font-medium px-3 min-h-[44px] inline-flex items-center rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => {
                  const fn = toastState.undo;
                  setToastState(null);
                  fn?.().catch((err: Error) => toast(err.message));
                }}
              >
                Undo
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </DialogContext.Provider>
  );
}

export function useDialogs(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialogs must be used within a DialogProvider');
  }
  return ctx;
}
