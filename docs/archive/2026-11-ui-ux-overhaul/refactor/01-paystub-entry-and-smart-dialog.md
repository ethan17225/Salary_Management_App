# 01 — Smart Two-Mode Paystub Entry, Live Rate Preview & Batch Logging

- **Date**: 2026-11-19
- **Title**: Smart Two-Mode Paystub Entry, Live Hourly Rate Preview & "Save & Add Another"
- **Status**: Planned Refactor (Pain Point 1 + Paired Feature Wishlist Item 3)
- **Primary Targets**:
  - `frontend/src/features/paycheques/components/paycheque-dialog.tsx`
  - `frontend/src/features/paycheques/schemas/paycheque-schema.ts`
  - `frontend/src/lib/tax-intelligence.ts`

---

## Description

Real-world employer paystubs read top-to-bottom from **Gross Pay** through **Income Tax Withheld** and **Deductions (CPP/EI/Benefits)** down to **Net Take-Home Pay**. Currently, `PaychequeDialog` reverses that mental model by forcing Net Pay first, hiding Gross/Tax/Deductions inside a collapsed drawer, requiring a manual click to sync Net from Gross minus deductions, omitting live hourly rate feedback, and closing the modal after every save—making batch entry slow and prone to silent math discrepancies.

---

## Detailed Problem

### 1. Backwards Paystub Entry Flow
In `frontend/src/features/paycheques/components/paycheque-dialog.tsx:185-285`:
- Lines `185-207` always place `Take-home amount` (`payForm.amount`) as the top-level primary field.
- Lines `208-285` hide `Gross Pay ($)`, `Income Tax Withheld ($)`, and `Deductions — CPP / EI / Benefits ($)` behind a collapsed button (`+ Add paystub breakdown (Gross, Tax, Deductions)`).
- Users reading a PDF paystub or payroll portal have to scan down to the net deposit line first, then expand the drawer, then scroll back up to re-enter Gross, Tax, and Deductions.

### 2. Non-Automatic Sync & Silent Math Mismatches
In `frontend/src/features/paycheques/components/paycheque-dialog.tsx:94-104` and `262-282`:
```tsx
const hasLiveBalance =
  Number.isFinite(grossNum) &&
  grossNum > 0 &&
  Number.isFinite(netNum) &&
  netNum > 0 &&
  grossNum >= netNum;
const canAutoFillNet =
  Number.isFinite(grossNum) &&
  grossNum > 0 &&
  (payForm.tax !== '' || payForm.deductions !== '') &&
  grossNum > taxNum + dedNum;
```
- Entering Gross, Tax, and Deductions does **not** automatically compute Net Take-Home Pay unless the user notices and clicks the secondary button `Auto-fill Net from Gross - Deductions ($X)` (`lines 268-282`).
- If the user subsequently tweaks `Gross Pay` or `Income Tax Withheld` and forgets to click the button again, the stale `amount` remains.
- In `frontend/src/features/paycheques/schemas/paycheque-schema.ts:65-74`, validation only rejects cases where `(tax + deductions) > (gross - net)`. If `(tax + deductions) < (gross - net)`, validation passes and `frontend/src/lib/tax-intelligence.ts:54-57` silently absorbs the discrepancy into `unclassifiedWithheldCents`:
```ts
const unclassifiedWithheldCents = Math.max(
  0,
  totalWithheldCents - explicitTaxCents - explicitDeductionsCents
);
```
  The user receives no inline warning in the dialog that `$X.XX` of the gap between Gross and Net is unaccounted for.

### 3. Missing Live Hourly Rate Feedback
In `frontend/src/features/paycheques/components/paycheque-dialog.tsx:323-336`:
- When entering `Hours worked`, there is no inline calculation showing effective `$/h net` or `$/h gross`. A typo like typing `800` instead of `80`, or `250.00` instead of `2500.00`, is only spotted *after* saving and navigating to `/sources/[id]`.

### 4. Friction During Historical Batch Entry
In `frontend/src/features/paycheques/components/paycheque-dialog.tsx:105-118` and `371`:
- `submitPay` always calls `dlgRef.current?.close()` after saving. Users catching up on several paycheques from a job must repeatedly press `N` or click `Add paycheque` for each stub.

---

## Detailed Solutions

### Solution 1: Two-Mode Entry Segmented Toggle (`Quick Net` vs. `Full Paystub`)
Introduce an explicit mode toggle at the top of `PaychequeDialog` (persisting the user's preferred mode per source or in component state, and auto-selecting `Full Paystub` when editing a record that has `gross_cents != null`):
- **`Quick Net` mode**: Keeps the streamlined single-amount workflow for government benefits, simple bank deposits, or tips (`Source` → `Take-home amount` → `Date paid` → `Hours` → `Note`).
- **`Full Paystub` mode**: Presents fields in authentic top-to-bottom paystub order:
  1. `Gross Pay ($)`
  2. `Income Tax Withheld ($)`
  3. `Deductions — CPP / EI / Benefits ($)`
  4. `Net Take-Home Pay ($)` (auto-synced as `gross - tax - deductions` whenever `autoSyncNet` is true).
- If the user manually overrides `Net Take-Home Pay` in `Full Paystub` mode, pause auto-sync and show a clear, subtle reconciliation pill:
  - When `gross - tax - deductions === net`: `"Balanced · 0.00 discrepancy"`.
  - When `unaccounted > 0`: `"Unclassified deduction difference: $X.XX"` with a 1-click `"Sync Net to $Y.YY"` or `"Add to Deductions"` quick fix button.
  - When `tax + deductions > gross - net`: Inline field error before submit rather than waiting for server action failure.

### Solution 2: Live Hourly Rate Preview Pill
Compute `liveNetHourly` and `liveGrossHourly` directly in render whenever `Number(payForm.hours) > 0` and `netNum > 0`:
```tsx
{hoursNum > 0 && netNum > 0 ? (
  <p className="text-xs font-mono text-muted">
    Effective rate: <b className="font-medium text-ink">{formatDollars(netNum / hoursNum)}/h net</b>
    {Number.isFinite(grossNum) && grossNum >= netNum
      ? ` · ${formatDollars(grossNum / hoursNum)}/h gross`
      : null}
  </p>
) : null}
```
Place this directly beneath the `Date paid` / `Hours worked` grid row (`paycheque-dialog.tsx:313-336`) so typos are immediately obvious before saving.

### Solution 3: `"Save & add another"` Batch Workflow
In `PaychequeDialog`'s footer (`paycheque-dialog.tsx:353-372`), when creating a new paycheque (`!payForm.id`), add a secondary action button alongside `Save paycheque`:
- **`Save & add another`**:
  1. Submits the current payload via `savePaychequeAction`.
  2. Fires the confirmation toast (`"Added $X.XX from Source"`).
  3. Keeps the modal open, preserves `source_id` (and paystub mode), clears `amount`, `gross`, `tax`, `deductions`, `hours`, and `note` (or offers `"Same as last time"` immediately), and refocuses the primary monetary input (`grossRef` or `amountRef`).
- Also ensure `reset`/`cancel` clears `payErr` cleanly and tracks `isPending` via `useTransition` so neither button double-submits.

### Verification Criteria
- Switching between `Quick Net` and `Full Paystub` preserves entered values and accurately reflects `gross - tax - deductions`.
- Editing `Gross Pay` in `Full Paystub` mode automatically updates `Take-Home Net` unless manually overridden; any discrepancy displays an inline warning with a 1-click fix.
- Entering `Hours` > 0 immediately shows `$/h net` (and `$/h gross` when present).
- Clicking `Save & add another` persists the paycheque, triggers a toast, keeps the dialog open on the same source, and returns focus to the first amount input.
