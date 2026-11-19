# Feature 5 — CSV Import UI Wizard & Filtered CSV Export

- **Date**: 2026-11-19
- **Title**: Drag-and-Drop CSV Import Wizard & Query-Filtered CSV Export
- **Status**: Planned Feature (Wishlist Item 6, Frontend Complement to `feature_3_idempotent_bulk_csv_paystub_importer_spec.md`)
- **Primary Targets**:
  - `frontend/src/features/paycheques/components/paycheques-view.tsx`
  - `frontend/src/features/paycheques/components/paycheque-ledger.tsx`
  - `frontend/src/features/paycheques/components/csv-import-dialog.tsx` (new)
  - `backend/src/paycheques/router.py`
  - `backend/src/paycheques/service.py`

---

## Description

While `features/feature_3_idempotent_bulk_csv_paystub_importer_spec.md` outlines the backend SHA-256 deduplicated batch importer, the frontend currently has no CSV import user interface, and the existing `Export to CSV` button ignores active ledger filters—always exporting the entire database. Adding a guided drag-and-drop CSV import modal alongside filtered CSV export turns `/paycheques` into a complete bidirectional ledger for tax time, spreadsheet backups, and historical onboarding.

---

## Detailed Problem

### 1. No User Interface for Bulk Historical Paycheque Import
- Users migrating from spreadsheets, bank exports, or payroll CSVs must manually enter every historical paycheque one by one via `PaychequeDialog`.
- There is no CSV upload trigger on `/paycheques` (`paycheques-view.tsx:13-23`) or during first-run onboarding (`overview-dashboard.tsx`).

### 2. Unfiltered `Export to CSV` Link
In `frontend/src/features/paycheques/components/paycheques-view.tsx:20-22`:
```tsx
<a className="btn w-full sm:w-auto" href="/api/export.csv" download>
  Export to CSV
</a>
```
And in `backend/src/paycheques/router.py:106-118`:
```python
@export_router.get("/export.csv", ...)
async def export_paycheques_csv(db: DBDep) -> Response:
    ...
    content=await service.build_export_csv(db)
```
- Even when a user filters `/paycheques` to `Year: 2025` and `Source: Freelance Client` for their accountant at tax time, clicking `Export to CSV` downloads every paycheque across all years and all employers.

---

## Detailed Solutions

### Solution 1: Filtered CSV Export (`GET /api/export.csv`)
1. **Backend (`backend/src/paycheques/router.py` & `service.py`)**:
   - Accept optional query parameters `year: str | None = None`, `source_id: int | None = None`, and `q: str | None = None` on `GET /api/export.csv`.
   - Apply matching `Paycheque.paid_on.startswith(f"{year}-")`, `Paycheque.source_id == source_id`, and case-insensitive substring filters (`Source.name`, `Paycheque.note`, `Paycheque.paid_on`, formatted amount) inside `build_export_csv(db, year=..., source_id=..., q=...)`.
   - Reflect scope in the downloaded filename (e.g., `paycheques-2025-2026-11-19.csv` when year is filtered).
2. **Frontend (`paycheques-view.tsx` & `paycheque-ledger.tsx`)**:
   - Pass the active filter state (`year`, `source`, `q`) to the export control.
   - When filters are active, display `"Export filtered CSV (X)"` linking to `/api/export.csv?year=...&source_id=...&q=...` (plus a quick link or option to export all if desired).

### Solution 2: 3-Step CSV Import Modal (`CsvImportDialog`)
Add an **`Import CSV`** button beside `Export to CSV` in `paycheques-view.tsx` opening a native `<dialog>` wizard implementing the frontend side of `feature_3_idempotent_bulk_csv_paystub_importer_spec.md`:
1. **Step 1 — File Drop / Paste & Template Download**:
   - Accessible file picker + drag-and-drop dropzone accepting `.csv` files (plus a `"Download sample CSV template"` link matching `/api/export.csv` headers).
   - Client-side RFC-4180 CSV parser handling quoted fields, BOM stripping, and `$` / `,` numeric cleanup into integer cents.
2. **Step 2 — Column Mapping & Source Resolution**:
   - Auto-map headers (`date`/`paid_on`, `source`/`employer`, `amount`/`net`, `gross`, `tax`, `deductions`, `hours`, `note`) with `<select>` overrides so users can remap arbitrary bank/payroll column names.
   - Match CSV source names against existing `sources` (case-insensitive) or allow mapping them to an existing source / flagging `"Create new source"` before import.
3. **Step 3 — Validation Preview & Idempotent Batch Commit**:
   - Show a preview table highlighting:
     - Valid new rows (`green`)
     - Duplicate rows already matching SHA-256 `(source_id : paid_on : amount_cents)` (`muted` — will be skipped)
     - Invalid rows (e.g., bad date or negative amount, with row-level error reason)
   - Submit valid rows in a single atomic transaction (`POST /api/paycheques/import`), then revalidate routes and show a clear summary toast (`"Imported 24 paycheques · skipped 3 duplicates"`).

### Verification Criteria
- Filtering `/paycheques` by year `2025` and clicking `Export filtered CSV` downloads only `2025` rows.
- Uploading an exported CSV back into `Import CSV` detects 100% of existing rows as idempotent duplicates and inserts 0 duplicate records.
- Malformed CSV rows display row-level feedback in Step 3 without crashing or partially committing corrupted cents.
