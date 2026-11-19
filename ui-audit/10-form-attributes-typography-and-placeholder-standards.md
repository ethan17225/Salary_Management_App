# UI Audit 10 — Form Attributes, Typography Details & Placeholder Standards

- **Date**: 2026-11-19
- **Title**: Standardize Form `name`/`autoComplete`, Trailing Ellipses (`…`), Heading Wrapping (`text-balance`/`text-pretty`) & Safe Input Attributes
- **Severity**: MEDIUM (Web Interface Guidelines: Forms, Typography & Content Handling)
- **Targets**:
  - `frontend/src/features/paycheques/components/paycheque-ledger.tsx:93-100`
  - `frontend/src/features/sources/components/source-paycheque-ledger.tsx:66-72`
  - `frontend/src/features/overview/components/goal-dialog.tsx:56-66`
  - `frontend/src/features/paycheques/components/paycheque-dialog.tsx:194-260, 316-346`
  - `frontend/src/features/sources/components/source-dialog.tsx:106-113, 161-171`
  - `frontend/src/features/allocations/components/allocations-dashboard.tsx:466-516, 573-616`
  - `frontend/src/styles/globals.css:91-93`

---

## Description

Multiple forms across the application omit `name` and `autoComplete="off"` attributes (risking browser password-manager autofill popups on financial fields like `Name` or `Goal`), omit trailing ellipses (`…`) on placeholders, and lack `text-balance` / `text-pretty` CSS wrapping rules on headings and prose.

---

## Detailed Problem

### 1. Missing `name`, `autoComplete="off"`, and Trailing Ellipsis `…` on Inputs
- `frontend/src/features/paycheques/components/paycheque-ledger.tsx:94-99`:
  `<input type="search" ... placeholder="Note, source or amount" />`
  Missing `name="q"`, `autoComplete="off"`, and trailing `…` (`"Note, source, or amount…"`).
- `frontend/src/features/overview/components/goal-dialog.tsx:56-66`:
  `<input ... placeholder="30000" />`
  Missing `name="goal"`, `autoComplete="off"`, and example pattern `…` (`placeholder="30000…"` or `"e.g., 55000"` → `"55000…"`).
- `frontend/src/features/sources/components/source-dialog.tsx:106-113`:
  `<input ... placeholder="Employer or payer" />`
  Missing `name="name"`, `autoComplete="off"`, and trailing `…` (`"Employer or payer…"`).
- `frontend/src/features/allocations/components/allocations-dashboard.tsx:573-580`:
  `<input ... placeholder="e.g., TFSA / Index Funds" />`
  Missing `name="name"`, `autoComplete="off"`, and trailing `…` (`"TFSA / Index Funds…"`).
- `frontend/src/features/paycheques/components/paycheque-dialog.tsx:194-205, 316-346`:
  Amount, Gross, Tax, Deductions, Date, Hours, and Note inputs lack explicit `name` and `autoComplete="off"`.

### 2. Typography Wrapping (`text-balance` & `text-pretty`) & Heading Hierarchy
- `globals.css:91-93`: `h1, h2, p, dl, dd` do not set `text-wrap: balance` on `h1, h2, h3` or `text-wrap: pretty` on `p`. As a result, longer titles like `"Gross-to-Net & Tax Retention Bar"` or `"Paystub Breakdowns & Reserve Ledger"` and explanatory descriptions can wrap with single-word widow lines on mobile/tablet widths.
- `frontend/src/app/global-error.tsx:15`: renders an `<h2>` with no `<h1>` on the error screen (`Rams` WCAG 1.3.1 skipped heading level).
- `frontend/src/app/not-found.tsx:6-7`: renders a `<p>` instead of an `<h1>` heading.

### 3. Currency/Number Formatting Hardcoding Check
- `frontend/src/lib/utils.ts:13-16`: `shortCurrency` hardcodes `'$'` (`$${...}k`) instead of respecting `Intl.NumberFormat` currency formatting (`CAD` `$`), and `source-detail-view.tsx:125` writes `~$${fmt(upcomingForSource.amount)}`—wait! Let's double check line 125 of `source-detail-view.tsx`:
  `source-detail-view.tsx:125`: ``~${fmt(upcomingForSource.amount)}``! Wait: `fmt(...)` ALREADY returns `$2,150.00`, so ``~${fmt(...)}`` renders **`~$2,150.00`**, whereas if it were written `~$${fmt(...)}` it would double-dollar; right now line 125 literally reads `` `Next est. ... · ~${fmt(upcomingForSource.amount)}` `` which evaluates to `~$2,150.00` (good, though `≈` is used in `overview-dashboard.tsx:245` while `~` is used in `source-detail-view.tsx:125` — inconsistent symbol!).

---

## Detailed Solutions

1. **Global Typography Rules in `frontend/src/styles/globals.css`**:
   ```css
   h1, h2, h3 {
     text-wrap: balance;
   }

   p {
     text-wrap: pretty;
   }
   ```
2. **Standardize All Form Inputs**:
   - Add explicit `name` attributes and `autoComplete="off"` on all non-auth `<input>` and `<select>` fields across `PaychequeDialog`, `SourceDialog`, `GoalDialogTrigger`, `AllocationsDashboard`, `PaychequeLedger`, and `SourcePaychequeLedger`.
   - Ensure all placeholders end with `…` (e.g., `"Employer or payer…"`, `"Note, source, or amount…"`, `"TFSA / Index Funds…"`, `"30000…"`).
   - Ensure `spellCheck={false}` on numeric/search filter codes if appropriate.
3. **Fix Heading Semantics on Error & Not-Found Pages**:
   - Change `<h2>` → `<h1>` in `frontend/src/app/global-error.tsx:15`.
   - Add `<h1>` in `frontend/src/app/not-found.tsx:7`.
4. **Unify Approximate Symbol (`≈`)**:
   - Use `≈` consistently in `source-detail-view.tsx:125` to match `overview-dashboard.tsx:245`.

### Verification Criteria
- Every form input has an explicit `name`, `autoComplete="off"`, and `<label>` association.
- Every placeholder uses trailing `…` consistently.
- Headings wrap cleanly without single-word orphans (`text-wrap: balance`), and error/404 pages start at `<h1>`.
