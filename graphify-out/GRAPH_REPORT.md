# Graph Report - Salary_Management_App  (2026-11-20)

## Corpus Check
- 83 files · ~35,529 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 808 nodes · 1554 edges · 51 communities (44 shown, 7 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `29f356ce`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- utils.ts
- test_app.py
- allocations.py
- paycheques/service.py
- AllocationRulePayload
- DialogProvider
- package.json
- YearDropdown
- PaychequePayload
- sources/service.py
- Docker Compose backend Service
- compilerOptions
- dialog-provider.tsx
- allocation-engine.ts
- parsers.py
- (dashboard)/page.tsx
- cn
- Detailed Problem
- Payday — Salary & Income Management App
- src/__init__.py
- next-env.d.ts
- build_export_csv
- Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards
- payday-backend
- Detailed Solutions
- extractors.py
- Detailed Problem
- Detailed Solutions
- Detailed Solutions
- iso
- (dashboard)/layout.tsx
- UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards
- Detailed Problem
- Detailed Solutions
- Detailed Problem
- UI Audit 07 — Concentric Border Radii on Nested Surfaces
- SourcePayload
- [id]/page.tsx
- payday.ts
- UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay
- master-ui-ux-improvement-plan.md
- navbar.tsx
- UI Audit 03 — `YearDropdown` Keyboard Navigation, Escape Handling & Focus Management
- app/layout.tsx
- Detailed Solutions
- postcss.config.mjs
- zoneinfo
- add_no_store_header

## God Nodes (most connected - your core abstractions)
1. `CustomModel` - 24 edges
2. `Source` - 20 edges
3. `parse_cents()` - 18 edges
4. `BadRequestError` - 16 edges
5. `PaychequePayload` - 16 edges
6. `YearDropdown()` - 16 edges
7. `compilerOptions` - 16 edges
8. `OkResponse` - 15 edges
9. `Paycheque` - 15 edges
10. `import_paycheques_batch()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `1. Destructive One-Click Preset Overwrite With No Confirmation or Undo` --references--> `apply_preset()`  [INFERRED]
  refactor/06-interactive-allocation-rebalancing-and-safety.md → backend/src/allocations.py
- `3.6. Interactive Dialogs & Accessibility` --references--> `Navbar()`  [INFERRED]
  PROJECT_OVERVIEW.md → frontend/src/components/layout/navbar.tsx
- `Solution 1: Preserve `?year=` in `Navbar`` --references--> `Navbar()`  [INFERRED]
  refactor/05-persistent-year-and-url-filter-state.md → frontend/src/components/layout/navbar.tsx
- `Description` --references--> `Navbar()`  [INFERRED]
  ui-audit/08-compositor-safe-transitions-and-motion-restraint.md → frontend/src/components/layout/navbar.tsx
- `1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`)` --references--> `YearDropdown()`  [INFERRED]
  improvement-plan/master-ui-ux-improvement-plan.md → frontend/src/components/ui/year-dropdown.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (51 total, 7 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.18
Nodes (9): dynamic, proxy(), RouteContext, db, FALLBACK_URLS, env, envSchema, server-only (+1 more)

### Community 1 - "utils.ts"
Cohesion: 0.17
Nodes (17): addDays(), addMonthsClamped(), buildTimelineMonths(), CAD, computeUpcomingPaydays(), dateLabel(), diffDays(), KIND_LABELS (+9 more)

### Community 2 - "test_app.py"
Cohesion: 0.08
Nodes (38): AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, field_validator, client(), db_session_factory() (+30 more)

### Community 3 - "allocations.py"
Cohesion: 0.06
Nodes (75): AsyncEngine, AllocationPresetPayload, AllocationRule, AllocationRuleResponse, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation() (+67 more)

### Community 4 - "paycheques/service.py"
Cohesion: 0.06
Nodes (53): NotFoundError, ErrorCode, StrEnum, DBDep, description, ge, Path, valid_paycheque_id() (+45 more)

### Community 5 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 6 - "DialogProvider"
Cohesion: 0.18
Nodes (10): DialogProvider(), 02 — Actionable Payday Transfer Checklist & Split Drawer, 1. Dead-End Feedback When Logging a Paycheque, 2. Cramped & Hidden Split UI in `/paycheques`, Description, Detailed Problem, Detailed Solutions, Solution 1: Build `PaydayChecklistDialog` Component (+2 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (31): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+23 more)

### Community 8 - "YearDropdown"
Cohesion: 0.19
Nodes (13): YearDropdown(), Cut / Deferred (YAGNI & Native Replacements), Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition), Verification Gate, 04 — Hero Number Consistency, Tax Retention Math Alignment & Plain-English Copy, 2. Mismatched `YearDropdown` Totals vs. Hero Totals, 3. Confusing Engineering Jargon in User-Facing Copy, Description (+5 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.06
Nodes (35): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 3. Project map, 4. Invariants (do not break), 5. Project skills (load when relevant), 6. Verify before you say "done", AGENTS.md — Payday (Salary & Income Management App), ensure_schema_migrations() (+27 more)

### Community 10 - "sources/service.py"
Cohesion: 0.07
Nodes (37): ConflictError, FastAPI, register_exception_handlers(), ErrorCode, DBDep, description, ge, Path (+29 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "dialog-provider.tsx"
Cohesion: 0.33
Nodes (8): DialogContext, DialogContextValue, PaychequeDialogRequest, PaychequePrefill, SourceDialogRequest, ToastState, Paycheque, Source

### Community 14 - "allocation-engine.ts"
Cohesion: 0.15
Nodes (15): AggregateAllocationReport, AggregateBucketSummary, allocateCentsLargestRemainder(), AllocatedBucket, AllocationCategory, computeAggregateAllocations(), PaychequeAllocationResult, AggregateTaxSummary (+7 more)

### Community 15 - "parsers.py"
Cohesion: 0.09
Nodes (40): AppError, BadRequestError, UnsupportedFileType, llm_available(), Paycheques bounded context., check_row(), clean_date(), clean_hours() (+32 more)

### Community 16 - "(dashboard)/page.tsx"
Cohesion: 0.33
Nodes (4): PageProps, frontend_src_features_overview_index, frontend_src_features_overview_index_getoverviewdata, frontend_src_features_overview_index_overviewdashboard

### Community 17 - "cn"
Cohesion: 0.24
Nodes (5): Skeleton(), YearDropdownProps, YearOption, cn(), fmt()

### Community 18 - "Detailed Problem"
Cohesion: 0.25
Nodes (7): 06 — Interactive Allocation Rebalancer, Preset Safety & Simulator Tax Awareness, 1. Destructive One-Click Preset Overwrite With No Confirmation or Undo, 2. Duplicate Primary Actions Stacked Vertically, 3. Painful Sequential Modal Editing to Rebalance 100%, 4. Split Simulator Ignores Untaxed Contractor Reserve Sources, Description, Detailed Problem

### Community 19 - "Payday — Salary & Income Management App"
Cohesion: 0.12
Nodes (16): 1. Start the Backend, 2. Start the Frontend, API Overview, Backend, Backend (`backend/src/config.py`), Environment Variables, Frontend, Frontend (`frontend/src/lib/env.ts`) (+8 more)

### Community 23 - "build_export_csv"
Cohesion: 0.09
Nodes (23): export_paycheques_csv(), ge, Response, build_export_csv(), _safe_csv_cell(), 2.1 Persistent `?year=` & Responsive Mobile Nav (`navbar.tsx`, `(dashboard)/layout.tsx`), 2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import, 2.3 Streamlined `PaychequeDialog` (`paycheque-dialog.tsx`) (+15 more)

### Community 24 - "Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards"
Cohesion: 0.29
Nodes (7): 1.1 Global Tokens & Base CSS (`frontend/src/styles/globals.css`), 1.2 Structural Loading Skeletons (`ui-audit/09`), 1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`), 1.4 Semantic Card Link, Contrast & Table Touch Targets, 1.5 Form Pending States, Safeguards & Native Color Input, 1.7 Remaining 1-Line Polish (`dialog-provider.tsx`, `navbar.tsx`, `global-error.tsx`, `not-found.tsx`), Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards

### Community 27 - "Detailed Solutions"
Cohesion: 0.18
Nodes (10): 07 — Guided First-Run Onboarding & Mobile Navigation Ergonomics, 1. Cold & Disconnected First-Run Empty State, 2. Cramped Mobile Sticky Header & Nav Pill Squeezing, Description, Detailed Problem, Detailed Solutions, Solution 1: Guided 3-Step First-Run Onboarding Card on Overview, Solution 2: Seamless Zero-Source Guard in `PaychequeDialog` (+2 more)

### Community 28 - "extractors.py"
Cohesion: 0.09
Nodes (29): _auto_crop_paper(), _compact_for_llm(), _encode_vision_jpeg_b64(), _enhance_ink_contrast(), _is_dark_background(), _llm(), llm_extract(), _ocr_engine() (+21 more)

### Community 29 - "Detailed Problem"
Cohesion: 0.20
Nodes (9): shortCurrency(), 1. Missing `name`, `autoComplete="off"`, and Trailing Ellipsis `…` on Inputs, 2. Typography Wrapping (`text-balance` & `text-pretty`) & Heading Hierarchy, 3. Currency/Number Formatting Hardcoding Check, Description, Detailed Problem, Detailed Solutions, UI Audit 10 — Form Attributes, Typography Details & Placeholder Standards (+1 more)

### Community 30 - "Detailed Solutions"
Cohesion: 0.20
Nodes (9): 1. Non-Semantic `<tr onClick>` With Nested Interactive Controls, 2. Tiny `24px` `Split` Pill Inside Clickable Row, Description, Detailed Problem, Detailed Solutions, Solution 1: Replace Row-Wide `<tr onClick>` With Explicit Action Controls or Stretched Trigger Pattern, Solution 2: Increase Hit Areas to ≥ 40×40px / 44×44px, UI Audit 02 — Table Row Interactions, Nested Controls & Minimum Touch Targets (+1 more)

### Community 31 - "Detailed Solutions"
Cohesion: 0.20
Nodes (9): 1. Bar Segment vs. Legend Dot Color Mismatch, 2. Unchecked Dynamic Text Color on Source Card Links, Description, Detailed Problem, Detailed Solutions, Solution 1: Bind Both Retention Bar and Legend Dots to Identical Semantic Tokens, Solution 2: Use `text-ink` or `text-accent-2` for `"View details"` and Use `--c` as a Pure Color Swatch, UI Audit 05 — Taxes Retention Bar & Legend Color Mismatch + Dynamic Contrast Guard (+1 more)

### Community 32 - "iso"
Cohesion: 0.22
Nodes (9): AllocationsPage(), PageProps, PageProps, TaxesPage(), frontend_src_features_allocations_index, frontend_src_features_allocations_index_allocationsdashboard, frontend_src_features_taxes_index, frontend_src_features_taxes_index_taxesdashboard (+1 more)

### Community 33 - "(dashboard)/layout.tsx"
Cohesion: 0.20
Nodes (8): dynamic, PageProps, frontend_src_features_paycheques_index, frontend_src_features_paycheques_index_getpaychequesdata, frontend_src_features_paycheques_index_paychequedialog, frontend_src_features_paycheques_index_paychequesview, frontend_src_features_sources_index_sourcedialog, react

### Community 34 - "UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards"
Cohesion: 0.22
Nodes (8): 1. Missing Pending State Across All 4 Dialogs & Card Actions, 2. Web Interface Guidelines Compliance, Description, Detailed Problem, Detailed Solutions, Target Snippet (`paycheque-dialog.tsx`), UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards, Verification Criteria

### Community 35 - "Detailed Problem"
Cohesion: 0.22
Nodes (8): 1. Prohibited `transition-all` Usages, 2. Layout-Triggering Property Transitions, 3. Press Scale Consistency, Description, Detailed Problem, Detailed Solutions, UI Audit 08 — Compositor-Safe Transitions, Reduced Motion & Removal of `transition-all`, Verification Criteria

### Community 36 - "Detailed Solutions"
Cohesion: 0.22
Nodes (8): DashboardLayout(), Description, Detailed Problem, Detailed Solutions, `frontend/src/app/(dashboard)/loading.tsx:1-8`, `frontend/src/app/(dashboard)/sources/[id]/loading.tsx:1-8`, UI Audit 09 — Structural Loading Skeletons & CLS Prevention, Verification Criteria

### Community 37 - "Detailed Problem"
Cohesion: 0.15
Nodes (12): 01 — Smart Two-Mode Paystub Entry, Live Rate Preview & Batch Logging, 1. Backwards Paystub Entry Flow, 2. Non-Automatic Sync & Silent Math Mismatches, 3. Missing Live Hourly Rate Feedback, 4. Friction During Historical Batch Entry, Description, Detailed Problem, Detailed Solutions (+4 more)

### Community 38 - "UI Audit 07 — Concentric Border Radii on Nested Surfaces"
Cohesion: 0.25
Nodes (7): 1. Inverted Radii in Modal Drawers (`4px` Outer vs. `10px` Inner), 2. Concentric Radii on Dialogs, Cards & Nested Bucket Cards, Description, Detailed Problem, Detailed Solutions, UI Audit 07 — Concentric Border Radii on Nested Surfaces, Verification Criteria

### Community 39 - "SourcePayload"
Cohesion: 0.13
Nodes (16): PaySchedule, StrEnum, SourceKind, Any, field_validator, model_validator, SourcePayload, 03 — Actionable "Next Paydays" & Explicit Source Pay Schedules (+8 more)

### Community 41 - "[id]/page.tsx"
Cohesion: 0.20
Nodes (6): PageProps, frontend_src_features_sources_index, frontend_src_features_sources_index_getsourcebyid, frontend_src_features_sources_index_getsourcesdata, frontend_src_features_sources_index_sourcedetailview, frontend_src_features_sources_index_sourcegrid

### Community 42 - "payday.ts"
Cohesion: 0.29
Nodes (7): AllocationRule, ActionState, PaydaySettings, PaydayState, PaySchedule, SourceKind, UpcomingPayday

### Community 43 - "UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay"
Cohesion: 0.29
Nodes (6): Description, Detailed Problem, Detailed Solutions, Target Implementation (`source-card.tsx`), UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay, Verification Criteria

### Community 45 - "master-ui-ux-improvement-plan.md"
Cohesion: 0.22
Nodes (6): 1. Inconsistent Color Picker UX Between Dialogs, Description, Detailed Problem, Detailed Solutions, UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets, Verification Criteria

### Community 46 - "navbar.tsx"
Cohesion: 0.39
Nodes (7): HASH_ROUTES, NAV_ITEMS, Navbar(), NavbarSearchParamsSync(), NavLinks(), withYearParam(), useDialogs()

### Community 47 - "UI Audit 03 — `YearDropdown` Keyboard Navigation, Escape Handling & Focus Management"
Cohesion: 0.33
Nodes (6): Description, Detailed Problem, Detailed Solutions, Target Snippet (`year-dropdown.tsx`), UI Audit 03 — `YearDropdown` Keyboard Navigation, Escape Handling & Focus Management, Verification Criteria

### Community 48 - "app/layout.tsx"
Cohesion: 0.20
Nodes (6): dmMono, metadata, outfit, viewport, frontend_src_styles_globals, next

### Community 51 - "Detailed Solutions"
Cohesion: 0.40
Nodes (5): Detailed Solutions, Solution 1: Preset Confirmation Dialog + Snapshot Undo, Solution 2: Remove Duplicate CTA & Introduce `"Rebalance percentages"` Mode, Solution 3: Source Tax-Reserve Selector in the Simulator, Verification Criteria

### Community 54 - "add_no_store_header"
Cohesion: 0.50
Nodes (4): add_no_store_header(), Response, middleware, Request

## Knowledge Gaps
- **192 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 351 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import` connect `build_export_csv` to `PaychequePayload`, `navbar.tsx`?**
  _High betweenness centrality (0.236) - this node is a cross-community bridge._
- **Why does `Navbar()` connect `navbar.tsx` to `(dashboard)/layout.tsx`, `Detailed Problem`, `PaychequePayload`, `build_export_csv`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Why does `ensure_schema_migrations()` connect `PaychequePayload` to `test_app.py`, `allocations.py`, `build_export_csv`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `Source` (e.g. with `parse_paycheque_file()` and `build_export_csv()`) actually correct?**
  _`Source` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08233117483811286 - nodes in this community are weakly interconnected._
- **Should `allocations.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06124357176250585 - nodes in this community are weakly interconnected._