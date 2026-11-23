# Graph Report - Salary_Management_App  (2026-11-23)

## Corpus Check
- 125 files · ~60,963 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 970 nodes · 2644 edges · 69 communities (45 shown, 24 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 186 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `419226a9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- parse_table_with_sheets
- sumCents
- test_app.py
- CustomModel
- paycheques/service.py
- SourcePayload
- allocations.py
- package.json
- import-dialog.tsx
- PaychequePayload
- Source
- Docker Compose backend Service
- compilerOptions
- cn
- parsers.py
- paycheques/router.py
- frontend_src_features_overview_index_getoverviewdata
- src/exceptions.py
- database.py
- AGENTS.md — Payday (Salary & Income Management App)
- src/__init__.py
- next-env.d.ts
- parse_cents
- payday.ts
- payday-backend
- taxes-dashboard.tsx
- extractors.py
- Source
- utils.ts
- add_no_store_header
- overview-charts.tsx
- paycheques/index.ts
- AllocationRulePayload
- import_logs.py
- check_row
- parse_upload
- config.py
- validate_paystub_breakdown
- useDialogs
- ensure_schema_migrations
- _HtmlTableParser
- db_session_factory
- valid_paycheque_id
- sources/constants.py
- test_corrupted_adp_pdf_escalates_to_vision_and_reconciles_withholdings
- frontend_src_features_allocations_index_allocationsdashboard
- test_vision_ocr_cheque_cross_check_and_rapidocr_fallback
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
- allocate_cents_largest_remainder
- test_parse_pdf_ocr_escalation_and_llm_fallback
- parse_written_amount

## God Nodes (most connected - your core abstractions)
1. `Source` - 33 edges
2. `useDialogs()` - 32 edges
3. `react` - 31 edges
4. `Paycheque` - 31 edges
5. `fmt()` - 29 edges
6. `CustomModel` - 26 edges
7. `parse_table_with_sheets()` - 26 edges
8. `next` - 24 edges
9. `parse_cents()` - 23 edges
10. `cn()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Technology Highlights` --references--> `ensure_schema_migrations()`  [INFERRED]
  PROJECT_OVERVIEW.md → backend/src/database.py
- `Problem` --references--> `parse_upload()`  [INFERRED]
  docs/solutions/logic-errors/corrupted-payroll-pdf-and-vlm-withholding-reconciliation.md → backend/src/paycheques/parsers.py
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

## Communities (69 total, 24 thin omitted)

### Community 0 - "parse_table_with_sheets"
Cohesion: 0.15
Nodes (21): clean_date(), _clean_day(), clean_hours(), _clean_month(), _clean_text(), _clean_year(), _infer_headerless_columns(), _is_banner_row() (+13 more)

### Community 1 - "sumCents"
Cohesion: 0.29
Nodes (9): OverviewPage(), PageProps, YearDropdownProps, YearOption, computeOverviewYearSlice(), getOverviewData, OverviewData, sumCents() (+1 more)

### Community 2 - "test_app.py"
Cohesion: 0.14
Nodes (30): AsyncClient, asyncio, Async integration tests for Payday FastAPI backend., test_allocation_crud_and_100_percent_cap(), test_allocation_presets_endpoint(), test_create_paycheque_with_paystub_breakdown(), test_deposit_mode_etransfer_cra_and_vision(), test_excel_multisheet_banners_totals_multicolumn_and_serial_dates() (+22 more)

### Community 3 - "CustomModel"
Cohesion: 0.18
Nodes (20): AllocationRuleResponse, CustomModel, ParsedSheetPreview, PaychequeResponse, Raw grid preview & inferred column/row config for interactive Excel/CSV mapping., Settings and aggregate state bounded context., get_state(), DBDep (+12 more)

### Community 4 - "paycheques/service.py"
Cohesion: 0.14
Nodes (29): BadRequestError, Paycheque, create_paycheque(), import_paycheques(), list_paycheques(), parse_paycheque_file(), DBDep, PaychequeCreate (+21 more)

### Community 5 - "SourcePayload"
Cohesion: 0.35
Nodes (4): Any, field_validator, model_validator, SourcePayload

### Community 6 - "allocations.py"
Cohesion: 0.16
Nodes (22): AllocationPresetPayload, AllocationRule, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum(), get_allocations() (+14 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (30): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+22 more)

### Community 8 - "import-dialog.tsx"
Cohesion: 0.07
Nodes (38): Skeleton(), importPaychequesAction(), DOT_CLASS, fileKind(), formatSize(), ImportDialog(), applySheetOverride(), handleFile() (+30 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.10
Nodes (21): 4. Invariants (do not break), PaychequePayload, Any, field_validator, model_validator, parse_optional_cents(), 1. Executive Summary, 2. System Architecture & Tech Stack (+13 more)

### Community 10 - "Source"
Cohesion: 0.11
Nodes (29): DBDep, description, ge, Path, valid_source_id(), Source, create_source(), delete_source() (+21 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "cn"
Cohesion: 0.25
Nodes (8): HASH_ROUTES, NAV_ITEMS, NavbarSearchParamsSync(), NavLinks(), withYearParam(), DialogProvider(), CopyJsonButton(), cn()

### Community 14 - "parsers.py"
Cohesion: 0.13
Nodes (19): UnsupportedFileType, truncate_text(), detect_mime(), _fields_from_summary_lines(), _header_match(), is_cheque_text(), is_deposit_text(), _is_row_data_like() (+11 more)

### Community 15 - "paycheques/router.py"
Cohesion: 0.14
Nodes (21): health_check(), lifespan(), FastAPI, get, CreatedResponse, ErrorResponse, OkResponse, delete_paycheque() (+13 more)

### Community 17 - "src/exceptions.py"
Cohesion: 0.14
Nodes (18): AppError, ConflictError, NotFoundError, FastAPI, register_exception_handlers(), ErrorCode, StrEnum, FileTooLarge (+10 more)

### Community 18 - "database.py"
Cohesion: 0.18
Nodes (15): AsyncEngine, get_db(), init_db(), async_sessionmaker, AsyncSession, seed_database(), Base, Paycheques bounded context. (+7 more)

### Community 19 - "AGENTS.md — Payday (Salary & Income Management App)"
Cohesion: 0.04
Nodes (41): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 5. Skills (load when relevant), 6. Capture problems, decisions, and feature specs, 7. Verify before you say "done", 8. Git commits, AGENTS.md — Payday (Salary & Income Management App), Concepts (+33 more)

### Community 23 - "parse_cents"
Cohesion: 0.19
Nodes (13): clean_money(), Drop tax/deductions if a tiny LLM copied net pay into them and broke gross -…, $1,842.5 CAD' or '(150.00)' -> '1842.50' / '150.00', in exact cents via…, _reconcile_vision_withholdings(), cents(), _sanitize_llm_fields(), _sum_money_cells(), parse_cents() (+5 more)

### Community 24 - "payday.ts"
Cohesion: 0.06
Nodes (48): dynamic, proxy(), RouteContext, AllocationsPage(), PageProps, dmMono, metadata, outfit (+40 more)

### Community 27 - "taxes-dashboard.tsx"
Cohesion: 0.24
Nodes (13): Solution, Why This Works, Navbar(), YearDropdown(), SourceDetailView(), TaxesDashboard(), AggregateTaxSummary, computeAggregateTaxSummary() (+5 more)

### Community 28 - "extractors.py"
Cohesion: 0.10
Nodes (28): _auto_crop_paper(), _compact_for_llm(), _encode_vision_jpeg_b64(), _enhance_ink_contrast(), _is_dark_background(), _llm(), llm_available(), llm_extract() (+20 more)

### Community 29 - "Source"
Cohesion: 0.12
Nodes (29): DialogContext, DialogContextValue, PaychequeDialogRequest, PaychequePrefill, SourceDialogRequest, ToastState, AllocationsDashboardProps, CATEGORY_LABELS (+21 more)

### Community 30 - "utils.ts"
Cohesion: 0.13
Nodes (27): PageProps, SourceDetailPage(), SourcesPage(), PageProps, TaxesPage(), SourceCardShell(), SourceGrid(), computeSourceYearSlice() (+19 more)

### Community 31 - "add_no_store_header"
Cohesion: 0.50
Nodes (4): add_no_store_header(), Response, middleware, Request

### Community 32 - "overview-charts.tsx"
Cohesion: 0.44
Nodes (11): configureChartDefaults(), CumulativeIncomeChart(), getChartMonths(), MonthlyIncomeChart(), SourceSplitChart(), SourceIncomeChart(), formatDollars(), pad() (+3 more)

### Community 33 - "paycheques/index.ts"
Cohesion: 0.08
Nodes (46): Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation, Prevention, Problem, Related Issues, Root Cause, Solution, Symptoms, What Didn't Work (+38 more)

### Community 34 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 35 - "import_logs.py"
Cohesion: 0.14
Nodes (26): alias, compact_parse_response(), compact_submitted_rows(), get_import_log(), list_import_logs(), list_linked_import_ids(), Any, AsyncSession (+18 more)

### Community 36 - "check_row"
Cohesion: 0.20
Nodes (11): check_row(), cents(), _fields_from_tables(), _infer_source_name(), _norm_cell(), Read ruled PDF summary tables (skipping unmapped columns like CIT Taxable…, Extract multi-row tabular schedules from ruled PDF tables (e.g. annual salary…, Extract multi-row date + amount statement lists (e.g. Salary.pdf). (+3 more)

### Community 37 - "parse_upload"
Cohesion: 0.22
Nodes (17): vision_available(), PipelineTrace, In-memory collector of ordered intermediate parser step outputs., _deterministic_text_row(), _llm_fallback_for_text(), parse_upload(), Returns (row, used_llm). Runs deterministic rules first and only calls the…, Extract 1..N rows from OCR/text (summary lists, multi-page bundles, or single… (+9 more)

### Community 38 - "config.py"
Cohesion: 0.20
Nodes (6): AppConfig, field_validator, test_ocr_runtime_switch(), BaseSettings, pathlib, pydantic_settings

### Community 39 - "validate_paystub_breakdown"
Cohesion: 0.22
Nodes (8): Validates cross-field invariants for a paycheque breakdown. If tax_cents or…, validate_paystub_breakdown(), Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads, Problem, Related Issues, Symptoms, What Didn't Work, Why This Works

### Community 40 - "useDialogs"
Cohesion: 0.24
Nodes (19): What Didn't Work, useDialogs(), updateGoalAction(), GoalDialogTrigger(), HeroTotalCounter(), LatestPaychequesList(), OverviewDashboard(), UpcomingPaydaysList() (+11 more)

### Community 41 - "ensure_schema_migrations"
Cohesion: 0.29
Nodes (8): 3. Project map, ensure_schema_migrations(), _exec_sql(), Any, Idempotently adds Gross-to-Net and Tax Intelligence columns to existing…, _set_sqlite_pragma(), test_idempotent_schema_migration(), listens_for

### Community 42 - "_HtmlTableParser"
Cohesion: 0.25
Nodes (4): _HtmlTableParser, _read_ods_sheets(), _read_sheets(), HTMLParser

### Community 43 - "db_session_factory"
Cohesion: 0.47
Nodes (5): client(), db_session_factory(), async_sessionmaker, AsyncSession, fixture

### Community 44 - "valid_paycheque_id"
Cohesion: 0.40
Nodes (5): DBDep, description, ge, Path, valid_paycheque_id()

### Community 45 - "sources/constants.py"
Cohesion: 0.50
Nodes (4): PaySchedule, StrEnum, SourceKind, enum

### Community 46 - "test_corrupted_adp_pdf_escalates_to_vision_and_reconciles_withholdings"
Cohesion: 0.50
Nodes (3): pdf_extract(), test_corrupted_adp_pdf_escalates_to_vision_and_reconciles_withholdings(), Prevention

### Community 50 - "paycheque-dialog.tsx"
Cohesion: 0.36
Nodes (8): deletePaychequeAction(), savePaychequeAction(), PaychequeDialog(), buildSavedToast(), deletePay(), handleSave(), submitPay(), PaychequeFormState

### Community 66 - "allocate_cents_largest_remainder"
Cohesion: 0.67
Nodes (3): allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., test_largest_remainder_exact_cent_invariant()

### Community 67 - "test_parse_pdf_ocr_escalation_and_llm_fallback"
Cohesion: 0.67
Nodes (3): Group OCR boxes into visual rows (top-to-bottom, then left-to-right) so a line…, _visual_lines(), test_parse_pdf_ocr_escalation_and_llm_fallback()

### Community 68 - "parse_written_amount"
Cohesion: 0.67
Nodes (3): parse_written_amount(), Convert legal cheque line ('Six hundred eleven 86/100') into '611.86'., test_cheque_preprocessing_dates_written_amount_and_sanity_guards()

## Knowledge Gaps
- **142 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+137 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 314 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `3. Comprehensive Feature Breakdown` connect `PaychequePayload` to `overview-charts.tsx`, `useDialogs`?**
  _High betweenness centrality (0.379) - this node is a cross-community bridge._
- **Why does `_safe_csv_cell()` connect `paycheques/service.py` to `PaychequePayload`?**
  _High betweenness centrality (0.340) - this node is a cross-community bridge._
- **Why does `3.2. Paycheques Ledger (`/paycheques`)` connect `PaychequePayload` to `paycheques/service.py`?**
  _High betweenness centrality (0.335) - this node is a cross-community bridge._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _142 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1365079365079365 - nodes in this community are weakly interconnected._
- **Should `paycheques/service.py` be split into smaller, more focused modules?**
  _Cohesion score 0.14022988505747128 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._