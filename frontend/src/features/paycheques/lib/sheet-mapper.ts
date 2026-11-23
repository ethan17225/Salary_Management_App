import type { ParsedRow, ParsedSheetPreview } from '../schemas/import-schema';

export type SheetColumnField =
  | 'paid_on'
  | 'month'
  | 'day'
  | 'year'
  | 'amount'
  | 'source_name'
  | 'gross'
  | 'tax'
  | 'deductions'
  | 'hours'
  | 'note';

export type SheetOverride = {
  headerRowIndex: number; // -1 means no header row (start data from row 1)
  defaultSource: string;
  defaultYear: string;
  defaultNote: string;
  mapping: Partial<Record<SheetColumnField, number | null>>;
};

export const MAPPING_FIELDS: ReadonlyArray<{ key: SheetColumnField; label: string }> = [
  { key: 'paid_on', label: 'Full date' },
  { key: 'month', label: 'Month' },
  { key: 'day', label: 'Day / date' },
  { key: 'year', label: 'Year' },
  { key: 'amount', label: 'Take-home' },
  { key: 'source_name', label: 'Source' },
  { key: 'gross', label: 'Gross' },
  { key: 'tax', label: 'Tax' },
  { key: 'deductions', label: 'Deductions' },
  { key: 'hours', label: 'Hours' },
  { key: 'note', label: 'Note / type' },
];

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const SUMMARY_FOOTER_RE = /^\s*(?:sub\s*total|grand\s*total|total|ytd|year\s+to\s+date|average|avg|sum|balance)\b/i;

export function initialSheetOverride(sheet: ParsedSheetPreview): SheetOverride {
  const mapping: Partial<Record<SheetColumnField, number | null>> = {};
  for (const { key } of MAPPING_FIELDS) {
    const val = sheet.inferred_mapping[key];
    mapping[key] = typeof val === 'number' ? val : null;
  }
  return {
    headerRowIndex: sheet.header_row_index,
    defaultSource: sheet.default_source ?? '',
    defaultYear: sheet.default_year ? String(sheet.default_year) : '',
    defaultNote: sheet.default_note ?? '',
    mapping,
  };
}

function cleanMoneyCell(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

function cleanMonthCell(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{1,2}(\.0+)?$/.test(s)) {
    const m = Math.trunc(Number(s));
    return m >= 1 && m <= 12 ? m : null;
  }
  return MONTHS[s.toLowerCase().replace(/\.$/, '')] ?? null;
}

function cleanDayCell(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^\d{1,2}(\.0+)?$/.test(s)) return null;
  const d = Math.trunc(Number(s));
  return d >= 1 && d <= 31 ? d : null;
}

function cleanYearCell(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^(19|20)\d{2}(\.0+)?$/.test(s)) return null;
  return Math.trunc(Number(s));
}

function cleanFullDateCell(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{5}(\.0+)?$/.test(s)) {
    const serial = Math.trunc(Number(s));
    if (serial >= 30000 && serial <= 60000) {
      const dt = new Date(Date.UTC(1899, 11, 30 + serial));
      return dt.toISOString().slice(0, 10);
    }
  }
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const mdy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    const mNum = Number(m);
    const dNum = Number(d);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (dNum >= 1 && dNum <= 12 && mNum >= 1 && mNum <= 31) {
      return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
    }
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed) && /[a-zA-Z]/.test(s)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

function cleanHoursCell(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 100) / 100 : null;
}

function formatIsoDate(year: number, month: number, day: number): string | null {
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function colLetter(idx: number): string {
  let n = idx;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

export function buildRowsFromSheetOverride(
  sheet: ParsedSheetPreview,
  override: SheetOverride
): ParsedRow[] {
  const { raw_rows: rawRows } = sheet;
  const startIdx = override.headerRowIndex >= 0 ? override.headerRowIndex + 1 : 0;
  const map = override.mapping;
  const fallbackYear =
    cleanYearCell(override.defaultYear) ?? sheet.default_year ?? new Date().getFullYear();

  let currentMonth: number | null = null;
  let currentYear: number | null = fallbackYear;
  const out: ParsedRow[] = [];

  for (const row of rawRows.slice(startIdx)) {
    const get = (field: SheetColumnField): string | null => {
      const idx = map[field];
      return typeof idx === 'number' && idx >= 0 && idx < row.length ? row[idx] : null;
    };

    const fullDateDirect = cleanFullDateCell(get('paid_on'));
    if (
      !fullDateDirect &&
      row.some((c) => typeof c === 'string' && SUMMARY_FOOTER_RE.test(c))
    ) {
      continue;
    }

    const rowYear = cleanYearCell(get('year'));
    if (rowYear !== null) currentYear = rowYear;
    const rowMonth = cleanMonthCell(get('month'));
    if (rowMonth !== null) currentMonth = rowMonth;

    let paidOn = fullDateDirect;
    if (!paidOn && map.day !== null && map.day !== undefined) {
      const dayRaw = get('day');
      paidOn = cleanFullDateCell(dayRaw);
      if (!paidOn) {
        const dayNum = cleanDayCell(dayRaw);
        if (dayNum !== null && currentMonth !== null) {
          paidOn = formatIsoDate(currentYear ?? fallbackYear, currentMonth, dayNum);
        }
      }
    }

    const amount = cleanMoneyCell(get('amount'));
    if (!paidOn && !amount) continue;

    let gross = cleanMoneyCell(get('gross'));
    let tax = cleanMoneyCell(get('tax'));
    let deductions = cleanMoneyCell(get('deductions'));
    if (
      gross === '0.00' &&
      (tax === null || tax === '0.00') &&
      (deductions === null || deductions === '0.00')
    ) {
      gross = null;
    }
    if (gross === null && tax === '0.00') tax = null;
    if (gross === null && deductions === '0.00') deductions = null;

    const sourceName =
      get('source_name')?.trim() || override.defaultSource.trim() || null;
    const note = get('note')?.trim() || override.defaultNote.trim() || null;

    const warnings: string[] = [];
    if (!paidOn) warnings.push('Pay date not found');
    if (!amount || Number(amount) <= 0) warnings.push('Take-home amount not found');

    out.push({
      source_name: sourceName,
      raw_source_name: sourceName,
      paid_on: paidOn,
      amount,
      gross,
      tax,
      deductions,
      hours: cleanHoursCell(get('hours')),
      note,
      sheet_name: sheet.name,
      document_type: 'tabular',
      confidence: warnings.length > 0 ? 0.5 : 1,
      warnings,
    });
  }

  return out;
}
