# 02 — Actionable Payday Transfer Checklist & Split Drawer

- **Date**: 2026-11-19
- **Title**: Interactive "Payday Transfer Checklist" After Logging & From Ledger Rows
- **Status**: Planned Refactor (Pain Point 2 + Paired Feature Wishlist Item 1)
- **Primary Targets**:
  - `frontend/src/components/ui/dialog-provider.tsx`
  - `frontend/src/features/paycheques/components/paycheque-dialog.tsx`
  - `frontend/src/features/paycheques/components/paycheque-ledger.tsx`
  - `frontend/src/features/sources/components/source-paycheque-ledger.tsx`
  - `frontend/src/lib/allocation-engine.ts`
  - `frontend/src/lib/tax-intelligence.ts`

---

## Description

The core value proposition of combining **Contractor Tax Reserves** and **Pay-Yourself-First Allocations** is telling the user *exactly what transfers to make in their banking app* the moment a paycheque lands. Today, logging a paycheque produces a fleeting 3-second toast, and viewing a paycheque's bucket split requires hunting down the row in `/paycheques` and expanding a tiny inline text block inside the right-hand table cell.

---

## Detailed Problem

### 1. Dead-End Feedback When Logging a Paycheque
In `frontend/src/features/paycheques/components/paycheque-dialog.tsx:105-118`:
```tsx
dlgRef.current?.close();
toast(
  payForm.id
    ? 'Paycheque updated'
    : `Added ${formatDollars(+payForm.amount)} from ${srcById(+payForm.source_id).name}`
);
```
- Right after clicking `Save paycheque`, the user is given zero summary of how much of that deposit belongs to their **Contractor Tax Reserve** or each **Allocation Bucket** (e.g., Essentials, TFSA/FHSA, Emergency Buffer, Lifestyle).
- Notice also `DialogProvider.toast` (`frontend/src/components/ui/dialog-provider.tsx:46-50`) only accepts an optional `undo` callback and auto-dismisses after 3000ms without `undo`.

### 2. Cramped & Hidden Split UI in `/paycheques`
In `frontend/src/features/paycheques/components/paycheque-ledger.tsx:182-213`:
- Viewing a paycheque's split requires navigating to `/paycheques`, finding the row, and clicking a `min-h-6` (`24px`) `Split` pill nested inside a clickable `<tr>`:
```tsx
<button
  type="button"
  className="inline-flex items-center min-h-6 py-0.5 px-2 rounded-full text-xs font-mono bg-accent-soft text-accent-2 border border-transparent cursor-pointer"
  aria-expanded={expandedSplitId === p.id}
  onClick={(e) => {
    e.stopPropagation();
    setExpandedSplitId((prev) => (prev === p.id ? null : p.id));
  }}
>
  {expandedSplitId === p.id ? 'Hide split' : 'Split'}
</button>
```
- Expanded splits render inside the narrow right-aligned `Amount` `<td>` (`lines 196-210`), with no checkboxes, no copy-to-clipboard buttons for exact cent amounts, and no split capability on `SourcePaychequeLedger` (`frontend/src/features/sources/components/source-paycheque-ledger.tsx`).

---

## Detailed Solutions

### Solution 1: Build `PaydayChecklistDialog` Component
Create a dedicated modal/drawer component (e.g., `frontend/src/features/paycheques/components/payday-checklist-dialog.tsx`) wired through `DialogProvider` (`openChecklistDialog(paycheque)`):
1. **Waterfall Header**:
   - Displays Source badge, deposit date, and **Gross → Withheld** (if paystub logged) → **Net Deposit**.
   - If the source is untaxed (`is_tax_withheld === 0`), highlights the **Tax Reserve Set-Aside** step prominently at the top (`"Move $X.XX to Tax Reserve account"`).
   - Shows **True Spendable Net** (the distributable pool).
2. **Interactive Transfer Checklist**:
   - Uses `allocateCentsLargestRemainder(breakdown.trueSpendableNetCents, allocations, breakdown.contractorTaxReserveCents)` from `frontend/src/lib/allocation-engine.ts:63-131`.
   - Lists each active bucket (plus Tax Reserve if > 0 and Unallocated Cash Buffer if > 0) as a checkable row with:
     - Checkbox (local session/localStorage state keyed by `paycheque.id` so the user can check off transfers while switching between Payday and their bank app).
     - Bucket color dot, name, category badge, and percentage share.
     - Exact tabular dollar amount (`fmt(bucket.allocated_cents)`).
     - **1-click `"Copy"` button** copying the raw decimal string (`(cents / 100).toFixed(2)`) to `navigator.clipboard` with instant `"Copied"` feedback.
3. **Completion Summary**:
   - Progress counter (`"3 of 4 transfers completed"`) and quick link to `"Edit split rules"` (`/allocations`).

### Solution 2: Seamless Triggers in Save Flow & Ledgers
- **After `PaychequeDialog` Create**:
  - Extend `DialogProvider.toast` to support a generic optional action (`action?: { label: string; onClick: () => void | Promise<void> }`) alongside `undo`, or add an optional toggle `"Show payday transfer checklist after saving"` right in `PaychequeDialog` when active allocation rules or a contractor tax reserve exist.
  - Even without auto-open enabled, show a `"View transfer checklist"` action button inside the post-save toast (with a 7-second window).
- **From `PaychequeLedger` and `SourcePaychequeLedger`**:
  - Replace the cramped inline `24px` `Split` expansion inside the table cell with an accessible button (`min-h-[36px]`) that opens `PaydayChecklistDialog` for that paycheque.

### Verification Criteria
- Saving a new paycheque when allocation rules or a contractor tax reserve are configured provides immediate 1-click access to the Transfer Checklist modal.
- Clicking `"Copy"` copies exact two-decimal currency values (e.g., `480.00`) without currency symbols, suitable for pasting into bank transfer forms.
- Checking off buckets persists across modal reopens (via `localStorage` keyed by paycheque ID) and updates the completion count cleanly.
- All interactive controls inside the checklist meet `44×44px` or `40×40px` touch targets and `Escape` closes the `<dialog>`.
