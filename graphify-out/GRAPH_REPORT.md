# Graph Report - Salary_Management_App  (2026-11-21)

## Corpus Check
- 84 files · ~38,720 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 844 nodes · 1689 edges · 60 communities (51 shown, 9 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 155 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd840d3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- utils.ts
- test_app.py
- allocations.py
- paycheques/service.py
- AllocationRulePayload
- master-ui-ux-improvement-plan.md
- package.json
- YearDropdown
- PaychequePayload
- Source
- Docker Compose backend Service
- compilerOptions
- dialog-provider.tsx
- tax-intelligence.ts
- parsers.py
- (dashboard)/page.tsx
- cn
- Detailed Problem
- Payday — Salary & Income Management App
- src/__init__.py
- next-env.d.ts
- navbar.tsx
- Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards
- payday-backend
- Detailed Solutions
- extractors.py
- Detailed Problem
- Detailed Solutions
- Detailed Solutions
- [id]/page.tsx
- (dashboard)/layout.tsx
- UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards
- import_logs.py
- Detailed Solutions
- Detailed Problem
- UI Audit 07 — Concentric Border Radii on Nested Surfaces
- 03 — Actionable "Next Paydays" & Explicit Source Pay Schedules
- database.py
- list_import_pipeline_logs
- paycheques/router.py
- UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay
- valid_paycheque_id
- UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets
- _safe_csv_cell
- Detailed Solutions
- app/layout.tsx
- Detailed Solutions
- allocation-engine.ts
- Detailed Solutions
- postcss.config.mjs
- zoneinfo
- main.py
- ocr_text
- register_exception_handlers
- preprocess_document_image
- Detailed Solutions
- config.py

## God Nodes (most connected - your core abstractions)
1. `CustomModel` - 25 edges
2. `parse_cents()` - 20 edges
3. `Source` - 20 edges
4. `BadRequestError` - 16 edges
5. `PaychequePayload` - 16 edges
6. `YearDropdown()` - 16 edges
7. `compilerOptions` - 16 edges
8. `Base` - 15 edges
9. `OkResponse` - 15 edges
10. `Paycheque` - 15 edges

## Surprising Connections (you probably didn't know these)
- `1. Destructive One-Click Preset Overwrite With No Confirmation or Undo` --references--> `apply_preset()`  [INFERRED]
  refactor/06-interactive-allocation-rebalancing-and-safety.md → backend/src/allocations.py
- `3. Project map` --references--> `ensure_schema_migrations()`  [INFERRED]
  AGENTS.md → backend/src/database.py
- `Technology Highlights` --references--> `ensure_schema_migrations()`  [INFERRED]
  PROJECT_OVERVIEW.md → backend/src/database.py
- `Verification Criteria` --references--> `_safe_csv_cell()`  [INFERRED]
  refactor/05-persistent-year-and-url-filter-state.md → backend/src/paycheques/service.py
- `3.6. Interactive Dialogs & Accessibility` --references--> `Navbar()`  [INFERRED]
  PROJECT_OVERVIEW.md → frontend/src/components/layout/navbar.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (60 total, 9 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.13
Nodes (13): dynamic, proxy(), RouteContext, PageProps, TaxesPage(), frontend_src_features_taxes_index, frontend_src_features_taxes_index_taxesdashboard, db (+5 more)

### Community 1 - "utils.ts"
Cohesion: 0.14
Nodes (22): AllocationsPage(), PageProps, frontend_src_features_allocations_index, frontend_src_features_allocations_index_allocationsdashboard, addDays(), addMonthsClamped(), buildTimelineMonths(), CAD (+14 more)

### Community 2 - "test_app.py"
Cohesion: 0.07
Nodes (48): AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, field_validator, ensure_schema_migrations(), _exec_sql() (+40 more)

### Community 3 - "allocations.py"
Cohesion: 0.07
Nodes (59): AllocationPresetPayload, AllocationRule, AllocationRuleResponse, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum() (+51 more)

### Community 4 - "paycheques/service.py"
Cohesion: 0.18
Nodes (20): ErrorCode, StrEnum, cents(), cents(), import_paycheques(), PaychequeImportPayload, PaychequeImportResponse, compute_paycheque_import_hash() (+12 more)

### Community 5 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 6 - "master-ui-ux-improvement-plan.md"
Cohesion: 0.29
Nodes (5): 02 — Actionable Payday Transfer Checklist & Split Drawer, 1. Dead-End Feedback When Logging a Paycheque, 2. Cramped & Hidden Split UI in `/paycheques`, Description, Detailed Problem

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (31): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+23 more)

### Community 8 - "YearDropdown"
Cohesion: 0.17
Nodes (13): YearDropdown(), 04 — Hero Number Consistency, Tax Retention Math Alignment & Plain-English Copy, 2. Mismatched `YearDropdown` Totals vs. Hero Totals, 3. Confusing Engineering Jargon in User-Facing Copy, Description, Detailed Problem, Detailed Solutions, Solution 2: Contextual Hero Subtitles & Explicit `YearDropdown` Labels (+5 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.08
Nodes (27): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 3. Project map, 4. Invariants (do not break), 5. Project skills (load when relevant), 6. Verify before you say "done", AGENTS.md — Payday (Salary & Income Management App), PaychequePayload (+19 more)

### Community 10 - "Source"
Cohesion: 0.10
Nodes (30): parse_tax_reserve_bps(), Validates range 0 <= bps <= 6000 (0% to 60%)., ErrorCode, PaySchedule, StrEnum, SourceKind, DBDep, description (+22 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "dialog-provider.tsx"
Cohesion: 0.17
Nodes (15): DialogContext, DialogContextValue, PaychequeDialogRequest, PaychequePrefill, SourceDialogRequest, ToastState, AllocationRule, ActionState (+7 more)

### Community 14 - "tax-intelligence.ts"
Cohesion: 0.27
Nodes (9): AggregateTaxSummary, computeAggregateTaxSummary(), computePaychequeBreakdown(), PaychequeRecord, PaychequeTaxBreakdown, SourceRecord, 1.6 Taxes Retention Math & Color Alignment, 1. Contradictory Retention Percentages on `/taxes` for Partial Paystub Coverage (+1 more)

### Community 15 - "parsers.py"
Cohesion: 0.08
Nodes (54): AppError, BadRequestError, ConflictError, NotFoundError, FileTooLarge, InvalidSourceReference, PaychequeNotFound, UnsupportedFileType (+46 more)

### Community 16 - "(dashboard)/page.tsx"
Cohesion: 0.33
Nodes (4): PageProps, frontend_src_features_overview_index, frontend_src_features_overview_index_getoverviewdata, frontend_src_features_overview_index_overviewdashboard

### Community 17 - "cn"
Cohesion: 0.21
Nodes (7): DialogProvider(), Skeleton(), cn(), Detailed Solutions, Solution 1: Build `PaydayChecklistDialog` Component, Solution 2: Seamless Triggers in Save Flow & Ledgers, Verification Criteria

### Community 18 - "Detailed Problem"
Cohesion: 0.25
Nodes (7): 06 — Interactive Allocation Rebalancer, Preset Safety & Simulator Tax Awareness, 1. Destructive One-Click Preset Overwrite With No Confirmation or Undo, 2. Duplicate Primary Actions Stacked Vertically, 3. Painful Sequential Modal Editing to Rebalance 100%, 4. Split Simulator Ignores Untaxed Contractor Reserve Sources, Description, Detailed Problem

### Community 19 - "Payday — Salary & Income Management App"
Cohesion: 0.12
Nodes (16): 1. Start the Backend, 2. Start the Frontend, API Overview, Backend, Backend (`backend/src/config.py`), Environment Variables, Frontend, Frontend (`frontend/src/lib/env.ts`) (+8 more)

### Community 23 - "navbar.tsx"
Cohesion: 0.15
Nodes (15): HASH_ROUTES, NAV_ITEMS, Navbar(), NavbarSearchParamsSync(), NavLinks(), withYearParam(), useDialogs(), 1. Prohibited `transition-all` Usages (+7 more)

### Community 24 - "Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards"
Cohesion: 0.29
Nodes (7): 1.1 Global Tokens & Base CSS (`frontend/src/styles/globals.css`), 1.2 Structural Loading Skeletons (`ui-audit/09`), 1.3 Native `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`), 1.4 Semantic Card Link, Contrast & Table Touch Targets, 1.5 Form Pending States, Safeguards & Native Color Input, 1.7 Remaining 1-Line Polish (`dialog-provider.tsx`, `navbar.tsx`, `global-error.tsx`, `not-found.tsx`), Phase 1 — Accessibility, Loading Skeletons, Real Bugs & Data-Loss Guards

### Community 27 - "Detailed Solutions"
Cohesion: 0.18
Nodes (10): 07 — Guided First-Run Onboarding & Mobile Navigation Ergonomics, 1. Cold & Disconnected First-Run Empty State, 2. Cramped Mobile Sticky Header & Nav Pill Squeezing, Description, Detailed Problem, Detailed Solutions, Solution 1: Guided 3-Step First-Run Onboarding Card on Overview, Solution 2: Seamless Zero-Source Guard in `PaychequeDialog` (+2 more)

### Community 28 - "extractors.py"
Cohesion: 0.12
Nodes (19): _compact_for_llm(), _encode_vision_jpeg_b64(), _llm(), llm_available(), llm_extract(), _parse_json_object(), CPU-bound text/image extraction and optional OpenAI-compatible Vision OCR…, Keep header lines (employer + dates) and numeric/summary lines inside a small… (+11 more)

### Community 29 - "Detailed Problem"
Cohesion: 0.20
Nodes (9): shortCurrency(), 1. Missing `name`, `autoComplete="off"`, and Trailing Ellipsis `…` on Inputs, 2. Typography Wrapping (`text-balance` & `text-pretty`) & Heading Hierarchy, 3. Currency/Number Formatting Hardcoding Check, Description, Detailed Problem, Detailed Solutions, UI Audit 10 — Form Attributes, Typography Details & Placeholder Standards (+1 more)

### Community 30 - "Detailed Solutions"
Cohesion: 0.20
Nodes (9): 1. Non-Semantic `<tr onClick>` With Nested Interactive Controls, 2. Tiny `24px` `Split` Pill Inside Clickable Row, Description, Detailed Problem, Detailed Solutions, Solution 1: Replace Row-Wide `<tr onClick>` With Explicit Action Controls or Stretched Trigger Pattern, Solution 2: Increase Hit Areas to ≥ 40×40px / 44×44px, UI Audit 02 — Table Row Interactions, Nested Controls & Minimum Touch Targets (+1 more)

### Community 31 - "Detailed Solutions"
Cohesion: 0.20
Nodes (9): 1. Bar Segment vs. Legend Dot Color Mismatch, 2. Unchecked Dynamic Text Color on Source Card Links, Description, Detailed Problem, Detailed Solutions, Solution 1: Bind Both Retention Bar and Legend Dots to Identical Semantic Tokens, Solution 2: Use `text-ink` or `text-accent-2` for `"View details"` and Use `--c` as a Pure Color Swatch, UI Audit 05 — Taxes Retention Bar & Legend Color Mismatch + Dynamic Contrast Guard (+1 more)

### Community 32 - "[id]/page.tsx"
Cohesion: 0.20
Nodes (6): PageProps, frontend_src_features_sources_index, frontend_src_features_sources_index_getsourcebyid, frontend_src_features_sources_index_getsourcesdata, frontend_src_features_sources_index_sourcedetailview, frontend_src_features_sources_index_sourcegrid

### Community 33 - "(dashboard)/layout.tsx"
Cohesion: 0.22
Nodes (7): dynamic, PageProps, frontend_src_features_paycheques_index, frontend_src_features_paycheques_index_getpaychequesdata, frontend_src_features_paycheques_index_paychequedialog, frontend_src_features_paycheques_index_paychequesview, frontend_src_features_sources_index_sourcedialog

### Community 34 - "UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards"
Cohesion: 0.22
Nodes (8): 1. Missing Pending State Across All 4 Dialogs & Card Actions, 2. Web Interface Guidelines Compliance, Description, Detailed Problem, Detailed Solutions, Target Snippet (`paycheque-dialog.tsx`), UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards, Verification Criteria

### Community 35 - "import_logs.py"
Cohesion: 0.21
Nodes (18): compact_parse_response(), compact_submitted_rows(), get_import_log(), list_import_logs(), list_linked_import_ids(), Any, AsyncSession, Structured trace collector and SQLite persistence for import pipeline telemetry. (+10 more)

### Community 36 - "Detailed Solutions"
Cohesion: 0.22
Nodes (8): DashboardLayout(), Description, Detailed Problem, Detailed Solutions, `frontend/src/app/(dashboard)/loading.tsx:1-8`, `frontend/src/app/(dashboard)/sources/[id]/loading.tsx:1-8`, UI Audit 09 — Structural Loading Skeletons & CLS Prevention, Verification Criteria

### Community 37 - "Detailed Problem"
Cohesion: 0.25
Nodes (7): 01 — Smart Two-Mode Paystub Entry, Live Rate Preview & Batch Logging, 1. Backwards Paystub Entry Flow, 2. Non-Automatic Sync & Silent Math Mismatches, 3. Missing Live Hourly Rate Feedback, 4. Friction During Historical Batch Entry, Description, Detailed Problem

### Community 38 - "UI Audit 07 — Concentric Border Radii on Nested Surfaces"
Cohesion: 0.25
Nodes (7): 1. Inverted Radii in Modal Drawers (`4px` Outer vs. `10px` Inner), 2. Concentric Radii on Dialogs, Cards & Nested Bucket Cards, Description, Detailed Problem, Detailed Solutions, UI Audit 07 — Concentric Border Radii on Nested Surfaces, Verification Criteria

### Community 39 - "03 — Actionable "Next Paydays" & Explicit Source Pay Schedules"
Cohesion: 0.20
Nodes (9): 03 — Actionable "Next Paydays" & Explicit Source Pay Schedules, 1. Predicted Paydays Are Read-Only Dead Ends, 2. Three-Paycheque Cold Start & Rigid Median-Gap Heuristic, Description, Detailed Problem, Detailed Solutions, Solution 1: Interactive `UpcomingPaydaysList` Client Component, Solution 2: Optional Explicit Pay Frequency on Sources (+1 more)

### Community 40 - "database.py"
Cohesion: 0.22
Nodes (14): AsyncEngine, get_db(), init_db(), async_sessionmaker, AsyncSession, seed_database(), Base, Paycheque (+6 more)

### Community 41 - "list_import_pipeline_logs"
Cohesion: 0.17
Nodes (16): alias, create_paycheque(), export_paycheques_csv(), list_import_pipeline_logs(), list_paycheques(), DBDep, ge, get (+8 more)

### Community 42 - "paycheques/router.py"
Cohesion: 0.17
Nodes (11): Paycheques bounded context., delete_paycheque(), delete, PaychequeUpdate, put, update_paycheque(), ParseResponse, hashlib (+3 more)

### Community 43 - "UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay"
Cohesion: 0.29
Nodes (6): Description, Detailed Problem, Detailed Solutions, Target Implementation (`source-card.tsx`), UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay, Verification Criteria

### Community 44 - "valid_paycheque_id"
Cohesion: 0.17
Nodes (12): DBDep, description, ge, Path, valid_paycheque_id(), create_paycheque(), delete_paycheque(), get_by_id() (+4 more)

### Community 45 - "UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets"
Cohesion: 0.29
Nodes (6): 1. Inconsistent Color Picker UX Between Dialogs, Description, Detailed Problem, Detailed Solutions, UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets, Verification Criteria

### Community 46 - "_safe_csv_cell"
Cohesion: 0.20
Nodes (11): _safe_csv_cell(), 2.1 Persistent `?year=` & Responsive Mobile Nav (`navbar.tsx`, `(dashboard)/layout.tsx`), 2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import, 2.3 Streamlined `PaychequeDialog` (`paycheque-dialog.tsx`), 2.4 Explicit `pay_schedule`, Clickable `Next paydays`, 3-Step Onboarding & Goal Pace Lines, Cut / Deferred (YAGNI & Native Replacements), Guardrails, Master UI/UX, Accessibility & Feature Improvement Plan (Ponytail Edition) (+3 more)

### Community 47 - "Detailed Solutions"
Cohesion: 0.67
Nodes (3): Detailed Solutions, Target Snippet (`year-dropdown.tsx`), Verification Criteria

### Community 48 - "app/layout.tsx"
Cohesion: 0.14
Nodes (10): dmMono, metadata, outfit, viewport, YearDropdownProps, YearOption, fmt(), frontend_src_styles_globals (+2 more)

### Community 49 - "Detailed Solutions"
Cohesion: 0.20
Nodes (9): 05 — Persistent `?year=` Across Navigation & URL-Synced Ledger Filters, 1. Year Context Lost on Tab Switches, 2. Local-Only Ledger Filters & Unfiltered CSV Export, Description, Detailed Problem, Detailed Solutions, Solution 1: Preserve `?year=` in `Navbar`, Solution 2: Sync `PaychequeLedger` & `SourcePaychequeLedger` Filters to URL Query Params (+1 more)

### Community 50 - "allocation-engine.ts"
Cohesion: 0.29
Nodes (7): AggregateAllocationReport, AggregateBucketSummary, allocateCentsLargestRemainder(), AllocatedBucket, AllocationCategory, computeAggregateAllocations(), PaychequeAllocationResult

### Community 51 - "Detailed Solutions"
Cohesion: 0.40
Nodes (5): Detailed Solutions, Solution 1: Preset Confirmation Dialog + Snapshot Undo, Solution 2: Remove Duplicate CTA & Introduce `"Rebalance percentages"` Mode, Solution 3: Source Tax-Reserve Selector in the Simulator, Verification Criteria

### Community 54 - "main.py"
Cohesion: 0.18
Nodes (11): add_no_store_header(), health_check(), lifespan(), FastAPI, get, Response, collections_abc, contextlib (+3 more)

### Community 55 - "ocr_text"
Cohesion: 0.33
Nodes (6): _ocr_engine(), ocr_text(), prepare_images(), Group OCR boxes into visual rows (top-to-bottom, then left-to-right) so a line…, Returns (text, mean OCR score)., _visual_lines()

### Community 57 - "preprocess_document_image"
Cohesion: 0.40
Nodes (5): _auto_crop_paper(), _enhance_ink_contrast(), _is_dark_background(), preprocess_document_image(), EXIF-orient, auto-crop bright cheques off dark backgrounds with CLAHE, and…

### Community 58 - "Detailed Solutions"
Cohesion: 0.40
Nodes (5): Detailed Solutions, Solution 1: Two-Mode Entry Segmented Toggle (`Quick Net` vs. `Full Paystub`), Solution 2: Live Hourly Rate Preview Pill, Solution 3: `"Save & add another"` Batch Workflow, Verification Criteria

## Knowledge Gaps
- **192 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 354 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `2.2 URL-Synced Ledger Filters, Copyable Splits, Filtered Export & Idempotent CSV Import` connect `_safe_csv_cell` to `list_import_pipeline_logs`, `test_app.py`, `navbar.tsx`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Why does `Navbar()` connect `navbar.tsx` to `(dashboard)/layout.tsx`, `Detailed Solutions`, `_safe_csv_cell`, `PaychequePayload`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `ensure_schema_migrations()` connect `test_app.py` to `database.py`, `PaychequePayload`, `_safe_csv_cell`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `Source` (e.g. with `parse_paycheque_file()` and `build_export_csv()`) actually correct?**
  _`Source` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13846153846153847 - nodes in this community are weakly interconnected._