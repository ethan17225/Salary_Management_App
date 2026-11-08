'use client';

import { useDialogs } from '@/components/ui/dialog-provider';
import { dateLabel, fmt } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';

export function AddSourceButton() {
  const { openSourceDialog } = useDialogs();
  return (
    <button className="btn primary" type="button" onClick={() => openSourceDialog()}>
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
    <div className="detail-actions">
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
    <button type="button" className="item" onClick={() => openPaychequeDialog(paycheque)}>
      <span className="grow">
        <b>{title}</b>
        <span className="muted">
          {dateLabel(paycheque.paid_on)}
          {paycheque.note ? ` · ${paycheque.note}` : ''}
        </span>
      </span>
      <span className="num">{fmt(paycheque.amount_cents)}</span>
    </button>
  );
}

