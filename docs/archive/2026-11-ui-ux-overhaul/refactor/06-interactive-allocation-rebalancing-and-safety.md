# 06 — Interactive Allocation Rebalancer, Preset Safety & Simulator Tax Awareness

- **Date**: 2026-11-19
- **Title**: Multi-Bucket Inline Rebalancing, Preset Confirmation/Undo & Deduplicated CTAs
- **Status**: Planned Refactor (Pain Point 6 + Paired Feature Wishlist Item 4)
- **Primary Targets**:
  - `frontend/src/features/allocations/components/allocations-dashboard.tsx`
  - `frontend/src/features/allocations/actions.ts`
  - `frontend/src/features/allocations/schemas.ts`
  - `backend/src/allocations.py`

---

## Description

Managing Pay-Yourself-First rules on `/allocations` currently suffers from three sharp UX pain points: (1) picking a template in `"Reset with Preset…"` immediately destroys all custom buckets with zero confirmation or undo, (2) two nearly identical `+ New Bucket` primary buttons appear right on top of each other, and (3) rebalancing weights across buckets at 100% requires tedious sequential modal edits.

---

## Detailed Problem

### 1. Destructive One-Click Preset Overwrite With No Confirmation or Undo
In `frontend/src/features/allocations/components/allocations-dashboard.tsx:286-302` and `224-231`:
```tsx
<select
  aria-label="Reset with preset"
  value=""
  onChange={(e) => {
    if (e.target.value) void handleApplyPreset(e.target.value);
  }}
  className="w-auto"
>
```
- On the backend (`backend/src/allocations.py:400`), `apply_preset` runs `await db.execute(delete(AllocationRule))` unconditionally.
- Because `handleApplyPreset` triggers directly from `<select onChange>`, an accidental click or arrow-key browse while focused on the `<select>` immediately wipes every custom allocation bucket the user configured—with no confirmation dialog and no Undo button on the toast.

### 2. Duplicate Primary Actions Stacked Vertically
In `frontend/src/features/allocations/components/allocations-dashboard.tsx:263-269` and `303-309`:
- The Hero action column renders `<button className="btn primary">+ New Allocation Bucket</button>`.
- Directly below it, the `Pay Yourself First Rules` card header renders `<button className="btn primary">+ New Bucket</button>`.
- Having two primary teal CTAs doing the exact same thing within 60px violates visual hierarchy (*one focal action per zone*).

### 3. Painful Sequential Modal Editing to Rebalance 100%
In `frontend/src/features/allocations/components/allocations-dashboard.tsx:137-182` and `backend/src/allocations.py:368-371`:
- Every rule is validated individually against `other_active + weight_bps <= 10000`.
- If a user has 3 buckets totaling `100%` (`50% / 20% / 30%`) and wants to shift `5%` from `Lifestyle (30% -> 25%)` to `Investments (20% -> 25%)`, they must:
  1. Click `Edit` on Lifestyle → change `30` to `25` → Save → wait for revalidation.
  2. Click `Edit` on Investments → change `20` to `25` → Save.
  If they try to raise Investments first, the backend rejects it with `"Total active allocations cannot exceed 100% (10000 bps)."`

### 4. Split Simulator Ignores Untaxed Contractor Reserve Sources
In `frontend/src/features/allocations/components/allocations-dashboard.tsx:124-127`:
- The simulator calls `allocateCentsLargestRemainder(simCents, rules)` with default `taxReserveCents = 0`, so contractors with a 25% untaxed source cannot preview the tax reserve deduction in the simulator before splitting.

---

## Detailed Solutions

### Solution 1: Preset Confirmation Dialog + Snapshot Undo
- When `rules.length > 0`, selecting a preset in `"Reset with Preset…"` opens a clean confirmation `<dialog>` (`"Replace your X custom buckets with [Preset Title]?"`) showing a side-by-side preview of the preset buckets before confirming.
- Even after confirming, snapshot the previous `rules` array in memory and pass an `undo` handler to `toast('Applied allocation preset', async () => ...)` that restores the previous buckets if clicked within 7 seconds.

### Solution 2: Remove Duplicate CTA & Introduce `"Rebalance percentages"` Mode
- Remove the redundant `+ New Allocation Bucket` button from the Hero right column (keeping `YearDropdown` + summary cleanly anchored in the Hero, and keeping `+ New Bucket` + `"Rebalance"` in the Rules card header).
- Add an inline **`Rebalance`** toggle button in the Rules card header:
  - Toggles all active bucket cards into an inline batch-edit state with range sliders + numeric percentage inputs (`0.00%`–`100.00%`), plus a live header total pill (`"Total allocated: 100.0% · 0.0% unallocated"`).
  - Enables **`Save allocation mix`** whenever `totalActivePct <= 100`.
  - Add a batch rebalance endpoint (`PUT /api/allocations/rebalance`) in `backend/src/allocations.py` (or ordered safe updates) that validates `sum(active_weight_bps) <= 10000` atomically in one transaction so users can freely shift percentages up and down without temporary-sum errors.

### Solution 3: Source Tax-Reserve Selector in the Simulator
- Add an optional `Source / Tax Reserve` selector (`None (already net)` or any untaxed source / custom reserve %) in the Paycheque Split Simulator (`allocations-dashboard.tsx:462-529`) so contractors see `Simulated Deposit → Tax Set-Aside → Spendable Net → Bucket Splits`.

### Verification Criteria
- Selecting a preset when existing rules are present prompts for confirmation before deleting existing rules, and the resulting toast allows 1-click Undo.
- Only one `+ New Bucket` primary button exists on `/allocations`.
- Users can shift 5% from one bucket to another in `Rebalance` mode and save in a single click without encountering intermediate `> 100%` errors.
