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
from typing import Literal

import openpyxl

from src.config import settings
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
    "%b %d %y",
    "%B %d %y",
    "%d %b %Y",
    "%d %B %Y",
    "%d-%b-%Y",
    "%d-%B-%Y",
)

_NUMBERED_CORP_RE = re.compile(
    r"\b(\d{5,9})\s+(?:ONTARIO|CANADA|QUEBEC|ALBERTA|BC|INC\.?|LTD\.?|LIMITED|CORP\.?)\b",
    re.I,
)

_UNITS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
}
_TENS = {
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
_NUM_WORD = (
    r"(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|"
    r"thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|"
    r"twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and)"
)
_WRITTEN_AMOUNT_RE = re.compile(
    rf"\b((?:{_NUM_WORD}[\s,&-]*)+?)\s*(?:dollars?\s*)?(?:and\s+|&\s*)?"
    rf"(\d{{1,2}}|xx|no)\s*/\s*100\b",
    re.I,
)


def is_cheque_text(text: str) -> bool:
    lowered = text.lower()
    if "pay to the order of" in lowered or "/100 dollars" in lowered or "xx/100" in lowered:
        return True
    return ("cheque" in lowered or "void after" in lowered) and (
        "dollars" in lowered or "/100" in lowered
    )


def parse_written_amount(text: str) -> str | None:
    """Convert legal cheque line ('Six hundred eleven 86/100') into '611.86'."""
    match = _WRITTEN_AMOUNT_RE.search(text)
    if not match:
        return None
    words = re.findall(r"[a-z]+", match.group(1).lower())
    total, current, has_number = 0, 0, False
    for word in words:
        if word == "and":
            continue
        if word in _UNITS:
            current += _UNITS[word]
            has_number = True
        elif word in _TENS:
            current += _TENS[word]
            has_number = True
        elif word == "hundred":
            current = (current or 1) * 100
            has_number = True
        elif word == "thousand":
            total += (current or 1) * 1000
            current = 0
            has_number = True
        else:
            return None
    if not has_number:
        return None
    dollars = total + current
    cents_tok = match.group(2).lower()
    cents = 0 if cents_tok in {"xx", "no"} else int(cents_tok)
    if dollars <= 0 and cents <= 0:
        return None
    return f"{dollars}.{cents:02d}"


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
    s = str(value or "").strip()
    if not s:
        return None
    if s[0].isalpha():  # handle handwritten dates like "Nov 20 / 26" or "Nov 20 '26"
        raw = " ".join(re.sub(r"[.,/'-]+", " ", s).split())
    else:
        raw = " ".join(re.sub(r"[.,]", " ", s).split())
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


def check_row(
    row: ParsedPaychequeRow,
    raw_text: str = "",
    cheque_number: str | None = None,
) -> ParsedPaychequeRow:
    """Apply cheque sanity guards and flag review items in exact integer cents."""

    def cents(value: str | None) -> int | None:
        return parse_cents(value, "Amount", required=False, allow_zero=True)

    if row.document_type == "cheque":
        row.gross = None
        row.tax = None
        row.deductions = None
        row.hours = None

    ignored_reason = False
    if row.amount:
        whole_dollars = row.amount.split(".")[0].lstrip("0") or "0"
        corp_ids = {cid.lstrip("0") or "0" for cid in _NUMBERED_CORP_RE.findall(raw_text)}
        clean_cheque_no = re.sub(r"\D", "", cheque_number or "").lstrip("0")
        net_c = cents(row.amount)

        if whole_dollars in corp_ids:
            row.amount = None
            row.warnings.append("Ignored company registration number; enter cheque amount manually")
            row.confidence = min(row.confidence, 0.3)
            ignored_reason = True
        elif clean_cheque_no and whole_dollars == clean_cheque_no:
            row.amount = None
            row.warnings.append("Ignored cheque number; enter cheque amount manually")
            row.confidence = min(row.confidence, 0.3)
            ignored_reason = True
        elif net_c and net_c > settings.MAX_SINGLE_PAYCHEQUE_WARN_CENTS:
            row.warnings.append("Unusually large amount — verify against source document")
            row.confidence = min(row.confidence, 0.35)

    if not row.paid_on:
        row.warnings.append("Pay date not found")
    net = cents(row.amount)
    if not net:
        if not ignored_reason:
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
                    document_type="tabular",
                )
            )
        )
    return rows, unmapped


# --- Tiers 2 & 3: one paystub or cheque -> one row ----------------------------------------

_MONEY = r"\$?\s*(\d[\d,]*\.\d{2})"
_DATE = (
    r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}"
    r"|[A-Za-z]{3,9}\.?\s+\d{1,2}\s*[/,'-]?\s*\d{2,4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{4})"
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
_CHEQUE_DATE_RE = re.compile(rf"\bdate\b[^\dA-Za-z\n]*{_DATE}", re.I)
_CHEQUE_DATE_NEXTLINE_RE = re.compile(rf"\bdate\b\s*:?\s*\n\s*{_DATE}", re.I)
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
    r"|net\s*pay|gross\s*pay|take[\s-]*home|total\s+(?:gross|tax|deductions|net)"
    r"|pay\s+to\s+the\s+order\s+of|void\s+after|memo|date|dollars"
    r"|royal\s+bank|td\s+canada|scotiabank|bmo|cibc|rbc)\b",
    re.I,
)


def _match_known_source(name: str | None, known_sources: Sequence[str]) -> str | None:
    clean = _clean_text(name)
    if not clean:
        return None
    lowered = clean.lower()
    for known in known_sources:
        if known.strip().lower() == lowered:
            return known.strip()
    return clean[:MAX_SOURCE_NAME_LENGTH]


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
            or _NUMBERED_CORP_RE.search(cand)
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


def _row_from_fields(
    fields: dict,
    note: str,
    confidence: float,
    document_type: Literal["paystub", "cheque", "tabular"] = "paystub",
    raw_text: str = "",
) -> ParsedPaychequeRow:
    is_cheque = document_type == "cheque"
    return check_row(
        ParsedPaychequeRow(
            source_name=_clean_text(fields.get("source_name")),
            paid_on=clean_date(fields.get("paid_on")),
            amount=clean_money(fields.get("amount")),
            gross=None if is_cheque else clean_money(fields.get("gross")),
            tax=None if is_cheque else clean_money(fields.get("tax")),
            deductions=None if is_cheque else clean_money(fields.get("deductions")),
            hours=None if is_cheque else clean_hours(fields.get("hours")),
            note=note,
            document_type=document_type,
            confidence=confidence,
        ),
        raw_text=raw_text,
    )


def _row_from_vision(data: dict, filename: str, known_sources: Sequence[str]) -> ParsedPaychequeRow:
    numeric_amt = clean_money(data.get("numeric_amount") or data.get("amount"))
    raw_written = data.get("written_amount")
    if isinstance(raw_written, (int, float)) or (
        isinstance(raw_written, str) and re.fullmatch(r"[\s$,\d.]+", raw_written)
    ):
        written_amt = clean_money(raw_written)
    else:
        written_amt = parse_written_amount(str(raw_written or ""))

    no_paystub_breakdown = all(data.get(k) is None for k in ("gross", "tax", "deductions"))
    doc_type: Literal["paystub", "cheque"] = (
        "cheque"
        if data.get("document_type") == "cheque"
        or (written_amt is not None and no_paystub_breakdown)
        else "paystub"
    )

    warnings: list[str] = []
    confidence = 0.85
    if doc_type == "cheque":
        if numeric_amt and written_amt:
            if numeric_amt == written_amt:
                amount, confidence = numeric_amt, 0.95
            else:
                amount, confidence = numeric_amt, 0.40
                warnings.append(
                    f"Numeric (${numeric_amt}) and written (${written_amt}) cheque amounts disagree"
                )
        else:
            amount = numeric_amt or written_amt
            confidence = 0.75
    else:
        amount = numeric_amt

    row = ParsedPaychequeRow(
        source_name=_match_known_source(data.get("source_name"), known_sources),
        paid_on=clean_date(data.get("paid_on")),
        amount=amount,
        gross=None if doc_type == "cheque" else clean_money(data.get("gross")),
        tax=None if doc_type == "cheque" else clean_money(data.get("tax")),
        deductions=None if doc_type == "cheque" else clean_money(data.get("deductions")),
        hours=None if doc_type == "cheque" else clean_hours(data.get("hours")),
        note=f"Scanned from {filename}"[:MAX_NOTE_LENGTH],
        document_type=doc_type,
        confidence=confidence,
        warnings=warnings,
    )
    return check_row(
        row,
        raw_text=" ".join(str(v) for v in data.values() if v is not None),
        cheque_number=str(data.get("cheque_number") or "") or None,
    )


async def row_from_text(
    text: str,
    filename: str,
    confidence: float,
    tables: Sequence[Sequence[Sequence[str | None]]] = (),
    known_sources: Sequence[str] = (),
) -> tuple[ParsedPaychequeRow, bool]:
    """Returns (row, used_llm). Runs deterministic rules first and only calls the local LLM
    when warnings remain."""
    cheque_mode = is_cheque_text(text)
    doc_type: Literal["paystub", "cheque"] = "cheque" if cheque_mode else "paystub"
    note = f"Imported from {filename}"[:MAX_NOTE_LENGTH]

    found: dict[str, object] = {}
    for key, rx in _TEXT_PATTERNS.items():
        if cheque_mode and key in {"gross", "tax", "deductions"}:
            continue
        if m := rx.search(text):
            found[key] = m.group(1)
    if "paid_on" not in found and (m := _PAID_ON_NEXTLINE_RE.search(text)):
        found["paid_on"] = m.group(1)
    if cheque_mode and "paid_on" not in found:
        if m := (_CHEQUE_DATE_RE.search(text) or _CHEQUE_DATE_NEXTLINE_RE.search(text)):
            found["paid_on"] = m.group(1)

    if cheque_mode:
        if "amount" not in found and (written := parse_written_amount(text)):
            found["amount"] = written
    else:
        found.update(_fields_from_summary_lines(text))
        found.update(_fields_from_tables(tables))
        if "amount" not in found and (m := _DIST_TOTAL_RE.search(text)):
            found["amount"] = m.group(1)

    if source := _infer_source_name(text, known_sources):
        found["source_name"] = source

    row = _row_from_fields(found, note, confidence, document_type=doc_type, raw_text=text)
    if not row.warnings or not text.strip() or not extractors.llm_available():
        return row, False

    llm_raw = await asyncio.to_thread(extractors.llm_extract, text, cheque_mode=cheque_mode)
    llm_fields = _sanitize_llm_fields(llm_raw)
    llm_conf = min(confidence, 0.75)
    merged_fields = {**llm_fields, **{k: v for k, v in found.items() if v is not None}}
    candidates = [
        (row, False),
        (
            _row_from_fields(merged_fields, note, llm_conf, document_type=doc_type, raw_text=text),
            True,
        ),
        (
            _row_from_fields(llm_fields, note, llm_conf, document_type=doc_type, raw_text=text),
            True,
        ),
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
        if len(text) < 20:  # scanned PDF or photo -> optional Vision OCR -> RapidOCR fallback
            images = (
                await asyncio.to_thread(extractors.prepare_images, content, mime)
                if extractors.vision_available()
                else None
            )
            if images is not None:
                try:
                    vision_data = await extractors.vision_extract(
                        images, known_sources=known_sources
                    )
                    row = _row_from_vision(vision_data, filename, known_sources)
                    return ParseResponse(
                        **meta, parser_used="vision", used_llm_fallback=False, rows=[row]
                    )
                except Exception:
                    log.warning(
                        "Vision OCR failed for %s; falling back to RapidOCR",
                        filename,
                        exc_info=True,
                    )
            text, ocr_score = await asyncio.to_thread(
                extractors.ocr_text, content, mime, images=images
            )
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
