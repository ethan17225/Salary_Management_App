import re
from typing import Any

from pydantic import field_validator

from src.models import CustomModel
from src.sources.constants import (
    DEFAULT_SOURCE_COLOR,
    HEX_COLOR_PATTERN,
    MAX_SOURCE_NAME_LENGTH,
    ErrorCode,
    SourceKind,
)


class SourcePayload(CustomModel):
    name: str
    kind: SourceKind = SourceKind.JOB
    color: str = DEFAULT_SOURCE_COLOR
    archived: int = 0

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

