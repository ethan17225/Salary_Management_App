'use client';

import { useMemo, useState } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { computePaychequeBreakdown } from '@/lib/tax-intelligence';
import { dateLabel, fmt, monthLabel, plural, sumCents } from '@/lib/utils';
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
    <div className="card table-wrap src-ledger">
      <div className="ledger-head">
        <div>
          <h2>Paycheques from {source.name}</h2>
          <p className="muted">
            {plural(srcFilteredRows.length, 'paycheque')} in {srcIsAll ? 'all years' : srcYear} ·
            click any row to edit
          </p>
        </div>
        <div className="ledger-tools">
          <input
            type="search"
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
            <th scope="col" className="num">
              Hours
            </th>
            <th scope="col" className="num">
              vs. Avg
            </th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        {srcMonthGroups.length ? (
          srcMonthGroups.map(([ym, ps]) => {
            const mHrs = ps.reduce((t, p) => t + (p.hours || 0), 0);
            return (
              <tbody key={ym}>
                <tr className="month">
                  <th scope="rowgroup" colSpan={2}>
                    {monthLabel(ym)} <span className="muted">· {plural(ps.length, 'paycheque')}</span>
                  </th>
                  <td className="num muted">{mHrs ? `${+mHrs.toFixed(2)} h` : ''}</td>
                  <td />
                  <td className="num">{fmt(sumCents(ps))}</td>
                </tr>
                {ps.map((p) => {
                  const diff = p.amount_cents - srcAvg;
                  const pctDiff = srcAvg ? Math.round((diff / srcAvg) * 100) : 0;
                  const b = computePaychequeBreakdown(p, source);
                  return (
                    <tr key={p.id} className="row" onClick={() => openPaychequeDialog(p)}>
                      <td>
                        <button
                          className="link"
                          type="button"
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
                      <td className="muted">{p.note || '—'}</td>
                      <td className="num muted">
                        {p.hours ? (
                          <span>
                            {p.hours} h{' '}
                            <small className="rate-sub">
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
                      <td className="num">
                        {Math.abs(pctDiff) < 1 ? (
                          <span className="vs-avg">Avg</span>
                        ) : (
                          <span className={diff > 0 ? 'vs-avg up' : 'vs-avg down'}>
                            {diff > 0 ? '+' : ''}
                            {pctDiff}%
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {fmt(p.amount_cents)}
                        {b.hasGrossBreakdown ? (
                          <span className="gross-subtext">
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
              <td colSpan={5} className="empty">
                No paycheques match this filter.
              </td>
            </tr>
          </tbody>
        )}
        <tfoot>
          <tr>
            <th colSpan={2}>{plural(srcFilteredRows.length, 'paycheque')}</th>
            <td className="num muted">{totalHours ? `${+totalHours.toFixed(2)} h` : ''}</td>
            <td />
            <td className="num">{fmt(sumCents(srcFilteredRows))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

