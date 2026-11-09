// frontend/src/lib/allocation-engine.ts

export type AllocationCategory = 'essentials' | 'investments' | 'savings' | 'lifestyle';

export interface AllocationRule {
  id: number;
  name: string;
  category: AllocationCategory;
  weight_bps: number; // 10000 = 100.00%
  color: string;
  sort_order: number;
  active: number | boolean;
}

export interface AllocatedBucket {
  rule_id: number;
  name: string;
  category: AllocationCategory;
  color: string;
  weight_bps: number;
  allocated_cents: number;
}

export interface PaychequeAllocationResult {
  grossOrNetCents: number;
  taxReserveCents: number;
  distributableCents: number;
  allocatedTotalCents: number;
  unallocatedCents: number;
  buckets: AllocatedBucket[];
}

export interface AggregateBucketSummary {
  rule_id: number;
  name: string;
  category: AllocationCategory;
  color: string;
  weight_bps: number;
  total_allocated_cents: number;
  average_per_cheque_cents: number;
}

export interface AggregateAllocationReport {
  paychequeCount: number;
  totalNetCents: number;
  totalTaxReserveCents: number;
  totalDistributableCents: number;
  totalAllocatedCents: number;
  totalUnallocatedCents: number;
  totalActiveBps: number;
  unallocatedBps: number;
  buckets: AggregateBucketSummary[];
  byCategoryCents: Record<AllocationCategory, number>;
}

/**
 * Splits a single distributable cent amount across active rules using the Largest Remainder Method.
 * Guarantees: sum(buckets.allocated_cents) + unallocatedCents === distributableCents.
 */
export function allocateCentsLargestRemainder(
  distributableCents: number,
  rules: AllocationRule[],
  taxReserveCents = 0
): PaychequeAllocationResult {
  const safeDistributable = Math.max(0, Math.trunc(distributableCents));
  const activeRules = rules
    .filter((r) => Boolean(r.active) && r.weight_bps > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  if (safeDistributable === 0 || activeRules.length === 0) {
    return {
      grossOrNetCents: safeDistributable + taxReserveCents,
      taxReserveCents,
      distributableCents: safeDistributable,
      allocatedTotalCents: 0,
      unallocatedCents: safeDistributable,
      buckets: activeRules.map((r) => ({
        rule_id: r.id,
        name: r.name,
        category: r.category,
        color: r.color,
        weight_bps: r.weight_bps,
        allocated_cents: 0,
      })),
    };
  }

  const totalBps = Math.min(
    10000,
    activeRules.reduce((sum, r) => sum + r.weight_bps, 0)
  );
  const poolCents = Math.floor((safeDistributable * totalBps) / 10000);
  const unallocatedCents = safeDistributable - poolCents;

  const quotients: number[] = [];
  const remainders: { rem: number; idx: number }[] = [];

  activeRules.forEach((rule, idx) => {
    const prod = safeDistributable * rule.weight_bps;
    const q = Math.floor(prod / 10000);
    const rem = prod % 10000;
    quotients.push(q);
    remainders.push({ rem, idx });
  });

  const shortfall = poolCents - quotients.reduce((a, b) => a + b, 0);
  remainders.sort((a, b) => b.rem - a.rem || a.idx - b.idx);

  for (let i = 0; i < shortfall; i++) {
    quotients[remainders[i].idx] += 1;
  }

  return {
    grossOrNetCents: safeDistributable + taxReserveCents,
    taxReserveCents,
    distributableCents: safeDistributable,
    allocatedTotalCents: poolCents,
    unallocatedCents,
    buckets: activeRules.map((rule, idx) => ({
      rule_id: rule.id,
      name: rule.name,
      category: rule.category,
      color: rule.color,
      weight_bps: rule.weight_bps,
      allocated_cents: quotients[idx],
    })),
  };
}

/**
 * Computes paycheque-by-paycheque exact allocations across a filtered list of paycheques
 * and aggregates the totals per rule and per category.
 */
export function computeAggregateAllocations(
  paycheques: Array<{
    id: number;
    source_id: number;
    amount_cents: number;
    tax_cents?: number | null;
  }>,
  rules: AllocationRule[],
  sourcesById?: Map<
    number,
    { is_tax_withheld?: number | boolean; tax_reserve_bps?: number }
  >
): AggregateAllocationReport {
  const activeRules = rules
    .filter((r) => Boolean(r.active) && r.weight_bps > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const totalActiveBps = Math.min(
    10000,
    activeRules.reduce((sum, r) => sum + r.weight_bps, 0)
  );

  const bucketTotals = new Map<number, number>();
  activeRules.forEach((r) => bucketTotals.set(r.id, 0));

  const byCategoryCents: Record<AllocationCategory, number> = {
    essentials: 0,
    investments: 0,
    savings: 0,
    lifestyle: 0,
  };

  let totalNetCents = 0;
  let totalTaxReserveCents = 0;
  let totalDistributableCents = 0;
  let totalAllocatedCents = 0;
  let totalUnallocatedCents = 0;

  for (const p of paycheques) {
    const src = sourcesById?.get(p.source_id);
    const isWithheld =
      src?.is_tax_withheld === undefined ? true : Boolean(src.is_tax_withheld);
    const reserveBps = src?.tax_reserve_bps ?? 0;
    const explicitTax = p.tax_cents ?? 0;

    const taxReserveCents =
      !isWithheld && reserveBps > 0 && explicitTax === 0
        ? Math.floor((p.amount_cents * reserveBps + 5000) / 10000)
        : 0;

    const distributable = Math.max(0, p.amount_cents - taxReserveCents);
    const split = allocateCentsLargestRemainder(distributable, activeRules, taxReserveCents);

    totalNetCents += p.amount_cents;
    totalTaxReserveCents += taxReserveCents;
    totalDistributableCents += split.distributableCents;
    totalAllocatedCents += split.allocatedTotalCents;
    totalUnallocatedCents += split.unallocatedCents;

    for (const b of split.buckets) {
      bucketTotals.set(b.rule_id, (bucketTotals.get(b.rule_id) ?? 0) + b.allocated_cents);
      byCategoryCents[b.category] += b.allocated_cents;
    }
  }

  const count = paycheques.length;
  const buckets: AggregateBucketSummary[] = activeRules.map((r) => {
    const total = bucketTotals.get(r.id) ?? 0;
    return {
      rule_id: r.id,
      name: r.name,
      category: r.category,
      color: r.color,
      weight_bps: r.weight_bps,
      total_allocated_cents: total,
      average_per_cheque_cents: count > 0 ? Math.round(total / count) : 0,
    };
  });

  return {
    paychequeCount: count,
    totalNetCents,
    totalTaxReserveCents,
    totalDistributableCents,
    totalAllocatedCents,
    totalUnallocatedCents,
    totalActiveBps,
    unallocatedBps: Math.max(0, 10000 - totalActiveBps),
    buckets,
    byCategoryCents,
  };
}

