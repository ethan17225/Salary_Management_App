---
title: Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation
date: 2026-11-23
category: ui-bugs
module: paycheques
problem_type: ui_bug
component: frontend
symptoms:
  - "Clicking `#1`, `softchoice_adp.pdf`, `Inspect`, or mobile `Inspect log` on `/paycheques/logs` sent `GET /paycheques/logs/1?_rsc=...` and received `200 OK` (`text/x-component`), yet URL and DOM stayed on `/paycheques/logs` with zero console errors"
  - "Direct navigation or reload of `/paycheques/logs/1` worked, and `<Link>` navigation to `/sources/1` (`SourceDetailView`, a Client Component) worked"
root_cause: async_timing
resolution_type: code_fix
severity: high
framework_version: "next 15.5.29 / react 19.3.1"
tags:
  - nextjs-app-router
  - rsc
  - react-server-dom-webpack
  - suspense
  - client-boundary
  - history-pushstate
---

# Next.js 15 RSC multi-chunk synchronous ping deadlock on Link navigation

## Problem

On `/paycheques/logs`, clicking any detail link (`#1`, the filename, `Inspect`, or mobile `Inspect log`) triggered the RSC request and received a valid `200 OK` Flight payload from Next.js and `200 OK` from the FastAPI backend, yet client-side navigation never committed.

## Symptoms

- Clicking `#1`, `softchoice_adp.pdf`, `Inspect`, or mobile `Inspect log` on `/paycheques/logs` (as well as `/paycheques/logs?year=2026` or after navigating from `/paycheques`) issued `GET /paycheques/logs/1?_rsc=...` returning `200 OK` (`text/x-component`, 34,902 bytes) and backend `GET /api/paycheques/import-logs/1 200 OK`.
- `location.href` and the rendered DOM stayed on `/paycheques/logs` (`h1: "Import logs"`), `history.pushState` never fired, and Chrome reported zero console or uncaught errors.
- Navigating directly to `/paycheques/logs/1` rendered `softchoice_adp.pdf` normally, and sibling dynamic `<Link>` navigation from `/sources` to `/sources/1` (`SourceDetailView`, a Client Component) committed normally.

## What Didn't Work

1. **`async` `window.fetch` instrumentation**: Wrapping `window.fetch` in an `async function` during CDP debugging masked the race by introducing two extra microtask ticks, allowing all 13 Flight chunks to finish arriving before React suspended mid-tree. Both native `fetch` and a synchronous `window.fetch` pass-through wrapper reproduced the stall reliably.
2. **Investigating `ImportLogsView`'s `window.history.replaceState` and `Next-Router-State-Tree`**: Comparing `/sources` and `/paycheques/logs` headers showed `actionQueue.state` had already processed `ACTION_SERVER_PATCH` (`canonicalUrl: "/paycheques/logs/1"`, with the `id|1|d` cache node populated and `rsc` present), meaning Next.js's router reducer succeeded while React's fiber commit stalled.
3. **Checking only direct URL loads or HTTP `200 OK` status**: Direct document navigation (`/paycheques/logs/1`) and HTTP RSC curl checks both returned `200 OK` and masked the client `<Link>` transition race.

## Root Cause

`ImportLogDetailView` (`frontend/src/features/paycheques/components/import-log-detail-view.tsx`) was authored as a Server Component (missing `'use client';`). Because it rendered a large JSX tree (~35 KB across the hero, step timing bar, 7 collapsible `<details>` steps, and raw JSON `<pre>` blocks), Next.js `15.5.29` / React `19.3.1` serialized the `/paycheques/logs/1?_rsc=...` Flight stream across 13 separate outlined model chunks (`4:`, `11:` through `1d:`).

Live React Fiber and `pingCache` inspection in headless Chrome pinpointed the deadlock:

- React Fiber root state after clicking `<Link href="/paycheques/logs/1">`: `FiberRoot.pendingLanes === 14336`, `suspendedLanes === 14336`, `entangledLanes === 14336`, `pingedLanes === 0`.
- `WeakMap.prototype.set` instrumentation on React's `pingCache` captured the failing chunk `12:` (`Step timing breakdown`): `beforeStatus: "resolved_model"`, `pingFired: true`, `pingSync: true`, `afterStatus: "fulfilled"`.
- In `react-server-dom-webpack`, when React suspends on a child Flight chunk whose status is already `"resolved_model"`, React attaches a ping listener (`attachPingListener`, `iO`) calling `chunk.then(pingSuspendedRoot, ...)`. `Chunk.prototype.then` synchronously invokes `initializeModelChunk` (`F`), transitions the chunk to `"fulfilled"`, and fires `pingSuspendedRoot` (`iM`) **synchronously** inside `then()` before React finishes unwinding and calls `markRootSuspended(root, lanes)`. Inside `pingSuspendedRoot`, `root.pingedLanes |= root.suspendedLanes & lanes` evaluates to `0` because `root.suspendedLanes` does not yet contain those transition lanes. React then marks the lanes suspended with `pingedLanes === 0`, permanently stranding the transition.

## Solution

Added `'use client';` to `ImportLogDetailView` in [import-log-detail-view.tsx](../../../frontend/src/features/paycheques/components/import-log-detail-view.tsx#L1-L5), aligning it with `SourceDetailView` and `ImportLogsView`:

```tsx
'use client';

// Client boundary keeps /paycheques/logs/[id] to a single Flight chunk and avoids the
// Next.js 15.5.29 multi-chunk resolved_model synchronous-ping transition deadlock.
import Link from 'next/link';
```

- `ImportLogDetailPage` (`frontend/src/app/(dashboard)/paycheques/logs/[id]/page.tsx`) remains an async Server Component that validates `id`, fetches `getImportLogById(numId)`, handles `notFound()`, and passes serialized JSON props into `ImportLogDetailView`.
- In the rebuilt `GET /paycheques/logs/1?_rsc=...` response, the 13 outlined JSX chunks (`4:`, `11:`..`1d:`) collapsed to a single `ImportLogDetailView` client-reference chunk (`f:I[..., "ImportLogDetailView"]` and `outlinedJsxCount: 1`).

## Why This Works

- **Eliminates multi-chunk Flight suspension mid-render**: Streaming serialized `log` props to one `'use client'` component instead of 13 outlined `$L` JSX sub-chunks prevents `attachPingListener` from encountering an already-`"resolved_model"` child chunk mid-transition.
- **Preserves SSR and hydration safety**: `ImportLogDetailView` has zero `server-only` imports, and `formatUtcTimestamp` formats dates with an explicit `timeZone: 'UTC'` option.

## Prevention

- Keep rich dashboard list/detail view components under `frontend/src/features/*/components/*-view.tsx` as `'use client'` boundaries fed serialized JSON props from thin Server Component `page.tsx` routes.
- Keep `server-only` data services out of barrels or modules imported by those `'use client'` view components.
- Verify dynamic App Router `<Link>` navigation (desktop + mobile + `?year=` query preservation) in headless Chrome without `async` `window.fetch` instrumentation wrappers rather than relying solely on direct URL loads or `200 OK` network checks.

## Related Issues

- [Hero YearDropdown multi-click navigation stall, popover sizing & Net label](./year-dropdown-multi-click-stall-and-popover-sizing.md) (`next 15.5.29 / react 19.3.1` transition stall with `pendingLanes === suspendedLanes` and `pingedLanes: 0`).
- [nextjs-project-architect SKILL.md](../../../.agents/skills/nextjs-project-architect/SKILL.md) (Section 3 `'use client'` view-boundary exception).
