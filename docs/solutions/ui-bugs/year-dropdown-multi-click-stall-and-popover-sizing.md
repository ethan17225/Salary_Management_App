---
title: Hero YearDropdown multi-click navigation stall, popover sizing mismatch, and missing Net label
date: 2026-11-21
category: ui-bugs
module: overview
problem_type: ui_bug
component: frontend
symptoms:
  - "Switching year in the hero YearDropdown worked on the first selection, then required 2-3 clicks on subsequent switches even though `GET /?year=...&_rsc=...` returned 200 OK with zero console errors"
  - "Native `<select>` popup opened over the trigger using OS-controlled sizing instead of matching the component width directly underneath"
  - "Closed YearDropdown trigger pill omitted the `Net $...` total displayed in the expanded option rows"
root_cause: async_timing
resolution_type: code_fix
severity: high
framework_version: "next 15.5.29 / react 19.3.1"
tags:
  - year-dropdown
  - nextjs-app-router
  - suspense
  - loading-boundary
  - history-pushstate
  - server-only
  - custom-listbox
  - accessibility
---

# Hero YearDropdown multi-click navigation stall, popover sizing mismatch, and missing Net label

## Problem

Selecting a different year in the dashboard hero `YearDropdown` succeeded on the first switch, then silently stalled on subsequent switches so users had to click an option 2–3 times before the page updated—even though every `?_rsc=` request returned `200 OK` and the console showed no errors. In addition, using a native `<select>` forced OS-positioned menus over the trigger, and replacing it with a custom listbox initially omitted the `Net` total on the closed pill while listing `Net $...` on the dropdown rows.

## Symptoms

- On `/` (Overview), the first year change updated the URL and UI normally; subsequent changes required 2–3 selections before committing.
- Network traces showed `GET /?year=...&_rsc=...` returning `200 OK` (26–49ms), after which the controlled `<select value={String(activeYear)}>` snapped back to the previous year within 21–33ms with zero JavaScript console errors.
- React fiber diagnostics in-session showed `FiberRoot.pendingLanes` and `FiberRoot.suspendedLanes` entangled as equal masks (`30720`, `63488`, `917504`, `1966080`, `4063232`, `4064000`, `pingedLanes: 0`), leaving the App Router transition uncommitted.
- Native `<select>` rendered its menu over the trigger with OS-determined width rather than directly below the trigger matching its width.
- After converting the trigger to a custom `role="listbox"`, option rows rendered `Net {fmt(tot)}` while the closed button only showed the year label.

## What Didn't Work

1. **Keeping `router.push(...)` with a native `<select>` on a route segment wrapped by `loading.tsx`**:
   Under `frontend/src/app/(dashboard)/loading.tsx` (and `frontend/src/app/(dashboard)/sources/[id]/loading.tsx`), changing only the `?year=` query string on `'/'` hit Next.js's aliased prefetch handling (`handleAliasedPrefetchEntry` in `frontend/node_modules/next/dist/client/components/router-reducer/aliased-prefetch-navigations.js`) against the param-less `'/'` entry, creating cache nodes with `rsc: null` and suspending `InnerLayoutRouter` inside React `startTransition` while `pendingLanes === suspendedLanes` prevented commit.
2. **Calling `window.history.pushState(...)` followed synchronously by `router.refresh()`**:
   Next.js patches `window.history.pushState` to dispatch `ACTION_RESTORE`. In `dispatchAction` (`frontend/node_modules/next/dist/client/components/app-router-instance.js`), `ACTION_RESTORE` does not replace React's state with a pending `deferredPromise` synchronously; instead, `runAction` runs `async (state, action) => reducer(state, action)` and calls `setState(restoredState)` on the next microtask. Calling `router.refresh()` synchronously right after `pushState` queued `ACTION_REFRESH` and called `startTransition(() => setState(deferredPromise_refresh))`, which the resolving `ACTION_RESTORE` microtask immediately overwrote with `restoredState`—leaving the rendered `__PAGE__` tree stale despite `200 OK` `_rsc=` responses and desynchronizing Back/Forward navigation.
3. **Importing `AddSourceButton` from `@/features/sources` after converting `OverviewDashboard` to `'use client'`**:
   Turning `frontend/src/features/overview/components/overview-dashboard.tsx` into a Client Component caused `next build` to fail because `@/features/sources` (`frontend/src/features/sources/index.ts`) re-exports `getSourcesData` and `getSourceById`, which execute `import 'server-only'`.
4. **Relying on native `<select>` or hiding `Net` on the closed pill**:
   Native `<select>` cannot be reliably anchored directly below the trigger at matching container width on macOS/Chrome, and showing `Net {fmt(tot)}` only inside the open menu created a visual mismatch between the closed summary pill and its expanded choices.

## Solution

1. **Client-side year slicing + `window.history.pushState` URL updates**:
   - Extracted pure year-filtering helpers (`computeOverviewYearSlice` in `frontend/src/features/overview/lib/compute-overview.ts`, `computeSourceYearSlice` in `frontend/src/features/sources/lib/compute-source-detail.ts`) and added an optional `todayOverride?: string` parameter to `resolveYearFilter` in `frontend/src/lib/utils.ts` so server renders and client memos use a deterministic reference date.
   - Loaded full paycheque datasets once per server render (`getOverviewData` in `frontend/src/features/overview/services/get-overview-data.ts`, `getSourceById` in `frontend/src/features/sources/services/get-source-by-id.ts`, and `frontend/src/app/(dashboard)/taxes/page.tsx`, `frontend/src/app/(dashboard)/allocations/page.tsx`), then filtered client-side via `useSearchParams()` + `useMemo()` in `OverviewDashboard`, `TaxesDashboard`, `AllocationsDashboard`, and `SourceDetailView`.
   - Updated `YearDropdown.handleSelect` (`frontend/src/components/ui/year-dropdown.tsx`) and `SourceDetailView.handleYearLinkClick` (`frontend/src/features/sources/components/source-detail-view.tsx`, preserving modifier/non-primary clicks) to call `window.history.pushState(null, '', ...)`, letting Next.js's patched `pushState` run `ACTION_RESTORE` cleanly so `useSearchParams()` updates across `Navbar` and dashboard views and browser Back/Forward history works on the first click without `_rsc=` Suspense transitions:

```tsx
const handleSelect = (val: string | number) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set(paramName, String(val));
  // ponytail: pushState + client-side year slicing avoids Next 15's aliased loading.tsx Suspense transition stall on search-param changes.
  window.history.pushState(null, '', `${pathname}?${params.toString()}`);
  setOpen(false);
  triggerRef.current?.focus();
};
```

2. **Direct client-component import to avoid `'server-only'` barrel pollution**:
   In `frontend/src/features/overview/components/overview-dashboard.tsx`, imported `AddSourceButton` directly from `@/features/sources/components/source-detail-actions` instead of the `@/features/sources` barrel.

3. **Accessible, full-width, below-trigger `role="listbox"` popover with consistent `Net` summary**:
   Rebuilt `YearDropdown` (`frontend/src/components/ui/year-dropdown.tsx`) with:
   - Container `w-full sm:w-auto min-w-[232px]` and trigger `w-full` so the closed pill and open `<ul>` (`absolute top-[calc(100%+8px)] left-0 w-full z-25`) share the exact same width with the menu anchored 8px below the trigger.
   - Full ARIA & keyboard handling (`aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, `ArrowDown`/`ArrowUp`/`Home`/`End`/`Escape`/`Tab`, focus restoration via `triggerRef.current?.focus()`, and outside `pointerdown` dismissal).
   - Matching net totals in both states: `{activeOption[1]} · Net {fmt(activeOption[2])}` (`whitespace-nowrap`) in the closed pill and `Net {fmt(tot)}` in each option button.

## Why This Works

- **Eliminates Suspense transition lane deadlock**: Because all paycheques for the user are already fetched during the initial SSR render, `?year=` changes never trigger an aliased `loading.tsx` Suspense fetch or concurrent `startTransition` that can stall React 19 when `pendingLanes === suspendedLanes`.
- **Works with Next.js's `ACTION_RESTORE` instead of racing it**: Calling `window.history.pushState` alone triggers Next.js's synchronous-feeling `ACTION_RESTORE` pipeline without queuing a competing `router.refresh()` `deferredPromise` that gets overwritten 1 microtask later. As a result, `useSearchParams()` propagates the updated `?year=` synchronously after restore to `YearDropdown`, `OverviewDashboard`, `TaxesDashboard`, `AllocationsDashboard`, `SourceDetailView`, and `Navbar`.
- **Deterministic server/client hydration**: Passing the server-computed `today` (`todayOverride`) into client-side `resolveYearFilter` calls avoids midnight/timezone drift between SSR and client memos.
- **Native-free predictable layout**: Rendering an owned `role="listbox"` popover with `left-0 w-full` and `top-[calc(100%+8px)]` guarantees the menu matches the pill's width and opens below it across browsers while retaining full keyboard and screen-reader semantics.

## Prevention

- **Avoid `router.push` / `router.refresh()` for pure query-param filtering inside `loading.tsx` segments**: When a filter only slices data already loaded on the page (such as `?year=`), compute the slice client-side from `useSearchParams()` and update the URL via `window.history.pushState` (unless a server re-fetch is genuinely required for un-fetched records).
- **Keep `'server-only'` modules out of barrels imported by Client Components**: Either split client and server barrels or import client UI symbols directly from their defining files rather than a feature `index.ts` that also exports `db`/data services.
- **Verify multi-click transitions & popover geometry in a real browser**: Test `?year=` switching across at least 3 consecutive selections and confirm `listbox` `width === trigger.width`, `listbox.top > trigger.bottom`, zero horizontal overflow, and consistent label formatting on both the closed trigger and open options. (No frontend test or browser runner is currently installed in `frontend/package.json`; add this multi-click URL-switch smoke check if Playwright or Vitest is adopted.)

## Related Issues

- Contradicts/supersedes the native `<select>` recommendation in `docs/archive/2026-11-ui-ux-overhaul/master-plan.md` (Section 1.3), which remains flagged for documentation refresh.
- Incorporates the ARIA listbox keyboard and focus requirements from `docs/archive/2026-11-ui-ux-overhaul/ui-audit/03-year-dropdown-keyboard-navigation-and-focus.md` and the `Net` label clarity requirement from `docs/archive/2026-11-ui-ux-overhaul/refactor/04-hero-consistency-tax-math-and-plain-copy.md`.
- Persistent `?year=` navigation behavior aligns with `docs/archive/2026-11-ui-ux-overhaul/refactor/05-persistent-year-and-url-filter-state.md`; `loading.tsx` boundaries are described in `docs/archive/2026-11-ui-ux-overhaul/ui-audit/09-structural-loading-skeletons-and-cls-prevention.md`.
