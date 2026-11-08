import csv
import io

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.paycheques.exceptions import InvalidSourceReference
from src.paycheques.models import Paycheque
from src.paycheques.schemas import PaychequeCreate, PaychequeUpdate
from src.sources.models import Source


async def list_paycheques(db: AsyncSession) -> list[Paycheque]:
    stmt = select(Paycheque).order_by(Paycheque.paid_on.desc(), Paycheque.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, paycheque_id: int) -> Paycheque | None:
    return await db.get(Paycheque, paycheque_id)


async def create_paycheque(db: AsyncSession, payload: PaychequeCreate) -> Paycheque:
    paycheque = Paycheque(
        source_id=payload.source_id,
        paid_on=payload.paid_on,
        amount_cents=payload.amount_cents,
        hours=payload.hours,
        note=payload.note,
    )
    db.add(paycheque)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise InvalidSourceReference() from exc
    await db.refresh(paycheque)
    return paycheque


async def update_paycheque(
    db: AsyncSession, paycheque: Paycheque, payload: PaychequeUpdate
) -> Paycheque:
    paycheque.source_id = payload.source_id
    paycheque.paid_on = payload.paid_on
    paycheque.amount_cents = payload.amount_cents
    paycheque.hours = payload.hours
    paycheque.note = payload.note
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise InvalidSourceReference() from exc
    await db.refresh(paycheque)
    return paycheque


async def delete_paycheque(db: AsyncSession, paycheque: Paycheque) -> None:
    await db.delete(paycheque)
    await db.commit()


async def build_export_csv(db: AsyncSession) -> bytes:
    stmt = (
        select(
            Paycheque.paid_on,
            Source.name,
            Paycheque.amount_cents,
            Paycheque.hours,
            Paycheque.note,
        )
        .join(Source, Source.id == Paycheque.source_id)
        .order_by(Paycheque.paid_on.asc(), Paycheque.id.asc())
    )
    result = await db.execute(stmt)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "source", "amount", "hours", "note"])
    for paid_on, source_name, amount_cents, hours, note in result.all():
        writer.writerow(
            [
                paid_on,
                source_name,
                f"{amount_cents // 100}.{amount_cents % 100:02d}",
                "" if hours is None else hours,
                note,
            ]
        )
    return buf.getvalue().encode("utf-8")
