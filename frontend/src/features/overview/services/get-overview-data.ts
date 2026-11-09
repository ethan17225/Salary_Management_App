import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import {
  buildTimelineMonths,
  computeUpcomingPaydays,
  diffDays,
  iso,
  sumCents,
} from '@/lib/utils';
import type { OverviewData } from '../types/overview-types';
import type { YearOption } from '@/components/ui/year-dropdown';

export const getOverviewData = cache(async (yearParam?: string): Promise<OverviewData> => {
  const state = await db.getState();
  const today = iso(new Date());
  const curYear = +today.slice(0, 4);

  const yearsSet = new Set(state.paycheques.map((p) => +p.paid_on.slice(0, 4)));
  yearsSet.add(curYear);
  const years = [...yearsSet].sort((a, b) => b - a);

  let activeYear: 'all' | number = curYear;
  if (yearParam === 'all') {
    activeYear = 'all';
  } else if (yearParam && /^\d{4}$/.test(yearParam)) {
    activeYear = Number(yearParam);
  }

  const isAll = activeYear === 'all';
  const isCur = !isAll && activeYear === curYear;
  const inY = isAll
    ? state.paycheques
    : state.paycheques.filter((p) => p.paid_on.startsWith(`${activeYear}-`));
  const sumY = sumCents(inY);

  const bySrc = new Map<number, number>();
  inY.forEach((p) => bySrc.set(p.source_id, (bySrc.get(p.source_id) || 0) + p.amount_cents));

  const timelineMonths = buildTimelineMonths(state.paycheques, curYear);

  const cutoff = isCur ? `${(activeYear as number) - 1}-${today.slice(5)}` : `${(activeYear as number) - 1}-12-31`;
  const prevTotal = isAll
    ? 0
    : sumCents(
        state.paycheques.filter(
          (p) => p.paid_on.startsWith(`${(activeYear as number) - 1}-`) && p.paid_on <= cutoff
        )
      );
  const prevPct = prevTotal ? ((sumY - prevTotal) / prevTotal) * 100 : null;
  const thisMonthTotal = sumCents(
    state.paycheques.filter((p) => p.paid_on.startsWith(today.slice(0, 7)))
  );
  const paidYearCount = new Set(inY.map((p) => p.paid_on.slice(0, 4))).size;

  const periodMonths = new Map<string, number>();
  inY.forEach((p) => {
    const ym = p.paid_on.slice(0, 7);
    periodMonths.set(ym, (periodMonths.get(ym) || 0) + p.amount_cents);
  });
  const activeMonths = periodMonths.size;
  const bestPeriodMonth = [...periodMonths].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topSrc = [...bySrc].sort((a, b) => b[1] - a[1])[0] ?? null;

  const goal = Number(state.settings.goal_cents || 0);
  const goalYear = isAll ? curYear : (activeYear as number);
  const goalSum = isAll
    ? sumCents(state.paycheques.filter((p) => p.paid_on.startsWith(`${curYear}-`)))
    : sumY;
  const goalIsCur = goalYear === curYear;
  const goalPct = goal ? Math.min(100, (goalSum / goal) * 100) : 0;
  const daysInYr = diffDays(`${goalYear}-01-01`, `${goalYear + 1}-01-01`);
  const daysDone = goalIsCur ? diffDays(`${goalYear}-01-01`, today) + 1 : daysInYr;
  const goalLeft = goal - goalSum;
  const monthsLeft = (daysInYr - daysDone) / 30.44;

  const yearOptions: YearOption[] = [
    ['all', 'All', sumCents(state.paycheques)],
    ...years.map(
      (y): YearOption => [
        y,
        String(y),
        sumCents(state.paycheques.filter((p) => p.paid_on.startsWith(`${y}-`))),
      ]
    ),
  ];

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

  const upcoming = computeUpcomingPaydays(state.sources, state.paycheques, today);

  return {
    sources: state.sources,
    paycheques: state.paycheques,
    allocations: state.allocations ?? [],
    forecast: state.forecast ?? null,
    today,
    curYear,
    activeYear,
    isAll,
    isCur,
    inY,
    sumY,
    bySrcEntries: [...bySrc.entries()],
    timelineMonths,
    prevTotal,
    prevPct,
    thisMonthTotal,
    paidYearCount,
    activeMonths,
    bestPeriodMonth,
    topSrc,
    goal,
    goalYear,
    goalSum,
    goalIsCur,
    goalPct,
    daysInYr,
    daysDone,
    goalLeft,
    monthsLeft,
    yearOptions,
    bestEver,
    biggest,
    upcoming,
  };
});

