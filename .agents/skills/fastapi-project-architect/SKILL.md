---
name: fastapi-project-architect
description: FastAPI project architecture and engineering patterns. Enforces domain-driven package organization, async route boundaries, modern dependency injection (Annotated[T, Depends(...)]), Pydantic v2 validation, SQLAlchemy 2.0 async with SQLite WAL/idempotent migrations, pytest async testing, Ruff linting, and anti-pattern prevention.
triggers:
  - "fastapi architecture"
  - "fastapi structure"
  - "fastapi best practices"
  - "pydantic v2"
  - "sqlalchemy async"
  - "sqlite"
  - "fastapi router"
  - "fastapi dependency"
  - "pytest"
  - "ruff"
---

# FastAPI Best Practices for AI Agents

A machine-readable companion to [fastapi-best-practices README.md](https://github.com/zhanymkanov/fastapi-best-practices/blob/master/README.md) for AI coding agents
working in FastAPI projects. Same rules, restructured for fast pattern matching:
version pins, Do/Don't blocks, anti-patterns, and a quick-reference table.

## Compatibility Matrix

Pin to these versions or newer. Examples in this file assume them.

| Dependency       | Minimum   | Notes                                                |
|------------------|-----------|------------------------------------------------------|
| Python           | 3.11      | Required for `StrEnum` and `X \| Y` union syntax     |
| FastAPI          | 0.115     | `Annotated[T, Depends(...)]` is the idiomatic form   |
| Pydantic         | 2.7       | v1 APIs (`json_encoders`, `.dict()`) are removed     |
| pydantic-settings| 2.4       | Lives in a separate package since Pydantic v2        |
| SQLAlchemy       | 2.0       | Use the async API (`AsyncSession`, `async_sessionmaker`) |
| aiosqlite        | 0.20      | Async SQLite driver with WAL + FK `PRAGMA` setup     |
| httpx            | 0.27      | Use `ASGITransport` for in-process async tests       |
| pytest / asyncio | 8.0 / 0.24| `asyncio_mode = "auto"` in `pyproject.toml`          |
| ruff             | 0.6       | Replaces black, isort, autoflake                     |

## Project Structure

Organize by domain, not by file type. One package per bounded context.

```
src/
├── {domain}/           # e.g., auth/, posts/, aws/
│   ├── router.py       # API endpoints
│   ├── schemas.py      # Pydantic models
│   ├── models.py       # SQLAlchemy ORM models
│   ├── service.py      # Business logic
│   ├── dependencies.py # Route dependencies
│   ├── config.py       # Domain-scoped BaseSettings
│   ├── constants.py    # Constants and error codes
│   ├── exceptions.py   # Domain-specific exceptions
│   └── utils.py        # Helper functions
├── config.py           # Global BaseSettings
├── models.py           # Shared Pydantic / ORM bases
├── exceptions.py       # Global exceptions
├── database.py         # Async engine + session factory
└── main.py             # FastAPI app + lifespan
```

**Cross-domain imports**: always use the explicit module name. Never `from src.auth import *`.

```python
from src.auth import constants as auth_constants
from src.notifications import service as notification_service
from src.posts.constants import ErrorCode as PostsErrorCode
```

## Async Routes

### Decision rule

| Route does this                        | Use         |
|----------------------------------------|-------------|
| `await`-able non-blocking I/O          | `async def` |
| Blocking I/O (no async client exists)  | `def` (sync, runs in threadpool) |
| Mix of both                            | `async def` + `run_in_threadpool` for the blocking part |
| CPU-bound work (>50 ms compute)        | Offload to a worker process (Celery / RQ / Arq) |

### Do / Don't

```python
# DON'T — blocking call inside async route freezes the entire event loop
@router.get("/bad")
async def bad():
    time.sleep(10)            # blocks every request on this worker
    return {"ok": True}

# DO — sync route lets FastAPI run it in a threadpool
@router.get("/sync-ok")
def sync_ok():
    time.sleep(10)            # blocks one threadpool worker, not the loop
    return {"ok": True}

# DO — async route with awaitable sleep
@router.get("/async-ok")
async def async_ok():
    await asyncio.sleep(10)   # yields control, loop keeps serving requests
    return {"ok": True}

# DO — async route that has to call a sync library
from fastapi.concurrency import run_in_threadpool

@router.get("/wrap")
async def wrap():
    result = await run_in_threadpool(legacy_sync_client.fetch, "id")
    return result
```

### Threadpool caveats
- Default Starlette threadpool size is 40. Saturating it slows every sync route.
- Threads cost more than coroutines. Don't use sync routes "just because."

## Pydantic v2

### Use built-in constraints and `Annotated` metadata
Prefer built-in constraints (`Field(...)`, `StringConstraints`, `annotated_types`) over custom validators. Never use `...` (Ellipsis) as a default value in Pydantic models or FastAPI `Query()`/`Path()` parameters.

```python
from enum import StrEnum
from typing import Annotated
from pydantic import AnyUrl, BaseModel, EmailStr, Field, StringConstraints


class MusicBand(StrEnum):
    AEROSMITH = "AEROSMITH"
    QUEEN = "QUEEN"
    ACDC = "AC/DC"


CleanStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class UserCreate(BaseModel):
    first_name: CleanStr = Field(max_length=128)
    username: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    email: EmailStr
    age: int = Field(ge=18)                     # required, must be >= 18
    favorite_band: MusicBand | None = None
    website: AnyUrl | None = None
```

> **Don't** write `Field(ge=18, default=None)`. The constraint and the default contradict
> each other. Decide: required (`Field(ge=18)`) or optional (`int | None = Field(default=None, ge=18)`).

### Validators, Forward Annotations & Unions
- **Prefer `AfterValidator` over `mode="before"`** whenever possible so Pydantic runs type coercion first and the validator receives the typed value. Use `mode="before"` only when normalizing untrusted raw inputs (e.g., stripping `$`/`,` before parsing integer cents). Attach reusable validators via `Annotated[T, AfterValidator(fn)]`.
- **Avoid `from __future__ import annotations`** in Pydantic schema modules (deferred stringification can break schema resolution); quote only genuine self-references, or use Python 3.12+ `type JsonValue = ...` / `TypeAliasType` for recursive types.
- **Avoid un-discriminated model subclassing** in nested fields: Pydantic serializes by declared static type, silently dropping subclass fields. Use discriminated unions (`Annotated[SubA | SubB, Field(discriminator="type")]`) or generics instead.
- **Do not use `ORJSONResponse` or `UJSONResponse`** (deprecated); declare return types or `response_model` so Pydantic v2 serializes in Rust.

### Custom base model — modern serialization

`json_encoders` is deprecated in Pydantic v2. Use `@field_serializer` for per-field rules,
or annotate a custom type with `PlainSerializer`.

```python
from datetime import datetime
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, field_serializer


class CustomModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("*", when_used="json", check_fields=False)
    def _serialize_datetimes(self, value):
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=ZoneInfo("UTC"))
            return value.strftime("%Y-%m-%dT%H:%M:%S%z")
        return value
```

### Split BaseSettings by domain

`pydantic-settings` is its own package since Pydantic v2.

```python
# src/auth/config.py
from datetime import timedelta
from pydantic_settings import BaseSettings, SettingsConfigDict


class AuthConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AUTH_", env_file=".env", extra="ignore")

    JWT_ALG: str
    JWT_SECRET: str
    JWT_EXP_MINUTES: int = 5
    REFRESH_TOKEN_KEY: str
    REFRESH_TOKEN_EXP: timedelta = timedelta(days=30)
    SECURE_COOKIES: bool = True


auth_settings = AuthConfig()
```

## Dependencies

### Use Annotated, not default-arg `Depends(...)`

`Annotated[T, Depends(...)]` is the idiomatic form since FastAPI 0.95 and avoids
gotchas with default values.

```python
# DO — modern Annotated form
from typing import Annotated
from fastapi import Depends

PostDep = Annotated[dict, Depends(valid_post_id)]

@router.get("/posts/{post_id}")
async def get_post(post: PostDep):
    return post

# Avoid — default-argument form (still works, but legacy)
@router.get("/posts/{post_id}")
async def get_post(post: dict = Depends(valid_post_id)):
    return post
```

### Validate inside dependencies (not just inject)
```python
async def valid_post_id(post_id: UUID4) -> dict:
    post = await service.get_by_id(post_id)
    if not post:
        raise PostNotFound()
    return post
```

### Chain dependencies for reuse
```python
async def valid_owned_post(
    post: Annotated[dict, Depends(valid_post_id)],
    token_data: Annotated[dict, Depends(parse_jwt_data)],
) -> dict:
    if post["creator_id"] != token_data["user_id"]:
        raise UserNotOwner()
    return post
```

### Rules
- Dependencies are **cached per request**. Same `Depends(x)` called 5 times in one request → `x` runs once.
- Prefer `async def` dependencies. Sync deps run in the threadpool — wasted overhead for small CPU-only checks.
- Use **the same path-variable name** across endpoints when you want to share a dependency (e.g. `profile_id` in both `/profiles/{profile_id}` and `/creators/{profile_id}`).

## Authentication — JWT

Use **`PyJWT`**, not `python-jose` (unmaintained).

```python
import jwt  # PyJWT
from jwt.exceptions import InvalidTokenError

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except InvalidTokenError as exc:
        raise InvalidCredentials() from exc
```

## Database — SQLAlchemy 2.0 Async + SQLite (`aiosqlite`)

Prefer SQLAlchemy 2.0's async API (`AsyncEngine`, `AsyncSession`, `async_sessionmaker(expire_on_commit=False)`). For SQLite (`aiosqlite`), enforce WAL mode, busy timeout, and foreign keys on every engine connection (`src/database.py`):

```python
# src/database.py
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection: Any, _connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA synchronous = NORMAL")
    cursor.execute("PRAGMA busy_timeout = 5000")
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


engine: AsyncEngine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, expire_on_commit=False
)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


DBDep = Annotated[AsyncSession, Depends(get_db)]
```

### Money, Rates & Data Integrity Invariants
- **Exact integer cents & basis points**: Store all monetary amounts (`amount_cents`, `gross_cents`, `tax_cents`, `deductions_cents`) as `INTEGER` cents and percentages/weights (`tax_reserve_bps`, `weight_bps`) as `INTEGER` basis points (`0..10000`) — never floats for currency.
- **Database-level `CHECK` & `INDEX` guards**: Enforce non-negative/domain bounds and ISO dates (`CheckConstraint("date(paid_on) = paid_on", ...)`), `ondelete="RESTRICT"` where relational delete protection applies, and composite/partial indexes (`sqlite_where=text("import_hash IS NOT NULL")`).
- **Naming conventions**: `lower_case_snake`, plural or domain-consistent table names matching existing schema (`sources`, `paycheques`, `allocation_rules`), `_cents`/`_bps` suffixes for financial integers, and consistent FK column names (`source_id`).

### Idempotent Startup Schema Migrations (`ensure_schema_migrations`)
Payday uses idempotent SQLite schema migrations on startup rather than Alembic:
- Inside `init_db`, call `await conn.run_sync(Base.metadata.create_all)` followed by `await conn.run_sync(ensure_schema_migrations)`.
- Inspect existing columns via `PRAGMA table_info(<table>)`, run `ALTER TABLE ... ADD COLUMN ...` only when a column is missing, and use `CREATE [UNIQUE] INDEX IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` so startup is safe and repeatable on existing `/data/salary.db` files.

### SQL-First & Security Hygiene
- **SQL-first, Pydantic-second**: Do joins, filtering, and aggregation in SQL (`select(...)`), then hydrate into Pydantic only for response validation.
- **Parameterized queries only**: Always use SQLAlchemy ORM/Core expressions or bound parameters (`text("... :param")`). Never interpolate or concatenate user input into SQL strings.
- **CSV export formula-injection protection**: Escape string cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` (e.g., `_safe_csv_cell` prefixing `'`) when building downloadable CSV responses.

## Background work — BackgroundTasks vs Celery

| Use BackgroundTasks when…                | Use Celery / Arq / RQ when…                |
|------------------------------------------|--------------------------------------------|
| Task is < 1 second                       | Task takes seconds to minutes              |
| Failure can be silently dropped          | You need retries, dead-letter, or visibility|
| Task is in-process (send email, log row) | Task is CPU-heavy or needs a separate pool |
| You don't need scheduling                | You need cron, ETA, or rate limiting       |

```python
from fastapi import BackgroundTasks

@router.post("/signup")
async def signup(data: SignupIn, bg: BackgroundTasks):
    user = await service.create_user(data)
    bg.add_task(send_welcome_email, user.email)   # fire-and-forget, in-process
    return user
```

> BackgroundTasks run **after the response is sent, in the same worker process**. If the
> worker dies, the task is lost. There is no retry. Don't use them for anything you'd
> page on.

## Testing (`pytest` + `httpx` AsyncClient)

### Async client & isolated SQLite fixtures
Configure `asyncio_mode = "auto"` in `pyproject.toml`, and test against an isolated temp or `:memory:` SQLite database using `httpx.AsyncClient` + `ASGITransport`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_create_item(client: AsyncClient):
    resp = await client.post("/items", json={"title": "hi"})
    assert resp.status_code == 201
```

> **Don't** use `async_asgi_testclient` — it's unmaintained. The example above (`httpx` + `ASGITransport`) is the supported path.

### Testing Conventions & Dependency Overrides
- **Arrange / Act / Assert (AAA)** with descriptive test names (`test_<unit>_<scenario>_<outcome>`) and isolated fixtures (no shared mutable state across tests).
- Use FastAPI's `app.dependency_overrides[dep] = fake_dep` (clearing in fixture teardown) instead of monkeypatching internals.
- Cover happy paths, boundary/validation errors (400/422), idempotency (e.g., duplicate CSV import hashes), and database constraint behavior (`RESTRICT` deletes, atomic rollbacks).

## API documentation

### Hide docs outside selected envs
```python
from fastapi import FastAPI
from src.config import settings

SHOW_DOCS_IN = {"local", "staging"}
app_kwargs = {"title": "My API"}
if settings.ENVIRONMENT not in SHOW_DOCS_IN:
    app_kwargs["openapi_url"] = None    # disables /docs and /redoc

app = FastAPI(**app_kwargs)
```

### Document endpoints fully
```python
from fastapi import APIRouter, status

router = APIRouter()


@router.post(
    "/items",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an item",
    description="Creates an item owned by the authenticated user.",
    tags=["items"],
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ErrorResponse, "description": "Validation error"},
        status.HTTP_409_CONFLICT:    {"model": ErrorResponse, "description": "Slug already exists"},
    },
)
async def create_item(payload: ItemCreate) -> ItemResponse: ...
```

## Linting & Formatting (Iterative Ruff Workflow)

Use project rules in `pyproject.toml` (`[tool.ruff.lint]`) and run iteratively until clean:

```shell
ruff check --fix .        # apply safe autofixes
ruff format .             # format code consistently
ruff check .              # verify zero remaining lint errors
```

- Review every autofixed diff carefully (`git diff`) before accepting.
- Use `--unsafe-fixes` only after verifying each change preserves semantics.
- Never silence findings with broad `# noqa`; use targeted `# noqa: <CODE>` only when justified (e.g., `# noqa: F401` for model registration side effects in `database.py`).

---

## Anti-patterns — common AI-agent mistakes

If you're an agent reviewing a diff, check for these. Each is a real failure mode I've
seen agents introduce.

| Anti-pattern | Why it's wrong | Fix |
|---|---|---|
| `requests.get(...)` inside `async def` | Blocks the event loop. `requests` is sync. | Use `httpx.AsyncClient` or `await run_in_threadpool(requests.get, ...)`. |
| `time.sleep` / `open()` / sync DB driver inside `async def` | Same — blocks the loop. | Use the async equivalent (`asyncio.sleep`, `aiofiles`, async driver). |
| `from jose import jwt` | `python-jose` is unmaintained. | `import jwt` (PyJWT). |
| `from async_asgi_testclient import TestClient` | Unmaintained. | `httpx.AsyncClient` + `ASGITransport`. |
| `model_config = ConfigDict(json_encoders={...})` | Deprecated in Pydantic v2. | `@field_serializer` or `Annotated[T, PlainSerializer(...)]`. |
| `Field(ge=18, default=None)` or `Field(...)` Ellipsis defaults | Contradictory default or legacy Ellipsis syntax. | Pick required (`Field(ge=18)`) or optional (`int \| None = Field(default=None, ge=18)`). |
| `def get_user(id: int = Depends(...))` (default-arg form) | Legacy; gotchas with default values. | `user: Annotated[User, Depends(...)]`. |
| Storing money or tax rates as `float` | Floating-point rounding drift. | Store integer cents (`amount_cents`) and integer basis points (`weight_bps`). |
| Missing `PRAGMA foreign_keys = ON` / `WAL` on SQLite | FK constraints silently ignored and write locks stall reads. | Set WAL, `busy_timeout`, and `foreign_keys` in the SQLAlchemy `connect` listener. |
| Catching `Exception` around a route's body | Hides bugs and turns 500s into silent 200s. | Catch the specific exception class; raise `HTTPException` with a meaningful status. |
| `BackgroundTasks` for anything you'd page on | No retry, dies with the worker. | Use Celery / Arq / RQ. |
| Calling a sync ORM session inside `async def` | Blocks the loop, may deadlock the pool. | Use `AsyncSession`. |
| Returning a Pydantic model and *also* setting `response_model=` to that same class | Model gets constructed twice (validate + serialize). | Either return a `dict`/ORM row and let `response_model` validate, or drop `response_model` and trust the return type. |
| Importing across domains via deep paths (`from src.auth.service.user import ...`) | Tight coupling, hard to refactor. | `from src.auth import service as auth_service`. |
| Reusing one `BaseSettings` for the whole app | Hard to reason about, every domain reads every var. | One `BaseSettings` per domain. |
| Mocking the database in integration tests | Mock/prod divergence eventually fires in prod. | Use an isolated temp/in-memory SQLite DB and `dependency_overrides` for external services. |

## Quick reference

| Scenario                             | Solution                                          |
|--------------------------------------|---------------------------------------------------|
| Non-blocking I/O                     | `async def` route with `await`                    |
| Blocking I/O (no async client)       | `def` route (sync, runs in threadpool)            |
| Sync library inside async route      | `await run_in_threadpool(fn, *args)`              |
| CPU-intensive work                   | Celery / Arq / RQ worker process                  |
| Request validation against DB        | Dependency that loads + validates + returns       |
| Reuse validation across routes       | Chain dependencies                                |
| Inject dependency in modern style    | `Annotated[T, Depends(...)]`                      |
| Per-request dep caching              | Default behavior — same `Depends(x)` runs once    |
| Per-domain config                    | One `BaseSettings` subclass per domain            |
| Custom datetime serialization        | `@field_serializer`                               |
| Money & percentage precision         | Integer cents & basis points (`0..10000`)         |
| SQLite schema changes                | Idempotent `ensure_schema_migrations` (`PRAGMA table_info`) |
| Async DB                             | SQLAlchemy 2.0 async (`AsyncSession`) + `aiosqlite` |
| HTTP test client                     | `httpx.AsyncClient` + `ASGITransport`             |
| Swap dep in tests                    | `app.dependency_overrides[dep] = fake`            |
| Lint + format                        | `ruff check --fix .` + `ruff format .`            |

