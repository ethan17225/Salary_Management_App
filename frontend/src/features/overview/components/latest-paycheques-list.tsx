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
      <ul className="list-none m-0 p-0">
        <li className="text-muted py-1">
          No paycheques yet.{' '}
          <span className="hidden [@media(pointer:fine)]:inline">Press N to add one.</span>
        </li>
      </ul>
    );
  }

  return (
    <ul className="list-none m-0 p-0">
      {paycheques.slice(0, 5).map((p) => {
        const s = srcById(p.source_id);
        return (
          <li
            key={p.id}
            className="flex items-center gap-3 py-3 border-t border-line first:border-t-0 first:pt-0.5"
          >
            <button
              className="flex items-center gap-3 w-[calc(100%+16px)] -my-1.5 -mx-2 py-1.5 px-2 rounded cursor-pointer text-left transition-colors duration-150 hover:bg-[#f2f6f7] focus-visible:outline-2 focus-visible:outline-accent"
              type="button"
              onClick={() => openPaychequeDialog(p)}
              aria-label={`Edit ${s.name} paycheque of ${fmt(p.amount_cents)}`}
            >
              <span
                className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
                style={{ '--c': s.color } as CSSProperties}
              />
              <span className="flex-1 min-w-0 grid">
                <b className="font-medium">{s.name}</b>
                <span className="text-sm text-muted truncate">
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

