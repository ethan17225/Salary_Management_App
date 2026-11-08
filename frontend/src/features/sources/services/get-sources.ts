import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { iso, pad, parseDate, sumCents } from '@/lib/utils';
import type { SourceCardSummary, SparkYearSpan } from '../types/source-types';

export const getSourcesData = cache(async (): Promise<SourceCardSummary[]> => {
  const state = await db.getState();
  const base = parseDate(iso(new Date()));

  return state.sources.map((source) => {
    const ps = state.paycheques.filter((p) => p.source_id === source.id);
    const totalCents = sumCents(ps);
    const timed = ps.filter((p) => p.hours);
    const timedHours = timed.reduce((h, p) => h + (p.hours || 0), 0);
    const timedCents = sumCents(timed);

    const items = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const k = `${y}-${pad(m)}`;
      return {
        k,
        y,
        m,
        v: sumCents(ps.filter((p) => p.paid_on.startsWith(k))),
      };
    });

    const yrs: SparkYearSpan[] = [];
    for (const it of items) {
      if (yrs.at(-1)?.y === it.y) yrs.at(-1)!.span++;
      else yrs.push({ y: it.y, span: 1 });
    }

    return {
      source,
      paycheques: ps,
      totalCents,
      timedHours,
      timedCents,
      spark: {
        items,
        yrs,
        max: Math.max(...items.map((x) => x.v), 1),
      },
    };
  });
});

