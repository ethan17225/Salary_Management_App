import type { Paycheque, Source } from '@/types/payday';

export interface PaychequesPageData {
  sources: Source[];
  paycheques: Paycheque[];
  years: number[];
}

export interface PaychequeFilterParams {
  year?: string;
  source?: string;
  q?: string;
}

