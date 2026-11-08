export interface PaychequeRecord {
  id: number;
  source_id: number;
  paid_on: string;
  amount_cents: number;
  gross_cents?: number | null;
  tax_cents?: number | null;
  deductions_cents?: number | null;
  hours?: number | null;
  note?: string;
}

export interface SourceRecord {
  id: number;
  name: string;
  kind: 'job' | 'government' | 'other';
  color: string;
  archived: number | boolean;
  is_tax_withheld?: number | boolean;
  tax_reserve_bps?: number;
}

export interface PaychequeTaxBreakdown {
  netCents: number;
  hasGrossBreakdown: boolean;
  effectiveGrossCents: number;
  explicitTaxCents: number;
  explicitDeductionsCents: number;
  unclassifiedWithheldCents: number;
  totalWithheldCents: number;
  netRetentionBps: number; // 10000 = 100.00%
  contractorTaxReserveCents: number;
  trueSpendableNetCents: number;
  grossHourlyCents: number | null;
  netHourlyCents: number | null;
}

export interface AggregateTaxSummary {
  totalNetCents: number;
  totalEffectiveGrossCents: number;
  totalWithheldCents: number;
  totalExplicitTaxCents: number;
  totalExplicitDeductionsCents: number;
  breakdownCoverageCount: number;
  totalPaychequeCount: number;
  effectiveDeductionRateBps: number; // Calculated across paycheques that have gross_cents logged
  netRetentionRateBps: number;
  totalUntaxedNetCents: number;
  totalContractorTaxReserveCents: number;
  totalTrueSpendableNetCents: number;
  effectiveGrossHourlyCents: number | null;
  effectiveNetHourlyCents: number | null;
}

/**
 * Computes exact integer-cent tax & gross-to-net metrics for a single paycheque.
 */
export function computePaychequeBreakdown(
  paycheque: PaychequeRecord,
  source?: SourceRecord
): PaychequeTaxBreakdown {
  const netCents = paycheque.amount_cents;
  const hasGrossBreakdown =
    typeof paycheque.gross_cents === 'number' && paycheque.gross_cents >= netCents;

  const effectiveGrossCents = hasGrossBreakdown ? paycheque.gross_cents! : netCents;
  const totalWithheldCents = hasGrossBreakdown ? effectiveGrossCents - netCents : 0;

  const explicitTaxCents = hasGrossBreakdown ? (paycheque.tax_cents ?? 0) : 0;
  const explicitDeductionsCents = hasGrossBreakdown ? (paycheque.deductions_cents ?? 0) : 0;
  const unclassifiedWithheldCents = Math.max(
    0,
    totalWithheldCents - explicitTaxCents - explicitDeductionsCents
  );

  const netRetentionBps =
    effectiveGrossCents > 0
      ? Math.round((netCents * 10000) / effectiveGrossCents)
      : 10000;

  // Contractor tax reserve applies if source is marked untaxed and no tax was withheld on stub
  const isTaxWithheld =
    source?.is_tax_withheld === undefined ? true : Boolean(source.is_tax_withheld);
  const reserveBps = source?.tax_reserve_bps ?? 0;

  const contractorTaxReserveCents =
    !isTaxWithheld && reserveBps > 0 && explicitTaxCents === 0
      ? Math.floor((netCents * reserveBps + 5000) / 10000)
      : 0;

  const trueSpendableNetCents = netCents - contractorTaxReserveCents;

  const hasHours = typeof paycheque.hours === 'number' && paycheque.hours > 0;
  const grossHourlyCents = hasHours
    ? Math.round(effectiveGrossCents / paycheque.hours!)
    : null;
  const netHourlyCents = hasHours
    ? Math.round(netCents / paycheque.hours!)
    : null;

  return {
    netCents,
    hasGrossBreakdown,
    effectiveGrossCents,
    explicitTaxCents,
    explicitDeductionsCents,
    unclassifiedWithheldCents,
    totalWithheldCents,
    netRetentionBps,
    contractorTaxReserveCents,
    trueSpendableNetCents,
    grossHourlyCents,
    netHourlyCents,
  };
}

/**
 * Aggregates Gross-to-Net and Tax Reserve intelligence across a filtered set of paycheques.
 */
export function computeAggregateTaxSummary(
  paycheques: PaychequeRecord[],
  sourcesById: Map<number, SourceRecord>
): AggregateTaxSummary {
  let totalNetCents = 0;
  let totalEffectiveGrossCents = 0;
  let totalWithheldCents = 0;
  let totalExplicitTaxCents = 0;
  let totalExplicitDeductionsCents = 0;

  let trackedGrossSumCents = 0;
  let trackedNetSumCents = 0;
  let breakdownCoverageCount = 0;

  let totalUntaxedNetCents = 0;
  let totalContractorTaxReserveCents = 0;

  let timedGrossCents = 0;
  let timedNetCents = 0;
  let timedHours = 0;

  for (const p of paycheques) {
    const source = sourcesById.get(p.source_id);
    const b = computePaychequeBreakdown(p, source);

    totalNetCents += b.netCents;
    totalEffectiveGrossCents += b.effectiveGrossCents;
    totalWithheldCents += b.totalWithheldCents;
    totalExplicitTaxCents += b.explicitTaxCents;
    totalExplicitDeductionsCents += b.explicitDeductionsCents;

    if (b.hasGrossBreakdown) {
      breakdownCoverageCount += 1;
      trackedGrossSumCents += b.effectiveGrossCents;
      trackedNetSumCents += b.netCents;
    }

    if (b.contractorTaxReserveCents > 0) {
      totalUntaxedNetCents += b.netCents;
      totalContractorTaxReserveCents += b.contractorTaxReserveCents;
    }

    if (typeof p.hours === 'number' && p.hours > 0) {
      timedGrossCents += b.effectiveGrossCents;
      timedNetCents += b.netCents;
      timedHours += p.hours;
    }
  }

  // Effective deduction rate is computed across paycheques that actually logged gross pay
  const effectiveDeductionRateBps =
    trackedGrossSumCents > 0
      ? Math.round(((trackedGrossSumCents - trackedNetSumCents) * 10000) / trackedGrossSumCents)
      : 0;

  const netRetentionRateBps = 10000 - effectiveDeductionRateBps;

  return {
    totalNetCents,
    totalEffectiveGrossCents,
    totalWithheldCents,
    totalExplicitTaxCents,
    totalExplicitDeductionsCents,
    breakdownCoverageCount,
    totalPaychequeCount: paycheques.length,
    effectiveDeductionRateBps,
    netRetentionRateBps,
    totalUntaxedNetCents,
    totalContractorTaxReserveCents,
    totalTrueSpendableNetCents: totalNetCents - totalContractorTaxReserveCents,
    effectiveGrossHourlyCents: timedHours > 0 ? Math.round(timedGrossCents / timedHours) : null,
    effectiveNetHourlyCents: timedHours > 0 ? Math.round(timedNetCents / timedHours) : null,
  };
}

