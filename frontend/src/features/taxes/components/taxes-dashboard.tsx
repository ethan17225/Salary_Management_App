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
      <div className="hero animate-enter">
        <div>
          <h1 className="text-[15px] font-medium text-[#b9c8ce]">
            {activeYear === 'all'
              ? 'True spendable net across all years'
              : `True spendable net in ${activeYear}`}
          </h1>
          <p className="num text-[clamp(2.75rem,7vw,5.25rem)] leading-[1.05] tracking-[-0.04em] mt-1.5 mb-2.5">
            {fmt(taxSummary.totalTrueSpendableNetCents)}
          </p>
          <p className="text-[#b9c8ce] text-[15px]">
            <b className="font-medium text-[#6fe0b0]">
              {(taxSummary.netRetentionRateBps / 100).toFixed(1)}% retained
            </b>{' '}
            · {fmt(taxSummary.totalEffectiveGrossCents)} effective gross ·{' '}
            {fmt(taxSummary.totalWithheldCents)} withheld at source
            {taxSummary.totalContractorTaxReserveCents > 0
              ? ` · ${fmt(taxSummary.totalContractorTaxReserveCents)} contractor reserve`
              : ''}
          </p>
        </div>
        <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-4 w-full md:w-auto flex-wrap">
          <YearDropdown activeYear={activeYear} options={yearOptions} />
          <p className="text-sm text-[#b9c8ce]">
            {taxSummary.breakdownCoverageCount} of {taxSummary.totalPaychequeCount}{' '}
            {taxSummary.totalPaychequeCount === 1 ? 'paycheque' : 'paycheques'} with paystub data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Effective Gross Income</p>
          <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
            {fmt(taxSummary.totalEffectiveGrossCents)}
          </p>
          <p className="text-sm text-muted">
            {taxSummary.effectiveGrossHourlyCents
              ? `${fmt(taxSummary.effectiveGrossHourlyCents)}/h gross across timed stubs`
              : `${taxSummary.breakdownCoverageCount} of ${taxSummary.totalPaychequeCount} stubs tracked`}
          </p>
        </article>
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Withheld at Source</p>
          <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
            {fmt(taxSummary.totalWithheldCents)}
          </p>
          <p className="text-sm text-muted">
            Tax {fmt(taxSummary.totalExplicitTaxCents)} · Ded.{' '}
            {fmt(taxSummary.totalExplicitDeductionsCents)}
          </p>
        </article>
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Net Retention Rate</p>
          <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
            {(taxSummary.netRetentionRateBps / 100).toFixed(1)}%
          </p>
          <p className="text-sm text-muted">
            {taxSummary.breakdownCoverageCount
              ? `${(taxSummary.effectiveDeductionRateBps / 100).toFixed(1)}% average deduction rate`
              : '100% retained on net-only stubs'}
          </p>
        </article>
        <article className="card md:col-span-6 lg:col-span-3">
          <p className="text-sm text-muted">Untaxed Reserve Required</p>
          <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
            {fmt(taxSummary.totalContractorTaxReserveCents)}{' '}
            {taxSummary.totalContractorTaxReserveCents > 0 ? (
              <span className="pill-reserve">Set aside</span>
            ) : null}
          </p>
          <p className="text-sm text-muted">
            From {fmt(taxSummary.totalUntaxedNetCents)} untaxed deposits
          </p>
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-12">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div>
              <h2 className="text-base font-medium tracking-[-0.01em]">
                Gross-to-Net &amp; Tax Retention Bar
              </h2>
              <p className="text-sm text-muted">
                Proportion of gross earnings kept as spendable take-home vs. contractor tax reserve
                and payroll deductions.
              </p>
            </div>
            {taxSummary.breakdownCoverageCount > 0 ? (
              <span className="text-xs font-medium py-[3px] px-[9px] rounded-full bg-surface text-muted">
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
            className="w-full h-2.5 rounded-full bg-surface overflow-hidden flex my-3"
            role="img"
            aria-label="Income retention breakdown"
          >
            <span
              className="bg-up h-full"
              style={{ width: `${segNetPct}%` }}
              title={`True Spendable Net: ${fmt(taxSummary.totalTrueSpendableNetCents)} (${segNetPct.toFixed(1)}%)`}
            />
            {taxSummary.totalContractorTaxReserveCents > 0 ? (
              <span
                className="bg-[#d97706] h-full"
                style={{ width: `${segResPct}%` }}
                title={`Contractor Tax Reserve: ${fmt(taxSummary.totalContractorTaxReserveCents)} (${segResPct.toFixed(1)}%)`}
              />
            ) : null}
            {taxSummary.totalWithheldCents > 0 ? (
              <span
                className="bg-down h-full"
                style={{ width: `${segWithheldPct}%` }}
                title={`Withheld at Source: ${fmt(taxSummary.totalWithheldCents)} (${segWithheldPct.toFixed(1)}%)`}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-[18px] mt-2">
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
              <span className="size-2.5 rounded-full bg-[#10b981] shrink-0 inline-block" />
              True Spendable Net:{' '}
              <b className="num font-medium">{fmt(taxSummary.totalTrueSpendableNetCents)}</b> (
              {segNetPct.toFixed(1)}%)
            </span>
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
              <span className="size-2.5 rounded-full bg-[#f59e0b] shrink-0 inline-block" />
              Contractor Tax Reserve:{' '}
              <b className="num font-medium">{fmt(taxSummary.totalContractorTaxReserveCents)}</b> (
              {segResPct.toFixed(1)}%)
            </span>
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
              <span className="size-2.5 rounded-full bg-[#f43f5e] shrink-0 inline-block" />
              Withheld Taxes &amp; Deductions:{' '}
              <b className="num font-medium">{fmt(taxSummary.totalWithheldCents)}</b> (
              {segWithheldPct.toFixed(1)}%)
            </span>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card overflow-x-auto p-0 md:col-span-12">
          <div className="flex items-center justify-between gap-4 flex-wrap pt-5 px-[22px] pb-4 border-b border-line">
            <div>
              <h2 className="text-[17px] font-medium tracking-[-0.01em]">
                Tax Treatment &amp; Withholding by Source
              </h2>
              <p className="text-sm text-muted mt-0.5">
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
                <th scope="col" className="num text-right">
                  Effective Gross
                </th>
                <th scope="col" className="num text-right">
                  Withheld
                </th>
                <th scope="col" className="num text-right">
                  Tax Reserve
                </th>
                <th scope="col" className="num text-right">
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
                    className="cursor-pointer transition-colors duration-120 hover:bg-[#f4f8f9]"
                    onClick={() => openSourceDialog(s)}
                  >
                    <td>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span
                          className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
                          style={{ '--c': s.color } as CSSProperties}
                        />
                        <button
                          type="button"
                          className="link"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSourceDialog(s);
                          }}
                        >
                          <b className="font-medium">{s.name}</b>
                        </button>
                        <span className="text-xs font-medium py-[3px] px-[9px] rounded-full bg-surface text-muted">
                          {KIND_LABELS[s.kind]}
                        </span>
                        <span className="text-[13px] text-muted">
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
                        <span className="text-xs font-medium py-[3px] px-[9px] rounded-full bg-surface text-muted">
                          Withheld at source
                        </span>
                      )}
                    </td>
                    <td className="num text-right">{fmt(sum.totalEffectiveGrossCents)}</td>
                    <td className="num text-right text-muted">
                      {sum.totalWithheldCents > 0 ? `-${fmt(sum.totalWithheldCents)}` : '—'}
                    </td>
                    <td className="num text-right">
                      {sum.totalContractorTaxReserveCents > 0 ? (
                        <span className="pill-reserve">
                          {fmt(sum.totalContractorTaxReserveCents)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num text-right">{fmt(sum.totalTrueSpendableNetCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card overflow-x-auto p-0 md:col-span-12">
          <div className="flex items-center justify-between gap-4 flex-wrap pt-5 px-[22px] pb-4 border-b border-line">
            <div>
              <h2 className="text-[17px] font-medium tracking-[-0.01em]">
                Paystub Breakdowns &amp; Reserve Ledger
              </h2>
              <p className="text-sm text-muted mt-0.5">
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
                <th scope="col" className="num text-right">
                  Gross Pay
                </th>
                <th scope="col" className="num text-right">
                  Tax Withheld
                </th>
                <th scope="col" className="num text-right">
                  Deductions
                </th>
                <th scope="col" className="num text-right">
                  Reserve Set-Aside
                </th>
                <th scope="col" className="num text-right">
                  Take-Home Net
                </th>
              </tr>
            </thead>
            {trackedPaycheques.length ? (
              <tbody>
                {trackedPaycheques.map(({ p, s, b }) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition-colors duration-120 hover:bg-[#f4f8f9]"
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
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span
                          className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
                          style={{ '--c': s?.color || '#94a3b8' } as CSSProperties}
                        />
                        {s?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="num text-right">{fmt(b.effectiveGrossCents)}</td>
                    <td className="num text-right text-muted">
                      {b.explicitTaxCents > 0 ? `-${fmt(b.explicitTaxCents)}` : '—'}
                    </td>
                    <td className="num text-right text-muted">
                      {b.explicitDeductionsCents + b.unclassifiedWithheldCents > 0
                        ? `-${fmt(b.explicitDeductionsCents + b.unclassifiedWithheldCents)}`
                        : '—'}
                    </td>
                    <td className="num text-right">
                      {b.contractorTaxReserveCents > 0 ? (
                        <span className="pill-reserve">
                          {fmt(b.contractorTaxReserveCents)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num text-right">
                      {fmt(b.netCents)}
                      {b.hasGrossBreakdown ? (
                        <span className="block text-xs text-muted font-mono mt-0.5">
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
                  <td colSpan={7} className="text-center text-muted py-12 px-4">
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

