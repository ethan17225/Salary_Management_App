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
      <div className="hero" data-enter="">
        <div>
          <h1>
            {isAll
              ? 'Earned across all years'
              : isCur
                ? `Earned so far in ${activeYear}`
                : `Earned in ${activeYear}`}
          </h1>
          <HeroTotalCounter totalCents={sumY} />
          <p className="delta">
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
                <b className={prevPct >= 0 ? 'up' : 'down'}>
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
        <div className="hero-side">
          <YearDropdown activeYear={activeYear} options={yearOptions} />
          <p className="muted">
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

      <div className="grid">
        <article className="card kpi s3">
          <p className="label">Monthly average</p>
          <p className="val num">{activeMonths ? fmt(sumY / activeMonths) : '—'}</p>
          <p className="sub">
            {activeMonths ? `across ${plural(activeMonths, 'month')} with pay` : 'No pay yet'}
          </p>
        </article>
        <article className="card kpi s3">
          <p className="label">Best month</p>
          <p className="val">
            {bestPeriodMonth
              ? dateLabel(
                  `${bestPeriodMonth[0]}-01`,
                  isAll ? { month: 'short', year: 'numeric' } : { month: 'long' }
                )
              : '—'}
          </p>
          <p className="sub">{bestPeriodMonth ? fmt(bestPeriodMonth[1]) : 'No pay yet'}</p>
        </article>
        <article className="card kpi s3">
          <p className="label">Paycheques</p>
          <p className="val num">{inY.length}</p>
          <p className="sub">
            {inY.length ? `${fmt(sumY / inY.length)} each on average` : 'None yet'}
          </p>
        </article>
        <article className="card kpi s3">
          <p className="label">Top source</p>
          <p className="val">{topSrc ? srcById(topSrc[0]).name : '—'}</p>
          <p className="sub">
            {topSrc
              ? `${Math.round((topSrc[1] / sumY) * 100)}% of ${
                  isAll ? 'total' : activeYear
                } income`
              : 'None yet'}
          </p>
        </article>
      </div>

      <div className="grid">
        <article className="card s8">
          <h2>Monthly income by source</h2>
          <MonthlyIncomeChart
            sources={sources}
            inY={inY}
            bySrcEntries={bySrcEntries}
            isAll={isAll}
            activeYear={activeYear}
            timelineMonths={timelineMonths}
          />
        </article>
        <div className="s4 stack">
          <article className="card">
            <div className="card-h">
              <h2>Yearly goal</h2>
              <GoalDialogTrigger currentGoalCents={goal} />
            </div>
            <div className="goal-body">
              {!goal ? (
                <p className="muted">
                  Set a take-home number for the year. Payday tracks your pace and tells you what
                  each month needs to bring in.
                </p>
              ) : (
                <>
                  <p className="goal-num">
                    <span className="num">{fmt(goalSum)}</span>{' '}
                    <span className="muted">
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
                  <p className="muted">
                    {goalPct.toFixed(0)}% of the {goalYear} goal
                  </p>
                  {goalIsCur ? (
                    <>
                      <p>
                        On pace for <b className="num">{fmt((goalSum / daysDone) * daysInYr)}</b> by
                        Dec 31.
                      </p>
                      {goalLeft <= 0 ? (
                        <p className="muted">
                          Goal reached with {plural(daysInYr - daysDone, 'day')} to spare.
                        </p>
                      ) : monthsLeft > 0 ? (
                        <p className="muted">{fmt(goalLeft / monthsLeft)} a month from here hits it.</p>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
            </div>
          </article>

          <article className="card">
            <h2>Next paydays</h2>
            <ul className="list">
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
                    <li key={u.source.id}>
                      <span
                        className="dot"
                        style={{ '--c': u.source.color } as CSSProperties}
                      />
                      <span className="grow">
                        <b>{u.source.name}</b>
                        <span className="muted">
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
                <li className="muted">
                  Log three paycheques from a source and Payday learns its schedule.
                </li>
              )}
            </ul>
          </article>
        </div>
      </div>

      <div className="grid">
        <article className="card s5">
          <h2>{isAll ? 'Cumulative income' : `${activeYear} against ${(activeYear as number) - 1}`}</h2>
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
        <article className="card s3">
          <h2>Where it came from</h2>
          <SourceSplitChart sources={sources} bySrcEntries={bySrcEntries} sumY={sumY} />
        </article>
        <article className="card s4">
          <h2>Records</h2>
          <dl className="stats">
            {paycheques.length && bestEver && biggest ? (
              <>
                <div>
                  <dt>All time</dt>
                  <dd className="num">{fmt(sumCents(paycheques))}</dd>
                </div>
                <div>
                  <dt>Tracking since</dt>
                  <dd>{dateLabel(paycheques.at(-1)!.paid_on, { month: 'long', year: 'numeric' })}</dd>
                </div>
                <div>
                  <dt>Best month ever</dt>
                  <dd>
                    {monthLabel(bestEver[0])}
                    <br />
                    <span className="num">{fmt(bestEver[1])}</span>
                  </dd>
                </div>
                <div>
                  <dt>Biggest deposit</dt>
                  <dd>
                    {srcById(biggest.source_id).name}
                    <br />
                    <span className="num">{fmt(biggest.amount_cents)}</span>
                  </dd>
                </div>
              </>
            ) : (
              <div className="muted">No paycheques yet.</div>
            )}
          </dl>
        </article>
      </div>

      <div className="grid">
        <article className="card s12">
          <div className="card-h">
            <h2>Latest paycheques</h2>
            <Link className="btn" href="/paycheques">
              See all paycheques
            </Link>
          </div>
          <LatestPaychequesList paycheques={paycheques} sources={sources} />
        </article>
      </div>
    </section>
  );
}

