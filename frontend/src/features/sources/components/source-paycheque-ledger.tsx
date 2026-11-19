'use client';

import { useMemo, useState } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { computePaychequeBreakdown } from '@/lib/tax-intelligence';
import { cn, dateLabel, fmt, monthLabel, plural, sumCents } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';

interface SourcePaychequeLedgerProps {
  source: Source;
  srcPs: Paycheque[];
  srcAvg: number;
  srcIsAll: boolean;
  srcYear: 'all' | number;
  initialSearch?: string;
}

export function SourcePaychequeLedger({
  source,
  srcPs,
  srcAvg,
  srcIsAll,
  srcYear,
  initialSearch = '',
}: SourcePaychequeLedgerProps) {
  const [srcSearch, setSrcSearch] = useState(initialSearch);
  const { openPaychequeDialog } = useDialogs();

  const srcFilteredRows = useMemo(() => {
    const q = srcSearch.trim().toLowerCase();
    return srcPs.filter(
      (p) =>
        !q ||
        `${p.note} ${(p.amount_cents / 100).toFixed(2)} ${p.paid_on} ${dateLabel(p.paid_on)}`
          .toLowerCase()
          .includes(q)
    );
  }, [srcPs, srcSearch]);

  const srcMonthGroups = useMemo(() => {
    const g = new Map<string, Paycheque[]>();
    srcFilteredRows.forEach((p) => {
      const k = p.paid_on.slice(0, 7);
      const list = g.get(k);
      if (list) list.push(p);
      else g.set(k, [p]);
    });
    return [...g];
  }, [srcFilteredRows]);

  const totalHours = srcFilteredRows.reduce((t, p) => t + (p.hours || 0), 0);

  return (
    <div className="card overflow-x-auto p-0 mt-4">
      <div className="flex items-center justify-between gap-4 flex-wrap pt-5 px-[22px] pb-4 border-b border-line">
        <div>
          <h2 className="text-[17px] font-medium tracking-[-0.01em]">
            Paycheques from {source.name}
          </h2>
          <p className="text-sm text-muted mt-0.5">
            {plural(srcFilteredRows.length, 'paycheque')} in {srcIsAll ? 'all years' : srcYear} ·
            click any date to edit
          </p>
        </div>
        <div className="flex-[0_1_320px] min-w-[220px]">
          <input
            type="search"
            name="q"
            autoComplete="off"
            placeholder="Search notes, dates, or amounts…"
            aria-label={`Search ${source.name} paycheques`}
            value={srcSearch}
            onChange={(e) => setSrcSearch(e.target.value)}
          />
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Note</th>
            <th scope="col" className="num text-right">
              Hours
            </th>
            <th scope="col" className="num text-right">
              vs. Avg
            </th>
            <th scope="col" className="num text-right">
              Amount
            </th>
          </tr>
        </thead>
        {srcMonthGroups.length ? (
          srcMonthGroups.map(([ym, ps]) => {
            const mHrs = ps.reduce((t, p) => t + (p.hours || 0), 0);
            return (
              <tbody key={ym}>
                <tr className="[&>*]:bg-surface [&>*]:font-medium [&>*]:border-b-0">
                  <th scope="rowgroup" colSpan={2}>
                    {monthLabel(ym)}{' '}
                    <span className="text-muted font-normal">· {plural(ps.length, 'paycheque')}</span>
                  </th>
                  <td className="num text-right text-muted">
                    {mHrs ? `${+mHrs.toFixed(2)} h` : ''}
                  </td>
                  <td />
                  <td className="num text-right">{fmt(sumCents(ps))}</td>
                </tr>
                {ps.map((p) => {
                  const diff = p.amount_cents - srcAvg;
                  const pctDiff = srcAvg ? Math.round((diff / srcAvg) * 100) : 0;
                  const b = computePaychequeBreakdown(p, source);
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors duration-150 hover:bg-[#f4f8f9]"
                    >
                      <td>
                        <button
                          className="link"
                          type="button"
                          aria-label={`Edit ${source.name} paycheque on ${dateLabel(p.paid_on)} for ${fmt(p.amount_cents)}`}
                          onClick={() => openPaychequeDialog(p)}
                        >
                          {dateLabel(p.paid_on, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </button>
                      </td>
                      <td className="text-muted">{p.note || '—'}</td>
                      <td className="num text-right text-muted">
                        {p.hours ? (
                          <span>
                            {p.hours} h{' '}
                            <small className="text-xs text-muted ml-1">
                              ({fmt(p.amount_cents / p.hours)}/h net
                              {b.hasGrossBreakdown && b.grossHourlyCents
                                ? ` · ${fmt(b.grossHourlyCents)}/h gross`
                                : ''}
                              )
                            </small>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num text-right">
                        {Math.abs(pctDiff) < 1 ? (
                          <span className="inline-block font-mono font-medium text-xs leading-[1.2] py-[3px] px-2 rounded-full bg-surface text-muted">
                            Avg
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'inline-block font-mono font-medium text-xs leading-[1.2] py-[3px] px-2 rounded-full',
                              diff > 0 ? 'bg-[#e6f4ed] text-up' : 'bg-[#fceceb] text-down'
                            )}
                          >
                            {diff > 0 ? '+' : ''}
                            {pctDiff}%
                          </span>
                        )}
                      </td>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })
        ) : (
          <tbody>
            <tr>
              <td colSpan={5} className="text-center text-muted py-12 px-4">
                No paycheques match this filter.
              </td>
            </tr>
          </tbody>
        )}
        <tfoot>
          <tr>
            <th colSpan={2}>{plural(srcFilteredRows.length, 'paycheque')}</th>
            <td className="num text-right text-muted">
              {totalHours ? `${+totalHours.toFixed(2)} h` : ''}
            </td>
            <td />
            <td className="num text-right">{fmt(sumCents(srcFilteredRows))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

