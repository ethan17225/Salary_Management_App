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

interface PaychequeDialogRequest {
  paycheque?: Paycheque | null;
  forceSourceId?: number | null;
  nonce: number;
}

interface SourceDialogRequest {
  source?: Source | null;
  onCreated?: (newSourceId: number) => void;
  nonce: number;
}

interface ToastState {
  msg: string;
  undo?: () => Promise<void>;
}

interface DialogContextValue {
  paychequeRequest: PaychequeDialogRequest | null;
  sourceRequest: SourceDialogRequest | null;
  openPaychequeDialog: (paycheque?: Paycheque | null, forceSourceId?: number | null) => void;
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
    (paycheque: Paycheque | null = null, forceSourceId: number | null = null) => {
      setPaychequeRequest({ paycheque, forceSourceId, nonce: Date.now() + Math.random() });
    },
    []
  );

  const openSourceDialog = useCallback(
    (source: Source | null = null, onCreated?: (newSourceId: number) => void) => {
      setSourceRequest({ source, onCreated, nonce: Date.now() + Math.random() });
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
      <div id="toast" className={toastState ? 'show' : undefined} role="status" aria-live="polite">
        {toastState ? (
          <>
            <span>{toastState.msg}</span>
            {toastState.undo ? (
              <button
                type="button"
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

