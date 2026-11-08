import math
from datetime import date
from typing import Any

from pydantic import field_validator, model_validator

from src.models import CustomModel
from src.paycheques.constants import MAX_HOURS, MAX_NOTE_LENGTH, ErrorCode
from src.paycheques.utils import (
    parse_cents,
    parse_optional_cents,
    validate_paystub_breakdown,
)


def _parse_int_cents(val: Any, field_name: str, allow_zero: bool = True) -> int | None:
    if val is None or val == "":
        return None
    if isinstance(val, bool) or not isinstance(val, int):
        try:
            c = int(val)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid monetary amount for {field_name}") from exc
    else:
        c = val
    if allow_zero and c < 0:
        raise ValueError(f"{field_name} cannot be negative")
    if not allow_zero and c <= 0:
        raise ValueError(f"{field_name} must be greater than zero")
    return c


class PaychequePayload(CustomModel):
    source_id: int
    paid_on: str
    amount: int
    gross: int | None = None
    tax: int | None = None
    deductions: int | None = None
    gross_cents: int | None = None
    tax_cents: int | None = None
    deductions_cents: int | None = None
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

    @field_validator("gross_cents", mode="before")
    @classmethod
    def validate_gross_cents(cls, value: Any) -> int | None:
        return _parse_int_cents(value, "Gross", allow_zero=False)

    @field_validator("tax_cents", mode="before")
    @classmethod
    def validate_tax_cents(cls, value: Any) -> int | None:
        return _parse_int_cents(value, "Tax", allow_zero=True)

    @field_validator("deductions_cents", mode="before")
    @classmethod
    def validate_deductions_cents(cls, value: Any) -> int | None:
        return _parse_int_cents(value, "Deductions", allow_zero=True)

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
        g = self.gross_cents if self.gross_cents is not None else self.gross
        t = self.tax_cents if self.tax_cents is not None else self.tax
        d = self.deductions_cents if self.deductions_cents is not None else self.deductions
        g, t, d = validate_paystub_breakdown(self.amount, g, t, d)
        self.gross_cents = g
        self.tax_cents = t
        self.deductions_cents = d
        return self

    @property
    def amount_cents(self) -> int:
        return self.amount


class PaychequeCreate(PaychequePayload):
    pass


class PaychequeUpdate(PaychequePayload):
    pass


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
