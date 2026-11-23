"""Import stage 1: turn an uploaded file into editable candidate rows. Nothing is saved here;
the user reviews the rows and commits them through the existing POST /api/paycheques/import."""

import asyncio
import csv
import io
import logging
import re
import time
import xml.etree.ElementTree as ET
import zipfile
from collections.abc import Mapping, Sequence
from datetime import date as dt_date
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Literal

import openpyxl

from src.config import settings
from src.exceptions import AppError, BadRequestError
from src.paycheques import extractors
from src.paycheques.constants import MAX_HOURS, MAX_NOTE_LENGTH
from src.paycheques.exceptions import UnsupportedFileType
from src.paycheques.import_logs import (
    MAX_STORED_ROWS,
    MAX_STORED_TABLES,
    PipelineTrace,
    truncate_text,
)
from src.paycheques.schemas import ParsedPaychequeRow, ParsedSheetPreview, ParseResponse
from src.paycheques.utils import parse_cents, validate_paystub_breakdown
from src.sources.constants import MAX_SOURCE_NAME_LENGTH

DocType = Literal["paystub", "cheque", "deposit", "tabular"]
NetDocType = Literal["paystub", "cheque", "deposit"]

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
    if ext in {".csv", ".tsv", ".xls"}:
        if content.startswith((b"MZ", b"\xd0\xcf\x11\xe0")):
            return "application/octet-stream"
        if content.startswith((b"\xff\xfe", b"\xfe\xff")) or b"\x00" not in content[:4096]:
            return TSV if ext == ".tsv" else CSV
    return "application/octet-stream"


# --- Normalizers: messy strings -> canonical values (None when unreadable) ----------------

_EXCEL_EPOCH = datetime(1899, 12, 30)
_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y.%m.%d",
    "%Y-%m-%d %H:%M:%S",
    "%m/%d/%Y",  # ponytail: US order wins for ambiguous 03/04/2026; the review table shows it
    "%d/%m/%Y",
    "%m/%d/%y",
    "%d/%m/%y",
    "%m-%d-%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
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


_DEPOSIT_ANCHOR_RE = re.compile(
    r"\b(?:interac|e-?transfer|autodeposit|money\s+received|deposit\s+confirmation"
    r"|direct\s+deposit\s+receipt|canada\s+revenue\s+agency|agence\s+du\s+revenu"
    r"|gst/hst|trillium\s+benefit|canada\s+carbon\s+rebate|climate\s+action\s+incentive"
    r"|canada\s+child\s+benefit|tax\s+refund)\b|sent\s+you\s+\$",
    re.I,
)
_CRA_BENEFIT_RE = re.compile(
    r"\b(?:canada\s+revenue\s+agency|agence\s+du\s+revenu|gst/hst|trillium\s+benefit"
    r"|canada\s+carbon\s+rebate|climate\s+action\s+incentive|canada\s+child\s+benefit)\b",
    re.I,
)
_PAYSTUB_ANCHOR_RE = re.compile(
    r"\b(?:gross\s+pay|total\s+gross|total\s+taxes|earnings\s+statement"
    r"|pay\s+advice|year\s+to\s+date|ytd)\b",
    re.I,
)


def is_cheque_text(text: str) -> bool:
    lowered = text.lower()
    if "pay to the order of" in lowered or "/100 dollars" in lowered or "xx/100" in lowered:
        return True
    return ("cheque" in lowered or "void after" in lowered) and (
        "dollars" in lowered or "/100" in lowered
    )


def is_deposit_text(text: str) -> bool:
    if is_cheque_text(text) or _PAYSTUB_ANCHOR_RE.search(text):
        return False
    return bool(_DEPOSIT_ANCHOR_RE.search(text))


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


_CURRENCY_CODE_RE = re.compile(r"\b(?:cad|usd|eur|gbp|aud|nzd)\b", re.I)


def clean_money(value: object) -> str | None:
    """'$1,842.5 CAD' or '(150.00)' -> '1842.50' / '150.00', in exact cents via parse_cents."""
    if value is None or isinstance(value, bool):
        return None
    s = str(value).strip()
    if not s or re.search(r"[a-z]", _CURRENCY_CODE_RE.sub("", s), re.I):
        return None
    try:
        cents = parse_cents(
            re.sub(r"[^\d.]", "", s), "Amount", required=False, allow_zero=True
        )
    except ValueError:
        return None
    return None if cents is None else f"{cents // 100}.{cents % 100:02d}"


def clean_date(value: object) -> str | None:
    if hasattr(value, "strftime"):  # Excel date/datetime cell
        return value.strftime("%Y-%m-%d")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        serial = int(value)
        if 30000 <= serial <= 60000:
            return (_EXCEL_EPOCH + timedelta(days=serial)).strftime("%Y-%m-%d")
        return None
    s = str(value or "").strip()
    if not s:
        return None
    if re.fullmatch(r"\d{5}(?:\.0+)?", s):
        serial = int(float(s))
        if 30000 <= serial <= 60000:
            return (_EXCEL_EPOCH + timedelta(days=serial)).strftime("%Y-%m-%d")
    s = re.sub(r"[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$", "", s)
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

    if row.document_type in {"cheque", "deposit"}:
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
        "advice date",
        "check date",
        "cheque date",
        "transaction date",
        "effective date",
        "value date",
        "posting date",
        "period end",
        "pay period end",
        "issued date",
    },
    "amount": {
        "amount",
        "net",
        "net pay",
        "take home",
        "take home pay",
        "deposit",
        "net amount",
        "net deposit",
        "net earnings",
        "total net",
        "paycheque",
        "paycheck",
        "payout",
        "paid",
        "received",
        "credit",
        "cheque amount",
        "check amount",
        "payment",
        "payment amount",
        "net pay amount",
    },
    "gross": {
        "gross",
        "gross pay",
        "gross earnings",
        "total earnings",
        "total gross",
        "gross amount",
        "base pay",
        "regular pay",
        "gross salary",
        "earnings",
    },
    "month": {"month", "mm", "mo", "pay month"},
    "day": {"day", "dd", "day of month"},
    "year": {"year", "yyyy", "pay year", "tax year"},
    "tax": {
        "tax",
        "taxes",
        "income tax",
        "federal tax",
        "provincial tax",
        "state tax",
        "withholding",
        "withholding tax",
        "fed tax",
        "prov tax",
        "tax withheld",
        "cit",
        "paye",
        "total tax",
        "total taxes",
    },
    "deductions": {
        "deduction",
        "deductions",
        "total deductions",
        "other deductions",
        "statutory deductions",
        "cpp",
        "qpp",
        "ei",
        "e i",
        "c p p",
        "fica",
        "medicare",
        "benefits",
        "benefit",
        "pension",
        "rrsp",
        "401k",
        "union",
        "union dues",
        "insurance",
        "health",
        "dental",
    },
    "source_name": {
        "source",
        "source name",
        "employer",
        "company",
        "payer",
        "client",
        "vendor",
        "organization",
        "sender",
        "from",
        "job",
        "workplace",
        "business",
        "institution",
        "agency",
    },
    "hours": {
        "hours",
        "hrs",
        "total hours",
        "hours worked",
        "regular hours",
        "work hours",
        "billable hours",
        "qty",
    },
    "note": {
        "note",
        "notes",
        "memo",
        "description",
        "details",
        "comment",
        "comments",
        "reference",
        "period",
        "pay period",
        "remark",
        "remarks",
        "type",
        "payment type",
        "benefit",
    },
}
_ALIAS_TO_FIELD = {alias: field for field, aliases in FIELD_ALIASES.items() for alias in aliases}
_SALARY_ALIASES = {"salary", "wages"}
_IGNORED_TOTAL_COL_RE = re.compile(
    r"^(?:monthly\s+total|running\s+total|ytd\s+total|annual\s+total"
    r"|yearly\s+total|cumulative|sum|total\s+paid)$",
    re.I,
)
_MONTH_MAP = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}
_BANNER_NOISE_RE = re.compile(
    r"\b(?:salary|salaries|income|pay|paycheques?|paychecks?|winter|summer|fall|spring|autumn"
    r"|co-?op|term|20\d{2}|19\d{2})\b",
    re.I,
)
_MAX_PREVIEW_ROWS = 200
_MULTI_VALUE_FIELDS = {"tax", "deductions"}
_SUMMARY_FOOTER_RE = re.compile(
    r"^\s*(?:sub\s*total|grand\s*total|total|ytd|year\s+to\s+date|average|avg|sum|balance)\b",
    re.I,
)
_GENERIC_SHEET_RE = re.compile(
    r"^(?:sheet\s*\d*|tab\s*\d*|summary|overview|all|data|paycheques?|paychecks?|income|salary|salaries|payroll|export|transactions?|deposits?)$",
    re.I,
)
_TITLE_BANNER_RE = re.compile(
    r"\b(?:tracker|report|statement|breakdown|history|ledger|log|summary|overview)\b",
    re.I,
)


class _HtmlTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[object]] = []
        self._row: list[object] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if any(str(c).strip() for c in self._row):
                self.rows.append(self._row)
            self._row = None


def _read_ods_sheets(content: bytes) -> list[tuple[str | None, list[list[object]]]]:
    ns = {
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    }
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        root = ET.fromstring(zf.read("content.xml"))
    sheets: list[tuple[str | None, list[list[object]]]] = []
    for table in root.findall(".//table:table", ns):
        name = table.attrib.get(f"{{{ns['table']}}}name")
        rows: list[list[object]] = []
        for tr in table.findall("table:table-row", ns):
            repeat_rows = int(tr.attrib.get(f"{{{ns['table']}}}number-rows-repeated", "1") or 1)
            row_vals: list[object] = []
            for cell in tr:
                if not cell.tag.endswith(("table-cell", "covered-table-cell")):
                    continue
                repeat_cols = int(
                    cell.attrib.get(f"{{{ns['table']}}}number-columns-repeated", "1") or 1
                )
                val_type = cell.attrib.get(f"{{{ns['office']}}}value-type")
                val: object = None
                if val_type == "date":
                    val = cell.attrib.get(f"{{{ns['office']}}}date-value")
                elif val_type in {"float", "currency"}:
                    val = cell.attrib.get(f"{{{ns['office']}}}value")
                else:
                    texts = ["".join(p.itertext()).strip() for p in cell.findall("text:p", ns)]
                    joined = " ".join(t for t in texts if t)
                    val = joined or None
                row_vals.extend([val] * min(repeat_cols, 64))
            while row_vals and row_vals[-1] is None:
                row_vals.pop()
            if any(v is not None and str(v).strip() for v in row_vals):
                rows.extend([row_vals] * min(repeat_rows, 50))
        if rows:
            sheets.append((name, rows))
    return sheets


def _read_sheets(content: bytes, mime: str) -> list[tuple[str | None, list[list[object]]]]:
    if mime == XLSX:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = set(zf.namelist())
        if "content.xml" in names and "xl/workbook.xml" not in names:
            return _read_ods_sheets(content)
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        try:
            return [
                (ws.title, [list(r) for r in ws.iter_rows(values_only=True)])
                for ws in wb.worksheets
            ]
        finally:
            wb.close()

    if content.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = content.decode("utf-16", errors="replace")
    else:
        text = content.decode("utf-8-sig", errors="replace")

    head_lower = text[:8192].lower()
    if "<table" in head_lower and "<tr" in head_lower:
        parser = _HtmlTableParser()
        parser.feed(text)
        if parser.rows:
            return [(None, parser.rows)]

    if mime == TSV:
        delimiter = "\t"
    else:
        first_line = next((ln for ln in text.splitlines() if ln.strip()), "")
        if "," not in first_line and ";" in first_line:
            delimiter = ";"
        elif "," not in first_line and "\t" in first_line:
            delimiter = "\t"
        else:
            delimiter = ","
    return [(None, list(csv.reader(io.StringIO(text), delimiter=delimiter)))]


def _norm_header_key(name: object) -> str:
    s = re.sub(r"\((?:cad|usd|eur|gbp|hrs?|hours?|\$)\)", " ", str(name or ""), flags=re.I)
    return " ".join(re.sub(r"[_\-()$*#]", " ", s).lower().split())


def _map_header_columns(
    header: Sequence[object],
) -> tuple[dict[str, int], dict[str, list[int]], list[str]]:
    cols: dict[str, int] = {}
    multi_cols: dict[str, list[int]] = {"tax": [], "deductions": []}
    unmapped: list[str] = []
    salary_indices: list[int] = []
    date_header_keys: dict[int, str] = {}

    for idx, name in enumerate(header):
        key = _norm_header_key(name)
        if not key or _IGNORED_TOTAL_COL_RE.match(key):
            continue
        if key in _SALARY_ALIASES:
            salary_indices.append(idx)
            continue
        field = _ALIAS_TO_FIELD.get(key)
        if field in _MULTI_VALUE_FIELDS:
            multi_cols[field].append(idx)
        elif field and field not in cols:
            cols[field] = idx
            date_header_keys[idx] = key
        else:
            unmapped.append(str(name).strip())

    if salary_indices:
        if "amount" not in cols:
            cols["amount"] = salary_indices[0]
        elif "gross" not in cols:
            cols["gross"] = salary_indices[0]

    # When Month and Date appear side by side (e.g. Month, Date, Salary), treat Date as day-of-month
    if "month" in cols and "paid_on" in cols and "day" not in cols:
        p_idx = cols["paid_on"]
        if date_header_keys.get(p_idx) in {"date", "day"}:
            cols["day"] = cols.pop("paid_on")

    return cols, multi_cols, unmapped


def _is_row_data_like(
    row: Sequence[object],
    cols: Mapping[str, int],
    multi_cols: Mapping[str, Sequence[int]],
) -> bool:
    for field, idx in cols.items():
        if idx >= len(row):
            continue
        val = row[idx]
        if field == "paid_on" and clean_date(val) is not None:
            return True
        if field in {"amount", "gross"} and clean_money(val) is not None:
            return True
    for indices in multi_cols.values():
        for idx in indices:
            if idx < len(row) and clean_money(row[idx]) is not None:
                return True
    return False


def _clean_month(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        m = int(value)
        return m if 1 <= m <= 12 and float(value) == m else None
    s = str(value).strip()
    if not s:
        return None
    if re.fullmatch(r"\d{1,2}(?:\.0+)?", s):
        m = int(float(s))
        return m if 1 <= m <= 12 else None
    return _MONTH_MAP.get(s.lower().rstrip("."))


def _clean_day(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        d = int(value)
        return d if 1 <= d <= 31 and float(value) == d else None
    s = str(value).strip()
    if re.fullmatch(r"\d{1,2}(?:\.0+)?", s):
        d = int(float(s))
        return d if 1 <= d <= 31 else None
    return None


def _clean_year(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        y = int(value)
        return y if 1900 <= y <= 2100 else None
    s = str(value).strip()
    if re.fullmatch(r"(?:19|20)\d{2}(?:\.0+)?", s):
        return int(float(s))
    return None


def _parse_section_banner(
    label: str,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
) -> tuple[str | None, str | None, int | None, str | None]:
    """Extract (resolved_source, raw_source, year, default_note) from a section header."""
    ym = re.search(r"\b((?:19|20)\d{2})\b", label)
    year = int(ym.group(1)) if ym else None
    default_note = "Co-op term" if re.search(r"\bco-?op\s+term\b", label, re.I) else None

    if re.search(r"\b(?:tax\s*turn|tax\s*return|cra|government)\b", label, re.I):
        resolved, raw = _resolve_source_name("CRA / Government", known_sources, source_aliases)
        return resolved, raw, year, default_note

    candidates: list[tuple[str, str]] = [
        *((s.strip(), s.strip()) for s in known_sources if s.strip()),
        *((alias, target) for alias, target in (source_aliases or {}).items() if alias),
    ]
    for cand, target in sorted(candidates, key=lambda p: len(p[0]), reverse=True):
        if m := re.search(rf"(?<!\w){re.escape(cand)}(?!\w)", label, re.I):
            return target, m.group(0)[:MAX_SOURCE_NAME_LENGTH], year, default_note

    stripped = " ".join(_BANNER_NOISE_RE.sub(" ", label).split()).strip(" -–—:")
    if stripped and len(stripped) >= 2 and not stripped[0].isdigit():
        resolved, raw = _resolve_source_name(stripped, known_sources, source_aliases)
        return resolved, raw, year, default_note
    return None, None, year, default_note


def _stringify_preview_cell(val: object) -> str | None:
    if val is None:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    return s or None


def _header_match(
    row: Sequence[object],
) -> tuple[dict[str, int], dict[str, list[int]], list[str], int] | None:
    cols, multi_cols, unmapped = _map_header_columns(row)
    has_date = "paid_on" in cols or ("month" in cols and "day" in cols)
    has_core = has_date or "amount" in cols
    if not has_core or _is_row_data_like(row, cols, multi_cols):
        return None
    score = len(cols) + sum(bool(v) for v in multi_cols.values()) + (
        2 if has_date and "amount" in cols else 0
    )
    return cols, multi_cols, unmapped, score


def _is_banner_row(row: Sequence[object]) -> str | None:
    cells = [_clean_text(v) for v in row if _clean_text(v) is not None]
    if (
        len(cells) == 1
        and not cells[0][0].isdigit()
        and not clean_date(cells[0])
        and not clean_money(cells[0])
        and not _SUMMARY_FOOTER_RE.match(cells[0])
        and not _GENERIC_SHEET_RE.match(cells[0])
        and not _TITLE_BANNER_RE.search(cells[0])
        and any(ch.isalpha() for ch in cells[0])
    ):
        return cells[0]
    return None


def _sheet_source_hint(
    sheet_name: str | None,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None,
) -> tuple[str | None, str | None]:
    clean = _clean_text(sheet_name)
    if not clean or _GENERIC_SHEET_RE.match(clean):
        return None, None
    return _resolve_source_name(clean, known_sources, source_aliases)


def _infer_headerless_columns(
    sample_rows: Sequence[Sequence[object]],
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None,
) -> dict[str, int]:
    max_cols = max((len(r) for r in sample_rows), default=0)
    date_col: int | None = None
    amount_col: int | None = None
    text_cols: list[tuple[int, bool]] = []

    for c_idx in range(max_cols):
        vals = [
            r[c_idx]
            for r in sample_rows
            if c_idx < len(r) and _clean_text(r[c_idx]) is not None
        ]
        if not vals:
            continue
        date_hits = sum(
            clean_date(v) is not None
            and not (isinstance(v, (int, float)) and not isinstance(v, bool) and v < 30000)
            for v in vals
        )
        money_hits = sum(
            clean_money(v) is not None and clean_date(v) is None and float(clean_money(v) or 0) > 0
            for v in vals
        )
        if date_col is None and date_hits >= max(1, len(vals) // 2) and date_hits > money_hits:
            date_col = c_idx
            continue
        if amount_col is None and money_hits >= max(1, len(vals) // 2):
            amount_col = c_idx
            continue
        has_known = any(
            _resolve_source_name(_clean_text(v), known_sources, source_aliases)[0]
            in {*(s.strip() for s in known_sources), *(source_aliases or {}).values()}
            for v in vals
        )
        text_cols.append((c_idx, has_known))

    if date_col is None or amount_col is None:
        return {}
    cols: dict[str, int] = {"paid_on": date_col, "amount": amount_col}
    known_text = next((c for c, hit in text_cols if hit), None)
    if known_text is not None:
        cols["source_name"] = known_text
        other_text = next((c for c, _ in text_cols if c != known_text), None)
        if other_text is not None:
            cols["note"] = other_text
    elif len(text_cols) >= 2:
        cols["source_name"] = text_cols[0][0]
        cols["note"] = text_cols[1][0]
    elif len(text_cols) == 1:
        cols["note"] = text_cols[0][0]
    return cols


def _sum_money_cells(row: Sequence[object], indices: Sequence[int]) -> str | None:
    total = 0
    has_any = False
    for idx in indices:
        if idx >= len(row):
            continue
        cleaned = clean_money(row[idx])
        if cleaned is not None:
            cents = parse_cents(cleaned, "Amount", required=False, allow_zero=True)
            if cents is not None:
                total += cents
                has_any = True
    return f"{total // 100}.{total % 100:02d}" if has_any else None


def _split_sheet_sections(non_empty: Sequence[list[object]]) -> list[list[list[object]]]:
    sections: list[list[list[object]]] = []
    current: list[list[object]] = []
    has_data = False
    for row in non_empty:
        banner = _is_banner_row(row)
        hdr = _header_match(row)
        if has_data and (banner is not None or (hdr is not None and hdr[3] >= 2)):
            sections.append(current)
            current = [row]
            has_data = False
            continue
        current.append(row)
        if (
            banner is None
            and hdr is None
            and not any(
                _SUMMARY_FOOTER_RE.match(str(v))
                for v in row
                if v is not None and str(v).strip()
            )
        ):
            has_data = True
    if current:
        sections.append(current)
    return sections


def _unique_section_name(base: str, seen: set[str]) -> str:
    if base not in seen:
        seen.add(base)
        return base
    n = 2
    while f"{base} ({n})" in seen:
        n += 1
    unique = f"{base} ({n})"
    seen.add(unique)
    return unique


def parse_table_with_sheets(
    content: bytes,
    mime: str,
    known_sources: Sequence[str] = (),
    source_aliases: Mapping[str, str] | None = None,
) -> tuple[list[ParsedPaychequeRow], list[str], list[ParsedSheetPreview]]:
    sheets = _read_sheets(content, mime)
    if not any(rows for _, rows in sheets):
        raise BadRequestError("The file has no rows.")

    all_rows: list[ParsedPaychequeRow] = []
    all_unmapped: list[str] = []
    seen_unmapped: set[str] = set()
    previews: list[ParsedSheetPreview] = []
    seen_sheet_names: set[str] = set()
    found_valid_schema = False
    last_ym_by_source: dict[str, tuple[int, int]] = {}
    fallback_year = dt_date.today().year

    for raw_sheet_name, table in sheets:
        non_empty = [
            r for r in table if any(v is not None and str(v).strip() for v in r)
        ]
        if not non_empty:
            continue

        sheet_src, sheet_raw = _sheet_source_hint(raw_sheet_name, known_sources, source_aliases)
        sections = _split_sheet_sections(non_empty)
        prev_cols: dict[str, int] | None = None
        prev_multi: dict[str, list[int]] | None = None

        for sec_idx, sec_rows in enumerate(sections):
            header_idx: int | None = None
            best_score = -1
            cols: dict[str, int] = {}
            multi_cols: dict[str, list[int]] = {"tax": [], "deductions": []}
            unmapped: list[str] = []

            for idx, cand in enumerate(sec_rows[:30]):
                matched = _header_match(cand)
                if not matched:
                    continue
                c_cols, c_multi, c_unmapped, score = matched
                if score > best_score:
                    best_score = score
                    header_idx = idx
                    cols, multi_cols, unmapped = c_cols, c_multi, c_unmapped
                    if (
                        "paid_on" in c_cols or ("month" in c_cols and "day" in c_cols)
                    ) and "amount" in c_cols:
                        break

            section_banner: str | None = None
            section_src: str | None = None
            section_raw: str | None = None
            section_year: int | None = None
            section_note: str | None = None

            scan_limit = header_idx if header_idx is not None else len(sec_rows)
            for row in sec_rows[:scan_limit]:
                if b_text := _is_banner_row(row):
                    section_banner = b_text
                    b_src, b_raw, b_year, b_note = _parse_section_banner(
                        b_text, known_sources, source_aliases
                    )
                    if b_src:
                        section_src, section_raw = b_src, b_raw
                    if b_year:
                        section_year = b_year
                    if b_note:
                        section_note = b_note
                    break

            if header_idx is not None:
                found_valid_schema = True
                prev_cols, prev_multi = cols, multi_cols
                for col_name in unmapped:
                    if col_name not in seen_unmapped:
                        seen_unmapped.add(col_name)
                        all_unmapped.append(col_name)
                body = sec_rows[header_idx + 1 :]
                preview_header_idx = header_idx
            elif prev_cols is not None and prev_multi is not None:
                found_valid_schema = True
                cols, multi_cols = prev_cols, prev_multi
                start_body = 1 if section_banner is not None else 0
                body = sec_rows[start_body:]
                preview_header_idx = 0
            else:
                inferred = _infer_headerless_columns(
                    sec_rows[:12], known_sources, source_aliases
                )
                if not inferred:
                    continue
                found_valid_schema = True
                cols = inferred
                multi_cols = {"tax": [], "deductions": []}
                prev_cols, prev_multi = cols, multi_cols
                body = sec_rows
                preview_header_idx = 0

            eff_src = section_src or sheet_src
            eff_raw = section_raw or sheet_raw

            # Roll over section_year if a copy-pasted banner repeats the previous year
            # and the first data row's month goes backward (e.g. Month 5 after Month 12).
            if eff_src and section_year and "month" in cols:
                src_key = eff_src.lower()
                if src_key in last_ym_by_source:
                    prev_y, prev_m = last_ym_by_source[src_key]
                    if section_year == prev_y:
                        m_idx = cols["month"]
                        first_m = next(
                            (
                                _clean_month(r[m_idx])
                                for r in body
                                if m_idx < len(r) and _clean_month(r[m_idx]) is not None
                            ),
                            None,
                        )
                        if first_m is not None and first_m < prev_m:
                            section_year = prev_y + 1

            base_name = (
                section_banner
                or _clean_text(raw_sheet_name)
                or (f"Table {sec_idx + 1}" if len(sections) > 1 else "Sheet 1")
            )
            if (
                section_banner
                and section_year
                and str(section_year) not in base_name
                and base_name in seen_sheet_names
            ):
                base_name = f"{base_name} ({section_year})"
            preview_name = _unique_section_name(base_name, seen_sheet_names)

            inferred_map: dict[str, int | None] = {
                field: cols.get(field)
                for field in (
                    "paid_on",
                    "year",
                    "month",
                    "day",
                    "amount",
                    "source_name",
                    "gross",
                    "hours",
                    "note",
                )
            }
            if multi_cols["tax"]:
                inferred_map["tax"] = multi_cols["tax"][0]
            if multi_cols["deductions"]:
                inferred_map["deductions"] = multi_cols["deductions"][0]

            preview_rows = [
                [_stringify_preview_cell(c) for c in r] for r in sec_rows[:_MAX_PREVIEW_ROWS]
            ]
            previews.append(
                ParsedSheetPreview(
                    name=preview_name,
                    raw_rows=preview_rows,
                    header_row_index=preview_header_idx,
                    default_source=eff_src,
                    default_year=section_year,
                    default_note=section_note,
                    inferred_mapping=inferred_map,
                )
            )

            current_month: int | None = None
            current_year: int | None = section_year

            for raw in body:
                def cell(
                    field: str,
                    raw: Sequence[object] = raw,
                    cols: Mapping[str, int] = cols,
                ) -> object:
                    idx = cols.get(field)
                    return raw[idx] if idx is not None and idx < len(raw) else None

                if any(
                    _SUMMARY_FOOTER_RE.match(str(v))
                    for v in raw
                    if v is not None and str(v).strip()
                ):
                    row_has_full_date = (
                        clean_date(cell("paid_on")) is not None
                        if "paid_on" in cols
                        else False
                    )
                    if not row_has_full_date:
                        continue

                if "year" in cols and (parsed_y := _clean_year(cell("year"))) is not None:
                    current_year = parsed_y
                if "month" in cols and (parsed_m := _clean_month(cell("month"))) is not None:
                    current_month = parsed_m

                paid_on = clean_date(cell("paid_on"))
                if paid_on is None and "day" in cols:
                    day_val = cell("day")
                    paid_on = clean_date(day_val)
                    if paid_on is None and (day_num := _clean_day(day_val)) is not None:
                        if current_month is not None:
                            use_year = current_year or fallback_year
                            try:
                                paid_on = dt_date(use_year, current_month, day_num).isoformat()
                            except ValueError:
                                paid_on = None

                amount = clean_money(cell("amount"))
                if paid_on is None and amount is None:
                    continue

                gross = clean_money(cell("gross"))
                tax = _sum_money_cells(raw, multi_cols["tax"])
                deductions = _sum_money_cells(raw, multi_cols["deductions"])
                if gross == "0.00" and tax in (None, "0.00") and deductions in (None, "0.00"):
                    gross = None
                if gross is None and tax == "0.00":
                    tax = None
                if gross is None and deductions == "0.00":
                    deductions = None

                raw_src_cell = _clean_text(cell("source_name"))
                if raw_src_cell:
                    src_resolved, src_raw = _resolve_source_name(
                        raw_src_cell, known_sources, source_aliases
                    )
                else:
                    src_resolved, src_raw = eff_src, eff_raw

                if src_resolved and paid_on:
                    y_val, m_val = int(paid_on[:4]), int(paid_on[5:7])
                    last_ym_by_source[src_resolved.lower()] = (y_val, m_val)

                note_text = _clean_text(cell("note")) or section_note
                all_rows.append(
                    check_row(
                        ParsedPaychequeRow(
                            source_name=src_resolved,
                            raw_source_name=src_raw,
                            paid_on=paid_on,
                            amount=amount,
                            gross=gross,
                            tax=tax,
                            deductions=deductions,
                            hours=clean_hours(cell("hours")),
                            note=(note_text or "")[:MAX_NOTE_LENGTH] or None,
                            sheet_name=preview_name,
                            document_type="tabular",
                        )
                    )
                )

    if not found_valid_schema:
        raise BadRequestError("No date or amount column found. Name them 'date' and 'amount'.")
    return all_rows, all_unmapped, previews


def parse_table(
    content: bytes,
    mime: str,
    known_sources: Sequence[str] = (),
    source_aliases: Mapping[str, str] | None = None,
) -> tuple[list[ParsedPaychequeRow], list[str]]:
    rows, unmapped, _ = parse_table_with_sheets(
        content, mime, known_sources=known_sources, source_aliases=source_aliases
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
_DEPOSIT_DATE_LABELS = (
    r"date|sent(?:\s+on)?|deposited(?:\s+on)?|transaction\s+date"
    r"|posted\s+date|effective\s+date|issued(?:\s+on)?"
)
_DEPOSIT_DATE_RE = re.compile(rf"\b(?:{_DEPOSIT_DATE_LABELS})\b[^\dA-Za-z\n]*{_DATE}", re.I)
_DEPOSIT_DATE_NEXTLINE_RE = re.compile(
    rf"\b(?:{_DEPOSIT_DATE_LABELS})\b\s*:?\s*\n\s*{_DATE}", re.I
)
_DEPOSIT_AMOUNT_RE = re.compile(
    rf"\b(?:amount|deposit\s+amount|total|payment\s+amount|benefit\s+amount"
    rf"|refund\s+amount|credit(?:\s+amount)?|sent\s+you|received|autodeposit)\b"
    rf"[^\d\n]*?{_MONEY}",
    re.I,
)
_SINGLE_DOLLAR_RE = re.compile(r"\$\s*(\d[\d,]*\.\d{2})")
_DEPOSIT_SENDER_RE = re.compile(
    r"(?:sent\s+from|transfer\s+from|received\s+from|deposit\s+from|from|sender)"
    r"\s*:?\s*([A-Za-z0-9][^\n$]{1,55})",
    re.I,
)
_DEPOSIT_SENT_YOU_RE = re.compile(
    r"\b([A-Z][A-Za-z0-9 '&.-]{1,50}?)\s+(?:sent\s+you|deposited)\b",
)
_DEPOSIT_GENERIC_SENDER_RE = re.compile(
    r"^(?:interac|e-?transfer|autodeposit|you|your\s+account|direct\s+deposit)$", re.I
)
_SUMMARY_DATE_LINE_RE = re.compile(rf"^\s*{_DATE}\s+(.+)$")
_PERIOD_LINE_SKIP_RE = re.compile(
    r"\b(?:begin|ending|period|advice\s+date|pay\s+end|pay\s+begin)\b", re.I
)
_DIST_TOTAL_RE = re.compile(rf"net\s+pay\s+distribution[\s\S]{{0,200}}?total\s*:?\s*{_MONEY}", re.I)
_CID_GARBAGE_RE = re.compile(r"\(cid:\d+\)")
_BROKEN_MONEY_RE = re.compile(r"\$\s*\d[\d\s]+\d{2}\b")
_STATUTORY_TAX_RE = re.compile(
    r"\b(?:tax(?:es)?|cpp|qpp|ei|e\.i\.|c\.p\.p\.|fica|medicare|oasdi"
    r"|social\s+security|withholding|cit)\b",
    re.I,
)
_IGNORED_WITHHOLDING_RE = re.compile(
    r"\b(?:deposit|net\s+pay|net\s+cheque|net\s+check|employer\s+paid|wsib)\b",
    re.I,
)

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
    r"|interac|e-?transfer|autodeposit|money\s+received|deposit\s+confirmation"
    r"|royal\s+bank|td\s+canada|scotiabank|bmo|cibc|rbc)\b",
    re.I,
)


def _resolve_source_name(
    name: str | None,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
) -> tuple[str | None, str | None]:
    """Resolve extracted source text via aliases/known sources, preserving raw_source_name."""
    clean = _clean_text(name)
    if not clean:
        return None, None
    raw_clean = clean[:MAX_SOURCE_NAME_LENGTH]
    lowered = clean.lower()
    if source_aliases and lowered in source_aliases:
        return source_aliases[lowered], raw_clean
    for known in known_sources:
        if known.strip().lower() == lowered:
            return known.strip(), raw_clean
    return raw_clean, raw_clean


def _match_known_source(
    name: str | None,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
) -> str | None:
    resolved, _ = _resolve_source_name(name, known_sources, source_aliases)
    return resolved


def _infer_source_name(
    text: str,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
    doc_type: NetDocType = "paystub",
) -> tuple[str | None, str | None]:
    head = text[:1500]
    candidates: list[tuple[str, str]] = [
        (s.strip(), s.strip()) for s in known_sources if s.strip()
    ]
    if source_aliases:
        candidates.extend((alias, target) for alias, target in source_aliases.items() if alias)
    for cand, target in sorted(candidates, key=lambda pair: len(pair[0]), reverse=True):
        if m := re.search(rf"(?<!\w){re.escape(cand)}(?!\w)", head, re.I):
            return target, m.group(0)[:MAX_SOURCE_NAME_LENGTH]

    if doc_type == "deposit":
        if _CRA_BENEFIT_RE.search(head):
            return _resolve_source_name("CRA / Government", known_sources, source_aliases)
        for rx in (_DEPOSIT_SENDER_RE, _DEPOSIT_SENT_YOU_RE):
            if m := rx.search(head):
                cand = m.group(1).strip(" :-–—")
                if cand and not _DEPOSIT_GENERIC_SENDER_RE.match(cand):
                    return _resolve_source_name(cand, known_sources, source_aliases)

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
            return _resolve_source_name(cand, known_sources, source_aliases)

    if m := _NUMBERED_CORP_RE.search(head):
        return _resolve_source_name(m.group(0).strip(), known_sources, source_aliases)
    return None, None


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
    document_type: DocType = "paystub",
    raw_text: str = "",
) -> ParsedPaychequeRow:
    net_only = document_type in {"cheque", "deposit"}
    return check_row(
        ParsedPaychequeRow(
            source_name=_clean_text(fields.get("source_name")),
            raw_source_name=_clean_text(fields.get("raw_source_name")),
            paid_on=clean_date(fields.get("paid_on")),
            amount=clean_money(fields.get("amount")),
            gross=None if net_only else clean_money(fields.get("gross")),
            tax=None if net_only else clean_money(fields.get("tax")),
            deductions=None if net_only else clean_money(fields.get("deductions")),
            hours=None if net_only else clean_hours(fields.get("hours")),
            note=note,
            document_type=document_type,
            confidence=confidence,
        ),
        raw_text=raw_text,
    )


def _reconcile_vision_withholdings(
    data: dict,
    gross: str | None,
    amount: str | None,
    tax: str | None,
    deductions: str | None,
) -> tuple[str | None, str | None]:
    def cents(value: str | None) -> int | None:
        return parse_cents(value, "Amount", required=False, allow_zero=True)

    gross_c, net_c, tax_c, ded_c = cents(gross), cents(amount), cents(tax), cents(deductions)
    if gross_c is None or net_c is None or gross_c < net_c:
        return tax, deductions

    expected = gross_c - net_c
    if (tax_c is not None or ded_c is not None) and abs(
        (tax_c or 0) + (ded_c or 0) - expected
    ) <= 1:
        return tax, deductions

    raw_items = data.get("withholdings")
    if isinstance(raw_items, list):
        parsed_items: list[tuple[str, int]] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            label = _clean_text(item.get("label")) or ""
            if _IGNORED_WITHHOLDING_RE.search(label):
                continue
            amt_c = cents(clean_money(item.get("amount")))
            if amt_c is not None and 0 < amt_c <= expected:
                parsed_items.append((label, amt_c))
        if parsed_items and abs(sum(c for _, c in parsed_items) - expected) <= 1:
            tax_sum = sum(c for lbl, c in parsed_items if _STATUTORY_TAX_RE.search(lbl))
            ded_sum = sum(c for _, c in parsed_items) - tax_sum
            return (
                f"{tax_sum // 100}.{tax_sum % 100:02d}",
                f"{ded_sum // 100}.{ded_sum % 100:02d}",
            )

    if tax_c is not None and ded_c is not None and (tax_c + ded_c) > expected:
        if 0 <= tax_c <= expected < ded_c:
            return tax, None
        if 0 <= ded_c <= expected < tax_c:
            return None, deductions
    return tax, deductions


def _row_from_vision(
    data: dict,
    filename: str,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> ParsedPaychequeRow:
    numeric_amt = clean_money(data.get("numeric_amount") or data.get("amount"))
    raw_written = data.get("written_amount")
    if isinstance(raw_written, (int, float)) or (
        isinstance(raw_written, str) and re.fullmatch(r"[\s$,\d.]+", raw_written)
    ):
        written_amt = clean_money(raw_written)
    else:
        written_amt = parse_written_amount(str(raw_written or ""))

    no_paystub_breakdown = all(data.get(k) is None for k in ("gross", "tax", "deductions"))
    raw_doc_type = str(data.get("document_type") or "").strip().lower()
    if raw_doc_type == "cheque" or (written_amt is not None and no_paystub_breakdown):
        doc_type: NetDocType = "cheque"
    elif raw_doc_type == "deposit":
        doc_type = "deposit"
    else:
        doc_type = "paystub"

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

    net_only = doc_type in {"cheque", "deposit"}
    gross_val = None if net_only else clean_money(data.get("gross"))
    raw_tax_val = None if net_only else clean_money(data.get("tax"))
    raw_ded_val = None if net_only else clean_money(data.get("deductions"))
    tax_val, ded_val = raw_tax_val, raw_ded_val
    if doc_type == "paystub":
        tax_val, ded_val = _reconcile_vision_withholdings(
            data, gross_val, amount, raw_tax_val, raw_ded_val
        )
        if trace is not None:
            raw_wh = data.get("withholdings")
            trace.record(
                "reconcile_withholdings",
                {
                    "before": {"tax": raw_tax_val, "deductions": raw_ded_val},
                    "after": {"tax": tax_val, "deductions": ded_val},
                    "withholdings_count": len(raw_wh) if isinstance(raw_wh, list) else 0,
                },
            )

    src_resolved, src_raw = _resolve_source_name(
        data.get("source_name"), known_sources, source_aliases
    )
    row = ParsedPaychequeRow(
        source_name=src_resolved,
        raw_source_name=src_raw,
        paid_on=clean_date(data.get("paid_on")),
        amount=amount,
        gross=gross_val,
        tax=tax_val,
        deductions=ded_val,
        hours=None if net_only else clean_hours(data.get("hours")),
        note=(_clean_text(data.get("note")) or f"Scanned from {filename}")[:MAX_NOTE_LENGTH],
        document_type=doc_type,
        confidence=confidence,
        warnings=warnings,
    )
    checked_row = check_row(
        row,
        raw_text=" ".join(str(v) for v in data.values() if v is not None),
        cheque_number=str(data.get("cheque_number") or "") or None,
    )
    if trace is not None:
        trace.record("vision_row", {"row": checked_row.model_dump()})
    return checked_row


def _rows_from_vision(
    data: dict,
    filename: str,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> list[ParsedPaychequeRow]:
    entries = data.get("entries")
    if isinstance(entries, list):
        valid_entries = [
            e
            for e in entries
            if isinstance(e, dict)
            and any(e.get(k) is not None for k in ("paid_on", "numeric_amount", "amount", "gross"))
        ]
        if valid_entries:
            rows: list[ParsedPaychequeRow] = []
            for entry in valid_entries:
                merged = dict(entry)
                if not merged.get("document_type") and data.get("document_type"):
                    merged["document_type"] = data["document_type"]
                if not merged.get("source_name") and data.get("source_name"):
                    merged["source_name"] = data["source_name"]
                rows.append(
                    _row_from_vision(
                        merged,
                        filename,
                        known_sources,
                        source_aliases=source_aliases,
                        trace=trace,
                    )
                )
            return rows
    return [
        _row_from_vision(
            data, filename, known_sources, source_aliases=source_aliases, trace=trace
        )
    ]


def _rows_from_pdf_tables(
    tables: Sequence[Sequence[Sequence[str | None]]],
    text: str,
    filename: str,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
) -> list[ParsedPaychequeRow]:
    """Extract multi-row tabular schedules from ruled PDF tables (e.g. annual salary tables)."""
    default_src, default_raw = _infer_source_name(text, known_sources, source_aliases)
    default_note = f"Imported from {filename}"[:MAX_NOTE_LENGTH]
    rows: list[ParsedPaychequeRow] = []

    for table in tables:
        cols: dict[str, int] | None = None
        header_idx = -1
        for r_idx, header_row in enumerate(table[:3]):
            mapped: dict[str, int] = {}
            for c_idx, cell in enumerate(header_row):
                key = _norm_cell(cell)
                field = _ALIAS_TO_FIELD.get(key)
                if field and field not in mapped:
                    mapped[field] = c_idx
            if "paid_on" in mapped and "amount" in mapped:
                cols, header_idx = mapped, r_idx
                break
        if cols is None:
            continue

        for raw_row in table[header_idx + 1 :]:
            def cell(
                field: str,
                raw_row: Sequence[str | None] = raw_row,
                cols: dict[str, int] = cols,
            ) -> str | None:
                idx = cols.get(field)
                return raw_row[idx] if idx is not None and idx < len(raw_row) else None

            paid_on = clean_date(cell("paid_on"))
            amount = clean_money(cell("amount"))
            if not paid_on or not amount:
                continue
            raw_src_cell = _clean_text(cell("source_name"))
            if raw_src_cell:
                src_resolved, src_raw = _resolve_source_name(
                    raw_src_cell, known_sources, source_aliases
                )
            else:
                src_resolved, src_raw = default_src, default_raw
            rows.append(
                check_row(
                    ParsedPaychequeRow(
                        source_name=src_resolved,
                        raw_source_name=src_raw,
                        paid_on=paid_on,
                        amount=amount,
                        gross=clean_money(cell("gross")),
                        tax=clean_money(cell("tax")),
                        deductions=clean_money(cell("deductions")),
                        hours=clean_hours(cell("hours")),
                        note=(_clean_text(cell("note")) or default_note)[:MAX_NOTE_LENGTH],
                        document_type="tabular",
                        confidence=0.95,
                    )
                )
            )
    return rows


def _rows_from_text_summary_list(
    text: str,
    filename: str,
    confidence: float,
    known_sources: Sequence[str],
    source_aliases: Mapping[str, str] | None = None,
) -> list[ParsedPaychequeRow]:
    """Extract multi-row date + amount statement lists (e.g. Salary.pdf)."""
    if is_cheque_text(text):
        return []
    default_note = f"Imported from {filename}"[:MAX_NOTE_LENGTH]
    current_src, current_raw = _infer_source_name(text, known_sources, source_aliases)
    money_cols: list[str] | None = None
    rows: list[ParsedPaychequeRow] = []
    source_candidates = [
        *((s.strip(), s.strip()) for s in known_sources if s.strip()),
        *((alias, target) for alias, target in (source_aliases or {}).items() if alias),
    ]
    source_candidates.sort(key=lambda pair: len(pair[0]), reverse=True)

    for raw_line in text.replace("\f", "\n").splitlines():
        line = raw_line.strip()
        if not line or _YTD_ROW_RE.match(line) or _PERIOD_ROW_RE.match(line):
            continue

        # Detect tabular column header line like "Date  Gross  Tax  Deductions  Net Pay"
        header_tokens = [
            _ALIAS_TO_FIELD.get(_norm_cell(part))
            for part in re.split(r"\s{2,}|\t|\|", line)
            if part.strip()
        ]
        mapped_header = [t for t in header_tokens if t]
        if "paid_on" in mapped_header and any(
            t in {"amount", "gross", "tax", "deductions"} for t in mapped_header
        ):
            money_cols = [t for t in mapped_header if t in {"gross", "tax", "deductions", "amount"}]
            continue

        if not _PERIOD_LINE_SKIP_RE.search(line) and (m := _SUMMARY_DATE_LINE_RE.match(line)):
            paid_on = clean_date(m.group(1))
            rest = m.group(2).strip()
            money_matches = list(re.finditer(_MONEY, rest))
            if paid_on and money_matches:
                row_fields: dict[str, str | None] = {
                    "amount": None,
                    "gross": None,
                    "tax": None,
                    "deductions": None,
                }
                if money_cols and len(money_matches) == len(money_cols):
                    for col_name, mm in zip(money_cols, money_matches, strict=True):
                        row_fields[col_name] = clean_money(mm.group(1))
                    trailing = rest[money_matches[-1].end() :].strip(" -|")
                elif len(money_matches) == 1:
                    row_fields["amount"] = clean_money(money_matches[0].group(1))
                    trailing = rest[money_matches[0].end() :].strip(" -|")
                else:
                    row_fields["amount"] = clean_money(money_matches[-1].group(1))
                    trailing = rest[money_matches[-1].end() :].strip(" -|")

                if row_fields["amount"]:
                    rows.append(
                        check_row(
                            ParsedPaychequeRow(
                                source_name=current_src,
                                raw_source_name=current_raw,
                                paid_on=paid_on,
                                amount=row_fields["amount"],
                                gross=row_fields["gross"],
                                tax=row_fields["tax"],
                                deductions=row_fields["deductions"],
                                note=(trailing or default_note)[:MAX_NOTE_LENGTH],
                                document_type="tabular",
                                confidence=confidence,
                            )
                        )
                    )
                    continue

        # Update active section source on standalone employer/section header lines
        matched_known = next(
            (
                (target, hit.group(0)[:MAX_SOURCE_NAME_LENGTH])
                for cand, target in source_candidates
                if (hit := re.search(rf"(?<!\w){re.escape(cand)}(?!\w)", line, re.I))
                and not re.search(_MONEY, line)
            ),
            None,
        )
        if matched_known:
            current_src, current_raw = matched_known
            money_cols = None
            continue
        if (
            2 <= len(line) <= MAX_SOURCE_NAME_LENGTH
            and not line[0].isdigit()
            and ":" not in line
            and "$" not in line
            and not re.search(r"\d+\.\d{2}", line)
            and not _GENERIC_HEADER_RE.match(line)
            and not _SUMMARY_HEADER_RE.search(line)
            and len(mapped_header) < 2
            and any(ch.isalpha() for ch in line)
        ):
            current_src, current_raw = _resolve_source_name(line, known_sources, source_aliases)
            money_cols = None

    return rows if len(rows) >= 2 else []


def _deterministic_text_row(
    text: str,
    filename: str,
    confidence: float,
    tables: Sequence[Sequence[Sequence[str | None]]] = (),
    known_sources: Sequence[str] = (),
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> tuple[ParsedPaychequeRow, dict[str, object], NetDocType, str]:
    t0 = time.monotonic()
    cheque_mode = is_cheque_text(text)
    deposit_mode = not cheque_mode and is_deposit_text(text)
    doc_type: NetDocType = (
        "cheque" if cheque_mode else ("deposit" if deposit_mode else "paystub")
    )
    note = f"Imported from {filename}"[:MAX_NOTE_LENGTH]

    found: dict[str, object] = {}
    for key, rx in _TEXT_PATTERNS.items():
        if doc_type in {"cheque", "deposit"} and key in {"gross", "tax", "deductions"}:
            continue
        if m := rx.search(text):
            found[key] = m.group(1)
    if "paid_on" not in found and (m := _PAID_ON_NEXTLINE_RE.search(text)):
        found["paid_on"] = m.group(1)
    if cheque_mode and "paid_on" not in found:
        if m := (_CHEQUE_DATE_RE.search(text) or _CHEQUE_DATE_NEXTLINE_RE.search(text)):
            found["paid_on"] = m.group(1)
    if deposit_mode and "paid_on" not in found:
        if m := (_DEPOSIT_DATE_RE.search(text) or _DEPOSIT_DATE_NEXTLINE_RE.search(text)):
            found["paid_on"] = m.group(1)

    if cheque_mode:
        if "amount" not in found and (written := parse_written_amount(text)):
            found["amount"] = written
    elif deposit_mode:
        if "amount" not in found:
            if m := _DEPOSIT_AMOUNT_RE.search(text):
                found["amount"] = m.group(1)
            else:
                dollar_hits = _SINGLE_DOLLAR_RE.findall(text)
                if len(dollar_hits) == 1:
                    found["amount"] = dollar_hits[0]
    else:
        found.update(_fields_from_summary_lines(text))
        found.update(_fields_from_tables(tables))
        if "amount" not in found and (m := _DIST_TOTAL_RE.search(text)):
            found["amount"] = m.group(1)

    source, raw_source = _infer_source_name(
        text, known_sources, source_aliases=source_aliases, doc_type=doc_type
    )
    if source:
        found["source_name"] = source
    if raw_source:
        found["raw_source_name"] = raw_source

    row = _row_from_fields(found, note, confidence, document_type=doc_type, raw_text=text)
    if trace is not None:
        trace.record(
            "deterministic_text",
            {
                "document_type": doc_type,
                "found_fields": found,
                "row": row.model_dump(),
                "warnings": list(row.warnings),
            },
            duration_ms=int((time.monotonic() - t0) * 1000),
        )
    return row, found, doc_type, note


async def _llm_fallback_for_text(
    row: ParsedPaychequeRow,
    found: dict[str, object],
    doc_type: NetDocType,
    note: str,
    text: str,
    confidence: float,
    known_sources: Sequence[str] = (),
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> tuple[ParsedPaychequeRow, bool]:
    if not row.warnings or not text.strip() or not extractors.llm_available():
        return row, False

    t0 = time.monotonic()
    cheque_mode = doc_type == "cheque"
    llm_raw = await asyncio.to_thread(
        extractors.llm_extract, text, cheque_mode=cheque_mode, doc_type=doc_type
    )
    llm_fields = _sanitize_llm_fields(llm_raw)
    if llm_fields.get("source_name"):
        resolved, raw = _resolve_source_name(
            llm_fields["source_name"], known_sources, source_aliases
        )
        llm_fields["source_name"] = resolved
        llm_fields["raw_source_name"] = raw
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

    chosen = min(candidates, key=rank)
    if trace is not None:
        trace.record(
            "llm_extract",
            {
                "cheque_mode": cheque_mode,
                "doc_type": doc_type,
                "raw_fields": llm_raw,
                "sanitized_fields": llm_fields,
                "chosen_used_llm": chosen[1],
                "chosen_row": chosen[0].model_dump(),
            },
            duration_ms=int((time.monotonic() - t0) * 1000),
        )
    return chosen


async def row_from_text(
    text: str,
    filename: str,
    confidence: float,
    tables: Sequence[Sequence[Sequence[str | None]]] = (),
    known_sources: Sequence[str] = (),
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> tuple[ParsedPaychequeRow, bool]:
    """Returns (row, used_llm). Runs deterministic rules first and only calls the local LLM
    when warnings remain."""
    row, found, doc_type, note = _deterministic_text_row(
        text,
        filename,
        confidence,
        tables=tables,
        known_sources=known_sources,
        source_aliases=source_aliases,
        trace=trace,
    )
    return await _llm_fallback_for_text(
        row,
        found,
        doc_type,
        note,
        text,
        confidence,
        known_sources=known_sources,
        source_aliases=source_aliases,
        trace=trace,
    )


async def rows_from_text(
    text: str,
    filename: str,
    confidence: float,
    tables: Sequence[Sequence[Sequence[str | None]]] = (),
    known_sources: Sequence[str] = (),
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> tuple[list[ParsedPaychequeRow], bool]:
    """Extract 1..N rows from OCR/text (summary lists, multi-page bundles, or single doc)."""
    summary_rows = _rows_from_text_summary_list(
        text, filename, confidence, known_sources, source_aliases
    )
    if summary_rows:
        return summary_rows, False

    page_texts = [p.strip() for p in text.split("\f") if len(p.strip()) >= 20]
    if len(page_texts) > 1:
        rows: list[ParsedPaychequeRow] = []
        used_any_llm = False
        for page_text in page_texts:
            r, used_llm = await row_from_text(
                page_text,
                filename,
                confidence,
                known_sources=known_sources,
                source_aliases=source_aliases,
                trace=trace,
            )
            used_any_llm = used_any_llm or used_llm
            rows.append(r)
        valid = [r for r in rows if r.paid_on or r.amount]
        return (valid or rows), used_any_llm

    row, used_llm = await row_from_text(
        text,
        filename,
        confidence,
        tables=tables,
        known_sources=known_sources,
        source_aliases=source_aliases,
        trace=trace,
    )
    return [row], used_llm


# --- Entry point -------------------------------------------------------------------------


async def _try_vision_parse(
    content: bytes,
    mime: str,
    filename: str,
    known_sources: Sequence[str],
    meta: dict[str, str],
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> tuple[ParseResponse | None, list | None]:
    if not extractors.vision_available():
        return None, None

    t0 = time.monotonic()
    try:
        images = await asyncio.to_thread(extractors.prepare_images, content, mime)
    except ModuleNotFoundError:
        raise
    except Exception as exc:
        if trace is not None:
            trace.record(
                "prepare_images",
                {"error": str(exc)},
                status="error",
                duration_ms=int((time.monotonic() - t0) * 1000),
            )
        log.warning("Image preparation failed for %s; falling back", filename, exc_info=True)
        return None, None
    if trace is not None:
        trace.record(
            "prepare_images",
            {"page_count": len(images), "sizes": [list(img.size) for img in images]},
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

    t_vis = time.monotonic()
    got_vision = False
    try:
        if len(images) <= 1:
            vision_data = await extractors.vision_extract(images, known_sources=known_sources)
            got_vision = True
            if trace is not None:
                trace.record(
                    "vision_extract",
                    {"model": settings.VISION_MODEL_NAME, "raw_output": vision_data},
                    duration_ms=int((time.monotonic() - t_vis) * 1000),
                )
            rows = _rows_from_vision(
                vision_data,
                filename,
                known_sources,
                source_aliases=source_aliases,
                trace=trace,
            )
        else:
            raw_pages: list[dict] = []
            rows = []
            for img in images:
                page_data = await extractors.vision_extract([img], known_sources=known_sources)
                raw_pages.append(page_data)
                rows.extend(
                    _rows_from_vision(
                        page_data,
                        filename,
                        known_sources,
                        source_aliases=source_aliases,
                        trace=trace,
                    )
                )
            got_vision = True
            if trace is not None:
                trace.record(
                    "vision_extract",
                    {"model": settings.VISION_MODEL_NAME, "pages": raw_pages},
                    duration_ms=int((time.monotonic() - t_vis) * 1000),
                )
            valid_rows = [r for r in rows if r.paid_on or r.amount]
            if valid_rows:
                rows = valid_rows
        return (
            ParseResponse(**meta, parser_used="vision", used_llm_fallback=False, rows=rows),
            images,
        )
    except Exception as exc:
        if trace is not None:
            trace.record(
                "vision_row" if got_vision else "vision_extract",
                {"model": settings.VISION_MODEL_NAME, "error": str(exc)},
                status="error",
                duration_ms=int((time.monotonic() - t_vis) * 1000),
            )
        log.warning("Vision OCR failed for %s; falling back to RapidOCR", filename, exc_info=True)
        return None, images


async def parse_upload(
    content: bytes,
    filename: str,
    known_sources: Sequence[str] = (),
    source_aliases: Mapping[str, str] | None = None,
    trace: PipelineTrace | None = None,
) -> ParseResponse:
    mime = detect_mime(content, filename)
    if mime not in {CSV, TSV, XLSX, PDF, *IMAGES}:
        raise UnsupportedFileType()
    if trace is not None:
        trace.record("detect_mime", {"detected_mime": mime, "file_size_bytes": len(content)})
    meta = {"filename": filename, "detected_mime": mime}
    try:
        if mime in {CSV, TSV, XLSX}:
            t0 = time.monotonic()
            rows, unmapped, sheets = await asyncio.to_thread(
                parse_table_with_sheets, content, mime, known_sources, source_aliases
            )
            if trace is not None:
                trace.record(
                    "parse_table",
                    {
                        "row_count": len(rows),
                        "sheet_count": len(sheets),
                        "unmapped_columns": unmapped,
                        "sample_rows": [r.model_dump() for r in rows[:MAX_STORED_ROWS]],
                    },
                    duration_ms=int((time.monotonic() - t0) * 1000),
                )
            return ParseResponse(
                **meta,
                parser_used="tabular",
                rows=rows,
                unmapped_columns=unmapped,
                sheets=sheets,
            )

        images = None
        if mime == PDF:
            t0 = time.monotonic()
            raw_text, tables = await asyncio.to_thread(extractors.pdf_extract, content)
            has_cid_garbage = "(cid:" in raw_text
            text = _CID_GARBAGE_RE.sub("", raw_text).strip()
            if trace is not None:
                trace.record(
                    "pdf_extract",
                    {
                        "raw_text_len": len(raw_text),
                        "clean_text_len": len(text),
                        "has_cid_garbage": has_cid_garbage,
                        "tables_count": len(tables),
                        "text_preview": truncate_text(text),
                        "tables_preview": tables[:MAX_STORED_TABLES],
                    },
                    duration_ms=int((time.monotonic() - t0) * 1000),
                )
            if len(text) >= 20:
                t_sum = time.monotonic()
                table_rows = _rows_from_pdf_tables(
                    tables, text, filename, known_sources, source_aliases
                )
                summary_rows = table_rows or _rows_from_text_summary_list(
                    text, filename, 0.9, known_sources, source_aliases
                )
                if len(summary_rows) >= 2 or (
                    len(table_rows) >= 1 and all(not r.warnings for r in table_rows)
                ):
                    if trace is not None:
                        trace.record(
                            "pdf_summary_table",
                            {
                                "row_count": len(summary_rows),
                                "source_kind": "ruled_table" if table_rows else "text_list",
                                "sample_rows": [
                                    r.model_dump() for r in summary_rows[:MAX_STORED_ROWS]
                                ],
                            },
                            duration_ms=int((time.monotonic() - t_sum) * 1000),
                        )
                    return ParseResponse(
                        **meta, parser_used="pdf_text", used_llm_fallback=False, rows=summary_rows
                    )

                page_texts = [p.strip() for p in text.split("\f") if len(p.strip()) >= 20]
                if len(page_texts) > 1:
                    page_results = [
                        _deterministic_text_row(
                            p_text,
                            filename,
                            0.9,
                            known_sources=known_sources,
                            source_aliases=source_aliases,
                            trace=trace,
                        )
                        for p_text in page_texts
                    ]
                    valid_results = [
                        res for res in page_results if res[0].paid_on or res[0].amount
                    ] or page_results
                    page_rows = [res[0] for res in valid_results]
                    if all(not r.warnings for r in page_rows):
                        return ParseResponse(
                            **meta, parser_used="pdf_text", used_llm_fallback=False, rows=page_rows
                        )
                    det_row = page_rows[0]
                    found, doc_type, note = (
                        valid_results[0][1],
                        valid_results[0][2],
                        valid_results[0][3],
                    )
                else:
                    det_row, found, doc_type, note = _deterministic_text_row(
                        text,
                        filename,
                        0.9,
                        tables=tables,
                        known_sources=known_sources,
                        source_aliases=source_aliases,
                        trace=trace,
                    )
                    if not det_row.warnings:
                        return ParseResponse(
                            **meta, parser_used="pdf_text", used_llm_fallback=False, rows=[det_row]
                        )
                    valid_results = [(det_row, found, doc_type, note)]

                vision_resp, images = await _try_vision_parse(
                    content,
                    mime,
                    filename,
                    known_sources,
                    meta,
                    source_aliases=source_aliases,
                    trace=trace,
                )
                if vision_resp is not None:
                    return vision_resp

                if has_cid_garbage or (not det_row.amount and bool(_BROKEN_MONEY_RE.search(text))):
                    t_ocr = time.monotonic()
                    try:
                        ocr_txt, ocr_score = await asyncio.to_thread(
                            extractors.ocr_text, content, mime, images=images
                        )
                        if trace is not None:
                            trace.record(
                                "ocr_text",
                                {
                                    "score": round(ocr_score, 4),
                                    "text_len": len(ocr_txt),
                                    "text_preview": truncate_text(ocr_txt),
                                },
                                duration_ms=int((time.monotonic() - t_ocr) * 1000),
                            )
                    except Exception as exc:
                        if trace is not None:
                            trace.record(
                                "ocr_text",
                                {"error": str(exc)},
                                status="error",
                                duration_ms=int((time.monotonic() - t_ocr) * 1000),
                            )
                        log.warning("RapidOCR escalation failed for %s", filename, exc_info=True)
                        ocr_txt = ""
                    if ocr_txt.strip():
                        rows, used_llm = await rows_from_text(
                            ocr_txt,
                            filename,
                            min(ocr_score, 0.85) or 0.5,
                            known_sources=known_sources,
                            source_aliases=source_aliases,
                            trace=trace,
                        )
                        return ParseResponse(
                            **meta, parser_used="ocr", used_llm_fallback=used_llm, rows=rows
                        )

                if len(page_texts) > 1:
                    final_rows: list[ParsedPaychequeRow] = []
                    used_any_llm = False
                    for (p_row, p_found, p_doc_type, p_note), p_text in zip(
                        valid_results,
                        page_texts[: len(valid_results)],
                        strict=False,
                    ):
                        r, used_llm = await _llm_fallback_for_text(
                            p_row,
                            p_found,
                            p_doc_type,
                            p_note,
                            p_text,
                            0.9,
                            known_sources=known_sources,
                            source_aliases=source_aliases,
                            trace=trace,
                        )
                        used_any_llm = used_any_llm or used_llm
                        final_rows.append(r)
                    return ParseResponse(
                        **meta,
                        parser_used="pdf_text",
                        used_llm_fallback=used_any_llm,
                        rows=final_rows,
                    )

                row, used_llm = await _llm_fallback_for_text(
                    det_row,
                    found,
                    doc_type,
                    note,
                    text,
                    0.9,
                    known_sources=known_sources,
                    source_aliases=source_aliases,
                    trace=trace,
                )
                return ParseResponse(
                    **meta, parser_used="pdf_text", used_llm_fallback=used_llm, rows=[row]
                )

        vision_resp, images = await _try_vision_parse(
            content,
            mime,
            filename,
            known_sources,
            meta,
            source_aliases=source_aliases,
            trace=trace,
        )
        if vision_resp is not None:
            return vision_resp

        t_ocr = time.monotonic()
        text, ocr_score = await asyncio.to_thread(extractors.ocr_text, content, mime, images=images)
        if trace is not None:
            trace.record(
                "ocr_text",
                {
                    "score": round(ocr_score, 4),
                    "text_len": len(text),
                    "text_preview": truncate_text(text),
                },
                duration_ms=int((time.monotonic() - t_ocr) * 1000),
            )
        rows, used_llm = await rows_from_text(
            text,
            filename,
            min(ocr_score, 0.85) or 0.5,
            known_sources=known_sources,
            source_aliases=source_aliases,
            trace=trace,
        )
        return ParseResponse(**meta, parser_used="ocr", used_llm_fallback=used_llm, rows=rows)
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
