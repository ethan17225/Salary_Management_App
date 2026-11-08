import type { Paycheque, Source, UpcomingPayday } from '@/types/payday';
import type { YearOption } from '@/components/ui/year-dropdown';

export interface OverviewData {
  sources: Source[];
  paycheques: Paycheque[];
  today: string;
  curYear: number;
  activeYear: 'all' | number;
  isAll: boolean;
  isCur: boolean;
  inY: Paycheque[];
  sumY: number;
  bySrcEntries: [number, number][];
  timelineMonths: string[];
  prevTotal: number;
  prevPct: number | null;
  thisMonthTotal: number;
  paidYearCount: number;
  activeMonths: number;
  bestPeriodMonth: [string, number] | null;
  topSrc: [number, number] | null;
  goal: number;
  goalYear: number;
  goalSum: number;
  goalIsCur: boolean;
  goalPct: number;
  daysInYr: number;
  daysDone: number;
  goalLeft: number;
  monthsLeft: number;
  yearOptions: YearOption[];
  bestEver: [string, number] | null;
  biggest: Paycheque | null;
  upcoming: UpcomingPayday[];
}

