# UI Audit 07 — Concentric Border Radii on Nested Surfaces

- **Date**: 2026-11-19
- **Title**: Fix Inverted Concentric Border Radii on Nested Drawers & Cards
- **Severity**: MEDIUM (`make-interfaces-feel-better` Rule 1 / `interface-design` Static Polish)
- **Targets**:
  - `frontend/src/features/paycheques/components/paycheque-dialog.tsx:220`
  - `frontend/src/features/sources/components/source-dialog.tsx:158`
  - `frontend/src/features/allocations/components/allocations-dashboard.tsx:350, 368`

---

## Description

Nested rounded containers should follow the concentric radius rule: `outerRadius = innerRadius + padding`. Right now, the collapsible paystub drawer inside `PaychequeDialog` and the tax reserve drawer inside `SourceDialog` use `rounded` (`4px`) as the outer box radius while containing `<input>` fields with `var(--r)` (`10px`) border radius—inverting the nesting geometry and making the corners look pinched.

---

## Detailed Problem

### 1. Inverted Radii in Modal Drawers (`4px` Outer vs. `10px` Inner)
- `frontend/src/features/paycheques/components/paycheque-dialog.tsx:220`:
```tsx
<div className="mt-2 p-3.5 rounded bg-bg border border-line grid gap-3">
```
- `frontend/src/features/sources/components/source-dialog.tsx:158`:
```tsx
<div className="mt-2 p-3.5 rounded bg-bg border border-line grid gap-3">
```
- `globals.css:16, 107`: `--r` is `10px` for `<input>` controls, whereas Tailwind's bare `rounded` utility resolves to `0.25rem` (`4px`). With `p-3.5` (`14px` padding) around `10px`-radius inputs, the outer container should be noticeably rounder than its children (`~16px`–`20px`), not sharper (`4px`).

### 2. Concentric Radii on Dialogs, Cards & Nested Bucket Cards
- `globals.css:195`: `dialog` uses `border-radius: 20px` with `p-[26px]` on the form and `10px` inputs (`10 + 10` matches nicely).
- `globals.css:225`: `.card` uses `--r-lg: 16px` with `padding: 22px`.
- In `allocations-dashboard.tsx:350` and `368`, nested bucket cards inside `.card` (`16px` radius with `22px` padding) use `rounded-xl` (`12px`), and buttons inside those nested cards (`p-[18px]`, line `398`) use `.btn` (`10px` radius), meaning the nested button (`10px`) + `18px` padding sits inside `12px` (noticeably tighter than `16px` outer).

---

## Detailed Solutions

1. Update the nested drawers in `paycheque-dialog.tsx:220` and `source-dialog.tsx:158` from `rounded` (`4px`) to `rounded-2xl` (`16px`), matching `--r-lg` (`16px`) and sitting concentrically inside the `20px`-radius `<dialog>` while enclosing `10px`-radius inputs cleanly.
2. Check other uses of bare `rounded` on interactive/surface elements:
   - `source-detail-view.tsx:51` (`All sources` back link): change `rounded` to `rounded-[var(--r)]` (`10px`) to match `.btn`.
   - `latest-paycheques-list.tsx:37` & `source-detail-view.tsx:242` & `source-detail-actions.tsx:65`: change `rounded` on interactive row buttons/links inside `.card` (`16px`) to `rounded-xl` (`12px`) so row hover highlights nest smoothly inside card corners.
   - `navbar.tsx:57`: change `rounded` on the skip link to `rounded-lg`.

### Verification Criteria
- Inspecting `PaychequeDialog`, `SourceDialog`, and `AllocationsDashboard` visually confirms smooth parallel corner curves between parent containers, nested drawers, and child inputs/buttons.
- Zero nested surface containers have a smaller border-radius than their immediate interactive children.
