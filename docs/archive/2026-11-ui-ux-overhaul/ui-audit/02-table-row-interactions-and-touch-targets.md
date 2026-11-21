# UI Audit 02 — Table Row Interactions, Nested Controls & Minimum Touch Targets

- **Date**: 2026-11-19
- **Title**: Fix Non-Accessible `<tr onClick>` Handlers, Nested Buttons & Undersized Touch Targets in Ledger Tables
- **Severity**: HIGH (WCAG 2.1.1 Keyboard / 2.5.8 Touch Target Size / HTML Semantics)
- **Targets**:
  - `frontend/src/features/paycheques/components/paycheque-ledger.tsx:136-215`
  - `frontend/src/features/sources/components/source-paycheque-ledger.tsx:112-183`
  - `frontend/src/features/taxes/components/taxes-dashboard.tsx:249-407`

---

## Description

All four interactive ledger tables (`/paycheques`, `/sources/[id]`, and the two tables on `/taxes`) attach `onClick` directly to `<tr>` elements while simultaneously placing `<button>` elements inside the first cell (and inside the last cell for `Split`). Additionally, the `Split` pill button in `PaychequeLedger` is only `24px` tall (`min-h-6`), sitting inside an `onClick` `<tr>`—creating a severe mis-tap hazard on mobile and violating WCAG 2.5.8 / 44px touch target guidelines.

---

## Detailed Problem

### 1. Non-Semantic `<tr onClick>` With Nested Interactive Controls
- `frontend/src/features/paycheques/components/paycheque-ledger.tsx:136-157`:
```tsx
<tr
  key={p.id}
  className="cursor-pointer transition-colors duration-120 hover:bg-[#f4f8f9]"
  onClick={() => openPaychequeDialog(p)}
>
  <td>
    <button
      className="link"
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openPaychequeDialog(p);
      }}
      aria-label={`Edit paycheque from ${dateLabel(p.paid_on)}`}
    >
      ...
    </button>
  </td>
```
- Same pattern appears in:
  - `frontend/src/features/sources/components/source-paycheque-ledger.tsx:112-133` (note also the `<button className="link">` here has **no `aria-label`** like `"Edit paycheque from ..."`!)
  - `frontend/src/features/taxes/components/taxes-dashboard.tsx:249-269` (also missing `aria-label` clarity on `<button className="link">`)
  - `frontend/src/features/taxes/components/taxes-dashboard.tsx:349-370` (also missing `aria-label` on date `<button className="link">`)
- Clicking the `<tr>` works with a mouse, but keyboard users only reach the Date `<button>`, and screen-reader users hear duplicate announcements or ambiguous row action affordances.

### 2. Tiny `24px` `Split` Pill Inside Clickable Row
In `frontend/src/features/paycheques/components/paycheque-ledger.tsx:184-194`:
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
- `min-h-6` is `24px` tall, and its horizontal padding is `8px` (`px-2`). On touch screens, missing the `24px` pill by 2 pixels triggers the parent `<tr onClick>` and unexpectedly opens the Edit Paycheque modal instead of viewing the split.
- Furthermore, other compact buttons in `allocations-dashboard.tsx:398,405,412` (`min-h-[34px]`) and `paycheque-dialog.tsx:211` (`min-h-[36px]`) fall short of the recommended `40–44px` hit target.

---

## Detailed Solutions

### Solution 1: Replace Row-Wide `<tr onClick>` With Explicit Action Controls or Stretched Trigger Pattern
Instead of attaching `onClick` to `<tr>` around other buttons:
1. Keep the Date `<button className="link">` as the primary semantic Edit trigger (with descriptive `aria-label={`Edit ${s.name} paycheque on ${dateLabel(p.paid_on)} for ${fmt(p.amount_cents)}`}`), OR add an explicit trailing `Actions` column with `Edit` and `Split` buttons (`min-h-[40px]` desktop / `min-h-[44px]` touch via padding or pseudo-element hit area).
2. If preserving full-row mouse click convenience on desktop, remove `onClick` from `<tr>` and only trigger row click if `!e.target.closest('button, a')` on a row without nested conflicts—OR preferably keep `Edit` and `Split` as clear sibling `<button>` actions so mouse, touch, and keyboard behaviors are 100% consistent and unambiguous.

### Solution 2: Increase Hit Areas to ≥ 40×40px / 44×44px
- Upgrade the `Split` trigger button in `paycheque-ledger.tsx` (and action buttons in `allocations-dashboard.tsx`) to `min-h-[40px] sm:min-h-[36px]` with an extended hit-area pseudo-element (`relative after:absolute after:-inset-1.5`) when compact visual height is desired, ensuring no two hit areas overlap.
- Add explicit `aria-label`s to all row edit buttons in `source-paycheque-ledger.tsx:118` and `taxes-dashboard.tsx:260,355`.

### Verification Criteria
- Keyboard Tab navigation moves cleanly through every row's Edit and Split actions with zero unlabelled controls.
- Every interactive button in ledger tables measures at least `40×40px` (`44×44px` on touch) with zero accidental modal opens when tapping `Split`.
