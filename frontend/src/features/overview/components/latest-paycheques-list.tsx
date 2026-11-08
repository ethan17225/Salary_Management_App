'use client';

import type { CSSProperties } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { dateLabel, fmt } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';

export function LatestPaychequesList({
  paycheques,
  sources,
}: {
  paycheques: Paycheque[];
  sources: Source[];
}) {
  const { openPaychequeDialog } = useDialogs();
  const srcById = (id: number) =>
    sources.find((s) => s.id === id) || { name: 'Unknown', color: '#94a3b8' };

  if (!paycheques.length) {
    return (
      <ul className="list">
        <li className="muted">No paycheques yet. Press N to add one.</li>
      </ul>
    );
  }

  return (
    <ul className="list">
      {paycheques.slice(0, 5).map((p) => {
        const s = srcById(p.source_id);
        return (
          <li key={p.id}>
            <button
              className="item"
              type="button"
              onClick={() => openPaychequeDialog(p)}
              aria-label={`Edit ${s.name} paycheque of ${fmt(p.amount_cents)}`}
            >
              <span className="dot" style={{ '--c': s.color } as CSSProperties} />
              <span className="grow">
                <b>{s.name}</b>
                <span className="muted">
                  {dateLabel(p.paid_on)}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </span>
              <span className="num">{fmt(p.amount_cents)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

