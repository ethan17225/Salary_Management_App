// frontend/src/lib/forecast-engine.ts

export interface StreamForecast {
  source_id: number;
  source_name: string;
  kind: 'job' | 'government' | 'other';
  color: string;
  cadence_days: number;
  is_manual_cadence: boolean;
  active_until: string | null;
  remaining_paycheques: number;
  expected_per_cheque_cents: number;
  average_hours_per_cheque: number | null;
  effective_net_hourly_cents: number | null;
  projected_remaining_cents: number;
  next_pay_date: string | null;
  upcoming_dates: string[];
}

export interface UpcomingTimelineItem {
  date: string;
  source_id: number;
  source_name: string;
  color: string;
  estimated_cents: number;
}

export interface ScheduleForecastReport {
  year: number;
  reference_date: string;
  ytd_cents: number;
  linear_projected_year_end_cents: number;
  schedule_projected_remaining_cents: number;
  schedule_projected_year_end_cents: number;
  schedule_vs_linear_delta_cents: number;
  total_remaining_paycheques: number;
  goal_cents: number | null;
  goal_achieved_or_on_track: boolean;
  predicted_goal_date: string | null;
  goal_shortfall_cents: number;
  extra_per_cheque_needed_cents: number;
  streams: StreamForecast[];
  upcoming_timeline: UpcomingTimelineItem[];
}

export interface StreamSimulationOverride {
  source_id: number;
  hourly_delta_cents: number;      // e.g. +250 = +$2.50/hr raise
  raise_percentage_bps: number;    // e.g. 500 = +5.0% raise
  hours_delta_per_cheque: number;  // e.g. +5 hours overtime per period
  remaining_cheques_override: number | null; // e.g. extend co-op by 4 cheques
}

export interface SimulationResult {
  baselineYearEndCents: number;
  simulatedYearEndCents: number;
  netYearEndGainCents: number;
  simulatedRemainingCents: number;
  annualizedRunRateCents: number;
  annualizedRunRateGainCents: number;
  goalCents: number | null;
  simulatedGoalDeltaCents: number | null; // positive = surplus above goal, negative = shortfall
  predictedGoalDate: string | null;
  perStreamResults: Array<{
    source_id: number;
    source_name: string;
    color: string;
    baselinePerChequeCents: number;
    simulatedPerChequeCents: number;
    perChequeDeltaCents: number;
    simulatedRemainingCheques: number;
    simulatedStreamRemainingCents: number;
    annualizedStreamCents: number;
  }>;
}

/**
 * Pure, zero-latency What-If Compensation & Scenario Simulator.
 */
export function simulateCompensationScenario(
  forecast: ScheduleForecastReport,
  overridesBySourceId: Record<number, Partial<StreamSimulationOverride>>,
  oneTimeWindfallCents = 0
): SimulationResult {
  let simulatedRemainingCents = Math.max(0, Math.trunc(oneTimeWindfallCents));
  let baselineAnnualRunRateCents = 0;
  let simulatedAnnualRunRateCents = 0;

  const perStreamResults = forecast.streams.map((stream) => {
    const ov = overridesBySourceId[stream.source_id] ?? {};
    const hourlyDeltaCents = Math.trunc(ov.hourly_delta_cents ?? 0);
    const raiseBps = Math.trunc(ov.raise_percentage_bps ?? 0);
    const hoursDelta = ov.hours_delta_per_cheque ?? 0;
    const remCheques =
      ov.remaining_cheques_override !== undefined && ov.remaining_cheques_override !== null
        ? Math.max(0, Math.trunc(ov.remaining_cheques_override))
        : stream.remaining_paycheques;

    let simPerChequeCents = stream.expected_per_cheque_cents;

    if (
      stream.average_hours_per_cheque !== null &&
      stream.average_hours_per_cheque > 0 &&
      stream.effective_net_hourly_cents !== null
    ) {
      const baseHourly = stream.effective_net_hourly_cents;
      const bumpedHourly = Math.floor(
        ((baseHourly + hourlyDeltaCents) * (10000 + raiseBps) + 5000) / 10000
      );
      const simHours = Math.max(0, stream.average_hours_per_cheque + hoursDelta);
      simPerChequeCents = Math.max(0, Math.round(bumpedHourly * simHours));
    } else {
      // Flat/salaried stream percentage adjustment + optional hourly*40 fallback
      const afterPct = Math.floor(
        (stream.expected_per_cheque_cents * (10000 + raiseBps) + 5000) / 10000
      );
      const assumedHours = stream.cadence_days === 14 ? 80 : stream.cadence_days === 7 ? 40 : 0;
      simPerChequeCents = Math.max(
        0,
        afterPct + hourlyDeltaCents * assumedHours
      );
    }

    const periodsPerYear = Math.max(1, Math.floor(365 / Math.max(1, stream.cadence_days)));
    const baseAnnual = stream.expected_per_cheque_cents * periodsPerYear;
    const simAnnual = simPerChequeCents * periodsPerYear;

    baselineAnnualRunRateCents += baseAnnual;
    simulatedAnnualRunRateCents += simAnnual;

    const simStreamRemaining = remCheques * simPerChequeCents;
    simulatedRemainingCents += simStreamRemaining;

    return {
      source_id: stream.source_id,
      source_name: stream.source_name,
      color: stream.color,
      baselinePerChequeCents: stream.expected_per_cheque_cents,
      simulatedPerChequeCents: simPerChequeCents,
      perChequeDeltaCents: simPerChequeCents - stream.expected_per_cheque_cents,
      simulatedRemainingCheques: remCheques,
      simulatedStreamRemainingCents: simStreamRemaining,
      annualizedStreamCents: simAnnual,
    };
  });

  const simulatedYearEndCents = forecast.ytd_cents + simulatedRemainingCents;
  const netYearEndGainCents =
    simulatedYearEndCents - forecast.schedule_projected_year_end_cents;

  // Recompute Goal Crossover Date using simulated per-cheque amounts
  let predictedGoalDate: string | null = null;
  const simChequeMap = new Map<number, number>();
  perStreamResults.forEach((r) => simChequeMap.set(r.source_id, r.simulatedPerChequeCents));

  if (forecast.goal_cents && forecast.goal_cents > 0) {
    let running = forecast.ytd_cents + Math.max(0, Math.trunc(oneTimeWindfallCents));
    if (running >= forecast.goal_cents) {
      predictedGoalDate = forecast.reference_date;
    } else {
      for (const item of forecast.upcoming_timeline) {
        running += simChequeMap.get(item.source_id) ?? item.estimated_cents;
        if (running >= forecast.goal_cents) {
          predictedGoalDate = item.date;
          break;
        }
      }
    }
  }

  return {
    baselineYearEndCents: forecast.schedule_projected_year_end_cents,
    simulatedYearEndCents,
    netYearEndGainCents,
    simulatedRemainingCents,
    annualizedRunRateCents: simulatedAnnualRunRateCents,
    annualizedRunRateGainCents: simulatedAnnualRunRateCents - baselineAnnualRunRateCents,
    goalCents: forecast.goal_cents,
    simulatedGoalDeltaCents:
      forecast.goal_cents !== null ? simulatedYearEndCents - forecast.goal_cents : null,
    predictedGoalDate,
    perStreamResults,
  };
}

