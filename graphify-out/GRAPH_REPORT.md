# Graph Report - Salary_Management_App  (2026-11-18)

## Corpus Check
- Corpus is ~14,192 words - fits in a single context window. You may not need a graph.

## Summary
- 486 nodes · 987 edges · 27 communities (19 shown, 8 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Next.js Routes & UI
- Database & Paycheque Models
- Schema Migrations & Allocator
- Paycheque Schemas & Utils
- Sources Exceptions & Deps
- Allocation Rule Payloads
- Dashboard App Pages
- Frontend Package Dependencies
- FastAPI App & Config
- Paycheque Payload Validation
- Backend Error Handling
- Platform & Docker Architecture
- TypeScript Configuration
- Source Payload Validation
- Frontend Allocation Engine
- Frontend Tax Intelligence
- Overview Dashboard Page
- Overview & Predictive Engines
- CSV Export Streaming
- Paycheques Ledger & CSV
- Backend Package Root
- Next.js Type Declarations
- Backend Project Manifest

## God Nodes (most connected - your core abstractions)
1. `CustomModel` - 21 edges
2. `PaychequePayload` - 18 edges
3. `compilerOptions` - 16 edges
4. `OkResponse` - 15 edges
5. `Source` - 15 edges
6. `Base` - 14 edges
7. `Paycheque` - 13 edges
8. `SourcePayload` - 13 edges
9. `get_full_state()` - 11 edges
10. `AllocationRulePayload` - 10 edges

## Surprising Connections (you probably didn't know these)
- `payday-data Persistent Docker Volume` --shares_data_with--> `SQLite Database (salary.db, WAL Mode)`  [INFERRED]
  docker-compose.yml → PROJECT_OVERVIEW.md
- `FastAPI / SQLAlchemy 2.0 Async Backend Stack` --conceptually_related_to--> `Modular FastAPI Architecture (backend/src/)`  [INFERRED]
  README.md → PROJECT_OVERVIEW.md
- `Docker Compose frontend Service` --references--> `Next.js 15 / React 19 Frontend Stack`  [INFERRED]
  docker-compose.yml → README.md
- `Docker Compose backend Service` --references--> `FastAPI / SQLAlchemy 2.0 Async Backend Stack`  [INFERRED]
  docker-compose.yml → README.md
- `create_allocation()` --uses--> `ConflictError`  [INFERRED]
  backend/src/allocations.py → backend/src/exceptions.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Docker Compose Multi-Container Stack** — docker_compose_frontend_service, docker_compose_backend_service, docker_compose_payday_data_volume [EXTRACTED 1.00]
- **Financial Data Integrity & Safety Mechanisms** — project_overview_integer_cents_representation, project_overview_relational_delete_protection, project_overview_sqlite_wal_database, project_overview_undoable_delete_toast [INFERRED 0.85]
- **Income Analytics, Forecasting & Allocation Engines** — project_overview_predictive_payday_engine, project_overview_yearly_goal_pacing_engine, readme_tax_intelligence, readme_pay_yourself_first_allocations [INFERRED 0.85]

## Communities (27 total, 8 thin omitted)

### Community 0 - "Next.js Routes & UI"
Cohesion: 0.05
Nodes (51): dynamic, proxy(), RouteContext, AllocationsPage(), PageProps, PageProps, TaxesPage(), DialogContext (+43 more)

### Community 1 - "Database & Paycheque Models"
Cohesion: 0.09
Nodes (41): Base, DBDep, description, ge, Path, valid_paycheque_id(), InvalidSourceReference, Paycheques bounded context. (+33 more)

### Community 2 - "Schema Migrations & Allocator"
Cohesion: 0.08
Nodes (37): AsyncClient, asyncio, allocate_cents_largest_remainder(), Splits `amount_cents` across `active_rules` using the Largest Remainder Method.…, ensure_allocation_schema(), ensure_schema_migrations(), _exec_sql(), get_db() (+29 more)

### Community 3 - "Paycheque Schemas & Utils"
Cohesion: 0.11
Nodes (31): AllocationRuleResponse, CustomModel, ErrorResponse, Any, PaychequeResponse, parse_cents(), parse_tax_reserve_bps(), Any (+23 more)

### Community 4 - "Sources Exceptions & Deps"
Cohesion: 0.11
Nodes (32): ConflictError, CreatedResponse, ErrorCode, DBDep, description, ge, Path, valid_source_id() (+24 more)

### Community 5 - "Allocation Rule Payloads"
Cohesion: 0.11
Nodes (28): AllocationPresetPayload, AllocationRule, AllocationRulePayload, AllocationsListResponse, apply_preset(), create_allocation(), delete_allocation(), get_active_bps_sum() (+20 more)

### Community 6 - "Dashboard App Pages"
Cohesion: 0.06
Nodes (23): dynamic, PageProps, PageProps, dmMono, metadata, outfit, viewport, NAV_ITEMS (+15 more)

### Community 7 - "Frontend Package Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, chart.js, next, react, react-dom, server-only, zod, devDependencies (+17 more)

### Community 8 - "FastAPI App & Config"
Cohesion: 0.11
Nodes (17): AsyncEngine, AppConfig, init_db(), async_sessionmaker, add_no_store_header(), health_check(), lifespan(), FastAPI (+9 more)

### Community 9 - "Paycheque Payload Validation"
Cohesion: 0.23
Nodes (7): _parse_int_cents(), PaychequePayload, Any, field_validator, model_validator, parse_optional_cents(), Parses an optional dollar value (string, int, float, or None) into integer…

### Community 10 - "Backend Error Handling"
Cohesion: 0.14
Nodes (12): AppError, NotFoundError, FastAPI, register_exception_handlers(), ErrorCode, StrEnum, PaychequeNotFound, enum (+4 more)

### Community 11 - "Platform & Docker Architecture"
Cohesion: 0.12
Nodes (19): Docker Compose backend Service, Docker Compose frontend Service, payday-data Persistent Docker Volume, Next.js API Proxy Route (/api/[...path]), Modular FastAPI Architecture (backend/src/), Integer Cents Representation, Payday Platform, Relational Delete Protection (ON DELETE RESTRICT) (+11 more)

### Community 12 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "Source Payload Validation"
Cohesion: 0.29
Nodes (6): StrEnum, SourceKind, Any, field_validator, model_validator, SourcePayload

### Community 14 - "Frontend Allocation Engine"
Cohesion: 0.29
Nodes (7): AggregateAllocationReport, AggregateBucketSummary, allocateCentsLargestRemainder(), AllocatedBucket, AllocationCategory, computeAggregateAllocations(), PaychequeAllocationResult

### Community 15 - "Frontend Tax Intelligence"
Cohesion: 0.33
Nodes (6): AggregateTaxSummary, computeAggregateTaxSummary(), computePaychequeBreakdown(), PaychequeRecord, PaychequeTaxBreakdown, SourceRecord

### Community 16 - "Overview Dashboard Page"
Cohesion: 0.33
Nodes (4): PageProps, frontend_src_features_overview_index, frontend_src_features_overview_index_getoverviewdata, frontend_src_features_overview_index_overviewdashboard

### Community 17 - "Overview & Predictive Engines"
Cohesion: 0.50
Nodes (4): Bespoke Vanilla CSS Fintech Design System, Overview Dashboard (/), Predictive Payday Engine (computeUpcomingPaydays), Yearly Goal & Pacing Engine

### Community 19 - "Paycheques Ledger & CSV"
Cohesion: 0.67
Nodes (3): CSV Export Endpoint (/api/export.csv), Paycheques Ledger (/paycheques), Undoable Delete Toast & ARIA Live System

## Knowledge Gaps
- **82 isolated node(s):** `payday-backend`, `name`, `private`, `dev`, `build` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 197 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CustomModel` connect `Paycheque Schemas & Utils` to `Database & Paycheque Models`, `Sources Exceptions & Deps`, `Allocation Rule Payloads`, `Paycheque Payload Validation`, `Source Payload Validation`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `PaychequePayload` connect `Paycheque Payload Validation` to `Database & Paycheque Models`, `Backend Error Handling`, `Paycheque Schemas & Utils`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `react` connect `Next.js Routes & UI` to `Dashboard App Pages`, `Frontend Package Dependencies`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `OkResponse` (e.g. with `delete_allocation()` and `update_allocation()`) actually correct?**
  _`OkResponse` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `Source` (e.g. with `build_export_csv()` and `valid_source_id()`) actually correct?**
  _`Source` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `payday-backend`, `name`, `private` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Next.js Routes & UI` be split into smaller, more focused modules?**
  _Cohesion score 0.052214452214452214 - nodes in this community are weakly interconnected._