import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import {
  buildTimelineMonths,
  computeUpcomingPaydays,
  dateLabel,
  diffDays,
  iso,
  median,
  sumCents,
} from '@/lib/utils';
import type { SourceDetailData } from '../types/source-types';
import type { YearOption } from '@/components/ui/year-dropdown';

export const getSourceById = cache(
  async (id: number, yearParam?: string): Promise<SourceDetailData | null> => {
    if (!Number.isFinite(id) || id <= 0) return null;

    const state = await db.getState();
    const source = state.sources.find((s) => s.id === id);
    if (!source) return null;

    const today = iso(new Date());
    const curYear = +today.slice(0, 4);
    const srcAllPs = state.paycheques.filter((p) => p.source_id === source.id);

    const ys = new Set(srcAllPs.map((p) => +p.paid_on.slice(0, 4)));
    if (!ys.size) ys.add(curYear);
    const srcYears = [...ys].sort((a, b) => b - a);

    let srcYear: 'all' | number = 'all';
    if (yearParam && /^\d{4}$/.test(yearParam)) {
      srcYear = Number(yearParam);
    }

    const srcIsAll = srcYear === 'all';
    const srcPs = srcIsAll
      ? srcAllPs
      : srcAllPs.filter((p) => p.paid_on.startsWith(`${srcYear}-`));
    const srcSum = sumCents(srcPs);
    const srcTotalPool = sumCents(
      srcIsAll
        ? state.paycheques
        : state.paycheques.filter((p) => p.paid_on.startsWith(`${srcYear}-`))
    );
    const srcSharePct = srcTotalPool ? Math.round((srcSum / srcTotalPool) * 100) : 0;
    const srcAvg = srcPs.length ? srcSum / srcPs.length : 0;
    const srcMaxP = srcPs.reduce<typeof srcPs[number] | null>(
      (m, p) => (!m || p.amount_cents > m.amount_cents ? p : m),
      null
    );
    const srcMinP = srcPs.reduce<typeof srcPs[number] | null>(
      (m, p) => (!m || p.amount_cents < m.amount_cents ? p : m),
      null
    );
    const srcMedian = srcPs.length ? median(srcPs.map((p) => p.amount_cents)) : 0;
    const srcTimed = srcPs.filter((p) => p.hours);
    const srcHours = srcTimed.reduce((h, p) => h + (p.hours || 0), 0);
    const srcTimedSum = sumCents(srcTimed);

    const srcPeriodMonths = new Map<string, number>();
    srcPs.forEach((p) => {
      const ym = p.paid_on.slice(0, 7);
      srcPeriodMonths.set(ym, (srcPeriodMonths.get(ym) || 0) + p.amount_cents);
    });
    const srcActiveMonths = srcPeriodMonths.size;
    const srcBestMonth = [...srcPeriodMonths].sort((a, b) => b[1] - a[1])[0] ?? null;

    let weekday: string | null = null;
    let gap: number | null = null;
    if (srcAllPs.length) {
      const counts: Record<string, number> = {};
      srcAllPs.forEach((p) => {
        const w = dateLabel(p.paid_on, { weekday: 'long' });
        counts[w] = (counts[w] || 0) + 1;
      });
      weekday = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const asc = [...srcAllPs].reverse();
      const gaps = asc
        .slice(1)
        .map((p, i) => diffDays(asc[i].paid_on, p.paid_on))
        .filter((g) => g > 0 && g <= 45);
      gap = gaps.length >= 2 ? Math.round(median(gaps)) : null;
    }

    const srcTimeline = buildTimelineMonths(srcAllPs, curYear);
    const srcYearOptions: YearOption[] = [
      ['all', 'All', sumCents(srcAllPs)],
      ...srcYears.map(
        (y): YearOption => [
          y,
          String(y),
          sumCents(srcAllPs.filter((p) => p.paid_on.startsWith(`${y}-`))),
        ]
      ),
    ];

    const upcoming = computeUpcomingPaydays(state.sources, state.paycheques, today);
    const upcomingForSource = upcoming.find((u) => u.source.id === source.id) ?? null;

    return {
      source,
      srcAllPs,
      srcYears,
      srcYear,
      srcIsAll,
      srcPs,
      srcSum,
      srcSharePct,
      srcAvg,
      srcMaxP,
      srcMinP,
      srcMedian,
      srcTimedCount: srcTimed.length,
      srcHours,
      srcTimedSum,
      srcActiveMonths,
      srcBestMonth,
      srcCadence: { weekday, gap },
      srcTimeline,
      srcYearOptions,
      upcomingForSource,
    };
  }
);

