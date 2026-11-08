export type SourceKind = 'job' | 'government' | 'other';

export interface Source {
  id: number;
  name: string;
  kind: SourceKind;
  color: string;
  archived: number;
}

export interface Paycheque {
  id: number;
  source_id: number;
  paid_on: string;
  amount_cents: number;
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

