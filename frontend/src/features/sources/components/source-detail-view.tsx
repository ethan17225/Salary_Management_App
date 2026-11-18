import { Fragment, type CSSProperties } from 'react';
import Link from 'next/link';
import { YearDropdown } from '@/components/ui/year-dropdown';
import { computeAggregateTaxSummary } from '@/lib/tax-intelligence';
import { cn, dateLabel, fmt, KIND_LABELS, plural, sumCents } from '@/lib/utils';
import {
  SourceDetailHeaderActions,
  SourceRecordItemButton,
} from './source-detail-actions';
import { SourceIncomeChart } from './source-income-chart';
import { SourcePaychequeLedger } from './source-paycheque-ledger';
import type { SourceDetailData } from '../types/source-types';

export function SourceDetailView({
  data,
  searchQuery,
}: {
  data: SourceDetailData;
  searchQuery?: string;
}) {
  const {
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
    srcTimedCount,
    srcHours,
    srcTimedSum,
    srcActiveMonths,
    srcBestMonth,
    srcCadence,
    srcTimeline,
    srcYearOptions,
    upcomingForSource,
  } = data;

  const taxSum = computeAggregateTaxSummary(srcPs, new Map([[source.id, source]]));

  return (
    <section>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-[18px]">
        <Link
          className="inline-flex items-center gap-2 min-h-[44px] pl-2.5 pr-3.5 rounded text-muted no-underline font-medium text-[15px] transition-colors duration-150 hover:text-ink hover:bg-surface"
          href="/sources"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M12.5 8h-9M7.5 4l-4 4 4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          All sources
        </Link>
        <SourceDetailHeaderActions source={source} />
      </div>

      <div className="hero src-hero" style={{ '--c': source.color } as CSSProperties}>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="size-3.5 rounded-[4px] bg-(--c) shrink-0 shadow-[0_0_0_2px_rgb(255_255_255/.18)]" />
            <h1 className="text-lg font-medium text-white tracking-[-0.01em]">{source.name}</h1>
            <span className="text-xs font-medium py-[3px] px-2.5 rounded-full bg-white/12 text-[#dbe5e9]">
              {KIND_LABELS[source.kind]}
            </span>
            {source.archived ? (
              <span className="text-xs font-medium py-[3px] px-2.5 rounded-full bg-white/12 text-[#dbe5e9]">
                Archived
              </span>
            ) : null}
            {source.is_tax_withheld === 0 ? (
              <span className="pill-reserve">
                Tax Reserve: {((source.tax_reserve_bps ?? 0) / 100).toFixed(0)}% (
                {fmt(taxSum.totalContractorTaxReserveCents)} set aside)
              </span>
            ) : null}
          </div>
          <p className="num text-[clamp(2.75rem,7vw,5.25rem)] leading-[1.05] tracking-[-0.04em] mt-1.5 mb-2.5">
            {fmt(srcSum)}
          </p>
          <p className="text-[#b9c8ce] text-[15px]">
            {srcPs.length ? (
              <Fragment>
                <b className="font-medium">{plural(srcPs.length, 'paycheque')}</b> ·{' '}
                <b className="font-medium">{srcSharePct}%</b> of{' '}
                {srcIsAll ? 'all-time' : srcYear} income ·{' '}
                {dateLabel(srcPs.at(-1)!.paid_on, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                –{' '}
                {dateLabel(srcPs[0].paid_on, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Fragment>
            ) : (
              `No paycheques recorded for ${source.name}${srcIsAll ? ' yet' : ` in ${srcYear}`}.`
            )}
          </p>
        </div>
        <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-4 w-full md:w-auto flex-wrap">
          <YearDropdown
            activeYear={srcYear}
            options={srcYearOptions}
            ariaLabel="Select source year"
          />
          <p className="text-sm text-[#b9c8ce]">
            {upcomingForSource
              ? `Next est. ${dateLabel(upcomingForSource.next, {
                  month: 'short',
                  day: 'numeric',
                })} · ~${fmt(upcomingForSource.amount)}`
              : srcCadence.weekday
                ? `Usually paid on ${srcCadence.weekday}s${
                    srcCadence.gap ? ` · ~${srcCadence.gap}d cycle` : ''
                  }`
                : plural(srcYears.length, 'active year')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Average deposit</p>
          <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
            {srcPs.length ? fmt(srcAvg) : '—'}
          </p>
          <p className="text-sm text-muted">
            {srcPs.length && srcMinP && srcMaxP
              ? `Range ${fmt(srcMinP.amount_cents)} – ${fmt(srcMaxP.amount_cents)}`
              : 'No pay yet'}
          </p>
        </article>
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Monthly average</p>
          <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
            {srcActiveMonths ? fmt(srcSum / srcActiveMonths) : '—'}
          </p>
          <p className="text-sm text-muted">
            {srcActiveMonths ? `across ${plural(srcActiveMonths, 'month')} with pay` : 'No pay yet'}
          </p>
        </article>
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Best month</p>
          <p className="font-medium text-[26px] leading-[1.25] tracking-[-0.02em] mt-1.5 mb-0.5 truncate">
            {srcBestMonth
              ? dateLabel(`${srcBestMonth[0]}-01`, { month: 'short', year: 'numeric' })
              : '—'}
          </p>
          <p className="text-sm text-muted">{srcBestMonth ? fmt(srcBestMonth[1]) : 'No pay yet'}</p>
        </article>
        <article className="card md:col-span-6 lg:col-span-3">
          {srcHours > 0 ? (
            <Fragment>
              <p className="text-sm text-muted">Take-home per hour</p>
              <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
                {fmt(srcTimedSum / srcHours)}/h net
              </p>
              <p className="text-sm text-muted">
                {taxSum.effectiveGrossHourlyCents &&
                taxSum.effectiveGrossHourlyCents > Math.round(srcTimedSum / srcHours)
                  ? `${fmt(taxSum.effectiveGrossHourlyCents)}/h gross · `
                  : ''}
                {+srcHours.toFixed(2)} h across {plural(srcTimedCount, 'paycheque')}
              </p>
            </Fragment>
          ) : (
            <Fragment>
              <p className="text-sm text-muted">Pay cadence</p>
              <p className="font-medium text-[26px] leading-[1.25] tracking-[-0.02em] mt-1.5 mb-0.5 truncate">
                {srcCadence.gap ? `Every ~${srcCadence.gap} days` : srcCadence.weekday || '—'}
              </p>
              <p className="text-sm text-muted">
                {srcPs.length ? `Median deposit ${fmt(srcMedian)}` : 'No pay yet'}
              </p>
            </Fragment>
          )}
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <h2 className="text-base font-medium tracking-[-0.01em]">
              Monthly income · {source.name}
            </h2>
            <span className="text-muted">
              {srcIsAll ? 'All recorded months' : `Jan – Dec ${srcYear}`}
            </span>
          </div>
          <SourceIncomeChart
            source={source}
            srcPs={srcPs}
            srcIsAll={srcIsAll}
            srcYear={srcYear}
            srcTimeline={srcTimeline}
          />
        </article>
        <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-4">
          <article className="card">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <h2 className="text-base font-medium tracking-[-0.01em]">By year</h2>
              {!srcIsAll ? (
                <Link
                  className="link text-muted"
                  href={`/sources/${source.id}?year=all`}
                  scroll={false}
                >
                  Show all
                </Link>
              ) : null}
            </div>
            <ul className="list-none m-0 p-0">
              {srcYears.map((y) => {
                const yPs = srcAllPs.filter((p) => p.paid_on.startsWith(`${y}-`));
                const yTot = sumCents(yPs);
                const allTot = Math.max(sumCents(srcAllPs), 1);
                const pct = Math.round((yTot / allTot) * 100);
                const isSel = srcYear === y;
                return (
                  <li
                    key={y}
                    className="flex items-center gap-3 py-3 border-t border-line first:border-t-0 first:pt-0.5"
                  >
                    <Link
                      href={`/sources/${source.id}?year=${isSel ? 'all' : y}`}
                      scroll={false}
                      className={cn(
                        'flex items-center gap-3 w-[calc(100%+16px)] -my-1.5 -mx-2 py-1.5 px-2 rounded cursor-pointer no-underline text-inherit transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent',
                        isSel ? 'bg-accent-soft' : 'hover:bg-[#f2f6f7]'
                      )}
                    >
                      <span className="flex-1 min-w-0 grid">
                        <b className="font-medium">
                          {y}{' '}
                          <span className="text-sm text-muted font-normal">
                            · {plural(yPs.length, 'paycheque')}
                          </span>
                        </b>
                        <span className="block h-1.5 rounded-full bg-surface overflow-hidden mt-1.5">
                          <i
                            className="block h-full rounded-full"
                            style={{ width: `${Math.max(4, pct)}%`, background: source.color }}
                          />
                        </span>
                      </span>
                      <span className="grid justify-items-end gap-0.5 text-sm">
                        <span className="num">{fmt(yTot)}</span>
                        <span className="text-xs text-muted num">{pct}%</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="card flex-1">
            <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">Source records</h2>
            <ul className="list-none m-0 p-0">
              {srcMaxP && srcMinP ? (
                <Fragment>
                  <li className="flex items-center gap-3 py-3 border-t border-line first:border-t-0 first:pt-0.5">
                    <SourceRecordItemButton title="Biggest deposit" paycheque={srcMaxP} />
                  </li>
                  <li className="flex items-center gap-3 py-3 border-t border-line first:border-t-0 first:pt-0.5">
                    <SourceRecordItemButton title="Smallest deposit" paycheque={srcMinP} />
                  </li>
                  <li className="flex items-center gap-3 py-3 border-t border-line first:border-t-0 first:pt-0.5">
                    <span className="flex-1 min-w-0 grid">
                      <b className="font-medium">Median deposit</b>
                      <span className="text-sm text-muted">
                        Middle paycheque in {srcIsAll ? 'all years' : srcYear}
                      </span>
                    </span>
                    <span className="num">{fmt(srcMedian)}</span>
                  </li>
                </Fragment>
              ) : (
                <li className="text-muted">No paycheques recorded yet.</li>
              )}
            </ul>
          </article>
        </div>
      </div>

      <SourcePaychequeLedger
        source={source}
        srcPs={srcPs}
        srcAvg={srcAvg}
        srcIsAll={srcIsAll}
        srcYear={srcYear}
        initialSearch={searchQuery}
      />
    </section>
  );
}

