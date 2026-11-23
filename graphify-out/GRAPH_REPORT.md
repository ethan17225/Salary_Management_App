# Graph Report - Salary_Management_App  (2026-11-23)

## Corpus Check
- 127 files · ~62,368 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 985 nodes · 2680 edges · 62 communities (38 shown, 24 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 207 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28b2ab04`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _rows_from_pdf_tables
- next
- test_app.py
- paycheques/schemas.py
- paycheques/service.py
- SourcePayload
- allocations.py
- package.json
- import-dialog.tsx
- PaychequePayload
- Source
- Docker Compose backend Service
- compilerOptions
- react
- parsers.py
- update_paycheque
- frontend_src_features_overview_index_getoverviewdata
- src/exceptions.py
- paycheques/router.py
- docs/README.md
- src/__init__.py
- next-env.d.ts
- parse_cents
- db.ts
- payday-backend
- taxes-dashboard.tsx
- extractors.py
- payday.ts
- utils.ts
- add_no_store_header
- Source
- paycheques/index.ts
- AllocationRulePayload
- import_logs.py
- _fields_from_tables
- parse_upload
- source-dialog.tsx
- validate_paystub_breakdown
- useDialogs
- app/layout.tsx
- _HtmlTableParser
- Excel split-date (Month/Date) parsing, forward-fill, and banner year money collision
- frontend_src_features_allocations_index_allocationsdashboard
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
6. `parse_table_with_sheets()` - 27 edges
7. `CustomModel` - 26 edges
8. `next` - 24 edges
9. `parse_cents()` - 23 edges
10. `cn()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Consequences / Trade-offs` --references--> `compact_parse_response()`  [INFERRED]
  docs/decisions/2026-11-23-universal-import-aliases-and-sheet-mapper.md → backend/src/paycheques/import_logs.py
- `Problem` --references--> `parse_upload()`  [INFERRED]
  docs/solutions/logic-errors/corrupted-payroll-pdf-and-vlm-withholding-reconciliation.md → backend/src/paycheques/parsers.py
- `Problem` --references--> `YearDropdown()`  [INFERRED]
  docs/solutions/ui-bugs/year-dropdown-multi-click-stall-and-popover-sizing.md → frontend/src/components/ui/year-dropdown.tsx
- `Sheet Preview & Interactive Mapping` --references--> `ImportDialog()`  [INFERRED]
  CONCEPTS.md → frontend/src/features/paycheques/components/import-dialog.tsx
- `Alternatives Considered` --references--> `buildRowsFromSheetOverride()`  [INFERRED]
  docs/decisions/2026-11-23-universal-import-aliases-and-sheet-mapper.md → frontend/src/features/paycheques/lib/sheet-mapper.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]

## Communities (62 total, 24 thin omitted)

### Community 0 - "_rows_from_pdf_tables"
Cohesion: 0.16
Nodes (20): check_row(), cents(), clean_date(), clean_hours(), _clean_text(), _infer_headerless_columns(), _is_banner_row(), _match_known_source() (+12 more)

### Community 1 - "next"
Cohesion: 0.24
Nodes (5): OverviewPage(), PageProps, updateGoalAction(), GoalDialogTrigger(), next

### Community 2 - "test_app.py"
Cohesion: 0.07
Nodes (48): AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method., AppConfig, field_validator, detect_mime(), Trust magic bytes, never the client's extension or Content-Type. The extension… (+40 more)

### Community 3 - "paycheques/schemas.py"
Cohesion: 0.17
Nodes (23): AllocationRuleResponse, CustomModel, ParsedSheetPreview, PaychequeResponse, Raw grid preview & inferred column/row config for interactive Excel/CSV mapping., parse_tax_reserve_bps(), Validates range 0 <= bps <= 6000 (0% to 60%)., Settings and aggregate state bounded context. (+15 more)

### Community 4 - "paycheques/service.py"
Cohesion: 0.13
Nodes (30): BadRequestError, DBDep, description, ge, Path, valid_paycheque_id(), Paycheque, create_paycheque() (+22 more)

### Community 5 - "SourcePayload"
Cohesion: 0.35
Nodes (4): Any, field_validator, model_validator, SourcePayload

### Community 6 - "allocations.py"
Cohesion: 0.15
Nodes (24): AllocationPresetPayload, AllocationRule, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum(), get_allocations() (+16 more)

### Community 7 - "package.json"
Cohesion: 0.06
Nodes (30): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+22 more)

### Community 8 - "import-dialog.tsx"
Cohesion: 0.07
Nodes (39): Skeleton(), importPaychequesAction(), PaychequeImportResult, DOT_CLASS, fileKind(), formatSize(), ImportDialog(), applySheetOverride() (+31 more)

### Community 9 - "PaychequePayload"
Cohesion: 0.07
Nodes (31): 1. Knowledge base first: graphify, 2. Ponytail mode (always on, level: full), 3. Project map, 4. Invariants (do not break), 5. Skills (load when relevant), 6. Capture problems, decisions, and feature specs, 7. Verify before you say "done", 8. Git commits (+23 more)

### Community 10 - "Source"
Cohesion: 0.11
Nodes (29): DBDep, description, ge, Path, valid_source_id(), Source, create_source(), delete_source() (+21 more)

### Community 11 - "Docker Compose backend Service"
Cohesion: 0.67
Nodes (3): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "react"
Cohesion: 0.13
Nodes (18): dynamic, HASH_ROUTES, NAV_ITEMS, NavbarSearchParamsSync(), NavLinks(), withYearParam(), DialogContext, DialogContextValue (+10 more)

### Community 14 - "parsers.py"
Cohesion: 0.12
Nodes (26): UnsupportedFileType, truncate_text(), _clean_day(), _clean_month(), _clean_year(), _header_match(), _is_row_data_like(), _map_header_columns() (+18 more)

### Community 15 - "update_paycheque"
Cohesion: 0.33
Nodes (6): delete_paycheque(), delete, PaychequeUpdate, put, update_paycheque(), ValidPaychequeDep

### Community 17 - "src/exceptions.py"
Cohesion: 0.12
Nodes (22): AppError, ConflictError, NotFoundError, FastAPI, register_exception_handlers(), ErrorCode, StrEnum, FileTooLarge (+14 more)

### Community 18 - "paycheques/router.py"
Cohesion: 0.12
Nodes (27): AsyncEngine, get_db(), init_db(), async_sessionmaker, AsyncSession, seed_database(), health_check(), lifespan() (+19 more)

### Community 19 - "docs/README.md"
Cohesion: 0.04
Nodes (41): Concepts, Flagged ambiguities, Import Pipeline Log, Income & Ingestion, Paycheque, Sheet Preview & Interactive Mapping, Source, Source Alias (+33 more)

### Community 23 - "parse_cents"
Cohesion: 0.19
Nodes (13): clean_money(), Drop tax/deductions if a tiny LLM copied net pay into them and broke gross -…, $1,842.5 CAD' or '(150.00)' -> '1842.50' / '150.00', in exact cents via…, _reconcile_vision_withholdings(), cents(), _sanitize_llm_fields(), _sum_money_cells(), parse_cents() (+5 more)

### Community 24 - "db.ts"
Cohesion: 0.08
Nodes (30): dynamic, proxy(), RouteContext, AllocationsPage(), PageProps, applyAllocationPresetAction(), deleteAllocationRuleAction(), saveAllocationRuleAction() (+22 more)

### Community 27 - "taxes-dashboard.tsx"
Cohesion: 0.21
Nodes (12): Solution, Why This Works, PageProps, Navbar(), YearDropdown(), TaxesDashboard(), AggregateTaxSummary, computeAggregateTaxSummary() (+4 more)

### Community 28 - "extractors.py"
Cohesion: 0.09
Nodes (30): _auto_crop_paper(), _compact_for_llm(), _encode_vision_jpeg_b64(), _enhance_ink_contrast(), _is_dark_background(), _llm(), llm_available(), llm_extract() (+22 more)

### Community 29 - "payday.ts"
Cohesion: 0.15
Nodes (18): YearDropdownProps, YearOption, AllocationsDashboardProps, CATEGORY_LABELS, PRESET_CARDS, OverviewData, SourceDetailData, SparkItem (+10 more)

### Community 30 - "utils.ts"
Cohesion: 0.17
Nodes (23): PageProps, SourceDetailPage(), SourcesPage(), TaxesPage(), computeOverviewYearSlice(), getOverviewData, SourceGrid(), computeSourceYearSlice() (+15 more)

### Community 31 - "add_no_store_header"
Cohesion: 0.50
Nodes (4): add_no_store_header(), Response, middleware, Request

### Community 32 - "Source"
Cohesion: 0.23
Nodes (17): configureChartDefaults(), CumulativeChartProps, CumulativeIncomeChart(), getChartMonths(), MonthlyChartProps, MonthlyIncomeChart(), SourceSplitChart(), SplitChartProps (+9 more)

### Community 33 - "paycheques/index.ts"
Cohesion: 0.08
Nodes (47): Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation, Prevention, Problem, Related Issues, Root Cause, Solution, Symptoms, What Didn't Work (+39 more)

### Community 34 - "AllocationRulePayload"
Cohesion: 0.28
Nodes (6): AllocationRulePayload, parse_weight_bps(), Any, field_validator, model_validator, Extracts integer basis points (1..10000) from `weight_bps` or `percentage`.

### Community 35 - "import_logs.py"
Cohesion: 0.12
Nodes (31): alias, compact_parse_response(), compact_submitted_rows(), get_import_log(), list_import_logs(), list_linked_import_ids(), Any, AsyncSession (+23 more)

### Community 36 - "_fields_from_tables"
Cohesion: 0.67
Nodes (3): _fields_from_tables(), _norm_cell(), Read ruled PDF summary tables (skipping unmapped columns like CIT Taxable…

### Community 37 - "parse_upload"
Cohesion: 0.14
Nodes (25): vision_available(), PipelineTrace, In-memory collector of ordered intermediate parser step outputs., _deterministic_text_row(), _fields_from_summary_lines(), _infer_source_name(), is_cheque_text(), is_deposit_text() (+17 more)

### Community 38 - "source-dialog.tsx"
Cohesion: 0.17
Nodes (15): deleteSourceAction(), saveSourceAction(), SourceDialog(), deleteSrc(), submitSrc(), SourceFormState, SOURCE_COLORS, PaySchedule (+7 more)

### Community 39 - "validate_paystub_breakdown"
Cohesion: 0.22
Nodes (8): Validates cross-field invariants for a paycheque breakdown. If tax_cents or…, validate_paystub_breakdown(), Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads, Problem, Related Issues, Symptoms, What Didn't Work, Why This Works

### Community 40 - "useDialogs"
Cohesion: 0.25
Nodes (20): What Didn't Work, useDialogs(), HeroTotalCounter(), LatestPaychequesList(), OverviewDashboard(), UpcomingPaydaysList(), normalizeYearFilter(), PaychequeLedger() (+12 more)

### Community 41 - "app/layout.tsx"
Cohesion: 0.29
Nodes (5): dmMono, metadata, outfit, viewport, frontend_src_styles_globals

### Community 43 - "Excel split-date (Month/Date) parsing, forward-fill, and banner year money collision"
Cohesion: 0.50
Nodes (3): Excel split-date (Month/Date) parsing, forward-fill, and banner year money collision, Problem, Root Cause

### Community 50 - "paycheque-dialog.tsx"
Cohesion: 0.30
Nodes (12): deletePaychequeAction(), savePaychequeAction(), PaychequeDialog(), buildSavedToast(), deletePay(), handleSave(), submitPay(), PaychequeFormState (+4 more)

## Knowledge Gaps
- **146 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 318 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ImportDialog()` connect `import-dialog.tsx` to `parse_upload`, `source-dialog.tsx`, `useDialogs`, `parsers.py`, `docs/README.md`?**
  _High betweenness centrality (0.406) - this node is a cross-community bridge._
- **Why does `Decision` connect `parse_upload` to `_rows_from_pdf_tables`, `import-dialog.tsx`, `PaychequePayload`, `docs/README.md`, `extractors.py`?**
  _High betweenness centrality (0.268) - this node is a cross-community bridge._
- **Why does `ParsedPaychequeRow` connect `parse_upload` to `_rows_from_pdf_tables`, `test_app.py`, `paycheques/schemas.py`, `parsers.py`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06980433632998413 - nodes in this community are weakly interconnected._
- **Should `paycheques/service.py` be split into smaller, more focused modules?**
  _Cohesion score 0.12688172043010754 - nodes in this community are weakly interconnected._
- **Should `allocations.py` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._