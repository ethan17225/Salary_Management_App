# Graph Report - Salary_Management_App  (2026-11-19)

## Corpus Check
- 81 files · ~29,818 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 6, .css 1, .tsbuildinfo 1)

## Summary
- 721 nodes · 1315 edges · 51 communities (43 shown, 8 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ec63fbb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- export_paycheques_csv
- test_app.py
- allocations.py
- sources/service.py
- AllocationRulePayload
- (dashboard)/layout.tsx
- package.json
- Payday — Salary & Income Management App
- PaychequePayload
- paycheques/service.py
- Docker Compose backend Service
- compilerOptions
- SourcePayload
- allocation-engine.ts
- YearDropdown
- (dashboard)/page.tsx
- db.ts
- Detailed Problem
- _safe_csv_cell
- src/__init__.py
- next-env.d.ts
- navbar.tsx
- app/layout.tsx
- payday-backend
- Detailed Solutions
- Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards
- Detailed Problem
- Detailed Solutions
- Detailed Solutions
- Detailed Solutions
- dialog-provider.tsx
- UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards
- Navbar
- Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)
- Detailed Problem
- UI Audit 07 — Concentric Border Radii on Nested Surfaces
- add_no_store_header
- UI Audit 03 — `YearDropdown` Keyboard Navigation, Escape Handling & Focus Management
- 02 — Actionable Payday Transfer Checklist & Split Drawer
- 05 — Persistent `?year=` Across Navigation & URL-Synced Ledger Filters
- UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay
- 3. Comprehensive Feature Breakdown
- UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets
- master-ui-ux-improvement-plan.md
- [id]/page.tsx
- Detailed Solutions
- postcss.config.mjs
- zoneinfo

## God Nodes (most connected - your core abstractions)
1. `CustomModel` - 22 edges
2. `Source` - 18 edges
3. `PaychequePayload` - 16 edges
4. `YearDropdown()` - 16 edges
5. `compilerOptions` - 16 edges
6. `OkResponse` - 15 edges
7. `Paycheque` - 15 edges
8. `import_paycheques_batch()` - 15 edges
9. `Base` - 14 edges
10. `SourcePayload` - 14 edges

## Surprising Connections (you probably didn't know these)
- `1. Destructive One-Click Preset Overwrite With No Confirmation or Undo` --references--> `apply_preset()`  [INFERRED]
  refactor/06-interactive-allocation-rebalancing-and-safety.md → backend/src/allocations.py
- `Solution 1: Preserve `?year=` in `Navbar`` --references--> `Navbar()`  [INFERRED]
  refactor/05-persistent-year-and-url-filter-state.md → frontend/src/components/layout/navbar.tsx
- `1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`)` --references--> `YearDropdown()`  [INFERRED]
  improvement-plan/master-ui-ux-improvement-plan.md → frontend/src/components/ui/year-dropdown.tsx
- `Cut / Deferred (YAGNI & Native Replacements)` --references--> `YearDropdown()`  [INFERRED]
  improvement-plan/master-ui-ux-improvement-plan.md → frontend/src/components/ui/year-dropdown.tsx
- `Verification Gate` --references--> `YearDropdown()`  [INFERRED]
  improvement-plan/master-ui-ux-improvement-plan.md → frontend/src/components/ui/year-dropdown.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (51 total, 8 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.17
Nodes (17): addDays(), addMonthsClamped(), buildTimelineMonths(), CAD, computeUpcomingPaydays(), dateLabel(), diffDays(), KIND_LABELS (+9 more)

### Community 1 - "export_paycheques_csv"
Cohesion: 0.14
Nodes (16): create_paycheque(), delete_paycheque(), export_paycheques_csv(), list_paycheques(), DBDep, delete, ge, get (+8 more)

### Community 2 - "test_app.py"
Cohesion: 0.08
Nodes (39): AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, get_db(), AsyncSession, seed_database() (+31 more)

### Community 3 - "allocations.py"
Cohesion: 0.06
Nodes (71): AsyncEngine, AllocationPresetPayload, AllocationRule, AllocationRuleResponse, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation() (+63 more)

### Community 4 - "sources/service.py"
Cohesion: 0.11
Nodes (28): DBDep, description, ge, Path, valid_source_id(), Source, create_source(), delete_source() (+20 more)

### Community 5 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 6 - "(dashboard)/layout.tsx"
Cohesion: 0.18
Nodes (9): dynamic, PageProps, DialogProvider(), frontend_src_features_paycheques_index, frontend_src_features_paycheques_index_getpaychequesdata, frontend_src_features_paycheques_index_paychequedialog, frontend_src_features_paycheques_index_paychequesview, frontend_src_features_sources_index_sourcedialog (+1 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (31): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+23 more)

### Community 8 - "Payday — Salary & Income Management App"
Cohesion: 0.12
Nodes (16): 1. Start the Backend, 2. Start the Frontend, API Overview, Backend, Backend (`backend/src/config.py`), Environment Variables, Frontend, Frontend (`frontend/src/lib/env.ts`) (+8 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.07
Nodes (30): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 3. Project map, 4. Invariants (do not break), 5. Project skills (load when relevant), 6. Verify before you say "done", AGENTS.md — Payday (Salary & Income Management App), ensure_schema_migrations() (+22 more)

### Community 10 - "paycheques/service.py"
Cohesion: 0.07
Nodes (45): AppError, BadRequestError, ConflictError, NotFoundError, FastAPI, register_exception_handlers(), ErrorCode, StrEnum (+37 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "SourcePayload"
Cohesion: 0.13
Nodes (16): PaySchedule, StrEnum, SourceKind, Any, field_validator, model_validator, SourcePayload, 03 — Actionable "Next Paydays" & Explicit Source Pay Schedules (+8 more)

### Community 14 - "allocation-engine.ts"
Cohesion: 0.15
Nodes (15): AggregateAllocationReport, AggregateBucketSummary, allocateCentsLargestRemainder(), AllocatedBucket, AllocationCategory, computeAggregateAllocations(), PaychequeAllocationResult, AggregateTaxSummary (+7 more)

### Community 15 - "YearDropdown"
Cohesion: 0.24
Nodes (10): YearDropdown(), 04 — Hero Number Consistency, Tax Retention Math Alignment & Plain-English Copy, 2. Mismatched `YearDropdown` Totals vs. Hero Totals, 3. Confusing Engineering Jargon in User-Facing Copy, Description, Detailed Problem, Detailed Solutions, Solution 2: Contextual Hero Subtitles & Explicit `YearDropdown` Labels (+2 more)

### Community 16 - "(dashboard)/page.tsx"
Cohesion: 0.33
Nodes (4): PageProps, frontend_src_features_overview_index, frontend_src_features_overview_index_getoverviewdata, frontend_src_features_overview_index_overviewdashboard

### Community 17 - "db.ts"
Cohesion: 0.11
Nodes (18): dynamic, proxy(), RouteContext, AllocationsPage(), PageProps, PageProps, TaxesPage(), frontend_src_features_allocations_index (+10 more)

### Community 18 - "Detailed Problem"
Cohesion: 0.15
Nodes (12): 06 — Interactive Allocation Rebalancer, Preset Safety & Simulator Tax Awareness, 1. Destructive One-Click Preset Overwrite With No Confirmation or Undo, 2. Duplicate Primary Actions Stacked Vertically, 3. Painful Sequential Modal Editing to Rebalance 100%, 4. Split Simulator Ignores Untaxed Contractor Reserve Sources, Description, Detailed Problem, Detailed Solutions (+4 more)

### Community 19 - "_safe_csv_cell"
Cohesion: 0.25
Nodes (8): _safe_csv_cell(), Guardrails, 3.2. Paycheques Ledger (`/paycheques`), Detailed Solutions, Solution 1: Preserve `?year=` in `Navbar`, Solution 2: Sync `PaychequeLedger` & `SourcePaychequeLedger` Filters to URL Query Params, Solution 3: Filtered CSV Export Support, Verification Criteria

### Community 23 - "navbar.tsx"
Cohesion: 0.22
Nodes (8): HASH_ROUTES, NAV_ITEMS, NavbarSearchParamsSync(), NavLinks(), withYearParam(), useDialogs(), Skeleton(), cn()

### Community 24 - "app/layout.tsx"
Cohesion: 0.14
Nodes (10): dmMono, metadata, outfit, viewport, YearDropdownProps, YearOption, fmt(), frontend_src_styles_globals (+2 more)

### Community 27 - "Detailed Solutions"
Cohesion: 0.18
Nodes (10): 07 — Guided First-Run Onboarding & Mobile Navigation Ergonomics, 1. Cold & Disconnected First-Run Empty State, 2. Cramped Mobile Sticky Header & Nav Pill Squeezing, Description, Detailed Problem, Detailed Solutions, Solution 1: Guided 3-Step First-Run Onboarding Card on Overview, Solution 2: Seamless Zero-Source Guard in `PaychequeDialog` (+2 more)

### Community 28 - "Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards"
Cohesion: 0.29
Nodes (7): 1.1 Global Tokens & Base CSS (`frontend/src/styles/globals.css`), 1.2 Structural Loading Skeletons (`ui-audit/09`), 1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`), 1.4 Semantic Card Link, Contrast & Table Touch Targets, 1.5 Form Pending States, Safeguards & Native Color Input, 1.7 Remaining 1-Line Polish (`dialog-provider.tsx`, `navbar.tsx`, `global-error.tsx`, `not-found.tsx`), Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards

### Community 29 - "Detailed Problem"
Cohesion: 0.20
Nodes (9): shortCurrency(), 1. Missing `name`, `autoComplete="off"`, and Trailing Ellipsis `…` on Inputs, 2. Typography Wrapping (`text-balance` & `text-pretty`) & Heading Hierarchy, 3. Currency/Number Formatting Hardcoding Check, Description, Detailed Problem, Detailed Solutions, UI Audit 10 — Form Attributes, Typography Details & Placeholder Standards (+1 more)

### Community 30 - "Detailed Solutions"
Cohesion: 0.20
Nodes (9): 1. Non-Semantic `<tr onClick>` With Nested Interactive Controls, 2. Tiny `24px` `Split` Pill Inside Clickable Row, Description, Detailed Problem, Detailed Solutions, Solution 1: Replace Row-Wide `<tr onClick>` With Explicit Action Controls or Stretched Trigger Pattern, Solution 2: Increase Hit Areas to ≥ 40×40px / 44×44px, UI Audit 02 — Table Row Interactions, Nested Controls & Minimum Touch Targets (+1 more)

### Community 31 - "Detailed Solutions"
Cohesion: 0.20
Nodes (9): 1. Bar Segment vs. Legend Dot Color Mismatch, 2. Unchecked Dynamic Text Color on Source Card Links, Description, Detailed Problem, Detailed Solutions, Solution 1: Bind Both Retention Bar and Legend Dots to Identical Semantic Tokens, Solution 2: Use `text-ink` or `text-accent-2` for `"View details"` and Use `--c` as a Pure Color Swatch, UI Audit 05 — Taxes Retention Bar & Legend Color Mismatch + Dynamic Contrast Guard (+1 more)

### Community 32 - "Detailed Solutions"
Cohesion: 0.22
Nodes (8): DashboardLayout(), Description, Detailed Problem, Detailed Solutions, `frontend/src/app/(dashboard)/loading.tsx:1-8`, `frontend/src/app/(dashboard)/sources/[id]/loading.tsx:1-8`, UI Audit 09 — Structural Loading Skeletons & CLS Prevention, Verification Criteria

### Community 33 - "dialog-provider.tsx"
Cohesion: 0.17
Nodes (15): DialogContext, DialogContextValue, PaychequeDialogRequest, PaychequePrefill, SourceDialogRequest, ToastState, AllocationRule, ActionState (+7 more)

### Community 34 - "UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards"
Cohesion: 0.22
Nodes (8): 1. Missing Pending State Across All 4 Dialogs & Card Actions, 2. Web Interface Guidelines Compliance, Description, Detailed Problem, Detailed Solutions, Target Snippet (`paycheque-dialog.tsx`), UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards, Verification Criteria

### Community 35 - "Navbar"
Cohesion: 0.18
Nodes (11): Navbar(), 2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import, 3.6. Interactive Dialogs & Accessibility, 1. Prohibited `transition-all` Usages, 2. Layout-Triggering Property Transitions, 3. Press Scale Consistency, Description, Detailed Problem (+3 more)

### Community 36 - "Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)"
Cohesion: 0.29
Nodes (7): 2.1 Persistent `?year=` & Responsive Mobile Nav (`navbar.tsx`, `(dashboard)/layout.tsx`), 2.3 Streamlined `PaychequeDialog` (`paycheque-dialog.tsx`), 2.4 Explicit `pay_schedule`, Clickable `Next paydays`, 3-Step Onboarding & Goal Pace Lines, Cut / Deferred (YAGNI & Native Replacements), Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition), Phase 2 — Multi-User Workflows, Navigation Persistence, Schedules & CSV Import/Export, Verification Gate

### Community 37 - "Detailed Problem"
Cohesion: 0.40
Nodes (5): 1. Backwards Paystub Entry Flow, 2. Non-Automatic Sync & Silent Math Mismatches, 3. Missing Live Hourly Rate Feedback, 4. Friction During Historical Batch Entry, Detailed Problem

### Community 38 - "UI Audit 07 — Concentric Border Radii on Nested Surfaces"
Cohesion: 0.25
Nodes (7): 1. Inverted Radii in Modal Drawers (`4px` Outer vs. `10px` Inner), 2. Concentric Radii on Dialogs, Cards & Nested Bucket Cards, Description, Detailed Problem, Detailed Solutions, UI Audit 07 — Concentric Border Radii on Nested Surfaces, Verification Criteria

### Community 39 - "add_no_store_header"
Cohesion: 0.50
Nodes (4): add_no_store_header(), Response, middleware, Request

### Community 40 - "UI Audit 03 — `YearDropdown` Keyboard Navigation, Escape Handling & Focus Management"
Cohesion: 0.29
Nodes (6): Description, Detailed Problem, Detailed Solutions, Target Snippet (`year-dropdown.tsx`), UI Audit 03 — `YearDropdown` Keyboard Navigation, Escape Handling & Focus Management, Verification Criteria

### Community 41 - "02 — Actionable Payday Transfer Checklist & Split Drawer"
Cohesion: 0.22
Nodes (8): 02 — Actionable Payday Transfer Checklist & Split Drawer, 1. Dead-End Feedback When Logging a Paycheque, 2. Cramped & Hidden Split UI in `/paycheques`, Description, Detailed Problem, Detailed Solutions, Solution 2: Seamless Triggers in Save Flow & Ledgers, Verification Criteria

### Community 42 - "05 — Persistent `?year=` Across Navigation & URL-Synced Ledger Filters"
Cohesion: 0.33
Nodes (5): 05 — Persistent `?year=` Across Navigation & URL-Synced Ledger Filters, 1. Year Context Lost on Tab Switches, 2. Local-Only Ledger Filters & Unfiltered CSV Export, Description, Detailed Problem

### Community 43 - "UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay"
Cohesion: 0.29
Nodes (6): Description, Detailed Problem, Detailed Solutions, Target Implementation (`source-card.tsx`), UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay, Verification Criteria

### Community 44 - "3. Comprehensive Feature Breakdown"
Cohesion: 0.40
Nodes (5): 3.1. Overview Dashboard (`/`), 3.3. Gross-to-Net & Tax Intelligence (`/taxes`), 3.4. Pay-Yourself-First Allocations (`/allocations`), 3.5. Income Sources (`/sources` & `/sources/[id]`), 3. Comprehensive Feature Breakdown

### Community 45 - "UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets"
Cohesion: 0.29
Nodes (6): 1. Inconsistent Color Picker UX Between Dialogs, Description, Detailed Problem, Detailed Solutions, UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets, Verification Criteria

### Community 47 - "[id]/page.tsx"
Cohesion: 0.20
Nodes (6): PageProps, frontend_src_features_sources_index, frontend_src_features_sources_index_getsourcebyid, frontend_src_features_sources_index_getsourcesdata, frontend_src_features_sources_index_sourcedetailview, frontend_src_features_sources_index_sourcegrid

### Community 50 - "Detailed Solutions"
Cohesion: 0.40
Nodes (5): Detailed Solutions, Solution 1: Two-Mode Entry Segmented Toggle (`Quick Net` vs. `Full Paystub`), Solution 2: Live Hourly Rate Preview Pill, Solution 3: `"Save & add another"` Batch Workflow, Verification Criteria

## Knowledge Gaps
- **192 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 320 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import` connect `Navbar` to `PaychequePayload`, `paycheques/service.py`, `_safe_csv_cell`, `Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Why does `Navbar()` connect `Navbar` to `_safe_csv_cell`, `(dashboard)/layout.tsx`, `navbar.tsx`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Why does `Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)` connect `Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)` to `_safe_csv_cell`, `Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards`, `master-ui-ux-improvement-plan.md`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `Source` (e.g. with `build_export_csv()` and `valid_source_id()`) actually correct?**
  _`Source` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `YearDropdown()` (e.g. with `1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`)` and `Cut / Deferred (YAGNI & Native Replacements)`) actually correct?**
  _`YearDropdown()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `export_paycheques_csv` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._