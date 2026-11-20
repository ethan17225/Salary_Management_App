# Graph Report - Salary_Management_App  (2026-11-20)

## Corpus Check
- 83 files · ~33,598 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 6, .css 1, .tsbuildinfo 1)

## Summary
- 783 nodes · 1487 edges · 48 communities (40 shown, 8 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 131 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1060caa4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- export_paycheques_csv
- test_app.py
- allocations.py
- database.py
- AllocationRulePayload
- (dashboard)/layout.tsx
- package.json
- YearDropdown
- ensure_schema_migrations
- paycheques/exceptions.py
- Docker Compose backend Service
- compilerOptions
- 03 — Actionable "Next Paydays" & Explicit Source Pay Schedules
- PaychequePayload
- parsers.py
- (dashboard)/page.tsx
- navbar.tsx
- Detailed Problem
- paycheques/service.py
- src/__init__.py
- next-env.d.ts
- Detailed Problem
- paycheques/router.py
- payday-backend
- Detailed Solutions
- extractors.py
- Detailed Problem
- Detailed Solutions
- Detailed Solutions
- Detailed Solutions
- DialogProvider
- UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards
- Detailed Problem
- UI Audit 07 — Concentric Border Radii on Nested Surfaces
- src/exceptions.py
- Detailed Solutions
- UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay
- master-ui-ux-improvement-plan.md
- UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets
- [id]/page.tsx
- app/layout.tsx
- Detailed Solutions
- postcss.config.mjs
- zoneinfo
- cn

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
- `3.1. Overview Dashboard (`/`)` --references--> `YearDropdown()`  [INFERRED]
  PROJECT_OVERVIEW.md → frontend/src/components/ui/year-dropdown.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (48 total, 8 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.05
Nodes (54): dynamic, proxy(), RouteContext, AllocationsPage(), PageProps, PageProps, TaxesPage(), DialogContext (+46 more)

### Community 1 - "export_paycheques_csv"
Cohesion: 0.14
Nodes (16): create_paycheque(), delete_paycheque(), export_paycheques_csv(), list_paycheques(), DBDep, delete, ge, get (+8 more)

### Community 2 - "test_app.py"
Cohesion: 0.12
Nodes (32): AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., client(), db_session_factory(), async_sessionmaker, AsyncSession (+24 more)

### Community 3 - "allocations.py"
Cohesion: 0.08
Nodes (50): AllocationPresetPayload, AllocationRule, AllocationRuleResponse, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum() (+42 more)

### Community 4 - "database.py"
Cohesion: 0.06
Nodes (53): AsyncEngine, get_db(), init_db(), async_sessionmaker, AsyncSession, seed_database(), add_no_store_header(), health_check() (+45 more)

### Community 5 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 6 - "(dashboard)/layout.tsx"
Cohesion: 0.22
Nodes (7): dynamic, PageProps, frontend_src_features_paycheques_index, frontend_src_features_paycheques_index_getpaychequesdata, frontend_src_features_paycheques_index_paychequedialog, frontend_src_features_paycheques_index_paychequesview, frontend_src_features_sources_index_sourcedialog

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (31): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+23 more)

### Community 8 - "YearDropdown"
Cohesion: 0.05
Nodes (42): YearDropdown(), 1.1 Global Tokens & Base CSS (`frontend/src/styles/globals.css`), 1.2 Structural Loading Skeletons (`ui-audit/09`), 1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`), 1.4 Semantic Card Link, Contrast & Table Touch Targets, 1.5 Form Pending States, Safeguards & Native Color Input, 1.7 Remaining 1-Line Polish (`dialog-provider.tsx`, `navbar.tsx`, `global-error.tsx`, `not-found.tsx`), Cut / Deferred (YAGNI & Native Replacements) (+34 more)

### Community 9 - "ensure_schema_migrations"
Cohesion: 0.04
Nodes (45): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 3. Project map, 5. Project skills (load when relevant), 6. Verify before you say "done", AGENTS.md — Payday (Salary & Income Management App), ensure_schema_migrations(), _exec_sql() (+37 more)

### Community 10 - "paycheques/exceptions.py"
Cohesion: 0.19
Nodes (11): ErrorCode, StrEnum, DBDep, description, ge, Path, valid_paycheque_id(), InvalidSourceReference (+3 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "03 — Actionable "Next Paydays" & Explicit Source Pay Schedules"
Cohesion: 0.20
Nodes (9): 03 — Actionable "Next Paydays" & Explicit Source Pay Schedules, 1. Predicted Paydays Are Read-Only Dead Ends, 2. Three-Paycheque Cold Start & Rigid Median-Gap Heuristic, Description, Detailed Problem, Detailed Solutions, Solution 1: Interactive `UpcomingPaydaysList` Client Component, Solution 2: Optional Explicit Pay Frequency on Sources (+1 more)

### Community 14 - "PaychequePayload"
Cohesion: 0.09
Nodes (24): 4. Invariants (do not break), PaychequePayload, Any, field_validator, model_validator, parse_optional_cents(), AggregateAllocationReport, AggregateBucketSummary (+16 more)

### Community 15 - "parsers.py"
Cohesion: 0.11
Nodes (30): llm_available(), check_row(), cents(), clean_date(), clean_hours(), clean_money(), _clean_text(), _fields_from_summary_lines() (+22 more)

### Community 16 - "(dashboard)/page.tsx"
Cohesion: 0.33
Nodes (4): PageProps, frontend_src_features_overview_index, frontend_src_features_overview_index_getoverviewdata, frontend_src_features_overview_index_overviewdashboard

### Community 17 - "navbar.tsx"
Cohesion: 0.39
Nodes (7): HASH_ROUTES, NAV_ITEMS, Navbar(), NavbarSearchParamsSync(), NavLinks(), withYearParam(), useDialogs()

### Community 18 - "Detailed Problem"
Cohesion: 0.25
Nodes (7): 06 — Interactive Allocation Rebalancer, Preset Safety & Simulator Tax Awareness, 1. Destructive One-Click Preset Overwrite With No Confirmation or Undo, 2. Duplicate Primary Actions Stacked Vertically, 3. Painful Sequential Modal Editing to Rebalance 100%, 4. Split Simulator Ignores Untaxed Contractor Reserve Sources, Description, Detailed Problem

### Community 19 - "paycheques/service.py"
Cohesion: 0.18
Nodes (22): Paycheque, import_paycheques(), PaychequeImportPayload, PaychequeImportResponse, build_export_csv(), _commit_paycheque(), compute_paycheque_import_hash(), create_paycheque() (+14 more)

### Community 23 - "Detailed Problem"
Cohesion: 0.22
Nodes (8): 1. Prohibited `transition-all` Usages, 2. Layout-Triggering Property Transitions, 3. Press Scale Consistency, Description, Detailed Problem, Detailed Solutions, UI Audit 08 — Compositor-Safe Transitions, Reduced Motion & Removal of `transition-all`, Verification Criteria

### Community 24 - "paycheques/router.py"
Cohesion: 0.24
Nodes (12): AppError, BadRequestError, FileTooLarge, UnsupportedFileType, detect_mime(), parse_upload(), Trust magic bytes, never the client's extension or Content-Type. The extension…, parse_paycheque_file() (+4 more)

### Community 27 - "Detailed Solutions"
Cohesion: 0.18
Nodes (10): 07 — Guided First-Run Onboarding & Mobile Navigation Ergonomics, 1. Cold & Disconnected First-Run Empty State, 2. Cramped Mobile Sticky Header & Nav Pill Squeezing, Description, Detailed Problem, Detailed Solutions, Solution 1: Guided 3-Step First-Run Onboarding Card on Overview, Solution 2: Seamless Zero-Source Guard in `PaychequeDialog` (+2 more)

### Community 28 - "extractors.py"
Cohesion: 0.09
Nodes (22): AppConfig, _compact_for_llm(), _llm(), llm_extract(), _ocr_engine(), ocr_text(), CPU-bound text extraction, always called through asyncio.to_thread. OCR…, Keep header lines (employer + dates) and numeric/summary lines inside a small… (+14 more)

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

### Community 33 - "DialogProvider"
Cohesion: 0.40
Nodes (5): DialogProvider(), Detailed Solutions, Solution 1: Build `PaydayChecklistDialog` Component, Solution 2: Seamless Triggers in Save Flow & Ledgers, Verification Criteria

### Community 34 - "UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards"
Cohesion: 0.22
Nodes (8): 1. Missing Pending State Across All 4 Dialogs & Card Actions, 2. Web Interface Guidelines Compliance, Description, Detailed Problem, Detailed Solutions, Target Snippet (`paycheque-dialog.tsx`), UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards, Verification Criteria

### Community 37 - "Detailed Problem"
Cohesion: 0.25
Nodes (7): 01 — Smart Two-Mode Paystub Entry, Live Rate Preview & Batch Logging, 1. Backwards Paystub Entry Flow, 2. Non-Automatic Sync & Silent Math Mismatches, 3. Missing Live Hourly Rate Feedback, 4. Friction During Historical Batch Entry, Description, Detailed Problem

### Community 38 - "UI Audit 07 — Concentric Border Radii on Nested Surfaces"
Cohesion: 0.25
Nodes (7): 1. Inverted Radii in Modal Drawers (`4px` Outer vs. `10px` Inner), 2. Concentric Radii on Dialogs, Cards & Nested Bucket Cards, Description, Detailed Problem, Detailed Solutions, UI Audit 07 — Concentric Border Radii on Nested Surfaces, Verification Criteria

### Community 39 - "src/exceptions.py"
Cohesion: 0.11
Nodes (19): ConflictError, NotFoundError, FastAPI, register_exception_handlers(), ErrorCode, PaySchedule, StrEnum, SourceKind (+11 more)

### Community 42 - "Detailed Solutions"
Cohesion: 0.22
Nodes (8): DashboardLayout(), Description, Detailed Problem, Detailed Solutions, `frontend/src/app/(dashboard)/loading.tsx:1-8`, `frontend/src/app/(dashboard)/sources/[id]/loading.tsx:1-8`, UI Audit 09 — Structural Loading Skeletons & CLS Prevention, Verification Criteria

### Community 43 - "UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay"
Cohesion: 0.29
Nodes (6): Description, Detailed Problem, Detailed Solutions, Target Implementation (`source-card.tsx`), UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay, Verification Criteria

### Community 44 - "master-ui-ux-improvement-plan.md"
Cohesion: 0.29
Nodes (5): 02 — Actionable Payday Transfer Checklist & Split Drawer, 1. Dead-End Feedback When Logging a Paycheque, 2. Cramped & Hidden Split UI in `/paycheques`, Description, Detailed Problem

### Community 45 - "UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets"
Cohesion: 0.29
Nodes (6): 1. Inconsistent Color Picker UX Between Dialogs, Description, Detailed Problem, Detailed Solutions, UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets, Verification Criteria

### Community 47 - "[id]/page.tsx"
Cohesion: 0.20
Nodes (6): PageProps, frontend_src_features_sources_index, frontend_src_features_sources_index_getsourcebyid, frontend_src_features_sources_index_getsourcesdata, frontend_src_features_sources_index_sourcedetailview, frontend_src_features_sources_index_sourcegrid

### Community 48 - "app/layout.tsx"
Cohesion: 0.20
Nodes (6): dmMono, metadata, outfit, viewport, frontend_src_styles_globals, next

### Community 50 - "Detailed Solutions"
Cohesion: 0.40
Nodes (5): Detailed Solutions, Solution 1: Two-Mode Entry Segmented Toggle (`Quick Net` vs. `Full Paystub`), Solution 2: Live Hourly Rate Preview Pill, Solution 3: `"Save & add another"` Batch Workflow, Verification Criteria

## Knowledge Gaps
- **192 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 343 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import` connect `ensure_schema_migrations` to `navbar.tsx`, `paycheques/service.py`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `Navbar()` connect `navbar.tsx` to `ensure_schema_migrations`, `(dashboard)/layout.tsx`, `Detailed Problem`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition)` connect `YearDropdown` to `ensure_schema_migrations`, `master-ui-ux-improvement-plan.md`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `Source` (e.g. with `parse_paycheque_file()` and `build_export_csv()`) actually correct?**
  _`Source` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `BadRequestError` (e.g. with `create_allocation()` and `update_allocation()`) actually correct?**
  _`BadRequestError` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._