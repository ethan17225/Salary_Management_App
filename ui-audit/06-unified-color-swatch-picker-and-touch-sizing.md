# UI Audit 06 — Unified Color Swatch Picker & Minimum 40px Touch Targets

- **Date**: 2026-11-19
- **Title**: Extract Shared `<ColorSwatchPicker>` Component for Sources & Allocations with Accessible 40px Swatches
- **Severity**: MEDIUM (Design System Consistency & Touch Target Sizing)
- **Targets**:
  - `frontend/src/features/sources/components/source-dialog.tsx:127-135`
  - `frontend/src/features/allocations/components/allocations-dashboard.tsx:619-645`

---

## Description

Color picking is implemented inconsistently across the two dialogs that configure colors: `AllocationsDashboard` offers clickable preset color swatches (`SOURCE_COLORS`) paired with a custom `<input type="color">`, while `SourceDialog` exposes only a raw browser `<input type="color">` widget. Moreover, the preset swatches in `AllocationsDashboard` are `size-8` (`32×32px`), falling under the `40×40px` / `44×44px` minimum hit target rule.

---

## Detailed Problem

### 1. Inconsistent Color Picker UX Between Dialogs
- `frontend/src/features/sources/components/source-dialog.tsx:127-135`:
```tsx
<label className="grid gap-1.5 text-sm font-medium">
  Colour
  <input
    type="color"
    className="p-1 cursor-pointer"
    value={srcForm.color}
    onChange={(e) => setSrcForm((f) => ({ ...f, color: e.target.value }))}
  />
</label>
```
  Users cannot quickly click one of the curated `SOURCE_COLORS` palette chips (`#0d7480`, `#c2410c`, `#2563eb`, etc.) when creating a job; they are forced directly into the native macOS/Windows OS color modal.
- `frontend/src/features/allocations/components/allocations-dashboard.tsx:619-645`:
```tsx
<div className="flex flex-wrap gap-2">
  {SOURCE_COLORS.map((c) => (
    <button
      key={c}
      type="button"
      onClick={() => setFormState((f) => ({ ...f, color: c }))}
      className={cn(
        'size-8 rounded-full cursor-pointer',
        formState.color === c
          ? 'border-[3px] border-ink'
          : 'border-2 border-transparent'
      )}
      style={{ background: c }}
      aria-label={`Select color ${c}`}
    />
  ))}
  <input
    type="color"
    aria-label="Custom accent colour"
    value={formState.color}
    onChange={(e) => setFormState((f) => ({ ...f, color: e.target.value }))}
    className="w-11 h-8 min-h-8 p-0.5 cursor-pointer"
  />
</div>
```
  - Swatches are `size-8` (`32×32px`) and the custom color input overrides `min-h-8` (`32px`).
  - Selected state relies primarily on a `3px` ink border rather than a clear checkmark icon + `aria-pressed` state (`WCAG 1.4.1 Use of Color`).
  - Color names (`Teal`, `Rust`, `Blue`, etc.) are missing from `aria-label` (reading raw hex codes like `#0d7480` to screen readers).

---

## Detailed Solutions

1. **Create a shared `frontend/src/components/ui/color-swatch-picker.tsx` component**:
   - Accept `value: string`, `onChange: (color: string) => void`, and `label?: string`.
   - Render `SOURCE_COLORS` with human-readable names (`Teal`, `Terracotta`, `Cobalt`, `Olive`, `Amber`, `Crimson`, `Cyan`, `Slate`) for `aria-label` and `title`.
   - Size each swatch button to `size-10` (`40×40px`, or `44×44px` on mobile) with a crisp white checkmark SVG inside the selected swatch and `aria-pressed={selected}`.
   - Pair with an aligned custom `<input type="color">` (`size-10 p-1 rounded-full`) labeled `"Choose custom colour"`.
2. **Use `<ColorSwatchPicker>` in both `SourceDialog` and `AllocationsDashboard`**.
3. **Standardize spelling** (`Colour` vs `Color`) consistently across labels/errors (`source-dialog.tsx:128`, `allocations-dashboard.tsx:620`, `allocations.py:230` vs `source-schema.ts:13`).

### Verification Criteria
- Both `SourceDialog` and `AllocationsDashboard` render the exact same `<ColorSwatchPicker>` component.
- Every color swatch has at least a `40×40px` hit target, exposes `aria-pressed`, and shows a visible checkmark icon when active.
