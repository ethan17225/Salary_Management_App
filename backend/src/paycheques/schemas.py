import math
from datetime import date
from typing import Any, Literal

from pydantic import Field, field_validator, model_validator

from src.models import CustomModel
from src.paycheques.constants import MAX_HOURS, MAX_NOTE_LENGTH, ErrorCode
from src.paycheques.utils import (
    parse_cents,
    parse_optional_cents,
    validate_paystub_breakdown,
)


class PaychequePayload(CustomModel):
    source_id: int
    paid_on: str
    amount: int
    gross: int | None = None
    tax: int | None = None
    deductions: int | None = None
    hours: float | None = None
    note: str = ""

    @field_validator("source_id", mode="before")
    @classmethod
    def validate_source_id(cls, value: Any) -> int:
        if isinstance(value, bool) or value is None:
            raise ValueError(ErrorCode.PICK_SOURCE)
        try:
            sid = int(value)
        except (TypeError, ValueError):
            raise ValueError(ErrorCode.PICK_SOURCE) from None
        if sid <= 0:
            raise ValueError(ErrorCode.PICK_SOURCE)
        return sid

    @field_validator("paid_on", mode="before")
    @classmethod
    def validate_paid_on(cls, value: Any) -> str:
        try:
            return date.fromisoformat(str(value)).isoformat()
        except ValueError:
            raise ValueError(ErrorCode.INVALID_DATE) from None

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, value: Any) -> int:
        return parse_cents(value, "Amount", required=True)

    @field_validator("gross", mode="before")
    @classmethod
    def validate_gross(cls, value: Any) -> int | None:
        return parse_optional_cents(value, "Gross", allow_zero=False)

    @field_validator("tax", mode="before")
    @classmethod
    def validate_tax(cls, value: Any) -> int | None:
        return parse_optional_cents(value, "Tax", allow_zero=True)

    @field_validator("deductions", mode="before")
    @classmethod
    def validate_deductions(cls, value: Any) -> int | None:
        return parse_optional_cents(value, "Deductions", allow_zero=True)

    @field_validator("hours", mode="before")
    @classmethod
    def validate_hours(cls, value: Any) -> float | None:
        if value in (None, ""):
            return None
        if isinstance(value, bool):
            raise ValueError(ErrorCode.HOURS_NOT_NUMBER)
        try:
            h = float(value)
        except (TypeError, ValueError):
            raise ValueError(ErrorCode.HOURS_NOT_NUMBER) from None
        if not math.isfinite(h) or not (0 < h < MAX_HOURS):
            raise ValueError(ErrorCode.HOURS_OUT_OF_RANGE)
        return h

    @field_validator("note", mode="before")
    @classmethod
    def validate_note(cls, value: Any) -> str:
        s = str(value or "").strip()
        if len(s) > MAX_NOTE_LENGTH:
            raise ValueError(ErrorCode.NOTE_TOO_LONG)
        return s

    @model_validator(mode="after")
    def validate_breakdown_invariants(self) -> "PaychequePayload":
        self.gross, self.tax, self.deductions = validate_paystub_breakdown(
            self.amount, self.gross, self.tax, self.deductions
        )
        return self

    @property
    def amount_cents(self) -> int:
        return self.amount

    @property
    def gross_cents(self) -> int | None:
        return self.gross

    @property
    def tax_cents(self) -> int | None:
        return self.tax

    @property
    def deductions_cents(self) -> int | None:
        return self.deductions


PaychequeCreate = PaychequePayload
PaychequeUpdate = PaychequePayload


class PaychequeResponse(CustomModel):
    id: int
    source_id: int
    paid_on: str
    amount_cents: int
    gross_cents: int | None = None
    tax_cents: int | None = None
    deductions_cents: int | None = None
    hours: float | None = None
    note: str


class PaychequeImportPayload(CustomModel):
    csv_text: str | None = None
    rows: list[dict[str, Any]] | None = None
    auto_create_sources: bool = True


class ParsedPaychequeRow(CustomModel):
    """A candidate row for the review table. Money stays a decimal string ("1842.50") until
    /import converts it to integer cents."""

    source_name: str | None = None
    paid_on: str | None = None  # YYYY-MM-DD
    amount: str | None = None
    gross: str | None = None
    tax: str | None = None
    deductions: str | None = None
    hours: float | None = None
    note: str | None = None
    document_type: Literal["paystub", "cheque", "tabular"] = "paystub"
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)


class ParseResponse(CustomModel):
    filename: str
    detected_mime: str
    parser_used: Literal["tabular", "pdf_text", "vision", "ocr"]
    used_llm_fallback: bool = False
    rows: list[ParsedPaychequeRow]
    unmapped_columns: list[str] = Field(default_factory=list)


class PaychequeImportResponse(CustomModel):
    ok: bool = True
    imported_count: int
    skipped_duplicates: int
    created_sources: int
    error_count: int
    errors: list[dict[str, Any]]
