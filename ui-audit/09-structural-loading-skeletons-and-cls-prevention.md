# UI Audit 09 — Structural Loading Skeletons & CLS Prevention

- **Date**: 2026-11-19
- **Title**: Replace Generic Centered Loading Text Cards with Structural Layout Skeletons
- **Severity**: MEDIUM (`baseline-ui` Interaction / Core Web Vitals CLS)
- **Targets**:
  - `frontend/src/app/(dashboard)/loading.tsx`
  - `frontend/src/app/(dashboard)/sources/[id]/loading.tsx`

---

## Description

Both route-level Suspense fallbacks render a single small centered text box (`"Loading Payday…"` and `"Loading source details…"`). When the server component resolves into a Hero banner, 4-card KPI grid, and chart panels, the entire viewport jumps vertically from ~130px to >1000px, causing high Cumulative Layout Shift (CLS) and making navigation feel sluggish.

---

## Detailed Problem

### `frontend/src/app/(dashboard)/loading.tsx:1-8`
```tsx
export default function DashboardLoading() {
  return (
    <div className="card py-12 px-4 text-center text-muted" aria-busy="true">
      <p className="text-muted">Loading Payday…</p>
    </div>
  );
}
```
### `frontend/src/app/(dashboard)/sources/[id]/loading.tsx:1-8`
```tsx
export default function SourceDetailLoading() {
  return (
    <div className="card py-12 px-4 text-center text-muted" aria-busy="true">
      <p className="text-muted">Loading source details…</p>
    </div>
  );
}
```
- Notice both fail the `baseline-ui` rule: *"SHOULD use structural skeletons for loading states"*.
- Because `DashboardLayout` (`frontend/src/app/(dashboard)/layout.tsx:7`) uses `export const dynamic = 'force-dynamic'`, route transitions trigger server fetches where users directly experience these loading states.

---

## Detailed Solutions

1. **Create a reusable `Skeleton` primitive** in `frontend/src/components/ui/skeleton.tsx` (using subtle surface pulsing that honors `prefers-reduced-motion` via `motion-safe:animate-pulse` and `bg-surface` / `bg-white/15` for dark Hero skeletons).
2. **Update `app/(dashboard)/loading.tsx`** to mirror the dashboard grid structure:
   - Hero block (`rounded-[20px] bg-ink/90 p-7 min-h-[176px]`) with placeholder bars for title, hero counter, and `YearDropdown`.
   - 4-column KPI skeleton grid (`grid-cols-1 md:grid-cols-12 gap-4 mt-4`, four `md:col-span-6 lg:col-span-3` `.card` skeletons).
   - Chart + side-stack skeleton grid (`lg:col-span-8` chart card `h-[390px]` + `lg:col-span-4` two stacked cards).
   - Keep `role="status"` and `<span className="sr-only">Loading dashboard…</span>` with `aria-busy="true"`.
3. **Update `app/(dashboard)/sources/[id]/loading.tsx`** to include the back-link + header action bar skeleton (`min-h-[44px] mb-[18px]`), Source Hero skeleton, 4 KPI cards, and table skeleton.

### Verification Criteria
- Navigating between `/`, `/paycheques`, `/taxes`, `/allocations`, and `/sources/[id]` under network throttling shows stable structural placeholders matching real card geometry with minimal layout shift.
- Pulsing animations automatically disable under `prefers-reduced-motion: reduce`.
