# Graph Report - Salary_Management_App  (2026-11-21)

## Corpus Check
- 123 files · ~52,077 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 891 nodes · 2429 edges · 66 communities (42 shown, 24 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 166 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `204d98f8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- utils.ts
- test_app.py
- CustomModel
- paycheques/service.py
- AllocationRulePayload
- allocations.py
- package.json
- import-dialog.tsx
- PaychequePayload
- Source
- Docker Compose backend Service
- compilerOptions
- dialog-provider.tsx
- paycheque-ledger.tsx
- src/exceptions.py
- frontend_src_features_overview_index_getoverviewdata
- skeleton.tsx
- database.py
- AGENTS.md — Payday (Salary & Income Management App)
- src/__init__.py
- next-env.d.ts
- parsers.py
- list_import_pipeline_logs
- payday-backend
- sources/router.py
- extractors.py
- overview-charts.tsx
- Source
- main.py
- payday.ts
- paycheques/index.ts
- paycheques/router.py
- import_logs.py
- parse_upload
- ParsedPaychequeRow
- parse_cents
- import-paycheques.ts
- useDialogs
- actions.ts
- next
- Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads
- Hero YearDropdown multi-click navigation stall, popover sizing mismatch, and missing Net label
- valid_paycheque_id
- route.ts
- frontend_src_features_allocations_index_allocationsdashboard
- app/layout.tsx
- frontend_src_features_overview_index_overviewdashboard
- allocations-dashboard.tsx
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
10. `plural()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Technology Highlights` --references--> `ensure_schema_migrations()`  [INFERRED]
  PROJECT_OVERVIEW.md → backend/src/database.py
- `Problem` --references--> `parse_upload()`  [INFERRED]
  docs/solutions/logic-errors/corrupted-payroll-pdf-and-vlm-withholding-reconciliation.md → backend/src/paycheques/parsers.py
- `Symptoms` --references--> `validate_paystub_breakdown()`  [INFERRED]
  docs/solutions/logic-errors/corrupted-payroll-pdf-and-vlm-withholding-reconciliation.md → backend/src/paycheques/utils.py
- `Problem` --references--> `YearDropdown()`  [INFERRED]
  docs/solutions/ui-bugs/year-dropdown-multi-click-stall-and-popover-sizing.md → frontend/src/components/ui/year-dropdown.tsx
- `3. Project map` --references--> `ensure_schema_migrations()`  [INFERRED]
  AGENTS.md → backend/src/database.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (66 total, 24 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.18
Nodes (10): AllocationsPage(), PageProps, deleteSourceSchema, SaveSourceInput, saveSourceSchema, db, FALLBACK_URLS, env (+2 more)

### Community 1 - "utils.ts"
Cohesion: 0.17
Nodes (26): Solution, Why This Works, OverviewPage(), PageProps, PageProps, SourceDetailPage(), Navbar(), OverviewDashboard() (+18 more)

### Community 2 - "test_app.py"
Cohesion: 0.06
Nodes (51): 3. Project map, AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, field_validator, ensure_schema_migrations() (+43 more)

### Community 3 - "CustomModel"
Cohesion: 0.17
Nodes (23): AllocationRuleResponse, Base, CustomModel, ErrorResponse, PaychequeResponse, Settings and aggregate state bounded context., Setting, get_state() (+15 more)

### Community 4 - "paycheques/service.py"
Cohesion: 0.19
Nodes (22): BadRequestError, Paycheque, import_paycheques(), PaychequeImportResponse, build_export_csv(), _commit_paycheque(), compute_paycheque_import_hash(), create_paycheque() (+14 more)

### Community 5 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 6 - "allocations.py"
Cohesion: 0.16
Nodes (22): AllocationPresetPayload, AllocationRule, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum(), get_allocations() (+14 more)

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
Cohesion: 0.10
Nodes (30): parse_tax_reserve_bps(), Validates range 0 <= bps <= 6000 (0% to 60%)., ErrorCode, PaySchedule, StrEnum, SourceKind, DBDep, description (+22 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "dialog-provider.tsx"
Cohesion: 0.16
Nodes (14): HASH_ROUTES, NAV_ITEMS, NavbarSearchParamsSync(), NavLinks(), withYearParam(), DialogContext, DialogContextValue, DialogProvider() (+6 more)

### Community 14 - "paycheque-ledger.tsx"
Cohesion: 0.19
Nodes (16): PageProps, TaxesPage(), normalizeYearFilter(), PaychequeLedger(), SourcePaychequeLedger(), TaxesDashboard(), AggregateTaxSummary, computeAggregateTaxSummary() (+8 more)

### Community 15 - "src/exceptions.py"
Cohesion: 0.15
Nodes (14): AppError, ConflictError, NotFoundError, FastAPI, register_exception_handlers(), ErrorCode, StrEnum, FileTooLarge (+6 more)

### Community 18 - "database.py"
Cohesion: 0.18
Nodes (11): get_db(), AsyncSession, seed_database(), Paycheques bounded context., fastapi, pathlib, pydantic_settings, sqlalchemy (+3 more)

### Community 19 - "AGENTS.md — Payday (Salary & Income Management App)"
Cohesion: 0.05
Nodes (36): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 5. Skills (load when relevant), 6. Capture problems, decisions, and feature specs, 7. Verify before you say "done", 8. Git commits, AGENTS.md — Payday (Salary & Income Management App), Concepts (+28 more)

### Community 23 - "parsers.py"
Cohesion: 0.16
Nodes (16): UnsupportedFileType, _deterministic_text_row(), _fields_from_summary_lines(), _fields_from_tables(), _infer_source_name(), is_cheque_text(), _norm_cell(), parse_written_amount() (+8 more)

### Community 24 - "list_import_pipeline_logs"
Cohesion: 0.17
Nodes (16): alias, delete_paycheque(), export_paycheques_csv(), list_import_pipeline_logs(), list_paycheques(), DBDep, delete, ge (+8 more)

### Community 27 - "sources/router.py"
Cohesion: 0.17
Nodes (14): CreatedResponse, Sources bounded context., create_source(), delete_source(), list_sources(), DBDep, delete, get (+6 more)

### Community 28 - "extractors.py"
Cohesion: 0.10
Nodes (27): _auto_crop_paper(), _compact_for_llm(), _encode_vision_jpeg_b64(), _enhance_ink_contrast(), _is_dark_background(), _llm(), llm_extract(), _ocr_engine() (+19 more)

### Community 29 - "overview-charts.tsx"
Cohesion: 0.48
Nodes (10): configureChartDefaults(), CumulativeIncomeChart(), getChartMonths(), MonthlyIncomeChart(), SourceSplitChart(), SourceIncomeChart(), formatDollars(), pad() (+2 more)

### Community 30 - "Source"
Cohesion: 0.26
Nodes (15): YearOption, AllocationsDashboardProps, CumulativeChartProps, MonthlyChartProps, SplitChartProps, OverviewData, PaychequeLedgerProps, SourceIncomeChartProps (+7 more)

### Community 31 - "main.py"
Cohesion: 0.16
Nodes (14): AsyncEngine, init_db(), async_sessionmaker, add_no_store_header(), health_check(), lifespan(), FastAPI, get (+6 more)

### Community 32 - "payday.ts"
Cohesion: 0.15
Nodes (18): SourcesPage(), deleteSourceAction(), saveSourceAction(), SourceCardShell(), SourceDialog(), deleteSrc(), submitSrc(), SourceFormState (+10 more)

### Community 33 - "paycheques/index.ts"
Cohesion: 0.09
Nodes (39): DashboardLayout(), dynamic, ImportLogDetailPage(), PageProps, ImportLogsPage(), PageProps, PageProps, PaychequesPage() (+31 more)

### Community 34 - "paycheques/router.py"
Cohesion: 0.21
Nodes (13): create_paycheque(), parse_paycheque_file(), PaychequeCreate, post, ImportPipelineLogDetail, ImportPipelineLogSummary, ParseResponse, PaychequeImportPayload (+5 more)

### Community 35 - "import_logs.py"
Cohesion: 0.22
Nodes (16): compact_parse_response(), compact_submitted_rows(), get_import_log(), list_import_logs(), list_linked_import_ids(), Any, AsyncSession, Structured trace collector and SQLite persistence for import pipeline telemetry. (+8 more)

### Community 36 - "parse_upload"
Cohesion: 0.24
Nodes (12): llm_available(), vision_available(), PipelineTrace, In-memory collector of ordered intermediate parser step outputs., truncate_text(), _llm_fallback_for_text(), parse_upload(), Returns (row, used_llm). Runs deterministic rules first and only calls the… (+4 more)

### Community 37 - "ParsedPaychequeRow"
Cohesion: 0.22
Nodes (13): check_row(), cents(), clean_date(), clean_hours(), _clean_text(), _match_known_source(), parse_table(), Apply cheque sanity guards and flag review items in exact integer cents. (+5 more)

### Community 38 - "parse_cents"
Cohesion: 0.24
Nodes (10): clean_money(), $1,842.5 CAD' or '(150.00)' -> '1842.50' / '150.00', in exact cents via…, Drop tax/deductions if a tiny LLM copied net pay into them and broke gross -…, _reconcile_vision_withholdings(), cents(), _sanitize_llm_fields(), parse_cents(), Any (+2 more)

### Community 39 - "import-paycheques.ts"
Cohesion: 0.27
Nodes (7): PaychequeImportResult, importRowSchema, importRowsSchema, Nullable, ParsedRow, ParseResponse, toCents()

### Community 40 - "useDialogs"
Cohesion: 0.22
Nodes (16): What Didn't Work, useDialogs(), YearDropdown(), YearDropdownProps, updateGoalAction(), GoalDialogTrigger(), HeroTotalCounter(), LatestPaychequesList() (+8 more)

### Community 41 - "actions.ts"
Cohesion: 0.30
Nodes (9): applyAllocationPresetAction(), deleteAllocationRuleAction(), saveAllocationRuleAction(), handleApplyPreset(), handleDeleteRule(), handleSaveRule(), handleToggleActive(), allocationPresetSchema (+1 more)

### Community 42 - "next"
Cohesion: 0.19
Nodes (8): UpdateGoalInput, updateGoalSchema, deletePaychequeSchema, optionalMoneySchema, SavePaychequeInput, savePaychequeSchema, ActionState, next

### Community 43 - "Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads"
Cohesion: 0.25
Nodes (8): pdf_extract(), Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads, Prevention, Problem, Related Issues, Symptoms, What Didn't Work, Why This Works

### Community 44 - "Hero YearDropdown multi-click navigation stall, popover sizing mismatch, and missing Net label"
Cohesion: 0.33
Nodes (5): Hero YearDropdown multi-click navigation stall, popover sizing mismatch, and missing Net label, Prevention, Problem, Related Issues, Symptoms

### Community 45 - "valid_paycheque_id"
Cohesion: 0.40
Nodes (5): DBDep, description, ge, Path, valid_paycheque_id()

### Community 46 - "route.ts"
Cohesion: 0.50
Nodes (3): dynamic, proxy(), RouteContext

### Community 48 - "app/layout.tsx"
Cohesion: 0.29
Nodes (5): dmMono, metadata, outfit, viewport, frontend_src_styles_globals

### Community 50 - "allocations-dashboard.tsx"
Cohesion: 0.14
Nodes (19): AllocationsDashboard(), CATEGORY_LABELS, PRESET_CARDS, deletePaychequeAction(), savePaychequeAction(), PaychequeDialog(), buildSavedToast(), deletePay() (+11 more)

## Knowledge Gaps
- **138 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+133 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 293 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `3. Comprehensive Feature Breakdown` connect `PaychequePayload` to `useDialogs`?**
  _High betweenness centrality (0.404) - this node is a cross-community bridge._
- **Why does `_safe_csv_cell()` connect `paycheques/service.py` to `PaychequePayload`?**
  _High betweenness centrality (0.357) - this node is a cross-community bridge._
- **Why does `3.2. Paycheques Ledger (`/paycheques`)` connect `PaychequePayload` to `paycheques/service.py`?**
  _High betweenness centrality (0.353) - this node is a cross-community bridge._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _138 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.061343204653622425 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `import-dialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._