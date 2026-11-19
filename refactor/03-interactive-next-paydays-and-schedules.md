# 03 — Actionable "Next Paydays" & Explicit Source Pay Schedules

- **Date**: 2026-11-19
- **Title**: 1-Click "Log Deposit" on Predicted Paydays & Explicit Source Pay Schedules
- **Status**: Planned Refactor (Pain Point 3 + Paired Feature Wishlist Item 2)
- **Primary Targets**:
  - `frontend/src/features/overview/components/overview-dashboard.tsx`
  - `frontend/src/features/sources/components/source-dialog.tsx`
  - `frontend/src/features/sources/schemas/source-schema.ts`
  - `frontend/src/lib/utils.ts` (`computeUpcomingPaydays`)
  - `frontend/src/types/payday.ts`
  - `backend/src/sources/models.py` & `backend/src/sources/schemas.py`

---

## Description

The Overview dashboard includes an algorithmic **Next paydays** card that predicts when each active source will pay next and approximately how much. However, those predictions are currently read-only text with no way to log the predicted deposit in one click, and new sources must accumulate 3 historical paycheques before any prediction appears.

---

## Detailed Problem

### 1. Predicted Paydays Are Read-Only Dead Ends
In `frontend/src/features/overview/components/overview-dashboard.tsx:211-255`:
```tsx
<li
  key={u.source.id}
  className="flex items-center gap-3 py-3 border-t border-line first:border-t-0 first:pt-0.5"
>
  <span
    className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
    style={{ '--c': u.source.color } as CSSProperties}
  />
  <span className="flex-1 min-w-0 grid">
    <b className="font-medium">{u.source.name}</b>
    <span className="text-sm text-muted">
      {dateLabel(u.next, ...)} · {when} · every {u.gap} days
    </span>
  </span>
  <span className="num">≈ {fmt(u.amount)}</span>
</li>
```
- `OverviewDashboard` is a Server Component and renders each upcoming payday as plain non-interactive text.
- Even when a payday is `today`, `tomorrow`, or `2 days late`, the user cannot click the item to confirm and log that deposit; they must click `+ Add paycheque`, select the source, and re-type the date and amount manually.

### 2. Three-Paycheque Cold Start & Rigid Median-Gap Heuristic
In `frontend/src/lib/utils.ts:87-114`:
```ts
// ponytail: median-gap heuristic; add explicit recurrence rules if schedules get irregular.
export function computeUpcomingPaydays(
  sources: Source[],
  paycheques: Paycheque[],
  today: string
): UpcomingPayday[] {
  ...
  if (ps.length < 3) return null;
```
- A user who just started a new job or began using Payday cannot configure *"I get paid bi-weekly on Fridays"* or *"1st and 15th of each month"*.
- Consequently, `OverviewDashboard` shows: *"Log three paycheques from a source and Payday learns its schedule"* for 4–6 weeks on a bi-weekly job, and `15th / last day` semi-monthly pay cycles drift under a fixed median-day gap.

---

## Detailed Solutions

### Solution 1: Interactive `UpcomingPaydaysList` Client Component
Extract the `Next paydays` list from `overview-dashboard.tsx` into a Client Component (e.g., `frontend/src/features/overview/components/upcoming-paydays-list.tsx`):
- Add a compact `"Log"` / `"Log deposit"` button (`min-h-[36px]`) on each predicted row, with clear overdue/today visual emphasis (`"Today"` / `"2 days late"` badge) when `diffDays(today, u.next) <= 0`.
- Extend `DialogProvider.openPaychequeDialog` to accept optional prefill defaults (`prefill?: { sourceId?: number; amountCents?: number; paidOn?: string }`):
  - Clicking `"Log deposit"` opens `PaychequeDialog` prefilled with `u.source.id`, `u.amount` (or latest paystub breakdown via `"Same as last time"`), and `u.next` (clamped to `today` if `u.next > today` or user-editable).
  - The user simply verifies the cents and presses Enter to save.

### Solution 2: Optional Explicit Pay Frequency on Sources
Add an optional `pay_schedule` field to `Source` (`'auto' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'irregular'`, defaulting to `'auto'`):
1. **Backend & Schema (`backend/src/sources/models.py`, `schemas.py`, `database.py`)**:
   - Add `pay_schedule` column (`TEXT DEFAULT 'auto'`, safely migrated via `PRAGMA table_info(sources)` if absent).
   - Validate allowed values in `SourcePayload` and expose in `SourceResponse`.
2. **Frontend Form (`source-dialog.tsx` & `source-schema.ts`)**:
   - Add a `Pay Schedule` `<select>` in `SourceDialog`:
     - `Auto-detect from paycheques` (`auto`)
     - `Weekly (every 7 days)` (`weekly`)
     - `Bi-weekly (every 14 days)` (`biweekly`)
     - `Semi-monthly (1st & 15th / 15th & end of month)` (`semimonthly`)
     - `Monthly` (`monthly`)
     - `Irregular / Ad-hoc` (`irregular` — excludes from overdue alerts)
3. **Prediction Engine (`frontend/src/lib/utils.ts:computeUpcomingPaydays`)**:
   - If `source.pay_schedule` is explicit (`weekly`, `biweekly`, `semimonthly`, `monthly`), compute the next payday after just **1 logged paycheque** using exact calendar rules (e.g., `+7 days`, `+14 days`, semi-monthly 15th/end-of-month, or `+1 calendar month`).
   - If `irregular`, omit from `upcoming`.
   - If `auto`, fall back to the existing 3-paycheque median-gap heuristic.

### Verification Criteria
- Clicking `"Log deposit"` on any item in `Next paydays` opens `PaychequeDialog` prefilled with that source, estimated amount, and target date.
- Setting `Pay Schedule` to `Bi-weekly` on a source with only 1 logged paycheque immediately predicts the next payday (`+14 days`) on Overview.
- Marking a contract source as `Irregular` prevents false `"X days late"` warnings on the Overview dashboard.
