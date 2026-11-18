'use client';

import { useDialogs } from '@/components/ui/dialog-provider';
import { dateLabel, fmt } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';

export function AddSourceButton() {
  const { openSourceDialog } = useDialogs();
  return (
    <button
      className="btn primary w-full sm:w-auto"
      type="button"
      onClick={() => openSourceDialog()}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 3v10M3 8h10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      Add a source
    </button>
  );
}

export function SourceDetailHeaderActions({ source }: { source: Source }) {
  const { openSourceDialog, openPaychequeDialog } = useDialogs();
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <button className="btn" type="button" onClick={() => openSourceDialog(source)}>
        Edit {source.name}
      </button>
      <button
        className="btn primary"
        type="button"
        onClick={() => openPaychequeDialog(null, source.id)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        Add to {source.name}
      </button>
    </div>
  );
}

export function SourceRecordItemButton({
  title,
  paycheque,
}: {
  title: string;
  paycheque: Paycheque;
}) {
  const { openPaychequeDialog } = useDialogs();
  return (
    <button
      type="button"
      className="flex items-center gap-3 w-[calc(100%+16px)] -my-1.5 -mx-2 py-1.5 px-2 rounded cursor-pointer text-left transition-colors duration-150 hover:bg-[#f2f6f7] focus-visible:outline-2 focus-visible:outline-accent"
      onClick={() => openPaychequeDialog(paycheque)}
    >
      <span className="flex-1 min-w-0 grid">
        <b className="font-medium">{title}</b>
        <span className="text-sm text-muted truncate">
          {dateLabel(paycheque.paid_on)}
          {paycheque.note ? ` · ${paycheque.note}` : ''}
        </span>
      </span>
      <span className="num">{fmt(paycheque.amount_cents)}</span>
    </button>
  );
}

