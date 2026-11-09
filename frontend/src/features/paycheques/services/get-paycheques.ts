import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { iso } from '@/lib/utils';
import type { PaychequesPageData } from '../types/paycheque-types';

export const getPaychequesData = cache(async (): Promise<PaychequesPageData> => {
  const state = await db.getState();
  const curYear = +iso(new Date()).slice(0, 4);
  const yearsSet = new Set(state.paycheques.map((p) => +p.paid_on.slice(0, 4)));
  yearsSet.add(curYear);
  const years = [...yearsSet].sort((a, b) => b - a);

  return {
    sources: state.sources,
    paycheques: state.paycheques,
    allocations: state.allocations ?? [],
    years,
  };
});

