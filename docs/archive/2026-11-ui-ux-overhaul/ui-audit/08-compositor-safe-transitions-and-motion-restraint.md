# UI Audit 08 — Compositor-Safe Transitions, Reduced Motion & Removal of `transition-all`

- **Date**: 2026-11-19
- **Title**: Replace `transition-all` and Layout Property Transitions with GPU-Composited Properties & Standard Curves
- **Severity**: MEDIUM (Web Interface Guidelines / `make-interfaces-feel-better` Rule 14 / `baseline-ui`)
- **Targets**:
  - `frontend/src/components/ui/dialog-provider.tsx:99`
  - `frontend/src/components/ui/year-dropdown.tsx:47`
  - `frontend/src/features/paycheques/components/paycheque-dialog.tsx:173`
  - `frontend/src/features/sources/components/source-card.tsx:22`
  - `frontend/src/components/layout/navbar.tsx:57`
  - `frontend/src/features/allocations/components/allocations-dashboard.tsx:321, 331`
  - `frontend/src/styles/globals.css:183, 245, 297, 374, 412`

---

## Description

Several components use `transition-all`, which Web Interface Guidelines and `make-interfaces-feel-better` explicitly forbid because it transitions unintended layout/paint properties and hurts performance. Additionally, the skip link in `Navbar` animates the layout property `top`, and the allocation bar segments animate `width`.

---

## Detailed Problem

### 1. Prohibited `transition-all` Usages
- `frontend/src/components/ui/dialog-provider.tsx:99`:
  `'fixed left-1/2 bottom-6 ... transition-all duration-200 min-h-[52px]'`
- `frontend/src/components/ui/year-dropdown.tsx:47`:
  `'inline-flex ... transition-all duration-150 active:scale-[0.98]'`
- `frontend/src/features/paycheques/components/paycheque-dialog.tsx:173`:
  `'... transition-all duration-150 hover:border-[#c4cfd5] active:scale-[0.97]'`
- `frontend/src/features/sources/components/source-card.tsx:22`:
  `'card src clickable group ... transition-all duration-180 hover:-translate-y-0.5'`

### 2. Layout-Triggering Property Transitions
- `frontend/src/components/layout/navbar.tsx:57`:
  `className="absolute left-3 -top-20 focus:top-3 z-50 bg-ink text-white px-4 py-2.5 rounded transition-[top]"`
  Animating `top` forces layout recalculation on focus.
- `frontend/src/features/allocations/components/allocations-dashboard.tsx:321, 331`:
  `className="h-full transition-[width] duration-250 ease-out"` (note also `duration-250` is non-standard in Tailwind v4 unless configured; standard scale is `duration-200` / `duration-300`, and `width` triggers layout).
- `frontend/src/styles/globals.css:183`: `progress::-webkit-progress-value { transition: width .6s; }`

### 3. Press Scale Consistency
- `globals.css:254`: `.btn:active { transform: translateY(1px) scale(.98); }`
- `globals.css:382`: `.chip span:active { transform: scale(.97); }`
- `year-dropdown.tsx:47` & `paycheque-dialog.tsx:173`: `active:scale-[0.98]` / `active:scale-[0.97]` — good tactile scale (within 0.95–0.98), just coupled to `transition-all`.

---

## Detailed Solutions

1. **Replace every `transition-all` with explicit property lists**:
   - `dialog-provider.tsx:99`: `transition-[opacity,transform] duration-200 ease-out`
   - `year-dropdown.tsx:47`: `transition-[background-color,border-color,transform] duration-150`
   - `paycheque-dialog.tsx:173`: `transition-[border-color,background-color,transform] duration-150`
   - `source-card.tsx:22`: `transition-[border-color,box-shadow,transform] duration-150`
2. **Convert `Navbar` Skip Link to `transform` Animation**:
   - `navbar.tsx:57`: Replace `-top-20 focus:top-3 ... transition-[top]` with `top-3 -translate-y-24 focus:translate-y-0 transition-transform duration-150 ease-out` so reveal happens entirely on the GPU compositor.
3. **Standardize Tailwind v4 Duration Classes**:
   - Check custom/non-standard durations like `duration-120`, `duration-180`, `duration-250` (`year-dropdown.tsx:63, 94`, `paycheque-ledger.tsx:138`, `source-card.tsx:22, 41`, `taxes-dashboard.tsx:251, 351`, `allocations-dashboard.tsx:321`) and align them to standard Tailwind durations (`duration-150`, `duration-200`) so Tailwind actually emits every utility class! *(Note: in Tailwind v4 without custom `--duration-120` tokens, `duration-120` / `duration-180` / `duration-250` may not produce CSS unless arbitrary `duration-[180ms]` is used!)*

### Verification Criteria
- Zero occurrences of `transition-all` or `transition-[top]` remain in `frontend/src/`.
- Skip-to-content link animates smoothly via `translateY` on keyboard Tab and respects `prefers-reduced-motion`.
- No un-emitted Tailwind duration classes (`duration-120`, `duration-180`, `duration-250`) remain; all transitions run at `<= 200ms` using valid Tailwind utilities.
