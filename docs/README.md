# Payday Documentation

Root documents hold high-level project context: [README.md](../README.md) (setup & API), [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) (architecture & features), [CONCEPTS.md](../CONCEPTS.md) (domain vocabulary), and [AGENTS.md](../AGENTS.md) (agent workflow & invariants).

## Folder Layout & Lifecycle

| Folder | Purpose | Naming & Status |
| :--- | :--- | :--- |
| [`specs/`](./specs/) | Feature specs (what to build & why) | `NN-<kebab-slug>.md` (`draft` \| `active` \| `shipped` \| `superseded`) |
| `plans/` | Active multi-step plans, audits & refactors *(created on first use)* | `YYYY-MM-<initiative>/` (`active`) |
| [`solutions/`](./solutions/) | Solved dev bugs & prevention notes (`ce-compound`) | `<category>/<slug>.md` |
| `decisions/` | Short ADRs for non-obvious trade-offs *(created on first use)* | `YYYY-MM-DD-<slug>.md` |
| [`archive/`](./archive/) | Completed initiatives moved from `plans/` via `git mv` | `YYYY-MM-<initiative>/` (`shipped` \| `superseded`) |

## Feature Specs (`specs/`)

| Spec | Status | Date |
| :--- | :--- | :--- |
| [01 — Gross-to-Net & Tax Intelligence](./specs/01-gross-to-net-tax-intelligence.md) | `shipped` | 2026-11-08 |
| [02 — Pay-Yourself-First Allocations](./specs/02-pay-yourself-first-allocations.md) | `shipped` | 2026-11-08 |
| [03 — Bulk CSV Paystub Importer](./specs/03-bulk-csv-paystub-importer.md) | `shipped` | 2026-11-08 |
| [04 — Goal Pace Chart Overlays](./specs/04-goal-pace-chart-overlays.md) | `shipped` | 2026-11-19 |
| [05 — Filtered CSV Export & Import UI](./specs/05-filtered-csv-export-and-import-ui.md) | `shipped` | 2026-11-19 |
| [06 — Multi-Format Paycheque Ingestion (v1)](./specs/06-multi-format-paycheque-ingestion.md) | `superseded` | 2026-11-20 |
| [06 — Multi-Format Paycheque Ingestion (v2)](./specs/06-multi-format-paycheque-ingestion-v2.md) | `shipped` | 2026-11-20 |

## Archived Initiatives (`archive/`)

- [2026-11 UI/UX Overhaul — Master Plan](./archive/2026-11-ui-ux-overhaul/master-plan.md) (`shipped`, includes `refactor/01..07` and `ui-audit/01..10`)

## Captured Solutions (`solutions/`)

- [Corrupted-font payroll PDFs & VLM withholding reconciliation](./solutions/logic-errors/corrupted-payroll-pdf-and-vlm-withholding-reconciliation.md) (`2026-11-21`)
- [Hero YearDropdown multi-click navigation stall, popover sizing & Net label](./solutions/ui-bugs/year-dropdown-multi-click-stall-and-popover-sizing.md) (`2026-11-21`)
