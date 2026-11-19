# 04 — Hero Number Consistency, Tax Retention Math Alignment & Plain-English Copy

- **Date**: 2026-11-19
- **Title**: Aligning Hero Context, Fixing Partial-Stub Tax Retention Math & Simplifying Copy
- **Status**: Planned Refactor (Pain Point 4 + Paired Feature Wishlist Item 7)
- **Primary Targets**:
  - `frontend/src/lib/tax-intelligence.ts`
  - `frontend/src/features/taxes/components/taxes-dashboard.tsx`
  - `frontend/src/features/allocations/components/allocations-dashboard.tsx`
  - `frontend/src/features/overview/components/overview-dashboard.tsx`
  - `frontend/src/components/ui/year-dropdown.tsx`

---

## Description

Three top-level tabs (`Overview`, `/taxes`, `/allocations`) use identical dark Hero banners and identical `YearDropdown` controls, yet each displays a completely different metric (`Total Net` vs. `True Spendable Net` vs. `Total Allocated`) while `YearDropdown` always displays raw Net amounts. More critically, `/taxes` exhibits a mathematical contradiction whenever a user has logged Gross Pay on only *some* of their paycheques, and `/taxes` + `/allocations` expose internal engineering jargon instead of plain-English financial terminology.

---

## Detailed Problem

### 1. Contradictory Retention Percentages on `/taxes` for Partial Paystub Coverage
In `frontend/src/lib/tax-intelligence.ts:46-50` and `153-158`:
- For individual paycheques without `gross_cents`, `computePaychequeBreakdown` sets `effectiveGrossCents = netCents` (`totalWithheldCents = 0`).
- Then `computeAggregateTaxSummary` computes `netRetentionRateBps` across **only paycheques that have `gross_cents` logged** (`trackedGrossSumCents` / `trackedNetSumCents` at lines `134-158`).
- Meanwhile, in `frontend/src/features/taxes/components/taxes-dashboard.tsx:38-41`, the **Gross-to-Net & Tax Retention Bar** divides by `totalEffectiveGrossCents` across **all** paycheques (including net-only paycheques treated as 0% withheld):
```ts
const grossBase = Math.max(taxSummary.totalEffectiveGrossCents, 1);
const segNetPct = (taxSummary.totalTrueSpendableNetCents / grossBase) * 100;
const segResPct = (taxSummary.totalContractorTaxReserveCents / grossBase) * 100;
const segWithheldPct = (taxSummary.totalWithheldCents / grossBase) * 100;
```
- **Real-user impact**: If a user logs 2 paycheques with full stubs (`$2,000` net / `$2,600` gross = `76.9% retained`) and 6 older net-only paycheques (`$12,000` net, no gross), the Hero subtitle and KPI card report **`76.9% retained`**, while the Retention Bar directly below claims **`True Spendable Net: 95.9%`** and **`Withheld: 4.1%`**. Users lose trust in the math.

### 2. Mismatched `YearDropdown` Totals vs. Hero Totals
In `frontend/src/lib/utils.ts:160-169` and `frontend/src/components/ui/year-dropdown.tsx:125`:
- `resolveYearFilter` always populates `yearOptions` with `sumCents(paycheques)` (raw Net income).
- On `/taxes` (where the Hero number is `True Spendable Net`, e.g., `$46,250`) and `/allocations` (where the Hero number is `Total Allocated`, e.g., `$37,000`), opening `YearDropdown` shows `$50,000` next to `2026`. Without a label, it looks like the dropdown and the Hero banner disagree on the total for the exact same year.

### 3. Confusing Engineering Jargon in User-Facing Copy
Across `taxes-dashboard.tsx` and `allocations-dashboard.tsx`:
- `allocations-dashboard.tsx:281-282`: *"Split every paycheque into exact integer-cent buckets using Largest Remainder conservation."*
- `allocations-dashboard.tsx:434-435`: *"Test any direct deposit or hourly wage what-if scenario with zero-drift cent conservation."*
- `taxes-dashboard.tsx:97`: *"Effective Gross Income"* (without explaining that un-tracked stubs count Net as Gross).
- Real users want to know *"What did I earn before tax?"*, *"How much do I need to set aside?"*, and *"How is each paycheque divided down to the penny?"*—not algorithmic implementation details.

---

## Detailed Solutions

### Solution 1: Fix Partial-Coverage Retention Math & Clearly Separate Tracked vs. Untracked Stubs
In `frontend/src/lib/tax-intelligence.ts` (`AggregateTaxSummary`):
- Track `trackedNetCents`, `trackedGrossCents`, `trackedWithheldCents`, and `untrackedNetCents` explicitly in `computeAggregateTaxSummary`.
- In `TaxesDashboard`:
  1. **When `breakdownCoverageCount < totalPaychequeCount`**: Display a clear inline callout banner on the Gross-to-Net card:
     *"Showing combined totals across X full paystubs and Y net-only deposits (gross pay not entered for Y deposits)."*
     Offer a quick toggle on the Gross-to-Net bar: **`Full Paystubs Only`** (where the bar percentages exactly match the Hero retention rate!) vs. **`All Deposits`**.
  2. When in `All Deposits` mode, label the Hero subtitle accurately (e.g., `76.9% retained on tracked stubs` vs. overall effective rate) so two percentages on the same screen never contradict without context.

### Solution 2: Contextual Hero Subtitles & Explicit `YearDropdown` Labels
- Add a clear eyebrow pill or label in `YearDropdown` option rows (`Net: $50,000.00`) or allow passing page-specific `yearOptions` totals (e.g., `Spendable` on `/taxes`, `Allocated` on `/allocations`, `Net` on `/`) so the dropdown number matches the active page's mental model.
- Add concise 1-line definitions under each Hero metric (`"Take-home pay minus your contractor tax reserve"` on `/taxes`, `"Amount routed to your rules out of $X spendable net"` on `/allocations`).

### Solution 3: Plain-English Copy & Contextual Info Badges
Replace technical jargon with plain, reassuring financial language:
- `allocations-dashboard.tsx:280-283`: Change to *"Automatically divide each paycheque into your savings, investment, and spending buckets down to the exact cent."*
- `allocations-dashboard.tsx:433-436`: Change to *"Preview how a future paycheque or hourly shift splits across your active buckets."*
- `taxes-dashboard.tsx`: Rename `"Effective Gross Income"` → `"Total Gross Income"` (with sub-label `"Includes net-only deposits where gross wasn't entered"` when coverage < 100%) and `"Untaxed Reserve Required"` → `"Tax Set-Aside Needed"`.

### Verification Criteria
- On `/taxes` with mixed full-paystub and net-only paycheques, the Gross-to-Net bar and Hero retention rate never show unexplained conflicting percentages.
- Opening `YearDropdown` on `/taxes` and `/allocations` either shows matching context totals or clearly labels the year totals as `Net`.
- Zero algorithmic jargon (`Largest Remainder conservation`, `zero-drift cent conservation`) remains in user-facing UI strings.
