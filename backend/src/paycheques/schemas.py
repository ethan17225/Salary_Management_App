import math
from datetime import date
from typing import Any

from pydantic import field_validator

from src.models import CustomModel
from src.paycheques.constants import MAX_HOURS, MAX_NOTE_LENGTH, ErrorCode
from src.paycheques.utils import parse_cents


class PaychequePayload(CustomModel):
    source_id: int
    paid_on: str
    amount: int
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
    hours: float | None = None
    note: str
