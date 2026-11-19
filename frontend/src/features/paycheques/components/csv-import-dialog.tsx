'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import {
  importPaychequesAction,
  type PaychequeImportResult,
} from '../actions/import-paycheques';

const SAMPLE_CSV_HREF =
  'data:text/csv;charset=utf-8,' +
  encodeURIComponent(
    'date,source,amount,gross,tax,deductions,hours,note\n' +
      '2026-11-01,Example Employer,1500.00,2000.00,350.00,150.00,80,Biweekly pay\n'
  );

// ponytail: uploads raw CSV directly to Python stdlib csv.DictReader; add interactive column remapping only if arbitrary bank CSV formats need it.
export function CsvImportDialog() {
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useDialogs();

  const [csvText, setCsvText] = useState('');
  const [autoCreate, setAutoCreate] = useState(true);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<PaychequeImportResult | null>(null);
  const [pending, setPending] = useState(false);

  const openModal = () => {
    setErr('');
    setResult(null);
    setCsvText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    dlgRef.current?.showModal();
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!csvText.trim()) {
      setErr('Choose a CSV file first.');
      return;
    }
    setPending(true);
    setErr('');
    try {
      const res = await importPaychequesAction({
        csv_text: csvText,
        auto_create_sources: autoCreate,
      });
      if (!res.success) {
        setErr(res.error);
        return;
      }
      const data = res.data!;
      setResult(data);
      const parts = [
        `Imported ${data.imported_count}`,
        `skipped ${data.skipped_duplicates} duplicate${data.skipped_duplicates === 1 ? '' : 's'}`,
      ];
      if (data.created_sources > 0) {
        parts.push(
          `created ${data.created_sources} source${data.created_sources === 1 ? '' : 's'}`
        );
      }
      toast(parts.join(' · '));
      if (data.error_count === 0) {
        dlgRef.current?.close();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn w-full sm:w-auto" onClick={openModal}>
        Import CSV
      </button>
      <dialog ref={dlgRef} aria-labelledby="csvImportTitle">
        <form className="grid gap-[18px] p-[26px]" onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="csvImportTitle" className="text-[22px] font-medium tracking-[-0.02em]">
                Import paycheques from CSV
              </h2>
              <p className="text-sm text-muted mt-1">
                Duplicates matching source, date, and amount are automatically skipped.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5 text-sm font-medium">
            <label htmlFor="csvFileInput">CSV file</label>
            <input
              id="csvFileInput"
              ref={fileInputRef}
              name="csv_file"
              type="file"
              accept=".csv,text/csv"
              autoComplete="off"
              className="py-2 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setErr('');
                setResult(null);
                if (!file) {
                  setCsvText('');
                  return;
                }
                void file.text().then(setCsvText);
              }}
            />
            <a
              href={SAMPLE_CSV_HREF}
              download="payday-template.csv"
              className="text-xs font-medium text-accent hover:underline justify-self-start"
            >
              Download sample CSV template
            </a>
          </div>

          <label className="flex items-center gap-2.5 text-[15px] min-h-[44px] cursor-pointer">
            <input
              name="auto_create_sources"
              type="checkbox"
              className="size-5 min-h-5 accent-accent"
              checked={autoCreate}
              onChange={(e) => setAutoCreate(e.target.checked)}
            />
            Auto-create missing income sources
          </label>

          {err ? (
            <p className="text-down text-sm" role="alert">
              {err}
            </p>
          ) : null}

          {result && result.error_count > 0 ? (
            <div className="p-3.5 rounded-2xl bg-bg border border-line text-sm grid gap-1.5 max-h-44 overflow-y-auto">
              <p className="font-medium text-ink">
                Imported {result.imported_count} · Skipped {result.skipped_duplicates} ·{' '}
                {result.error_count} row{result.error_count === 1 ? '' : 's'} failed:
              </p>
              <ul className="list-disc pl-5 m-0 text-down text-xs grid gap-0.5">
                {result.errors.slice(0, 10).map((item) => (
                  <li key={`${item.row}-${item.error}`}>
                    Row {item.row}: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="hidden sm:block sm:flex-1" />
            <button
              type="button"
              disabled={pending}
              className="btn flex-1 sm:flex-initial"
              onClick={() => dlgRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !csvText.trim()}
              className="btn primary flex-1 sm:flex-initial"
            >
              {pending ? 'Importing…' : 'Import rows'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
