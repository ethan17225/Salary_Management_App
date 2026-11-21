# UI Audit 01 — Semantic Card Navigation & Stretched Link Overlay

- **Date**: 2026-11-19
- **Title**: Replace Non-Semantic `<article onClick>` Navigation with Accessible Stretched `<Link>` Overlay
- **Severity**: HIGH (WCAG 2.1.1 Keyboard / Web Interface Guidelines Anti-Pattern)
- **Target**: `frontend/src/features/sources/components/source-card.tsx:20-64`

---

## Description

Source cards on `/sources` currently make the entire card clickable by attaching an `onClick={() => router.push(href)}` handler directly to the `<article>` element. Non-semantic click handlers on `<article>` break standard browser link behaviors (middle-click, `Cmd/Ctrl+Click` to open in a new tab, link URL preview on hover), prevent keyboard focus on the card container, and violate both Web Interface Guidelines and Rams WCAG 2.1.1 rules.

---

## Detailed Problem

In `frontend/src/features/sources/components/source-card.tsx:20-64`:
```tsx
  return (
    <article
      className="card src clickable group flex flex-col gap-[18px] md:col-span-6 lg:col-span-4 cursor-pointer transition-all duration-180 hover:-translate-y-0.5"
      style={{ '--c': source.color } as CSSProperties}
      onClick={() => router.push(href)}
    >
      {children}
      <div className="flex items-center justify-between gap-3 mt-auto pt-3.5 border-t border-line">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--c)"
          aria-label={`${source.name} — view source details`}
          onClick={(e) => e.stopPropagation()}
        >
          View details
          ...
        </Link>
        <button
          className="btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openSourceDialog(source);
          }}
        >
          Edit
        </button>
      </div>
    </article>
  );
```
- `<article>` is not focusable (`tabIndex` absent) and has no `onKeyDown`, yet takes `cursor-pointer` and triggers navigation.
- Clicking anywhere on the card outside `View details` calls `router.push(href)` programmatically, meaning `Cmd+Click` / right-click "Open link in new tab" fails unless the user aims directly at the small `View details` link at the bottom left.
- Additionally, `View details` link text uses `text-(--c)` which can have insufficient contrast against `#ffffff` for lighter user-selected hex colors (see UI Audit 05 / 06).

---

## Detailed Solutions

1. **Remove `onClick` from `<article>` and `useRouter()`** — the card is a container, not an interactive button.
2. **Make `<article>` `relative`** and stretch the primary `<Link href={href}>` click surface across the entire card using a CSS `::after` overlay (`after:absolute after:inset-0 after:rounded-[inherit]`):
   - Keyboard tabbing lands cleanly on the real `<a>` link (`View details`) with a full-card `:focus-visible` ring.
   - `Cmd/Ctrl+Click`, right-click context menu, and middle-click work anywhere on the card surface.
3. **Elevate the `Edit` `<button>` above the stretched link** with `relative z-10` so clicking `Edit` opens `SourceDialog` without navigating.

### Target Implementation (`source-card.tsx`)
```tsx
  return (
    <article
      className="card src clickable group relative flex flex-col gap-[18px] md:col-span-6 lg:col-span-4 transition-[border-color,box-shadow,transform] duration-180 hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-accent"
      style={{ '--c': source.color } as CSSProperties}
    >
      {children}
      <div className="flex items-center justify-between gap-3 mt-auto pt-3.5 border-t border-line">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-ink no-underline after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none"
          aria-label={`${source.name} — view source details`}
        >
          <span className="size-2 rounded-full bg-(--c) shrink-0" aria-hidden="true" />
          View details
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-180 group-hover:translate-x-[3px]"
          >
            <path
              d="M3.5 8h9M8.5 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <button
          className="btn relative z-10"
          type="button"
          onClick={() => openSourceDialog(source)}
          aria-label={`Edit ${source.name}`}
        >
          Edit
        </button>
      </div>
    </article>
  );
```

### Verification Criteria
- `Cmd/Ctrl+Click` anywhere on a source card opens `/sources/[id]` in a new tab.
- Tabbing through `/sources` focuses the card's `View details` link and `Edit` button in logical order with a crisp focus ring around the card.
- Clicking `Edit` opens `SourceDialog` without triggering route navigation.
