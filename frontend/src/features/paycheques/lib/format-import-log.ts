import type {
  ImportLogParser,
  ImportLogStage,
  ImportPipelineLogSummary,
} from '../types/import-log-types';

export const STAGE_LABELS: Record<ImportLogStage, string> = {
  parse: 'Parse',
  import: 'Import',
};

export const PARSER_LABELS: Record<ImportLogParser, string> = {
  vision: 'Vision AI',
  pdf_text: 'PDF text',
  ocr: 'OCR scan',
  tabular: 'Spreadsheet',
};

export const STEP_LABELS: Record<string, string> = {
  detect_mime: 'Detect file type',
  parse_table: 'Parse spreadsheet',
  pdf_extract: 'Extract PDF text & tables',
  pdf_summary_table: 'Extract PDF summary rows',
  deterministic_text: 'Match deterministic rules',
  prepare_images: 'Render & preprocess pages',
  vision_extract: 'Vision AI extraction',
  reconcile_withholdings: 'Reconcile withholdings',
  vision_row: 'Validate vision row',
  ocr_text: 'RapidOCR scan',
  llm_extract: 'Local LLM fallback',
  import_commit: 'Commit paycheque rows',
};

const UTC_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatUtcTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${UTC_DATE_FMT.format(parsed)} UTC`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)} s`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function withYearQuery(href: string, yearParam?: string | null): string {
  if (!yearParam) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}year=${encodeURIComponent(yearParam)}`;
}

export function getLogStatusBadge(
  entry: Pick<ImportPipelineLogSummary, 'status' | 'warning_count'>
): { label: string; className: string } {
  if (entry.status === 'error') {
    return {
      label: 'Error',
      className: 'bg-[#fdf1f0] text-down border border-[#f2c8c4]',
    };
  }
  if (entry.warning_count > 0) {
    return {
      label: `${entry.warning_count} warning${entry.warning_count === 1 ? '' : 's'}`,
      className: 'bg-[#fef3c7] text-[#92400e] border border-[#fcd34d]',
    };
  }
  return {
    label: 'OK',
    className: 'bg-[#f1faf5] text-up border border-[#b8e2c9]',
  };
}
