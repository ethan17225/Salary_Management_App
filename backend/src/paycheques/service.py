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
        gross_cents=payload.gross_cents,
        tax_cents=payload.tax_cents,
        deductions_cents=payload.deductions_cents,
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
    paycheque.gross_cents = payload.gross_cents
    paycheque.tax_cents = payload.tax_cents
    paycheque.deductions_cents = payload.deductions_cents
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
            Paycheque.gross_cents,
            Paycheque.tax_cents,
            Paycheque.deductions_cents,
            Source.is_tax_withheld,
            Source.tax_reserve_bps,
            Paycheque.hours,
            Paycheque.note,
        )
        .join(Source, Source.id == Paycheque.source_id)
        .order_by(Paycheque.paid_on.asc(), Paycheque.id.asc())
    )
    result = await db.execute(stmt)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "date",
            "source",
            "amount",
            "gross",
            "tax",
            "deductions",
            "tax_reserve",
            "hours",
            "note",
        ]
    )
    for (
        paid_on,
        source_name,
        amount_cents,
        gross_cents,
        tax_cents,
        deductions_cents,
        is_tax_withheld,
        tax_reserve_bps,
        hours,
        note,
    ) in result.all():
        reserve_cents = (
            (amount_cents * tax_reserve_bps + 5000) // 10000
            if not is_tax_withheld and tax_reserve_bps > 0 and not tax_cents
            else 0
        )
        writer.writerow(
            [
                paid_on,
                source_name,
                f"{amount_cents / 100:.2f}",
                "" if gross_cents is None else f"{gross_cents / 100:.2f}",
                "" if tax_cents is None else f"{tax_cents / 100:.2f}",
                "" if deductions_cents is None else f"{deductions_cents / 100:.2f}",
                f"{reserve_cents / 100:.2f}",
                "" if hours is None else hours,
                note,
            ]
        )
    return buf.getvalue().encode("utf-8")
