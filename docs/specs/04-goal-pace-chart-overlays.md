---
status: shipped
date: 2026-11-19
commits: [f7d4f27]
---

# Feature 4 — Goal Pace Target Line on Charts & Pacing Projections

- **Date**: 2026-11-19
- **Title**: Annual Goal Target Pace Lines & Ahead/Behind Delta Indicators on Overview Charts
- **Status**: Shipped (commit `f7d4f27`; originally Wishlist Item 5)
- **Primary Targets**:
  - `frontend/src/features/overview/components/overview-charts.tsx`
  - `frontend/src/features/overview/components/overview-dashboard.tsx`
  - `frontend/src/features/overview/services/get-overview-data.ts`
  - `frontend/src/features/overview/types/overview-types.ts`

---

## Description

When a user sets a yearly take-home income goal (e.g., `$60,000`), Payday computes a progress bar and pace text inside the **Yearly goal** card, but the adjacent **Monthly income by source** bar chart and **Cumulative income** line chart show no visual reference for that target. Overlaying a subtle dashed target pace line on both charts lets users see at a glance which months met their monthly target (`$5,000/mo`) and whether their year-to-date cumulative earnings curve is tracking ahead of or behind schedule.

---

## Detailed Problem

### 1. Charts Are Disconnected from the Active Annual Goal
In `frontend/src/features/overview/components/overview-dashboard.tsx:148-209` and `259-273`:
- `OverviewDashboard` passes `goal`, `goalYear`, `goalSum`, `goalPct`, `daysInYr`, and `daysDone` only to the `Yearly goal` card (`lines 162-209`).
- `MonthlyIncomeChart` (`overview-charts.tsx:73-139`) and `CumulativeIncomeChart` (`overview-charts.tsx:151-263`) receive no `goal` prop at all.
- A user looking at `Monthly income by source` sees bars of `$4,200`, `$5,400`, `$4,800`, etc., with no horizontal benchmark indicating that `$5,000/month` is needed to hit their `$60,000` annual target.
- On `CumulativeIncomeChart`, the user can compare `2026` against `2025`, but if they have no `2025` history—or if their `2026` goal is higher than `2025`—they have no diagonal target slope showing where their cumulative line *should* be by the current month.

### 2. Missing Instant Ahead/Behind Dollar Delta on the Goal Card
In `frontend/src/features/overview/components/overview-dashboard.tsx:191-205`:
- The Yearly Goal card reports `"On pace for $X by Dec 31"`, which extrapolates linearly, and `"$Y a month from here hits it"`.
- It does not explicitly report how many dollars ahead or behind schedule the user is *right now* relative to the straight-line YTD calendar target (`goal * (daysDone / daysInYr)`).

---

## Detailed Solutions

### Solution 1: Pass Goal Context to Overview Charts (`MonthlyIncomeChart` & `CumulativeIncomeChart`)
Extend `OverviewData` / component props so `goal` (in cents) is passed to `MonthlyIncomeChart` and `CumulativeIncomeChart` when `!isAll && goal > 0`:
1. **`MonthlyIncomeChart` — Monthly Target Line**:
   - Compute `monthlyTargetDollars = (goal / 100) / 12`.
   - Register a lightweight inline Chart.js dataset (`type: 'line'` mixed onto the bar chart, or a custom Chart.js horizontal reference plugin) drawing a crisp dashed horizontal rule at `monthlyTargetDollars` (`borderColor: '#0d7480'`, `borderDash: [6, 4]`, `borderWidth: 1.5`, `pointRadius: 0`) labeled `Monthly goal ($X)`.
   - Ensure stacked bars stay on `stack: 'income'` while the target line stays unstacked (`order: 0`) so it renders cleanly across all 12 months.
2. **`CumulativeIncomeChart` — Cumulative Target Trajectory**:
   - Add a subtle dashed target dataset for the 12 months (`MONTHS.map((_, m) => ((goal / 100) * (m + 1)) / 12)`) labeled `${activeYear} goal pace`.
   - Keep `pointRadius: 0`, `borderDash: [4, 4]`, `borderColor: 'rgba(13, 116, 128, 0.55)'`, so the solid actual curve (`#0d7480`) immediately reveals gaps or surpluses against the goal slope.

### Solution 2: Ahead / Behind Schedule Badge in Yearly Goal Card
In `frontend/src/features/overview/services/get-overview-data.ts` and `overview-dashboard.tsx`:
- Compute `expectedToDateCents = Math.round((goal * daysDone) / daysInYr)` and `paceDeltaCents = goalSum - expectedToDateCents`.
- In the `Yearly goal` card (when `goalIsCur && goal > 0`), render a status pill beside the percentage:
  - If `paceDeltaCents >= 0`: green pill `▲ ${fmt(paceDeltaCents)} ahead of pace`
  - If `paceDeltaCents < 0`: muted/amber pill `▼ ${fmt(Math.abs(paceDeltaCents))} behind pace`

### Verification Criteria
- Setting a `$60,000` annual goal immediately renders a `$5,000` dashed monthly target line on `Monthly income by source` and a `$5k → $60k` linear target curve on `Cumulative income`.
- Removing the goal or switching to `All` years hides the annual goal overlays cleanly without console errors or Chart.js scale glitches.
- Tooltip interactions continue to show stacked source totals cleanly without treating the monthly target line as part of the stacked income sum.
