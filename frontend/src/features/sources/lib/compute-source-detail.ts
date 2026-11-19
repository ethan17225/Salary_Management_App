import { median, resolveYearFilter, sumCents } from '@/lib/utils';
import type { Paycheque } from '@/types/payday';
import type { SourceDetailData } from '../types/source-types';

/** Computes the year-scoped metrics for a single income source. */
export function computeSourceYearSlice(
  srcAllPs: Paycheque[],
  allPaycheques: Paycheque[],
  yearParam?: string,
  todayOverride?: string
): Pick<
  SourceDetailData,
  | 'today'
  | 'srcYears'
  | 'srcYear'
  | 'srcIsAll'
  | 'srcPs'
  | 'srcSum'
  | 'srcSharePct'
  | 'srcAvg'
  | 'srcMaxP'
  | 'srcMinP'
  | 'srcMedian'
  | 'srcTimedCount'
  | 'srcHours'
  | 'srcTimedSum'
  | 'srcActiveMonths'
  | 'srcBestMonth'
  | 'srcYearOptions'
> & { curYear: number } {
  const {
    today,
    curYear,
    years: srcYears,
    activeYear: srcYear,
    isAll: srcIsAll,
    inY: srcPs,
    yearOptions: srcYearOptions,
  } = resolveYearFilter(srcAllPs, yearParam, true, todayOverride);

  const srcSum = sumCents(srcPs);
  const srcTotalPool = sumCents(
    srcIsAll
      ? allPaycheques
      : allPaycheques.filter((p) => p.paid_on.startsWith(`${srcYear}-`))
  );
  const srcSharePct = srcTotalPool ? Math.round((srcSum / srcTotalPool) * 100) : 0;
  const srcAvg = srcPs.length ? srcSum / srcPs.length : 0;
  const srcMaxP = srcPs.reduce<Paycheque | null>(
    (m, p) => (!m || p.amount_cents > m.amount_cents ? p : m),
    null
  );
  const srcMinP = srcPs.reduce<Paycheque | null>(
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

  return {
    today,
    curYear,
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
    srcYearOptions,
  };
}
