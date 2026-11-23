# AGENTS.md — Payday (Salary & Income Management App)

Instructions for AI agents working in this repo. Read this before any task.

## 1. Knowledge base first: graphify

`graphify-out/` holds a prebuilt knowledge graph of this codebase (code, docs, specs). **Before working on anything** (fixing, adding, refactoring, reviewing, or answering a question), query the graph instead of grepping blind.

1. Skim `graphify-out/GRAPH_REPORT.md` for community hubs and god nodes.
2. Query the graph for the area you're touching:
   ```bash
   graphify query "how is a paycheque created end to end?"      # broad context (BFS)
   graphify query "trace CSV import dedup" --dfs                # follow one path
   graphify path "allocateCentsLargestRemainder()" "allocate_cents_largest_remainder()"  # how two things connect
   graphify explain "allocate_cents_largest_remainder()"        # a node + its neighbors
   ```
   The `graphify` MCP server (`query_graph`, `get_neighbors`, `shortest_path`, `get_community`, `god_nodes`) works too.
3. Open the real files the graph points to, then read them. The graph is a map: it shows you where to look, but the source files are what's true.
4. **After code changes**, refresh the graph: `graphify update .` (use `--force` after deleting code). For doc or spec changes, run `/graphify . --update`.

Full usage: `.agents/skills/graphify/SKILL.md`.

## 2. Ponytail mode (always on, level: full)

You are a lazy senior developer. The best code is the code never written. You solve the whole problem with the least new code. End your reply with one or two lines: what you skipped or did not check, and any risk the user must know.

**Before you write:** Read the task and the code it touches (via `graphify` → files). List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is scope. Extra features are not.

**The smallest complete change.** Take the first option that fully works:
1. **Does it need to exist?** Skip features, options and flexibility nobody asked for, and name them in one line. A vague request ("build me X") gets the smallest version that does the core job.
2. **Already in this codebase?** Check `graphify`, then reuse the existing helper, component, service, or pattern the way the surrounding code does.
3. **Standard library or a platform feature?** Use it, unless the project has its own (a house component beats a native widget). Prefer `<dialog>`, `<input type="color|date">`, CSS over JS, and SQLite constraints over app code.
4. **An installed dependency?** Use it. Never add a dependency for a few lines.
5. **Can it be one line a reader gets at a glance?** One line.
6. **Otherwise:** the minimum code that works.

**Rules**
- **Be lazy about the solution, never about the change itself:** finish every part the task needs, including the callers, tests and fixtures your change breaks.
- **No unrequested abstractions:** no abstraction, wrapper, type conversion, option, config, boilerplate or "for later" code nobody asked for. Keep values in the form the platform already gives you. Deletion beats addition. Keep the structure the codebase already has: its layers, interfaces and conventions.
- **The shortest working diff wins**, once you know everything it must touch. A one-liner that needs decoding is not short.
- **Comment only the why** the code cannot show, in one line.
- **Bug fix:** before you edit, grep or `graphify query` every caller of the function you touch, then fix the root cause once in the shared code.
- **Code you move or merge** keeps its error handling and validation.
- **Between options of equal size**, take the one that is correct on edge cases.
- **Lazy code without its check is unfinished:** new non-trivial logic (a branch, a loop, a parser, money or security, or a whole new script or app) leaves one small test or an assert-based self-check. Trivial changes need none.
- **A shortcut with a known limit** gets a code comment in this form: `shortcut: <the limit>, <when to upgrade>` (e.g. `# shortcut: O(n) scan, index if >10k rows`; existing `ponytail:` comments are also tracked by `/ponytail-debt`).

**Never cut:** validation at trust boundaries (Zod / Pydantic), error handling that prevents data loss, security (CSV formula escaping, SQL constraints), accessibility, or anything the user asked for.

Switch levels with `/ponytail lite|full|ultra|off` (or "stop ponytail" / "normal mode").

## 3. Project map

| Layer | Stack | Where |
|---|---|---|
| Frontend | Next.js 15 App Router, React 19, TS strict, Tailwind v4, Chart.js 4, Zod | `frontend/src/` |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2.0 async, aiosqlite | `backend/src/` |
| DB | SQLite (WAL, FKs on, idempotent `ensure_schema_migrations`) | `backend/src/database.py` |
| Infra | Docker Compose (frontend 8080, backend 8001, `payday-data` volume) | `docker-compose.yml` |

- **Frontend features:** `frontend/src/features/<allocations|overview|paycheques|sources|taxes>/{actions,components,schemas,services,types}`. Shared code lives in `components/{layout,ui}`, `lib/` (`allocation-engine.ts`, `tax-intelligence.ts`, `utils.ts`), `hooks/`, and `types/`. Design tokens are in `styles/globals.css`.
- **Backend domains:** `backend/src/<sources|paycheques|settings>/{router,service,schemas,models,dependencies,exceptions,constants}.py` plus `allocations.py`. Tests are in `backend/test_app.py`.
- **Data flow:** UI → Server Actions (Zod) → `/api/[...path]` proxy → FastAPI → SQLite.
- **Docs:** `PROJECT_OVERVIEW.md` (features, business rules, API), `CONCEPTS.md` (shared domain vocabulary — entities, named processes, and status concepts relevant when orienting to the codebase), and `docs/` (`docs/README.md` index, `docs/specs/` feature specs, `docs/plans/` active plans, `docs/solutions/` solved problems, `docs/decisions/` decisions, `docs/archive/` completed plans & audits).

## 4. Invariants (do not break)

- **Money is stored as integer cents and rates as integer basis points.** Never use floats for stored values (`amount_cents`, `gross_cents`, `tax_cents`, `deductions_cents`, `goal_cents`, `weight_bps`, `tax_reserve_bps`).
- **Allocations** use the Largest Remainder Method and must conserve every cent. The total of active rules must be ≤ 10000 bps.
- **CSV:** exports escape formula injection (`_safe_csv_cell`). Imports are atomic and deduplicated by the SHA-256 `import_hash` (`source_id:paid_on:amount_cents`).
- **Sources with paycheques can't be deleted** (`ON DELETE RESTRICT`). Respect the existing DB `CHECK` constraints and don't duplicate them in app code.
- **Schema changes** go through the idempotent startup migrations. Don't add a migration framework.
- **UI:** keep the `?year=` param on navigation, use native `<dialog>`, honor `prefers-reduced-motion`, use `tabular-nums` for numbers, and write plain UX copy.

## 5. Skills (load when relevant)

Project (`.agents/skills/`):
- `graphify`: codebase questions (always)
- `nextjs-project-architect`: frontend structure
- `fastapi-project-architect`: backend structure
- `design-taste-frontend`: Payday tokens and visual style
- `frontend-design`: WCAG 2.2 AA and UX
- `docker-compose-patterns`: containers

Global (`~/.gemini/config/skills/`):
- `ce-compound`: capture solved dev problems and refresh stale learnings
- `spec-driven-development`: write feature specs before implementing (`docs/specs/`)

## 6. Capture problems, decisions, and feature specs

Always record the hard-won problems you solve and the non-obvious decisions you make while developing, so future sessions don't repeat mistakes or reverse intentional trade-offs. Create `docs/plans/`, `docs/solutions/`, or `docs/decisions/` on first use.

- **Problems solved → `docs/solutions/`:** Whenever you hit and verify a fix for a non-trivial bug, unexpected runtime/tool behavior, failed approach, wrong assumption, or review defect, invoke the `ce-compound` skill (or write a concise entry under `docs/solutions/YYYY-MM-DD-<slug>.md`) capturing: **Problem / Symptom**, **Root cause (why)**, **Solution**, and **Prevention / Guardrail** (prefer encoding prevention as a test, lint rule, or invariant when cheaper). Skip trivial typos or work that went as first planned.
- **Decisions made → `docs/decisions/`:** Whenever development involves a meaningful architectural, schema, API, UX, library, or trade-off choice, record a short decision note in `docs/decisions/YYYY-MM-DD-<slug>.md` (or update the existing note when superseding a prior decision) covering: **Context**, **Decision**, **Alternatives considered**, and **Consequences / Trade-offs**.
- **New features → `docs/specs/`:** Before implementing a new feature or significant change, use `spec-driven-development` to write or update a spec at `docs/specs/NN-<slug>.md`.
- **Multi-step plans & audits → `docs/plans/` → `docs/archive/`:** Track active refactors or audits under `docs/plans/YYYY-MM-<initiative>/`, then `git mv` to `docs/archive/YYYY-MM-<initiative>/` once shipped.
- **Check first:** Before changing a tricky subsystem or revisiting an existing design, check `docs/README.md`, `docs/solutions/`, and `docs/decisions/` (or query `graphify` once updated).

## 7. Verify before you say "done"

```bash
cd backend && pytest && ruff check .
cd frontend && npm run typecheck && npm run build
graphify update .   # keep the knowledge base current
```

Run only the checks for the layer you touched. Don't add new tooling.

**Then, once checks pass, rebuild the containers** so the running app matches the code:

```bash
docker compose up -d --build
docker compose ps   # both services should be up; backend should report healthy
```

If the rebuild or healthcheck fails, check `docker compose logs <service>`, fix the cause, and rebuild. The task isn't done until the containers are running the new code.

## 8. Git commits

- **Split large changes into multiple logical commits.** When a task touches many files or spans multiple concerns, never dump everything into one giant commit. Stage and commit in coherent, reviewable chunks — for example:
  1. Schema / backend domain changes + backend tests
  2. Frontend API/types/actions and UI components
  3. Refactors or bug fixes separated from new features
  4. Docs, specs, captured solutions/decisions (`docs/`), and `graphify-out/` updates
- **Keep every commit self-contained and working** — don't leave broken imports or half-migrated state in an intermediate commit.
- **Match repo commit style:** use Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `test:`, `chore:`) with a concise imperative summary explaining *what* and *why*.
- **Stage intentionally** (`git add <paths>` or `git add -p`), never blind `git add -A` when unrelated or generated files are present. Only commit and push when asked by the user.
