'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { allocateCentsLargestRemainder, type AllocationRule } from '@/lib/allocation-engine';
import { computePaychequeBreakdown } from '@/lib/tax-intelligence';
import { dateLabel, fmt, monthLabel, plural, sumCents } from '@/lib/utils';
import { ImportDialog } from './import-dialog';
import type { Paycheque, Source } from '@/types/payday';
import type { PaychequeFilterParams } from '../types/paycheque-types';

interface PaychequeLedgerProps {
  sources: Source[];
  paycheques: Paycheque[];
  allocations?: AllocationRule[];
  years: number[];
  initialFilters?: PaychequeFilterParams;
}

function normalizeYearFilter(year?: string): string {
  return !year || year === 'all' ? '' : year;
}

export function PaychequeLedger({
  sources,
  paycheques,
  allocations = [],
  years,
  initialFilters,
}: PaychequeLedgerProps) {
  const [fYear, setFYear] = useState(() => normalizeYearFilter(initialFilters?.year));
  const [fSource, setFSource] = useState(initialFilters?.source || '');
  const [fSearch, setFSearch] = useState(initialFilters?.q || '');
  const [expandedSplitId, setExpandedSplitId] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { openPaychequeDialog, toast } = useDialogs();

  useEffect(() => {
    setFYear(normalizeYearFilter(initialFilters?.year));
    setFSource(initialFilters?.source || '');
    setFSearch(initialFilters?.q || '');
  }, [initialFilters?.year, initialFilters?.source, initialFilters?.q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (fYear) params.set('year', fYear);
    if (fSource) params.set('source', fSource);
    if (fSearch.trim()) params.set('q', fSearch.trim());
    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [fYear, fSource, fSearch]);

  const hasActiveAllocations = useMemo(
    () => allocations.some((r) => Boolean(r.active) && r.weight_bps > 0),
    [allocations]
  );

  const srcById = useMemo(() => {
    const map = new Map(sources.map((s) => [s.id, s]));
    return (id: number) => map.get(id) || { name: 'Unknown', color: '#94a3b8' };
  }, [sources]);

  const filteredRows = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return paycheques.filter(
      (p) =>
        (!fYear || p.paid_on.startsWith(`${fYear}-`)) &&
        (!fSource || p.source_id === +fSource) &&
        (!q ||
          `${srcById(p.source_id).name} ${p.note} ${(p.amount_cents / 100).toFixed(2)} ${
            p.paid_on
          }`
            .toLowerCase()
            .includes(q))
    );
  }, [paycheques, fYear, fSource, fSearch, srcById]);

  const monthGroups = useMemo(() => {
    const g = new Map<string, Paycheque[]>();
    filteredRows.forEach((p) => {
      const k = p.paid_on.slice(0, 7);
      const list = g.get(k);
      if (list) list.push(p);
      else g.set(k, [p]);
    });
    return [...g];
  }, [filteredRows]);

  const isFiltered = Boolean(fYear || fSource || fSearch.trim());
  const exportParams = new URLSearchParams();
  if (fYear) exportParams.set('year', fYear);
  if (fSource) exportParams.set('source_id', fSource);
  if (fSearch.trim()) exportParams.set('q', fSearch.trim());
  const exportQuery = exportParams.toString();
  const exportHref = exportQuery ? `/api/export.csv?${exportQuery}` : '/api/export.csv';

  const clearFilters = () => {
    setFYear('');
    setFSource('');
    setFSearch('');
  };

  async function copyCents(key: string, cents: number) {
    try {
      await navigator.clipboard.writeText((cents / 100).toFixed(2));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      toast('Could not copy to clipboard');
    }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <p className="text-sm font-medium text-muted">Paycheques</p>
          <h1 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium tracking-[-0.03em] leading-[1.15]">
            Every deposit, by month
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <ImportDialog sources={sources} />
          <a className="btn w-full sm:w-auto" href={exportHref} download>
            {isFiltered ? `Export filtered CSV (${filteredRows.length})` : 'Export to CSV'}
          </a>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3 items-end p-4">
        <label className="grid gap-1.5 text-sm font-medium flex-[1_1_180px]">
          Year
          <select name="year" value={fYear} onChange={(e) => setFYear(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium flex-[1_1_180px]">
          Source
          <select name="source" value={fSource} onChange={(e) => setFSource(e.target.value)}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium flex-[3_1_260px]">
          Search
          <input
            name="q"
            type="search"
            autoComplete="off"
            value={fSearch}
            onChange={(e) => setFSearch(e.target.value)}
            placeholder="Note, source, or amount…"
          />
        </label>
        {isFiltered ? (
          <button type="button" className="btn" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="card overflow-x-auto p-0 mt-4">
        <table>
          <caption className="sr-only">Paycheques grouped by month</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Source</th>
              <th scope="col">Note</th>
              <th scope="col" className="num text-right">
                Hours
              </th>
              <th scope="col" className="num text-right">
                Amount
              </th>
            </tr>
          </thead>
          {monthGroups.length ? (
            monthGroups.map(([ym, ps]) => (
              <tbody key={ym}>
                <tr className="[&>*]:bg-surface [&>*]:font-medium [&>*]:border-b-0">
                  <th scope="rowgroup" colSpan={4}>
                    {monthLabel(ym)}{' '}
                    <span className="text-muted font-normal">· {plural(ps.length, 'paycheque')}</span>
                  </th>
                  <td className="num text-right">{fmt(sumCents(ps))}</td>
                </tr>
                {ps.map((p) => {
                  const s = srcById(p.source_id);
                  const b = computePaychequeBreakdown(p, 'id' in s ? s : undefined);
                  const canShowSplit = hasActiveAllocations || b.contractorTaxReserveCents > 0;
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors duration-150 hover:bg-[#f4f8f9]"
                    >
                      <td>
                        <button
                          className="link"
                          type="button"
                          onClick={() => openPaychequeDialog(p)}
                          aria-label={`Edit ${s.name} paycheque on ${dateLabel(p.paid_on)} for ${fmt(p.amount_cents)}`}
                        >
                          {dateLabel(p.paid_on, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </button>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <span
                            className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
                            style={{ '--c': s.color } as CSSProperties}
                          />
                          {s.name}
                        </span>
                      </td>
                      <td className="text-muted">{p.note}</td>
                      <td className="num text-right text-muted">{p.hours ? `${p.hours} h` : ''}</td>
                      <td className="num text-right">
                        {fmt(p.amount_cents)}
                        {b.hasGrossBreakdown ? (
                          <span className="block text-xs text-muted font-mono mt-0.5">
                            Gross {fmt(b.effectiveGrossCents)} · -
                            {((10000 - b.netRetentionBps) / 100).toFixed(1)}% withheld
                          </span>
                        ) : null}
                        {b.contractorTaxReserveCents > 0 ? (
                          <span className="pill-reserve">
                            Reserve {fmt(b.contractorTaxReserveCents)}
                          </span>
                        ) : null}
                        {canShowSplit ? (
                          <div className="mt-1">
                            <button
                              type="button"
                              className="inline-flex items-center min-h-[40px] py-1 px-3 rounded-full text-xs font-mono bg-accent-soft text-accent-2 border border-transparent cursor-pointer"
                              aria-expanded={expandedSplitId === p.id}
                              onClick={() =>
                                setExpandedSplitId((prev) => (prev === p.id ? null : p.id))
                              }
                            >
                              {expandedSplitId === p.id ? 'Hide split' : 'Split'}
                            </button>
                            {expandedSplitId === p.id ? (
                              <div className="mt-1.5 grid gap-1 text-xs text-right">
                                {b.contractorTaxReserveCents > 0 ? (
                                  <span className="inline-flex items-center justify-end gap-2 text-muted">
                                    <span>
                                      Tax reserve:{' '}
                                      <b className="num font-medium text-ink">
                                        {fmt(b.contractorTaxReserveCents)}
                                      </b>
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-flex items-center min-h-[36px] px-2.5 rounded-lg border border-line bg-card text-ink cursor-pointer hover:bg-surface"
                                      aria-label={`Copy ${fmt(b.contractorTaxReserveCents)} tax reserve amount`}
                                      onClick={() =>
                                        void copyCents(
                                          `${p.id}:reserve`,
                                          b.contractorTaxReserveCents
                                        )
                                      }
                                    >
                                      {copiedKey === `${p.id}:reserve` ? 'Copied' : 'Copy'}
                                    </button>
                                  </span>
                                ) : null}
                                {allocateCentsLargestRemainder(
                                  b.trueSpendableNetCents,
                                  allocations,
                                  b.contractorTaxReserveCents
                                ).buckets.map((bucket) => {
                                  const key = `${p.id}:${bucket.rule_id}`;
                                  return (
                                    <span
                                      key={bucket.rule_id}
                                      className="inline-flex items-center justify-end gap-2 text-muted"
                                    >
                                      <span>
                                        <span
                                          className="size-[7px] rounded-full bg-(--c) shrink-0 inline-block mr-1"
                                          style={{ '--c': bucket.color } as CSSProperties}
                                        />
                                        {bucket.name}:{' '}
                                        <b className="num font-medium text-ink">
                                          {fmt(bucket.allocated_cents)}
                                        </b>
                                      </span>
                                      <button
                                        type="button"
                                        className="inline-flex items-center min-h-[36px] px-2.5 rounded-lg border border-line bg-card text-ink cursor-pointer hover:bg-surface"
                                        aria-label={`Copy ${fmt(bucket.allocated_cents)} for ${bucket.name}`}
                                        onClick={() => void copyCents(key, bucket.allocated_cents)}
                                      >
                                        {copiedKey === key ? 'Copied' : 'Copy'}
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))
          ) : (
            <tbody>
              <tr>
                <td colSpan={5} className="text-center text-muted py-12 px-4">
                  <p>No paycheques match these filters.</p>
                  {isFiltered ? (
                    <button type="button" className="btn mt-3" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : null}
                </td>
              </tr>
            </tbody>
          )}
          <tfoot>
            <tr>
              <th colSpan={4}>{plural(filteredRows.length, 'paycheque')}</th>
              <td className="num text-right">{fmt(sumCents(filteredRows))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
