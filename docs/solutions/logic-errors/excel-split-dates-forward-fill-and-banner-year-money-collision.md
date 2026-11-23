---
title: Excel split-date (Month/Date) parsing, forward-fill, and banner year money collision
date: 2026-11-23
category: logic-errors
module: paycheques
problem_type: logic_error
component: service_layer
symptoms:
  - "Section banners containing a 4-digit year (e.g. 'Kung Fu Tea Salary 2025', 'Tax Turn 2025') were parsed by clean_money() as $2,025.00, preventing _is_banner_row() from splitting sections"
  - "Spreadsheets with split Month and Date (day-of-month) columns and omitted repeat months (e.g. ',25,450.19,') failed to resolve pay dates"
  - "Sheets using 'Salary' alongside 'Monthly Total' mapped 'Salary' to gross instead of take-home amount and picked up summary total columns"
  - "Repeated section banners (e.g. second 'Softchoice Winter 2025 Co-op Term' block starting in Month 5 after Month 12) kept 2025 instead of rolling over to 2026"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - excel-parsing
  - split-dates
  - forward-fill
  - clean-money
  - multi-sheet
---

# Excel split-date (Month/Date) parsing, forward-fill, and banner year money collision

## Problem
Real-world personal salary spreadsheets (`Salary.pdf` / Excel workbooks) frequently use multi-section sheets with single-cell banners (`Kung Fu Tea Salary 2025`, `Softchoice Winter 2025 Co-op Term`, `Tax Turn 2025`), split date columns (`Month` + `Date` as day-of-month `1..31`), blank continuation `Month` cells on subsequent paydays in the same month, `"Salary"` as the take-home column, and `"Monthly Total"` / `"Sum"` summary columns.

## Root Cause
1. **`clean_money()` stripped all non-digit characters unconditionally:** Calling `re.sub(r"[^\d.]", "", "Tax Turn 2025")` produced `"2025"` (`"2025.00"`), so `_is_banner_row()` treated every banner containing a year as a numeric/money cell and returned `None`.
2. **Rigid header aliases for `Date` and `Salary`:** `_map_header_columns()` mapped `"Date"` to full `paid_on` even when paired with `"Month"`, mapped `"Salary"` to `gross` even when no separate `Net Pay` column existed, and did not ignore `"Monthly Total"` / `"Sum"` summary columns.
3. **Copy-pasted section banners across year boundaries:** A second `"Softchoice Winter 2025 Co-op Term"` block whose months restarted at `5` after `12` kept `2025` unless year rollover was tracked per source.

## Solution
1. **Reject non-currency alphabetic text in `clean_money()` (`backend/src/paycheques/parsers.py`):** Strip known currency codes (`CAD`, `USD`, `EUR`, `GBP`, `AUD`, `NZD`) first and return `None` if any alphabetic characters remain.
2. **Pair `Month` + `Date` as split `(month, day)` with forward-fill:**
   - Added `month`, `day`, and `year` aliases, mapped `"Salary"`/`"Wages"` to `amount` when no explicit net column is present, and ignored `_IGNORED_TOTAL_COL_RE` columns (`Monthly Total`, `Sum`, `YTD Total`).
   - When `month` and `paid_on` (`date`/`day`) appear together, promote `paid_on` to `day`, forward-fill `current_month` and `current_year` across blank continuation rows, and assemble `YYYY-MM-DD` (still accepting full dates if a cell contains one).
3. **Section splitting, banner extraction & interactive `ParsedSheetPreview`:**
   - `_split_sheet_sections()` splits multi-section worksheets cleanly; `_parse_section_banner()` extracts `(source_name, year, default_note)` (mapping `Tax Turn` / `CRA` to `"CRA / Government"`) and rolls `section_year` forward when a source's month steps backward across blocks.
   - `parse_table_with_sheets()` returns `sheets: list[ParsedSheetPreview]` so `ImportDialog` (`frontend/src/features/paycheques/components/import-dialog.tsx` + `sheet-mapper.ts`) provides sheet tabs/dropdowns and instant client-side column & start-row remapping.

## Prevention / Guardrail
- `test_user_salary_split_month_date_forward_fill_and_sections` in `backend/test_app.py` verifies all 63 rows, zero warnings, 5 sheet previews, and exact cent totals (`Kung Fu Tea` 2025/2026, `Softchoice` 2025/2026, `CRA / Government` 2025).
- `test_excel_multisheet_banners_totals_multicolumn_and_serial_dates` guards multi-tab `.xlsx`, Excel serial dates, multi-column tax/deduction summation, headerless sheets, semicolon CSV, UTF-16 TSV, and HTML-table `.xls` exports.
