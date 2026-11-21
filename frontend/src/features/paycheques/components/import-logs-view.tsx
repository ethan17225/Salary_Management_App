'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  ImportLogFilterParams,
  ImportPipelineLogSummary,
} from '../types/import-log-types';

export function ImportLogsView({
  logs,
  initialFilters,
}: {
  logs: ImportPipelineLogSummary[];
  initialFilters?: ImportLogFilterParams;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const [fStage, setFStage] = useState(initialFilters?.stage || '');
  const [fStatus, setFStatus] = useState(initialFilters?.status || '');
  const [fParser, setFParser] = useState(initialFilters?.parser || '');
  const [fWarnings, setFWarnings] = useState(initialFilters?.warnings || '');
  const [fSearch, setFSearch] = useState(initialFilters?.q || '');
  const yearParam = initialFilters?.year;

  useEffect(() => {
    setFStage(initialFilters?.stage || '');
    setFStatus(initialFilters?.status || '');
    setFParser(initialFilters?.parser || '');
    setFWarnings(initialFilters?.warnings || '');
    setFSearch(initialFilters?.q || '');
  }, [
    initialFilters?.stage,
    initialFilters?.status,
    initialFilters?.parser,
    initialFilters?.warnings,
    initialFilters?.q,
  ]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (yearParam) params.set('year', yearParam);
    if (fStage) params.set('stage', fStage);
    if (fStatus) params.set('status', fStatus);
    if (fParser) params.set('parser', fParser);
    if (fWarnings) params.set('warnings', fWarnings);
    if (fSearch.trim()) params.set('q', fSearch.trim());
    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [yearParam, fStage, fStatus, fParser, fWarnings, fSearch]);

  const metrics = useMemo(() => {
    let clean = 0;
    let withWarnings = 0;
    let errors = 0;
    for (const log of logs) {
      if (log.status === 'error') errors++;
      else if (log.warning_count > 0) withWarnings++;
      else clean++;
    }
    return { total: logs.length, clean, withWarnings, errors };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return logs.filter((entry) => {
      if (fStage && entry.stage !== fStage) return false;
      if (fStatus && entry.status !== fStatus) return false;
      if (fParser && entry.parser_used !== fParser) return false;
      if (fWarnings === 'yes' && entry.warning_count === 0) return false;
      if (fWarnings === 'no' && entry.warning_count > 0) return false;
      if (q) {
        const haystack = [
          `#${entry.id}`,
          String(entry.id),
          entry.parse_log_id ? `#${entry.parse_log_id}` : '',
          entry.filename ?? '',
          entry.vision_model ?? '',
          entry.ocr_runtime ?? '',
          entry.parser_used ?? '',
          entry.detected_mime ?? '',
          entry.error_message ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, fStage, fStatus, fParser, fWarnings, fSearch]);

  const isFiltered = Boolean(fStage || fStatus || fParser || fWarnings || fSearch.trim());
  const paychequesHref = withYearQuery('/paycheques', yearParam);

  function clearFilters() {
    setFStage('');
    setFStatus('');
    setFParser('');
    setFWarnings('');
    setFSearch('');
  }

  return (
    <section>
      <div className="mb-3">
        <Link
          className="inline-flex items-center gap-2 min-h-[44px] pl-2.5 pr-3.5 rounded text-muted no-underline font-medium text-[15px] transition-colors duration-150 hover:text-ink hover:bg-surface"
          href={paychequesHref}
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
          Paycheques
        </Link>
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <p className="text-sm font-medium text-muted">Paycheques</p>
          <h1 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium tracking-[-0.03em] leading-[1.15]">
            Import logs
          </h1>
          <p className="text-[15px] text-muted mt-1">
            Inspect parser outputs, AI extractions, warnings, and linked imports saved on this
            server.
          </p>
        </div>
        <button
          type="button"
          className="btn w-full sm:w-auto"
          disabled={isRefreshing}
          onClick={() => startTransition(() => router.refresh())}
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="card p-0 overflow-hidden mb-4">
        <dl className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-line">
          <div className="p-4 border-r border-line lg:border-r-0">
            <dt className="text-[13px] text-muted">Logged runs</dt>
            <dd className="num text-[22px] font-medium mt-1">{metrics.total}</dd>
          </div>
          <div className="p-4">
            <dt className="text-[13px] text-muted">Clean</dt>
            <dd className="num text-[22px] font-medium text-up mt-1">{metrics.clean}</dd>
          </div>
          <div className="p-4 border-r border-line lg:border-r-0">
            <dt className="text-[13px] text-muted">With warnings</dt>
            <dd className="num text-[22px] font-medium text-warn mt-1">{metrics.withWarnings}</dd>
          </div>
          <div className="p-4">
            <dt className="text-[13px] text-muted">Errors</dt>
            <dd className="num text-[22px] font-medium text-down mt-1">{metrics.errors}</dd>
          </div>
        </dl>
      </div>

      <div className="card flex flex-wrap gap-3 items-end p-4">
        <label className="grid gap-1.5 text-sm font-medium flex-[1_1_135px]">
          Stage
          <select name="stage" value={fStage} onChange={(e) => setFStage(e.target.value)}>
            <option value="">All stages</option>
            <option value="parse">Parse</option>
            <option value="import">Import</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium flex-[1_1_135px]">
          Status
          <select name="status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ok">OK</option>
            <option value="error">Error</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium flex-[1_1_155px]">
          Parser
          <select name="parser" value={fParser} onChange={(e) => setFParser(e.target.value)}>
            <option value="">All parsers</option>
            <option value="vision">Vision AI</option>
            <option value="pdf_text">PDF text</option>
            <option value="ocr">OCR scan</option>
            <option value="tabular">Spreadsheet</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium flex-[1_1_155px]">
          Warnings
          <select name="warnings" value={fWarnings} onChange={(e) => setFWarnings(e.target.value)}>
            <option value="">Any</option>
            <option value="yes">With warnings</option>
            <option value="no">No warnings</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium flex-[2_1_220px]">
          Search
          <input
            name="q"
            type="search"
            autoComplete="off"
            value={fSearch}
            onChange={(e) => setFSearch(e.target.value)}
            placeholder="Filename, model, error, or #ID…"
          />
        </label>
        {isFiltered ? (
          <button type="button" className="btn" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="card p-0 overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2 text-[13px] text-muted">
          <span>
            Showing <span className="num text-ink font-medium">{filteredLogs.length}</span> of{' '}
            <span className="num text-ink font-medium">{plural(logs.length, 'run')}</span>
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center grid gap-3 justify-items-center">
            <p className="text-[15px] text-ink font-medium">
              {logs.length === 0 ? 'No import runs recorded yet' : 'No matching import logs'}
            </p>
            <p className="text-sm text-muted max-w-[44ch]">
              {logs.length === 0
                ? 'Upload a paystub PDF, cheque photo, or spreadsheet in Paycheques to start recording step traces.'
                : 'Try broadening your stage, parser, or search filters.'}
            </p>
            {isFiltered ? (
              <button type="button" className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            ) : (
              <Link className="btn primary" href={paychequesHref}>
                Go to paycheques
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Document</th>
                    <th>Pipeline</th>
                    <th>Status</th>
                    <th className="text-right">Rows</th>
                    <th className="text-right">Duration</th>
                    <th>Recorded</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((entry) => {
                    const detailHref = withYearQuery(`/paycheques/logs/${entry.id}`, yearParam);
                    const badge = getLogStatusBadge(entry);
                    const title =
                      entry.filename ??
                      (entry.stage === 'import' ? 'Paycheque import commit' : 'Uploaded file');

                    return (
                      <tr key={entry.id} className="hover:bg-bg/70 transition-colors duration-150">
                        <td className="align-top">
                          <Link
                            href={detailHref}
                            className="num text-sm font-medium text-accent hover:underline"
                          >
                            #{entry.id}
                          </Link>
                          <div className="text-[13px] text-muted mt-0.5">
                            {STAGE_LABELS[entry.stage]}
                            {entry.parse_log_id ? (
                              <span className="num"> · from #{entry.parse_log_id}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="align-top max-w-[280px]">
                          <Link
                            href={detailHref}
                            className="font-medium text-ink hover:text-accent hover:underline break-words block"
                          >
                            {title}
                          </Link>
                          <div className="text-[13px] text-muted mt-0.5 truncate">
                            {entry.error_message
                              ? entry.error_message
                              : entry.file_size_bytes !== null
                                ? `${formatBytes(entry.file_size_bytes)}${
                                    entry.detected_mime ? ` · ${entry.detected_mime}` : ''
                                  }`
                                : entry.step_names.map((s) => STEP_LABELS[s] ?? s).join(', ') ||
                                  'Commit batch'}
                          </div>
                        </td>
                        <td className="align-top">
                          <div className="text-sm text-ink">
                            {entry.parser_used
                              ? PARSER_LABELS[entry.parser_used]
                              : STAGE_LABELS[entry.stage]}
                            {entry.used_llm_fallback ? ' + LLM' : ''}
                          </div>
                          <div className="text-[13px] text-muted mt-0.5">
                            {entry.vision_model
                              ? entry.vision_model
                              : entry.ocr_runtime
                                ? `${entry.ocr_runtime} runtime`
                                : `${entry.step_names.length} step${entry.step_names.length === 1 ? '' : 's'}`}
                          </div>
                        </td>
                        <td className="align-top">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium whitespace-nowrap',
                              badge.className
                            )}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="num align-top text-right">{entry.row_count}</td>
                        <td className="num align-top text-right">
                          {formatDuration(entry.duration_ms)}
                        </td>
                        <td className="num align-top text-[13px] text-muted">
                          {formatUtcTimestamp(entry.created_at)}
                        </td>
                        <td className="align-top text-right">
                          <Link
                            href={detailHref}
                            className="btn min-h-[40px] px-3 text-sm whitespace-nowrap"
                          >
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden list-none m-0 p-0 divide-y divide-line">
              {filteredLogs.map((entry) => {
                const detailHref = withYearQuery(`/paycheques/logs/${entry.id}`, yearParam);
                const badge = getLogStatusBadge(entry);
                const title =
                  entry.filename ??
                  (entry.stage === 'import' ? 'Paycheque import commit' : 'Uploaded file');

                return (
                  <li key={entry.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={detailHref}
                            className="num text-sm font-medium text-accent hover:underline"
                          >
                            #{entry.id}
                          </Link>
                          <span className="text-[13px] text-muted">
                            {STAGE_LABELS[entry.stage]}
                            {entry.parser_used ? ` · ${PARSER_LABELS[entry.parser_used]}` : ''}
                          </span>
                        </div>
                        <Link
                          href={detailHref}
                          className="font-medium text-ink hover:text-accent hover:underline break-words block mt-1"
                        >
                          {title}
                        </Link>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium shrink-0',
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                      <span className="num">{formatDuration(entry.duration_ms)}</span>
                      <span className="num">{plural(entry.row_count, 'row')}</span>
                      {entry.vision_model ? <span>{entry.vision_model}</span> : null}
                      <span className="num">{formatUtcTimestamp(entry.created_at)}</span>
                    </div>

                    {entry.error_message ? (
                      <p className="text-[13px] text-down mt-2 break-words">{entry.error_message}</p>
                    ) : null}

                    <div className="mt-3">
                      <Link href={detailHref} className="btn min-h-[40px] w-full text-sm">
                        Inspect log
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
