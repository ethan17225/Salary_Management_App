'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDialogs } from '@/components/ui/dialog-provider';
import { SOURCE_COLORS } from '@/lib/utils';
import { deleteSourceAction } from '../actions/delete-source';
import { saveSourceAction } from '../actions/save-source';
import type { Source, SourceKind } from '@/types/payday';

interface SourceFormState {
  id: number | null;
  name: string;
  kind: SourceKind;
  color: string;
  archived: boolean;
  is_tax_withheld: boolean;
  tax_reserve_percent: string;
}

export function SourceDialog({ sources }: { sources: Source[] }) {
  const { sourceRequest, toast } = useDialogs();
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const srcNameRef = useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const [srcForm, setSrcForm] = useState<SourceFormState>({
    id: null,
    name: '',
    kind: 'job',
    color: SOURCE_COLORS[0],
    archived: false,
    is_tax_withheld: true,
    tax_reserve_percent: '25',
  });
  const [srcErr, setSrcErr] = useState('');

  useEffect(() => {
    if (!sourceRequest) return;
    const s = sourceRequest.source;
    const nextColor =
      s?.color ??
      SOURCE_COLORS.find((c) => !sources.some((x) => x.color === c)) ??
      SOURCE_COLORS[0];

    setSrcErr('');
    const isWithheld = s?.is_tax_withheld === undefined ? true : Boolean(s.is_tax_withheld);
    const reservePct =
      s?.tax_reserve_bps && s.tax_reserve_bps > 0
        ? String(+(s.tax_reserve_bps / 100).toFixed(2))
        : '25';
    setSrcForm({
      id: s ? s.id : null,
      name: s?.name ?? '',
      kind: s?.kind ?? 'job',
      color: nextColor,
      archived: Boolean(s?.archived),
      is_tax_withheld: isWithheld,
      tax_reserve_percent: isWithheld ? '0' : reservePct,
    });
    if (!dlgRef.current?.open) {
      dlgRef.current?.showModal();
    }
    requestAnimationFrame(() => srcNameRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRequest]);

  async function submitSrc(e: FormEvent) {
    e.preventDefault();
    const res = await saveSourceAction(srcForm);
    if (!res.success) {
      setSrcErr(res.error);
      return;
    }
    dlgRef.current?.close();
    toast(srcForm.id ? 'Source saved' : `Added ${srcForm.name}`);
    if (res.data?.id && sourceRequest?.onCreated) {
      sourceRequest.onCreated(res.data.id);
    }
  }

  async function deleteSrc() {
    if (!srcForm.id) return;
    const deletedId = srcForm.id;
    const res = await deleteSourceAction({ id: deletedId });
    if (!res.success) {
      setSrcErr(res.error);
      return;
    }
    dlgRef.current?.close();
    toast('Source deleted');
    if (pathname === `/sources/${deletedId}`) {
      router.push('/sources');
    }
  }

  return (
    <dialog ref={dlgRef} aria-labelledby="srcTitle">
      <form className="grid gap-[18px] p-[26px]" onSubmit={submitSrc}>
        <h2 id="srcTitle" className="text-[22px] font-medium tracking-[-0.02em]">
          {srcForm.id ? `Edit ${srcForm.name || 'source'}` : 'Add a source'}
        </h2>
        <label className="grid gap-1.5 text-sm font-medium">
          Name
          <input
            ref={srcNameRef}
            maxLength={60}
            required
            placeholder="Employer or payer"
            value={srcForm.name}
            onChange={(e) => setSrcForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Kind
            <select
              value={srcForm.kind}
              onChange={(e) => setSrcForm((f) => ({ ...f, kind: e.target.value as SourceKind }))}
            >
              <option value="job">Job</option>
              <option value="government">Government</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Colour
            <input
              type="color"
              className="p-1 cursor-pointer"
              value={srcForm.color}
              onChange={(e) => setSrcForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          Tax Treatment
          <select
            value={srcForm.is_tax_withheld ? 'withheld' : 'untaxed'}
            onChange={(e) => {
              const withheld = e.target.value === 'withheld';
              setSrcForm((f) => ({
                ...f,
                is_tax_withheld: withheld,
                tax_reserve_percent:
                  !withheld && (!f.tax_reserve_percent || f.tax_reserve_percent === '0')
                    ? '25'
                    : f.tax_reserve_percent,
              }));
            }}
          >
            <option value="withheld">Taxes withheld at source (T4 / W-2 / Government)</option>
            <option value="untaxed">Untaxed / Self-Employed / Contractor (T4A / 1099)</option>
          </select>
        </label>
        {!srcForm.is_tax_withheld ? (
          <div className="mt-2 p-3.5 rounded bg-bg border border-line grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Recommended Tax Reserve (%)
              <input
                type="number"
                step="0.5"
                min="0"
                max="60"
                className="num"
                value={srcForm.tax_reserve_percent}
                onChange={(e) =>
                  setSrcForm((f) => ({ ...f, tax_reserve_percent: e.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[15, 20, 25, 30].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className="btn same"
                  onClick={() =>
                    setSrcForm((f) => ({ ...f, tax_reserve_percent: String(pct) }))
                  }
                >
                  {pct}%
                </button>
              ))}
            </div>
            <p className="block text-xs text-muted font-mono mt-0.5">
              Payday will automatically calculate your recommended tax set-aside and True Spendable
              Net on deposits from this source.
            </p>
          </div>
        ) : null}
        <label className="flex items-center gap-2.5 text-[15px] min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            className="size-5 min-h-5 accent-accent"
            checked={srcForm.archived}
            onChange={(e) => setSrcForm((f) => ({ ...f, archived: e.target.checked }))}
          />
          Archived (finished job, hidden from quick add)
        </label>
        {srcErr ? (
          <p className="text-down text-sm" role="alert">
            {srcErr}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          {srcForm.id ? (
            <button
              type="button"
              className="btn danger flex-1 sm:flex-initial"
              onClick={() => void deleteSrc()}
            >
              Delete source
            </button>
          ) : null}
          <span className="hidden sm:block sm:flex-1" />
          <button
            type="button"
            className="btn flex-1 sm:flex-initial"
            onClick={() => dlgRef.current?.close()}
          >
            Cancel
          </button>
          <button className="btn primary flex-1 sm:flex-initial">Save source</button>
        </div>
      </form>
    </dialog>
  );
}

