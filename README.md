# Payday — Salary & Income Management App

> **Payday** is a personal salary and income tracking application built for exact visibility into net and gross earnings, multi-source income tracking, tax intelligence, pay-yourself-first allocations, and annual goal pacing.

---

## Key Features

- **Overview Dashboard (`/`)**:
  - Animated net income hero counter, year-over-year pacing delta, and native `YearDropdown` (`?year=...` or All Time with labeled net subtotals).
  - Executive KPIs (monthly average, best month, paycheque count, top source) and a 3-step first-run onboarding card when no paycheques exist yet.
  - Interactive Chart.js visualizations with annual **goal pace target lines** on monthly bar and cumulative line charts, plus an inline `▲ ahead / ▼ behind pace` delta badge.
  - Actionable **Next paydays** list with explicit per-source `pay_schedule` support (`auto`, `weekly`, `biweekly`, `semimonthly`, `monthly`, `irregular`) and 1-click **Log** deposit prefill.
- **Paycheques Ledger (`/paycheques`)**:
  - Monthly grouped deposit ledger with URL-synced filters (`?year=&source=&q=`), 1-click **Clear filters**, and expandable **Split** panels with 1-click **Copy** buttons for bucket & tax-reserve transfers.
  - Smart `PaychequeDialog` with collapsible Gross/Tax/Deductions drawer, live auto-net sync, live `$/h` rate preview, `"Same as last time"` preset, `"Save & add another"` batch mode, and 7-second undoable delete toasts.
  - **Filtered CSV Export** (`GET /api/export.csv?year=&source_id=&q=`) with formula-injection escaping and **Idempotent Bulk CSV Import** (`POST /api/paycheques/import`) using SHA-256 deduplication.
- **Income Sources (`/sources` & `/sources/[id]`)**:
  - Accessible stretched-link source cards with interactive 12-month sparklines (`data-tip` hover totals), hourly net/gross rates, custom pay schedules, tax treatment settings, and 2-step delete confirmation (blocked if paycheques exist).
- **Tax Intelligence (`/taxes`)**:
  - Gross-to-net retention breakdown aligned across tracked stubs (`frontend/src/lib/tax-intelligence.ts`), W-2/T4 withholding vs. 1099/T4A contractor tax reserve tracking, and per-source/per-stub breakdown tables.
- **Pay-Yourself-First Allocations (`/allocations`)**:
  - Integer-cent Largest Remainder allocation rules (`frontend/src/lib/allocation-engine.ts`), guarded 1-click presets (`window.confirm`), and a direct/hourly paycheque split simulator.
- **Productivity & Accessibility**:
  - Persistent `?year=` parameter across navigation tabs, structural loading skeletons (`loading.tsx`), <kbd>N</kbd> shortcut on fine-pointer devices, accessible `<dialog>` modals, ARIA live toasts, and global `prefers-reduced-motion` support.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Chart.js 4, Zod |
| **Backend** | Python 3.11+ (3.13 in Docker), FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), aiosqlite |
| **Database** | SQLite (WAL mode + foreign keys) with integer-cent / basis-point precision |
| **Containerization** | Docker & Docker Compose with persistent `payday-data` volume |

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
docker compose up -d --build
```

- **Frontend**: `http://localhost:8080` (configurable via `PAYDAY_PORT`)
- **Backend API**: `http://localhost:8001` (configurable via `BACKEND_PORT`)
- **Persistence**: SQLite database is stored in the `payday-data` Docker volume (`/data/salary.db`).

### Option 2: Local Development

#### 1. Start the Backend

```bash
cd backend
pip install -e ".[dev]" # or: uv sync
fastapi dev src/main.py --port 8001
```

> **Note:** The frontend defaults `BACKEND_URL` to `http://127.0.0.1:8001`. If you run FastAPI on port `8000`, set `BACKEND_URL=http://127.0.0.1:8000` in the frontend environment.

#### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

- Frontend runs at `http://localhost:3000`.
- Type-check with `npm run typecheck`.

---

## Testing & Linting

### Backend

```bash
cd backend
pytest
ruff check .
```

### Frontend

```bash
cd frontend
npm run typecheck
npm run build
```

---

## API Overview

Interactive OpenAPI docs are available at `/docs` when `ENVIRONMENT` is `local` or `staging`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/state` | Full application state (sources, paycheques, settings, allocations) |
| `PUT` | `/api/settings` | Set or clear the annual income goal |
| `GET` | `/api/sources` | List all income sources |
| `POST` | `/api/sources` | Create an income source (includes `pay_schedule` and tax reserve config) |
| `PUT` | `/api/sources/{id}` | Update an income source |
| `DELETE` | `/api/sources/{id}` | Delete an income source (blocked if paycheques exist) |
| `GET` | `/api/paycheques` | List paycheques |
| `POST` | `/api/paycheques` | Create a paycheque |
| `POST` | `/api/paycheques/import` | Atomic bulk CSV/row import with SHA-256 deduplication |
| `PUT` | `/api/paycheques/{id}` | Update a paycheque |
| `DELETE` | `/api/paycheques/{id}` | Delete a paycheque |
| `GET` | `/api/export.csv` | Export paycheques as CSV (`?year=&source_id=&q=` optional filters) |
| `GET` | `/api/allocations` | List allocation rules |
| `POST` | `/api/allocations` | Create an allocation rule |
| `PUT` | `/api/allocations/{rule_id}` | Update an allocation rule |
| `DELETE` | `/api/allocations/{rule_id}` | Delete an allocation rule |
| `POST` | `/api/allocations/presets` | Apply allocation presets |

---

## Project Structure

```text
Salary_Management_App/
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── test_app.py
│   └── src/
│       ├── main.py              # FastAPI entrypoint, CORS, lifespan, health check
│       ├── config.py            # Pydantic settings (DB_PATH, PORT, CORS_ORIGINS)
│       ├── database.py          # Async SQLite engine, migrations & seeding
│       ├── models.py            # Shared SQLAlchemy & Pydantic models
│       ├── allocations.py       # Pay-yourself-first allocation rules API
│       ├── paycheques/          # Paycheque domain (router, service, import/export, schemas, models)
│       ├── sources/             # Source domain (router, service, schedules, schemas, models)
│       └── settings/            # Settings & full-state snapshot domain
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/     # Overview, Paycheques, Sources, Taxes, Allocations & skeletons
│       │   └── api/[...path]/   # Proxy route forwarding path + query parameters to FastAPI
│       ├── components/          # Navbar, DialogProvider, YearDropdown, Skeleton
│       ├── features/            # Feature-sliced UI, actions, schemas, services
│       ├── lib/                 # Allocation engine, tax intelligence, DB & env helpers
│       └── styles/              # Tailwind CSS v4 design tokens & utility layers
├── features/                    # Feature specifications
├── improvement-plan/            # Master UI/UX improvement blueprint
├── refactor/                    # UX pain-point analyses
├── ui-audit/                    # UI craft & accessibility audit findings
├── docker-compose.yml           # Multi-container orchestration
├── PROJECT_OVERVIEW.md          # Detailed architecture & feature documentation
└── README.md                    # Project quick start & reference
```

---

## Environment Variables

### Backend (`backend/src/config.py`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `local` | Enables `/docs` when `local` or `staging` |
| `DB_PATH` | `data/salary.db` | Path to SQLite database file (set to `/data/salary.db` in Docker) |
| `PORT` | `8000` | Backend listen port |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins |

### Frontend (`frontend/src/lib/env.ts`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BACKEND_URL` | `http://127.0.0.1:8001` | Upstream FastAPI backend URL |
