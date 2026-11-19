import { diffDays, resolveYearFilter, sumCents } from '@/lib/utils';
import type { Paycheque } from '@/types/payday';
import type { OverviewData } from '../types/overview-types';

/** Computes the year-scoped overview metrics from the full paycheque list. */
export function computeOverviewYearSlice(
  paycheques: Paycheque[],
  goal: number,
  yearParam?: string,
  todayOverride?: string
): Pick<
  OverviewData,
  | 'today'
  | 'curYear'
  | 'activeYear'
  | 'isAll'
  | 'isCur'
  | 'inY'
  | 'sumY'
  | 'bySrcEntries'
  | 'prevTotal'
  | 'prevPct'
  | 'paidYearCount'
  | 'activeMonths'
  | 'bestPeriodMonth'
  | 'topSrc'
  | 'goalYear'
  | 'goalSum'
  | 'goalIsCur'
  | 'goalPct'
  | 'daysInYr'
  | 'daysDone'
  | 'goalLeft'
  | 'monthsLeft'
  | 'yearOptions'
> {
  const { today, curYear, activeYear, isAll, inY, yearOptions } = resolveYearFilter(
    paycheques,
    yearParam,
    false,
    todayOverride
  );
  const isCur = !isAll && activeYear === curYear;
  const sumY = sumCents(inY);

  const bySrc = new Map<number, number>();
  inY.forEach((p) => bySrc.set(p.source_id, (bySrc.get(p.source_id) || 0) + p.amount_cents));

  const cutoff = isCur
    ? `${(activeYear as number) - 1}-${today.slice(5)}`
    : `${(activeYear as number) - 1}-12-31`;
  const prevTotal = isAll
    ? 0
    : sumCents(
        paycheques.filter(
          (p) => p.paid_on.startsWith(`${(activeYear as number) - 1}-`) && p.paid_on <= cutoff
        )
      );
  const prevPct = prevTotal ? ((sumY - prevTotal) / prevTotal) * 100 : null;
  const paidYearCount = new Set(inY.map((p) => p.paid_on.slice(0, 4))).size;

  const periodMonths = new Map<string, number>();
  inY.forEach((p) => {
    const ym = p.paid_on.slice(0, 7);
    periodMonths.set(ym, (periodMonths.get(ym) || 0) + p.amount_cents);
  });
  const activeMonths = periodMonths.size;
  const bestPeriodMonth = [...periodMonths].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topSrc = [...bySrc].sort((a, b) => b[1] - a[1])[0] ?? null;

  const goalYear = isAll ? curYear : (activeYear as number);
  const goalSum = isAll
    ? sumCents(paycheques.filter((p) => p.paid_on.startsWith(`${curYear}-`)))
    : sumY;
  const goalIsCur = goalYear === curYear;
  const goalPct = goal ? Math.min(100, (goalSum / goal) * 100) : 0;
  const daysInYr = diffDays(`${goalYear}-01-01`, `${goalYear + 1}-01-01`);
  const daysDone = goalIsCur ? diffDays(`${goalYear}-01-01`, today) + 1 : daysInYr;
  const goalLeft = goal - goalSum;
  const monthsLeft = (daysInYr - daysDone) / 30.44;

  return {
    today,
    curYear,
    activeYear,
    isAll,
    isCur,
    inY,
    sumY,
    bySrcEntries: [...bySrc.entries()],
    prevTotal,
    prevPct,
    paidYearCount,
    activeMonths,
    bestPeriodMonth,
    topSrc,
    goalYear,
    goalSum,
    goalIsCur,
    goalPct,
    daysInYr,
    daysDone,
    goalLeft,
    monthsLeft,
    yearOptions,
  };
}
