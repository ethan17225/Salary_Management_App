import type { CSSProperties } from 'react';
import Link from 'next/link';
import { YearDropdown } from '@/components/ui/year-dropdown';
import { dateLabel, diffDays, fmt, monthLabel, plural, sumCents } from '@/lib/utils';
import { GoalDialogTrigger } from './goal-dialog';
import { HeroTotalCounter } from './hero-total-counter';
import { LatestPaychequesList } from './latest-paycheques-list';
import {
  CumulativeIncomeChart,
  MonthlyIncomeChart,
  SourceSplitChart,
} from './overview-charts';
import type { OverviewData } from '../types/overview-types';

export function OverviewDashboard({ data }: { data: OverviewData }) {
  const {
    sources,
    paycheques,
    today,
    activeYear,
    isAll,
    isCur,
    inY,
    sumY,
    bySrcEntries,
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
  } = data;

  const srcById = (id: number) =>
    sources.find((s) => s.id === id) || { name: 'Unknown', color: '#94a3b8' };

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
                <b className={prevPct >= 0 ? 'font-medium text-[#6fe0b0]' : 'font-medium text-[#ffb4ab]'}>
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Monthly average</p>
          <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
            {activeMonths ? fmt(sumY / activeMonths) : '—'}
          </p>
          <p className="text-sm text-muted">
            {activeMonths ? `across ${plural(activeMonths, 'month')} with pay` : 'No pay yet'}
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
          <p className="text-sm text-muted">{bestPeriodMonth ? fmt(bestPeriodMonth[1]) : 'No pay yet'}</p>
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
                  Set a take-home number for the year. Payday tracks your pace and tells you what
                  each month needs to bring in.
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
                      <p>
                        On pace for <b className="num font-medium">{fmt((goalSum / daysDone) * daysInYr)}</b> by
                        Dec 31.
                      </p>
                      {goalLeft <= 0 ? (
                        <p className="text-muted">
                          Goal reached with {plural(daysInYr - daysDone, 'day')} to spare.
                        </p>
                      ) : monthsLeft > 0 ? (
                        <p className="text-muted">{fmt(goalLeft / monthsLeft)} a month from here hits it.</p>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
            </div>
          </article>

          <article className="card flex-1">
            <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">Next paydays</h2>
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
                        <b className="font-medium">{u.source.name}</b>
                        <span className="text-sm text-muted">
                          {dateLabel(u.next, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          · {when} · every {u.gap} days
                        </span>
                      </span>
                      <span className="num">≈ {fmt(u.amount)}</span>
                    </li>
                  );
                })
              ) : (
                <li className="text-muted">
                  Log three paycheques from a source and Payday learns its schedule.
                </li>
              )}
            </ul>
          </article>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-12 lg:col-span-5">
          <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">
            {isAll ? 'Cumulative income' : `${activeYear} against ${(activeYear as number) - 1}`}
          </h2>
          <CumulativeIncomeChart
            paycheques={paycheques}
            inY={inY}
            isAll={isAll}
            isCur={isCur}
            activeYear={activeYear}
            timelineMonths={timelineMonths}
            today={today}
          />
        </article>
        <article className="card md:col-span-6 lg:col-span-3">
          <h2 className="text-base font-medium tracking-[-0.01em] mb-3.5">Where it came from</h2>
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
                    {dateLabel(paycheques.at(-1)!.paid_on, { month: 'long', year: 'numeric' })}
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
    </section>
  );
}

