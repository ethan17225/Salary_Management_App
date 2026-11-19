# Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)

- **Date**: 2026-11-19
- **Scope**: Minimal, native-first, scale-ready blueprint distilled from `ui-audit/`, `refactor/`, and `features/` under Ponytail (`full`) rules — preserving multi-user onboarding, network-latency skeletons, explicit pay schedules, and bulk CSV import.
- **Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Chart.js 4, Zod, FastAPI + SQLAlchemy 2.0 Async + SQLite.
- **Footprint**: 2 phases · 3 small new components (`skeleton.tsx`, `upcoming-paydays-list.tsx`, `csv-import-dialog.tsx`) · 1 deleted hook (`use-outside-click.ts`) · 2 idempotent SQLite migrations (`sources.pay_schedule`, `paycheques.import_hash`) · 1 new backend endpoint (`POST /api/paycheques/import`) + 3 query params on `GET /api/export.csv`.

---

## Guardrails

1. **Integer-Cents Invariant**: All money/rate math stays exact integer cents and basis points.
2. **Never Simplify Away**: Input validation at trust boundaries, double-submit/data-loss guards, CSV formula-injection escaping (`_safe_csv_cell`), idempotent deduplication, and WCAG keyboard/contrast/touch-target basics.
3. **Native Platform First**: Native `<select>`, `<input type="color">`, `<input type="file">`, `window.confirm()`, `window.history.replaceState()`, `navigator.clipboard`, Python stdlib `csv.DictReader` + `hashlib.sha256`, and CSS over custom JS widgets.
4. **Multi-User Scale Readiness**: Keep CLS-preventing loading skeletons, zero-data onboarding, per-source pay schedules, and bulk CSV import; avoid browser-only `localStorage` persistence for domain state (`ponytail:` auth/`user_id` tenant scoping stays a separate backend milestone per `backend/src/main.py:35`).

---

## Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards

**Goal**: Fix every WCAG/contrast/math/double-submit/data-loss bug and add structural skeletons for future network/DB latency using the shortest diff.

### 1.1 Global Tokens & Base CSS (`frontend/src/styles/globals.css`)
- Add `--warn: #d97706;` in `:root` and `--color-warn: var(--warn);` in `@theme inline`.
- Add `h1, h2, h3 { text-wrap: balance; }` and `p { text-wrap: pretty; }` in `@layer base`.
- Add `.btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }`.
- *(Note: `@media (prefers-reduced-motion: reduce)` already disables all transitions/animations globally at line 212.)*

### 1.2 Structural Loading Skeletons (`ui-audit/09`)
- Create `frontend/src/components/ui/skeleton.tsx` (~10 lines: `<Skeleton className="..." />` with `rounded bg-surface motion-safe:animate-pulse`).
- Update `frontend/src/app/(dashboard)/loading.tsx` and `frontend/src/app/(dashboard)/sources/[id]/loading.tsx` to render structural Hero + 4-KPI + chart/table skeletons matching real route heights (`role="status"`, `aria-busy="true"`, `<span className="sr-only">Loading…</span>`).

### 1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`)
- Replace the 136-line custom ARIA listbox + outside-click logic with a styled native `<select>` inside the dark Hero pill (`<option value={val}>{label} · Net {fmt(tot)}</option>`).
  - Solves keyboard navigation, `Escape`, focus management, ARIA roles (`ui-audit/03`), `transition-all` removal (`ui-audit/08`), and explicit `Net` labeling (`refactor/04`) in ~35 lines.
- **Delete** `frontend/src/hooks/use-outside-click.ts` (`YearDropdown` is its only caller).

### 1.4 Semantic Card Link, Contrast & Table Touch Targets
- **`frontend/src/features/sources/components/source-card.tsx`**:
  - Remove `useRouter`, `<article onClick>`, and `e.stopPropagation()`.
  - Add `relative` to `<article>`; stretch `<Link href={href}>` with `after:absolute after:inset-0 after:rounded-[inherit] text-ink` + `size-2 rounded-full bg-(--c)` dot (WCAG AA contrast for any custom color).
  - Keep `Edit` at `relative z-10` with `aria-label={`Edit ${source.name}`}` and explicit `transition-[border-color,box-shadow,transform] duration-150`.
- **`paycheque-ledger.tsx`, `source-paycheque-ledger.tsx`, `taxes-dashboard.tsx`**:
  - Remove `<tr onClick>` and `e.stopPropagation()` to eliminate nested interactive conflicts; update `"click any row"` helper text to `"click any date"` / `"click any source"`.
  - Add descriptive `aria-label` to every row edit `<button className="link">`.
  - Bump `Split` (`paycheque-ledger.tsx`) and bucket card buttons (`allocations-dashboard.tsx`) to `min-h-[40px]`.

### 1.5 Form Pending States, Safeguards & Native Color Input
- **`paycheque-dialog.tsx`, `source-dialog.tsx`, `goal-dialog.tsx`, `allocations-dashboard.tsx`**:
  - Track `pending` (`'save' | 'delete' | null`), set explicit `type="submit"`, `disabled={pending !== null}`, and `'Saving…'` / `'Deleting…'` labels.
  - Add `name` and `autoComplete="off"` on inputs in these forms while editing them.
- **`source-dialog.tsx`**:
  - Add a 2-step inline `confirmDelete` toggle (`Delete source` → `Confirm delete?`, reset on open/close).
  - Change nested reserve drawer `rounded` → `rounded-2xl`.
- **`allocations-dashboard.tsx`**:
  - Delete the duplicate `+ New Allocation Bucket` primary button in the Hero.
  - Guard `"Reset with Preset…"` with 1-line native `if (rules.length > 0 && !window.confirm(...)) return;` (reset `<select>` value cleanly; mark `ponytail:` for custom preview/undo if needed).
  - Delete the custom 25-line `size-8` color-swatch button grid and use native `<input type="color" className="p-1 cursor-pointer">` matching `source-dialog.tsx` (already `min-h-[44px]`).
  - Replace engineering jargon (`Largest Remainder conservation`, `zero-drift cent conservation`) with plain English.

### 1.6 Taxes Retention Math & Color Alignment
- **`frontend/src/lib/tax-intelligence.ts` & `frontend/src/features/taxes/components/taxes-dashboard.tsx`**:
  - Align Retention Bar segments and legend dots to the same tokens (`bg-up`, `bg-warn`, `bg-down`).
  - Fix the partial-coverage contradiction: expose `trackedGrossCents`, `trackedNetCents`, and `trackedWithheldCents` on `AggregateTaxSummary`; when `breakdownCoverageCount > 0`, compute the Retention Bar percentages over tracked stubs so Hero, KPI, and Bar agree 1:1 (with a 1-line subtitle note `"Based on X of Y paycheques with gross pay logged"` when coverage < 100%, zero extra toggles).
  - Plain-English copy: `"Effective Gross Income"` → `"Total Gross Income"`, `"Untaxed Reserve Required"` → `"Tax Set-Aside Needed"`.

### 1.7 Remaining 1-Line Polish (`dialog-provider.tsx`, `navbar.tsx`, `global-error.tsx`, `not-found.tsx`)
- Replace remaining `transition-all` in `dialog-provider.tsx` (`transition-[opacity,transform]`) and `paycheque-dialog.tsx` (`transition-[border-color,background-color,transform]`).
- Convert `navbar.tsx` skip link from `-top-20 focus:top-3 transition-[top]` to `top-3 -translate-y-24 focus:translate-y-0 transition-transform duration-150 rounded-lg`.
- Fix heading levels: `<h2>` → `<h1>` in `frontend/src/app/global-error.tsx`, `<p>` → `<h1>` in `frontend/src/app/not-found.tsx`.

---

## Phase 2 — Multi-User Workflows, Navigation Persistence, Schedules & CSV Import/Export

**Goal**: Deliver daily workflows and multi-user onboarding essentials (persistent year/filters, filtered export, idempotent CSV import, explicit pay schedules, 3-step zero-data onboarding, faster paystub logging, copyable splits, goal pace lines) without over-engineered custom parsers or duplicate nav chrome.

### 2.1 Persistent `?year=` & Responsive Mobile Nav (`navbar.tsx`, `(dashboard)/layout.tsx`)
- Read `useSearchParams()` inside a `<Suspense>`-safe child in `navbar.tsx` and forward `?year=` on `/`, `/paycheques`, `/taxes`, `/allocations` links (and hash redirects).
- Fix mobile `<nav>` overflow in 3 lines of CSS: `overflow-x-auto whitespace-nowrap -mx-4 px-4` with `shrink-0 px-3.5` on links (`ponytail:` note: switch to fixed bottom tab bar if mobile usage dominates).

### 2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import
- **`frontend/src/features/paycheques/components/paycheque-ledger.tsx` & `paycheques-view.tsx`**:
  - Sync `year`, `source`, and `q` to the URL with native `window.history.replaceState` (instant client filtering, zero redundant server round-trips under load, survives refresh, keeps `Navbar` `useSearchParams()` in sync).
  - Add `"Clear filters"` button when any filter is active (and in empty table state).
  - Bind the `Export to CSV` link to active filters (`/api/export.csv?year=&source_id=&q=`, labeled `Export filtered CSV (N)` when filtered).
  - Inside the existing inline `Split` expansion, add a 1-click `"Copy"` button (`navigator.clipboard.writeText((cents / 100).toFixed(2))`) per bucket + contractor tax reserve.
- **Filtered CSV Export (`backend/src/paycheques/router.py`, `service.py`)**:
  - Add optional `year: str | None = None`, `source_id: int | None = None`, `q: str | None = None` to `GET /api/export.csv` (`build_export_csv`), preserving `_safe_csv_cell` formula escaping and reflecting `year` in the filename.
- **Idempotent Bulk CSV Import (`backend/src/paycheques/models.py`, `router.py`, `service.py`, `database.py` + `frontend/src/features/paycheques/components/csv-import-dialog.tsx` [new])**:
  - Add `import_hash` column + unique partial index `idx_paycheques_import_hash ON paycheques(import_hash) WHERE import_hash IS NOT NULL` in `models.py` and `ensure_schema_migrations`.
  - Add `POST /api/paycheques/import` accepting a `.csv` upload (or JSON rows) parsed server-side with Python stdlib `csv.DictReader` + `hashlib.sha256(f"{source_id}:{paid_on}:{amount_cents}")` in one atomic async SQLAlchemy transaction; auto-creates missing sources when flagged, skips duplicate hashes idempotently, and returns `{ imported_count, skipped_duplicates, errors }`.
  - Add a compact `Import CSV` `<dialog>` on `/paycheques` with native `<input type="file" accept=".csv">`, `"Auto-create missing sources"` checkbox, sample CSV template download matching `/api/export.csv` headers, and row-error / summary feedback (`ponytail:` add interactive client-side column remapping only when arbitrary bank CSV formats need it).
- **Backend Tests (`backend/test_app.py`)**:
  - Add `pytest` checks for filtered `GET /api/export.csv` (including `_safe_csv_cell`) and idempotent `POST /api/paycheques/import` deduplication.

### 2.3 Streamlined `PaychequeDialog` (`paycheque-dialog.tsx`)
- Change nested paystub drawer `rounded` → `rounded-2xl`.
- When Gross, Tax, or Deductions change and Net hasn't been manually diverged, auto-update `amount` (`gross - tax - deductions`); if diverged, show a 1-line discrepancy note with the existing auto-fill button.
- Show live hourly rate (`$XX.XX/h net · $YY.YY/h gross`) beneath Hours when `hours > 0`.
- Add `"Save & add another"` button when creating (`!payForm.id`) that saves, toasts, clears money/hours/note, keeps `source_id`, and refocuses amount.
- When `chipSources.length === 0`, show `"Add an income source first."` and disable Save (existing `+ New source` button with `onCreated` handles creation).
- Include top-line split/reserve summary in the post-save toast when active rules or contractor tax reserve apply.

### 2.4 Explicit `pay_schedule`, Clickable `Next paydays`, 3-Step Onboarding & Goal Pace Lines
- **Explicit Source Schedules (`backend/src/sources/models.py`, `schemas.py`, `database.py`, `frontend/src/types/payday.ts`, `source-schema.ts`, `source-dialog.tsx`, `lib/utils.ts`)**:
  - Add `pay_schedule` (`'auto' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'irregular'`, default `'auto'`) with idempotent `ALTER TABLE` migration + `CheckConstraint` + `Pay Schedule` `<select>` in `SourceDialog`.
  - Update `computeUpcomingPaydays` in `frontend/src/lib/utils.ts` to predict next paydays after ≥ 1 paycheque for explicit schedules, omit `'irregular'`, and retain the 3-cheque median-gap fallback for `'auto'`.
  - Add 1 `pytest` check in `backend/test_app.py` for `pay_schedule` persistence and validation.
- **Clickable `Next paydays` (`frontend/src/features/overview/components/upcoming-paydays-list.tsx` [new, ~35 LOC], `dialog-provider.tsx`, `paycheque-dialog.tsx`)**:
  - Extract the `Next paydays` list into a tiny Client Component with a `"Log"` button opening `PaychequeDialog` prefilled with `{ source_id, amount_cents, paid_on }`.
- **3-Step First-Run Onboarding (`overview-dashboard.tsx`, `latest-paycheques-list.tsx`)**:
  - When `paycheques.length === 0` (every new user in a multi-user deployment), replace blank KPI boxes and 3 empty charts with a focused **Get Started in 3 Steps** `.card`: (1) Add an income source (checked once `sources.length > 0`) → (2) Log first paycheque or Import CSV (`/paycheques`) → (3) Set a yearly goal or allocation preset (`/allocations`).
  - Hide `"Press N"` on touch devices via `hidden [@media(pointer:fine)]:inline`.
- **Goal Pace Lines (`overview-charts.tsx`, `overview-dashboard.tsx`, `features/feature_4`)**:
  - When `!isAll && goal > 0`, add 1 dashed line dataset (`goal / 1200`) to `MonthlyIncomeChart` (excluded from stacked bar tooltip footer) and 1 dashed pace line (`goal * (m + 1) / 1200`) to `CumulativeIncomeChart`.
  - Add 1 inline `▲ ahead / ▼ behind pace` line in the Yearly Goal card (`goalSum - Math.round((goal * daysDone) / daysInYr)`).

---

## Cut / Deferred (YAGNI & Native Replacements)

| Original Spec Item | Disposition | Replaced By / Add When |
| :--- | :--- | :--- |
| `color-swatch-picker.tsx` ([ui-audit/06](../ui-audit/06-unified-color-swatch-picker-and-touch-sizing.md)) | **Cut** | Native `<input type="color">` in both dialogs; add `<datalist>` or custom picker if curated preset clicks are requested. |
| Custom `YearDropdown` ARIA keyboard logic ([ui-audit/03](../ui-audit/03-year-dropdown-keyboard-navigation-and-focus.md)) | **Replaced** | Native `<select>` + deleted `use-outside-click.ts`; restore custom popover only if rich multi-column rows are required. |
| `PaydayChecklistDialog` + `localStorage` checkboxes ([refactor/02](../refactor/02-actionable-payday-transfer-checklist.md)) | **Cut** | 1-click `Copy` buttons in `PaychequeLedger` split + post-save toast summary (browser-only `localStorage` also does not sync across multi-user devices); add DB-backed transfer tracking only if needed. |
| 2-mode `PaychequeDialog` field reorder & inline 0-source subform ([refactor/01](../refactor/01-paystub-entry-and-smart-dialog.md), [refactor/07](../refactor/07-first-run-onboarding-and-mobile-navigation.md)) | **Simplified** | Existing collapsible drawer with auto-net sync + existing `+ New source` callback. |
| Fixed mobile bottom tab bar + custom icons ([refactor/07](../refactor/07-first-run-onboarding-and-mobile-navigation.md)) | **Replaced** | 3-line CSS horizontal-scroll nav pills on `< md`; add bottom bar if mobile usage dominates. |
| `Allocations` inline `Rebalance` mode, `PUT /api/allocations/rebalance`, preset `<dialog>` + snapshot Undo, simulator reserve selector ([refactor/06](../refactor/06-interactive-allocation-rebalancing-and-safety.md)) | **Cut** | 1-line `window.confirm()` guards preset overwrite; add atomic batch rebalance endpoint if juggling 5+ buckets at 100% becomes routine. |
| 3-step client-side CSV parser & column-mapping wizard ([feature_5](../features/feature_5_filtered_csv_export_and_import_ui_wizard.md)) | **Simplified** | Compact `<dialog>` file upload straight to Python stdlib `csv.DictReader` + `hashlib.sha256` (`POST /api/paycheques/import`); add column mapper UI when arbitrary third-party bank CSV schemas are needed. |
| Untouched-file cosmetic sweeps (`rounded` on untouched cards, placeholder `…`, `~` vs `≈`) ([ui-audit/07](../ui-audit/07-concentric-border-radii-on-nested-surfaces.md), [ui-audit/10](../ui-audit/10-form-attributes-typography-and-placeholder-standards.md)) | **Cut** | Fix radii/attributes only in files already edited. |

---

## Verification Gate

Run after each phase:
```bash
cd frontend && npm run typecheck && npm run build
cd ../backend && pytest && ruff check .
```

Manual spot-checks:
1. **Keyboard, Skeletons & A11y**: Tab through `/` → `/paycheques` → `/taxes` → `/allocations` → `/sources`; test skip link, native `YearDropdown`, `Cmd+Click` on source cards, `>= 40px` `Split` / card buttons, loading skeletons under throttled network, and `Save` double-click prevention.
2. **Multi-User & Core Loop**: Empty DB shows 3-step onboarding → add source with `Bi-weekly` schedule + 1 paycheque → verify `Next paydays` predicts `+14d` and `Log` prefills dialog → filter `/paycheques` (`?year=2025`), click `Export filtered CSV`, re-upload via `Import CSV` and confirm 0 duplicates inserted → copy a split amount → check Goal pace lines on Overview.
3. **Mobile & Reduced Motion**: Check `375×812` nav scroll (zero page overflow) and `prefers-reduced-motion: reduce`.
