'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { computePaychequeBreakdown } from '@/lib/tax-intelligence';
import { dateLabel, fmt, monthLabel, plural, sumCents } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';
import type { PaychequeFilterParams } from '../types/paycheque-types';

interface PaychequeLedgerProps {
  sources: Source[];
  paycheques: Paycheque[];
  years: number[];
  initialFilters?: PaychequeFilterParams;
}

export function PaychequeLedger({
  sources,
  paycheques,
  years,
  initialFilters,
}: PaychequeLedgerProps) {
  const [fYear, setFYear] = useState(initialFilters?.year || '');
  const [fSource, setFSource] = useState(initialFilters?.source || '');
  const [fSearch, setFSearch] = useState(initialFilters?.q || '');
  const { openPaychequeDialog } = useDialogs();

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
      <div className="card filters">
        <label className="field">
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
        <label className="field">
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
        <label className="field search">
          Search
          <input
            type="search"
            value={fSearch}
            onChange={(e) => setFSearch(e.target.value)}
            placeholder="Note, source or amount"
          />
        </label>
      </div>

      <div className="card table-wrap">
        <table>
          <caption className="sr">Paycheques grouped by month</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Source</th>
              <th scope="col">Note</th>
              <th scope="col" className="num">
                Hours
              </th>
              <th scope="col" className="num">
                Amount
              </th>
            </tr>
          </thead>
          {monthGroups.length ? (
            monthGroups.map(([ym, ps]) => (
              <tbody key={ym}>
                <tr className="month">
                  <th scope="rowgroup" colSpan={4}>
                    {monthLabel(ym)} <span className="muted">· {plural(ps.length, 'paycheque')}</span>
                  </th>
                  <td className="num">{fmt(sumCents(ps))}</td>
                </tr>
                {ps.map((p) => {
                  const s = srcById(p.source_id);
                  const b = computePaychequeBreakdown(
                    p,
                    'id' in s ? s : undefined
                  );
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
                        <span className="who">
                          <span className="dot" style={{ '--c': s.color } as CSSProperties} />
                          {s.name}
                        </span>
                      </td>
                      <td className="muted">{p.note}</td>
                      <td className="num muted">{p.hours ? `${p.hours} h` : ''}</td>
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
            ))
          ) : (
            <tbody>
              <tr>
                <td colSpan={5} className="empty">
                  No paycheques match these filters.
                </td>
              </tr>
            </tbody>
          )}
          <tfoot>
            <tr>
              <th colSpan={4}>{plural(filteredRows.length, 'paycheque')}</th>
              <td className="num">{fmt(sumCents(filteredRows))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

