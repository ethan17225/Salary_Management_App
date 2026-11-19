# 05 — Persistent `?year=` Across Navigation & URL-Synced Ledger Filters

- **Date**: 2026-11-19
- **Title**: Preserve Selected Year Across Navbar Tabs & Sync Paycheque Filters + CSV Export to URL
- **Status**: Planned Refactor (Pain Point 5)
- **Primary Targets**:
  - `frontend/src/components/layout/navbar.tsx`
  - `frontend/src/features/paycheques/components/paycheque-ledger.tsx`
  - `frontend/src/features/paycheques/components/paycheques-view.tsx`
  - `frontend/src/features/sources/components/source-paycheque-ledger.tsx`
  - `backend/src/paycheques/router.py` & `backend/src/paycheques/service.py`

---

## Description

When a user selects a past year (such as `2025` or `All`) on Overview and clicks over to **Taxes**, **Allocations**, or **Paycheques**, the navigation bar drops the `?year=` parameter and silently resets them back to the current year. Additionally, filters applied on `/paycheques` live only in client `useState` instead of the URL, cannot be cleared in one click, and are ignored by the `Export to CSV` button.

---

## Detailed Problem

### 1. Year Context Lost on Tab Switches
In `frontend/src/components/layout/navbar.tsx:9-15` and `80-95`:
```tsx
const NAV_ITEMS = [
  { href: '/', label: 'Overview', match: (p: string) => p === '/' },
  { href: '/paycheques', label: 'Paycheques', match: (p: string) => p.startsWith('/paycheques') },
  { href: '/taxes', label: 'Taxes', match: (p: string) => p.startsWith('/taxes') },
  { href: '/allocations', label: 'Allocations', match: (p: string) => p.startsWith('/allocations') },
  { href: '/sources', label: 'Sources', match: (p: string) => p.startsWith('/sources') },
] as const;
```
- All `<Link href={item.href}>` targets are static strings.
- If a user is reviewing `2025` (`/?year=2025`) and clicks `Taxes`, they land on `/taxes` which defaults back to `2026` (`curYear` in `resolveYearFilter`).
- Similarly, `/paycheques` defaults `initialFilters?.year` to `''` (all years) unless `?year=` is preserved in the link.

### 2. Local-Only Ledger Filters & Unfiltered CSV Export
In `frontend/src/features/paycheques/components/paycheque-ledger.tsx:26-28`:
```tsx
const [fYear, setFYear] = useState(initialFilters?.year || '');
const [fSource, setFSource] = useState(initialFilters?.source || '');
const [fSearch, setFSearch] = useState(initialFilters?.q || '');
```
- Changing Year, Source, or Search only updates React state; it never updates the URL query string (`?year=...&source=...&q=...`). Reloading the page, pressing Back from editing/viewing a source, or copying the URL loses all filter selections.
- There is no `"Clear filters"` button when filters are active (including in the empty state at `lines 223-225`: `"No paycheques match these filters."`).
- In `frontend/src/features/paycheques/components/paycheques-view.tsx:20-22`:
```tsx
<a className="btn w-full sm:w-auto" href="/api/export.csv" download>
  Export to CSV
</a>
```
  Clicking `Export to CSV` always downloads every paycheque in the database instead of respecting the active Year/Source/Search filters the user just narrowed down.

---

## Detailed Solutions

### Solution 1: Preserve `?year=` in `Navbar`
In `frontend/src/components/layout/navbar.tsx`:
- Read `useSearchParams()` inside `Navbar` (ensure `<Navbar />` is wrapped in `<Suspense>` or uses `useSearchParams` safely in Next.js App Router).
- Extract `activeYearParam = searchParams.get('year')`.
- For top-level routes that support year scoping (`/`, `/paycheques`, `/taxes`, `/allocations`, and `/sources/[id]`), append `?year=${encodeURIComponent(activeYearParam)}` to the `<Link href>` when `activeYearParam` is present.
- Also preserve `?year=` in `HASH_ROUTES` redirects (`navbar.tsx:42-47`).

### Solution 2: Sync `PaychequeLedger` & `SourcePaychequeLedger` Filters to URL Query Params
- In `PaychequeLedger` (and `SourcePaychequeLedger` for `q`):
  - Synchronize `fYear`, `fSource`, and `fSearch` back to URL query parameters via `router.replace(`${pathname}?${params.toString()}`, { scroll: false })` (debouncing `q` by ~200ms so typing stays silky-smooth, while keeping client state instant).
  - Sync state when `initialFilters` / `searchParams` change via browser Back/Forward navigation.
  - Display a filter summary bar (`"Showing X of Y paycheques · $Z total"`) and a `"Clear filters"` button whenever any filter is active—especially inside the empty state row.

### Solution 3: Filtered CSV Export Support
- Update `backend/src/paycheques/router.py:112` and `backend/src/paycheques/service.py:77` (`export_paycheques_csv` / `build_export_csv`) to accept optional query parameters `year: str | None = None`, `source_id: int | None = None`, and `q: str | None = None` (filtering in SQLAlchemy/Python cleanly).
- Update `PaychequesView` / `PaychequeLedger` so the `Export to CSV` action exports the active filtered query string (`/api/export.csv?year=...&source_id=...&q=...`) with a label reflecting scope (e.g., `"Export filtered CSV"` when filtered vs. `"Export all to CSV"` when unfiltered, or a compact dropdown offering both).

### Verification Criteria
- Selecting `2025` on `/` and clicking `Taxes`, `Allocations`, or `Paycheques` preserves `?year=2025` across tabs.
- Filtering `/paycheques` updates the URL (`?year=2025&source=2&q=bonus`) and survives a hard browser refresh.
- Clicking `Export filtered CSV` downloads only the rows matching the active filters, with proper CSV formula-injection escaping preserved via `_safe_csv_cell`.
