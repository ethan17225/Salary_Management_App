# UI Audit 05 — Taxes Retention Bar & Legend Color Mismatch + Dynamic Contrast Guard

- **Date**: 2026-11-19
- **Title**: Unify Retention Bar & Legend Semantic Color Tokens and Guard Low-Contrast Dynamic Source Link Colors
- **Severity**: HIGH (WCAG 1.4.1 / 1.4.3 Color Consistency & Contrast)
- **Targets**:
  - `frontend/src/features/taxes/components/taxes-dashboard.tsx:170-209`
  - `frontend/src/features/sources/components/source-card.tsx:30`

---

## Description

On `/taxes`, the **Gross-to-Net & Tax Retention Bar** renders segments using one set of colors while the legend dots directly beneath it render three completely different hex colors—undermining visual mapping. Additionally, `SourceCardShell` applies the user-picked `--c` variable directly as text color (`text-(--c)`) on `"View details"`, which fails WCAG 4.5:1 contrast if a user selects a light custom color via `<input type="color">`.

---

## Detailed Problem

### 1. Bar Segment vs. Legend Dot Color Mismatch
In `frontend/src/features/taxes/components/taxes-dashboard.tsx:170-209`:
- **Bar segments (`lines 170-189`)**:
  - True Spendable Net: `bg-up` (`#0f7a4a` — deep forest green)
  - Contractor Tax Reserve: `bg-[#d97706]` (amber-600)
  - Withheld at Source: `bg-down` (`#b42318` — deep crimson)
- **Legend dots (`lines 192, 198, 204`)**:
  - True Spendable Net: `bg-[#10b981]` (bright emerald-500)
  - Contractor Tax Reserve: `bg-[#f59e0b]` (amber-500)
  - Withheld Taxes & Deductions: `bg-[#f43f5e]` (bright rose-500)
- Comparing the deep green/crimson bar directly above bright emerald/rose legend dots feels visually disjointed and breaks the 1:1 color key mapping.

### 2. Unchecked Dynamic Text Color on Source Card Links
In `frontend/src/features/sources/components/source-card.tsx:30`:
```tsx
<Link
  href={href}
  className="inline-flex items-center gap-1.5 text-sm font-medium text-(--c)"
```
- While the 8 preset `SOURCE_COLORS` are reasonably dark, `SourceDialog` (`source-dialog.tsx:130`) lets users pick *any* color via `<input type="color">` (e.g., `#facc15` yellow or `#a3e635` lime), making `"View details"` illegible on a `#ffffff` card background.

---

## Detailed Solutions

### Solution 1: Bind Both Retention Bar and Legend Dots to Identical Semantic Tokens
In `frontend/src/styles/globals.css`, add a `--warn` token (`#d97706` / `--color-warn: var(--warn)` in `@theme inline`) alongside `--up` and `--down`, and use the exact same utility classes (`bg-up`, `bg-warn`, `bg-down`) on both the segmented bar spans and the legend dots in `taxes-dashboard.tsx:170-209`.

### Solution 2: Use `text-ink` or `text-accent-2` for `"View details"` and Use `--c` as a Pure Color Swatch
In `frontend/src/features/sources/components/source-card.tsx:30`:
- Render `"View details"` in `text-ink` (or `text-accent-2`, guaranteed > 7:1 contrast on `#ffffff`) and pair it with a small colored indicator dot (`bg-(--c)`) or subtle border hover accent (`globals.css:343-346`), so any user-chosen color remains 100% WCAG AA compliant.

### Verification Criteria
- Every bar segment color in `TaxesDashboard` matches its legend dot hex value identically.
- Picking `#ffff00` (bright yellow) as a source color still keeps `"View details"` on `SourceCardShell` at ≥ 4.5:1 contrast against `#ffffff`.
