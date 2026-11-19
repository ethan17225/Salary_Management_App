'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { allocateCentsLargestRemainder, type AllocationRule } from '@/lib/allocation-engine';
import { computePaychequeBreakdown } from '@/lib/tax-intelligence';
import { computeUpcomingPaydays, fmt, formatDollars, iso } from '@/lib/utils';
import { deletePaychequeAction } from '../actions/delete-paycheque';
import { savePaychequeAction } from '../actions/save-paycheque';
import type { Paycheque, Source } from '@/types/payday';

interface PaychequeFormState {
  id: number | null;
  source_id: number;
  amount: string;
  gross: string;
  tax: string;
  deductions: string;
  paid_on: string;
  hours: string;
  note: string;
}

export function PaychequeDialog({
  sources,
  paycheques,
  allocations = [],
}: {
  sources: Source[];
  paycheques: Paycheque[];
  allocations?: AllocationRule[];
}) {
  const { paychequeRequest, openSourceDialog, toast } = useDialogs();
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);

  const [payForm, setPayForm] = useState<PaychequeFormState>({
    id: null,
    source_id: 0,
    amount: '',
    gross: '',
    tax: '',
    deductions: '',
    paid_on: '',
    hours: '',
    note: '',
  });
  const [showDrawer, setShowDrawer] = useState(false);
  const [netAutoSynced, setNetAutoSynced] = useState(true);
  const [payErr, setPayErr] = useState('');
  const [pending, setPending] = useState<'save' | 'save-another' | 'delete' | null>(null);

  const upcoming = useMemo(
    () => computeUpcomingPaydays(sources, paycheques, iso(new Date())),
    [sources, paycheques]
  );

  const srcById = (id: number) =>
    sources.find((s) => s.id === id) || { name: 'Unknown', color: '#94a3b8' };

  useEffect(() => {
    if (!paychequeRequest) return;
    const { paycheque: p, forceSourceId, prefill } = paychequeRequest;
    const nowStr = iso(new Date());
    const activeSources = sources.filter(
      (s) => !s.archived || s.id === p?.source_id || s.id === forceSourceId || s.id === prefill?.sourceId
    );
    const defaultSrc = p
      ? p.source_id
      : (prefill?.sourceId ??
        forceSourceId ??
        upcoming[0]?.source.id ??
        paycheques[0]?.source_id ??
        activeSources[0]?.id ??
        0);

    const hasExactBreakdown =
      p?.gross_cents != null &&
      p.gross_cents - (p.tax_cents ?? 0) - (p.deductions_cents ?? 0) === p.amount_cents;

    setPayErr('');
    setPending(null);
    setShowDrawer(Boolean(p && p.gross_cents != null));
    setNetAutoSynced(p?.gross_cents != null ? hasExactBreakdown : true);
    setPayForm({
      id: p ? p.id : null,
      source_id: defaultSrc,
      amount: p
        ? (p.amount_cents / 100).toFixed(2)
        : prefill?.amountCents != null
          ? (prefill.amountCents / 100).toFixed(2)
          : '',
      gross: p?.gross_cents != null ? (p.gross_cents / 100).toFixed(2) : '',
      tax: p?.tax_cents != null ? (p.tax_cents / 100).toFixed(2) : '',
      deductions: p?.deductions_cents != null ? (p.deductions_cents / 100).toFixed(2) : '',
      paid_on: p ? p.paid_on : (prefill?.paidOn ?? nowStr),
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

  const grossNum = parseFloat(payForm.gross);
  const netNum = parseFloat(payForm.amount);
  const taxNum = parseFloat(payForm.tax || '0');
  const dedNum = parseFloat(payForm.deductions || '0');
  const hoursNum = parseFloat(payForm.hours);

  const hasLiveBalance =
    Number.isFinite(grossNum) &&
    grossNum > 0 &&
    Number.isFinite(netNum) &&
    netNum > 0 &&
    grossNum >= netNum;

  const expectedNet =
    Number.isFinite(grossNum) &&
    grossNum > 0 &&
    (payForm.tax !== '' || payForm.deductions !== '') &&
    Number.isFinite(taxNum) &&
    Number.isFinite(dedNum)
      ? Math.round((grossNum - taxNum - dedNum) * 100) / 100
      : null;

  const netDiverged =
    expectedNet !== null &&
    expectedNet > 0 &&
    (!Number.isFinite(netNum) || Math.abs(expectedNet - netNum) >= 0.01);

  function updateBreakdownField(field: 'gross' | 'tax' | 'deductions', value: string) {
    setPayForm((f) => {
      const next = { ...f, [field]: value };
      if (netAutoSynced) {
        const g = parseFloat(next.gross);
        const t = parseFloat(next.tax || '0');
        const d = parseFloat(next.deductions || '0');
        if (
          Number.isFinite(g) &&
          g > 0 &&
          (next.tax !== '' || next.deductions !== '') &&
          Number.isFinite(t) &&
          Number.isFinite(d)
        ) {
          const computed = g - t - d;
          if (computed > 0) next.amount = computed.toFixed(2);
        }
      }
      return next;
    });
  }

  function buildSavedToast(): string {
    if (payForm.id) return 'Paycheque updated';
    const src = sources.find((s) => s.id === +payForm.source_id);
    const base = `Added ${formatDollars(+payForm.amount)} from ${src?.name ?? 'Unknown'}`;
    const netCents = Math.round(Number(payForm.amount) * 100);
    if (!Number.isFinite(netCents) || netCents <= 0) return base;
    const taxCents = payForm.tax ? Math.round(Number(payForm.tax) * 100) : null;
    const breakdown = computePaychequeBreakdown(
      {
        id: 0,
        source_id: +payForm.source_id,
        paid_on: payForm.paid_on,
        amount_cents: netCents,
        tax_cents: taxCents,
      },
      src
    );
    const split = allocateCentsLargestRemainder(
      breakdown.trueSpendableNetCents,
      allocations,
      breakdown.contractorTaxReserveCents
    );
    const parts: string[] = [];
    if (breakdown.contractorTaxReserveCents > 0) {
      parts.push(`Reserve ${fmt(breakdown.contractorTaxReserveCents)}`);
    }
    if (split.buckets.length > 0) {
      const top = split.buckets
        .slice(0, 2)
        .map((b) => `${b.name} ${fmt(b.allocated_cents)}`)
        .join(', ');
      parts.push(`${top}${split.buckets.length > 2 ? '…' : ''}`);
    }
    return parts.length > 0 ? `${base} · ${parts.join(' · ')}` : base;
  }

  async function handleSave(addAnother: boolean) {
    if (pending || chipSources.length === 0) return;
    setPending(addAnother ? 'save-another' : 'save');
    try {
      const res = await savePaychequeAction(payForm);
      if (!res.success) {
        setPayErr(res.error);
        return;
      }
      toast(buildSavedToast());
      if (addAnother) {
        setPayErr('');
        setNetAutoSynced(true);
        setPayForm((f) => ({
          ...f,
          id: null,
          amount: '',
          gross: '',
          tax: '',
          deductions: '',
          hours: '',
          note: '',
        }));
        requestAnimationFrame(() => amountRef.current?.focus());
      } else {
        dlgRef.current?.close();
      }
    } finally {
      setPending(null);
    }
  }

  async function submitPay(e: FormEvent) {
    e.preventDefault();
    await handleSave(false);
  }

  async function deletePay() {
    if (pending) return;
    const p = paycheques.find((x) => x.id === payForm.id);
    if (!p) return;
    setPending('delete');
    try {
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
          gross: p.gross_cents != null ? (p.gross_cents / 100).toFixed(2) : null,
          tax: p.tax_cents != null ? (p.tax_cents / 100).toFixed(2) : null,
          deductions: p.deductions_cents != null ? (p.deductions_cents / 100).toFixed(2) : null,
          paid_on: p.paid_on,
          hours: p.hours ?? '',
          note: p.note,
        });
        if (!restore.success) {
          throw new Error(restore.error);
        }
        toast('Paycheque restored');
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <dialog ref={dlgRef} aria-labelledby="payTitle">
      <form className="grid gap-[18px] p-[26px]" onSubmit={submitPay}>
        <h2 id="payTitle" className="text-[22px] font-medium tracking-[-0.02em]">
          {payForm.id ? 'Edit paycheque' : 'Add paycheque'}
        </h2>
        <fieldset className="border-0 p-0 m-0 flex flex-wrap gap-2 min-w-0">
          <legend className="text-sm font-medium p-0 mb-2">Source</legend>
          {chipSources.length === 0 ? (
            <p className="w-full text-sm text-muted mb-1">Add an income source first.</p>
          ) : null}
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
                <i className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block" />
                {s.name}
              </span>
            </label>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 border border-dashed border-line rounded-full font-sans font-medium text-[15px] bg-white text-muted cursor-pointer transition-[border-color,background-color,transform] duration-150 hover:border-[#c4cfd5] active:scale-[0.97]"
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
        <label className="grid gap-1.5 text-sm font-medium">
          Take-home amount
          <span className="relative">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-mono text-[22px]"
              aria-hidden="true"
            >
              $
            </span>
            <input
              ref={amountRef}
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              autoComplete="off"
              required
              placeholder="0.00…"
              className="pl-[34px] font-mono text-2xl min-h-[60px] tracking-[-0.02em]"
              value={payForm.amount}
              onChange={(e) => {
                if (showDrawer && payForm.gross !== '') setNetAutoSynced(false);
                setPayForm((f) => ({ ...f, amount: e.target.value }));
              }}
            />
          </span>
        </label>
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-accent bg-transparent border-0 py-1 px-0 cursor-pointer hover:underline"
            aria-expanded={showDrawer}
            onClick={() => setShowDrawer((v) => !v)}
          >
            {showDrawer
              ? '− Hide paystub breakdown'
              : '+ Add paystub breakdown (Gross, Tax, Deductions)'}
          </button>
          {showDrawer ? (
            <div className="mt-2 p-3.5 rounded-2xl bg-bg border border-line grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label className="grid gap-1.5 text-sm font-medium">
                  Gross Pay ($)
                  <input
                    name="gross"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00…"
                    className="num"
                    value={payForm.gross}
                    onChange={(e) => updateBreakdownField('gross', e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Income Tax Withheld ($)
                  <input
                    name="tax"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00…"
                    className="num"
                    value={payForm.tax}
                    onChange={(e) => updateBreakdownField('tax', e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Deductions — CPP / EI / Benefits ($)
                  <input
                    name="deductions"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00…"
                    className="num"
                    value={payForm.deductions}
                    onChange={(e) => updateBreakdownField('deductions', e.target.value)}
                  />
                </label>
              </div>
              {hasLiveBalance ? (
                <p className="block text-xs text-muted font-mono mt-0.5">
                  Total Withheld: {formatDollars(grossNum - netNum)} (Net Retention:{' '}
                  {((netNum / grossNum) * 100).toFixed(1)}%)
                </p>
              ) : null}
              {netDiverged && expectedNet !== null ? (
                <div className="grid gap-1.5">
                  <p className="text-xs text-warn font-mono">
                    Net differs from Gross − Tax − Deductions ({formatDollars(expectedNet)}).
                  </p>
                  <button
                    type="button"
                    className="btn same"
                    onClick={() => {
                      setNetAutoSynced(true);
                      setPayForm((f) => ({
                        ...f,
                        amount: expectedNet.toFixed(2),
                      }));
                    }}
                  >
                    Auto-fill Net ({formatDollars(expectedNet)})
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {lastForSrc ? (
          <button
            type="button"
            className="btn same"
            onClick={() => {
              setNetAutoSynced(false);
              setPayForm((f) => ({
                ...f,
                amount: (lastForSrc.amount_cents / 100).toFixed(2),
                gross:
                  lastForSrc.gross_cents != null
                    ? (lastForSrc.gross_cents / 100).toFixed(2)
                    : f.gross,
                tax:
                  lastForSrc.tax_cents != null ? (lastForSrc.tax_cents / 100).toFixed(2) : f.tax,
                deductions:
                  lastForSrc.deductions_cents != null
                    ? (lastForSrc.deductions_cents / 100).toFixed(2)
                    : f.deductions,
                hours: lastForSrc.hours != null ? String(lastForSrc.hours) : f.hours,
              }));
              if (lastForSrc.gross_cents != null) setShowDrawer(true);
              amountRef.current?.focus();
            }}
          >
            Same as last time: {fmt(lastForSrc.amount_cents)}
          </button>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Date paid
            <input
              name="paid_on"
              type="date"
              required
              autoComplete="off"
              value={payForm.paid_on}
              onChange={(e) => setPayForm((f) => ({ ...f, paid_on: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Hours worked <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              name="hours"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              autoComplete="off"
              value={payForm.hours}
              onChange={(e) => setPayForm((f) => ({ ...f, hours: e.target.value }))}
            />
          </label>
        </div>
        {Number.isFinite(hoursNum) && hoursNum > 0 && Number.isFinite(netNum) && netNum > 0 ? (
          <p className="text-xs font-mono text-muted -mt-2">
            Effective rate:{' '}
            <b className="font-medium text-ink">{formatDollars(netNum / hoursNum)}/h net</b>
            {Number.isFinite(grossNum) && grossNum >= netNum
              ? ` · ${formatDollars(grossNum / hoursNum)}/h gross`
              : null}
          </p>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium">
          <span>
            Note <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            name="note"
            maxLength={200}
            autoComplete="off"
            placeholder="Holiday pay, bonus, tips…"
            value={payForm.note}
            onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
          />
        </label>
        {payErr ? (
          <p className="text-down text-sm" role="alert">
            {payErr}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          {payForm.id ? (
            <button
              type="button"
              disabled={pending !== null}
              className="btn danger flex-1 sm:flex-initial"
              onClick={() => void deletePay()}
            >
              {pending === 'delete' ? 'Deleting…' : 'Delete paycheque'}
            </button>
          ) : null}
          <span className="hidden sm:block sm:flex-1" />
          <button
            type="button"
            disabled={pending !== null}
            className="btn flex-1 sm:flex-initial"
            onClick={() => dlgRef.current?.close()}
          >
            Cancel
          </button>
          {!payForm.id ? (
            <button
              type="button"
              disabled={pending !== null || chipSources.length === 0}
              className="btn flex-1 sm:flex-initial"
              onClick={() => void handleSave(true)}
            >
              {pending === 'save-another' ? 'Saving…' : 'Save & add another'}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending !== null || chipSources.length === 0}
            className="btn primary flex-1 sm:flex-initial"
          >
            {pending === 'save' ? 'Saving…' : 'Save paycheque'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
