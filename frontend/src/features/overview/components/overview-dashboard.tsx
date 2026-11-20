'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { YearDropdown } from '@/components/ui/year-dropdown';
import { AddSourceButton } from '@/features/sources/components/source-detail-actions';
import { dateLabel, fmt, monthLabel, plural, sumCents } from '@/lib/utils';
import { computeOverviewYearSlice } from '../lib/compute-overview';
import { GoalDialogTrigger } from './goal-dialog';
import { HeroTotalCounter } from './hero-total-counter';
import { LatestPaychequesList } from './latest-paycheques-list';
import {
  CumulativeIncomeChart,
  MonthlyIncomeChart,
  SourceSplitChart,
} from './overview-charts';
import { UpcomingPaydaysList } from './upcoming-paydays-list';
import type { OverviewData } from '../types/overview-types';

export function OverviewDashboard({ data }: { data: OverviewData }) {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get('year') ?? undefined;
  const {
    sources,
    paycheques,
    today,
    timelineMonths,
    thisMonthTotal,
    goal,
    bestEver,
    biggest,
    upcoming,
  } = data;

  const {
    activeYear,
    isAll,
    isCur,
    inY,
    sumY,
    bySrcEntries,
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
  } = useMemo(
    () => computeOverviewYearSlice(paycheques, goal, yearParam, today),
    [paycheques, goal, yearParam, today]
  );

  const srcById = (id: number) =>
    sources.find((s) => s.id === id) || { name: 'Unknown', color: '#94a3b8' };

  const expectedToDateCents = Math.round((goal * daysDone) / Math.max(daysInYr, 1));
  const paceDeltaCents = goalSum - expectedToDateCents;

  return (
    <section>
      <div className="hero animate-enter">
        <div>
          <h1 className="text-[15px] font-medium text-[#b9c8ce]">
            {isAll
              ? 'Earned across all years'
              : isCur
                ? `Earned so far in ${activeYear}`
                : `Earned in ${activeYear}`}
          </h1>
          <HeroTotalCounter totalCents={sumY} />
          <p className="text-[#b9c8ce] text-[15px]">
            {isAll ? (
              inY.length ? (
                `${plural(inY.length, 'paycheque')} across ${plural(
                  bySrcEntries.length,
                  'source'
                )} since ${dateLabel(inY.at(-1)!.paid_on, { month: 'short', year: 'numeric' })}`
              ) : (
                'No paycheques recorded yet.'
              )
            ) : prevPct !== null ? (
              <>
                <b
                  className={
                    prevPct >= 0 ? 'font-medium text-[#6fe0b0]' : 'font-medium text-[#ffb4ab]'
                  }
                >
                  {prevPct >= 0 ? '▲' : '▼'} {Math.abs(prevPct).toFixed(0)}%
                </b>{' '}
                against {fmt(prevTotal)} {isCur ? 'by this date in' : 'in'}{' '}
                {(activeYear as number) - 1}
              </>
            ) : (
              `Nothing recorded in ${(activeYear as number) - 1} to compare with.`
            )}
          </p>
        </div>
        <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-4 w-full md:w-auto flex-wrap">
          <YearDropdown activeYear={activeYear} options={yearOptions} />
          <p className="text-sm text-[#b9c8ce]">
            {isAll
              ? paidYearCount
                ? `${plural(paidYearCount, 'year')} · ${fmt(sumY / paidYearCount)} / yr avg`
                : '0 paycheques'
              : isCur
                ? `${fmt(thisMonthTotal)} so far this month`
                : plural(inY.length, 'paycheque')}
          </p>
        </div>
      </div>

      {paycheques.length === 0 ? (
        <article className="card mt-4 grid gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-[-0.01em]">Get started in 3 steps</h2>
            <p className="text-sm text-muted mt-0.5">
              Set up your first employer or payer, log or import your paycheques, and track your
              yearly goal.
            </p>
          </div>
          <ol className="list-none m-0 p-0 grid gap-3">
            <li className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-bg border border-line">
              <div>
                <p className="font-medium">
                  1. Add an income source{' '}
                  {sources.length > 0 ? (
                    <span className="text-up text-sm ml-1">
                      ✓ {plural(sources.length, 'source')} added
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">
                  Name an employer, freelance client, or government benefit.
                </p>
              </div>
              {sources.length === 0 ? (
                <AddSourceButton />
              ) : (
                <Link className="btn" href="/sources">
                  Manage sources
                </Link>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-bg border border-line">
              <div>
                <p className="font-medium">2. Log your first paycheque</p>
                <p className="text-sm text-muted">
                  Enter a single deposit, or import a spreadsheet, paystub PDF, or photo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a className={sources.length > 0 ? 'btn primary' : 'btn'} href="#add">
                  Add paycheque
                </a>
                <Link className="btn" href="/paycheques">
                  Import paycheques
                </Link>
              </div>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-bg border border-line">
              <div>
                <p className="font-medium">3. Set a yearly goal or allocation plan</p>
                <p className="text-sm text-muted">
                  Track annual pacing and split every deposit into savings and bills.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GoalDialogTrigger currentGoalCents={goal} />
                <Link className="btn" href="/allocations">
                  Allocation rules
                </Link>
              </div>
            </li>
          </ol>
        </article>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
            <article className="card md:col-span-6 lg:col-span-3">
              <p className="text-sm text-muted">Monthly average</p>
              <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
                {activeMonths ? fmt(sumY / activeMonths) : '—'}
              </p>
              <p className="text-sm text-muted">
                {activeMonths
                  ? `across ${plural(activeMonths, 'month')} with pay`
                  : 'No pay yet'}
              </p>
            </article>
            <article className="card md:col-span-6 lg:col-span-3">
              <p className="text-sm text-muted">Best month</p>
              <p className="font-medium text-[26px] leading-[1.25] tracking-[-0.02em] mt-1.5 mb-0.5 truncate">
                {bestPeriodMonth
                  ? dateLabel(
                      `${bestPeriodMonth[0]}-01`,
                      isAll ? { month: 'short', year: 'numeric' } : { month: 'long' }
                    )
                  : '—'}
              </p>
              <p className="text-sm text-muted">
                {bestPeriodMonth ? fmt(bestPeriodMonth[1]) : 'No pay yet'}
              </p>
            </article>
            <article className="card md:col-span-6 lg:col-span-3">
              <p className="text-sm text-muted">Paycheques</p>
              <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
                {inY.length}
              </p>
              <p className="text-sm text-muted">
                {inY.length ? `${fmt(sumY / inY.length)} each on average` : 'None yet'}
              </p>
            </article>
            <article className="card md:col-span-6 lg:col-span-3">
              <p className="text-sm text-muted">Top source</p>
              <p className="font-medium text-[26px] leading-[1.25] tracking-[-0.02em] mt-1.5 mb-0.5 truncate">
                {topSrc ? srcById(topSrc[0]).name : '—'}
              </p>
              <p className="text-sm text-muted">
                {topSrc
                  ? `${Math.round((topSrc[1] / sumY) * 100)}% of ${
                      isAll ? 'total' : activeYear
                    } income`
                  : 'None yet'}
              </p>
            </article>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
            <article className="card md:col-span-12 lg:col-span-8">
              <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">
                Monthly income by source
              </h2>
              <MonthlyIncomeChart
                sources={sources}
                inY={inY}
                bySrcEntries={bySrcEntries}
                isAll={isAll}
                activeYear={activeYear}
                timelineMonths={timelineMonths}
                goal={goal}
              />
            </article>
            <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-4">
              <article className="card">
                <div className="flex items-center justify-between gap-3 mb-3.5">
                  <h2 className="text-base font-medium tracking-[-0.01em]">Yearly goal</h2>
                  <GoalDialogTrigger currentGoalCents={goal} />
                </div>
                <div className="flex flex-col gap-1">
                  {!goal ? (
                    <p className="text-muted">
                      Set a take-home number for the year. Payday tracks your pace and tells you
                      what each month needs to bring in.
                    </p>
                  ) : (
                    <>
                      <p className="text-[15px]">
                        <span className="num text-[22px]">{fmt(goalSum)}</span>{' '}
                        <span className="text-muted">
                          of <span className="num">{fmt(goal)}</span>
                        </span>
                      </p>
                      <progress
                        max={100}
                        value={goalPct}
                        aria-label={`Progress toward the ${goalYear} goal`}
                      >
                        {goalPct.toFixed(0)}%
                      </progress>
                      <p className="text-muted">
                        {goalPct.toFixed(0)}% of the {goalYear} goal
                      </p>
                      {goalIsCur ? (
                        <>
                          <p className="text-sm">
                            <span
                              className={
                                paceDeltaCents >= 0
                                  ? 'font-medium text-up'
                                  : 'font-medium text-warn'
                              }
                            >
                              {paceDeltaCents >= 0 ? '▲' : '▼'}{' '}
                              {fmt(Math.abs(paceDeltaCents))}{' '}
                              {paceDeltaCents >= 0 ? 'ahead of pace' : 'behind pace'}
                            </span>
                          </p>
                          <p>
                            On pace for{' '}
                            <b className="num font-medium">
                              {fmt((goalSum / daysDone) * daysInYr)}
                            </b>{' '}
                            by Dec 31.
                          </p>
                          {goalLeft <= 0 ? (
                            <p className="text-muted">
                              Goal reached with {plural(daysInYr - daysDone, 'day')} to spare.
                            </p>
                          ) : monthsLeft > 0 ? (
                            <p className="text-muted">
                              {fmt(goalLeft / monthsLeft)} a month from here hits it.
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </article>

              <article className="card flex-1">
                <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">Next paydays</h2>
                <UpcomingPaydaysList upcoming={upcoming} today={today} />
              </article>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
            <article className="card md:col-span-12 lg:col-span-5">
              <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">
                {isAll
                  ? 'Cumulative income'
                  : `${activeYear} against ${(activeYear as number) - 1}`}
              </h2>
              <CumulativeIncomeChart
                paycheques={paycheques}
                inY={inY}
                isAll={isAll}
                isCur={isCur}
                activeYear={activeYear}
                timelineMonths={timelineMonths}
                today={today}
                goal={goal}
              />
            </article>
            <article className="card md:col-span-6 lg:col-span-3">
              <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">
                Where it came from
              </h2>
              <SourceSplitChart sources={sources} bySrcEntries={bySrcEntries} sumY={sumY} />
            </article>
            <article className="card md:col-span-6 lg:col-span-4">
              <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">Records</h2>
              <dl className="grid grid-cols-2 gap-y-3.5 gap-x-4">
                {paycheques.length && bestEver && biggest ? (
                  <>
                    <div>
                      <dt className="text-[13px] text-muted">All time</dt>
                      <dd className="num text-base">{fmt(sumCents(paycheques))}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted">Tracking since</dt>
                      <dd className="text-base">
                        {dateLabel(paycheques.at(-1)!.paid_on, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted">Best month ever</dt>
                      <dd className="text-base">
                        {monthLabel(bestEver[0])}
                        <br />
                        <span className="num">{fmt(bestEver[1])}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted">Biggest deposit</dt>
                      <dd className="text-base">
                        {srcById(biggest.source_id).name}
                        <br />
                        <span className="num">{fmt(biggest.amount_cents)}</span>
                      </dd>
                    </div>
                  </>
                ) : (
                  <div className="text-muted col-span-2">No paycheques yet.</div>
                )}
              </dl>
            </article>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
            <article className="card md:col-span-12">
              <div className="flex items-center justify-between gap-3 mb-3.5">
                <h2 className="text-base font-medium tracking-[-0.01em]">Latest paycheques</h2>
                <Link className="btn" href="/paycheques">
                  See all paycheques
                </Link>
              </div>
              <LatestPaychequesList paycheques={paycheques.slice(0, 5)} sources={sources} />
            </article>
          </div>
        </>
      )}
    </section>
  );
}
