import type { AllocationRule } from '@/lib/allocation-engine';
import type { Paycheque, Source } from '@/types/payday';

export interface PaychequesPageData {
  sources: Source[];
  paycheques: Paycheque[];
  allocations: AllocationRule[];
  years: number[];
}

export interface PaychequeFilterParams {
  year?: string;
  source?: string;
  q?: string;
}

