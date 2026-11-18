'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { allocateCentsLargestRemainder, type AllocationRule } from '@/lib/allocation-engine';
import { computePaychequeBreakdown } from '@/lib/tax-intelligence';
import { dateLabel, fmt, monthLabel, plural, sumCents } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';
import type { PaychequeFilterParams } from '../types/paycheque-types';

interface PaychequeLedgerProps {
  sources: Source[];
  paycheques: Paycheque[];
  allocations?: AllocationRule[];
  years: number[];
  initialFilters?: PaychequeFilterParams;
}

export function PaychequeLedger({
  sources,
  paycheques,
  allocations = [],
  years,
  initialFilters,
}: PaychequeLedgerProps) {
  const [fYear, setFYear] = useState(initialFilters?.year || '');
  const [fSource, setFSource] = useState(initialFilters?.source || '');
  const [fSearch, setFSearch] = useState(initialFilters?.q || '');
  const [expandedSplitId, setExpandedSplitId] = useState<number | null>(null);
  const { openPaychequeDialog } = useDialogs();
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

  return (
    <>
      <div className="card flex flex-wrap gap-3 items-end p-4">
        <label className="grid gap-1.5 text-sm font-medium flex-[1_1_180px]">
          Year
          <select value={fYear} onChange={(e) => setFYear(e.target.value)}>
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
          <select value={fSource} onChange={(e) => setFSource(e.target.value)}>
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
            type="search"
            value={fSearch}
            onChange={(e) => setFSearch(e.target.value)}
            placeholder="Note, source or amount"
          />
        </label>
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
                  const b = computePaychequeBreakdown(
                    p,
                    'id' in s ? s : undefined
                  );
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors duration-120 hover:bg-[#f4f8f9]"
                      onClick={() => openPaychequeDialog(p)}
                    >
                      <td>
                        <button
                          className="link"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPaychequeDialog(p);
                          }}
                          aria-label={`Edit paycheque from ${dateLabel(p.paid_on)}`}
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
                        {hasActiveAllocations ? (
                          <div className="mt-1">
                            <button
                              type="button"
                              className="inline-flex items-center min-h-6 py-0.5 px-2 rounded-full text-xs font-mono bg-accent-soft text-accent-2 border border-transparent cursor-pointer"
                              aria-expanded={expandedSplitId === p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSplitId((prev) => (prev === p.id ? null : p.id));
                              }}
                            >
                              {expandedSplitId === p.id ? 'Hide split' : 'Split'}
                            </button>
                            {expandedSplitId === p.id ? (
                              <div className="mt-1.5 grid gap-0.5 text-xs text-right">
                                {allocateCentsLargestRemainder(
                                  b.trueSpendableNetCents,
                                  allocations,
                                  b.contractorTaxReserveCents
                                ).buckets.map((bucket) => (
                                  <span key={bucket.rule_id} className="text-muted">
                                    <span
                                      className="size-[7px] rounded-full bg-(--c) shrink-0 inline-block mr-1"
                                      style={{ '--c': bucket.color } as CSSProperties}
                                    />
                                    {bucket.name}: <b className="num font-medium">{fmt(bucket.allocated_cents)}</b>
                                  </span>
                                ))}
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
                  No paycheques match these filters.
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

