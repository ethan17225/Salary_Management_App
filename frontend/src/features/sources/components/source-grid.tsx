import { Fragment } from 'react';
import { computeAggregateTaxSummary } from '@/lib/tax-intelligence';
import { dateLabel, fmt, KIND_LABELS, MONTHS } from '@/lib/utils';
import { SourceCardShell } from './source-card';
import { AddSourceButton } from './source-detail-actions';
import type { SourceCardSummary } from '../types/source-types';

export function SourceGrid({ summaries }: { summaries: SourceCardSummary[] }) {
  return (
    <section>
      <div className="head">
        <div>
          <p className="eyebrow">Sources</p>
          <h1>Jobs and other income</h1>
        </div>
        <AddSourceButton />
      </div>
      <div className="grid">
        {summaries.length ? (
          summaries.map(({ source: s, paycheques: ps, totalCents, timedHours, timedCents, spark }) => {
            const taxSum = computeAggregateTaxSummary(ps, new Map([[s.id, s]]));
            return (
              <SourceCardShell key={s.id} source={s}>
                <div className="src-head">
                  <span className="swatch" />
                  <h2>{s.name}</h2>
                  <span className="tag">{KIND_LABELS[s.kind]}</span>
                  {s.archived ? <span className="tag">Archived</span> : null}
                  {s.is_tax_withheld === 0 ? (
                    <span className="pill-reserve">
                      Tax Reserve: {((s.tax_reserve_bps ?? 0) / 100).toFixed(0)}% (
                      {fmt(taxSum.totalContractorTaxReserveCents)} set aside)
                    </span>
                  ) : null}
                </div>
                <div className="spark-wrap">
                  <div className="spark-head">
                    <span>Last 12 months</span>
                    <span className="num">{spark.yrs.map((g) => g.y).join(' – ')}</span>
                  </div>
                  <div
                    className="spark-grid"
                    role="img"
                    aria-label={`Last 12 months income for ${s.name}`}
                  >
                    {spark.items.map((it) => (
                      <div
                        key={it.k}
                        className="spark-col"
                        data-tip={fmt(it.v)}
                        aria-label={`${MONTHS[it.m - 1]} ${it.y}: ${fmt(it.v)}`}
                      >
                        <div className="spark-track">
                          <span
                            className={it.v ? 'spark-bar' : 'spark-bar z'}
                            style={{
                              height: it.v ? `${Math.max(8, (it.v / spark.max) * 100)}%` : '3px',
                            }}
                          />
                        </div>
                        <span className="spark-m num">{it.m}</span>
                      </div>
                    ))}
                  </div>
                  <div className="spark-yrs num" aria-hidden="true">
                    {spark.yrs.map((g) => (
                      <span key={g.y} style={{ gridColumn: `span ${g.span}` }}>
                        {g.y}
                      </span>
                    ))}
                  </div>
                </div>
                <dl className="stats">
                  <div>
                    <dt>All time</dt>
                    <dd className="num">{fmt(totalCents)}</dd>
                  </div>
                  <div>
                    <dt>Paycheques</dt>
                    <dd className="num">{ps.length}</dd>
                  </div>
                  <div>
                    <dt>Average deposit</dt>
                    <dd className="num">{ps.length ? fmt(totalCents / ps.length) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Last paid</dt>
                    <dd>{ps.length ? dateLabel(ps[0].paid_on) : '—'}</dd>
                  </div>
                  {timedHours ? (
                    <Fragment>
                      <div>
                        <dt>Take-home per hour</dt>
                        <dd className="num">
                          {fmt(timedCents / timedHours)}/h net
                          {taxSum.effectiveGrossHourlyCents &&
                          taxSum.effectiveGrossHourlyCents > Math.round(timedCents / timedHours) ? (
                            <span className="gross-subtext">
                              {fmt(taxSum.effectiveGrossHourlyCents)}/h gross
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt>Hours logged</dt>
                        <dd className="num">{+timedHours.toFixed(2)}</dd>
                      </div>
                    </Fragment>
                  ) : null}
                </dl>
              </SourceCardShell>
            );
          })
        ) : (
          <p className="muted s12">No sources yet. Add your first job.</p>
        )}
      </div>
    </section>
  );
}

