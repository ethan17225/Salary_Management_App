'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { computeUpcomingPaydays, fmt, formatDollars, iso } from '@/lib/utils';
import { deletePaychequeAction } from '../actions/delete-paycheque';
import { savePaychequeAction } from '../actions/save-paycheque';
import type { Paycheque, Source } from '@/types/payday';

interface PaychequeFormState {
  id: number | null;
  source_id: number;
  amount: string;
  paid_on: string;
  hours: string;
  note: string;
}

export function PaychequeDialog({
  sources,
  paycheques,
}: {
  sources: Source[];
  paycheques: Paycheque[];
}) {
  const { paychequeRequest, openSourceDialog, toast } = useDialogs();
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);

  const [payForm, setPayForm] = useState<PaychequeFormState>({
    id: null,
    source_id: 0,
    amount: '',
    paid_on: '',
    hours: '',
    note: '',
  });
  const [payErr, setPayErr] = useState('');

  const upcoming = useMemo(
    () => computeUpcomingPaydays(sources, paycheques, iso(new Date())),
    [sources, paycheques]
  );

  const srcById = (id: number) =>
    sources.find((s) => s.id === id) || { name: 'Unknown', color: '#94a3b8' };

  useEffect(() => {
    if (!paychequeRequest) return;
    const { paycheque: p, forceSourceId } = paychequeRequest;
    const nowStr = iso(new Date());
    const activeSources = sources.filter(
      (s) => !s.archived || s.id === p?.source_id || s.id === forceSourceId
    );
    const defaultSrc = p
      ? p.source_id
      : (forceSourceId ??
        upcoming[0]?.source.id ??
        paycheques[0]?.source_id ??
        activeSources[0]?.id ??
        0);

    setPayErr('');
    setPayForm({
      id: p ? p.id : null,
      source_id: defaultSrc,
      amount: p ? (p.amount_cents / 100).toFixed(2) : '',
      paid_on: p ? p.paid_on : nowStr,
      hours: p?.hours != null ? String(p.hours) : '',
      note: p?.note ?? '',
    });
    if (!dlgRef.current?.open) {
      dlgRef.current?.showModal();
    }
    requestAnimationFrame(() => amountRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paychequeRequest]);

  const chipSources = sources.filter((s) => !s.archived || s.id === payForm.source_id);
  const lastForSrc =
    payForm.id === null ? paycheques.find((p) => p.source_id === +payForm.source_id) : null;

  async function submitPay(e: FormEvent) {
    e.preventDefault();
    const res = await savePaychequeAction(payForm);
    if (!res.success) {
      setPayErr(res.error);
      return;
    }
    dlgRef.current?.close();
    toast(
      payForm.id
        ? 'Paycheque updated'
        : `Added ${formatDollars(+payForm.amount)} from ${srcById(+payForm.source_id).name}`
    );
  }

  async function deletePay() {
    const p = paycheques.find((x) => x.id === payForm.id);
    if (!p) return;
    const res = await deletePaychequeAction({ id: p.id });
    if (!res.success) {
      setPayErr(res.error);
      return;
    }
    dlgRef.current?.close();
    toast(`Deleted ${fmt(p.amount_cents)} from ${srcById(p.source_id).name}`, async () => {
      const restore = await savePaychequeAction({
        source_id: p.source_id,
        amount: (p.amount_cents / 100).toFixed(2),
        paid_on: p.paid_on,
        hours: p.hours ?? '',
        note: p.note,
      });
      if (!restore.success) {
        throw new Error(restore.error);
      }
      toast('Paycheque restored');
    });
  }

  return (
    <dialog ref={dlgRef} aria-labelledby="payTitle">
      <form onSubmit={submitPay}>
        <h2 id="payTitle">{payForm.id ? 'Edit paycheque' : 'Add paycheque'}</h2>
        <fieldset className="chips">
          <legend>Source</legend>
          {chipSources.map((s) => (
            <label key={s.id} className="chip" style={{ '--c': s.color } as CSSProperties}>
              <input
                type="radio"
                name="source_id"
                value={s.id}
                required
                checked={+payForm.source_id === s.id}
                onChange={() => setPayForm((f) => ({ ...f, source_id: s.id }))}
              />
              <span>
                <i className="dot" />
                {s.name}
              </span>
            </label>
          ))}
          <button
            type="button"
            className="chip-add"
            onClick={() =>
              openSourceDialog(null, (newSourceId) => {
                if (dlgRef.current?.open) {
                  setPayForm((f) => ({ ...f, source_id: newSourceId }));
                }
              })
            }
          >
            + New source
          </button>
        </fieldset>
        <label className="field">
          Take-home amount
          <span className="money-in">
            <span aria-hidden="true">$</span>
            <input
              ref={amountRef}
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </span>
        </label>
        {lastForSrc ? (
          <button
            type="button"
            className="btn same"
            onClick={() => {
              setPayForm((f) => ({ ...f, amount: (lastForSrc.amount_cents / 100).toFixed(2) }));
              amountRef.current?.focus();
            }}
          >
            Same as last time: {fmt(lastForSrc.amount_cents)}
          </button>
        ) : null}
        <div className="row2">
          <label className="field">
            Date paid
            <input
              type="date"
              required
              value={payForm.paid_on}
              onChange={(e) => setPayForm((f) => ({ ...f, paid_on: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>
              Hours worked <span className="opt">(optional)</span>
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={payForm.hours}
              onChange={(e) => setPayForm((f) => ({ ...f, hours: e.target.value }))}
            />
          </label>
        </div>
        <label className="field">
          <span>
            Note <span className="opt">(optional)</span>
          </span>
          <input
            maxLength={200}
            placeholder="Holiday pay, bonus, tips…"
            value={payForm.note}
            onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
          />
        </label>
        <p className="err" role="alert">
          {payErr}
        </p>
        <div className="actions">
          {payForm.id ? (
            <button type="button" className="btn danger" onClick={() => void deletePay()}>
              Delete paycheque
            </button>
          ) : null}
          <span className="sp" />
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>
            Cancel
          </button>
          <button className="btn primary">Save paycheque</button>
        </div>
      </form>
    </dialog>
  );
}

