from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.sources.exceptions import DuplicateSourceName, SourceHasPaycheques
from src.sources.models import Source
from src.sources.schemas import SourceCreate, SourceUpdate


async def list_sources(db: AsyncSession) -> list[Source]:
    stmt = select(Source).order_by(Source.archived.asc(), Source.name.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, source_id: int) -> Source | None:
    return await db.get(Source, source_id)


async def create_source(db: AsyncSession, payload: SourceCreate) -> Source:
    source = Source(
        name=payload.name,
        kind=payload.kind.value,
        color=payload.color,
        archived=payload.archived,
        is_tax_withheld=payload.is_tax_withheld,
        tax_reserve_bps=payload.tax_reserve_bps,
    )
    db.add(source)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise DuplicateSourceName() from exc
    await db.refresh(source)
    return source


async def update_source(db: AsyncSession, source: Source, payload: SourceUpdate) -> Source:
    source.name = payload.name
    source.kind = payload.kind.value
    source.color = payload.color
    source.archived = payload.archived
    source.is_tax_withheld = payload.is_tax_withheld
    source.tax_reserve_bps = payload.tax_reserve_bps
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise DuplicateSourceName() from exc
    await db.refresh(source)
    return source


async def delete_source(db: AsyncSession, source: Source) -> None:
    await db.delete(source)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise SourceHasPaycheques() from exc
