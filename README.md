# Payday - Salary & Income Management App

> **Payday** is a personal salary and income tracking application designed for accurate visibility into net take-home earnings, multi-source income tracking, tax intelligence, pay-yourself-first allocations, and annual goal pacing.

---

## Key Features

- **Overview Dashboard (`/`)**:
  - Animated net income hero counter, year-over-year pacing delta, and multi-year switcher (`?year=...` or All Time).
  - Executive KPIs (monthly average, best month, paycheque count, top source).
  - Interactive Chart.js visualizations: monthly income by source (stacked bar), cumulative trajectory (line), and source split (doughnut).
  - Yearly goal progress & runway projections, plus algorithmic next-payday predictions.
- **Paycheques Ledger (`/paycheques`)**:
  - Monthly grouped deposit ledger with instant client-side filtering (year, source, full-text search).
  - Add/edit/delete paycheques with integer-cents precision, "Same as last time" preset, and 7-second undoable delete toasts.
  - One-click CSV export (`/api/export.csv`).
- **Income Sources (`/sources` & `/sources/[id]`)**:
  - Manage jobs, government benefits, and other income streams with custom colors, archive toggles, hourly take-home calculations, and relational delete protection.
- **Tax Intelligence (`/taxes`)**:
  - Gross-to-net tax breakdown and effective/marginal tax analysis (`frontend/src/lib/tax-intelligence.ts`).
- **Pay-Yourself-First Allocations (`/allocations`)**:
  - Configurable allocation rules and presets to split paycheques into savings, investments, and spending buckets (`frontend/src/lib/allocation-engine.ts`, `/api/allocations`).
- **Productivity & Accessibility**:
  - Press <kbd>N</kbd> anywhere to open the Add Paycheque dialog.
  - Hash deep-linking (`#add`, `#overview`, `#paycheques`, `#sources`, `#source/:id`), accessible `<dialog>` modals, ARIA live toast notifications, and `prefers-reduced-motion` support.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Chart.js, Zod, Vanilla CSS |
| **Backend** | Python 3.11+ (3.13 in Docker), FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), aiosqlite |
| **Database** | SQLite (WAL mode + foreign key enforcement) stored in integer cents |
| **Containerization** | Docker & Docker Compose with persistent `payday-data` volume |

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
docker compose up --build
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
| `GET` | `/api/state` | Full application state (sources, paycheques, settings) |
| `PUT` | `/api/settings` | Set or clear the annual income goal |
| `GET` | `/api/sources` | List all income sources |
| `POST` | `/api/sources` | Create an income source |
| `PUT` | `/api/sources/{id}` | Update an income source |
| `DELETE` | `/api/sources/{id}` | Delete an income source (blocked if paycheques exist) |
| `GET` | `/api/paycheques` | List paycheques |
| `POST` | `/api/paycheques` | Create a paycheque |
| `PUT` | `/api/paycheques/{id}` | Update a paycheque |
| `DELETE` | `/api/paycheques/{id}` | Delete a paycheque |
| `GET` | `/api/export.csv` | Export paycheque ledger as CSV |
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
│       ├── database.py          # Async SQLite engine & initialization
│       ├── models.py            # Shared SQLAlchemy & Pydantic models
│       ├── allocations.py       # Pay-yourself-first allocation rules API
│       ├── paycheques/          # Paycheque domain (router, service, schemas, models)
│       ├── sources/             # Source domain (router, service, schemas, models)
│       └── settings/            # Settings domain (router, service, schemas, models)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/     # Overview, Paycheques, Sources, Taxes, Allocations
│       │   └── api/[...path]/   # Proxy route to FastAPI backend
│       ├── components/          # Shared layout & UI components
│       ├── features/            # Feature-sliced UI, actions, schemas, services
│       ├── lib/                 # Allocation engine, tax intelligence, DB & env helpers
│       └── styles/              # Global design system CSS
├── features/                    # Feature specifications
├── docker-compose.yml           # Multi-container orchestration
└── PROJECT_OVERVIEW.md          # Detailed architecture & feature documentation
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

