# UI Audit 03 — `YearDropdown` Keyboard Navigation, Escape Handling & Focus Management

- **Date**: 2026-11-19
- **Title**: Implement Full ARIA Listbox Keyboard Contract (Escape, Arrow Keys, Focus Return) on `YearDropdown`
- **Severity**: HIGH (WCAG 2.1.1 / 4.1.2 Custom Listbox Contract)
- **Target**: `frontend/src/components/ui/year-dropdown.tsx:43-135`

---

## Description

`YearDropdown` implements a custom `role="listbox"` menu from scratch using `useOutsideClick`, but lacks the required ARIA keyboard contract (`Escape` to close and return focus to trigger, `ArrowUp`/`ArrowDown`/`Home`/`End` navigation across options, and initial focus transfer when opened). As noted in `interface-design` and `baseline-ui`, custom-rolled listbox widgets without full keyboard support break accessibility for keyboard and screen-reader users.

---

## Detailed Problem

In `frontend/src/components/ui/year-dropdown.tsx:23-134`:
```tsx
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement | null>(null);
  ...
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(ddRef, open, close);
  ...
      <button
        type="button"
        ...
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Year: ${displayValue}`}
        onClick={() => setOpen((o) => !o)}
      >
      ...
      {open ? (
        <ul
          className="absolute top-[calc(100%+8px)] ..."
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map(([val, label, tot]) => {
            const selected = String(activeYear) === String(val);
            return (
              <li key={val}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  ...
```
Specifically:
1. Pressing `Escape` while `open === true` does nothing.
2. Opening the menu leaves focus on the trigger button; pressing `ArrowDown` scrolls the page instead of focusing options.
3. `<li role="presentation">` is missing around `<button role="option">`, or `<ul role="listbox">` contains raw `<li>` elements whose implicit `listitem` role conflicts with `listbox` expecting `option` children directly.
4. `aria-controls` linking the trigger to the listbox ID is missing, and closing via `Escape` or selection does not programmatically restore focus to the trigger button.
5. Also note `transition-all` on line `47` and `animate-pop` origin should scale from top-right (`origin-top-right`).

---

## Detailed Solutions

1. **Full Keyboard & ARIA Listbox Implementation** (or swap to an accessible headless Menu/Select primitive if introduced):
   - Add `triggerRef`, `listboxId = useId()`, and `optionRefs = useRef<(HTMLButtonElement | null)[]>([])`.
   - When opened via click or `ArrowDown`/`Enter`/`Space` on the trigger, focus the currently selected option (or first option) inside `requestAnimationFrame`.
   - Attach `onKeyDown` on the container/listbox:
     - `Escape`: close menu and call `triggerRef.current?.focus()`.
     - `ArrowDown` / `ArrowUp`: move focus cyclically across `optionRefs.current` (`e.preventDefault()`).
     - `Home` / `End`: jump to first / last option.
     - `Tab`: close menu cleanly.
   - Use `<li role="none">` wrapping `<button role="option">` (or render `<div role="listbox">` containing direct `<button role="option">` children so the accessibility tree matches the ARIA spec cleanly).
   - Add `aria-controls={open ? listboxId : undefined}` on the trigger button.

### Target Snippet (`year-dropdown.tsx`)
```tsx
  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const items = optionRefs.current.filter(Boolean) as HTMLButtonElement[];
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };
```

### Verification Criteria
- Pressing `ArrowDown` on the focused Year trigger opens the menu and moves focus into the options.
- `ArrowUp` / `ArrowDown` / `Home` / `End` cycle through options without scrolling the viewport.
- Pressing `Escape` closes the menu and returns keyboard focus to the trigger button.
- Accessibility tree shows valid `listbox` → `option` ownership with `aria-selected` and `aria-controls`.
