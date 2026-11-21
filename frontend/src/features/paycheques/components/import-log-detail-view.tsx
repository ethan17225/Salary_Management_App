import Link from 'next/link';
import { cn, plural } from '@/lib/utils';
import {
  formatBytes,
  formatDuration,
  formatUtcTimestamp,
  getLogStatusBadge,
  PARSER_LABELS,
  STAGE_LABELS,
  STEP_LABELS,
  withYearQuery,
} from '../lib/format-import-log';
import type {
  ImportLogStep,
  ImportPipelineLogDetail,
} from '../types/import-log-types';
import { CopyJsonButton } from './copy-json-button';

const STEP_BAR_COLORS = ['bg-accent', 'bg-ink', 'bg-warn', 'bg-up', 'bg-muted'] as const;
const DEFAULT_OPEN_STEPS = new Set([
  'vision_extract',
  'llm_extract',
  'reconcile_withholdings',
  'import_commit',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function StepBody({ step }: { step: ImportLogStep }) {
  const out = step.output;

  if ((step.step === 'pdf_extract' || step.step === 'ocr_text') && typeof out.text_preview === 'string') {
    const hasCid = Boolean(out.has_cid_garbage);
    const score = asNumber(out.score);
    const tablesCount = asNumber(out.tables_count);
    const cleanLen = asNumber(out.clean_text_len);
    const rawLen = asNumber(out.raw_text_len);
    const textLen = asNumber(out.text_len);

    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {hasCid ? (
            <span className="pill-reserve">CID font corruption detected</span>
          ) : null}
          {rawLen !== null ? (
            <span className="px-2.5 py-0.5 rounded-full bg-surface text-ink border border-line num">
              Raw: {rawLen} chars
            </span>
          ) : null}
          {cleanLen !== null ? (
            <span className="px-2.5 py-0.5 rounded-full bg-surface text-ink border border-line num">
              Clean: {cleanLen} chars
            </span>
          ) : null}
          {textLen !== null ? (
            <span className="px-2.5 py-0.5 rounded-full bg-surface text-ink border border-line num">
              Extracted: {textLen} chars
            </span>
          ) : null}
          {tablesCount !== null ? (
            <span className="px-2.5 py-0.5 rounded-full bg-surface text-ink border border-line num">
              Tables: {tablesCount}
            </span>
          ) : null}
          {score !== null ? (
            <span className="px-2.5 py-0.5 rounded-full bg-surface text-ink border border-line num">
              Confidence: {Math.round(score * 100)}%
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[13px] font-medium text-muted">Extracted text preview</span>
            <CopyJsonButton value={out.text_preview} label="Copy text" />
          </div>
          <pre className="m-0 rounded-xl border border-line bg-bg p-3.5 text-[13px] font-mono text-ink overflow-x-auto max-h-[320px] whitespace-pre-wrap break-words">
            {out.text_preview || '(empty)'}
          </pre>
        </div>

        {Array.isArray(out.tables_preview) && out.tables_preview.length > 0 ? (
          <details className="rounded-xl border border-line bg-bg/60 p-3">
            <summary className="cursor-pointer text-[13px] font-medium text-ink">
              Tables preview ({out.tables_preview.length})
            </summary>
            <pre className="m-0 mt-2 text-[13px] font-mono text-ink overflow-x-auto max-h-[260px]">
              {JSON.stringify(out.tables_preview, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }

  if (step.step === 'reconcile_withholdings' && isRecord(out.before) && isRecord(out.after)) {
    const whCount = asNumber(out.withholdings_count) ?? 0;
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-bg p-3">
            <p className="text-[13px] text-muted font-medium">Before reconciliation</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[13px] text-muted">Tax</dt>
                <dd className="num font-medium">{asString(out.before.tax) ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Deductions</dt>
                <dd className="num font-medium">{asString(out.before.deductions) ?? '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-line bg-bg p-3">
            <p className="text-[13px] text-muted font-medium">After reconciliation</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[13px] text-muted">Tax</dt>
                <dd className="num font-medium text-ink">{asString(out.after.tax) ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Deductions</dt>
                <dd className="num font-medium text-ink">
                  {asString(out.after.deductions) ?? '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <p className="text-[13px] text-muted">
          Itemized withholdings received from model:{' '}
          <span className="num font-medium text-ink">{whCount}</span>
        </p>
      </div>
    );
  }

  if (step.step === 'prepare_images') {
    const pageCount = asNumber(out.page_count);
    const sizes = Array.isArray(out.sizes) ? out.sizes : [];
    if (pageCount !== null) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="px-2.5 py-1 rounded-lg bg-surface text-ink border border-line num">
            {plural(pageCount, 'page')}
          </span>
          {sizes.map((dims, idx) =>
            Array.isArray(dims) && dims.length >= 2 ? (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-bg text-ink border border-line num"
              >
                Page {idx + 1}: {String(dims[0])} × {String(dims[1])} px
              </span>
            ) : null
          )}
        </div>
      );
    }
  }

  if (step.step === 'import_commit' && isRecord(out.submitted_rows)) {
    const submittedRows = Array.isArray(out.submitted_rows.rows)
      ? out.submitted_rows.rows.filter(isRecord)
      : [];
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="px-2.5 py-0.5 rounded-full bg-surface text-ink border border-line">
            Mode: {asString(out.input_mode) ?? 'rows'}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-surface text-ink border border-line">
            Auto-create sources: {out.auto_create_sources ? 'Yes' : 'No'}
          </span>
        </div>

        {submittedRows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-line bg-bg">
            <table className="text-[13px]">
              <thead>
                <tr>
                  <th className="p-2.5">Source</th>
                  <th className="p-2.5">Pay date</th>
                  <th className="p-2.5 text-right">Take-home</th>
                  <th className="p-2.5 text-right">Gross</th>
                  <th className="p-2.5 text-right">Tax</th>
                  <th className="p-2.5 text-right">Deductions</th>
                  <th className="p-2.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {submittedRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 font-medium">{asString(row.source_name) ?? '—'}</td>
                    <td className="p-2.5 num">{asString(row.paid_on) ?? '—'}</td>
                    <td className="p-2.5 num text-right">{asString(row.amount) ?? '—'}</td>
                    <td className="p-2.5 num text-right">{asString(row.gross) ?? '—'}</td>
                    <td className="p-2.5 num text-right">{asString(row.tax) ?? '—'}</td>
                    <td className="p-2.5 num text-right">{asString(row.deductions) ?? '—'}</td>
                    <td className="p-2.5 text-muted max-w-[200px] truncate">
                      {asString(row.note) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">Step output</span>
        <CopyJsonButton value={out} label="Copy JSON" />
      </div>
      <pre className="m-0 rounded-xl border border-line bg-surface/70 p-3.5 text-[13px] font-mono text-ink overflow-x-auto max-h-[420px]">
        {JSON.stringify(out, null, 2)}
      </pre>
    </div>
  );
}

function ReturnedOutputCard({ log }: { log: ImportPipelineLogDetail }) {
  const resp = log.response;
  const parseRows =
    log.stage === 'parse' && resp && Array.isArray(resp.rows) ? resp.rows.filter(isRecord) : [];
  const unmappedColumns =
    resp && Array.isArray(resp.unmapped_columns)
      ? resp.unmapped_columns.map((c) => String(c))
      : [];

  return (
    <section className="card grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-medium">Returned output</h2>
        {resp ? <CopyJsonButton value={resp} label="Copy response" /> : null}
      </div>

      {!resp ? (
        <p className="text-sm text-muted">No response payload saved (run ended with an error).</p>
      ) : log.stage === 'parse' && parseRows.length > 0 ? (
        <div className="grid gap-3">
          {parseRows.map((row, idx) => {
            const rowWarnings = Array.isArray(row.warnings)
              ? row.warnings.map((w) => String(w))
              : [];
            const conf = asNumber(row.confidence);
            return (
              <div key={idx} className="rounded-xl border border-line bg-bg p-3.5 grid gap-2.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium text-ink">
                      {asString(row.source_name) ?? 'Missing source'}
                    </p>
                    <p className="text-[13px] text-muted mt-0.5">
                      <span className="num">{asString(row.paid_on) ?? 'No pay date'}</span>
                      {asString(row.document_type) ? ` · ${asString(row.document_type)}` : ''}
                      {conf !== null ? (
                        <span className="num"> · {Math.round(conf * 100)}% confidence</span>
                      ) : null}
                    </p>
                  </div>
                  <p className="num text-[17px] font-medium text-ink">
                    ${asString(row.amount) ?? '—'}
                  </p>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-line text-[13px]">
                  <div>
                    <dt className="text-muted">Gross</dt>
                    <dd className="num font-medium">{asString(row.gross) ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Tax</dt>
                    <dd className="num font-medium">{asString(row.tax) ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Deductions</dt>
                    <dd className="num font-medium">{asString(row.deductions) ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Hours</dt>
                    <dd className="num font-medium">{asString(row.hours) ?? '—'}</dd>
                  </div>
                </dl>

                {rowWarnings.length > 0 ? (
                  <ul className="m-0 pl-4 text-[13px] text-[#92400e] bg-[#fef3c7] border border-[#fcd34d] rounded-lg py-2 pr-3">
                    {rowWarnings.map((w, wIdx) => (
                      <li key={wIdx}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}

          {unmappedColumns.length > 0 ? (
            <p className="text-[13px] text-muted">
              Ignored columns: <span className="text-ink">{unmappedColumns.join(', ')}</span>
            </p>
          ) : null}
        </div>
      ) : log.stage === 'import' ? (
        <div className="grid gap-3">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-bg p-3">
              <dt className="text-[13px] text-muted">Imported</dt>
              <dd className="num text-[20px] font-medium text-up">
                {asNumber(resp.imported_count) ?? 0}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-bg p-3">
              <dt className="text-[13px] text-muted">Skipped duplicates</dt>
              <dd className="num text-[20px] font-medium">
                {asNumber(resp.skipped_duplicates) ?? 0}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-bg p-3">
              <dt className="text-[13px] text-muted">Created sources</dt>
              <dd className="num text-[20px] font-medium">{asNumber(resp.created_sources) ?? 0}</dd>
            </div>
            <div className="rounded-xl border border-line bg-bg p-3">
              <dt className="text-[13px] text-muted">Errors</dt>
              <dd className="num text-[20px] font-medium text-down">
                {asNumber(resp.error_count) ?? 0}
              </dd>
            </div>
          </dl>
          {Array.isArray(resp.errors) && resp.errors.length > 0 ? (
            <ul className="m-0 pl-4 text-[13px] text-down bg-[#fdf1f0] border border-[#f2c8c4] rounded-lg py-2 pr-3">
              {resp.errors.map((err, idx) => (
                <li key={idx}>
                  {isRecord(err)
                    ? `Row ${asString(err.row) ?? idx + 1}: ${asString(err.error) ?? 'Failed'}`
                    : String(err)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {resp ? (
        <details className="rounded-xl border border-line bg-bg/60 p-3">
          <summary className="cursor-pointer text-[13px] font-medium text-ink">
            Raw response JSON
          </summary>
          <pre className="m-0 mt-2.5 text-[13px] font-mono text-ink overflow-x-auto max-h-[300px]">
            {JSON.stringify(resp, null, 2)}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

export function ImportLogDetailView({
  log,
  yearParam,
}: {
  log: ImportPipelineLogDetail;
  yearParam?: string;
}) {
  const listHref = withYearQuery('/paycheques/logs', yearParam);
  const badge = getLogStatusBadge(log);
  const title =
    log.filename ?? (log.stage === 'import' ? 'Paycheque import commit' : 'Uploaded file');

  const timedSteps = log.steps.filter(
    (s): s is ImportLogStep & { duration_ms: number } =>
      s.duration_ms !== null && s.duration_ms > 0
  );
  const totalStepMs = timedSteps.reduce((acc, s) => acc + s.duration_ms, 0);

  return (
    <section>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-[18px]">
        <Link
          className="inline-flex items-center gap-2 min-h-[44px] pl-2.5 pr-3.5 rounded text-muted no-underline font-medium text-[15px] transition-colors duration-150 hover:text-ink hover:bg-surface"
          href={listHref}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M12.5 8h-9M7.5 4l-4 4 4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          All import logs
        </Link>
        <CopyJsonButton value={log} label="Copy full JSON" />
      </div>

      <div className="hero">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="num text-[13px] font-medium py-0.5 px-2.5 rounded-full bg-white/12 text-[#dbe5e9]">
              Run #{log.id}
            </span>
            <span className="text-[13px] font-medium py-0.5 px-2.5 rounded-full bg-white/12 text-[#dbe5e9]">
              {STAGE_LABELS[log.stage]}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium',
                badge.className
              )}
            >
              {badge.label}
            </span>
            {log.ocr_runtime ? (
              <span className="text-[13px] font-medium py-0.5 px-2.5 rounded-full bg-white/12 text-[#dbe5e9]">
                {log.ocr_runtime}
              </span>
            ) : null}
            {log.vision_model ? (
              <span className="num text-[13px] font-medium py-0.5 px-2.5 rounded-full bg-white/12 text-[#dbe5e9]">
                {log.vision_model}
              </span>
            ) : null}
          </div>

          <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-medium tracking-[-0.03em] leading-[1.18] mt-3 break-words">
            {title}
          </h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-[#b9c8ce]">
            <span className="num">{formatUtcTimestamp(log.created_at)}</span>
            {log.parser_used ? <span>Parser: {PARSER_LABELS[log.parser_used]}</span> : null}
            {log.parse_log_id ? (
              <Link
                href={withYearQuery(`/paycheques/logs/${log.parse_log_id}`, yearParam)}
                className="text-white underline hover:text-[#dbe5e9]"
              >
                Originating parse log #{log.parse_log_id}
              </Link>
            ) : null}
            {log.linked_import_ids.map((impId) => (
              <Link
                key={impId}
                href={withYearQuery(`/paycheques/logs/${impId}`, yearParam)}
                className="text-white underline hover:text-[#dbe5e9]"
              >
                Committed in import #{impId}
              </Link>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-x-6 gap-y-3 border-t md:border-t-0 md:border-l border-white/15 pt-4 md:pt-0 md:pl-6 shrink-0">
          <div>
            <dt className="text-[13px] text-[#b9c8ce]">Total duration</dt>
            <dd className="num text-[22px] font-medium mt-0.5">
              {formatDuration(log.duration_ms)}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-[#b9c8ce]">Rows</dt>
            <dd className="num text-[22px] font-medium mt-0.5">{log.row_count}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-[#b9c8ce]">Warnings</dt>
            <dd className="num text-[22px] font-medium mt-0.5">{log.warning_count}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-[#b9c8ce]">
              {log.file_size_bytes !== null ? 'File size' : 'Steps'}
            </dt>
            <dd className="num text-[22px] font-medium mt-0.5">
              {log.file_size_bytes !== null
                ? formatBytes(log.file_size_bytes)
                : log.steps.length}
            </dd>
          </div>
        </dl>
      </div>

      {log.error_message ? (
        <div
          role="alert"
          className="mt-4 rounded-[var(--r-lg)] border border-[#f2c8c4] bg-[#fdf1f0] px-5 py-4 text-down"
        >
          <p className="font-medium">Pipeline error</p>
          <p className="text-sm mt-1 break-words">{log.error_message}</p>
        </div>
      ) : null}

      {timedSteps.length > 0 && totalStepMs > 0 ? (
        <section className="card mt-4 grid gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-[17px] font-medium">Step timing breakdown</h2>
            <span className="num text-[13px] text-muted">
              Sum of timed steps: {formatDuration(totalStepMs)}
            </span>
          </div>
          <div
            className="h-2.5 w-full rounded-full overflow-hidden flex bg-surface"
            aria-label="Proportional step timings"
          >
            {timedSteps.map((step, idx) => {
              const pct = Math.max(2, (step.duration_ms / totalStepMs) * 100);
              return (
                <div
                  key={`${step.step}-${idx}`}
                  style={{ width: `${pct}%` }}
                  className={cn('h-full', STEP_BAR_COLORS[idx % STEP_BAR_COLORS.length])}
                  title={`${STEP_LABELS[step.step] ?? step.step}: ${formatDuration(step.duration_ms)}`}
                />
              );
            })}
          </div>
          <ul className="list-none m-0 p-0 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
            {timedSteps.map((step, idx) => {
              const pct = Math.round((step.duration_ms / totalStepMs) * 100);
              return (
                <li key={`${step.step}-${idx}`} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2.5 rounded-full shrink-0',
                      STEP_BAR_COLORS[idx % STEP_BAR_COLORS.length]
                    )}
                  />
                  <span className="text-ink font-medium">
                    {STEP_LABELS[step.step] ?? step.step}
                  </span>
                  <span className="num text-muted">
                    {formatDuration(step.duration_ms)} ({pct}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start mt-5">
        <section className="card p-0 overflow-hidden lg:col-span-7">
          <div className="px-[22px] py-4 border-b border-line flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-medium">Pipeline steps</h2>
            <span className="num text-[13px] text-muted">
              {plural(log.steps.length, 'step')}
            </span>
          </div>

          {log.steps.length === 0 ? (
            <p className="p-[22px] text-sm text-muted">
              No intermediate steps were recorded before this run ended.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {log.steps.map((step, idx) => {
                const defaultOpen =
                  step.status === 'error' ||
                  DEFAULT_OPEN_STEPS.has(step.step) ||
                  log.steps.length <= 2;
                const statusClass =
                  step.status === 'error'
                    ? 'bg-[#fdf1f0] text-down border border-[#f2c8c4]'
                    : step.status === 'skipped'
                      ? 'bg-[#fef3c7] text-[#92400e] border border-[#fcd34d]'
                      : 'bg-[#f1faf5] text-up border border-[#b8e2c9]';

                return (
                  <details key={`${step.step}-${idx}`} open={defaultOpen} className="group">
                    <summary className="list-none cursor-pointer px-[22px] py-3.5 flex items-center justify-between gap-3 hover:bg-bg/70 transition-colors duration-150">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="num size-6 rounded-full bg-surface text-ink text-[13px] font-medium grid place-items-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-ink block truncate">
                            {STEP_LABELS[step.step] ?? step.step}
                          </span>
                          <span className="num text-[13px] text-muted">{step.step}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {step.duration_ms !== null ? (
                          <span className="num text-[13px] text-muted">
                            {formatDuration(step.duration_ms)}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-medium',
                            statusClass
                          )}
                        >
                          {step.status}
                        </span>
                      </div>
                    </summary>
                    <div className="px-[22px] pb-4 pt-1">
                      <StepBody step={step} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <div className="lg:col-span-5 grid gap-5 lg:sticky lg:top-[88px] min-w-0">
          <ReturnedOutputCard log={log} />

          <section className="card grid gap-3">
            <h2 className="text-[17px] font-medium">Run details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-[13px] text-muted">Recorded</dt>
                <dd className="num mt-0.5">{formatUtcTimestamp(log.created_at)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Stage</dt>
                <dd className="mt-0.5">{STAGE_LABELS[log.stage]}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Parser</dt>
                <dd className="mt-0.5">
                  {log.parser_used ? PARSER_LABELS[log.parser_used] : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">CPU LLM fallback</dt>
                <dd className="mt-0.5">{log.used_llm_fallback ? 'Used' : 'Not used'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">OCR runtime</dt>
                <dd className="mt-0.5">{log.ocr_runtime ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Vision model</dt>
                <dd className="num mt-0.5 break-words">{log.vision_model ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">MIME type</dt>
                <dd className="num mt-0.5 break-all">{log.detected_mime ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">File size</dt>
                <dd className="num mt-0.5">{formatBytes(log.file_size_bytes)}</dd>
              </div>
              <div className="sm:col-span-2 min-w-0">
                <dt className="text-[13px] text-muted">File SHA-256</dt>
                <dd className="num text-[13px] mt-0.5 break-all">{log.file_sha256 ?? '—'}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </section>
  );
}
