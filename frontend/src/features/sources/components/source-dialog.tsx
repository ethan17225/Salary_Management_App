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
    setSrcForm({
      id: s ? s.id : null,
      name: s?.name ?? '',
      kind: s?.kind ?? 'job',
      color: nextColor,
      archived: Boolean(s?.archived),
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
      <form onSubmit={submitSrc}>
        <h2 id="srcTitle">{srcForm.id ? `Edit ${srcForm.name || 'source'}` : 'Add a source'}</h2>
        <label className="field">
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
        <div className="row2">
          <label className="field">
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
          <label className="field">
            Colour
            <input
              type="color"
              value={srcForm.color}
              onChange={(e) => setSrcForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={srcForm.archived}
            onChange={(e) => setSrcForm((f) => ({ ...f, archived: e.target.checked }))}
          />
          Archived (finished job, hidden from quick add)
        </label>
        <p className="err" role="alert">
          {srcErr}
        </p>
        <div className="actions">
          {srcForm.id ? (
            <button type="button" className="btn danger" onClick={() => void deleteSrc()}>
              Delete source
            </button>
          ) : null}
          <span className="sp" />
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>
            Cancel
          </button>
          <button className="btn primary">Save source</button>
        </div>
      </form>
    </dialog>
  );
}

