'use client';

import { useRef, useState } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import type { Source } from '@/types/payday';
import { importPaychequesAction } from '../actions/import-paycheques';
import { importRowSchema, type ParsedRow, type ParseResponse } from '../schemas/import-schema';

type Row = ParsedRow & { _id: number };
type Status = { tone: 'down' | 'warn' | 'up'; text: string };

const ACCEPT = '.csv,.tsv,.xlsx,.pdf,.png,.jpg,.jpeg,.webp';
const MONEY_FIELDS = [
  ['amount', 'Take-home'],
  ['gross', 'Gross'],
  ['tax', 'Tax'],
  ['deductions', 'Deductions'],
] as const;
const READ_AS: Record<ParseResponse['parser_used'], string> = {
  tabular: 'spreadsheet',
  pdf_text: 'PDF text',
  ocr: 'scan (OCR)',
};
const TONE_CLASS = { down: 'text-down', warn: 'text-ink', up: 'text-up' } as const;
const DOT_CLASS = { down: 'bg-down', warn: 'bg-warn', up: 'bg-up' } as const;
const SAMPLE_CSV_HREF =
  'data:text/csv;charset=utf-8,' +
  encodeURIComponent(
    'date,source,amount,gross,tax,deductions,hours,note\n' +
      '2026-11-01,Example Employer,1500.00,2000.00,350.00,150.00,80,Biweekly pay\n'
  );

let nextRowId = 0;

function rowStatus(row: Row): Status {
  const check = importRowSchema.safeParse(row);
  if (!check.success) return { tone: 'down', text: check.error.issues[0].message };
  if (row.warnings.length > 0) return { tone: 'warn', text: row.warnings[0] };
  if (row.confidence < 0.85) return { tone: 'warn', text: 'Check against your paystub' };
  return { tone: 'up', text: 'Ready' };
}

// Two steps: upload -> POST /api/paycheques/parse (saves nothing) -> review & edit -> commit
// through the existing idempotent /import, so re-importing fixed rows never duplicates.
export function ImportDialog({ sources }: { sources: Source[] }) {
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useDialogs();

  const [meta, setMeta] = useState<Omit<ParseResponse, 'rows'> | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [autoCreate, setAutoCreate] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<'' | 'parse' | 'import'>('');

  const statuses = rows.map(rowStatus);
  const blocked = statuses.filter((s) => s.tone === 'down').length;
  const missingSource = rows.some((r) => !r.source_name?.trim());

  function reset() {
    setMeta(null);
    setRows([]);
    setDragOver(false);
    setErr('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setErr('');
    setPending('parse');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/paycheques/parse', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Couldn't read this file (${res.status}).`);
      const { rows: parsed, ...rest } = data as ParseResponse;
      if (parsed.length === 0) throw new Error('No paycheques found in this file.');
      setMeta(rest);
      setRows(parsed.map((r) => ({ ...r, _id: nextRowId++ })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read this file.");
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setPending('');
    }
  }

  // Any edit means the user has checked the row, so its parser warnings are cleared.
  function updateRow(id: number, patch: Partial<ParsedRow>) {
    setRows((prev) =>
      prev.map((r) => (r._id === id ? { ...r, ...patch, warnings: [], confidence: 1 } : r))
    );
  }

  function fillMissingSource(name: string) {
    setRows((prev) => prev.map((r) => (r.source_name?.trim() ? r : { ...r, source_name: name })));
  }

  async function handleImport() {
    if (pending) return;
    setErr('');
    setPending('import');
    try {
      const res = await importPaychequesAction({ rows, auto_create_sources: autoCreate });
      if (!res.success) {
        setErr(res.error);
        return;
      }
      const data = res.data!;
      const parts = [
        `Imported ${data.imported_count}`,
        `skipped ${data.skipped_duplicates} duplicate${data.skipped_duplicates === 1 ? '' : 's'}`,
      ];
      if (data.created_sources > 0) {
        parts.push(`created ${data.created_sources} source${data.created_sources === 1 ? '' : 's'}`);
      }
      if (data.imported_count > 0 || data.skipped_duplicates > 0 || data.error_count === 0) {
        toast(parts.join(' · '));
      }
      if (data.error_count === 0) {
        dlgRef.current?.close();
        return;
      }
      // Keep only the failed rows (errors are 1-based indexes into the rows we sent).
      const failed = new Map(data.errors.map((e) => [e.row, e.error]));
      setRows((prev) =>
        prev.flatMap((r, i) => {
          const error = failed.get(i + 1);
          return error ? [{ ...r, warnings: [error] }] : [];
        })
      );
      setErr(
        `${data.error_count} row${data.error_count === 1 ? '' : 's'} couldn't be imported. Fix ${
          data.error_count === 1 ? 'it' : 'them'
        } below and import again.`
      );
    } finally {
      setPending('');
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn w-full sm:w-auto"
        onClick={() => {
          reset();
          dlgRef.current?.showModal();
        }}
      >
        Import paycheques
      </button>
      <dialog
        ref={dlgRef}
        aria-labelledby="importTitle"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        className={meta ? 'w-[min(1040px,calc(100%-24px))]' : undefined}
      >
        <div className="grid gap-[18px] p-[26px]">
          <div>
            <h2 id="importTitle" className="text-[22px] font-medium tracking-[-0.02em]">
              Import paycheques
            </h2>
            <p className="text-sm text-muted mt-1">
              {meta
                ? 'Check each row and fix anything flagged. Rows already saved are skipped.'
                : 'Upload a spreadsheet (CSV, TSV, XLSX), a paystub PDF, or a photo of a paystub. Files are read on this server and never sent anywhere else.'}
            </p>
          </div>

          {!meta ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (pending !== 'parse') setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (pending !== 'parse') void handleFile(e.dataTransfer.files?.[0]);
              }}
              className={`grid gap-1.5 text-sm font-medium rounded-xl border border-dashed p-4 transition-[border-color,background-color] duration-150 ${
                dragOver ? 'border-accent bg-accent-soft' : 'border-line bg-bg'
              }`}
            >
              <label htmlFor="importFileInput">File</label>
              <input
                id="importFileInput"
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                disabled={pending === 'parse'}
                className="py-2 cursor-pointer bg-card"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <p className="text-[13px] font-normal text-muted" aria-live="polite">
                {pending === 'parse'
                  ? 'Reading file… scans and photos can take a few seconds.'
                  : 'Drop a file here or browse (up to 10 MB). You can review every row before anything is saved.'}
              </p>
              <a
                href={SAMPLE_CSV_HREF}
                download="payday-template.csv"
                className="text-[13px] font-medium text-accent hover:underline justify-self-start"
              >
                Download sample CSV template
              </a>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-sm text-muted">
                  <span className="font-medium text-ink">{meta.filename}</span> ·{' '}
                  <span className="num">{rows.length}</span> row{rows.length === 1 ? '' : 's'} ·
                  read as {READ_AS[meta.parser_used]}
                  {meta.used_llm_fallback ? ' with the local AI model' : ''}
                  {meta.unmapped_columns.length > 0 ? (
                    <span className="block">Ignored columns: {meta.unmapped_columns.join(', ')}</span>
                  ) : null}
                </p>
                {missingSource && sources.length > 0 ? (
                  <label className="grid gap-1.5 text-sm font-medium min-w-[220px]">
                    Source for rows without one
                    <select value="" onChange={(e) => fillMissingSource(e.target.value)}>
                      <option value="" disabled>
                        Pick a source
                      </option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-xl border border-line">
                <table className="text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr>
                      <th className="p-2">Source</th>
                      <th className="p-2">Pay date</th>
                      {MONEY_FIELDS.map(([field, label]) => (
                        <th key={field} className="p-2 text-right">
                          {label}
                        </th>
                      ))}
                      <th className="p-2">Status</th>
                      <th className="p-2">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const status = statuses[i];
                      return (
                        <tr
                          key={row._id}
                          className={
                            status.tone === 'down'
                              ? 'bg-down/5'
                              : status.tone === 'warn'
                                ? 'bg-warn/10'
                                : undefined
                          }
                        >
                          <td className="p-1.5">
                            <input
                              list="importSourceNames"
                              aria-label={`Source, row ${i + 1}`}
                              value={row.source_name ?? ''}
                              onChange={(e) => updateRow(row._id, { source_name: e.target.value })}
                              className="min-h-[40px] min-w-[160px]"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="date"
                              aria-label={`Pay date, row ${i + 1}`}
                              value={row.paid_on ?? ''}
                              onChange={(e) =>
                                updateRow(row._id, { paid_on: e.target.value || null })
                              }
                              className="num min-h-[40px] min-w-[150px]"
                            />
                          </td>
                          {MONEY_FIELDS.map(([field, label]) => (
                            <td key={field} className="p-1.5">
                              <input
                                inputMode="decimal"
                                aria-label={`${label}, row ${i + 1}`}
                                value={row[field] ?? ''}
                                onChange={(e) =>
                                  updateRow(row._id, { [field]: e.target.value.trim() || null })
                                }
                                className="num min-h-[40px] min-w-[110px] text-right"
                              />
                            </td>
                          ))}
                          <td className={`p-2 text-[13px] ${TONE_CLASS[status.tone]}`}>
                            <span className="inline-flex items-center gap-1.5 min-w-[160px]">
                              <i
                                aria-hidden
                                className={`size-2 shrink-0 rounded-full ${DOT_CLASS[status.tone]}`}
                              />
                              {status.text}
                            </span>
                          </td>
                          <td className="p-1.5">
                            <button
                              type="button"
                              className="btn min-h-[40px]"
                              aria-label={`Remove row ${i + 1}`}
                              onClick={() => setRows((prev) => prev.filter((r) => r._id !== row._id))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <datalist id="importSourceNames">
                  {sources.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>

              <label className="flex items-center gap-2.5 text-[15px] min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  className="size-5 min-h-5 accent-accent"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                />
                Add new income sources for names that don&apos;t exist yet
              </label>
            </>
          )}

          {err ? (
            <p className="text-down text-sm" role="alert">
              {err}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            {meta ? (
              <button type="button" className="btn" disabled={!!pending} onClick={reset}>
                Choose another file
              </button>
            ) : null}
            <span className="hidden sm:block sm:flex-1" />
            <button
              type="button"
              className="btn flex-1 sm:flex-initial"
              disabled={!!pending}
              onClick={() => dlgRef.current?.close()}
            >
              Cancel
            </button>
            {meta ? (
              <button
                type="button"
                className="btn primary flex-1 sm:flex-initial"
                disabled={!!pending || rows.length === 0 || blocked > 0}
                onClick={() => void handleImport()}
              >
                {pending === 'import'
                  ? 'Importing…'
                  : `Import ${rows.length} paycheque${rows.length === 1 ? '' : 's'}`}
              </button>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
