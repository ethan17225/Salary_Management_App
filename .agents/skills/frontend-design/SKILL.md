---
name: frontend-design
description: Guidance for distinctive, intentional visual design and WCAG 2.2 AA accessibility compliance when building new UI, reshaping an existing one, or running an a11y/UX audit. Covers aesthetic direction, typography, UX copy, keyboard navigation, contrast, ARIA, and semantic HTML.
license: Complete terms in LICENSE.txt
---

# Frontend Design

Approach this as the design lead at a design studio known for giving every client a distinct visual identity that is not mistaken for anyone else's. This client has already rejected proposals that felt cliché or templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take aesthetic risk if justified.

## Ground your designs in the subject matter

If the brief does not identify what the product or subject matter is, identify it yourself before designing, and confirm with the client. You can come up with one concrete subject, the design's audience, and the design's primary job, as a proposal. If there's any information in your memory about the client's preferences or context about what they're building, use that as a hint. The subject's industry, subject matter, materials, and vernacular are where distinctive visual choices come from — a design for a toy for girls aged 8–11 will be very aesthetically different from a dashboard for financial analysts. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is the first thing viewers will see. Open with the most characteristic thing in the subject's world, in the form that is most appropriate: a headline, an image, an animation, a live demo, an interactive moment, or other treatments. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the default treatment, so only use it if that's truly the best option.

Typography carries the personality of the page. You don't need a different typeface for display or headline text and body content: use one family or two, and if two, make them clearly distinct.

Choose your typefaces deliberately, not the default families you would reach for on any other project, and set a clear type scale following the default guidance of The Elements of Typographic Style with intentional weights, widths, and spacing. When type is used as a headline or visual element, use the type treatment itself as an active part of the design, not a neutral delivery vehicle for the content.

Default to line lengths of less than 80 characters. Serif typefaces can have slightly longer line lengths; give serif body text slightly more line-height than a sans-serif.

Avoid these default typographic treatments; they are the commonest tells of a generated page:
- Accenting just a single word or phrase in a headline, like putting one word in italic/bold or a different color.
- Using all caps for labels.
- Adding unnecessary typographic labels above content.

Visual structure is information. Structural devices like outlines, borders, numbering, eyebrows, dividers, labels, etc., encode useful information about the content rather than decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence — like a stepped process or a timeline. Before adding numbered markers, check the content really is a sequence.

Use non-user-triggered motion sparingly and deliberately, only to draw attention. A single orchestrated moment — one page-load sequence or one reveal — lands better than scattered effects; fade-and-slide-up entrances on each section and hover transitions on every card are the generic default and read as AI-generated. Motion that answers a person's action (opening, expanding, confirming) is welcome when it shows what changed.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy and placeholder content. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.

## Process: plan, review against the brief, build, critique

For calibration, AI-generated design right now clusters around some traits:
1. a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta or warm-clay accent (often near #D97757 — Anthropic's own Claude-interaction accent, so on a user's brief it reads as a tell);
2. a near-black background with a single bright acid-green or vermilion accent;
3. a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns;
4. the SaaS-card kit: content chopped into identical rounded cards, one border-radius on everything regardless of hierarchy, the same soft grey shadow (rgba(0,0,0,.1)) under each, and gradient washes as decoration;
5. template chrome that appears whatever the subject: a tracked-out ALL-CAPS eyebrow label above every heading; meta strings joined with middle dots ('A · B · C'); labels built as 'WORD — fragment' with a spaced em dash; tinted near-black (#0B0B0B, #111) standing in for black; a monospace face for small data labels; a '→' appended to link and button text.

All traits are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks. Where it leaves an axis free, don't spend that freedom on one of these defaults. As with a hired human designer, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.

Work in two passes. First, brainstorm a short design plan based on the client's design brief: create a compact token system with color, type, layout, and principles.
- Color: describe the core base palette as 4–6 named hex values.
- Type: the typefaces and their roles.
- Layout: a layout concept, using one-sentence prose descriptions and ASCII wireframes to ideate and compare. Include alignment guidance; should the content be left aligned, center aligned, justified?
- Principles: the high-level guidance for what makes this page unique.

Then review that plan against the brief before building: if any part of it reads like the generic default you would produce for any similar page (work through a similar prompt to see if you arrive somewhere similar) rather than a choice made for this specific brief — revise that part, say what you changed and why. Only after you've confirmed the relative uniqueness of your design plan should you start to write the code, following the revised plan.

When writing the code, be careful of structuring your CSS selector specificities. It's easy to generate CSS classes that cancel each other out (especially with a type-based selector like .section and an element-based selector like .cta). This can happen often with padding/margin between sections.

## Restraint and self-critique

Spend your boldness in one place. Let one element be the memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief. Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected, visually accessible, harmonious color palettes. Critique your own work as you build, taking screenshots to review if your environment supports it — a picture is worth 1000 tokens. Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory. Human creatives have memory and always try to do something new, so if you have a space to quickly jot down notes about what you've tried, it can help you in future passes.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand and use. They are design content, not decoration. Bring the same intentionality and minimalism to copywriting that you would bring to spacing and color. Before writing anything, ask what the design needs to say, and how it can best be said to help the person navigate the experience.

Write from the end user's perspective. Name things by what users will understand in simple language, not by how the system is built. A user manages notifications, not webhook config. Describe what something is or does in plain terms rather than selling it. Being specific and legible to new users is always better than being clever.

Use active voice as default. A CTA says exactly what happens when it is used: "Save changes," not "Submit." An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published." The vocabulary of an interface is the signposting for someone navigating the product. Cohesion and consistency are how people learn their way around.

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the tone conversational: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each written element do exactly one job.

---

## WCAG 2.2 AA Accessibility Standards & Audit Checklist

Every UI change must meet **WCAG 2.2 Level AA** across all four POUR principles. For complete criteria and copy-paste patterns, read [references/WCAG.md](references/WCAG.md) and [references/A11Y-PATTERNS.md](references/A11Y-PATTERNS.md).

### 1. Perceivable
- **Color contrast (1.4.3 / 1.4.6 / 1.4.11)**: Minimum **4.5:1** for normal text (< 18px / < 14px bold), **3:1** for large text (≥ 18px / ≥ 14px bold), and **3:1** for UI boundaries, icons, and `:focus-visible` outlines. Avoid printing dynamic user-picked colors directly as text on light cards — pair a high-contrast `--ink` label with a small colored swatch/dot (`size-2 rounded-full`).
- **Don't rely on color alone**: Always combine status/error colors with text, values, or icons (e.g., `aria-invalid="true"` + visible inline error text via `aria-describedby`).
- **Images & SVG icons (1.1.1)**: Meaningful `<img>` elements require descriptive `alt`. Decorative icons/SVGs require `aria-hidden="true"` (or `alt=""`). Icon-only buttons must have `aria-label` or `.sr-only` text.

### 2. Operable
- **Prefer native interactive elements (2.1 / 4.1.2)**: Use `<button type="button|submit">`, `<a href>`, `<select>`, `<dialog>`, and `<input>` instead of `<div onClick>` or `<tr onClick>`. Never nest interactive controls (`<button>` inside `<tr onClick>` or `<article onClick>`): for clickable cards, keep `<article className="relative">` and stretch a primary `<Link>` using `after:absolute after:inset-0 after:rounded-[inherit]`, elevating secondary actions with `relative z-10`.
- **Keyboard & Focus (2.4.1 / 2.4.7 / 2.4.11)**:
  - Include a skip-to-content link as the first focusable element inside the header.
  - Never disable `:focus-visible` outlines (`outline: 2px solid var(--accent); outline-offset: 2px;`).
  - Never use `tabindex > 0`, and ensure focused elements are not obscured by sticky headers (`scroll-margin-top`).
  - Use native `<dialog>` (with `.showModal()`) for automatic `Escape` closing, backdrop, and focus containment.
- **Target Size (2.5.8)**: Minimum **24×24 CSS px** (WCAG AA); aim for **44×44 CSS px** (40px+ on compact action links/pills) with adequate spacing between adjacent controls.
- **Reduced Motion (2.3)**: Respect `@media (prefers-reduced-motion: reduce)` and disable animations/transitions cleanly without leaving content hidden at `opacity: 0`.

### 3. Understandable
- **Page language & headings (3.1.1 / 1.3.1)**: Declare `<html lang="en">` and maintain strict sequential heading order (`h1` → `h2` → `h3`) with one `<h1>` per route (including `global-error.tsx` and `not-found.tsx`).
- **Form labels & validation (3.3.1 / 3.3.2 / 3.3.7)**:
  - Every control needs a programmatically associated `<label htmlFor="...">` (never placeholder-only labels), `name`, and appropriate `autoComplete`.
  - Pair validation errors with `aria-invalid="true"` and `aria-describedby="<field>-error"`.
  - Provide pending states (`disabled` + `'Saving…'`/`'Deleting…'`) to prevent double submits, and 2-step confirmation or undo for destructive actions.

### 4. Robust
- **Semantic landmarks**: Use `<header>`, `<nav aria-label="...">` with `aria-current="page"`, `<main id="main">`, `<section>`, and `<table>` with `<thead>`/`<th>`.
- **Dynamic updates & loading (4.1.3)**: Announce status toasts via `role="status"` + `aria-live="polite"` (or `role="alert"` for urgent errors), and mark structural loading skeletons with `role="status"`, `aria-busy="true"`, and `<span className="sr-only">Loading…</span>`.

### Pre-Ship Accessibility Audit Workflow
1. If Chrome DevTools MCP or Lighthouse is available, run `lighthouse_audit` and `take_snapshot` on the rendered route to inspect the accessibility tree (names, roles, landmarks, heading order).
2. Walk the full flow via keyboard only (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`), verifying skip links, dialog focus, and 200% zoom / 390px mobile layout.
3. Verify `prefers-reduced-motion: reduce` and contrast ratios before finalizing.
