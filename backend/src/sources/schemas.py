import re
from typing import Any

from pydantic import field_validator, model_validator

from src.forecast import parse_active_until, parse_expected_cadence_days
from src.models import CustomModel
from src.paycheques.utils import parse_optional_cents, parse_tax_reserve_bps
from src.sources.constants import (
    DEFAULT_SOURCE_COLOR,
    HEX_COLOR_PATTERN,
    MAX_SOURCE_NAME_LENGTH,
    ErrorCode,
    SourceKind,
)


def _parse_int_cents(val: Any, field_name: str) -> int | None:
    if val is None or val == "":
        return None
    if isinstance(val, bool) or not isinstance(val, int):
        try:
            c = int(val)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid monetary amount for {field_name}") from exc
    else:
        c = val
    if c <= 0:
        raise ValueError(f"{field_name} must be greater than zero")
    return c


class SourcePayload(CustomModel):
    name: str
    kind: SourceKind = SourceKind.JOB
    color: str = DEFAULT_SOURCE_COLOR
    archived: int = 0
    is_tax_withheld: int = 1
    tax_reserve_bps: int = 0
    expected_cadence_days: int | None = None
    active_until: str | None = None
    target_hourly: int | None = None
    target_hourly_cents: int | None = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Any) -> str:
        s = str(value or "").strip()
        if not s:
            raise ValueError(ErrorCode.NAME_REQUIRED)
        if len(s) > MAX_SOURCE_NAME_LENGTH:
            raise ValueError(ErrorCode.NAME_TOO_LONG)
        return s

    @field_validator("kind", mode="before")
    @classmethod
    def validate_kind(cls, value: Any) -> SourceKind:
        raw = value or SourceKind.JOB.value
        try:
            return SourceKind(raw)
        except ValueError:
            raise ValueError(ErrorCode.INVALID_KIND) from None

    @field_validator("color", mode="before")
    @classmethod
    def validate_color(cls, value: Any) -> str:
        color = str(value or DEFAULT_SOURCE_COLOR)
        if not re.fullmatch(HEX_COLOR_PATTERN, color):
            raise ValueError(ErrorCode.INVALID_COLOR)
        return color

    @field_validator("archived", mode="before")
    @classmethod
    def validate_archived(cls, value: Any) -> int:
        return int(bool(value))

    @field_validator("is_tax_withheld", mode="before")
    @classmethod
    def validate_is_tax_withheld(cls, value: Any) -> int:
        if value is None:
            return 1
        return int(bool(value))

    @field_validator("tax_reserve_bps", mode="before")
    @classmethod
    def validate_tax_reserve_bps(cls, value: Any) -> int:
        return parse_tax_reserve_bps(value)

    @field_validator("expected_cadence_days", mode="before")
    @classmethod
    def validate_expected_cadence_days(cls, value: Any) -> int | None:
        return parse_expected_cadence_days(value)

    @field_validator("active_until", mode="before")
    @classmethod
    def validate_active_until(cls, value: Any) -> str | None:
        return parse_active_until(value)

    @field_validator("target_hourly", mode="before")
    @classmethod
    def validate_target_hourly(cls, value: Any) -> int | None:
        return parse_optional_cents(value, "target_hourly", allow_zero=False)

    @field_validator("target_hourly_cents", mode="before")
    @classmethod
    def validate_target_hourly_cents(cls, value: Any) -> int | None:
        return _parse_int_cents(value, "target_hourly_cents")

    @model_validator(mode="after")
    def sync_tax_reserve(self) -> "SourcePayload":
        if self.is_tax_withheld:
            self.tax_reserve_bps = 0
        if self.target_hourly_cents is None and self.target_hourly is not None:
            self.target_hourly_cents = self.target_hourly
        return self


class SourceCreate(SourcePayload):
    pass


class SourceUpdate(SourcePayload):
    pass


class SourceResponse(CustomModel):
    id: int
    name: str
    kind: SourceKind
    color: str
    archived: int
    is_tax_withheld: int = 1
    tax_reserve_bps: int = 0
    expected_cadence_days: int | None = None
    active_until: str | None = None
    target_hourly_cents: int | None = None

