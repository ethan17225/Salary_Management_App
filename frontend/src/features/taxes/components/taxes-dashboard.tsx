'use client';

import { useMemo, type CSSProperties } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { YearDropdown, type YearOption } from '@/components/ui/year-dropdown';
import {
  computeAggregateTaxSummary,
  computePaychequeBreakdown,
} from '@/lib/tax-intelligence';
import { dateLabel, fmt, KIND_LABELS, plural } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';

interface TaxesDashboardProps {
  paycheques: Paycheque[];
  sources: Source[];
  activeYear: 'all' | number;
  yearOptions: YearOption[];
}

export function TaxesDashboard({
  paycheques,
  sources,
  activeYear,
  yearOptions,
}: TaxesDashboardProps) {
  const { openPaychequeDialog, openSourceDialog } = useDialogs();

  const sourcesById = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources]
  );

  const taxSummary = useMemo(
    () => computeAggregateTaxSummary(paycheques, sourcesById),
    [paycheques, sourcesById]
  );

  const grossBase = Math.max(taxSummary.totalEffectiveGrossCents, 1);
  const segNetPct = (taxSummary.totalTrueSpendableNetCents / grossBase) * 100;
  const segResPct = (taxSummary.totalContractorTaxReserveCents / grossBase) * 100;
  const segWithheldPct = (taxSummary.totalWithheldCents / grossBase) * 100;

  const sourceTaxRows = useMemo(() => {
    return sources
      .map((s) => {
        const ps = paycheques.filter((p) => p.source_id === s.id);
        const sum = computeAggregateTaxSummary(ps, sourcesById);
        return { source: s, count: ps.length, sum };
      })
      .filter((r) => r.count > 0 || !r.source.archived);
  }, [sources, paycheques, sourcesById]);

  const trackedPaycheques = useMemo(() => {
    return paycheques
      .map((p) => {
        const s = sourcesById.get(p.source_id);
        const b = computePaychequeBreakdown(p, s);
        return { p, s, b };
      })
      .filter((item) => item.b.hasGrossBreakdown || item.b.contractorTaxReserveCents > 0);
  }, [paycheques, sourcesById]);

  return (
    <section>
      <div className="hero" data-enter="">
        <div>
          <h1>
            {activeYear === 'all'
              ? 'True spendable net across all years'
              : `True spendable net in ${activeYear}`}
          </h1>
          <p className="big num">{fmt(taxSummary.totalTrueSpendableNetCents)}</p>
          <p className="delta">
            <b className="up">{(taxSummary.netRetentionRateBps / 100).toFixed(1)}% retained</b> ·{' '}
            {fmt(taxSummary.totalEffectiveGrossCents)} effective gross ·{' '}
            {fmt(taxSummary.totalWithheldCents)} withheld at source
            {taxSummary.totalContractorTaxReserveCents > 0
              ? ` · ${fmt(taxSummary.totalContractorTaxReserveCents)} contractor reserve`
              : ''}
          </p>
        </div>
        <div className="hero-side">
          <YearDropdown activeYear={activeYear} options={yearOptions} />
          <p className="muted">
            {taxSummary.breakdownCoverageCount} of {taxSummary.totalPaychequeCount}{' '}
            {taxSummary.totalPaychequeCount === 1 ? 'paycheque' : 'paycheques'} with paystub data
          </p>
        </div>
      </div>

      <div className="grid">
        <article className="card kpi s3">
          <p className="label">Effective Gross Income</p>
          <p className="val num">{fmt(taxSummary.totalEffectiveGrossCents)}</p>
          <p className="sub">
            {taxSummary.effectiveGrossHourlyCents
              ? `${fmt(taxSummary.effectiveGrossHourlyCents)}/h gross across timed stubs`
              : `${taxSummary.breakdownCoverageCount} of ${taxSummary.totalPaychequeCount} stubs tracked`}
          </p>
        </article>
        <article className="card kpi s3">
          <p className="label">Withheld at Source</p>
          <p className="val num">{fmt(taxSummary.totalWithheldCents)}</p>
          <p className="sub">
            Tax {fmt(taxSummary.totalExplicitTaxCents)} · Ded.{' '}
            {fmt(taxSummary.totalExplicitDeductionsCents)}
          </p>
        </article>
        <article className="card kpi s3">
          <p className="label">Net Retention Rate</p>
          <p className="val num">{(taxSummary.netRetentionRateBps / 100).toFixed(1)}%</p>
          <p className="sub">
            {taxSummary.breakdownCoverageCount
              ? `${(taxSummary.effectiveDeductionRateBps / 100).toFixed(1)}% average deduction rate`
              : '100% retained on net-only stubs'}
          </p>
        </article>
        <article className="card kpi s3">
          <p className="label">Untaxed Reserve Required</p>
          <p className="val num">
            {fmt(taxSummary.totalContractorTaxReserveCents)}{' '}
            {taxSummary.totalContractorTaxReserveCents > 0 ? (
              <span className="pill-reserve">Set aside</span>
            ) : null}
          </p>
          <p className="sub">
            From {fmt(taxSummary.totalUntaxedNetCents)} untaxed deposits
          </p>
        </article>
      </div>

      <div className="grid">
        <article className="card s12">
          <div className="card-h">
            <div>
              <h2>Gross-to-Net &amp; Tax Retention Bar</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Proportion of gross earnings kept as spendable take-home vs. contractor tax reserve
                and payroll deductions.
              </p>
            </div>
            {taxSummary.breakdownCoverageCount > 0 ? (
              <span className="tag">
                {Math.round(
                  (taxSummary.breakdownCoverageCount /
                    Math.max(taxSummary.totalPaychequeCount, 1)) *
                    100
                )}
                % stubs tracked
              </span>
            ) : null}
          </div>
          <div
            className="retention-bar-track"
            role="img"
            aria-label="Income retention breakdown"
          >
            <span
              className="retention-seg-net"
              style={{ width: `${segNetPct}%` }}
              title={`True Spendable Net: ${fmt(taxSummary.totalTrueSpendableNetCents)} (${segNetPct.toFixed(1)}%)`}
            />
            {taxSummary.totalContractorTaxReserveCents > 0 ? (
              <span
                className="retention-seg-reserve"
                style={{ width: `${segResPct}%` }}
                title={`Contractor Tax Reserve: ${fmt(taxSummary.totalContractorTaxReserveCents)} (${segResPct.toFixed(1)}%)`}
              />
            ) : null}
            {taxSummary.totalWithheldCents > 0 ? (
              <span
                className="retention-seg-withheld"
                style={{ width: `${segWithheldPct}%` }}
                title={`Withheld at Source: ${fmt(taxSummary.totalWithheldCents)} (${segWithheldPct.toFixed(1)}%)`}
              />
            ) : null}
          </div>
          <div className="chips" style={{ gap: 18, marginTop: 8 }}>
            <span className="who" style={{ fontSize: 14 }}>
              <span className="dot" style={{ '--c': '#10b981' } as CSSProperties} />
              True Spendable Net:{' '}
              <b className="num">{fmt(taxSummary.totalTrueSpendableNetCents)}</b> (
              {segNetPct.toFixed(1)}%)
            </span>
            <span className="who" style={{ fontSize: 14 }}>
              <span className="dot" style={{ '--c': '#f59e0b' } as CSSProperties} />
              Contractor Tax Reserve:{' '}
              <b className="num">{fmt(taxSummary.totalContractorTaxReserveCents)}</b> (
              {segResPct.toFixed(1)}%)
            </span>
            <span className="who" style={{ fontSize: 14 }}>
              <span className="dot" style={{ '--c': '#f43f5e' } as CSSProperties} />
              Withheld Taxes &amp; Deductions:{' '}
              <b className="num">{fmt(taxSummary.totalWithheldCents)}</b> (
              {segWithheldPct.toFixed(1)}%)
            </span>
          </div>
        </article>
      </div>

      <div className="grid">
        <article className="card table-wrap s12">
          <div className="ledger-head">
            <div>
              <h2>Tax Treatment &amp; Withholding by Source</h2>
              <p className="muted">
                Click any source to configure W-2 / T4 withholding vs. 1099 / T4A contractor tax
                reserve rates.
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Tax Treatment</th>
                <th scope="col" className="num">
                  Effective Gross
                </th>
                <th scope="col" className="num">
                  Withheld
                </th>
                <th scope="col" className="num">
                  Tax Reserve
                </th>
                <th scope="col" className="num">
                  Spendable Net
                </th>
              </tr>
            </thead>
            <tbody>
              {sourceTaxRows.map(({ source: s, count, sum }) => {
                const isUntaxed = s.is_tax_withheld === 0;
                return (
                  <tr
                    key={s.id}
                    className="row"
                    onClick={() => openSourceDialog(s)}
                  >
                    <td>
                      <span className="who">
                        <span className="dot" style={{ '--c': s.color } as CSSProperties} />
                        <b>{s.name}</b>
                        <span className="tag">{KIND_LABELS[s.kind]}</span>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {plural(count, 'cheque')}
                        </span>
                      </span>
                    </td>
                    <td>
                      {isUntaxed ? (
                        <span className="pill-reserve">
                          Untaxed · {((s.tax_reserve_bps ?? 0) / 100).toFixed(0)}% reserve
                        </span>
                      ) : (
                        <span className="tag">Withheld at source</span>
                      )}
                    </td>
                    <td className="num">{fmt(sum.totalEffectiveGrossCents)}</td>
                    <td className="num muted">
                      {sum.totalWithheldCents > 0 ? `-${fmt(sum.totalWithheldCents)}` : '—'}
                    </td>
                    <td className="num">
                      {sum.totalContractorTaxReserveCents > 0 ? (
                        <span className="pill-reserve">
                          {fmt(sum.totalContractorTaxReserveCents)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">{fmt(sum.totalTrueSpendableNetCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      </div>

      <div className="grid">
        <article className="card table-wrap s12">
          <div className="ledger-head">
            <div>
              <h2>Paystub Breakdowns &amp; Reserve Ledger</h2>
              <p className="muted">
                Paycheques with logged gross pay, tax withholdings, deductions, or contractor tax
                reserves. Click any row to edit.
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Source</th>
                <th scope="col" className="num">
                  Gross Pay
                </th>
                <th scope="col" className="num">
                  Tax Withheld
                </th>
                <th scope="col" className="num">
                  Deductions
                </th>
                <th scope="col" className="num">
                  Reserve Set-Aside
                </th>
                <th scope="col" className="num">
                  Take-Home Net
                </th>
              </tr>
            </thead>
            {trackedPaycheques.length ? (
              <tbody>
                {trackedPaycheques.map(({ p, s, b }) => (
                  <tr
                    key={p.id}
                    className="row"
                    onClick={() => openPaychequeDialog(p)}
                  >
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPaychequeDialog(p);
                        }}
                      >
                        {dateLabel(p.paid_on, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </button>
                    </td>
                    <td>
                      <span className="who">
                        <span
                          className="dot"
                          style={{ '--c': s?.color || '#94a3b8' } as CSSProperties}
                        />
                        {s?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="num">{fmt(b.effectiveGrossCents)}</td>
                    <td className="num muted">
                      {b.explicitTaxCents > 0 ? `-${fmt(b.explicitTaxCents)}` : '—'}
                    </td>
                    <td className="num muted">
                      {b.explicitDeductionsCents + b.unclassifiedWithheldCents > 0
                        ? `-${fmt(b.explicitDeductionsCents + b.unclassifiedWithheldCents)}`
                        : '—'}
                    </td>
                    <td className="num">
                      {b.contractorTaxReserveCents > 0 ? (
                        <span className="pill-reserve">
                          {fmt(b.contractorTaxReserveCents)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">
                      {fmt(b.netCents)}
                      {b.hasGrossBreakdown ? (
                        <span className="gross-subtext">
                          {(b.netRetentionBps / 100).toFixed(1)}% retained
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            ) : (
              <tbody>
                <tr>
                  <td colSpan={7} className="empty">
                    No paycheques have paystub breakdowns or contractor tax reserves in this period
                    yet. Click any paycheque and expand &ldquo;+ Add paystub breakdown&rdquo; to log
                    gross pay, taxes, and deductions.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </article>
      </div>
    </section>
  );
}

