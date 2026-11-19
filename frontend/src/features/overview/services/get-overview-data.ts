import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { buildTimelineMonths, computeUpcomingPaydays, sumCents } from '@/lib/utils';
import { computeOverviewYearSlice } from '../lib/compute-overview';
import type { OverviewData } from '../types/overview-types';

export const getOverviewData = cache(async (yearParam?: string): Promise<OverviewData> => {
  const state = await db.getState();
  const goal = Number(state.settings.goal_cents || 0);
  const yearSlice = computeOverviewYearSlice(state.paycheques, goal, yearParam);
  const timelineMonths = buildTimelineMonths(state.paycheques, yearSlice.curYear);
  const thisMonthTotal = sumCents(
    state.paycheques.filter((p) => p.paid_on.startsWith(yearSlice.today.slice(0, 7)))
  );

  const allMonths: Record<string, number> = {};
  state.paycheques.forEach((p) => {
    const k = p.paid_on.slice(0, 7);
    allMonths[k] = (allMonths[k] || 0) + p.amount_cents;
  });
  const bestEver = Object.entries(allMonths).sort((a, b) => b[1] - a[1])[0] ?? null;
  const biggest = state.paycheques.reduce<typeof state.paycheques[number] | null>(
    (m, p) => (!m || p.amount_cents > m.amount_cents ? p : m),
    null
  );
  const upcoming = computeUpcomingPaydays(state.sources, state.paycheques, yearSlice.today);

  return {
    sources: state.sources,
    paycheques: state.paycheques,
    allocations: state.allocations ?? [],
    ...yearSlice,
    timelineMonths,
    thisMonthTotal,
    goal,
    bestEver,
    biggest,
    upcoming,
  };
});
