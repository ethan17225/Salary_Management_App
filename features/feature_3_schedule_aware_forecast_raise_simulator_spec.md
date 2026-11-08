# AI Agent Implementation Spec: Feature 3 — Schedule-Aware Forecast & Raise Simulator (`comp-simulator`)

> **Target System**: Payday — Salary & Income Management App
>
> **Architecture**: Next.js 14+ (App Router, TypeScript, Zod, Chart.js, Vanilla CSS) + Python Backend (`backend/app.py` & `backend/src/` FastAPI extension) + SQLite (`salary.db` in WAL mode)
>
> **Prerequisite Compatibility**: Enhances the existing Yearly Goal & Predictive Payday engines on `/` and `/sources/[id]`, and integrates cleanly with Feature 1 (`paystub-breakdown`) and Feature 2 (`allocations`) when present.
>
> **Execution Mode**: Autonomous End-to-End Implementation & Verification

---

## 0. Mission & Non-Negotiable Architectural Guardrails

You are tasked with implementing **Feature 3: Schedule-Aware Forecast & Raise Simulator (`comp-simulator`)**. Before modifying any files, inspect the existing repository and strictly enforce these rules:

1. **Integer Cents Only**: All monetary forecasts, simulated raises, goal shortfalls, and annualized run-rates MUST be calculated and stored in integer cents (`int` in Python, safe integers in TypeScript). Never use floating-point numbers to store currency.
2. **Schedule-Aware vs. Linear Velocity**: Payday currently projects year-end income using linear daily velocity:
   $$
   P_{\text{linear}} = \left\lfloor \frac{\text{YTD\_cents} \times D_{\text{year}}}{D_{\text{elapsed}}} \right\rfloor
   $$
   While $P_{\text{linear}}$ is useful as a baseline, it skews heavily during 4-month or 8-month co-op terms, seasonal shifts, or 27-pay-period bi-weekly calendar years. You will engineer a deterministic **Schedule-Aware Forecaster** that projects remaining calendar paydays per active source through December 31 (respecting contract end dates) and predicts the exact date the user will cross their annual goal.
3. **100% Backward Compatibility & Idempotent Migration**: All new columns on `sources` (`expected_cadence_days`, `active_until`, `target_hourly_cents`) MUST be nullable (`NULL` by default) and added idempotently via `PRAGMA table_info(sources)` so existing `salary.db` volumes upgrade without data loss.
4. **Zero Server Roundtrips for What-If Simulation**: The interactive Raise, Overtime & Co-op Simulator must run client-side in real time (0ms latency) using the shared TypeScript forecast engine while allowing users to persist contract end dates or cadence overrides to SQLite when desired.

---

## 1. Mathematical & Domain Model Specifications

### 1.1. Source Schedule Metadata Extensions (`sources`)

Three optional columns are added to `sources` to support fixed-term contracts (e.g., co-op terms), known pay cycles, and target hourly rates:

| Column | SQLite Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `expected_cadence_days` | `INTEGER NULL` | `CHECK (expected_cadence_days IS NULL OR (expected_cadence_days >= 1 AND expected_cadence_days <= 366))` | Optional manual cadence override in days (e.g., $7$ weekly, $14$ bi-weekly, $30$ monthly, $90$ quarterly). If `NULL`, cadence is auto-detected from deposit history. |
| `active_until` | `TEXT NULL` | `CHECK (active_until IS NULL OR date(active_until) = active_until)` | Optional contract/co-op end date (`YYYY-MM-DD`). The forecaster stops projecting paycheques for this source after `active_until`. |
| `target_hourly_cents` | `INTEGER NULL` | `CHECK (target_hourly_cents IS NULL OR target_hourly_cents > 0)` | Optional contractual hourly wage in integer cents (e.g., $2850 = \$28.50/\text{h}$) used as the baseline in the Raise Simulator. |

---

### 1.2. Deterministic Schedule-Aware Forecasting Algorithm

Given reference date $T_{\text{today}}$ in target year $Y$, let $T_{\text{year\_end}} = \text{date}(Y, 12, 31)$.

1. **Year-to-Date (YTD) Actuals**:
   $$
   \text{YTD\_cents} = \sum_{p \in \mathcal{P}_Y} p.\text{amount\_cents}
   $$
   where $\mathcal{P}_Y$ is the set of recorded paycheques with $p.\text{paid\_on}$ in year $Y$ and $p.\text{paid\_on} \le T_{\text{today}}$.

2. **Per-Source Cadence & Eligibility Detection**:
   For each non-archived source $s$ (`archived == 0`):
   * Let $p_1, p_2, \dots, p_m$ be all historical paycheques for source $s$ sorted by `paid_on ASC`.
   * Determine cadence $d_s$ (in days):
     * If $s.\text{expected\_cadence\_days}$ is not `NULL`, set $d_s = s.\text{expected\_cadence\_days}$.
     * Else if $m \ge 2$, take the most recent $k = \min(m, 6)$ deposits, compute consecutive day gaps $g_i = \text{days}(p_{m-k+i+1}.\text{paid\_on} - p_{m-k+i}.\text{paid\_on})$, and set $d_s = \text{round}(\text{median}(g_1, \dots, g_{k-1}))$.
     * Else ($m < 2$ and no override), source $s$ has insufficient history for recurring projection ($N_{\text{rem}, s} = 0$).
   * **Recency & Cadence Bounds Check**:
     * A source without an explicit `expected_cadence_days` override is considered **actively recurring** if and only if $7 \le d_s \le 95$ (covering weekly, bi-weekly, monthly, and quarterly benefits) AND the days elapsed since the last deposit $p_m.\text{paid\_on}$ satisfy:
       $$
       \text{days}(T_{\text{today}} - p_m.\text{paid\_on}) \le \max\left(\lfloor 2.5 \times d_s \rfloor, 45\right)
       $$

3. **Remaining Scheduled Paydays Generation**:
   * Define the effective cutoff date for source $s$:
     $$
     T_{\text{cutoff}, s} = \begin{cases}
     \min(T_{\text{year\_end}}, \text{date}(s.\text{active\_until})) & \text{if } s.\text{active\_until} \text{ is not NULL} \\
     T_{\text{year\_end}} & \text{otherwise}
     \end{cases}
     $$
   * Starting from anchor date $t_0 = p_m.\text{paid\_on}$, step forward $t_j = t_0 + j \cdot d_s$ for $j = 1, 2, \dots$ while $t_j \le T_{\text{cutoff}, s}$.
   * If $t_j \le T_{\text{today}}$, advance the anchor until $t_j > T_{\text{today}}$. If no deposits exist yet for a newly created source with `expected_cadence_days` set, start stepping from $t_1 = T_{\text{today}} + d_s$.
   * The resulting ordered list of future dates in year $Y$ is $\mathcal{D}_{\text{rem}, s} = [t_1, t_2, \dots, t_{N_{\text{rem}, s}}]$, with count $N_{\text{rem}, s} = |\mathcal{D}_{\text{rem}, s}|$.

4. **Expected Per-Cheque Net Amount & Hourly Baseline**:
   * Using the last $m' = \min(m, 3)$ deposits of source $s$, compute the expected integer-cent deposit:
     $$
     \hat{A}_s = \left\lfloor \frac{\sum_{j=m-m'+1}^{m} p_j.\text{amount\_cents} + \lfloor m' / 2 \rfloor}{m'} \right\rfloor
     $$
   * For deposits among the last $m'$ that have `hours > 0`, compute average hours per paycheque $\hat{H}_s$ and effective net hourly rate $\hat{W}_{\text{net}, s} = \text{round}(\hat{A}_s / \hat{H}_s)$.
   * The schedule-projected remaining income for source $s$ is:
     $$
     R_s = N_{\text{rem}, s} \times \hat{A}_s
     $$

5. **Aggregate Year-End Forecast & Goal Crossover Date**:
   * Total Schedule-Projected Year-End Income:
     $$
     P_{\text{schedule}} = \text{YTD\_cents} + \sum_{s \in \text{Active}} R_s
     $$
   * **Exact Goal Crossover Date ($T_{\text{goal}}$)**:
     Merge all upcoming projected paycheques $(t, \hat{A}_s, s.\text{name})$ across all active sources into a single chronological timeline sorted by date $t \text{ ASC}$. Accumulate running total $S_k = \text{YTD\_cents} + \sum_{i=1}^{k} \hat{A}_{(i)}$.
     * If $\text{YTD\_cents} \ge G$, goal is already achieved.
     * Else, the first projected payday $t_k$ where $S_k \ge G$ is the **Predicted Goal Achievement Date** $T_{\text{goal}}$.
     * If $P_{\text{schedule}} < G$, compute the shortfall $\Delta_{\text{goal}} = G - P_{\text{schedule}}$ and the required extra cents per remaining paycheque across $N_{\text{total\_rem}} = \sum_s N_{\text{rem}, s}$:
       $$
       \text{extra\_per\_cheque\_cents} = \left\lfloor \frac{\Delta_{\text{goal}} + N_{\text{total\_rem}} - 1}{N_{\text{total\_rem}}} \right\rfloor
       $$

---

### 1.3. Interactive Raise, Overtime & Scenario Simulator ("What-If" Engine)

Given baseline stream parameters $(\hat{A}_s, \hat{H}_s, \hat{W}_{\text{net}, s}, N_{\text{rem}, s}, d_s)$ and user-adjusted simulation parameters:
* $\Delta W_{\text{cents}}$: Hourly net wage increase in cents (or percentage boost $\beta_{\text{bps}}$ in basis points).
* $\Delta H$: Additional (or fewer) hours worked per pay period.
* $\tilde{N}_{\text{rem}, s}$: Overridden remaining paycheques in the year (e.g., extending a co-op contract).
* $B_{\text{cents}}$: One-time hypothetical bonus, signing stipend, or tax refund before year-end.

The simulated per-cheque amount $\tilde{A}_s$ is:
* **If source has hourly data ($\hat{H}_s > 0$)**:
  $$
  \tilde{W}_{\text{net}, s} = \left\lfloor \frac{(\hat{W}_{\text{net}, s} + \Delta W_{\text{cents}}) \times (10000 + \beta_{\text{bps}}) + 5000}{10000} \right\rfloor
  $$
  $$
  \tilde{A}_s = \text{round}\left(\tilde{W}_{\text{net}, s} \times \max(0, \hat{H}_s + \Delta H)\right)
  $$
* **If source is flat/salaried ($\hat{H}_s = 0$)**:
  $$
  \tilde{A}_s = \left\lfloor \frac{\hat{A}_s \times (10000 + \beta_{\text{bps}}) + 5000}{10000} \right\rfloor
  $$

The simulated year-end projection becomes:
$$
\tilde{P}_{\text{schedule}} = \text{YTD\_cents} + B_{\text{cents}} + \sum_{s \in \text{Active}} \left(\tilde{N}_{\text{rem}, s} \times \tilde{A}_s\right)
$$
And the **Annualized Full-Year Run-Rate** for source $s$ at the simulated compensation level is:
$$
\text{AnnualRunRate}_s = \tilde{A}_s \times \left\lfloor \frac{365}{d_s} \right\rfloor
$$

---

## 2. Step-by-Step Backend Implementation

### Step 2.1: Idempotent SQLite Migration (`backend/app.py`)

In `backend/app.py` (and `backend/src/models.py` if applicable), update the `sources` table creation and add an idempotent migration helper so existing databases seamlessly gain the three schedule columns:

```python
def ensure_forecast_schema(conn: sqlite3.Connection) -> None:
    """Idempotently adds schedule-aware forecasting columns to `sources`."""
    cur = conn.cursor()
    source_cols = {
        row[1] for row in cur.execute("PRAGMA table_info(sources)").fetchall()
    }

    if "expected_cadence_days" not in source_cols:
        cur.execute(
            "ALTER TABLE sources ADD COLUMN expected_cadence_days INTEGER NULL "
            "CHECK (expected_cadence_days IS NULL OR (expected_cadence_days >= 1 AND expected_cadence_days <= 366))"
        )
    if "active_until" not in source_cols:
        cur.execute(
            "ALTER TABLE sources ADD COLUMN active_until TEXT NULL "
            "CHECK (active_until IS NULL OR date(active_until) = active_until)"
        )
    if "target_hourly_cents" not in source_cols:
        cur.execute(
            "ALTER TABLE sources ADD COLUMN target_hourly_cents INTEGER NULL "
            "CHECK (target_hourly_cents IS NULL OR target_hourly_cents > 0)"
        )

    conn.commit()
```

### Step 2.2: Schedule-Aware Forecaster & Boundary Cleaners (`backend/app.py`)

Add clean boundary validators for the new `sources` fields and the pure `compute_schedule_forecast` function in `backend/app.py`:

```python
from datetime import date, timedelta
from statistics import median


def parse_expected_cadence_days(val: object) -> int | None:
    if val is None or val == "":
        return None
    try:
        days = int(val)
    except (ValueError, TypeError) as exc:
        raise ValueError("expected_cadence_days must be an integer between 1 and 366") from exc
    if not (1 <= days <= 366):
        raise ValueError("expected_cadence_days must be between 1 and 366")
    return days


def parse_active_until(val: object) -> str | None:
    if val is None:
        return None
    cleaned = str(val).strip()
    if cleaned == "":
        return None
    try:
        parsed = date.fromisoformat(cleaned)
    except ValueError as exc:
        raise ValueError("active_until must be a valid YYYY-MM-DD date") from exc
    return parsed.isoformat()


def compute_schedule_forecast(
    sources: list[dict[str, object]],
    paycheques: list[dict[str, object]],
    goal_cents: int | None,
    reference_date: date | None = None,
) -> dict[str, object]:
    """
    Computes deterministic schedule-aware year-end income projections,
    upcoming payday timeline, and goal crossover date.
    """
    today = reference_date or date.today()
    year = today.year
    year_prefix = f"{year}-"
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    days_in_year = (year_end - year_start).days + 1
    days_elapsed = max(1, (today - year_start).days + 1)

    ytd_cents = sum(
        int(p["amount_cents"])
        for p in paycheques
        if str(p["paid_on"]).startswith(year_prefix) and str(p["paid_on"]) <= today.isoformat()
    )

    linear_projected_year_end_cents = (ytd_cents * days_in_year) // days_elapsed

    stream_forecasts: list[dict[str, object]] = []
    chronological_upcoming: list[dict[str, object]] = []
    schedule_remaining_cents = 0
    total_remaining_cheques = 0

    for src in sources:
        if bool(src.get("archived")):
            continue

        src_id = int(src["id"])
        src_cheques = sorted(
            [p for p in paycheques if int(p["source_id"]) == src_id],
            key=lambda x: str(x["paid_on"]),
        )

        override_cadence = src.get("expected_cadence_days")
        cadence_days: int | None = int(override_cadence) if override_cadence is not None else None

        if cadence_days is None and len(src_cheques) >= 2:
            recent_for_gap = src_cheques[-6:]
            dates = [date.fromisoformat(str(p["paid_on"])) for p in recent_for_gap]
            gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
            detected = round(median(gaps))
            last_paid_date = dates[-1]
            max_stale_days = max(int(detected * 2.5), 45)
            if 7 <= detected <= 95 and (today - last_paid_date).days <= max_stale_days:
                cadence_days = detected

        if cadence_days is None or cadence_days <= 0:
            continue

        # Determine cutoff date (min of Dec 31 and active_until)
        cutoff_date = year_end
        active_until_str = src.get("active_until")
        if active_until_str:
            cutoff_date = min(year_end, date.fromisoformat(str(active_until_str)))

        if cutoff_date <= today:
            continue

        # Estimate expected per-cheque cents and hours from up to last 3 deposits
        recent_sample = src_cheques[-3:]
        if recent_sample:
            m_len = len(recent_sample)
            avg_cheque_cents = (
                sum(int(p["amount_cents"]) for p in recent_sample) + (m_len // 2)
            ) // m_len
            timed = [p for p in recent_sample if p.get("hours") and float(p["hours"]) > 0]
            avg_hours = (
                round(sum(float(p["hours"]) for p in timed) / len(timed), 2)
                if timed
                else None
            )
            anchor_date = date.fromisoformat(str(src_cheques[-1]["paid_on"]))
        else:
            # Brand new source with expected_cadence_days and target_hourly_cents
            target_hr = int(src["target_hourly_cents"]) if src.get("target_hourly_cents") else 0
            avg_hours = 80.0 if cadence_days == 14 else (40.0 if cadence_days == 7 else None)
            avg_cheque_cents = int(round(target_hr * (avg_hours or 0)))
            anchor_date = today

        if avg_cheque_cents <= 0:
            continue

        # Step forward from anchor_date through cutoff_date
        cursor = anchor_date + timedelta(days=cadence_days)
        while cursor <= today:
            cursor += timedelta(days=cadence_days)

        upcoming_dates: list[str] = []
        while cursor <= cutoff_date:
            iso_d = cursor.isoformat()
            upcoming_dates.append(iso_d)
            chronological_upcoming.append({
                "date": iso_d,
                "source_id": src_id,
                "source_name": src["name"],
                "color": src["color"],
                "estimated_cents": avg_cheque_cents,
            })
            cursor += timedelta(days=cadence_days)

        rem_count = len(upcoming_dates)
        stream_rem_cents = rem_count * avg_cheque_cents
        schedule_remaining_cents += stream_rem_cents
        total_remaining_cheques += rem_count

        effective_hourly_cents = (
            int(round(avg_cheque_cents / avg_hours))
            if avg_hours and avg_hours > 0
            else (int(src["target_hourly_cents"]) if src.get("target_hourly_cents") else None)
        )

        stream_forecasts.append({
            "source_id": src_id,
            "source_name": src["name"],
            "kind": src["kind"],
            "color": src["color"],
            "cadence_days": cadence_days,
            "is_manual_cadence": override_cadence is not None,
            "active_until": active_until_str,
            "remaining_paycheques": rem_count,
            "expected_per_cheque_cents": avg_cheque_cents,
            "average_hours_per_cheque": avg_hours,
            "effective_net_hourly_cents": effective_hourly_cents,
            "projected_remaining_cents": stream_rem_cents,
            "next_pay_date": upcoming_dates[0] if upcoming_dates else None,
            "upcoming_dates": upcoming_dates,
        })

    chronological_upcoming.sort(key=lambda x: (str(x["date"]), int(x["source_id"])))
    schedule_year_end_cents = ytd_cents + schedule_remaining_cents

    # Compute exact goal crossover date
    goal_achieved = False
    predicted_goal_date: str | None = None
    goal_shortfall_cents = 0
    extra_per_cheque_needed_cents = 0

    if goal_cents and goal_cents > 0:
        if ytd_cents >= goal_cents:
            goal_achieved = True
            predicted_goal_date = today.isoformat()
        else:
            running = ytd_cents
            for item in chronological_upcoming:
                running += int(item["estimated_cents"])
                if running >= goal_cents:
                    goal_achieved = True
                    predicted_goal_date = str(item["date"])
                    break
            if not goal_achieved:
                goal_shortfall_cents = max(0, goal_cents - schedule_year_end_cents)
                if total_remaining_cheques > 0:
                    extra_per_cheque_needed_cents = (
                        goal_shortfall_cents + total_remaining_cheques - 1
                    ) // total_remaining_cheques

    return {
        "year": year,
        "reference_date": today.isoformat(),
        "ytd_cents": ytd_cents,
        "linear_projected_year_end_cents": linear_projected_year_end_cents,
        "schedule_projected_remaining_cents": schedule_remaining_cents,
        "schedule_projected_year_end_cents": schedule_year_end_cents,
        "schedule_vs_linear_delta_cents": schedule_year_end_cents - linear_projected_year_end_cents,
        "total_remaining_paycheques": total_remaining_cheques,
        "goal_cents": goal_cents,
        "goal_achieved_or_on_track": goal_achieved,
        "predicted_goal_date": predicted_goal_date,
        "goal_shortfall_cents": goal_shortfall_cents,
        "extra_per_cheque_needed_cents": extra_per_cheque_needed_cents,
        "streams": stream_forecasts,
        "upcoming_timeline": chronological_upcoming,
    }
```

### Step 2.3: Update Backend API Endpoints (`backend/app.py`)

1. **`GET /api/state`**:
   * Include `expected_cadence_days`, `active_until`, and `target_hourly_cents` in the `sources` query result.
   * Include `"forecast": compute_schedule_forecast(sources, paycheques, goal_cents)` in the top-level JSON response of `GET /api/state` so Server Components have immediate access without extra roundtrips.
2. **`POST /api/sources` & `PUT /api/sources/:id`**:
   * Accept optional fields `expected_cadence_days`, `active_until`, and `target_hourly` (or `target_hourly_cents`).
   * Validate with `parse_expected_cadence_days`, `parse_active_until`, and `parse_optional_cents(..., allow_zero=False)`.
   * Persist into `sources`.
3. **`GET /api/forecast`**:
   * Dedicated endpoint returning `compute_schedule_forecast(...)` (accepts optional query param `?date=YYYY-MM-DD` for deterministic testing).

---

## 3. Step-by-Step Frontend Implementation

### Step 3.1: Shared TypeScript Forecast & What-If Engine (`frontend/src/lib/forecast-engine.ts`)

Create `frontend/src/lib/forecast-engine.ts` containing the TypeScript types and real-time client-side simulator math:

```typescript
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
```

### Step 3.2: Update Source Modal Dialog & Zod Schema (`frontend/src/features/sources/`)

1. **Zod Schema**:
   Extend the Source schema with optional schedule fields:
   ```typescript
   expected_cadence_days: z.preprocess(
     (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
     z.number().int().min(1).max(366).nullable().default(null)
   ),
   active_until: z.preprocess(
     (v) => (v === '' || v === null || v === undefined ? null : String(v).trim()),
     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').nullable().default(null)
   ),
   target_hourly: optionalMoneySchema,
   ```
2. **Source Modal UI (`<dialog>`)**:
   Add an optional **"Schedule & Contract Window (Forecasting)"** section with:
   * **Pay Cadence Selector**: `Auto-detect from history` (`null`), `Weekly (7d)`, `Bi-weekly (14d)`, `Monthly (30d)`, `Quarterly (90d)`.
   * **Contract / Co-op End Date (`active_until`)**: HTML5 `<input type="date" />` (with a `"Clear"` button) so users on a 4-month or 8-month co-op term can specify when the term ends.
   * **Target Net Hourly Rate (`$/h`)**: Optional numeric input.

### Step 3.3: Upgrade Overview Dashboard (`/`) & Build the Interactive Raise Simulator

#### A. Upgrade the Yearly Goal & Pacing Card on Overview (`/`)
In `frontend/src/features/overview/...`:
1. Display **both** projections side-by-side:
   * **Schedule-Aware Projection (Primary)**: `formatCents(forecast.schedule_projected_year_end_cents)` based on `forecast.total_remaining_paycheques` scheduled deposits remaining in the year.
   * **Linear Daily Pace (Secondary benchmark)**: `formatCents(forecast.linear_projected_year_end_cents)`.
2. **Goal Crossover Callout**:
   * If `forecast.goal_achieved_or_on_track` is `true` and `predicted_goal_date` is present, display an emerald badge:
     `On track to hit goal on YYYY-MM-DD`.
   * If `forecast.goal_shortfall_cents > 0`, display an actionable runway metric:
     `Shortfall: $X,XXX.XX (+$YY.YY/cheque across N remaining paycheques to hit target)`.

#### B. Build the Interactive Raise & Scenario Simulator Component (`RaiseSimulatorCard`)
Create `frontend/src/features/overview/components/raise-simulator-card.tsx` (`'use client'`) and render it on the Overview Dashboard (`/`) (or in a dedicated tab/section):
1. **Source Selector Pills**: Allow selecting any active income stream (or adjusting multiple streams).
2. **4 Interactive Controls**:
   * **Hourly Raise (`+$0.00/h` to `+$15.00/h`)**: Range slider + numeric input (`step="0.50"`).
   * **Percentage Raise (`0%` to `+30%`)**: Quick preset chips (`+3%`, `+5%`, `+10%`, `+15%`) + numeric input.
   * **Hours Delta per Paycheque (`-20h` to `+20h`)**: Simulate picking up extra shifts or reducing hours during exams.
   * **Remaining Paycheques Override & One-Time Windfall (`$`)**: Simulate extending a co-op contract by $N$ paycheques or receiving a year-end bonus / tax refund.
3. **Live Impact Scoreboard**:
   * **Simulated Year-End Total**: `$XX,XXX.XX` with a green delta pill (`+$X,XXX.XX this year`).
   * **Simulated Per-Cheque Net**: `$X,XXX.XX` (`+$XXX.XX / cheque`).
   * **Annualized Full-Year Run-Rate**: `$XX,XXX.XX / yr`.
   * **Goal Impact Badge**: Shows how many days earlier the annual goal will be reached under the simulated raise!
   * **"Reset Simulation" Button**: One click to return all sliders to baseline (`0`).

---

## 4. Styling Additions (`frontend/src/styles/globals.css`)

Append the following styles to `frontend/src/styles/globals.css`:

```css
/* Feature 3: Schedule-Aware Forecast & Raise Simulator */
.forecast-comparison-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.forecast-metric-box {
  padding: 0.75rem 0.875rem;
  border-radius: 0.625rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.sim-controls-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

@media (max-width: 720px) {
  .forecast-comparison-grid,
  .sim-controls-grid {
    grid-template-columns: 1fr;
  }
}

.sim-slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem;
  border-radius: 0.625rem;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.07));
}

.sim-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
}

.sim-range-input {
  width: 100%;
  accent-color: var(--accent, #3b82f6);
  cursor: pointer;
}

.sim-impact-banner {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: radial-gradient(circle at top left, rgba(16, 185, 129, 0.14), rgba(15, 23, 42, 0.6));
  border: 1px solid rgba(16, 185, 129, 0.3);
  margin-top: 0.75rem;
}

@media (max-width: 720px) {
  .sim-impact-banner {
    grid-template-columns: 1fr;
  }
}

.pill-goal-date {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
```

---

## 5. Automated Testing Specification (`backend/test_app.py`)

Add the following unit and API integration tests to `backend/test_app.py` and verify 100% pass rate:

1. **`test_schedule_forecast_biweekly_cadence_and_goal_crossover`**:
   * Create an active source (`"Softchoice Co-op"`) with 3 bi-weekly deposits of `$1,500.00` (`150000` cents) on `2026-09-04`, `2026-09-18`, and `2026-10-02`.
   * Call `compute_schedule_forecast` with `reference_date = date(2026, 10, 5)` and `goal_cents = 900000` (`$9,000.00`).
   * Assert `cadence_days == 14`, `remaining_paycheques == 6` (`Oct 16`, `Oct 30`, `Nov 13`, `Nov 27`, `Dec 11`, `Dec 25`), `schedule_projected_remaining_cents == 900000`, `schedule_projected_year_end_cents == 1350000`, and `predicted_goal_date == "2026-11-13"` (the exact 3rd remaining paycheque when cumulative total hits `$9,000.00`).
2. **`test_schedule_forecast_respects_active_until_contract_end_date`**:
   * Update the `"Softchoice Co-op"` source with `active_until = "2026-10-31"`.
   * Re-run `compute_schedule_forecast` with `reference_date = date(2026, 10, 5)`.
   * Assert `remaining_paycheques == 2` (`Oct 16` and `Oct 30` only; November and December dates are excluded because the co-op term ends Oct 31).
3. **`test_archived_and_stale_sources_excluded_from_forecast`**:
   * Verify that a source with `archived = 1` or whose last bi-weekly deposit was $> 60$ days before `reference_date` (with no `expected_cadence_days` override) contributes `0` remaining paycheques to `compute_schedule_forecast`.
4. **`test_forecast_api_endpoint_and_source_schedule_fields`**:
   * `PUT /api/sources/:id` with `expected_cadence_days: 14`, `active_until: "2026-12-15"`, `target_hourly: "28.50"`.
   * Call `GET /api/forecast?date=2026-10-05` and `GET /api/state` and verify the persisted fields and forecast payload are returned accurately.

---

## 6. Agent Execution Checklist

Execute these steps sequentially and verify each before advancing:

- [ ] **Step 1**: Inspect `backend/app.py` (and `backend/src/` if applicable) to review `sources` schema, `GET /api/state`, and existing payday prediction helpers.
- [ ] **Step 2**: Add `ensure_forecast_schema`, `parse_expected_cadence_days`, `parse_active_until`, and `compute_schedule_forecast` to `backend/app.py`.
- [ ] **Step 3**: Update `GET /api/state`, `POST/PUT /api/sources`, and add `GET /api/forecast` in `backend/app.py`.
- [ ] **Step 4**: Add the 4 test cases to `backend/test_app.py` and run `python backend/test_app.py` to confirm 100% pass rate.
- [ ] **Step 5**: Create `frontend/src/lib/forecast-engine.ts` with `ScheduleForecastReport` interfaces and `simulateCompensationScenario`.
- [ ] **Step 6**: Update Frontend Source Zod schemas, Server Actions, and the Source Modal Dialog (`expected_cadence_days`, `active_until`, `target_hourly`).
- [ ] **Step 7**: Upgrade the Yearly Goal & Pacing card on the Overview dashboard (`/`) with schedule-aware projections and exact goal crossover dates.
- [ ] **Step 8**: Build and mount `RaiseSimulatorCard` on the Overview dashboard (`/`) for real-time hourly raise, overtime, and contract extension simulations.
- [ ] **Step 9**: Run `npm run build` (or `npx tsc --noEmit`) inside `frontend/` to confirm zero TypeScript or Next.js build errors.