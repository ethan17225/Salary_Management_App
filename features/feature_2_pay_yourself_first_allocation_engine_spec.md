# AI Agent Implementation Spec: Feature 2 — "Pay Yourself First" Allocation Engine (`allocations`)

> **Target System**: Payday — Salary & Income Management App
>
> **Architecture**: Next.js 14+ (App Router, TypeScript, Zod, Chart.js, Vanilla CSS) + Python Backend (`backend/app.py` & `backend/src/` FastAPI extension) + SQLite (`salary.db` in WAL mode)
>
> **Prerequisite Compatibility**: Works standalone on `amount_cents` (Net Pay) AND integrates seamlessly with Feature 1 (`paystub-breakdown`) by protecting contractor tax reserves before splitting spendable net income.
>
> **Execution Mode**: Autonomous End-to-End Implementation & Verification

---

## 0. Mission & Non-Negotiable Architectural Guardrails

You are tasked with implementing **Feature 2: "Pay Yourself First" Allocation Engine (`allocations`)**. Before modifying any files, inspect the repository and strictly enforce these invariants:

1. **Integer Cents Only**: Every bucket allocation, YTD bucket total, and unallocated cash buffer MUST be computed and stored as exact integers (`int` in Python, safe integer in TypeScript). Never use floating-point math to accumulate currency.
2. **Basis Points (`weight_bps`) for Rule Weights**: Every allocation rule weight is stored as an integer in basis points where $100\text{ bps} = 1.00\%$ and $10000\text{ bps} = 100.00\%$.
3. **Zero-Drift Cent Conservation (Largest Remainder Invariant)**: When splitting a paycheque of $C$ cents across active allocation rules, the sum of all allocated bucket cents plus any unallocated remainder cents MUST equal $C$ with zero cent drift:
   $$\sum_{i=1}^{k} \text{allocated\_cents}_i + \text{unallocated\_cents} = C$$
4. **Active Cap Constraint**: The sum of `weight_bps` across all currently active rules (`active == 1`) MUST NOT exceed $10000\text{ bps}$ ($100.00\%$). Inactive/paused rules (`active == 0`) are excluded from this cap.
5. **Zero-Downtime Idempotent Schema Migration**: `allocation_rules` must be created idempotently on startup so existing `salary.db` volumes upgrade without data loss.

---

## 1. Mathematical & Domain Model Specifications

### 1.1. Allocation Rule Domain Model (`allocation_rules`)

| Column | SQLite Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique rule identifier |
| `name` | `TEXT` | `NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 50)` | Bucket display name (e.g., `"TFSA / Index Funds"`, `"Rent & Tuition"`) |
| `category` | `TEXT` | `NOT NULL CHECK (category IN ('essentials', 'investments', 'savings', 'lifestyle'))` | High-level financial bucket classification |
| `weight_bps` | `INTEGER` | `NOT NULL CHECK (weight_bps > 0 AND weight_bps <= 10000)` | Target allocation share in basis points ($2000 = 20.00\%$) |
| `color` | `TEXT` | `NOT NULL CHECK (color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')` | 6-digit hex accent color for charts and badges |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` | Display and tie-breaking order |
| `active` | `INTEGER` | `NOT NULL DEFAULT 1 CHECK (active IN (0, 1))` | `1` if active in splits, `0` if paused |

### 1.2. Largest Remainder Method (Hare-Niemeyer) for Exact Cent Splitting

Given a distributable amount $C \ge 0$ (in integer cents) and a sequence of $k$ active rules ordered by `(sort_order ASC, id ASC)` with weights $w_1, w_2, \dots, w_k \in (0, 10000]$ where $W = \sum_{i=1}^{k} w_i \le 10000$:

1. **Compute Total Allocated Pool**:
   $$P = \left\lfloor \frac{C \times W}{10000} \right\rfloor, \quad U = C - P$$
   where $P$ is `allocated_total_cents` and $U$ is `unallocated_cents`.

2. **Compute Integer Quotients & Exact Remainders**:
   For each active rule $i \in \{1, \dots, k\}$:
   $$q_i = \left\lfloor \frac{C \times w_i}{10000} \right\rfloor, \quad r_i = (C \times w_i) \bmod 10000$$

3. **Distribute Remainder Shortfall**:
   Let the shortfall be:
   $$\Delta = P - \sum_{i=1}^{k} q_i$$
   Sort the rule indices $i \in \{1, \dots, k\}$ in descending order of remainder $r_i$, breaking ties by ascending original index $i$ (`(-r_i, i)`). Add $1\text{ cent}$ to $q_i$ for the first $\Delta$ rules in this sorted order.

### 1.3. Integration with Feature 1 (Contractor Tax Reserve Protection)

When splitting a paycheque:
* Let `net_cents = paycheque.amount_cents`.
* If Feature 1's contractor tax reserve applies to the paycheque's source (`is_tax_withheld == 0`, `tax_reserve_bps > 0`, and `tax_cents` is `NULL` or `0`), first set aside:
  $$\text{tax\_reserve\_cents} = \left\lfloor \frac{\text{net\_cents} \times \text{tax\_reserve\_bps} + 5000}{10000} \right\rfloor$$
* The distributable base passed into the Largest Remainder allocator is:
  $$C = \text{true\_spendable\_net\_cents} = \text{net\_cents} - \text{tax\_reserve\_cents}$$
* If Feature 1 is not active on that source (or `is_tax_withheld == 1`), $\text{tax\_reserve\_cents} = 0$ and $C = \text{net\_cents}$.

---

## 2. Step-by-Step Backend Implementation

### Step 2.1: Idempotent SQLite Schema Update (`backend/app.py`)

In `backend/app.py` (and `backend/src/models.py` if using the FastAPI module), add the `allocation_rules` table inside the database initialization/migration routine:

```python
def ensure_allocation_schema(conn: sqlite3.Connection) -> None:
    """Idempotently creates the allocation_rules table."""
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS allocation_rules (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL COLLATE NOCASE UNIQUE
                        CHECK (length(trim(name)) BETWEEN 1 AND 50),
            category    TEXT NOT NULL
                        CHECK (category IN ('essentials', 'investments', 'savings', 'lifestyle')),
            weight_bps  INTEGER NOT NULL
                        CHECK (weight_bps > 0 AND weight_bps <= 10000),
            color       TEXT NOT NULL
                        CHECK (color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
            sort_order  INTEGER NOT NULL DEFAULT 0,
            active      INTEGER NOT NULL DEFAULT 1
                        CHECK (active IN (0, 1))
        )
        """
    )
    conn.commit()
```

### Step 2.2: Allocation Cleaners, Presets & Largest Remainder Engine (`backend/app.py`)

Add the following pure functions and preset definitions to `backend/app.py`:

```python
VALID_ALLOCATION_CATEGORIES = {"essentials", "investments", "savings", "lifestyle"}

ALLOCATION_PRESETS: dict[str, list[dict[str, object]]] = {
    "50-30-20": [
        {"name": "Essentials & Bills", "category": "essentials", "weight_bps": 5000, "color": "#3b82f6", "sort_order": 1},
        {"name": "Long-Term Investments", "category": "investments", "weight_bps": 2000, "color": "#10b981", "sort_order": 2},
        {"name": "Guilt-Free Lifestyle", "category": "lifestyle", "weight_bps": 3000, "color": "#8b5cf6", "sort_order": 3},
    ],
    "student-coop": [
        {"name": "Tuition & Rent Reserve", "category": "essentials", "weight_bps": 5000, "color": "#3b82f6", "sort_order": 1},
        {"name": "TFSA / FHSA Index Funds", "category": "investments", "weight_bps": 2500, "color": "#10b981", "sort_order": 2},
        {"name": "Emergency Buffer", "category": "savings", "weight_bps": 1000, "color": "#f59e0b", "sort_order": 3},
        {"name": "Campus & Personal Spending", "category": "lifestyle", "weight_bps": 1500, "color": "#ec4899", "sort_order": 4},
    ],
    "aggressive-saver": [
        {"name": "Index & Retirement Portfolio", "category": "investments", "weight_bps": 4500, "color": "#10b981", "sort_order": 1},
        {"name": "Fixed Living Costs", "category": "essentials", "weight_bps": 3500, "color": "#3b82f6", "sort_order": 2},
        {"name": "High-Yield Cash Reserve", "category": "savings", "weight_bps": 1000, "color": "#06b6d4", "sort_order": 3},
        {"name": "Discretionary Fun", "category": "lifestyle", "weight_bps": 1000, "color": "#8b5cf6", "sort_order": 4},
    ],
}


def parse_weight_bps(payload: dict[str, object]) -> int:
    """
    Extracts integer basis points from `weight_bps` (int) or `percentage` (float/str).
    Validates 1 <= weight_bps <= 10000.
    """
    if "weight_bps" in payload and payload["weight_bps"] is not None:
        try:
            bps = int(payload["weight_bps"])
        except (ValueError, TypeError) as exc:
            raise ValueError("weight_bps must be an integer") from exc
    elif "percentage" in payload and payload["percentage"] is not None:
        try:
            pct = Decimal(str(payload["percentage"])).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            bps = int(pct * 100)
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("Invalid percentage value") from exc
    else:
        raise ValueError("Either weight_bps or percentage is required")

    if not (1 <= bps <= 10000):
        raise ValueError("Allocation weight must be between 0.01% (1 bps) and 100.00% (10000 bps)")
    return bps


def allocate_cents_largest_remainder(
    amount_cents: int,
    active_rules: list[dict[str, object]],
) -> dict[str, object]:
    """
    Splits `amount_cents` across `active_rules` using the Largest Remainder Method.
    Guarantees sum(b['allocated_cents'] for b in buckets) + unallocated_cents == amount_cents.
    """
    if amount_cents <= 0 or not active_rules:
        return {
            "distributable_cents": max(0, amount_cents),
            "allocated_total_cents": 0,
            "unallocated_cents": max(0, amount_cents),
            "buckets": [
                {
                    "rule_id": r["id"],
                    "name": r["name"],
                    "category": r["category"],
                    "color": r["color"],
                    "weight_bps": r["weight_bps"],
                    "allocated_cents": 0,
                }
                for r in active_rules
            ],
        }

    total_bps = sum(int(r["weight_bps"]) for r in active_rules)
    if total_bps > 10000:
        raise ValueError(f"Active allocation rules sum to {total_bps} bps, exceeding 10000 bps (100%)")

    pool_cents = (amount_cents * total_bps) // 10000
    unallocated_cents = amount_cents - pool_cents

    quotients: list[int] = []
    remainders: list[tuple[int, int]] = []

    for idx, rule in enumerate(active_rules):
        w = int(rule["weight_bps"])
        q, rem = divmod(amount_cents * w, 10000)
        quotients.append(q)
        remainders.append((rem, idx))

    shortfall = pool_cents - sum(quotients)
    remainders.sort(key=lambda item: (-item[0], item[1]))
    for i in range(shortfall):
        _, target_idx = remainders[i]
        quotients[target_idx] += 1

    buckets = [
        {
            "rule_id": rule["id"],
            "name": rule["name"],
            "category": rule["category"],
            "color": rule["color"],
            "weight_bps": int(rule["weight_bps"]),
            "allocated_cents": quotients[idx],
        }
        for idx, rule in enumerate(active_rules)
    ]

    return {
        "distributable_cents": amount_cents,
        "allocated_total_cents": pool_cents,
        "unallocated_cents": unallocated_cents,
        "buckets": buckets,
    }
```

### Step 2.3: Backend API Endpoints (`backend/app.py`)

Implement and wire the following endpoints in `backend/app.py`:

1. **Extend `GET /api/state`**:
   * Query `SELECT id, name, category, weight_bps, color, sort_order, active FROM allocation_rules ORDER BY sort_order ASC, id ASC`.
   * Include `"allocations": [...]` in the top-level JSON object returned by `GET /api/state` alongside `sources`, `paycheques`, and `settings`.

2. **`GET /api/allocations`**:
   * Returns `{"allocations": [...], "total_active_bps": int, "unallocated_bps": int}`.

3. **`POST /api/allocations`**:
   * Request payload: `{"name": str, "category": str, "weight_bps" | "percentage": number, "color": "#hex", "sort_order"?: int, "active"?: bool | int}`.
   * Validation:
     * Trim `name` ($1 \le \text{len} \le 50$), verify `category in VALID_ALLOCATION_CATEGORIES`, verify `color` matches `#RRGGBB`, parse `weight_bps`.
     * If `active` is truthy (`1`), query `SELECT COALESCE(SUM(weight_bps), 0) FROM allocation_rules WHERE active = 1`.
     * If `current_active_bps + weight_bps > 10000`, return HTTP `400` with `{"error": "Total active allocations cannot exceed 100% (10000 bps)."}`.
   * Insert record and return HTTP `200/201` with `{"id": new_id}`.

4. **`PUT /api/allocations/:id`**:
   * Request payload: same fields as `POST /api/allocations`.
   * Validation:
     * Check rule `:id` exists (else HTTP `404`).
     * If `active` is truthy (`1`), query `SELECT COALESCE(SUM(weight_bps), 0) FROM allocation_rules WHERE active = 1 AND id != ?`.
     * Verify `other_active_bps + weight_bps <= 10000` (else HTTP `400`).
   * Update record and return `{"ok": True}`.

5. **`DELETE /api/allocations/:id`**:
   * Deletes the allocation rule with `id = :id` and returns `{"ok": True}` (or HTTP `404` if not found).

6. **`POST /api/allocations/presets`**:
   * Request payload: `{"preset": "50-30-20" | "student-coop" | "aggressive-saver"}`.
   * Validation: check `preset in ALLOCATION_PRESETS` (else HTTP `400`).
   * Inside an atomic transaction (`with conn:`), execute `DELETE FROM allocation_rules` and insert the preset's rules. Return `{"ok": True, "count": len(rules)}`.

---

## 3. Step-by-Step Frontend Implementation

### Step 3.1: Pure Frontend Allocation Engine (`frontend/src/lib/allocation-engine.ts`)

Create `frontend/src/lib/allocation-engine.ts` so both Server Components and interactive Client Components share the exact same Largest Remainder algorithm:

```typescript
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
```

### Step 3.2: Zod Schemas & Server Actions (`frontend/src/features/allocations/`)

Create `frontend/src/features/allocations/` with:

1. **`schemas.ts`**:
   ```typescript
   import { z } from 'zod';

   export const allocationRuleFormSchema = z.object({
     id: z.number().int().positive().optional(),
     name: z
       .string()
       .trim()
       .min(1, 'Bucket name is required')
       .max(50, 'Bucket name must be 50 characters or fewer'),
     category: z.enum(['essentials', 'investments', 'savings', 'lifestyle']),
     percentage: z.coerce
       .number()
       .min(0.01, 'Minimum allocation is 0.01%')
       .max(100, 'Maximum allocation is 100%'),
     color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid 6-digit hex color'),
     sort_order: z.coerce.number().int().default(0),
     active: z.boolean().default(true),
   });

   export const allocationPresetSchema = z.object({
     preset: z.enum(['50-30-20', 'student-coop', 'aggressive-saver']),
   });
   ```

2. **`actions.ts`** (`'use server'`):
   * `saveAllocationRuleAction(input)`: validates with `allocationRuleFormSchema`, converts `percentage` to `weight_bps = Math.round(percentage * 100)`, calls `POST /api/allocations` or `PUT /api/allocations/:id`, and calls `revalidatePath('/')`, `revalidatePath('/allocations')`, and `revalidatePath('/paycheques')`.
   * `deleteAllocationRuleAction(id: number)`: calls `DELETE /api/allocations/:id` and revalidates paths.
   * `applyAllocationPresetAction(preset)`: validates with `allocationPresetSchema`, calls `POST /api/allocations/presets`, and revalidates paths.

### Step 3.3: UI Pages & Interactive Components

#### A. Navigation Bar Upgrade (`frontend/src/components/layout/navbar.tsx`)
1. Add an **`Allocations`** navigation link pointing to `/allocations` alongside `Overview`, `Paycheques`, and `Sources`.

#### B. Dedicated Allocations Page (`frontend/src/app/(dashboard)/allocations/page.tsx`)
Build the `/allocations` dashboard route supporting the existing `?year=` query parameter (`YearDropdown`):

1. **Hero Banner**:
   * Displays **Total Allocated YTD / Year** (`$X,XXX.XX`), active allocation coverage (`XX.X% configured`), and remaining unallocated cash buffer (`$Y,YYY.YY`).
   * Includes `YearDropdown` for switching between specific years or "All Time".

2. **Empty-State Quick Preset Bar** (shown when `rules.length === 0`, or via a `"Reset with Preset"` dropdown):
   * Three one-click preset cards:
     * **50 / 30 / 20 Balanced** (50% Essentials, 20% Investments, 30% Lifestyle)
     * **Co-op / Student Plan** (50% Tuition & Rent, 25% TFSA/FHSA, 10% Emergency, 15% Campus/Fun)
     * **Aggressive Wealth Builder** (45% Portfolio, 35% Fixed Costs, 10% Cash Reserve, 10% Fun)

3. **Visual Allocation Proportion Bar & Rules Manager**:
   * A multi-segment horizontal bar showing each active bucket's color and weight percentage, plus an unallocated buffer segment if `totalActiveBps < 10000`.
   * Rule cards / table rows showing:
     * Color dot, bucket name, category badge (`Essentials`, `Investments`, `Savings`, `Lifestyle`), target percentage (`XX.X%`), YTD dollars routed to this bucket (`$X,XXX.XX`), and average per paycheque (`$XXX.XX / cheque`).
     * Quick actions: Edit button, Active/Pause toggle, and Delete button.
   * **`+ New Allocation Bucket` Modal (`<dialog>`)**:
     * Name input, Category selector, Percentage input (displaying remaining available `%` so the user knows the cap), Color picker chips, and Active checkbox.

4. **Interactive Paycheque Split & Hourly Wage Simulator (`PaycheckSplitSimulator`)**:
   * Client Component defaulting to the most recent paycheque's net amount (or `$1,500.00` fallback).
   * **Mode 1 — Direct Deposit Amount (`$`)**: Type or adjust any paycheque amount to immediately see the exact Largest Remainder cent split across all active buckets.
   * **Mode 2 — Hourly Wage & Overtime What-If (`$/h` $\times$ `Hours`)**: Enter a hypothetical net hourly wage (e.g., `$28.50/h`) and hours per pay period (e.g., `80h`) to simulate how a raise or extra shift flows into each investment and savings bucket.

#### C. Overview Dashboard (`/`) Widget & Paycheques Ledger (`/paycheques`) Integration
1. **Overview Dashboard Card**:
   * Add a **"Pay Yourself First Split"** card on `/` showing how the user's latest paycheque (or current year total) is divided across `Investments`, `Essentials`, `Savings`, and `Lifestyle`, with a link to `Manage rules →` (`/allocations`).
2. **Paycheques Ledger (`/paycheques`)**:
   * When active allocation rules exist, clicking or hovering a paycheque's net amount (or a subtle `Split` pill in the row) reveals the exact bucket breakdown for that deposit.

---

## 4. Styling Additions (`frontend/src/styles/globals.css`)

Append these styles to `frontend/src/styles/globals.css`:

```css
/* Feature 2: Pay Yourself First Allocation Engine */
.allocation-bar-track {
  width: 100%;
  height: 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  display: flex;
  gap: 2px;
  margin: 0.875rem 0;
}

.allocation-bar-seg {
  height: 100%;
  transition: width 0.25s ease;
}

@media (prefers-reduced-motion: reduce) {
  .allocation-bar-seg {
    transition: none;
  }
}

.bucket-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.bucket-card {
  padding: 1.125rem;
  border-radius: 0.75rem;
  background: var(--surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.bucket-card-inactive {
  opacity: 0.55;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.875rem;
  margin-top: 0.75rem;
}

.simulator-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

@media (max-width: 720px) {
  .preset-grid,
  .simulator-grid {
    grid-template-columns: 1fr;
  }
}

.split-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
}

.split-row + .split-row {
  margin-top: 0.5rem;
}
```

---

## 5. Automated Testing Specification (`backend/test_app.py`)

Add the following unit and API integration tests to `backend/test_app.py` and verify 100% pass rate:

1. **`test_largest_remainder_exact_cent_invariant`**:
   * Test splitting `100000` cents (`$1,000.00`) across 3 rules weighted `3334`, `3333`, and `3333` bps ($100.00\%$).
   * Assert allocated cents are `[33340, 33330, 33330]` and sum to `100000`.
   * Test splitting `100` cents (`$1.00`) across 3 equal rules weighted `3333` bps each (`total_bps = 9999`, `pool_cents = 99`).
   * Assert each bucket gets `33` cents, `unallocated_cents == 1`, and `sum(buckets) + unallocated_cents == 100`.
   * Test splitting an odd prime cent value (`1337` cents) across `[5000, 3000, 2000]` bps and assert zero cent drift.

2. **`test_allocation_crud_and_100_percent_cap`**:
   * `POST /api/allocations` with `{"name": "Essentials", "category": "essentials", "weight_bps": 6000, "color": "#3b82f6"}` $\rightarrow$ HTTP `200/201`.
   * `POST /api/allocations` with `{"name": "Investments", "category": "investments", "weight_bps": 5000, "color": "#10b981"}` $\rightarrow$ Expect HTTP `400` because $6000 + 5000 = 11000 > 10000$.
   * `POST /api/allocations` with `{"name": "Paused Bucket", "category": "lifestyle", "weight_bps": 5000, "color": "#8b5cf6", "active": 0}` $\rightarrow$ Expect HTTP `200/201` because inactive rules do not count toward the active cap.

3. **`test_allocation_presets_endpoint`**:
   * `POST /api/allocations/presets` with `{"preset": "student-coop"}`.
   * Verify `GET /api/allocations` returns 4 rules whose `weight_bps` sum to `10000`.

4. **`test_state_endpoint_includes_allocations`**:
   * Call `GET /api/state` and assert `"allocations"` is a list in the response payload containing the configured rules.

---

## 6. Agent Execution Checklist

Execute these steps sequentially and verify each before advancing:

- [ ] **Step 1**: Inspect `backend/app.py` (and `backend/src/` if applicable) to see how `sources`, `paycheques`, and `settings` are initialized and served.
- [ ] **Step 2**: Add `ensure_allocation_schema`, `parse_weight_bps`, `ALLOCATION_PRESETS`, and `allocate_cents_largest_remainder` to `backend/app.py`.
- [ ] **Step 3**: Wire `GET /api/state` (adding `"allocations"`), `GET/POST /api/allocations`, `PUT/DELETE /api/allocations/:id`, and `POST /api/allocations/presets`.
- [ ] **Step 4**: Add the 4 test cases to `backend/test_app.py` and run `python backend/test_app.py` to confirm all tests pass.
- [ ] **Step 5**: Create `frontend/src/lib/allocation-engine.ts` with `allocateCentsLargestRemainder` and `computeAggregateAllocations`.
- [ ] **Step 6**: Create Zod schemas and Server Actions in `frontend/src/features/allocations/`.
- [ ] **Step 7**: Build `/allocations` page (`frontend/src/app/(dashboard)/allocations/page.tsx`), Rule Add/Edit Modal, Preset Selector, and `PaycheckSplitSimulator`.
- [ ] **Step 8**: Add the `Allocations` link to `navbar.tsx` and the compact "Pay Yourself First Split" summary card to the Overview dashboard (`/`).
- [ ] **Step 9**: Run `npm run build` (or `npx tsc --noEmit`) in `frontend/` to confirm zero TypeScript or Next.js build errors.