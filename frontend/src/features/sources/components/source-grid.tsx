import { Fragment } from 'react';
import { computeAggregateTaxSummary } from '@/lib/tax-intelligence';
import { cn, dateLabel, fmt, KIND_LABELS, MONTHS } from '@/lib/utils';
import { SourceCardShell } from './source-card';
import { AddSourceButton } from './source-detail-actions';
import type { SourceCardSummary } from '../types/source-types';

export function SourceGrid({ summaries }: { summaries: SourceCardSummary[] }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <p className="text-sm font-medium text-muted">Sources</p>
          <h1 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium tracking-[-0.03em] leading-[1.15]">
            Jobs and other income
          </h1>
        </div>
        <AddSourceButton />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        {summaries.length ? (
          summaries.map(({ source: s, paycheques: ps, totalCents, timedHours, timedCents, spark }) => {
            const taxSum = computeAggregateTaxSummary(ps, new Map([[s.id, s]]));
            return (
              <SourceCardShell key={s.id} source={s}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="size-3.5 rounded-[4px] bg-(--c) shrink-0" />
                  <h2 className="text-xl font-medium tracking-[-0.02em] mr-auto">{s.name}</h2>
                  <span className="text-xs font-medium py-[3px] px-[9px] rounded-full bg-surface text-muted">
                    {KIND_LABELS[s.kind]}
                  </span>
                  {s.archived ? (
                    <span className="text-xs font-medium py-[3px] px-[9px] rounded-full bg-surface text-muted">
                      Archived
                    </span>
                  ) : null}
                  {s.is_tax_withheld === 0 ? (
                    <span className="pill-reserve">
                      Tax Reserve: {((s.tax_reserve_bps ?? 0) / 100).toFixed(0)}% (
                      {fmt(taxSum.totalContractorTaxReserveCents)} set aside)
                    </span>
                  ) : null}
                </div>
                <div>
                  <div className="flex justify-between text-[13px] text-muted mb-2">
                    <span>Last 12 months</span>
                    <span className="num">{spark.yrs.map((g) => g.y).join(' – ')}</span>
                  </div>
                  <div
                    className="grid grid-cols-12 gap-x-1"
                    role="img"
                    aria-label={`Last 12 months income for ${s.name}`}
                  >
                    {spark.items.map((it) => (
                      <div
                        key={it.k}
                        className="spark-col group/col relative grid gap-[5px] justify-items-center"
                        data-tip={fmt(it.v)}
                        aria-label={`${MONTHS[it.m - 1]} ${it.y}: ${fmt(it.v)}`}
                      >
                        <div className="w-full h-12 flex items-end rounded-[3px] transition-colors duration-120 group-hover/col:bg-ink/5">
                          <span
                            className={cn(
                              'w-full rounded-[3px] block',
                              it.v ? 'bg-(--c)' : 'bg-line'
                            )}
                            style={{
                              height: it.v ? `${Math.max(8, (it.v / spark.max) * 100)}%` : '3px',
                            }}
                          />
                        </div>
                        <span className="num text-[11px] leading-none text-muted group-hover/col:text-ink group-hover/col:font-medium">
                          {it.m}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="num grid grid-cols-12 gap-x-1 mt-[5px] text-[11px] leading-[1.2] text-muted"
                    aria-hidden="true"
                  >
                    {spark.yrs.map((g) => (
                      <span
                        key={g.y}
                        className="border-t border-line pt-1 text-center"
                        style={{ gridColumn: `span ${g.span}` }}
                      >
                        {g.y}
                      </span>
                    ))}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-y-3.5 gap-x-4">
                  <div>
                    <dt className="text-[13px] text-muted">All time</dt>
                    <dd className="num text-base">{fmt(totalCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">Paycheques</dt>
                    <dd className="num text-base">{ps.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">Average deposit</dt>
                    <dd className="num text-base">{ps.length ? fmt(totalCents / ps.length) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">Last paid</dt>
                    <dd className="text-base">{ps.length ? dateLabel(ps[0].paid_on) : '—'}</dd>
                  </div>
                  {timedHours ? (
                    <Fragment>
                      <div>
                        <dt className="text-[13px] text-muted">Take-home per hour</dt>
                        <dd className="num text-base">
                          {fmt(timedCents / timedHours)}/h net
                          {taxSum.effectiveGrossHourlyCents &&
                          taxSum.effectiveGrossHourlyCents > Math.round(timedCents / timedHours) ? (
                            <span className="block text-xs text-muted font-mono mt-0.5">
                              {fmt(taxSum.effectiveGrossHourlyCents)}/h gross
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[13px] text-muted">Hours logged</dt>
                        <dd className="num text-base">{+timedHours.toFixed(2)}</dd>
                      </div>
                    </Fragment>
                  ) : null}
                </dl>
              </SourceCardShell>
            );
          })
        ) : (
          <p className="text-muted md:col-span-12">No sources yet. Add your first job.</p>
        )}
      </div>
    </section>
  );
}

