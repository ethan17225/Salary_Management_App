"""Import stage 1: turn an uploaded file into editable candidate rows. Nothing is saved here;
the user reviews the rows and commits them through the existing POST /api/paycheques/import."""

import asyncio
import csv
import io
import logging
import re
from datetime import datetime
from pathlib import Path

import openpyxl

from src.exceptions import AppError, BadRequestError
from src.paycheques import extractors
from src.paycheques.constants import MAX_HOURS, MAX_NOTE_LENGTH
from src.paycheques.exceptions import UnsupportedFileType
from src.paycheques.schemas import ParsedPaychequeRow, ParseResponse
from src.paycheques.utils import parse_cents, validate_paystub_breakdown

log = logging.getLogger(__name__)

CSV, TSV = "text/csv", "text/tab-separated-values"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF = "application/pdf"
IMAGES = {"image/png", "image/jpeg", "image/webp"}
_MAGIC = (
    (b"%PDF-", PDF),
    (b"PK\x03\x04", XLSX),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
)


def detect_mime(content: bytes, filename: str) -> str:
    """Trust magic bytes, never the client's extension or Content-Type. The extension only
    picks the delimiter for plain text, and binary content can't pose as text."""
    for magic, mime in _MAGIC:
        if content.startswith(magic):
            return mime
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    ext = Path(filename).suffix.lower()
    if ext in {".csv", ".tsv"} and b"\x00" not in content[:4096]:
        return TSV if ext == ".tsv" else CSV
    return "application/octet-stream"


# --- Normalizers: messy strings -> canonical values (None when unreadable) ----------------

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y-%m-%d %H:%M:%S",
    "%m/%d/%Y",  # ponytail: US order wins for ambiguous 03/04/2026; the review table shows it
    "%d/%m/%Y",
    "%m-%d-%Y",
    "%d-%m-%Y",
    "%b %d %Y",
    "%B %d %Y",
    "%d %b %Y",
    "%d %B %Y",
    "%d-%b-%Y",
    "%d-%B-%Y",
)


def clean_money(value: object) -> str | None:
    """'$1,842.5 CAD' or '(150.00)' -> '1842.50' / '150.00', in exact cents via parse_cents."""
    if value is None:
        return None
    try:
        cents = parse_cents(
            re.sub(r"[^\d.]", "", str(value)), "Amount", required=False, allow_zero=True
        )
    except ValueError:
        return None
    return None if cents is None else f"{cents // 100}.{cents % 100:02d}"


def clean_date(value: object) -> str | None:
    if hasattr(value, "strftime"):  # Excel date/datetime cell
        return value.strftime("%Y-%m-%d")
    raw = " ".join(re.sub(r"[.,]", " ", str(value or "")).split())
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def clean_hours(value: object) -> float | None:
    try:
        hours = float(str(value).replace(",", "").strip())
    except ValueError:
        return None
    return round(hours, 2) if 0 < hours < MAX_HOURS else None


def _clean_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def check_row(row: ParsedPaychequeRow) -> ParsedPaychequeRow:
    """Flag what the user must review, in exact integer cents, using the same breakdown rules
    that /import enforces. Warnings never block; they only highlight the row."""

    def cents(value: str | None) -> int | None:
        return parse_cents(value, "Amount", required=False, allow_zero=True)

    if not row.paid_on:
        row.warnings.append("Pay date not found")
    net = cents(row.amount)
    if not net:
        row.warnings.append("Take-home amount not found")
    else:
        gross, tax, ded = cents(row.gross), cents(row.tax), cents(row.deductions)
        try:
            validate_paystub_breakdown(net, gross, tax, ded)
        except ValueError as exc:
            row.warnings.append(str(exc))
        else:
            withheld = (tax or 0) + (ded or 0)
            if gross is not None and withheld and abs(gross - withheld - net) > 1:
                row.warnings.append("Gross minus tax and deductions doesn't equal take-home")
    if row.warnings:
        row.confidence = min(row.confidence, 0.5)
    return row


# --- Tier 1: spreadsheets with fuzzy headers ----------------------------------------------

FIELD_ALIASES: dict[str, set[str]] = {
    "paid_on": {
        "date",
        "pay date",
        "paid on",
        "payment date",
        "payday",
        "date paid",
        "deposit date",
    },
    "amount": {"amount", "net", "net pay", "take home", "take home pay", "deposit", "net amount"},
    "gross": {"gross", "gross pay", "gross earnings", "total earnings"},
    "tax": {"tax", "taxes", "income tax", "federal tax", "withholding", "total tax", "total taxes"},
    "deductions": {"deductions", "total deductions", "other deductions"},
    "source_name": {"source", "source name", "employer", "company", "payer"},
    "hours": {"hours", "hrs", "total hours"},
    "note": {"note", "notes", "memo", "description"},
}
_ALIAS_TO_FIELD = {alias: field for field, aliases in FIELD_ALIASES.items() for alias in aliases}


def _read_table(content: bytes, mime: str) -> list[list[object]]:
    if mime == XLSX:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        try:
            return [list(r) for r in wb.active.iter_rows(values_only=True)]
        finally:
            wb.close()
    text = content.decode("utf-8-sig", errors="replace")
    return list(csv.reader(io.StringIO(text), delimiter="\t" if mime == TSV else ","))


def parse_table(content: bytes, mime: str) -> tuple[list[ParsedPaychequeRow], list[str]]:
    table = _read_table(content, mime)
    if not table:
        raise BadRequestError("The file has no rows.")
    header, *body = table

    cols: dict[str, int] = {}
    unmapped: list[str] = []
    for idx, name in enumerate(header):
        key = " ".join(re.sub(r"[_\-()$]", " ", str(name or "")).lower().split())
        field = _ALIAS_TO_FIELD.get(key)
        if field and field not in cols:
            cols[field] = idx
        elif key:
            unmapped.append(str(name).strip())
    if "paid_on" not in cols and "amount" not in cols:
        raise BadRequestError("No date or amount column found. Name them 'date' and 'amount'.")

    rows: list[ParsedPaychequeRow] = []
    for raw in body:
        if not any(str(v if v is not None else "").strip() for v in raw):
            continue

        def cell(field: str, raw: list[object] = raw) -> object:
            idx = cols.get(field)
            return raw[idx] if idx is not None and idx < len(raw) else None

        rows.append(
            check_row(
                ParsedPaychequeRow(
                    source_name=_clean_text(cell("source_name")),
                    paid_on=clean_date(cell("paid_on")),
                    amount=clean_money(cell("amount")),
                    gross=clean_money(cell("gross")),
                    tax=clean_money(cell("tax")),
                    deductions=clean_money(cell("deductions")),
                    hours=clean_hours(cell("hours")),
                    note=(_clean_text(cell("note")) or "")[:MAX_NOTE_LENGTH] or None,
                )
            )
        )
    return rows, unmapped


# --- Tiers 2 & 3: one paystub's text -> one row (regex first, local LLM fallback) ---------

_MONEY = r"\$?\s*(\d[\d,]*\.\d{2})"
_DATE = (
    r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}"
    r"|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{4})"
)
# `[^\d\n]*` keeps the match on the label's own line, so the first figure is Current, not YTD.
_TEXT_PATTERNS = {
    key: re.compile(rf"(?:{label})[^\d\n]*?{value}", re.I)
    for key, label, value in (
        ("paid_on", r"pay\s*date|payment\s*date|date\s*paid|deposit\s*date|pay\s*day", _DATE),
        ("amount", r"net\s*pay|take[\s-]*home|net\s*deposit|net\s*amount", _MONEY),
        ("gross", r"gross\s*pay|total\s*gross|gross\s*earnings|total\s*earnings", _MONEY),
        ("tax", r"total\s*tax(?:es)?|income\s*tax|federal\s*tax", _MONEY),
        ("deductions", r"total\s*deductions|other\s*deductions", _MONEY),
    )
}


def _row_from_fields(fields: dict, note: str, confidence: float) -> ParsedPaychequeRow:
    return check_row(
        ParsedPaychequeRow(
            source_name=_clean_text(fields.get("source_name")),
            paid_on=clean_date(fields.get("paid_on")),
            amount=clean_money(fields.get("amount")),
            gross=clean_money(fields.get("gross")),
            tax=clean_money(fields.get("tax")),
            deductions=clean_money(fields.get("deductions")),
            hours=clean_hours(fields.get("hours")),
            note=note,
            confidence=confidence,
        )
    )


async def row_from_text(
    text: str, filename: str, confidence: float
) -> tuple[ParsedPaychequeRow, bool]:
    """Returns (row, used_llm). The LLM only runs when regex left warnings, and only wins
    if its row has no more warnings than the regex row."""
    note = f"Imported from {filename}"[:MAX_NOTE_LENGTH]
    found = {
        k: (m.group(1) if (m := rx.search(text)) else None) for k, rx in _TEXT_PATTERNS.items()
    }
    row = _row_from_fields(found, note, confidence)
    if not row.warnings or not text.strip() or not extractors.llm_available():
        return row, False

    llm_fields = await asyncio.to_thread(extractors.llm_extract, text)
    llm_conf = min(confidence, 0.75)
    merged_fields = {**llm_fields, **{k: v for k, v in found.items() if v is not None}}
    candidates = [
        (row, False),
        (_row_from_fields(merged_fields, note, llm_conf), True),
        (_row_from_fields(llm_fields, note, llm_conf), True),
    ]

    def rank(pair: tuple[ParsedPaychequeRow, bool]) -> tuple[int, bool, bool, int]:
        r = pair[0]
        filled = sum(
            v is not None
            for v in (r.source_name, r.paid_on, r.amount, r.gross, r.tax, r.deductions, r.hours)
        )
        return (len(r.warnings), not r.paid_on, not r.amount, -filled)

    return min(candidates, key=rank)


# --- Entry point -------------------------------------------------------------------------


async def parse_upload(content: bytes, filename: str) -> ParseResponse:
    mime = detect_mime(content, filename)
    if mime not in {CSV, TSV, XLSX, PDF, *IMAGES}:
        raise UnsupportedFileType()
    meta = {"filename": filename, "detected_mime": mime}
    try:
        if mime in {CSV, TSV, XLSX}:
            rows, unmapped = await asyncio.to_thread(parse_table, content, mime)
            return ParseResponse(
                **meta, parser_used="tabular", rows=rows, unmapped_columns=unmapped
            )

        text, parser, confidence = "", "ocr", 0.5
        if mime == PDF:
            text = await asyncio.to_thread(extractors.pdf_text, content)
            parser, confidence = "pdf_text", 0.9
        if len(text) < 20:  # scanned PDF (no text layer) or image -> OCR
            text, ocr_score = await asyncio.to_thread(extractors.ocr_text, content, mime)
            parser, confidence = "ocr", min(ocr_score, 0.85) or 0.5
        row, used_llm = await row_from_text(text, filename, confidence)
        return ParseResponse(**meta, parser_used=parser, used_llm_fallback=used_llm, rows=[row])
    except AppError:
        raise
    except ModuleNotFoundError as exc:
        raise BadRequestError(
            "Reading scans and photos isn't set up on this server. "
            "Upload a spreadsheet or a PDF with selectable text."
        ) from exc
    except Exception as exc:  # untrusted file: any parser crash becomes a plain 400
        log.exception("Failed to parse %s (%s)", filename, mime)
        raise BadRequestError(
            "Couldn't read this file. Check that it isn't damaged or password-protected."
        ) from exc
