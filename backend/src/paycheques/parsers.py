"""Import stage 1: turn an uploaded file into editable candidate rows. Nothing is saved here;
the user reviews the rows and commits them through the existing POST /api/paycheques/import."""

import asyncio
import csv
import io
import logging
import re
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path

import openpyxl

from src.exceptions import AppError, BadRequestError
from src.paycheques import extractors
from src.paycheques.constants import MAX_HOURS, MAX_NOTE_LENGTH
from src.paycheques.exceptions import UnsupportedFileType
from src.paycheques.schemas import ParsedPaychequeRow, ParseResponse
from src.paycheques.utils import parse_cents, validate_paystub_breakdown
from src.sources.constants import MAX_SOURCE_NAME_LENGTH

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


# --- Tiers 2 & 3: one paystub's text/tables -> one row (deterministic first, LLM fallback) ---

_MONEY = r"\$?\s*(\d[\d,]*\.\d{2})"
_DATE = (
    r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}"
    r"|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{4})"
)
_PAID_ON_LABELS = (
    r"pay\s*date|payment\s*date|date\s*paid|deposit\s*date|pay\s*day"
    r"|advice\s*date|che(?:ck|que)\s*date|issue\s*date"
)
# `[^\d\n]*` keeps the match on the label's own line, so the first figure is Current, not YTD.
_TEXT_PATTERNS = {
    key: re.compile(rf"(?:{label})[^\d\n]*?{value}", re.I)
    for key, label, value in (
        ("paid_on", _PAID_ON_LABELS, _DATE),
        ("amount", r"net\s*pay|take[\s-]*home|net\s*deposit|net\s*amount", _MONEY),
        ("gross", r"gross\s*pay|total\s*gross|gross\s*earnings|total\s*earnings", _MONEY),
        ("tax", r"total\s*tax(?:es)?|income\s*tax|federal\s*tax", _MONEY),
        ("deductions", r"total\s*deductions|other\s*deductions", _MONEY),
    )
}
_PAID_ON_NEXTLINE_RE = re.compile(rf"(?:{_PAID_ON_LABELS})\s*:?\s*\n\s*{_DATE}", re.I)
_DIST_TOTAL_RE = re.compile(rf"net\s+pay\s+distribution[\s\S]{{0,200}}?total\s*:?\s*{_MONEY}", re.I)

_PERIOD_ROW_RE = re.compile(r"^(?:current|this\s+period|period)\b", re.I)
_YTD_ROW_RE = re.compile(r"^(?:ytd|year\s+to\s+date)\b", re.I)

_SUMMARY_CELL_MAP: dict[str, str] = {
    alias: field
    for field, aliases in (
        ("gross", ("total gross", "gross", "gross pay", "gross earnings", "total earnings")),
        ("tax", ("total taxes", "total tax", "taxes", "income tax", "federal tax")),
        ("deductions", ("total deductions", "deductions", "other deductions")),
        (
            "amount",
            (
                "net pay",
                "net",
                "take home",
                "take home pay",
                "net deposit",
                "net amount",
                "total net",
            ),
        ),
    )
    for alias in aliases
}
_SUMMARY_HEADER_RE = re.compile(
    r"(?P<_skip_1>cit\s+taxable\s+gross|fed(?:eral)?\s+taxable\s+gross|taxable\s+gross"
    r"|pre[\s-]*tax\s+deductions?|after[\s-]*tax\s+deductions?)"
    r"|(?P<gross>total\s+gross|gross\s+pay|gross\s+earnings|total\s+earnings)"
    r"|(?P<tax>total\s+tax(?:es)?|income\s+tax|federal\s+tax)"
    r"|(?P<deductions>total\s+deductions?|other\s+deductions?)"
    r"|(?P<amount>net\s+pay|take[\s-]*home(?:\s+pay)?|net\s+deposit|net\s+amount)",
    re.I,
)
_RIGHT_COL_RE = re.compile(
    r"\s{3,}|\s+(?:Pay\s+Group|Business\s+Unit|Advice|Page|Statement|Period|Employee|Date|Check|Cheque)\b",
    re.I,
)
_GENERIC_HEADER_RE = re.compile(
    r"^(?:earnings\s+statement|pay\s*stub|paystub|payslip|statement\s+of\s+earnings"
    r"|pay\s+advice|direct\s+deposit|confidential|tax\s+data|hours\s+and\s+earnings"
    r"|net\s*pay|gross\s*pay|take[\s-]*home|total\s+(?:gross|tax|deductions|net))\b",
    re.I,
)


def _infer_source_name(text: str, known_sources: Sequence[str]) -> str | None:
    head = text[:1500]
    for name in sorted((s.strip() for s in known_sources if s.strip()), key=len, reverse=True):
        if re.search(rf"(?<!\w){re.escape(name)}(?!\w)", head, re.I):
            return name

    for raw in [ln.strip() for ln in text.splitlines() if ln.strip()][:6]:
        cand = _RIGHT_COL_RE.split(raw, maxsplit=1)[0].strip()
        if (
            not cand
            or cand[0].isdigit()
            or ":" in cand
            or "$" in cand
            or re.search(r"\d+\.\d{2}", cand)
            or _GENERIC_HEADER_RE.match(cand)
        ):
            continue
        if 2 <= len(cand) <= MAX_SOURCE_NAME_LENGTH and any(ch.isalpha() for ch in cand):
            return cand
    return None


def _norm_cell(val: str | None) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", val or "").lower().split())


def _fields_from_tables(tables: Sequence[Sequence[Sequence[str | None]]]) -> dict[str, str]:
    """Read ruled PDF summary tables (skipping unmapped columns like CIT Taxable Gross)."""
    for table in tables:
        for r_idx, row in enumerate(table):
            col_map = {
                c_idx: field
                for c_idx, cell in enumerate(row)
                if (field := _SUMMARY_CELL_MAP.get(_norm_cell(cell)))
            }
            if len(col_map) < 2:
                continue

            data_row: Sequence[str | None] | None = None
            line_idx = 0
            fallback_row: Sequence[str | None] | None = None
            first_mapped = min(col_map)
            for cand in table[r_idx + 1 : r_idx + 5]:
                labels = [
                    ln.strip()
                    for c_idx in range(first_mapped)
                    if c_idx < len(cand) and cand[c_idx]
                    for ln in cand[c_idx].splitlines()
                    if ln.strip()
                ]
                cur = next((i for i, lbl in enumerate(labels) if _PERIOD_ROW_RE.match(lbl)), None)
                if cur is not None:
                    data_row, line_idx = cand, cur
                    break
                if labels and _YTD_ROW_RE.match(labels[0]):
                    continue
                if (
                    fallback_row is None
                    and sum(clean_money(cand[c]) is not None for c in col_map if c < len(cand)) >= 2
                ):
                    fallback_row = cand

            chosen = data_row or fallback_row
            if not chosen:
                continue
            found: dict[str, str] = {}
            for c_idx, field in col_map.items():
                if c_idx >= len(chosen) or not chosen[c_idx]:
                    continue
                lines = [ln.strip() for ln in chosen[c_idx].splitlines() if ln.strip()]
                raw_val = lines[line_idx] if line_idx < len(lines) else (lines[0] if lines else "")
                if (cleaned := clean_money(raw_val)) is not None and field not in found:
                    found[field] = cleaned
            if len(found) >= 2:
                return found
    return {}


def _fields_from_summary_lines(text: str) -> dict[str, str]:
    """Read horizontal summary blocks from plain PDF text or RapidOCR visual rows."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for i, line in enumerate(lines):
        tokens = [m.lastgroup for m in _SUMMARY_HEADER_RE.finditer(line) if m.lastgroup]
        if sum(not t.startswith("_") for t in tokens) < 2:
            continue

        matched_values: list[str] | None = None
        fallback_values: list[str] | None = None
        for cand in lines[i + 1 : i + 4]:
            if _YTD_ROW_RE.match(cand):
                continue
            values = re.findall(_MONEY, cand)
            if len(values) != len(tokens):
                continue
            if _PERIOD_ROW_RE.match(cand):
                matched_values = values
                break
            if fallback_values is None:
                fallback_values = values

        chosen = matched_values or fallback_values
        if chosen:
            return {
                field: val
                for field, val in zip(tokens, chosen, strict=True)
                if not field.startswith("_")
            }
    return {}


def _sanitize_llm_fields(fields: dict) -> dict:
    """Drop tax/deductions if a tiny LLM copied net pay into them and broke gross - net math."""
    cleaned = dict(fields)
    net = parse_cents(clean_money(cleaned.get("amount")), "Amount", required=False, allow_zero=True)
    gross = parse_cents(clean_money(cleaned.get("gross")), "Gross", required=False, allow_zero=True)
    if net and gross and gross >= net:
        tax = (
            parse_cents(clean_money(cleaned.get("tax")), "Tax", required=False, allow_zero=True)
            or 0
        )
        ded = (
            parse_cents(
                clean_money(cleaned.get("deductions")), "Ded", required=False, allow_zero=True
            )
            or 0
        )
        if tax + ded > gross - net:
            cleaned["tax"] = None
            cleaned["deductions"] = None
    return cleaned


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
    text: str,
    filename: str,
    confidence: float,
    tables: Sequence[Sequence[Sequence[str | None]]] = (),
    known_sources: Sequence[str] = (),
) -> tuple[ParsedPaychequeRow, bool]:
    """Returns (row, used_llm). Runs deterministic table/text rules first and only calls the
    local LLM when warnings remain."""
    note = f"Imported from {filename}"[:MAX_NOTE_LENGTH]
    found: dict[str, object] = {}
    for key, rx in _TEXT_PATTERNS.items():
        if m := rx.search(text):
            found[key] = m.group(1)
    if "paid_on" not in found and (m := _PAID_ON_NEXTLINE_RE.search(text)):
        found["paid_on"] = m.group(1)
    found.update(_fields_from_summary_lines(text))
    found.update(_fields_from_tables(tables))
    if "amount" not in found and (m := _DIST_TOTAL_RE.search(text)):
        found["amount"] = m.group(1)
    if source := _infer_source_name(text, known_sources):
        found["source_name"] = source

    row = _row_from_fields(found, note, confidence)
    if not row.warnings or not text.strip() or not extractors.llm_available():
        return row, False

    llm_fields = _sanitize_llm_fields(await asyncio.to_thread(extractors.llm_extract, text))
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


async def parse_upload(
    content: bytes, filename: str, known_sources: Sequence[str] = ()
) -> ParseResponse:
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

        text, tables, parser, confidence = "", [], "ocr", 0.5
        if mime == PDF:
            text, tables = await asyncio.to_thread(extractors.pdf_extract, content)
            parser, confidence = "pdf_text", 0.9
        if len(text) < 20:  # scanned PDF (no text layer) or image -> OCR
            text, ocr_score = await asyncio.to_thread(extractors.ocr_text, content, mime)
            tables = []
            parser, confidence = "ocr", min(ocr_score, 0.85) or 0.5
        row, used_llm = await row_from_text(
            text, filename, confidence, tables=tables, known_sources=known_sources
        )
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
