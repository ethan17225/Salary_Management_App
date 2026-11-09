'use client';

import { useState, type CSSProperties } from 'react';
import {
  simulateCompensationScenario,
  type ScheduleForecastReport,
  type StreamSimulationOverride,
} from '@/lib/forecast-engine';
import { diffDays, fmt, plural } from '@/lib/utils';

export function RaiseSimulatorCard({ forecast }: { forecast: ScheduleForecastReport }) {
  const streams = forecast.streams;
  const [selectedSourceId, setSelectedSourceId] = useState<number>(
    streams[0]?.source_id ?? 0
  );
  const [overrides, setOverrides] = useState<Record<number, Partial<StreamSimulationOverride>>>({});
  const [windfallDollars, setWindfallDollars] = useState<string>('');

  if (streams.length === 0) {
    return (
      <article className="card s12">
        <div className="card-h">
          <h2>Schedule-Aware Raise &amp; Scenario Simulator</h2>
        </div>
        <p className="muted">
          Add an active income source with recurring paycheques (or set a manual cadence on a
          source) to unlock interactive compensation and co-op term simulations.
        </p>
      </article>
    );
  }

  const activeStream =
    streams.find((s) => s.source_id === selectedSourceId) ?? streams[0];
  const curOv = overrides[activeStream.source_id] ?? {};

  const hourlyDeltaDollars = ((curOv.hourly_delta_cents ?? 0) / 100).toFixed(2);
  const raisePct = ((curOv.raise_percentage_bps ?? 0) / 100).toFixed(1);
  const hoursDelta = curOv.hours_delta_per_cheque ?? 0;
  const remOverride =
    curOv.remaining_cheques_override !== undefined && curOv.remaining_cheques_override !== null
      ? curOv.remaining_cheques_override
      : activeStream.remaining_paycheques;

  const windfallCents = Math.max(
    0,
    Math.round((Number(windfallDollars.replace(/[$,]/g, '')) || 0) * 100)
  );

  const sim = simulateCompensationScenario(forecast, overrides, windfallCents);
  const streamResult =
    sim.perStreamResults.find((r) => r.source_id === activeStream.source_id) ??
    sim.perStreamResults[0];

  const updateActiveOverride = (patch: Partial<StreamSimulationOverride>) => {
    setOverrides((prev) => ({
      ...prev,
      [activeStream.source_id]: {
        ...prev[activeStream.source_id],
        source_id: activeStream.source_id,
        ...patch,
      },
    }));
  };

  const resetSimulation = () => {
    setOverrides({});
    setWindfallDollars('');
  };

  const daysSaved =
    forecast.predicted_goal_date && sim.predictedGoalDate
      ? diffDays(sim.predictedGoalDate, forecast.predicted_goal_date)
      : null;

  return (
    <article className="card s12">
      <div className="card-h">
        <div>
          <h2>Schedule-Aware Raise &amp; Co-op Simulator</h2>
          <p className="muted" style={{ fontSize: '14px', marginTop: '2px' }}>
            Model hourly raises, overtime shifts, contract extensions, or year-end windfalls in real
            time.
          </p>
        </div>
        <button type="button" className="btn" onClick={resetSimulation}>
          Reset Simulation
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="Active income streams">
        {streams.map((s) => {
          const isSelected = s.source_id === activeStream.source_id;
          return (
            <button
              key={s.source_id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className="btn"
              style={
                {
                  '--c': s.color,
                  borderRadius: '99px',
                  borderColor: isSelected ? s.color : undefined,
                  background: isSelected
                    ? `color-mix(in srgb, ${s.color} 10%, #fff)`
                    : undefined,
                } as CSSProperties
              }
              onClick={() => setSelectedSourceId(s.source_id)}
            >
              <span className="dot" style={{ '--c': s.color } as CSSProperties} />
              {s.source_name}
              <span className="muted num" style={{ fontSize: '12px' }}>
                {s.remaining_paycheques} left · {s.cadence_days}d
              </span>
            </button>
          );
        })}
      </div>

      <div className="sim-controls-grid">
        <div className="sim-slider-group">
          <div className="sim-slider-header">
            <label htmlFor="simHourlyRaise">Hourly Raise (+$/h)</label>
            <span className="num">+{fmt(curOv.hourly_delta_cents ?? 0)}/h</span>
          </div>
          <input
            id="simHourlyRaise"
            type="range"
            min="0"
            max="15"
            step="0.5"
            className="sim-range-input"
            value={hourlyDeltaDollars}
            onChange={(e) =>
              updateActiveOverride({
                hourly_delta_cents: Math.round(Number(e.target.value) * 100),
              })
            }
          />
          <input
            type="number"
            min="0"
            max="50"
            step="0.5"
            className="num"
            aria-label="Hourly Raise Dollars"
            value={hourlyDeltaDollars}
            onChange={(e) =>
              updateActiveOverride({
                hourly_delta_cents: Math.max(0, Math.round(Number(e.target.value) * 100)),
              })
            }
          />
        </div>

        <div className="sim-slider-group">
          <div className="sim-slider-header">
            <label htmlFor="simPctRaise">Percentage Raise (%)</label>
            <span className="num">+{raisePct}%</span>
          </div>
          <div className="chips">
            {[3, 5, 10, 15].map((pct) => (
              <button
                key={pct}
                type="button"
                className="btn same"
                onClick={() => updateActiveOverride({ raise_percentage_bps: pct * 100 })}
              >
                +{pct}%
              </button>
            ))}
          </div>
          <input
            id="simPctRaise"
            type="number"
            min="0"
            max="30"
            step="0.5"
            className="num"
            value={raisePct}
            onChange={(e) =>
              updateActiveOverride({
                raise_percentage_bps: Math.max(
                  0,
                  Math.min(3000, Math.round(Number(e.target.value) * 100))
                ),
              })
            }
          />
        </div>

        <div className="sim-slider-group">
          <div className="sim-slider-header">
            <label htmlFor="simHoursDelta">Hours Delta per Paycheque</label>
            <span className="num">
              {hoursDelta >= 0 ? `+${hoursDelta}h` : `${hoursDelta}h`}
            </span>
          </div>
          <input
            id="simHoursDelta"
            type="range"
            min="-20"
            max="20"
            step="1"
            className="sim-range-input"
            value={hoursDelta}
            onChange={(e) =>
              updateActiveOverride({ hours_delta_per_cheque: Number(e.target.value) })
            }
          />
          <span className="muted" style={{ fontSize: '12px' }}>
            {activeStream.average_hours_per_cheque
              ? `Baseline: ${activeStream.average_hours_per_cheque}h / cheque`
              : 'Log hours on paycheques for exact shift simulation'}
          </span>
        </div>

        <div className="sim-slider-group">
          <div className="sim-slider-header">
            <span>Remaining Cheques &amp; Windfall</span>
            <span className="num">{plural(remOverride, 'cheque')}</span>
          </div>
          <div className="row2">
            <label className="field" style={{ fontSize: '12px' }}>
              Cheques left
              <input
                type="number"
                min="0"
                max="52"
                className="num"
                value={remOverride}
                onChange={(e) =>
                  updateActiveOverride({
                    remaining_cheques_override: Math.max(0, Math.trunc(Number(e.target.value))),
                  })
                }
              />
            </label>
            <label className="field" style={{ fontSize: '12px' }}>
              One-Time Windfall ($)
              <input
                type="number"
                min="0"
                step="50"
                placeholder="0.00"
                className="num"
                value={windfallDollars}
                onChange={(e) => setWindfallDollars(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="sim-impact-banner">
        <div>
          <p className="label">Simulated Year-End Total</p>
          <p className="val num" style={{ fontSize: '24px', fontWeight: 500 }}>
            {fmt(sim.simulatedYearEndCents)}
          </p>
          <p className="sub">
            <span className="pill-goal-date">
              {sim.netYearEndGainCents >= 0 ? '+' : ''}
              {fmt(sim.netYearEndGainCents)} this year
            </span>
          </p>
        </div>

        <div>
          <p className="label">Simulated Per-Cheque Net ({activeStream.source_name})</p>
          <p className="val num" style={{ fontSize: '24px', fontWeight: 500 }}>
            {fmt(streamResult.simulatedPerChequeCents)}
          </p>
          <p className="sub num">
            {streamResult.perChequeDeltaCents >= 0 ? '+' : ''}
            {fmt(streamResult.perChequeDeltaCents)} / cheque
          </p>
        </div>

        <div>
          <p className="label">Annualized Full-Year Run-Rate</p>
          <p className="val num" style={{ fontSize: '24px', fontWeight: 500 }}>
            {fmt(sim.annualizedRunRateCents)} / yr
          </p>
          <p className="sub">
            {sim.predictedGoalDate ? (
              <span className="pill-goal-date">
                Goal hit on {sim.predictedGoalDate}
                {daysSaved && daysSaved > 0 ? ` (${plural(daysSaved, 'day')} earlier)` : ''}
              </span>
            ) : (
              <span className="muted num">
                {sim.annualizedRunRateGainCents >= 0 ? '+' : ''}
                {fmt(sim.annualizedRunRateGainCents)} / yr vs baseline
              </span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}

