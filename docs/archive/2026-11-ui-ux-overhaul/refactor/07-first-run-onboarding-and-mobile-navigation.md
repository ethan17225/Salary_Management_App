# 07 — Guided First-Run Onboarding & Mobile Navigation Ergonomics

- **Date**: 2026-11-19
- **Title**: Actionable First-Run Empty State & Ergonomic Mobile Navigation
- **Status**: Planned Refactor (Pain Point 7)
- **Primary Targets**:
  - `frontend/src/features/overview/components/overview-dashboard.tsx`
  - `frontend/src/features/paycheques/components/paycheque-dialog.tsx`
  - `frontend/src/components/layout/navbar.tsx`
  - `frontend/src/app/(dashboard)/layout.tsx`

---

## Description

A brand-new user opening Payday for the first time encounters a cold wall of `$0.00`, four `—` KPI boxes, three blank Chart.js grids, and a prompt to `"Press N to add one"` (which fails on touch devices and opens the Paycheque dialog before any Income Source exists). Simultaneously, on mobile screens (`< 768px`), the sticky top navbar wraps into a cramped two-row header that squeezes five links into one narrow row and consumes over 110px of vertical viewport space.

---

## Detailed Problem

### 1. Cold & Disconnected First-Run Empty State
In `frontend/src/features/overview/components/overview-dashboard.tsx:101-328`:
- When `sources.length === 0` or `paycheques.length === 0`, the dashboard still renders:
  - Four empty KPI cards (`—`, `No pay yet`, `0`, `None yet`)
  - Three empty Chart.js containers (`330px` + `260px` + `260px` of empty axes)
  - Four empty `Records` cells (`No paycheques yet.`)
- In `frontend/src/features/overview/components/latest-paycheques-list.tsx:22`:
  `"No paycheques yet. Press N to add one."` — unhelpful on phones/tablets without a hardware keyboard.
- In `frontend/src/features/paycheques/components/paycheque-dialog.tsx:153-184`:
  If `sources.length === 0` when the user clicks `Add paycheque`, the `Source` fieldset shows only `+ New source`, requiring the user to open a second modal stacked on top of the first modal before they can log a paycheque.

### 2. Cramped Mobile Sticky Header & Nav Pill Squeezing
In `frontend/src/components/layout/navbar.tsx:62-113`:
```tsx
<header className="sticky top-0 z-10 bg-bg/85 backdrop-blur-md border-b border-line">
  <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 md:gap-7 min-h-[68px] py-2.5 md:py-0">
    ...
    <nav className="order-3 md:order-none w-full md:w-auto flex gap-1" aria-label="Sections">
      {NAV_ITEMS.map((item) => (
        <Link className="flex-1 md:flex-initial ... px-2 md:px-4 ...">
```
- On viewports `< 768px` (e.g., `375px` iPhone SE / `390px` iPhone 15), `order-3 w-full` forces `<nav>` onto a second row below the logo + `Add paycheque` button, pushing the sticky header height to ~115px.
- Five links (`Overview`, `Paycheques`, `Taxes`, `Allocations`, `Sources`) forced into `flex-1` across `343px` (`375 - 32px` padding) average `~65px` per pill, causing `Paycheques` and `Allocations` to clip or push horizontally.

---

## Detailed Solutions

### Solution 1: Guided 3-Step First-Run Onboarding Card on Overview
When `paycheques.length === 0` in `OverviewDashboard`:
- Keep the Hero total at `$0.00` (or welcoming headline `"Welcome to Payday — track your true take-home"`), and replace the sea of blank KPI cards and empty Chart.js canvases with a focused **Get Started in 3 Steps** card:
  1. **Step 1 — Add an income source** (completed state with green checkmark once `sources.length > 0`, otherwise primary button `+ Add your first job or payer`).
  2. **Step 2 — Log your first paycheque** (enabled once a source exists, button `+ Log first paycheque`).
  3. **Step 3 — Set a yearly goal or allocation plan** (links to `Set a goal` or `/allocations`).
- Once at least 1 paycheque exists, automatically transition to the full analytics dashboard (and gently hide empty charts like `SourceSplitChart` when fewer than 2 sources exist, or replace with a useful single-source insight).

### Solution 2: Seamless Zero-Source Guard in `PaychequeDialog`
- If `PaychequeDialog` opens while `sources.length === 0`, display a clear inline prompt at the top of the dialog (*"First, name where this paycheque came from"*) with inline `Source Name` + `Kind` fields or a prominent 1-step creation card, avoiding confusing stacked `<dialog>` popups.
- Hide keyboard-only copy (`Press N`) on coarse pointers (`hidden [@media(pointer:fine)]:inline`) and always pair it with a clickable button on touch devices.

### Solution 3: Mobile Navigation Ergonomics & Safe Areas
- On `< md` (`< 768px`), choose one clean responsive navigation layout instead of a squeezed 5-way flex row:
  - Keep the top sticky header single-row (`Brand` + `Add paycheque` button, ~64px tall).
  - Render a **fixed bottom mobile navigation bar** (`md:hidden`, `pb-[env(safe-area-inset-bottom)]`, `bg-card/95 backdrop-blur-md border-t border-line`) with crisp icons + short labels (`Overview`, `Ledger`, `Taxes`, `Split`, `Sources`) and `min-h-[48px]` hit areas—plus `pb-24 md:pb-20` on `<main>` in `(dashboard)/layout.tsx` so content and toasts (`bottom-20 md:bottom-6`) never collide with the bottom bar.
  - Keep the existing horizontal pill nav inside `<header>` for `md:` (`>= 768px`) desktop/tablet viewports.

### Verification Criteria
- With an empty database (`0 sources`, `0 paycheques`), `/` presents a clear, inviting 3-step onboarding checklist instead of `$0` blank charts.
- On a `375px` mobile viewport, no nav item text wraps, truncates awkwardly, or overflows horizontally, and the bottom nav bar clears iOS home indicator safe areas.
- Triggering `Add paycheque` with 0 sources cleanly walks the user through creating a source without awkward modal stacking.
