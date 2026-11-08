import type { Paycheque, Source, UpcomingPayday } from '@/types/payday';
import type { YearOption } from '@/components/ui/year-dropdown';

export interface SparkItem {
  k: string;
  y: number;
  m: number;
  v: number;
}

export interface SparkYearSpan {
  y: number;
  span: number;
}

export interface SourceCardSummary {
  source: Source;
  paycheques: Paycheque[];
  totalCents: number;
  timedHours: number;
  timedCents: number;
  spark: {
    items: SparkItem[];
    yrs: SparkYearSpan[];
    max: number;
  };
}

export interface SourceDetailData {
  source: Source;
  srcAllPs: Paycheque[];
  srcYears: number[];
  srcYear: 'all' | number;
  srcIsAll: boolean;
  srcPs: Paycheque[];
  srcSum: number;
  srcSharePct: number;
  srcAvg: number;
  srcMaxP: Paycheque | null;
  srcMinP: Paycheque | null;
  srcMedian: number;
  srcTimedCount: number;
  srcHours: number;
  srcTimedSum: number;
  srcActiveMonths: number;
  srcBestMonth: [string, number] | null;
  srcCadence: {
    weekday: string | null;
    gap: number | null;
  };
  srcTimeline: string[];
  srcYearOptions: YearOption[];
  upcomingForSource: UpcomingPayday | null;
}

