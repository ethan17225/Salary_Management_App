import type { Paycheque, Source, SourceKind, UpcomingPayday } from '@/types/payday';

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export const fmt = (cents: number): string => CAD.format(cents / 100);

export const formatDollars = (dollars: number): string => CAD.format(dollars);

export const shortCurrency = (val: number | string): string => {
  const v = Number(val);
  return v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`;
};

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const KIND_LABELS: Record<SourceKind, string> = {
  job: 'Job',
  government: 'Government',
  other: 'Other',
};

export const SOURCE_COLORS = [
  '#0d7480',
  '#c2410c',
  '#2563eb',
  '#4d7c0f',
  '#b45309',
  '#be123c',
  '#0e7490',
  '#475569',
] as const;

export const pad = (n: number): string => String(n).padStart(2, '0');

export const iso = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDate = (s: string): Date =>
  new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));

export const addDays = (s: string, n: number): string => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};

export const diffDays = (a: string, b: string): number =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 864e5);

export const dateLabel = (
  s: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string => parseDate(s).toLocaleDateString('en-CA', opts);

export const monthLabel = (ym: string): string =>
  dateLabel(`${ym}-01`, { month: 'long', year: 'numeric' });

export const sumCents = (ps: Pick<Paycheque, 'amount_cents'>[]): number =>
  ps.reduce((total, p) => total + p.amount_cents, 0);

export const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

// ponytail: median-gap heuristic; add explicit recurrence rules if schedules get irregular.
export function computeUpcomingPaydays(
  sources: Source[],
  paycheques: Paycheque[],
  today: string
): UpcomingPayday[] {
  if (!today) return [];
  return sources
    .filter((s) => !s.archived)
    .map((source) => {
      const ps = paycheques.filter((p) => p.source_id === source.id).reverse();
      if (ps.length < 3) return null;
      const recent = ps.slice(-7);
      const gap = Math.round(
        median(recent.slice(1).map((p, i) => diffDays(recent[i].paid_on, p.paid_on)))
      );
      const last = ps.at(-1)!.paid_on;
      if (gap < 1 || diffDays(last, today) > gap * 2 + 7) return null;
      return {
        source,
        gap,
        next: addDays(last, gap),
        amount: median(ps.slice(-4).map((p) => p.amount_cents)),
      };
    })
    .filter((item): item is UpcomingPayday => item !== null)
    .sort((a, b) => (a.next < b.next ? -1 : 1));
}

export function buildTimelineMonths(paycheques: Paycheque[], fallbackYear: number): string[] {
  if (!paycheques.length) {
    return MONTHS.map((_, m) => `${fallbackYear}-${pad(m + 1)}`);
  }
  const [sy, sm] = paycheques.at(-1)!.paid_on.slice(0, 7).split('-').map(Number);
  const [ey, em] = paycheques[0].paid_on.slice(0, 7).split('-').map(Number);
  const out: string[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, (m = 1)) : m++) {
    out.push(`${y}-${pad(m)}`);
  }
  return out;
}

