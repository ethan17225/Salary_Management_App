# Graph Report - Salary_Management_App  (2026-11-23)

## Corpus Check
- 124 files · ~57,696 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 938 nodes · 2566 edges · 59 communities (35 shown, 24 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 185 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `419226a9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- next
- sumCents
- test_app.py
- CustomModel
- paycheques/router.py
- SourcePayload
- allocations.py
- package.json
- import-dialog.tsx
- PaychequePayload
- Source
- Docker Compose backend Service
- compilerOptions
- cn
- import-paycheques.ts
- main.py
- frontend_src_features_overview_index_getoverviewdata
- paycheques/exceptions.py
- database.py
- AGENTS.md — Payday (Salary & Income Management App)
- src/__init__.py
- next-env.d.ts
- sources/router.py
- db.ts
- payday-backend
- utils.ts
- extractors.py
- Source
- sources/index.ts
- add_no_store_header
- skeleton.tsx
- paycheques/index.ts
- AllocationRulePayload
- import_logs.py
- parsers.py
- useDialogs
- AllocationsDashboard
- payday.ts
- frontend_src_features_allocations_index_allocationsdashboard
- app/layout.tsx
- frontend_src_features_overview_index_overviewdashboard
- paycheque-dialog.tsx
- frontend_src_features_paycheques_index_getimportlogbyid
- postcss.config.mjs
- zoneinfo
- frontend_src_features_paycheques_index_getimportlogs
- frontend_src_features_paycheques_index_getpaychequesdata
- frontend_src_features_paycheques_index_importlogdetailview
- frontend_src_features_paycheques_index_importlogsview
- frontend_src_features_paycheques_index_paychequedialog
- frontend_src_features_paycheques_index_paychequesview
- frontend_src_features_sources_index_getsourcebyid
- frontend_src_features_sources_index_getsourcesdata
- frontend_src_features_sources_index_sourcedetailview
- frontend_src_features_sources_index_sourcedialog
- frontend_src_features_sources_index_sourcegrid
- frontend_src_features_taxes_index_taxesdashboard

## God Nodes (most connected - your core abstractions)
1. `Source` - 33 edges
2. `useDialogs()` - 32 edges
3. `react` - 31 edges
4. `Paycheque` - 31 edges
5. `fmt()` - 29 edges
6. `CustomModel` - 25 edges
7. `next` - 24 edges
8. `cn()` - 23 edges
9. `dateLabel()` - 23 edges
10. `parse_cents()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Technology Highlights` --references--> `ensure_schema_migrations()`  [INFERRED]
  PROJECT_OVERVIEW.md → backend/src/database.py
- `Symptoms` --references--> `validate_paystub_breakdown()`  [INFERRED]
  docs/solutions/logic-errors/corrupted-payroll-pdf-and-vlm-withholding-reconciliation.md → backend/src/paycheques/utils.py
- `Problem` --references--> `YearDropdown()`  [INFERRED]
  docs/solutions/ui-bugs/year-dropdown-multi-click-stall-and-popover-sizing.md → frontend/src/components/ui/year-dropdown.tsx
- `Symptoms` --references--> `SourceDetailView()`  [INFERRED]
  docs/solutions/ui-bugs/nextjs-15-rsc-multi-chunk-sync-ping-deadlock.md → frontend/src/features/sources/components/source-detail-view.tsx
- `3. Project map` --references--> `ensure_schema_migrations()`  [INFERRED]
  AGENTS.md → backend/src/database.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (59 total, 24 thin omitted)

### Community 0 - "next"
Cohesion: 0.18
Nodes (9): deletePaychequeSchema, optionalMoneySchema, SavePaychequeInput, savePaychequeSchema, deleteSourceSchema, SaveSourceInput, saveSourceSchema, ActionState (+1 more)

### Community 1 - "sumCents"
Cohesion: 0.17
Nodes (24): Solution, Why This Works, OverviewPage(), PageProps, PageProps, SourceDetailPage(), Navbar(), YearOption (+16 more)

### Community 2 - "test_app.py"
Cohesion: 0.06
Nodes (55): 3. Project map, AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, field_validator, ensure_schema_migrations() (+47 more)

### Community 3 - "CustomModel"
Cohesion: 0.19
Nodes (20): AllocationRuleResponse, CustomModel, ErrorResponse, OkResponse, Paycheques bounded context., PaychequeResponse, Settings and aggregate state bounded context., get_state() (+12 more)

### Community 4 - "paycheques/router.py"
Cohesion: 0.11
Nodes (34): BadRequestError, delete_paycheque(), import_paycheques(), delete, PaychequeUpdate, put, update_paycheque(), PaychequeImportPayload (+26 more)

### Community 5 - "SourcePayload"
Cohesion: 0.35
Nodes (4): Any, field_validator, model_validator, SourcePayload

### Community 6 - "allocations.py"
Cohesion: 0.14
Nodes (25): AllocationPresetPayload, AllocationRule, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum(), get_allocations() (+17 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (30): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+22 more)

### Community 8 - "import-dialog.tsx"
Cohesion: 0.14
Nodes (15): importPaychequesAction(), DOT_CLASS, fileKind(), formatSize(), ImportDialog(), handleFile(), handleImport(), MONEY_FIELDS (+7 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.10
Nodes (20): 4. Invariants (do not break), PaychequePayload, Any, field_validator, model_validator, 1. Executive Summary, 2. System Architecture & Tech Stack, 3.2. Paycheques Ledger (`/paycheques`) (+12 more)

### Community 10 - "Source"
Cohesion: 0.14
Nodes (26): ConflictError, parse_tax_reserve_bps(), Validates range 0 <= bps <= 6000 (0% to 60%)., ErrorCode, PaySchedule, StrEnum, SourceKind, DBDep (+18 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "cn"
Cohesion: 0.22
Nodes (9): dynamic, HASH_ROUTES, NAV_ITEMS, NavbarSearchParamsSync(), NavLinks(), withYearParam(), DialogProvider(), CopyJsonButton() (+1 more)

### Community 14 - "import-paycheques.ts"
Cohesion: 0.27
Nodes (7): PaychequeImportResult, importRowSchema, importRowsSchema, Nullable, ParsedRow, ParseResponse, toCents()

### Community 15 - "main.py"
Cohesion: 0.14
Nodes (12): FastAPI, register_exception_handlers(), health_check(), lifespan(), FastAPI, get, collections_abc, contextlib (+4 more)

### Community 17 - "paycheques/exceptions.py"
Cohesion: 0.16
Nodes (15): AppError, NotFoundError, ErrorCode, StrEnum, DBDep, description, ge, Path (+7 more)

### Community 18 - "database.py"
Cohesion: 0.18
Nodes (18): AsyncEngine, get_db(), init_db(), async_sessionmaker, AsyncSession, seed_database(), Base, Paycheque (+10 more)

### Community 19 - "AGENTS.md — Payday (Salary & Income Management App)"
Cohesion: 0.04
Nodes (41): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 5. Skills (load when relevant), 6. Capture problems, decisions, and feature specs, 7. Verify before you say "done", 8. Git commits, AGENTS.md — Payday (Salary & Income Management App), Concepts (+33 more)

### Community 23 - "sources/router.py"
Cohesion: 0.17
Nodes (13): Sources bounded context., create_source(), delete_source(), list_sources(), DBDep, delete, get, post (+5 more)

### Community 24 - "db.ts"
Cohesion: 0.14
Nodes (12): dynamic, proxy(), RouteContext, AllocationsPage(), PageProps, UpdateGoalInput, updateGoalSchema, db (+4 more)

### Community 27 - "utils.ts"
Cohesion: 0.26
Nodes (11): PageProps, TaxesPage(), TaxesDashboard(), computeAggregateTaxSummary(), addDays(), addMonthsClamped(), CAD, iso() (+3 more)

### Community 28 - "extractors.py"
Cohesion: 0.09
Nodes (31): _auto_crop_paper(), _compact_for_llm(), _encode_vision_jpeg_b64(), _enhance_ink_contrast(), _is_dark_background(), _llm(), llm_available(), llm_extract() (+23 more)

### Community 29 - "Source"
Cohesion: 0.18
Nodes (24): DialogContext, DialogContextValue, PaychequeDialogRequest, PaychequePrefill, SourceDialogRequest, ToastState, configureChartDefaults(), CumulativeChartProps (+16 more)

### Community 30 - "sources/index.ts"
Cohesion: 0.27
Nodes (8): SourcesPage(), SourceCardShell(), SourceGrid(), getSourcesData, SourceCardSummary, SparkItem, SparkYearSpan, MONTHS

### Community 31 - "add_no_store_header"
Cohesion: 0.50
Nodes (4): add_no_store_header(), Response, middleware, Request

### Community 33 - "paycheques/index.ts"
Cohesion: 0.08
Nodes (47): Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation, Prevention, Problem, Related Issues, Root Cause, Solution, Symptoms, What Didn't Work (+39 more)

### Community 34 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 35 - "import_logs.py"
Cohesion: 0.11
Nodes (34): alias, compact_parse_response(), compact_submitted_rows(), get_import_log(), list_import_logs(), list_linked_import_ids(), Any, AsyncSession (+26 more)

### Community 37 - "parsers.py"
Cohesion: 0.06
Nodes (75): vision_available(), PipelineTrace, In-memory collector of ordered intermediate parser step outputs., truncate_text(), check_row(), cents(), clean_date(), clean_hours() (+67 more)

### Community 40 - "useDialogs"
Cohesion: 0.24
Nodes (19): What Didn't Work, useDialogs(), YearDropdown(), YearDropdownProps, HeroTotalCounter(), LatestPaychequesList(), UpcomingPaydaysList(), normalizeYearFilter() (+11 more)

### Community 41 - "AllocationsDashboard"
Cohesion: 0.32
Nodes (10): applyAllocationPresetAction(), deleteAllocationRuleAction(), saveAllocationRuleAction(), AllocationsDashboard(), handleApplyPreset(), handleDeleteRule(), handleSaveRule(), handleToggleActive() (+2 more)

### Community 42 - "payday.ts"
Cohesion: 0.14
Nodes (19): AllocationsDashboardProps, CATEGORY_LABELS, PRESET_CARDS, updateGoalAction(), GoalDialogTrigger(), PaychequeLedgerProps, deleteSourceAction(), saveSourceAction() (+11 more)

### Community 48 - "app/layout.tsx"
Cohesion: 0.29
Nodes (5): dmMono, metadata, outfit, viewport, frontend_src_styles_globals

### Community 50 - "paycheque-dialog.tsx"
Cohesion: 0.14
Nodes (20): deletePaychequeAction(), savePaychequeAction(), PaychequeDialog(), buildSavedToast(), deletePay(), handleSave(), submitPay(), PaychequeFormState (+12 more)

## Knowledge Gaps
- **141 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 311 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `3. Comprehensive Feature Breakdown` connect `PaychequePayload` to `useDialogs`, `payday.ts`?**
  _High betweenness centrality (0.375) - this node is a cross-community bridge._
- **Why does `_safe_csv_cell()` connect `paycheques/router.py` to `PaychequePayload`?**
  _High betweenness centrality (0.335) - this node is a cross-community bridge._
- **Why does `3.2. Paycheques Ledger (`/paycheques`)` connect `PaychequePayload` to `paycheques/router.py`?**
  _High betweenness centrality (0.330) - this node is a cross-community bridge._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `paycheques/router.py` be split into smaller, more focused modules?**
  _Cohesion score 0.11336032388663968 - nodes in this community are weakly interconnected._
- **Should `allocations.py` be split into smaller, more focused modules?**
  _Cohesion score 0.13538461538461538 - nodes in this community are weakly interconnected._