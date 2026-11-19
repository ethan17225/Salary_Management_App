---
name: design-taste-frontend
description: >-
  Distilled tasteskill 2.5.1 (Fintech & Dashboard Edition) for Payday. Enforces Payday's
  cool-white-slate token system, single visual hierarchy, equal content edges, tabular numeric
  typography, quiet micro-interactions, and plain anti-slop UX copywriting across Next.js App
  Router pages and dialogs.
---

# Tasteskill 2.5 — Payday Fintech & Dashboard Edition

Distilled from `tasteskill 2.5.1` for Payday's Next.js 15 App Router dashboard. The full standalone static landing-page kit remains preserved globally outside this repository.

## Payday's Visual System (`frontend/src/styles/globals.css`)

Payday runs the dealt `cool-white-slate` palette with `Outfit` (sans) and `DM Mono` (tabular mono), configured via CSS tokens in `:root` and mapped to Tailwind CSS v4 in `@theme inline`:

| Token | Value | Role |
|---|---|---|
| `--bg` | `#f7f9fa` | Page canvas (90–95% neutral surface budget) |
| `--surface` | `#ecf0f2` | Subtle secondary surfaces, progress tracks, skeleton pulse |
| `--card` | `#fff` | Primary card and dialog surface (`1px solid var(--line)`, `--r-lg: 16px`) |
| `--ink` | `#1f3038` | Primary text (≥ 7:1 on `--card`/`--bg`) and dark `.hero` surface |
| `--muted` | `#5d6e76` | Secondary metadata, table column headers, axis/meta labels (≥ 4.5:1) |
| `--line` | `#dfe6ea` | 1px hairlines, table row dividers, control borders |
| `--accent` / `--accent-2` / `--accent-soft` | `#0d7480` / `#0a5d67` / `#e2f0f1` | Sole primary brand accent (buttons, focus rings, active nav, progress fills) |
| `--up` / `--warn` / `--down` | `#0f7a4a` / `#d97706` / `#b42318` | Semantic positive, warning/reserve, and destructive/negative states |
| `--r` / `--r-lg` | `10px` / `16px` | Control radius (`10px`), cards (`16px`), heroes & `<dialog>` (`20px`) |

---

## Core Design Rules (Non-Negotiable)

1. **One strict system**: Never introduce a second button family, spacing scale, radius family, or ad-hoc color palette. Reuse `.card`, `.btn` (`.primary`, `.danger`, `.same`), `.link`, `.hero`, `.chip`, and `.pill-reserve`. Never use violet/lavender hues (`OKLCH 270°–330°`) in app UI chrome.
2. **Two boxes deep at most**: Avoid nesting card-inside-card-inside-card or glassmorphism overlays. Keep panels flat (`--card` or `--surface` with 1px `--line` border).
3. **Equal edges & zero horizontal spill**: Align every section, KPI grid, chart card, and table cleanly along the container lines. Verify zero horizontal overflow at `1440px`, `1024px`, `768px`, `390px`, and `320px`.
4. **Typography & numeric precision**:
   - Body text is `16px/1.5`; smallest metadata/table header is `13px`; never print sub-`13px` readable prose or tracked-out `ALL-CAPS` eyebrows.
   - Sentence case everywhere. Use `text-wrap: balance` on headings (`h1, h2, h3`) and `text-wrap: pretty` on `<p>`.
   - Apply `.num` (`font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap;`) on every currency amount, percentage, date, hour count, and summary metric so columns align vertically.
5. **Accessible touch targets & contrast**:
   - Controls and form inputs maintain `min-height: 44px` (`min-h-[40px]` minimum on dense inline table triggers).
   - Never rely on dynamic user-picked source colors (`--c`) for body text on white backgrounds — render a neutral `--ink` label paired with a small colored dot (`bg-(--c)`).
   - Keep one `<h1>` per page and never skip heading levels.

---

## Quiet Micro-Interactions (`references/motion.md`)

Motion answers user action and never distracts or blocks reduced-motion users:

- **Hero entrance**: Runs once on mount via `--animate-enter` (`enter .55s cubic-bezier(.2, .7, .2, 1) both`). Never stagger-fade rows or cards on scroll, and never use parallax or scroll-jacking.
- **Dialogs**: Native `<dialog>` opens with `--animate-pop` (`pop .18s cubic-bezier(.2, .7, .2, 1)`).
- **Buttons, chips & links**:
  - `.btn` transitions `background .15s, border-color .15s, transform .1s` and sinks gently on `:active` (`translateY(1px) scale(.98)`).
  - `.link` draws a 1px underline from left to right on `:hover` / `:focus-visible`.
  - Never write `transition-all` or animate layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`).
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all animations and transitions globally without hiding content.

---

## Plain, Anti-Slop Copywriting (`references/copy.md`, `references/copy-tells.md`)

Write every heading, button, empty state, and error message in plain language a user understands in five seconds:

1. **Sentence-case headings naming real things**: `"Monthly income"`, `"Tax set-aside needed"`, `"Income sources"` — never generic SaaS fluff or engineering jargon (`"Largest Remainder conservation"`, `"zero-drift cent conservation"`).
2. **Verb + object buttons**: `"Save paycheque"`, `"Add source"`, `"Export CSV"`, `"Clear filters"` — never `"Submit"`, `"Click here"`, or `"Learn more"`. Keep the same verb across the flow (`Delete source` → `Deleted`).
3. **Visible labels & actionable errors**: Never use placeholder-only inputs. Error messages state what went wrong and how to fix it in plain words (`"Pick a source"`, `"Gross pay must be at least net pay"`).
4. **No AI copy tells**: Avoid buzzwords (`seamless`, `robust`, `leverage`, `elevate`, `unlock`, `harness`), stacked fragment slogans (`"Twelve rooms. Three ways."`), unrequested em-dash fillers, or placeholder/invented metrics.

---

## Retained References

Read these focused references when auditing layout, cards, motion, or UI copy:

- [`references/system.md`](references/system.md) — Rhythm tokens, typography scale, neutral-first color discipline, radius, and nav rules.
- [`references/cards.md`](references/cards.md) — Card spacing, 2-level nesting rule, alignment, and inner fragment sizing.
- [`references/motion.md`](references/motion.md) — Hover/press micro-interaction timings, curves, and reduced-motion rules.
- [`references/copy.md`](references/copy.md) — Plain-English headline, button, form label, and error copy rules.
- [`references/copy-tells.md`](references/copy-tells.md) — Complete anti-slop word/phrase blacklist and over-correction counters.
- [`references/copy-voice.md`](references/copy-voice.md) — Reader-question structure and voice checks.
- [`references/copy-moves.md`](references/copy-moves.md) — Concrete copy moves for headings, features, buttons, and microcopy.
- [`references/copy-registers.md`](references/copy-registers.md) — Choosing an appropriate tone register without slipping into generic house voice.
