# Graph Report - Salary_Management_App  (2026-11-23)

## Corpus Check
- 124 files · ~52,577 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 897 nodes · 2443 edges · 64 communities (41 shown, 23 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 173 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22763cf4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- utils.ts
- test_app.py
- paycheques/schemas.py
- paycheques/service.py
- SourcePayload
- AllocationRulePayload
- package.json
- import-dialog.tsx
- PaychequePayload
- Source
- Docker Compose backend Service
- compilerOptions
- dialog-provider.tsx
- paycheques/index.ts
- src/exceptions.py
- frontend_src_features_overview_index_getoverviewdata
- import-log-types.ts
- paycheques/router.py
- AGENTS.md — Payday (Salary & Income Management App)
- src/__init__.py
- next-env.d.ts
- parsers.py
- parse_paycheque_file
- payday-backend
- Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation
- extractors.py
- overview-charts.tsx
- payday.ts
- add_no_store_header
- sources/index.ts
- import-log-detail-view.tsx
- sources/schemas.py
- import_logs.py
- parse_upload
- parse_cents
- logs/[id]/page.tsx
- logs/page.tsx
- useDialogs
- AllocationsDashboard
- next
- Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads
- valid_paycheque_id
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
- `Root cause` --references--> `ImportLogDetailView()`  [INFERRED]
  docs/solutions/ui-bugs/nextjs-15-rsc-multi-chunk-sync-ping-deadlock.md → frontend/src/features/paycheques/components/import-log-detail-view.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (64 total, 23 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.15
Nodes (9): dynamic, proxy(), RouteContext, UpdateGoalInput, updateGoalSchema, FALLBACK_URLS, env, envSchema (+1 more)

### Community 1 - "utils.ts"
Cohesion: 0.16
Nodes (27): Solution, Why This Works, OverviewPage(), PageProps, PageProps, SourceDetailPage(), PageProps, TaxesPage() (+19 more)

### Community 2 - "test_app.py"
Cohesion: 0.06
Nodes (51): 3. Project map, AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, field_validator, ensure_schema_migrations() (+43 more)

### Community 3 - "paycheques/schemas.py"
Cohesion: 0.22
Nodes (18): AllocationRuleResponse, CustomModel, PaychequeResponse, Settings and aggregate state bounded context., Setting, get_state(), DBDep, get (+10 more)

### Community 4 - "paycheques/service.py"
Cohesion: 0.16
Nodes (25): BadRequestError, Paycheque, import_paycheques(), PaychequeImportPayload, PaychequeImportResponse, build_export_csv(), _commit_paycheque(), compute_paycheque_import_hash() (+17 more)

### Community 5 - "SourcePayload"
Cohesion: 0.35
Nodes (4): Any, field_validator, model_validator, SourcePayload

### Community 6 - "AllocationRulePayload"
Cohesion: 0.09
Nodes (27): AllocationPresetPayload, AllocationRule, AllocationRulePayload, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum() (+19 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (30): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+22 more)

### Community 8 - "import-dialog.tsx"
Cohesion: 0.09
Nodes (23): Skeleton(), importPaychequesAction(), PaychequeImportResult, DOT_CLASS, fileKind(), formatSize(), ImportDialog(), handleFile() (+15 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.10
Nodes (22): 4. Invariants (do not break), PaychequePayload, Any, field_validator, model_validator, parse_optional_cents(), 1. Executive Summary, 2. System Architecture & Tech Stack (+14 more)

### Community 10 - "Source"
Cohesion: 0.14
Nodes (24): Source, create_source(), delete_source(), list_sources(), DBDep, delete, get, post (+16 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "dialog-provider.tsx"
Cohesion: 0.16
Nodes (14): dynamic, HASH_ROUTES, NAV_ITEMS, NavbarSearchParamsSync(), NavLinks(), withYearParam(), DialogContext, DialogProvider() (+6 more)

### Community 14 - "paycheques/index.ts"
Cohesion: 0.35
Nodes (7): DashboardLayout(), PageProps, PaychequesPage(), PaychequesView(), getPaychequesData, PaychequeFilterParams, PaychequesPageData

### Community 15 - "src/exceptions.py"
Cohesion: 0.11
Nodes (22): AppError, ConflictError, NotFoundError, FastAPI, register_exception_handlers(), ErrorCode, StrEnum, FileTooLarge (+14 more)

### Community 17 - "import-log-types.ts"
Cohesion: 0.31
Nodes (7): ImportLogFilterParams, ImportLogParser, ImportLogStage, ImportLogStatus, ImportLogStep, ImportPipelineLogDetail, ImportPipelineLogSummary

### Community 18 - "paycheques/router.py"
Cohesion: 0.13
Nodes (27): AsyncEngine, get_db(), init_db(), async_sessionmaker, AsyncSession, seed_database(), health_check(), lifespan() (+19 more)

### Community 19 - "AGENTS.md — Payday (Salary & Income Management App)"
Cohesion: 0.04
Nodes (42): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 5. Skills (load when relevant), 6. Capture problems, decisions, and feature specs, 7. Verify before you say "done", 8. Git commits, AGENTS.md — Payday (Salary & Income Management App), Concepts (+34 more)

### Community 23 - "parsers.py"
Cohesion: 0.15
Nodes (17): UnsupportedFileType, truncate_text(), _deterministic_text_row(), _fields_from_summary_lines(), _fields_from_tables(), _infer_source_name(), is_cheque_text(), _norm_cell() (+9 more)

### Community 24 - "parse_paycheque_file"
Cohesion: 0.18
Nodes (13): create_paycheque(), delete_paycheque(), list_paycheques(), parse_paycheque_file(), DBDep, delete, PaychequeCreate, PaychequeUpdate (+5 more)

### Community 27 - "Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation"
Cohesion: 0.40
Nodes (4): Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation, Prevention / Guardrail, Problem / Symptom, Root cause

### Community 28 - "extractors.py"
Cohesion: 0.10
Nodes (28): _auto_crop_paper(), _compact_for_llm(), _encode_vision_jpeg_b64(), _enhance_ink_contrast(), _is_dark_background(), _llm(), llm_available(), llm_extract() (+20 more)

### Community 29 - "overview-charts.tsx"
Cohesion: 0.48
Nodes (10): configureChartDefaults(), CumulativeIncomeChart(), getChartMonths(), MonthlyIncomeChart(), SourceSplitChart(), SourceIncomeChart(), formatDollars(), pad() (+2 more)

### Community 30 - "payday.ts"
Cohesion: 0.11
Nodes (31): DialogContextValue, YearDropdownProps, YearOption, AllocationsDashboardProps, CATEGORY_LABELS, PRESET_CARDS, CumulativeChartProps, MonthlyChartProps (+23 more)

### Community 31 - "add_no_store_header"
Cohesion: 0.50
Nodes (4): add_no_store_header(), Response, middleware, Request

### Community 32 - "sources/index.ts"
Cohesion: 0.23
Nodes (10): SourcesPage(), SourceCardShell(), SourceGrid(), getSourcesData, SourceCardSummary, SparkItem, SparkYearSpan, KIND_LABELS (+2 more)

### Community 33 - "import-log-detail-view.tsx"
Cohesion: 0.22
Nodes (19): Solution, asNumber(), asString(), DEFAULT_OPEN_STEPS, ImportLogDetailView(), isRecord(), ReturnedOutputCard(), STEP_BAR_COLORS (+11 more)

### Community 34 - "sources/schemas.py"
Cohesion: 0.26
Nodes (9): parse_tax_reserve_bps(), Validates range 0 <= bps <= 6000 (0% to 60%)., ErrorCode, PaySchedule, StrEnum, SourceKind, decimal, enum (+1 more)

### Community 35 - "import_logs.py"
Cohesion: 0.14
Nodes (26): alias, compact_parse_response(), compact_submitted_rows(), get_import_log(), list_import_logs(), list_linked_import_ids(), Any, AsyncSession (+18 more)

### Community 36 - "parse_upload"
Cohesion: 0.29
Nodes (10): vision_available(), PipelineTrace, In-memory collector of ordered intermediate parser step outputs., _llm_fallback_for_text(), parse_upload(), Returns (row, used_llm). Runs deterministic rules first and only calls the…, row_from_text(), _try_vision_parse() (+2 more)

### Community 37 - "parse_cents"
Cohesion: 0.14
Nodes (24): check_row(), cents(), clean_date(), clean_hours(), clean_money(), _clean_text(), _match_known_source(), parse_table() (+16 more)

### Community 38 - "logs/[id]/page.tsx"
Cohesion: 0.67
Nodes (3): ImportLogDetailPage(), PageProps, getImportLogById

### Community 39 - "logs/page.tsx"
Cohesion: 0.67
Nodes (3): ImportLogsPage(), PageProps, getImportLogs

### Community 40 - "useDialogs"
Cohesion: 0.24
Nodes (20): useDialogs(), YearDropdown(), HeroTotalCounter(), LatestPaychequesList(), UpcomingPaydaysList(), normalizeYearFilter(), PaychequeLedger(), AddSourceButton() (+12 more)

### Community 41 - "AllocationsDashboard"
Cohesion: 0.24
Nodes (12): AllocationsPage(), PageProps, applyAllocationPresetAction(), deleteAllocationRuleAction(), saveAllocationRuleAction(), AllocationsDashboard(), handleApplyPreset(), handleDeleteRule() (+4 more)

### Community 42 - "next"
Cohesion: 0.14
Nodes (16): updateGoalAction(), GoalDialogTrigger(), deleteSourceAction(), saveSourceAction(), SourceDialog(), deleteSrc(), submitSrc(), SourceFormState (+8 more)

### Community 43 - "Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads"
Cohesion: 0.25
Nodes (8): pdf_extract(), Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads, Prevention, Problem, Related Issues, Symptoms, What Didn't Work, Why This Works

### Community 45 - "valid_paycheque_id"
Cohesion: 0.40
Nodes (5): DBDep, description, ge, Path, valid_paycheque_id()

### Community 48 - "app/layout.tsx"
Cohesion: 0.29
Nodes (5): dmMono, metadata, outfit, viewport, frontend_src_styles_globals

### Community 50 - "paycheque-dialog.tsx"
Cohesion: 0.19
Nodes (14): deletePaychequeAction(), savePaychequeAction(), PaychequeDialog(), buildSavedToast(), deletePay(), handleSave(), submitPay(), PaychequeFormState (+6 more)

## Knowledge Gaps
- **140 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+135 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 294 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `3. Comprehensive Feature Breakdown` connect `PaychequePayload` to `useDialogs`?**
  _High betweenness centrality (0.371) - this node is a cross-community bridge._
- **Why does `_safe_csv_cell()` connect `paycheques/service.py` to `PaychequePayload`?**
  _High betweenness centrality (0.328) - this node is a cross-community bridge._
- **Why does `3.2. Paycheques Ledger (`/paycheques`)` connect `PaychequePayload` to `paycheques/service.py`?**
  _High betweenness centrality (0.324) - this node is a cross-community bridge._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _140 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.061343204653622425 - nodes in this community are weakly interconnected._
- **Should `AllocationRulePayload` be split into smaller, more focused modules?**
  _Cohesion score 0.09269162210338681 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._