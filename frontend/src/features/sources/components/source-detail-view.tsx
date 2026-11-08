import { Fragment, type CSSProperties } from 'react';
import Link from 'next/link';
import { YearDropdown } from '@/components/ui/year-dropdown';
import { computeAggregateTaxSummary } from '@/lib/tax-intelligence';
import { dateLabel, fmt, KIND_LABELS, plural, sumCents } from '@/lib/utils';
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
      <div className="detail-bar">
        <Link className="back-link" href="/sources">
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
          <div className="src-hero-meta">
            <span className="swatch" />
            <h1>{source.name}</h1>
            <span className="hero-tag">{KIND_LABELS[source.kind]}</span>
            {source.archived ? <span className="hero-tag">Archived</span> : null}
            {source.is_tax_withheld === 0 ? (
              <span className="pill-reserve">
                Tax Reserve: {((source.tax_reserve_bps ?? 0) / 100).toFixed(0)}% (
                {fmt(taxSum.totalContractorTaxReserveCents)} set aside)
              </span>
            ) : null}
          </div>
          <p className="big">{fmt(srcSum)}</p>
          <p className="delta">
            {srcPs.length ? (
              <Fragment>
                <b>{plural(srcPs.length, 'paycheque')}</b> · <b>{srcSharePct}%</b> of{' '}
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
        <div className="hero-side">
          <YearDropdown
            activeYear={srcYear}
            options={srcYearOptions}
            ariaLabel="Select source year"
          />
          <p className="muted">
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

      <div className="grid">
        <article className="card kpi s3">
          <p className="label">Average deposit</p>
          <p className="val num">{srcPs.length ? fmt(srcAvg) : '—'}</p>
          <p className="sub">
            {srcPs.length && srcMinP && srcMaxP
              ? `Range ${fmt(srcMinP.amount_cents)} – ${fmt(srcMaxP.amount_cents)}`
              : 'No pay yet'}
          </p>
        </article>
        <article className="card kpi s3">
          <p className="label">Monthly average</p>
          <p className="val num">{srcActiveMonths ? fmt(srcSum / srcActiveMonths) : '—'}</p>
          <p className="sub">
            {srcActiveMonths ? `across ${plural(srcActiveMonths, 'month')} with pay` : 'No pay yet'}
          </p>
        </article>
        <article className="card kpi s3">
          <p className="label">Best month</p>
          <p className="val">
            {srcBestMonth
              ? dateLabel(`${srcBestMonth[0]}-01`, { month: 'short', year: 'numeric' })
              : '—'}
          </p>
          <p className="sub">{srcBestMonth ? fmt(srcBestMonth[1]) : 'No pay yet'}</p>
        </article>
        <article className="card kpi s3">
          {srcHours > 0 ? (
            <Fragment>
              <p className="label">Take-home per hour</p>
              <p className="val num">{fmt(srcTimedSum / srcHours)}/h net</p>
              <p className="sub">
                {taxSum.effectiveGrossHourlyCents &&
                taxSum.effectiveGrossHourlyCents > Math.round(srcTimedSum / srcHours)
                  ? `${fmt(taxSum.effectiveGrossHourlyCents)}/h gross · `
                  : ''}
                {+srcHours.toFixed(2)} h across {plural(srcTimedCount, 'paycheque')}
              </p>
            </Fragment>
          ) : (
            <Fragment>
              <p className="label">Pay cadence</p>
              <p className="val">
                {srcCadence.gap ? `Every ~${srcCadence.gap} days` : srcCadence.weekday || '—'}
              </p>
              <p className="sub">{srcPs.length ? `Median deposit ${fmt(srcMedian)}` : 'No pay yet'}</p>
            </Fragment>
          )}
        </article>
      </div>

      <div className="grid">
        <article className="card s8">
          <div className="card-h">
            <h2>Monthly income · {source.name}</h2>
            <span className="muted">
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
        <div className="s4 stack">
          <article className="card">
            <div className="card-h">
              <h2>By year</h2>
              {!srcIsAll ? (
                <Link
                  className="link muted"
                  href={`/sources/${source.id}?year=all`}
                  scroll={false}
                >
                  Show all
                </Link>
              ) : null}
            </div>
            <ul className="list">
              {srcYears.map((y) => {
                const yPs = srcAllPs.filter((p) => p.paid_on.startsWith(`${y}-`));
                const yTot = sumCents(yPs);
                const allTot = Math.max(sumCents(srcAllPs), 1);
                const pct = Math.round((yTot / allTot) * 100);
                const isSel = srcYear === y;
                return (
                  <li key={y}>
                    <Link
                      href={`/sources/${source.id}?year=${isSel ? 'all' : y}`}
                      scroll={false}
                      className={isSel ? 'item active-yr' : 'item'}
                    >
                      <span className="grow">
                        <b>
                          {y} <span className="muted">· {plural(yPs.length, 'paycheque')}</span>
                        </b>
                        <span className="yr-bar">
                          <i style={{ width: `${Math.max(4, pct)}%`, background: source.color }} />
                        </span>
                      </span>
                      <span className="yr-right">
                        <span className="num">{fmt(yTot)}</span>
                        <span className="muted num">{pct}%</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="card">
            <h2>Source records</h2>
            <ul className="list">
              {srcMaxP && srcMinP ? (
                <Fragment>
                  <li>
                    <SourceRecordItemButton title="Biggest deposit" paycheque={srcMaxP} />
                  </li>
                  <li>
                    <SourceRecordItemButton title="Smallest deposit" paycheque={srcMinP} />
                  </li>
                  <li>
                    <span className="grow">
                      <b>Median deposit</b>
                      <span className="muted">
                        Middle paycheque in {srcIsAll ? 'all years' : srcYear}
                      </span>
                    </span>
                    <span className="num">{fmt(srcMedian)}</span>
                  </li>
                </Fragment>
              ) : (
                <li className="muted">No paycheques recorded yet.</li>
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

