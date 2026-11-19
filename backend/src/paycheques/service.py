import csv
import hashlib
import io
import math
import re
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.exceptions import BadRequestError
from src.paycheques.constants import MAX_HOURS, MAX_NOTE_LENGTH, ErrorCode
from src.paycheques.exceptions import InvalidSourceReference
from src.paycheques.models import Paycheque
from src.paycheques.schemas import (
    PaychequeCreate,
    PaychequeImportPayload,
    PaychequeImportResponse,
    PaychequeUpdate,
)
from src.paycheques.utils import parse_cents, parse_optional_cents, validate_paystub_breakdown
from src.sources.constants import MAX_SOURCE_NAME_LENGTH, SourceKind
from src.sources.models import Source

_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
_MAX_IMPORT_CHARS = 5_000_000
_MAX_IMPORT_ROWS = 5_000
_IMPORT_COLORS = (
    "#0d7480",
    "#c2410c",
    "#2563eb",
    "#4d7c0f",
    "#b45309",
    "#be123c",
    "#0e7490",
    "#475569",
)


def _safe_csv_cell(text: str) -> str:
    return f"'{text}" if text.startswith(_CSV_FORMULA_PREFIXES) else text


def compute_paycheque_import_hash(source_id: int, paid_on: str, amount_cents: int) -> str:
    payload = f"{source_id}:{paid_on.strip()}:{int(amount_cents)}".encode()
    return hashlib.sha256(payload).hexdigest()


def _pick_alias(row: dict[str, Any], *aliases: str) -> Any:
    for key in aliases:
        if key in row and row[key] is not None and str(row[key]).strip() != "":
            return row[key]
    return None


async def list_paycheques(db: AsyncSession) -> list[Paycheque]:
    stmt = select(Paycheque).order_by(Paycheque.paid_on.desc(), Paycheque.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, paycheque_id: int) -> Paycheque | None:
    return await db.get(Paycheque, paycheque_id)


async def _commit_paycheque(db: AsyncSession, paycheque: Paycheque) -> Paycheque:
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if "FOREIGN KEY" in str(exc.orig).upper():
            raise InvalidSourceReference() from exc
        raise BadRequestError("Invalid paycheque data.") from exc
    await db.refresh(paycheque)
    return paycheque


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
    return await _commit_paycheque(db, paycheque)


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
    return await _commit_paycheque(db, paycheque)


async def delete_paycheque(db: AsyncSession, paycheque: Paycheque) -> None:
    await db.delete(paycheque)
    await db.commit()


async def build_export_csv(
    db: AsyncSession,
    year: str | None = None,
    source_id: int | None = None,
    q: str | None = None,
) -> bytes:
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
    clean_year = year.strip() if year else ""
    if clean_year and clean_year != "all":
        if not re.fullmatch(r"\d{4}", clean_year):
            raise BadRequestError("Year must be a 4-digit year.")
        stmt = stmt.where(Paycheque.paid_on.like(f"{clean_year}-%"))
    if source_id is not None:
        stmt = stmt.where(Paycheque.source_id == source_id)

    q_lower = (q or "").strip().lower()
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
        if q_lower:
            haystack = f"{source_name} {note} {amount_cents / 100:.2f} {paid_on}".lower()
            if q_lower not in haystack:
                continue
        reserve_cents = (
            (amount_cents * tax_reserve_bps + 5000) // 10000
            if not is_tax_withheld and tax_reserve_bps > 0 and not tax_cents
            else 0
        )
        writer.writerow(
            [
                paid_on,
                _safe_csv_cell(source_name),
                f"{amount_cents / 100:.2f}",
                "" if gross_cents is None else f"{gross_cents / 100:.2f}",
                "" if tax_cents is None else f"{tax_cents / 100:.2f}",
                "" if deductions_cents is None else f"{deductions_cents / 100:.2f}",
                f"{reserve_cents / 100:.2f}",
                "" if hours is None else hours,
                _safe_csv_cell(note),
            ]
        )
    return buf.getvalue().encode("utf-8")


async def import_paycheques_batch(
    db: AsyncSession, payload: PaychequeImportPayload
) -> PaychequeImportResponse:
    raw_rows: list[dict[str, Any]]
    if payload.csv_text is not None:
        if len(payload.csv_text) > _MAX_IMPORT_CHARS:
            raise BadRequestError("CSV payload exceeds 5MB limit.")
        clean_csv = payload.csv_text.lstrip("\ufeff")
        reader = csv.DictReader(io.StringIO(clean_csv))
        if not reader.fieldnames:
            raise BadRequestError("CSV header row is required.")
        raw_rows = list(reader)
    elif payload.rows is not None:
        raw_rows = payload.rows
    else:
        raise BadRequestError("Provide csv_text or rows.")

    if len(raw_rows) > _MAX_IMPORT_ROWS:
        raise BadRequestError(f"Import batch cannot exceed {_MAX_IMPORT_ROWS} rows.")

    sources_res = await db.execute(select(Source.id, Source.name))
    source_map = {name.strip().lower(): sid for sid, name in sources_res.all()}

    existing_res = await db.execute(
        select(
            Paycheque.import_hash,
            Paycheque.source_id,
            Paycheque.paid_on,
            Paycheque.amount_cents,
        )
    )
    seen_hashes: set[str] = set()
    for imp_hash, sid, paid_on, amount_cents in existing_res.all():
        if imp_hash:
            seen_hashes.add(imp_hash)
        seen_hashes.add(compute_paycheque_import_hash(sid, paid_on, amount_cents))

    imported_count = 0
    skipped_duplicates = 0
    created_sources = 0
    errors: list[dict[str, Any]] = []

    for row_num, raw in enumerate(raw_rows, start=1):
        norm = {str(k or "").strip().lower(): v for k, v in raw.items() if k is not None}
        if not any(v is not None and str(v).strip() != "" for v in norm.values()):
            continue

        try:
            source_name = str(
                _pick_alias(norm, "source_name", "source", "employer") or ""
            ).strip()
            if not source_name:
                raise ValueError("Source name is required")
            if len(source_name) > MAX_SOURCE_NAME_LENGTH:
                raise ValueError(
                    f"Source name must be {MAX_SOURCE_NAME_LENGTH} characters or fewer"
                )

            source_id = source_map.get(source_name.lower())
            if not source_id:
                if not payload.auto_create_sources:
                    raise ValueError(f"Unknown source '{source_name}'.")
                raw_kind = str(_pick_alias(norm, "source_kind", "kind") or "job").strip().lower()
                kind = (
                    raw_kind
                    if raw_kind in {k.value for k in SourceKind}
                    else SourceKind.JOB.value
                )
                color = _IMPORT_COLORS[len(source_map) % len(_IMPORT_COLORS)]
                new_source = Source(name=source_name, kind=kind, color=color, archived=0)
                db.add(new_source)
                await db.flush()
                source_id = new_source.id
                source_map[source_name.lower()] = source_id
                created_sources += 1

            raw_date = _pick_alias(norm, "paid_on", "date")
            if raw_date is None:
                raise ValueError(ErrorCode.INVALID_DATE)
            try:
                paid_on = date.fromisoformat(str(raw_date).strip()).isoformat()
            except ValueError:
                raise ValueError(ErrorCode.INVALID_DATE) from None

            amount_cents = parse_cents(
                _pick_alias(norm, "amount", "net", "net_pay"), "Amount", required=True
            )
            gross_cents = parse_optional_cents(
                _pick_alias(norm, "gross", "gross_pay"), "Gross", allow_zero=False
            )
            tax_cents = parse_optional_cents(
                _pick_alias(norm, "tax", "income_tax"), "Tax", allow_zero=True
            )
            deductions_cents = parse_optional_cents(
                _pick_alias(norm, "deductions"), "Deductions", allow_zero=True
            )
            gross_cents, tax_cents, deductions_cents = validate_paystub_breakdown(
                amount_cents, gross_cents, tax_cents, deductions_cents
            )

            raw_hours = _pick_alias(norm, "hours")
            hours: float | None = None
            if raw_hours is not None:
                try:
                    hours = float(str(raw_hours).strip())
                except ValueError:
                    raise ValueError(ErrorCode.HOURS_NOT_NUMBER) from None
                if not math.isfinite(hours) or not (0 < hours < MAX_HOURS):
                    raise ValueError(ErrorCode.HOURS_OUT_OF_RANGE)

            note = str(_pick_alias(norm, "note", "notes") or "").strip()
            if len(note) > MAX_NOTE_LENGTH:
                raise ValueError(ErrorCode.NOTE_TOO_LONG)

            import_hash = compute_paycheque_import_hash(source_id, paid_on, amount_cents)
            if import_hash in seen_hashes:
                skipped_duplicates += 1
                continue

            db.add(
                Paycheque(
                    source_id=source_id,
                    paid_on=paid_on,
                    amount_cents=amount_cents,
                    gross_cents=gross_cents,
                    tax_cents=tax_cents,
                    deductions_cents=deductions_cents,
                    hours=hours,
                    note=note,
                    import_hash=import_hash,
                )
            )
            seen_hashes.add(import_hash)
            imported_count += 1
        except ValueError as exc:
            errors.append({"row": row_num, "error": str(exc)})

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise BadRequestError("Failed to commit CSV import batch.") from exc

    return PaychequeImportResponse(
        ok=True,
        imported_count=imported_count,
        skipped_duplicates=skipped_duplicates,
        created_sources=created_sources,
        error_count=len(errors),
        errors=errors,
    )
