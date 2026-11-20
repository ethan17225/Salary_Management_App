# Graph Report - Salary_Management_App  (2026-11-20)

## Corpus Check
- 83 files · ~32,215 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 6, .css 1, .tsbuildinfo 1)

## Summary
- 770 nodes · 1453 edges · 45 communities (38 shown, 7 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 129 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8d857342`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- build_export_csv
- test_app.py
- allocations.py
- sources/service.py
- AllocationRulePayload
- (dashboard)/layout.tsx
- package.json
- YearDropdown
- PaychequePayload
- Paycheque
- Docker Compose backend Service
- compilerOptions
- sources/schemas.py
- allocation-engine.ts
- parsers.py
- (dashboard)/page.tsx
- db.ts
- Detailed Problem
- paycheques/service.py
- src/__init__.py
- next-env.d.ts
- navbar.tsx
- database.py
- payday-backend
- Detailed Solutions
- paycheques/exceptions.py
- Detailed Problem
- Detailed Solutions
- Detailed Solutions
- Detailed Solutions
- dialog-provider.tsx
- UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards
- Navbar
- Phase 2 — Multi-User Workflows, Navigation Persistence, Schedules & CSV Import/Export
- Detailed Problem
- UI Audit 07 — Concentric Border Radii on Nested Surfaces
- main.py
- UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay
- UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets
- master-ui-ux-improvement-plan.md
- postcss.config.mjs
- zoneinfo

## God Nodes (most connected - your core abstractions)
1. `CustomModel` - 24 edges
2. `Source` - 18 edges
3. `parse_cents()` - 17 edges
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
- `Guardrails` --references--> `_safe_csv_cell()`  [INFERRED]
  improvement-plan/master-ui-ux-improvement-plan.md → backend/src/paycheques/service.py
- `3.2. Paycheques Ledger (`/paycheques`)` --references--> `_safe_csv_cell()`  [INFERRED]
  PROJECT_OVERVIEW.md → backend/src/paycheques/service.py
- `Verification Criteria` --references--> `_safe_csv_cell()`  [INFERRED]
  refactor/05-persistent-year-and-url-filter-state.md → backend/src/paycheques/service.py
- `3.1. Overview Dashboard (`/`)` --references--> `YearDropdown()`  [INFERRED]
  PROJECT_OVERVIEW.md → frontend/src/components/ui/year-dropdown.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (45 total, 7 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.15
Nodes (21): YearDropdownProps, YearOption, addDays(), addMonthsClamped(), buildTimelineMonths(), CAD, computeUpcomingPaydays(), dateLabel() (+13 more)

### Community 1 - "build_export_csv"
Cohesion: 0.12
Nodes (19): create_paycheque(), delete_paycheque(), export_paycheques_csv(), list_paycheques(), DBDep, delete, ge, get (+11 more)

### Community 2 - "test_app.py"
Cohesion: 0.06
Nodes (53): AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, _llm(), llm_extract(), _ocr_engine() (+45 more)

### Community 3 - "allocations.py"
Cohesion: 0.08
Nodes (50): AllocationPresetPayload, AllocationRule, AllocationRuleResponse, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum() (+42 more)

### Community 4 - "sources/service.py"
Cohesion: 0.10
Nodes (32): ConflictError, DBDep, description, ge, Path, valid_source_id(), DuplicateSourceName, SourceHasPaycheques (+24 more)

### Community 5 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 6 - "(dashboard)/layout.tsx"
Cohesion: 0.05
Nodes (31): DashboardLayout(), dynamic, PageProps, PageProps, DialogProvider(), frontend_src_features_paycheques_index, frontend_src_features_paycheques_index_getpaychequesdata, frontend_src_features_paycheques_index_paychequedialog (+23 more)

### Community 7 - "package.json"
Cohesion: 0.05
Nodes (38): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+30 more)

### Community 8 - "YearDropdown"
Cohesion: 0.05
Nodes (43): YearDropdown(), 1.1 Global Tokens & Base CSS (`frontend/src/styles/globals.css`), 1.2 Structural Loading Skeletons (`ui-audit/09`), 1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`), 1.4 Semantic Card Link, Contrast & Table Touch Targets, 1.5 Form Pending States, Safeguards & Native Color Input, 1.7 Remaining 1-Line Polish (`dialog-provider.tsx`, `navbar.tsx`, `global-error.tsx`, `not-found.tsx`), Cut / Deferred (YAGNI & Native Replacements) (+35 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.06
Nodes (35): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 3. Project map, 4. Invariants (do not break), 5. Project skills (load when relevant), 6. Verify before you say "done", AGENTS.md — Payday (Salary & Income Management App), ensure_schema_migrations() (+27 more)

### Community 10 - "Paycheque"
Cohesion: 0.21
Nodes (15): DBDep, description, ge, Path, valid_paycheque_id(), Paycheque, _commit_paycheque(), create_paycheque() (+7 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "sources/schemas.py"
Cohesion: 0.11
Nodes (20): parse_tax_reserve_bps(), Validates range 0 <= bps <= 6000 (0% to 60%)., ErrorCode, PaySchedule, StrEnum, SourceKind, Any, field_validator (+12 more)

### Community 14 - "allocation-engine.ts"
Cohesion: 0.15
Nodes (15): AggregateAllocationReport, AggregateBucketSummary, allocateCentsLargestRemainder(), AllocatedBucket, AllocationCategory, computeAggregateAllocations(), PaychequeAllocationResult, AggregateTaxSummary (+7 more)

### Community 15 - "parsers.py"
Cohesion: 0.13
Nodes (26): BadRequestError, UnsupportedFileType, llm_available(), check_row(), cents(), clean_date(), clean_hours(), clean_money() (+18 more)

### Community 16 - "(dashboard)/page.tsx"
Cohesion: 0.33
Nodes (4): PageProps, frontend_src_features_overview_index, frontend_src_features_overview_index_getoverviewdata, frontend_src_features_overview_index_overviewdashboard

### Community 17 - "db.ts"
Cohesion: 0.10
Nodes (17): dynamic, proxy(), RouteContext, AllocationsPage(), PageProps, PageProps, TaxesPage(), frontend_src_features_allocations_index (+9 more)

### Community 18 - "Detailed Problem"
Cohesion: 0.25
Nodes (7): 06 — Interactive Allocation Rebalancer, Preset Safety & Simulator Tax Awareness, 1. Destructive One-Click Preset Overwrite With No Confirmation or Undo, 2. Duplicate Primary Actions Stacked Vertically, 3. Painful Sequential Modal Editing to Rebalance 100%, 4. Split Simulator Ignores Untaxed Contractor Reserve Sources, Description, Detailed Problem

### Community 19 - "paycheques/service.py"
Cohesion: 0.22
Nodes (17): ErrorCode, StrEnum, import_paycheques(), PaychequeImportPayload, PaychequeImportResponse, compute_paycheque_import_hash(), import_paycheques_batch(), _pick_alias() (+9 more)

### Community 23 - "navbar.tsx"
Cohesion: 0.22
Nodes (8): HASH_ROUTES, NAV_ITEMS, NavbarSearchParamsSync(), NavLinks(), withYearParam(), useDialogs(), Skeleton(), cn()

### Community 24 - "database.py"
Cohesion: 0.23
Nodes (9): get_db(), AsyncSession, seed_database(), Paycheques bounded context., Sources bounded context., fastapi, re, sqlalchemy_engine (+1 more)

### Community 27 - "Detailed Solutions"
Cohesion: 0.18
Nodes (10): 07 — Guided First-Run Onboarding & Mobile Navigation Ergonomics, 1. Cold & Disconnected First-Run Empty State, 2. Cramped Mobile Sticky Header & Nav Pill Squeezing, Description, Detailed Problem, Detailed Solutions, Solution 1: Guided 3-Step First-Run Onboarding Card on Overview, Solution 2: Seamless Zero-Source Guard in `PaychequeDialog` (+2 more)

### Community 28 - "paycheques/exceptions.py"
Cohesion: 0.31
Nodes (7): AppError, NotFoundError, FileTooLarge, InvalidSourceReference, PaychequeNotFound, SourceNotFound, Exception

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
Cohesion: 0.40
Nodes (5): Detailed Solutions, Solution 1: Preset Confirmation Dialog + Snapshot Undo, Solution 2: Remove Duplicate CTA & Introduce `"Rebalance percentages"` Mode, Solution 3: Source Tax-Reserve Selector in the Simulator, Verification Criteria

### Community 33 - "dialog-provider.tsx"
Cohesion: 0.17
Nodes (15): DialogContext, DialogContextValue, PaychequeDialogRequest, PaychequePrefill, SourceDialogRequest, ToastState, AllocationRule, ActionState (+7 more)

### Community 34 - "UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards"
Cohesion: 0.22
Nodes (8): 1. Missing Pending State Across All 4 Dialogs & Card Actions, 2. Web Interface Guidelines Compliance, Description, Detailed Problem, Detailed Solutions, Target Snippet (`paycheque-dialog.tsx`), UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards, Verification Criteria

### Community 35 - "Navbar"
Cohesion: 0.10
Nodes (20): Navbar(), 3.6. Interactive Dialogs & Accessibility, 05 — Persistent `?year=` Across Navigation & URL-Synced Ledger Filters, 1. Year Context Lost on Tab Switches, 2. Local-Only Ledger Filters & Unfiltered CSV Export, Description, Detailed Problem, Detailed Solutions (+12 more)

### Community 36 - "Phase 2 — Multi-User Workflows, Navigation Persistence, Schedules & CSV Import/Export"
Cohesion: 0.50
Nodes (4): 2.1 Persistent `?year=` & Responsive Mobile Nav (`navbar.tsx`, `(dashboard)/layout.tsx`), 2.3 Streamlined `PaychequeDialog` (`paycheque-dialog.tsx`), 2.4 Explicit `pay_schedule`, Clickable `Next paydays`, 3-Step Onboarding & Goal Pace Lines, Phase 2 — Multi-User Workflows, Navigation Persistence, Schedules & CSV Import/Export

### Community 37 - "Detailed Problem"
Cohesion: 0.40
Nodes (5): 1. Backwards Paystub Entry Flow, 2. Non-Automatic Sync & Silent Math Mismatches, 3. Missing Live Hourly Rate Feedback, 4. Friction During Historical Batch Entry, Detailed Problem

### Community 38 - "UI Audit 07 — Concentric Border Radii on Nested Surfaces"
Cohesion: 0.25
Nodes (7): 1. Inverted Radii in Modal Drawers (`4px` Outer vs. `10px` Inner), 2. Concentric Radii on Dialogs, Cards & Nested Bucket Cards, Description, Detailed Problem, Detailed Solutions, UI Audit 07 — Concentric Border Radii on Nested Surfaces, Verification Criteria

### Community 39 - "main.py"
Cohesion: 0.10
Nodes (19): AsyncEngine, init_db(), async_sessionmaker, FastAPI, register_exception_handlers(), add_no_store_header(), health_check(), lifespan() (+11 more)

### Community 43 - "UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay"
Cohesion: 0.29
Nodes (6): Description, Detailed Problem, Detailed Solutions, Target Implementation (`source-card.tsx`), UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay, Verification Criteria

### Community 45 - "UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets"
Cohesion: 0.29
Nodes (6): 1. Inconsistent Color Picker UX Between Dialogs, Description, Detailed Problem, Detailed Solutions, UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets, Verification Criteria

### Community 50 - "master-ui-ux-improvement-plan.md"
Cohesion: 0.22
Nodes (7): 01 — Smart Two-Mode Paystub Entry, Live Rate Preview & Batch Logging, Description, Detailed Solutions, Solution 1: Two-Mode Entry Segmented Toggle (`Quick Net` vs. `Full Paystub`), Solution 2: Live Hourly Rate Preview Pill, Solution 3: `"Save & add another"` Batch Workflow, Verification Criteria

## Knowledge Gaps
- **192 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 338 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import` connect `build_export_csv` to `PaychequePayload`, `Navbar`, `Phase 2 — Multi-User Workflows, Navigation Persistence, Schedules & CSV Import/Export`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `Navbar()` connect `Navbar` to `build_export_csv`, `(dashboard)/layout.tsx`, `navbar.tsx`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)` connect `YearDropdown` to `master-ui-ux-improvement-plan.md`, `Phase 2 — Multi-User Workflows, Navigation Persistence, Schedules & CSV Import/Export`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `Source` (e.g. with `build_export_csv()` and `valid_source_id()`) actually correct?**
  _`Source` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `BadRequestError` (e.g. with `create_allocation()` and `update_allocation()`) actually correct?**
  _`BadRequestError` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._