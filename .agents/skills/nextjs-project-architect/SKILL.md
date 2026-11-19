---
name: nextjs-project-architect
description: Enforces feature-driven project architecture, module boundaries, RSC patterns, Server Action safety, Tailwind CSS v4 @theme token systems, Zod schema validation, and file placement rules for Next.js App Router applications.
triggers:
  - "nextjs"
  - "next.js"
  - "app router"
  - "create page"
  - "create feature"
  - "server action"
  - "project structure"
  - "new component"
  - "route.ts"
  - "page.tsx"
  - "layout.tsx"
  - "tailwind"
  - "design tokens"
  - "@theme"
  - "zod"
  - "schema validation"
---

# Next.js App Router Architecture & Engineering Skill

You are a Principal Next.js Architect. Whenever you scaffold features, create files, refactor components, or review code in this repository, strictly follow the directory topology, dependency boundaries, and React Server Component (RSC) patterns defined below.

---

## 1. Directory Topology & File Placement

All application code resides inside `src/`. Map every new file to its designated architectural layer:

```text
src/
├── app/                          # Routing, layouts, error/loading boundaries, and webhooks ONLY
│   ├── (auth)/                   # Route group: authentication flows
│   ├── (dashboard)/              # Route group: protected app views
│   │   ├── items/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx      # Thin route entry point
│   │   │   │   └── loading.tsx   # Streaming Suspense fallback
│   │   │   └── page.tsx
│   │   └── layout.tsx            # Dashboard shell layout
│   ├── api/                      # External webhooks & third-party callbacks ONLY
│   ├── global-error.tsx          # Root error boundary
│   ├── layout.tsx                # Root HTML/Body & global providers
│   ├── not-found.tsx             # Global 404 view
│   └── page.tsx                  # Root landing route
│
├── components/                   # Global, domain-agnostic UI layer
│   ├── ui/                       # Design system primitives (Button, Input, Modal, Table)
│   └── layout/                   # Shared structural shells (Navbar, Sidebar, Footer)
│
├── features/                     # Domain-driven feature modules (PRIMARY WORKSPACE)
│   └── <feature-name>/
│       ├── actions/              # Server Actions ('use server') for mutations
│       ├── components/           # Feature-scoped Server and Client components
│       ├── hooks/                # Feature-scoped client hooks ('use client')
│       ├── schemas/              # Zod validation schemas & form contracts
│       ├── services/             # Server-only queries, ORM calls, & data access ('server-only')
│       ├── types/                # Domain-specific TypeScript interfaces
│       └── index.ts              # Public API barrel (optional, for cross-feature access)
│
├── hooks/                        # Global, domain-agnostic hooks (useMediaQuery, useDebounce)
├── lib/                          # Singletons, SDK clients, and core utilities
│   ├── db.ts                     # Database client singleton (Prisma / Drizzle / Supabase)
│   ├── env.ts                    # Zod-validated environment configuration
│   └── utils.ts                  # Pure helper utilities (cn, formatters)
├── styles/                       # Global CSS and Tailwind configuration tokens
└── types/                        # Shared global TypeScript declarations
```

### File Placement Decision Matrix
1. **Is it a route entry, layout wrapper, route group, or external webhook?** -> Place in `src/app/`.
2. **Does it belong to a specific product domain (e.g., `inventory`, `billing`, `users`, `auth`)?** -> Place in `src/features/<domain>/`.
3. **Is it a reusable visual primitive with zero business awareness?** -> Place in `src/components/ui/`.
4. **Is it a database client, third-party SDK wrapper, or pure utility?** -> Place in `src/lib/`.

---

## 2. Dependency & Module Boundaries

### Rule 1: Unidirectional Dependency Graph
Maintain a strict one-way import hierarchy to prevent circular dependencies and tangled modules:
- `src/app/**` -> May import from `src/features/**`, `src/components/**`, `src/lib/**`, `src/hooks/**`.
- `src/features/<domain>/**` -> May import from `src/components/**`, `src/lib/**`, `src/hooks/**`, `src/types/**`.
- `src/components/**`, `src/lib/**`, `src/hooks/**` -> **MUST NOT** import from `src/features/**` or `src/app/**`.

### Rule 2: Cross-Feature Isolation
- A feature inside `src/features/feature-a/` should not reach deep into internal folders of `src/features/feature-b/`.
- Compose multiple features together inside `src/app/**/page.tsx` or `layout.tsx`, or export explicitly shared contracts via `src/features/<domain>/index.ts`.

### Rule 3: Thin `src/app/` Routing Layer
- Keep `page.tsx` and `layout.tsx` free of complex business logic, raw ORM queries, or large client state trees.
- A `page.tsx` file should only:
  1. Await `params` and `searchParams`.
  2. Call server data services from `@/features/<domain>/services/...`.
  3. Handle `notFound()` or `redirect()`.
  4. Pass data into feature components from `@/features/<domain>/components/...`.

---

## 3. React Server Components (RSC) & Client Boundaries

### Default to Server Components
- Every component is a **React Server Component (RSC)** by default.
- Never add `'use client'` to `page.tsx` or `layout.tsx`.
- Push `'use client'` down to the smallest interactive leaf component inside `src/features/<domain>/components/` (e.g., an interactive search bar, modal trigger, or form control).

### Slot & Children Composition Pattern
When a Client Component needs to wrap Server Component content, pass the Server Component via `children` or props rather than importing the Server Component directly inside the `'use client'` file:

```tsx
// GOOD: Client wrapper accepts server-rendered children
'use client';
import { useState } from 'react';

export function CollapsiblePanel({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <section>
      <button onClick={() => setIsOpen((prev) => !prev)}>Toggle</button>
      {isOpen && <div>{children}</div>}
    </section>
  );
}
```

### Serialization Guardrails
- Props crossing from a Server Component to a Client Component must be JSON-serializable (primitives, plain objects, arrays).
- Do not pass database client instances, raw classes, or un-annotated closures across the boundary.

---

## 4. Next.js Runtime & Data Patterns

### 1. Asynchronous Dynamic APIs
In modern Next.js, dynamic route properties and request headers are asynchronous Promises. Always `await` them:

```tsx
// src/app/(dashboard)/items/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getItemById } from '@/features/inventory/services/get-item-by-id';
import { ItemDetailView } from '@/features/inventory/components/item-detail-view';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ItemDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const filters = await searchParams;

  const item = await getItemById(id);
  if (!item) notFound();

  return <ItemDetailView item={item} activeTab={filters.tab as string | undefined} />;
}
```
- Similarly, always await `cookies()` and `headers()` from `next/headers`.

### 2. Server-Only Data Services (`src/features/<domain>/services/*.ts`)
- Add `import 'server-only';` at the top of every file in `services/` and `src/lib/db.ts`. This prevents accidental bundling of database logic or secret keys into client bundles.
- Use React `cache()` when deduplicating identical read queries across layouts and pages in a single render pass.

```typescript
// src/features/inventory/services/get-item-by-id.ts
import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';

export const getItemById = cache(async (id: string) => {
  return db.item.findUnique({
    where: { id },
  });
});
```

### 3. Safe Server Actions (`src/features/<domain>/actions/*.ts`)
- Start every action file with `'use server';`.
- Authenticate the user/session inside the action—treat every Server Action as a public HTTP POST endpoint.
- Validate all inputs against a Zod schema from `../schemas/`.
- Return a typed discriminated union (`ActionResult<T>`) instead of throwing unhandled errors for expected validation failures.
- Revalidate affected routes or cache tags via `revalidatePath()` or `revalidateTag()`.

```typescript
// src/features/inventory/actions/create-item.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createItemSchema } from '../schemas/item-schema';
import { db } from '@/lib/db';

export type ActionState<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createItemAction(rawInput: unknown): Promise<ActionState<{ id: string }>> {
  const parsed = createItemSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input data',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const created = await db.item.create({
    data: parsed.data,
  });

  revalidatePath('/items');
  return { success: true, data: { id: created.id } };
}
```

### 4. Type-Safe Environment Variables (`src/lib/env.ts`)
- Avoid reading `process.env.*` directly inside feature modules or components.
- Validate and export all environment variables from `src/lib/env.ts` using Zod.

---

## 5. Naming, Exports & Code Hygiene

- **File & Folder Naming:** Use `kebab-case` for all directories and files (`user-profile-card.tsx`, `update-billing-plan.ts`, `use-scroll-lock.ts`).
- **Component Naming:** Use `PascalCase` for React components (`export function UserProfileCard()`).
- **Export Style:**
  - Use **named exports** for all feature components, UI primitives, hooks, services, and actions.
  - Use **`export default`** strictly for Next.js file-system conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`).
- **Import Paths:** Always use configured path aliases (`@/features/...`, `@/components/ui/...`, `@/lib/...`) rather than deep relative paths (`../../../`).

---

## 6. Tailwind CSS v4 & Design Token System (`@theme inline`)

Payday uses **Tailwind CSS v4 (`@tailwindcss/postcss`)** with CSS-first configuration in `src/styles/globals.css` (never create a legacy `tailwind.config.ts`).

### Key v3 → v4 Differences
| v3 Pattern | v4 Pattern |
|---|---|
| `tailwind.config.ts` | `@theme` / `@theme inline` in CSS |
| `@tailwind base/components/utilities` | `@import "tailwindcss";` |
| `theme.extend.colors` | `@theme inline { --color-*: var(--token); }` |
| Custom utility plugin | `@utility name { ... }` |
| `darkMode: "class"` | `@custom-variant dark (&:where(.dark, .dark *));` |
| `tailwindcss-animate` | CSS `@keyframes` inside `@theme` + `@starting-style` |

### Token Mapping & Payday Primitives (`src/styles/globals.css`)
- **Define raw CSS variables in `:root`** and map semantic Tailwind tokens inside `@theme inline`:
  - Surfaces & text: `--bg`, `--surface`, `--card`, `--ink`, `--muted`, `--line` → `--color-bg`, `--color-surface`, `--color-card`, `--color-ink`, `--color-muted`, `--color-line`.
  - Brand & semantic states: `--accent`, `--accent-2`, `--accent-soft`, `--up`, `--warn`, `--down` → `--color-accent`, `--color-up`, `--color-warn`, `--color-down`.
  - Radius, shadow & fonts: `--r` (`10px`), `--r-lg` (`16px`), `--shadow`, `--font-sans`, `--font-mono`.
- **Reuse existing utility & component primitives** instead of duplicating ad-hoc styles:
  - `.num` (`@utility num`): `font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap;` for all currency, percentages, and tabular dates.
  - `.card`, `.btn` (`.primary`, `.danger`, `.same`), `.link`, `.hero`, `.src-hero`, `.chip`, `.pill-reserve`.
- **No `transition-all`**: Always specify exact properties (e.g., `transition-[border-color,box-shadow,transform] duration-150`).
- For detailed Tailwind v4 token hierarchy and component composition patterns, see [references/tailwind-v4-patterns.md](references/tailwind-v4-patterns.md).

---

## 7. Zod Schema Validation Best Practices

Validate every untrusted boundary (Server Actions, Route Handlers, `JSON.parse()`, `FormData`, query params, and `process.env`) with Zod schemas in `src/features/<domain>/schemas/` or `src/lib/env.ts`.

### Schema Definition
- **Strict primitives over `any`**: Use `z.unknown()` instead of `z.any()`. Use `z.enum([...])` for fixed string unions rather than raw `z.string()`.
- **Validate at definition**: Put `.trim()`, `.min()`, `.max()`, `.regex()`, `.int()`, `.positive()`, and range bounds directly on the schema fields.
- **Coerce boundary strings**: Use `z.coerce.number()` / `z.coerce.boolean()` or explicit `.transform()` + `.refine()` for `FormData`, URL search params, and stringified numeric inputs.
- **Payday money & rate boundaries**: Validate money/rate inputs strictly (finite bounds, valid ISO calendar dates `YYYY-MM-DD`, non-negative `tax`/`deductions`, `gross >= net`, and `0..10000` basis points) before converting to integer cents.

### Parsing & Validation
- **Always use `safeParse()`** for user input, forms, and external API payloads (never bare `.parse()` in Server Actions or UI handlers):
  ```typescript
  const parsed = savePaychequeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input data',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  ```
- **Surface all issues cleanly**: Use `parsed.error.flatten().fieldErrors` for form fields and `issue.path` for nested arrays/objects.
- **Avoid double validation**: Validate once at the system boundary and pass typed validated objects inward.

### Type Inference, Composition & Refinements
- **Derive TypeScript types from schemas**: Export both the schema and `export type FooInput = z.infer<typeof fooSchema>;` (use `z.input<typeof schema>` when input differs from transformed output).
- **Compose variants without duplication**: Derive update/subset schemas with `.partial()`, `.pick()`, `.omit()`, and `.extend()`, or model tagged variants with `z.discriminatedUnion('kind', [...])`.
- **Safe refinements**: Inside `.refine()`, return `false` (never throw an Error) and attach a `path` or use `.superRefine()` with `ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...], message: '...' })` for cross-field invariants (e.g., `gross >= amount`).
- **Cache module-level schemas**: Define `z.object(...)` schemas once at module scope, never inside hot render loops or request handlers.

---

## 8. Agent Execution Checklist (Pre-Flight Verification)

Before completing a task or generating new files, verify:
1. [ ] Is `src/app/` kept thin, delegating UI and business logic to `src/features/<domain>/`?
2. [ ] Are components Server Components by default, with `'use client'` isolated only to interactive leaves?
3. [ ] Are `params`, `searchParams`, `cookies()`, and `headers()` properly `await`ed?
4. [ ] Do all `services/*.ts` files include `import 'server-only';`?
5. [ ] Do all `actions/*.ts` files include `'use server';`, `safeParse()` Zod validation, and cache revalidation?
6. [ ] Are styles using Tailwind v4 `@theme inline` tokens and `globals.css` primitives without `transition-all` or `tailwind.config.ts`?
7. [ ] Are all file names in `kebab-case` and imports using `@/` aliases?