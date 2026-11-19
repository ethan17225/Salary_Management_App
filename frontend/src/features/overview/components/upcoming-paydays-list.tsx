'use client';

import type { CSSProperties } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { dateLabel, diffDays, fmt, plural } from '@/lib/utils';
import type { UpcomingPayday } from '@/types/payday';

export function UpcomingPaydaysList({
  upcoming,
  today,
}: {
  upcoming: UpcomingPayday[];
  today: string;
}) {
  const { openPaychequeDialog } = useDialogs();

  return (
    <ul className="list-none m-0 p-0">
      {upcoming.length ? (
        upcoming.map((u) => {
          const d = diffDays(today, u.next);
          const when =
            d > 1
              ? `in ${d} days`
              : d === 1
                ? 'tomorrow'
                : d === 0
                  ? 'today'
                  : `${plural(-d, 'day')} late`;
          const isDue = d <= 0;
          return (
            <li
              key={u.source.id}
              className="flex items-center gap-3 py-3 border-t border-line first:border-t-0 first:pt-0.5"
            >
              <span
                className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
                style={{ '--c': u.source.color } as CSSProperties}
              />
              <span className="flex-1 min-w-0 grid">
                <b className="font-medium truncate">{u.source.name}</b>
                <span className="text-sm text-muted">
                  {dateLabel(u.next, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  ·{' '}
                  <span className={isDue ? 'font-medium text-warn' : undefined}>{when}</span> ·
                  every {u.gap}d
                </span>
              </span>
              <span className="num text-sm text-muted hidden sm:inline">≈ {fmt(u.amount)}</span>
              <button
                type="button"
                className="btn min-h-[40px] px-3 text-sm"
                aria-label={`Log ${u.source.name} deposit (~${fmt(u.amount)})`}
                onClick={() =>
                  openPaychequeDialog(null, u.source.id, {
                    sourceId: u.source.id,
                    amountCents: Math.round(u.amount),
                    paidOn: u.next <= today ? u.next : today,
                  })
                }
              >
                Log
              </button>
            </li>
          );
        })
      ) : (
        <li className="text-muted">
          Set a pay schedule on a source or log 3 paycheques to see upcoming dates.
        </li>
      )}
    </ul>
  );
}
