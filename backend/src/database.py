from collections.abc import AsyncIterator
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import event, select
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import settings
from src.models import Base
from src.paycheques.models import Paycheque
from src.paycheques.utils import parse_cents
from src.settings.models import Setting  # noqa: F401
from src.sources.models import Source

# ponytail: pre-extracted from Salary.pdf; add pypdf upload only if importing arbitrary PDFs.
SEED: dict[tuple[str, str, str], str] = {
    ("Kung Fu Tea", "job", "#0d7480"): """
        2025-04-11 545.25
        2025-04-25 450.19
        2025-05-09 425.39
        2025-05-23 636.15
        2025-06-06 570.04
        2025-06-20 712.06
        2025-06-30 112.00
        2025-07-04 508.05
        2025-07-18 698.74
        2025-08-01 691.63
        2025-08-15 586.57
        2025-08-29 495.66
        2025-09-12 724.34
        2025-09-26 388.20
        2025-10-10 458.47
        2025-10-24 498.54
        2025-11-07 504.17
        2025-11-21 591.57
        2025-12-05 578.88
        2025-12-19 633.85
        2026-01-02 464.75
        2026-01-16 608.55
        2026-01-30 329.43
        2026-02-13 481.67
        2026-02-15 230.00
        2026-02-27 456.30
        2026-03-13 692.76
        2026-03-27 460.53
        2026-04-10 443.62
        2026-04-24 337.88
        2026-05-13 667.75
        2026-05-24 456.30
        2026-06-07 621.23
        2026-06-19 456.30
        2026-07-02 604.32
        2026-07-17 724.78
        2026-08-04 700.04
        2026-08-17 710.94
        2026-09-02 604.32
        2026-09-14 405.55
        2026-10-15 554.36
        2026-10-28 619.82
        2026-11-09 413.46""",
    ("Softchoice", "job", "#c2410c"): """
        2025-09-15 1402.99 Co-op term
        2025-09-29 1533.69 Co-op term
        2025-10-15 1533.69 Co-op term
        2025-10-31 1533.69 Co-op term
        2025-11-14 1533.69 Co-op term
        2025-11-28 1533.69 Co-op term
        2025-12-15 1533.69 Co-op term
        2025-12-31 654.49 Co-op term
        2026-05-15 1427.43 Co-op term
        2026-05-29 1536.42 Co-op term
        2026-06-13 1536.42 Co-op term
        2026-06-30 1536.42 Co-op term
        2026-07-15 1536.42 Co-op term
        2026-07-30 1536.42 Co-op term
        2026-08-15 1536.42 Co-op term
        2026-08-31 1405.71 Co-op term""",
    ("CRA / Government", "government", "#2563eb"): """
        2025-04-08 1262.09 Income tax refund
        2025-05-08 920.71 Ontario Trillium Benefit
        2025-06-05 944.75 GST/HST credit
        2025-06-10 846.00 Ontario Trillium Benefit""",
}


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection: Any, _connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode = WAL")
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


async def seed_database(session: AsyncSession) -> None:
    existing = await session.execute(select(Source.id).limit(1))
    if existing.scalar_one_or_none() is not None:
        return

    for (name, kind, color), rows in SEED.items():
        source = Source(name=name, kind=kind, color=color, archived=0)
        session.add(source)
        await session.flush()
        for line in rows.strip().splitlines():
            day, amount, *note = line.split(maxsplit=2)
            session.add(
                Paycheque(
                    source_id=source.id,
                    paid_on=day,
                    amount_cents=parse_cents(amount, "Amount", required=True),
                    note=note[0] if note else "",
                )
            )
    await session.commit()


async def init_db(
    target_engine: AsyncEngine = engine,
    session_factory: async_sessionmaker[AsyncSession] = SessionFactory,
) -> None:
    if settings.DB_PATH != ":memory:":
        Path(settings.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    async with target_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with session_factory() as session:
        await seed_database(session)
