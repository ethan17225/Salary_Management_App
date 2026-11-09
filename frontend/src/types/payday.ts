import type { AllocationRule } from '@/lib/allocation-engine';
import type { ScheduleForecastReport } from '@/lib/forecast-engine';

export type SourceKind = 'job' | 'government' | 'other';

export interface Source {
  id: number;
  name: string;
  kind: SourceKind;
  color: string;
  archived: number;
  is_tax_withheld?: number;
  tax_reserve_bps?: number;
  expected_cadence_days?: number | null;
  active_until?: string | null;
  target_hourly_cents?: number | null;
}

export interface Paycheque {
  id: number;
  source_id: number;
  paid_on: string;
  amount_cents: number;
  gross_cents?: number | null;
  tax_cents?: number | null;
  deductions_cents?: number | null;
  hours: number | null;
  note: string;
}

export interface PaydaySettings {
  goal_cents?: string;
  [key: string]: string | undefined;
}

export interface PaydayState {
  sources: Source[];
  paycheques: Paycheque[];
  settings: PaydaySettings;
  allocations: AllocationRule[];
  forecast?: ScheduleForecastReport | null;
}

export interface UpcomingPayday {
  source: Source;
  gap: number;
  next: string;
  amount: number;
}

export type ActionState<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

