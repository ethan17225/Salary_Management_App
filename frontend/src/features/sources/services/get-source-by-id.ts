import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import {
  buildTimelineMonths,
  computeUpcomingPaydays,
  dateLabel,
  diffDays,
  median,
} from '@/lib/utils';
import { computeSourceYearSlice } from '../lib/compute-source-detail';
import type { SourceDetailData } from '../types/source-types';

export const getSourceById = cache(
  async (id: number, yearParam?: string): Promise<SourceDetailData | null> => {
    if (!Number.isFinite(id) || id <= 0) return null;

    const state = await db.getState();
    const source = state.sources.find((s) => s.id === id);
    if (!source) return null;

    const srcAllPs = state.paycheques.filter((p) => p.source_id === source.id);
    const { curYear, ...yearSlice } = computeSourceYearSlice(
      srcAllPs,
      state.paycheques,
      yearParam
    );

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
    const upcoming = computeUpcomingPaydays(state.sources, state.paycheques, yearSlice.today);
    const upcomingForSource = upcoming.find((u) => u.source.id === source.id) ?? null;

    return {
      source,
      allPaycheques: state.paycheques,
      srcAllPs,
      ...yearSlice,
      srcCadence: { weekday, gap },
      srcTimeline,
      upcomingForSource,
    };
  }
);
