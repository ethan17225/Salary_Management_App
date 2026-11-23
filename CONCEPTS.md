# Concepts

> Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound captures and refreshes learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Income & Ingestion

### Source
An income payer — categorized as a job, government transfer, or other — that owns Paycheques and declares whether tax is withheld at source, an optional contractor tax reserve rate, and a pay schedule.

A Source that has recorded Paycheques cannot be deleted and must be archived instead so historical income totals remain intact.

### Paycheque
A single recorded income deposit tied to one Source, storing take-home pay along with optional gross pay, tax, deductions, and hours worked.

Gross pay must be at least take-home pay, and the sum of tax and deductions cannot exceed the difference between gross and take-home; supplying tax or deductions without gross automatically derives gross from take-home plus withheld amounts. Bulk imports deduplicate Paycheques deterministically by Source, pay date, and take-home amount.

### Two-Stage Import
Payday's split ingestion workflow separating candidate extraction (the Parse stage) from atomic persistence (the Import stage).

The Parse stage reads an uploaded spreadsheet (`.csv`, `.tsv`, `.xlsx`, `.xlsm`, `.ods`, HTML/text `.xls`), PDF, or image (paystub, cheque, or net-only deposit notice/e-Transfer) into unpersisted candidate rows carrying confidence scores, review warnings, optional sheet/column previews, and a persisted diagnostic trace without modifying saved Paycheques. The Import stage validates, deduplicates, and atomically commits the user-reviewed rows.

### Source Alias
A persistent mapping in SQLite (`source_aliases`) linking a raw payer or corporate name seen on a document (such as `5024721 ONTARIO LIMITED`) to a canonical `Source`.

When a user renames a parsed source during Import review and commits the rows, Payday records the alias automatically so future Parse and Import runs resolve that raw name deterministically.

### Sheet Preview & Interactive Mapping
Structured grid metadata (`ParsedSheetPreview`) returned by the Parse stage for multi-sheet or multi-section spreadsheets, allowing users to switch sheet tabs/dropdowns, adjust the header/start row, set default source or year values, and remap columns (including split `Month` / `Day` / `Year` date columns with forward-filled months) inside `ImportDialog` before committing.

### Statutory Withholding
A mandatory government payroll withholding deducted from gross pay, such as income tax, pension contributions (CPP/QPP, Social Security), or employment insurance (EI, Medicare).

When a paystub lists itemized withholdings without matching printed Tax and Deductions totals during vision extraction, Payday aggregates Statutory Withholdings under Tax so withheld amounts reconcile with gross and take-home pay; on manual entry and statements with already-balanced summary totals, non-income-tax statutory contributions (such as CPP and EI) remain in Deductions when grouped there by the user or statement.

### Import Pipeline Log
A persisted diagnostic record of a single Parse or Import run capturing ordered intermediate extraction outputs, warnings, errors, and the returned summary.

Each Import stage log can link back to the Parse stage log that generated its candidate rows, allowing comparison between extracted values and user-corrected commits.

## Flagged ambiguities
- *"Deductions" varies by entry path and statement layout: manual entry and pre-summarized paystubs can place statutory contributions (CPP, EI) in Deductions, whereas automated itemized vision extraction without separate reconciled totals rolls Statutory Withholdings together under Tax.*
