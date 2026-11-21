# UI Audit 04 — Async Form Pending States, Double-Submit Prevention & Destructive Safeguards

- **Date**: 2026-11-19
- **Title**: Add In-Flight Pending/Disabled States, Spinner/Loading Labels & Destructive Action Guards to All Forms
- **Severity**: HIGH (Web Interface Guidelines / `baseline-ui` / Data Integrity)
- **Targets**:
  - `frontend/src/features/paycheques/components/paycheque-dialog.tsx:105-145, 353-373`
  - `frontend/src/features/sources/components/source-dialog.tsx:69-96, 207-227`
  - `frontend/src/features/overview/components/goal-dialog.tsx:21-29, 74-94`
  - `frontend/src/features/allocations/components/allocations-dashboard.tsx:170-231, 662-673`

---

## Description

None of the async form submissions or delete actions in Payday track pending/loading states (`useTransition` or `isSubmitting`). As a result, submit buttons remain enabled while server actions are in flight, show no `"Saving…"` / `"Deleting…"` feedback, and allow accidental double-clicks to create duplicate paycheques or allocation buckets. Furthermore, destructive deletes inside dialogs happen immediately on a single click without confirmation.

---

## Detailed Problem

### 1. Missing Pending State Across All 4 Dialogs & Card Actions
- `frontend/src/features/paycheques/components/paycheque-dialog.tsx:105-118`:
```tsx
  async function submitPay(e: FormEvent) {
    e.preventDefault();
    const res = await savePaychequeAction(payForm);
    ...
  }
```
  Button at line `371`: `<button className="btn primary flex-1 sm:flex-initial">Save paycheque</button>` (missing `type="submit"`, `disabled={isPending}`, and loading label `"Saving…"`).
- `frontend/src/features/sources/components/source-dialog.tsx:69-81` & `225`: same missing `isPending` and `"Saving…"`, plus `deleteSrc()` (`lines 83-96`) has no `isDeleting` guard.
- `frontend/src/features/overview/components/goal-dialog.tsx:21-29` & `92`: `saveGoal` and `Remove goal` have no pending indicator or double-click guard.
- `frontend/src/features/allocations/components/allocations-dashboard.tsx:170-231` & `671`: `handleSaveRule`, `handleToggleActive`, `handleDeleteRule`, and `handleApplyPreset` all fire unguarded async calls with no loading state on buttons.

### 2. Web Interface Guidelines Compliance
Per Web Interface Guidelines (`Forms` & `Typography`):
- *"Submit button stays enabled until request starts; spinner during request"*
- *"Loading states end with `…`: `'Loading…'`, `'Saving…'`"*
- *"Destructive actions need confirmation modal or undo window—never immediate"* (note: `deleteSrc` in `source-dialog.tsx` deletes immediately with no undo; `handleApplyPreset` in `allocations-dashboard.tsx` overwrites all buckets with no confirmation or undo!).

---

## Detailed Solutions

1. **Track `pendingAction` (`'save' | 'delete' | null`) or `useTransition` in every dialog**:
   - Disable action buttons once submission starts (`disabled={pending !== null}`), apply clear disabled styling in `globals.css`:
     ```css
     .btn:disabled {
       opacity: 0.6;
       cursor: not-allowed;
       transform: none;
     }
     ```
   - Update button text during request using proper ellipsis `…`:
     - Save buttons: `'Saving…'`
     - Delete buttons: `'Deleting…'`
   - Always explicitly set `type="submit"` on primary submit buttons inside `<form>`.
2. **Inline Delete Confirmation or Undo Consistency**:
   - For `deleteSrc` in `source-dialog.tsx` (which has no undo toast because of potential relational ties or permanent deletion), require a 2-step inline confirmation (`"Delete source"` → `"Confirm delete?"` + `"Cancel"`) before firing `deleteSourceAction`.
   - For `PaychequeDialog` and `AllocationsDashboard` deletes, disable the Delete button while the request runs and keep the 7-second Undo toast.

### Target Snippet (`paycheque-dialog.tsx`)
```tsx
const [pending, setPending] = useState<'save' | 'delete' | null>(null);

async function submitPay(e: FormEvent) {
  e.preventDefault();
  if (pending) return;
  setPending('save');
  try {
    const res = await savePaychequeAction(payForm);
    ...
  } finally {
    setPending(null);
  }
}
```
```tsx
<button
  type="submit"
  disabled={pending !== null}
  className="btn primary flex-1 sm:flex-initial"
>
  {pending === 'save' ? 'Saving…' : 'Save paycheque'}
</button>
```

### Verification Criteria
- Rapidly clicking `Save paycheque` or pressing `Enter` twice sends only 1 `POST` request and displays `"Saving…"` while disabled.
- `globals.css` exposes clear `.btn:disabled` styling without active scale bounce.
- Deleting a source requires an explicit confirmation click; applying an allocation preset requires confirmation and offers 7-second Undo.
