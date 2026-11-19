# Master UI/UX, Accessibility & Feature Improvement Plan

- **Date**: 2026-11-19
- **Title**: Payday Frontend & Supporting Backend Master Improvement Plan
- **Scope**: Complete implementation blueprint covering all UX Refactors (`refactor/`), Standalone Feature Specs (`features/`), and UI Craft / Accessibility Audits (`ui-audit/`).
- **Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 (`frontend/src/styles/globals.css`), Chart.js 4, Zod, FastAPI + SQLAlchemy 2.0 Async + SQLite (`backend/src/`).

---

## Executive Summary & Architecture Principles

Payday already has a distinctive cool-slate + teal aesthetic (`Outfit` + `DM Mono`, `tabular-nums`, native `<dialog>` modals, and exact integer-cent precision). However, putting ourselves in the shoes of a real user revealed **7 workflow pain points**, **2 standalone feature gaps** (on top of 5 wishlist upgrades paired with those pain points), and **10 UI craft / Web Interface Guidelines violations**.

This plan sequences every improvement into **4 cohesive implementation phases** designed to avoid merge conflicts and keep the codebase clean, modular, and strictly typed:

1. **Integer-Cents Invariant**: All currency calculations (`amount_cents`, `gross_cents`, `tax_cents`, `deductions_cents`, `tax_reserve_bps`, `weight_bps`) remain exact integer cents/basis points end-to-end.
2. **Design System First**: Shared primitives (`ColorSwatchPicker`, `Skeleton`, `YearDropdown` keyboard behavior, `globals.css` tokens & radii) land in Phase 1 before feature dialogs compose them in Phases 2–4.
3. **URL-Driven State**: Year selection (`?year=`) and ledger filters (`?year=&source=&q=`) live in URL query parameters so back/forward, sharing, tab switches, and CSV exports stay synchronized.
4. **Zero Regressions**: Every phase ends with `npm run typecheck`, `npm run build` (`frontend/`), and `pytest` + `ruff check .` (`backend/`).

---

## Cross-Reference Matrix

| Document | Category | Phase | Primary Files Affected |
| :--- | :--- | :--- | :--- |
| [01 — Semantic Card Navigation](../ui-audit/01-semantic-card-navigation-and-link-overlay.md) | UI Audit (HIGH) | Phase 1 | `source-card.tsx` |
| [02 — Table Row Interactions & Touch Targets](../ui-audit/02-table-row-interactions-and-touch-targets.md) | UI Audit (HIGH) | Phase 1 | `paycheque-ledger.tsx`, `source-paycheque-ledger.tsx`, `taxes-dashboard.tsx`, `allocations-dashboard.tsx` |
| [03 — YearDropdown Keyboard Navigation](../ui-audit/03-year-dropdown-keyboard-navigation-and-focus.md) | UI Audit (HIGH) | Phase 1 | `year-dropdown.tsx` |
| [04 — Async Form Pending States & Guards](../ui-audit/04-async-form-pending-states-and-double-submit-prevention.md) | UI Audit (HIGH) | Phase 1 | `paycheque-dialog.tsx`, `source-dialog.tsx`, `goal-dialog.tsx`, `allocations-dashboard.tsx`, `globals.css` |
| [05 — Taxes Retention & Contrast Guard](../ui-audit/05-taxes-retention-bar-and-legend-color-consistency.md) | UI Audit (HIGH) | Phase 1 | `globals.css`, `taxes-dashboard.tsx`, `source-card.tsx` |
| [06 — Unified Color Swatch Picker](../ui-audit/06-unified-color-swatch-picker-and-touch-sizing.md) | UI Audit (MEDIUM) | Phase 1 | `color-swatch-picker.tsx` (new), `source-dialog.tsx`, `allocations-dashboard.tsx` |
| [07 — Concentric Border Radii](../ui-audit/07-concentric-border-radii-on-nested-surfaces.md) | UI Audit (MEDIUM) | Phase 1 | `paycheque-dialog.tsx`, `source-dialog.tsx`, `source-detail-view.tsx`, `latest-paycheques-list.tsx`, `source-detail-actions.tsx`, `navbar.tsx` |
| [08 — Compositor-Safe Transitions](../ui-audit/08-compositor-safe-transitions-and-motion-restraint.md) | UI Audit (MEDIUM) | Phase 1 | `dialog-provider.tsx`, `year-dropdown.tsx`, `paycheque-dialog.tsx`, `source-card.tsx`, `navbar.tsx`, `taxes-dashboard.tsx`, `allocations-dashboard.tsx` |
| [09 — Structural Loading Skeletons](../ui-audit/09-structural-loading-skeletons-and-cls-prevention.md) | UI Audit (MEDIUM) | Phase 1 | `skeleton.tsx` (new), `app/(dashboard)/loading.tsx`, `app/(dashboard)/sources/[id]/loading.tsx` |
| [10 — Form Attributes & Typography](../ui-audit/10-form-attributes-typography-and-placeholder-standards.md) | UI Audit (MEDIUM) | Phase 1 | `globals.css`, `global-error.tsx`, `not-found.tsx`, `source-detail-view.tsx`, all form inputs |
| [04 — Hero Consistency, Tax Math & Copy](../refactor/04-hero-consistency-tax-math-and-plain-copy.md) | Refactor + Wishlist #7 | Phase 2 | `tax-intelligence.ts`, `taxes-dashboard.tsx`, `allocations-dashboard.tsx`, `year-dropdown.tsx` |
| [05 — Persistent Year & URL Filters](../refactor/05-persistent-year-and-url-filter-state.md) | Refactor | Phase 2 | `navbar.tsx`, `paycheque-ledger.tsx`, `paycheques-view.tsx`, `source-paycheque-ledger.tsx` |
| [01 — Smart Paystub Entry Dialog](../refactor/01-paystub-entry-and-smart-dialog.md) | Refactor + Wishlist #3 | Phase 3 | `paycheque-dialog.tsx`, `paycheque-schema.ts`, `tax-intelligence.ts` |
| [02 — Actionable Payday Checklist](../refactor/02-actionable-payday-transfer-checklist.md) | Refactor + Wishlist #1 | Phase 3 | `payday-checklist-dialog.tsx` (new), `dialog-provider.tsx`, `paycheque-dialog.tsx`, `paycheque-ledger.tsx`, `source-paycheque-ledger.tsx` |
| [03 — Interactive Next Paydays & Schedules](../refactor/03-interactive-next-paydays-and-schedules.md) | Refactor + Wishlist #2 | Phase 3 | `upcoming-paydays-list.tsx` (new), `overview-dashboard.tsx`, `source-dialog.tsx`, `utils.ts`, `payday.ts`, `backend/src/sources/*`, `backend/src/database.py` |
| [07 — First-Run Onboarding & Mobile Nav](../refactor/07-first-run-onboarding-and-mobile-navigation.md) | Refactor | Phase 3 | `overview-dashboard.tsx`, `navbar.tsx`, `(dashboard)/layout.tsx`, `paycheque-dialog.tsx` |
| [06 — Allocation Rebalancer & Safety](../refactor/06-interactive-allocation-rebalancing-and-safety.md) | Refactor + Wishlist #4 | Phase 4 | `allocations-dashboard.tsx`, `actions.ts`, `schemas.ts`, `backend/src/allocations.py` |
| [Feature 4 — Goal Pace Chart Overlays](../features/feature_4_goal_pace_chart_overlays_and_projections.md) | Feature (Wishlist #5) | Phase 4 | `overview-charts.tsx`, `overview-dashboard.tsx`, `get-overview-data.ts`, `overview-types.ts` |
| [Feature 5 — CSV Import UI & Filtered Export](../features/feature_5_filtered_csv_export_and_import_ui_wizard.md) | Feature (Wishlist #6) + [Feature 3](../features/feature_3_idempotent_bulk_csv_paystub_importer_spec.md) | Phase 4 | `csv-import-dialog.tsx` (new), `paycheques-view.tsx`, `backend/src/paycheques/router.py`, `backend/src/paycheques/service.py` |

---

## Phase 1 — Design System Foundations, Accessibility & Guidelines Compliance

**Goal**: Eliminate every HIGH and MEDIUM audit finding (`ui-audit/01` through `ui-audit/10`) and create reusable primitives needed by later phases.

### Step 1.1: Global CSS Tokens, Disabled States, Transitions & Typography (`frontend/src/styles/globals.css`)
- Add `--warn: #d97706;` and map `--color-warn: var(--warn);` inside `@theme inline`.
- Add `text-wrap: balance;` to `h1, h2, h3` and `text-wrap: pretty;` to `p` in `@layer base`.
- Add `.btn:disabled` styling (`opacity: 0.6; cursor: not-allowed; transform: none;`) so disabled form buttons never bounce on `:active`.
- Verify `globals.css` uses explicit transition properties (replace `transition: width .6s;` on `progress::-webkit-progress-value` or ensure `prefers-reduced-motion` suppresses it cleanly).

### Step 1.2: New Shared Primitives
- Create `frontend/src/components/ui/color-swatch-picker.tsx`:
  - Renders `SOURCE_COLORS` as `size-10` (`40×40px`) circular swatch buttons with descriptive names, `aria-pressed`, white checkmark icon on active swatch, and an aligned `size-10` custom `<input type="color">`.
- Create `frontend/src/components/ui/skeleton.tsx`:
  - Lightweight composable `<Skeleton className="..." />` respecting `prefers-reduced-motion` (`motion-safe:animate-pulse`).
- Update `frontend/src/app/(dashboard)/loading.tsx` and `frontend/src/app/(dashboard)/sources/[id]/loading.tsx` to render structural Hero + KPI + chart/table skeletons matching real route dimensions.

### Step 1.3: Accessible Interactive Components & Semantic Markup
- **`frontend/src/features/sources/components/source-card.tsx`**:
  - Remove `onClick` from `<article>` and remove `useRouter`.
  - Add `relative` to `<article>` and stretch `<Link href={href}>` with `after:absolute after:inset-0 after:rounded-[inherit]`.
  - Keep `Edit` button at `relative z-10` with `aria-label={`Edit ${source.name}`}`.
  - Switch `"View details"` text from `text-(--c)` to `text-ink` paired with a `size-2 rounded-full bg-(--c)` indicator dot.
- **`frontend/src/components/ui/year-dropdown.tsx`**:
  - Add `triggerRef`, `listboxId = useId()`, `optionRefs`, `aria-controls`, `Escape` focus return, and `ArrowDown` / `ArrowUp` / `Home` / `End` keyboard navigation.
  - Wrap `<button role="option">` inside `<li role="none">` and replace `transition-all` / `duration-120` / `duration-180` with explicit compositor transitions (`transition-[background-color,border-color,transform] duration-150`).
- **Table & Dialog Accessibility (`paycheque-ledger.tsx`, `source-paycheque-ledger.tsx`, `taxes-dashboard.tsx`)**:
  - Replace bare row `<tr onClick>` conflicts with clear `aria-label`s on row trigger buttons (`Edit {source} paycheque on {date} for {amount}`) and expand compact `Split` / card button hit areas to `>= 40px` (`min-h-[40px]` or extended `after:-inset-1.5` hit target).
- **Taxes Color Alignment (`taxes-dashboard.tsx`)**:
  - Change legend dots (`bg-[#10b981]`, `bg-[#f59e0b]`, `bg-[#f43f5e]`) to `bg-up`, `bg-warn`, `bg-down`, matching the bar segments 1:1.

### Step 1.4: Form Pending States, Concentric Radii & Input Polish
- Add `pending` state (`'save' | 'delete' | null`) + `"Saving…"` / `"Deleting…"` labels + `disabled` props to `PaychequeDialog`, `SourceDialog`, `GoalDialogTrigger`, and `AllocationsDashboard`.
- Add 2-step delete confirmation inside `SourceDialog` (`Delete source` → `Confirm delete`).
- Swap `rounded` (`4px`) → `rounded-2xl` (`16px`) on nested drawers in `paycheque-dialog.tsx` and `source-dialog.tsx`, and `rounded` → `rounded-xl` on row highlights inside `.card`.
- Remove all remaining `transition-all`, `transition-[top]` (convert `Navbar` skip link to `top-3 -translate-y-24 focus:translate-y-0 transition-transform duration-150`), and invalid Tailwind durations (`duration-120`, `duration-180`, `duration-250`).
- Add `name`, `autoComplete="off"`, and trailing `…` placeholders across all form inputs; fix `<h1>` hierarchy in `global-error.tsx` and `not-found.tsx`.

---

## Phase 2 — Navigation, Filter Persistence & Tax/Hero Data Clarity

**Goal**: Make year switching, ledger filtering, CSV exports, and tax/allocation metrics coherent and persistent (`refactor/04`, `refactor/05`).

### Step 2.1: Persistent `?year=` Across `Navbar` & URL-Synced Ledger Filters
- **`frontend/src/components/layout/navbar.tsx`**:
  - Read `useSearchParams()` inside a `<Suspense>`-safe child nav component so `?year=YYYY` or `?year=all` is preserved on links to `/`, `/paycheques`, `/taxes`, and `/allocations`.
- **`frontend/src/features/paycheques/components/paycheque-ledger.tsx` & `source-paycheque-ledger.tsx`**:
  - Sync `year`, `source`, and debounced `q` filter updates to the URL via `router.replace(..., { scroll: false })`.
  - Add a summary strip (`"Showing X of Y paycheques · $Z"`) and a `"Clear filters"` action button (also displayed in the empty-filter table state).

### Step 2.2: Tax Retention Math Alignment & Plain-English Copy
- **`frontend/src/lib/tax-intelligence.ts`**:
  - Expand `AggregateTaxSummary` to also expose `trackedNetCents`, `trackedGrossCents`, `trackedWithheldCents`, and `untrackedNetCents` alongside existing fields (maintaining backwards compatibility).
- **`frontend/src/features/taxes/components/taxes-dashboard.tsx`**:
  - When `0 < breakdownCoverageCount < totalPaychequeCount`, add a clear coverage banner and toggle between **`Full Paystubs Only`** (percentages match Hero retention rate 1:1) and **`All Deposits`** (renders a distinct neutral segment for *"Net-only deposits (no paystub logged)"*).
  - Rewrite technical headings/descriptions (`Effective Gross Income` → `Total Gross Income`, `Untaxed Reserve Required` → `Tax Set-Aside Needed`).
- **`frontend/src/features/allocations/components/allocations-dashboard.tsx`**:
  - Replace `"Largest Remainder conservation"` and `"zero-drift cent conservation"` with plain-English explanations.
- **`frontend/src/components/ui/year-dropdown.tsx` & Page Props**:
  - Label year option amounts clearly (e.g., `Net` or page-contextual total) so users never misread raw net dropdown totals against Spendable Net or Allocated Hero totals.

---

## Phase 3 — Core Payday Workflows & Mobile Ergonomics

**Goal**: Transform logging a paycheque, acting on predicted paydays, executing bank transfers, and first-run mobile usage into an effortless loop (`refactor/01`, `refactor/02`, `refactor/03`, `refactor/07`).

### Step 3.1: Smart Two-Mode `PaychequeDialog` (`refactor/01`)
- Update `frontend/src/features/paycheques/components/paycheque-dialog.tsx`:
  - Add `Quick Net` vs. `Full Paystub` segmented mode selector.
  - In `Full Paystub` mode, order fields `Gross Pay` → `Income Tax` → `Deductions` → `Net Take-Home` with live auto-sync (`gross - tax - deductions`) and a manual-override reconciliation pill + 1-click `"Sync Net"` fix when out of balance.
  - Render live effective hourly rate (`$XX.XX/h net · $YY.YY/h gross`) whenever `hours > 0`.
  - Add `"Save & add another"` submit button when creating a new paycheque.
  - Handle 0-sources cold start gracefully inside the dialog without stacking modals awkwardly.

### Step 3.2: Interactive `PaydayChecklistDialog` (`refactor/02`)
- Update `frontend/src/components/ui/dialog-provider.tsx`:
  - Support generic toast actions (`action?: { label: string; onClick: () => void | Promise<void> }`) alongside `undo`.
  - Add `checklistRequest` state + `openChecklistDialog(paycheque)` context method.
- Create `frontend/src/features/paycheques/components/payday-checklist-dialog.tsx`:
  - Renders Gross → Withheld → Contractor Tax Reserve → True Spendable Net → Bucket Allocation list.
  - Provides checkable transfer items (persisted in `localStorage` by `paycheque.id`) and 1-click `"Copy"` buttons (`navigator.clipboard.writeText((cents / 100).toFixed(2))`).
- Wire `PaydayChecklistDialog` into `(dashboard)/layout.tsx`, the post-save toast/toggle in `PaychequeDialog`, and the `Split` buttons in `PaychequeLedger` and `SourcePaychequeLedger`.

### Step 3.3: Actionable `Next paydays` & Explicit Source Schedules (`refactor/03`)
- **Backend (`backend/src/sources/models.py`, `schemas.py`, `database.py`)**:
  - Add `pay_schedule` column (`'auto' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'irregular'`, default `'auto'`) with safe `ALTER TABLE` startup migration if missing.
- **Frontend (`types/payday.ts`, `source-schema.ts`, `source-dialog.tsx`, `lib/utils.ts`)**:
  - Add `Pay Schedule` selector in `SourceDialog`.
  - Update `computeUpcomingPaydays` in `frontend/src/lib/utils.ts` to compute exact next dates after ≥ 1 paycheque when `pay_schedule !== 'auto'`, omit `'irregular'`, and retain the 3-cheque median-gap fallback for `'auto'`.
- **Interactive Overview Card**:
  - Extract `frontend/src/features/overview/components/upcoming-paydays-list.tsx` with a `"Log deposit"` button that opens `PaychequeDialog` prefilled with `source_id`, predicted `amount`, and `paid_on`.

### Step 3.4: First-Run Onboarding & Responsive Mobile Navigation (`refactor/07`)
- **Onboarding (`overview-dashboard.tsx`)**:
  - When `paycheques.length === 0`, display a focused **Get Started in 3 Steps** checklist (1. Add income source → 2. Log first paycheque → 3. Set goal or allocation preset) instead of empty KPI boxes and blank Chart.js grids.
  - Gate `"Press N"` hints to `@media (pointer: fine)` devices.
- **Mobile Nav (`navbar.tsx`, `(dashboard)/layout.tsx`, `dialog-provider.tsx`)**:
  - Keep top `<header>` single-row on mobile (`Brand` + `Add paycheque`), and add a clean fixed bottom tab bar (`md:hidden`) with `env(safe-area-inset-bottom)` clearance, adjusting `<main>` bottom padding (`pb-24 md:pb-20`) and toast offset (`bottom-20 md:bottom-6`) on small screens.

---

## Phase 4 — Allocations Rebalancer, Goal Chart Overlays & CSV Import/Export

**Goal**: Deliver multi-bucket rebalancing with safety guards, goal pacing visuals on Overview charts, and full CSV import/filtered export (`refactor/06`, `features/feature_4`, `features/feature_5`).

### Step 4.1: Allocations Rebalancer, Preset Safety & Simulator Reserve (`refactor/06`)
- **Backend (`backend/src/allocations.py`)**:
  - Add `PUT /api/allocations/rebalance` accepting `{ updates: [{ id, weight_bps, active }] }`, validating total active `weight_bps <= 10000` atomically in a single transaction.
- **Frontend (`allocations-dashboard.tsx`, `actions.ts`, `schemas.ts`)**:
  - Remove duplicate `+ New Allocation Bucket` button from Hero.
  - Add confirmation `<dialog>` + 7-second snapshot Undo toast to `"Reset with Preset…"`.
  - Add inline **`Rebalance`** mode with synced sliders/inputs and a live `100%` allocation meter.
  - Add optional source/tax-reserve % selector to the Split Simulator.

### Step 4.2: Goal Target Pace Lines on Overview Charts (`features/feature_4`)
- Pass `goal` and `paceDeltaCents` from `getOverviewData` to `OverviewDashboard`, `MonthlyIncomeChart`, and `CumulativeIncomeChart`.
- Render dashed horizontal monthly target (`goal / 12`) in `MonthlyIncomeChart` and dashed cumulative annual trajectory in `CumulativeIncomeChart` when `!isAll && goal > 0`.
- Display an `▲ ahead of pace` / `▼ behind pace` badge in the Yearly Goal card.

### Step 4.3: Filtered CSV Export & Idempotent Bulk CSV Import UI (`features/feature_3`, `features/feature_5`)
- **Backend (`backend/src/paycheques/router.py`, `service.py`, `models.py`, `database.py`)**:
  - Add `year`, `source_id`, and `q` optional query params to `GET /api/export.csv` (`build_export_csv`).
  - Implement `import_hash` column + unique partial index and `POST /api/paycheques/import` per `features/feature_3_idempotent_bulk_csv_paystub_importer_spec.md`.
- **Frontend (`csv-import-dialog.tsx`, `paycheques-view.tsx`, `paycheque-ledger.tsx`)**:
  - Update `Export to CSV` in `PaychequesView` / `PaychequeLedger` to pass active `?year=&source_id=&q=` params.
  - Build `CsvImportDialog` (3-step drag-and-drop CSV parser, column mapper, source resolver, SHA-256 duplicate preview, and atomic import commit).

---

## Verification & Quality Gates

After completing each phase (and before final sign-off), execute the full validation suite and manual UX walkthrough:

### Automated Checks
```bash
# Frontend type-safety & production bundle build
cd frontend
npm run typecheck
npm run build

# Backend tests & linter
cd ../backend
pytest
ruff check .
```

### Interactive & Browser Verification Checklist
1. **Keyboard & Accessibility**:
   - Tab through `/` → `/paycheques` → `/taxes` → `/allocations` → `/sources`: verify skip link (`Enter` jumps to `#main`), `YearDropdown` (`ArrowDown` / `Escape`), `SourceCardShell` (`Cmd+Click` opens in new tab), and modal `Escape` focus return.
   - Verify all buttons and swatches meet `>= 40px` (`>= 44px` on mobile) and color contrast passes WCAG AA (`>= 4.5:1`).
2. **Core Workflows**:
   - **Cold Start**: Empty DB shows 3-step onboarding; adding a source + paycheque transitions smoothly to dashboard analytics.
   - **Full Paystub + Checklist**: Enter Gross, Tax, Deductions, and Hours in `PaychequeDialog` → confirm live net sync + hourly preview → save → open Payday Transfer Checklist → copy transfer amounts and check off items.
   - **Navigation & Filtering**: Select `2025` on `/` → switch to `/taxes`, `/allocations`, `/paycheques` → verify `?year=2025` persists → filter by source + search → click `Export filtered CSV` → verify exported CSV contains only matching rows.
   - **Allocations & Presets**: Shift percentages in `Rebalance` mode → verify preset reset asks for confirmation and Undo restores prior rules.
3. **Responsive & Motion**:
   - Test `375×812` mobile viewport (single-row top header + bottom navigation bar with zero horizontal overflow) and `1440×900` desktop viewport.
   - Enable `prefers-reduced-motion: reduce` in DevTools and verify hero counter, skeleton pulse, and Chart.js animations disable cleanly.
