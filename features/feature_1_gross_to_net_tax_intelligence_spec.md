# AI Agent Implementation Spec: Feature 1 — Gross-to-Net & Tax Intelligence (`paystub-breakdown`)

> **Target System**: Payday — Salary & Income Management App  
> **Architecture**: Next.js 14+ (App Router, TypeScript, Zod, Chart.js, Vanilla CSS) + Python Backend (`backend/app.py` & `backend/src/` FastAPI extension) + SQLite (`salary.db` in WAL mode)  
> **Execution Mode**: Autonomous End-to-End Implementation & Verification

---

## 0. Mission & Non-Negotiable Architectural Guardrails

You are tasked with implementing **Feature 1: Gross-to-Net & Tax Intelligence (`paystub-breakdown`)**. Before writing any code, inspect the existing repository structure and strictly obey these rules:

1. **Integer Cents Only**: All monetary values (`gross_cents`, `tax_cents`, `deductions_cents`, `tax_reserve_cents`) MUST be stored and calculated as integers. Never use floating-point numbers for currency storage. Convert to formatted dollars only at the UI presentation or CSV serialization boundary.
2. **Basis Points for Percentages**: Tax reserve rates on income sources MUST be stored as integer basis points (`tax_reserve_bps`, where $100\text{ bps} = 1.00\%$ and $10000\text{ bps} = 100.00\%$).
3. **100% Backward Compatibility**: Existing seeded records from `Salary.pdf` and user-created paycheques only have `amount_cents` (net pay). Therefore, `gross_cents`, `tax_cents`, and `deductions_cents` MUST be nullable (`NULL` by default). Analytics must gracefully handle mixed datasets where some paycheques have full paystub breakdowns and others only have net `amount_cents`.
4. **Zero-Downtime Idempotent SQLite Migration**: Existing users may have a persistent Docker volume (`payday-data` containing `salary.db`). Schema changes must be applied idempotently at startup by inspecting `PRAGMA table_info(...)` before running `ALTER TABLE`.
5. **Preserve Design System & Accessibility**: Use existing CSS variables, `.mono` / `DM Mono` tabular numerals, `:focus-visible` outlines, and `prefers-reduced-motion` conventions in `frontend/src/styles/globals.css`.

---

## 1. Domain Model & Business Logic Specifications

### 1.1. Paycheque Gross-to-Net Model
Each record in `paycheques` continues to treat `amount_cents` as **Net Take-Home Pay**. Three optional integer columns are added:
- `gross_cents` (`INTEGER NULL`): Total gross pay before taxes and deductions.
- `tax_cents` (`INTEGER NULL`): Income tax withheld at source (Federal + Provincial/State tax).
- `deductions_cents` (`INTEGER NULL`): Non-tax payroll deductions (CPP, EI, 401k/RRSP, union dues, health/dental benefits).

#### Domain Invariants:
- If `gross_cents` is provided (`IS NOT NULL`), it must satisfy:
  $$\text{gross\_cents} \ge \text{amount\_cents} > 0$$
- If `tax_cents` is provided, $\text{tax\_cents} \ge 0$.
- If `deductions_cents` is provided, $\text{deductions\_cents} \ge 0$.
- If `gross_cents`, `tax_cents`, and `deductions_cents` are all provided, validate that:
  $$\text{tax\_cents} + \text{deductions\_cents} \le \text{gross\_cents}$$
- **Implied Deductions Fallback**: When a user enters `gross_cents` and `amount_cents` (net), total withheld is $\text{withheld\_cents} = \text{gross\_cents} - \text{amount\_cents}$. If `tax_cents` is provided without `deductions_cents`, implied deductions are $\max(0, \text{withheld\_cents} - \text{tax\_cents})$.

### 1.2. Source Tax-Withholding & Contractor Reserve Model
Each record in `sources` receives two new non-null columns with safe defaults:
- `is_tax_withheld` (`INTEGER NOT NULL DEFAULT 1`): `1` (true) for regular employment (`job`) or tax-free/withheld benefits (`government`); `0` (false) for untaxed contractor, freelance, or self-employed income streams where taxes are not deducted at source.
- `tax_reserve_bps` (`INTEGER NOT NULL DEFAULT 0`): Recommended percentage of net deposits from this source to set aside for year-end taxes, stored in basis points ($0 \le \text{tax\_reserve\_bps} \le 6000$, i.e., $0\%$ to $60\%$).

#### Contractor Tax Reserve Calculation:
For any paycheque belonging to a source where `is_tax_withheld == 0` and `tax_reserve_bps > 0` (and where `tax_cents` is `NULL` or `0`):
$$\text{tax\_reserve\_cents} = \left\lfloor \frac{\text{amount\_cents} \times \text{tax\_reserve\_bps} + 5000}{10000} \right\rfloor$$
$$\text{spendable\_net\_cents} = \text{amount\_cents} - \text{tax\_reserve\_cents}$$

---

## 2. Step-by-Step Backend Implementation

### Step 2.1: Idempotent SQLite Migration (`backend/app.py`)
Locate the database initialization/migration function in `backend/app.py` (where `CREATE TABLE IF NOT EXISTS sources` and `CREATE TABLE IF NOT EXISTS paycheques` are executed).

1. Update the `CREATE TABLE IF NOT EXISTS` statements for fresh databases to include the new columns and `CHECK` constraints.
2. Add an idempotent migration helper `ensure_schema_migrations(conn: sqlite3.Connection)` that runs immediately after table creation for existing `salary.db` files:

```python
def ensure_schema_migrations(conn: sqlite3.Connection) -> None:
    """Idempotently adds Gross-to-Net and Tax Intelligence columns to existing databases."""
    cur = conn.cursor()

    # Inspect existing columns in `sources`
    source_cols = {
        row[1] for row in cur.execute("PRAGMA table_info(sources)").fetchall()
    }
    if "is_tax_withheld" not in source_cols:
        cur.execute(
            "ALTER TABLE sources ADD COLUMN is_tax_withheld INTEGER NOT NULL DEFAULT 1 "
            "CHECK (is_tax_withheld IN (0, 1))"
        )
    if "tax_reserve_bps" not in source_cols:
        cur.execute(
            "ALTER TABLE sources ADD COLUMN tax_reserve_bps INTEGER NOT NULL DEFAULT 0 "
            "CHECK (tax_reserve_bps >= 0 AND tax_reserve_bps <= 6000)"
        )

    # Inspect existing columns in `paycheques`
    paycheque_cols = {
        row[1] for row in cur.execute("PRAGMA table_info(paycheques)").fetchall()
    }
    if "gross_cents" not in paycheque_cols:
        cur.execute(
            "ALTER TABLE paycheques ADD COLUMN gross_cents INTEGER NULL "
            "CHECK (gross_cents IS NULL OR gross_cents >= amount_cents)"
        )
    if "tax_cents" not in paycheque_cols:
        cur.execute(
            "ALTER TABLE paycheques ADD COLUMN tax_cents INTEGER NULL "
            "CHECK (tax_cents IS NULL OR tax_cents >= 0)"
        )
    if "deductions_cents" not in paycheque_cols:
        cur.execute(
            "ALTER TABLE paycheques ADD COLUMN deductions_cents INTEGER NULL "
            "CHECK (deductions_cents IS NULL OR deductions_cents >= 0)"
        )

    conn.commit()
```

---

### Step 2.2: Boundary Cleaners & Validators (`backend/app.py` & `backend/src/`)
Add clean boundary parsers in `backend/app.py` (and mirror them in `backend/src/paycheques/` and `backend/src/sources/` if the FastAPI module mirrors `app.py`):

```python
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

def parse_optional_cents(val: object, field_name: str, allow_zero: bool = True) -> int | None:
    """
    Parses an optional dollar value (string, int, float, or None) into integer cents.
    Returns None if val is None or empty string "".
    Raises ValueError on invalid format or negative numbers.
    """
    if val is None:
        return None
    if isinstance(val, str):
        cleaned = val.strip().replace("$", "").replace(",", "")
        if cleaned == "":
            return None
        val = cleaned
    try:
        dec = Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid monetary amount for {field_name}") from exc

    cents = int(dec * 100)
    if allow_zero and cents < 0:
        raise ValueError(f"{field_name} cannot be negative")
    if not allow_zero and cents <= 0:
        raise ValueError(f"{field_name} must be greater than zero")
    return cents


def validate_paystub_breakdown(
    amount_cents: int,
    gross_cents: int | None,
    tax_cents: int | None,
    deductions_cents: int | None,
) -> tuple[int | None, int | None, int | None]:
    """
    Validates cross-field invariants for a paycheque breakdown.
    If tax_cents or deductions_cents are provided without gross_cents, auto-derives gross_cents.
    """
    if gross_cents is None and (tax_cents is not None or deductions_cents is not None):
        gross_cents = amount_cents + (tax_cents or 0) + (deductions_cents or 0)

    if gross_cents is not None:
        if gross_cents < amount_cents:
            raise ValueError("Gross pay must be greater than or equal to net pay.")
        total_withheld = (tax_cents or 0) + (deductions_cents or 0)
        if total_withheld > (gross_cents - amount_cents):
            raise ValueError(
                "Sum of taxes and deductions cannot exceed the difference between gross and net pay."
            )

    return gross_cents, tax_cents, deductions_cents


def parse_tax_reserve_bps(val: object) -> int:
    """
    Accepts basis points (0..6000) or percentage if passed via `tax_reserve_percent`.
    Validates range 0 <= bps <= 6000 (0% to 60%).
    """
    if val is None or val == "":
        return 0
    try:
        bps = int(val)
    except (ValueError, TypeError) as exc:
        raise ValueError("tax_reserve_bps must be an integer between 0 and 6000") from exc
    if not (0 <= bps <= 6000):
        raise ValueError("tax_reserve_bps must be between 0 and 6000 (0% to 60%)")
    return bps
```

---

### Step 2.3: Update API Endpoints (`backend/app.py`)

Update the following endpoints while preserving existing response structures:

1. **`GET /api/state`**:
   - Ensure `sources` query selects: `id, name, kind, color, archived, is_tax_withheld, tax_reserve_bps`.
   - Ensure `paycheques` query selects: `id, source_id, paid_on, amount_cents, gross_cents, tax_cents, deductions_cents, hours, note`.
2. **`POST /api/paycheques` & `PUT /api/paycheques/:id`**:
   - Accept optional payload fields:
     - `gross`: `string | number | null` (or `gross_cents`: `int | null`)
     - `tax`: `string | number | null` (or `tax_cents`: `int | null`)
     - `deductions`: `string | number | null` (or `deductions_cents`: `int | null`)
   - Pass through `parse_optional_cents` and `validate_paystub_breakdown`.
   - Persist `gross_cents, tax_cents, deductions_cents` into `paycheques`.
   - Return `400 Bad Request` with `{"error": str(e)}` if validation fails.
3. **`POST /api/sources` & `PUT /api/sources/:id`**:
   - Accept optional payload fields:
     - `is_tax_withheld`: `bool | int` (defaults to `1`)
     - `tax_reserve_bps`: `int` (defaults to `0`; if `is_tax_withheld` is truthy, force `tax_reserve_bps = 0` or retain as configured)
   - Persist `is_tax_withheld` (`1` or `0`) and `tax_reserve_bps` into `sources`.
4. **`GET /api/export.csv`**:
   - Expand CSV header from:
     `date,source,amount,hours,note`
     to:
     `date,source,amount,gross,tax,deductions,tax_reserve,hours,note`
   - Format `gross`, `tax`, and `deductions` as `f"{cents / 100:.2f}"` when non-null, or `""` when `NULL`.
   - Format `tax_reserve` as `f"{reserve_cents / 100:.2f}"` when the source has `is_tax_withheld == 0` and `tax_reserve_bps > 0`, otherwise `"0.00"`.

---

## 3. Step-by-Step Frontend Implementation

### Step 3.1: Pure Tax & Gross-to-Net Intelligence Engine
Create a dedicated, pure calculation module at `frontend/src/lib/tax-intelligence.ts`. Both Server Components and Client Components will import from this module.

```typescript
// frontend/src/lib/tax-intelligence.ts

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
```

---

### Step 3.2: Update Zod Schemas & Server Actions

1. **Paycheque Zod Schema** (`frontend/src/features/paycheques/...`):
   Extend the paycheque mutation schema to validate optional `gross`, `tax`, and `deductions` inputs:
   ```typescript
   const optionalMoneySchema = z
     .union([z.string(), z.number(), z.null(), z.undefined()])
     .transform((val) => {
       if (val === null || val === undefined || String(val).trim() === '') return null;
       const num = Number(String(val).replace(/[$,]/g, ''));
       return Number.isFinite(num) ? Math.round(num * 100) / 100 : Number.NaN;
     })
     .refine((val) => val === null || (!Number.isNaN(val) && val >= 0), {
       message: 'Must be a valid non-negative dollar amount',
     });
   ```
   Add a `.superRefine(...)` on the paycheque schema:
   - If `gross !== null` and `gross < amount`, attach a field error on `gross`: `"Gross pay must be at least equal to net take-home pay."`
   - If `gross !== null` and `(tax ?? 0) + (deductions ?? 0) > Number((gross - amount).toFixed(2))`, attach a field error: `"Taxes + deductions cannot exceed (Gross - Net)."`

2. **Source Zod Schema** (`frontend/src/features/sources/...`):
   Extend the source mutation schema:
   ```typescript
   is_tax_withheld: z.boolean().default(true),
   tax_reserve_percent: z.coerce
     .number()
     .min(0, 'Reserve % cannot be negative')
     .max(60, 'Reserve % cannot exceed 60%')
     .default(0),
   ```
   In the Server Action, convert `tax_reserve_percent` to integer basis points:
   `const tax_reserve_bps = is_tax_withheld ? 0 : Math.round(tax_reserve_percent * 100);`

---

### Step 3.3: UI Component Upgrades

#### A. Paycheque Modal Dialog (`frontend/src/features/paycheques/...`)
Enhance the Add/Edit Paycheque `<dialog>` modal without cluttering quick entry:
1. **Collapsible Breakdown Drawer**: Below the Net Amount input, add a clean toggle button:
   - `+ Add paystub breakdown (Gross, Tax, Deductions)` (auto-expanded when editing a paycheque that already has `gross_cents !== null`).
2. **Three Tabular Inputs inside the Drawer**:
   - **Gross Pay ($)** (`placeholder="0.00"`)
   - **Income Tax Withheld ($)** (`placeholder="0.00"`)
   - **Deductions — CPP / EI / Benefits ($)** (`placeholder="0.00"`)
3. **Interactive Auto-Balance Pill**:
   - When the user enters `Gross` and `Net`, display a live summary pill inside the drawer:
     `Total Withheld: $X.XX (Net Retention: Y.Y%)`.
   - Include a one-click helper button `"Auto-fill Net from Gross - Deductions"` if the user enters `Gross`, `Tax`, and `Deductions` first.
4. **"Same as last time" Quick Button Upgrade**:
   - When clicking `"Same as last time"` for a selected source, populate not only `amount` (net), but also `gross`, `tax`, `deductions`, and `hours` from the most recent paycheque of that source!

#### B. Source Modal Dialog (`frontend/src/features/sources/...`)
Enhance the Add/Edit Source `<dialog>` modal:
1. Add a **Tax Treatment** segmented control or checkbox:
   - `Taxes withheld at source (T4 / W-2 / Government)` (`is_tax_withheld = true`)
   - `Untaxed / Self-Employed / Contractor (T4A / 1099)` (`is_tax_withheld = false`)
2. When `Untaxed / Self-Employed` is selected, reveal a **Recommended Tax Reserve (%)** input with quick preset chips (`15%`, `20%`, `25%`, `30%`).
3. Show a live helper note: `"Payday will automatically calculate your recommended tax set-aside and True Spendable Net on deposits from this source."`

#### C. Overview Dashboard (`/`) — Tax & Retention Intelligence Card
Add a **"Gross-to-Net & Tax Intelligence"** widget card to the Overview Dashboard (`frontend/src/features/overview/...`):
1. **Stacked Horizontal Progress Bar**:
   - Segment 1 (Emerald/Accent): **True Spendable Net**
   - Segment 2 (Amber, if > 0): **Contractor Tax Reserve Set-Aside**
   - Segment 3 (Rose/Slate, if > 0): **Withheld Taxes & Deductions**
2. **4 Key Metrics inside the Card**:
   - **Effective Gross Income**: `$X,XXX.XX` (with a badge showing `%` of cheques with full stub data if partial).
   - **Withheld at Source**: `$X,XXX.XX` (broken down by Tax vs. Deductions on hover/subtext).
   - **Net Retention Rate**: `XX.X%` (`(Net / Gross) * 100` across tracked paystubs).
   - **Untaxed Reserve Required**: `$X,XXX.XX` (highlighted in amber if $> 0$, showing `True Spendable Net: $Y,YYY.YY`).

#### D. Sources Grid (`/sources`) & Source Detail (`/sources/[id]`)
1. **Hourly Rate Intelligence Upgrade**:
   - Wherever effective hourly wage is displayed (`$XX.XX/h net`), also display the **Gross Hourly Wage** (`$YY.YY/h gross`) when `gross_cents` is available on timed deposits.
2. **Untaxed Source Badge**:
   - On `/sources` cards and `/sources/[id]`, if `is_tax_withheld === 0`, display a badge: `Tax Reserve: XX% ($X,XXX.XX set aside)`.
3. **Source-Specific Ledger (`/sources/[id]`) & Main Ledger (`/paycheques`)**:
   - In each paycheque row, if `gross_cents` is recorded, render a subtle secondary mono sub-label beneath or beside the net amount:
     `Gross $X,XXX.XX · -XX.X% withheld`
   - If the source is untaxed (`contractorTaxReserveCents > 0`), render an amber pill:
     `Reserve $XX.XX`.

---

## 4. Styling Additions (`frontend/src/styles/globals.css`)

Append the following minimal, design-system-aligned utility classes to `frontend/src/styles/globals.css`:

```css
/* Gross-to-Net & Tax Intelligence Components */
.paystub-drawer-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--accent, #3b82f6);
  background: transparent;
  border: none;
  padding: 0.25rem 0;
  cursor: pointer;
}

.paystub-drawer-toggle:hover {
  text-decoration: underline;
}

.paystub-drawer {
  margin-top: 0.5rem;
  padding: 0.875rem;
  border-radius: 0.625rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  display: grid;
  gap: 0.75rem;
}

.paystub-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.625rem;
}

@media (max-width: 720px) {
  .paystub-grid-3 {
    grid-template-columns: 1fr;
  }
}

.retention-bar-track {
  width: 100%;
  height: 0.625rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  display: flex;
  margin: 0.75rem 0;
}

.retention-seg-net {
  background: var(--success, #10b981);
  height: 100%;
}

.retention-seg-reserve {
  background: var(--warning, #f59e0b);
  height: 100%;
}

.retention-seg-withheld {
  background: var(--danger, #f43f5e);
  height: 100%;
}

.pill-reserve {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-family: var(--font-mono, monospace);
  background: rgba(245, 158, 11, 0.14);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.gross-subtext {
  display: block;
  font-size: 0.72rem;
  color: var(--muted, #94a3b8);
  font-family: var(--font-mono, monospace);
  margin-top: 0.125rem;
}
```

---

## 5. Automated Testing Specification (`backend/test_app.py`)

Add the following unit and integration tests to `backend/test_app.py` and verify all existing + new tests pass:

1. **`test_idempotent_schema_migration`**:
   - Calls `ensure_schema_migrations(conn)` twice in a row on an initialized database and verifies no errors are raised and `gross_cents`, `tax_cents`, `deductions_cents`, `is_tax_withheld`, and `tax_reserve_bps` exist in `PRAGMA table_info`.
2. **`test_create_paycheque_with_paystub_breakdown`**:
   - `POST /api/paycheques` with `{"source_id": 1, "paid_on": "2026-03-15", "amount": "1500.00", "gross": "2000.00", "tax": "350.00", "deductions": "150.00", "hours": 80}`.
   - Verify HTTP `200/201` and verify `GET /api/state` returns `amount_cents == 150000`, `gross_cents == 200000`, `tax_cents == 35000`, `deductions_cents == 15000`.
3. **`test_reject_invalid_gross_to_net_invariants`**:
   - Attempt `POST /api/paycheques` where `gross` (`1200.00`) < `amount` (`1500.00`). Expect HTTP `400`.
   - Attempt `POST /api/paycheques` where `gross` = `2000.00`, `amount` = `1500.00`, `tax` = `400.00`, `deductions` = `200.00` ($400 + 200 > 500$). Expect HTTP `400`.
4. **`test_untaxed_source_and_csv_export`**:
   - `POST /api/sources` with `{"name": "Freelance Design", "kind": "other", "color": "#8b5cf6", "is_tax_withheld": 0, "tax_reserve_bps": 2500}`.
   - `POST /api/paycheques` for that source with `amount: "1000.00"`.
   - Fetch `GET /api/export.csv` and assert the row includes `"250.00"` in the `tax_reserve` column.

---

## 6. Agent Execution Checklist

Execute these steps in order and verify each before moving to the next:

- [ ] **Step 1**: Inspect `backend/app.py` and `backend/src/` to locate schema initialization, cleaners, and route handlers.
- [ ] **Step 2**: Implement `ensure_schema_migrations`, `parse_optional_cents`, `validate_paystub_breakdown`, and `parse_tax_reserve_bps` in `backend/app.py` (and `backend/src/` models/schemas if applicable).
- [ ] **Step 3**: Update `GET /api/state`, `POST/PUT /api/paycheques`, `POST/PUT /api/sources`, and `GET /api/export.csv`.
- [ ] **Step 4**: Add the 4 backend test cases in `backend/test_app.py` and run `python backend/test_app.py` to confirm 100% pass rate.
- [ ] **Step 5**: Create `frontend/src/lib/tax-intelligence.ts` with `computePaychequeBreakdown` and `computeAggregateTaxSummary`.
- [ ] **Step 6**: Update Frontend TypeScript interfaces, Zod schemas, and Server Actions for paycheques and sources.
- [ ] **Step 7**: Update the Paycheque Modal Dialog (collapsible paystub breakdown + "Same as last time" upgrade) and Source Modal Dialog (tax withholding toggle + reserve % presets).
- [ ] **Step 8**: Add the Gross-to-Net & Tax Intelligence card on Overview (`/`), Gross/Net hourly indicators on `/sources` and `/sources/[id]`, and ledger sub-labels on `/paycheques`.
- [ ] **Step 9**: Run `npm run build` (or `npx tsc --noEmit`) inside `frontend/` to verify zero TypeScript or Next.js build errors.