# ADR: Universal Import Pipeline Extensions (Source Aliases, Deposit Mode, Multi-Row & Interactive Sheet Mapper)

- **Date:** 2026-11-23
- **Status:** Accepted (`f4a9cc9`, `f5a6c46`, `9086f1c`)

## Context
Payday's initial multi-format ingestion (`4cf53e5`–`a85a790`) assumed 1 PDF/image = 1 paycheque or cheque, required users to manually fix recurring numbered-company or legal employer names (e.g. `5024721 ONTARIO LIMITED` $\rightarrow$ `Kung Fu Tea`) on every upload, lacked a net-only mode for Interac e-Transfers and government benefit notices, and assumed spreadsheets had a single clean header row on the active worksheet.

## Decision
1. **Persistent `source_aliases` in SQLite:**
   - Added `source_aliases (id, raw_name COLLATE NOCASE UNIQUE, source_id REFERENCES sources(id) ON DELETE CASCADE)` via `ensure_schema_migrations`.
   - `ParsedPaychequeRow` retains `raw_source_name`; when `POST /api/paycheques/import` commits a row whose reviewed `source_name` differs from `raw_source_name`, the mapping is upserted into `source_aliases` and automatically resolved during future `/parse` and `/import` runs.
2. **`"deposit"` Document Mode:**
   - Added `"deposit"` alongside `"paystub"`, `"cheque"`, and `"tabular"` for Interac e-Transfer screenshots, banking deposit views, and CRA/government benefit notices, forcing `gross`/`tax`/`deductions`/`hours` to `null`.
3. **1-to-Many Extraction Across Tier 2 & Tier 3:**
   - Tier 2 (`pdf_text`) extracts multi-row ruled tables (`_rows_from_pdf_tables`), text-aligned statement lists (`_rows_from_text_summary_list`), and `\f`-delimited multi-page stub bundles.
   - Tier 3 (`vision` / `ocr`) invokes `vision_extract` per page on multi-page PDFs and expands optional `entries[]` payloads via `_rows_from_vision`.
4. **Client-Side Sheet Previews & Interactive Column/Start-Row Mapper:**
   - `POST /api/paycheques/parse` returns `sheets: list[ParsedSheetPreview]` (capped `raw_rows`, `header_row_index`, `default_source`, `default_year`, `default_note`, `inferred_mapping`) alongside `sheet_name` on each row.
   - `ImportDialog` renders multi-sheet tabs + a sheet dropdown and lets users override header/start row, default source/year, and column mappings (including split `Month`/`Day`/`Year` columns) immediately in the browser without re-uploading.

## Alternatives Considered
- **Server-side re-parse endpoint for column remapping:** Rejected to avoid extra round-trips and temporary server-side file storage; `ParsedSheetPreview.raw_rows` is already parsed once and small enough for instant client-side remapping via `buildRowsFromSheetOverride`.
- **Adding `xlrd` for legacy BIFF8 `.xls` binaries:** Skipped (YAGNI); `.xlsx`, `.xlsm`, `.ods` (via stdlib `zipfile` + `xml.etree.ElementTree`), and HTML-table/CSV `.xls` exports cover modern spreadsheets without extra dependencies.
- **VLM fine-tuning for recurring payer names:** Rejected per spec invariants; deterministic `source_aliases` in SQLite gives exact memory with zero ML training.

## Consequences / Trade-offs
- Client-side remapping in `sheet-mapper.ts` mirrors backend split-date and footer-skipping rules (while backend `/import` remains the authoritative trust boundary for integer-cent validation and SHA-256 deduplication).
- `compact_parse_response()` strips `raw_rows` from `sheets` before persisting `import_pipeline_logs.response_json` so SQLite telemetry stays compact.
