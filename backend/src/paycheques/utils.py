from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any, overload

from src.paycheques.constants import MAX_DOLLARS


@overload
def parse_cents(value: Any, field: str, required: bool = True) -> int: ...


@overload
def parse_cents(value: Any, field: str, required: bool = False) -> int | None: ...


def parse_cents(value: Any, field: str, required: bool = True) -> int | None:
    if value is None or str(value).strip() == "":
        if required:
            raise ValueError(f"{field} is required")
        return None
    if isinstance(value, bool):
        raise ValueError(f"{field} must be a number")
    try:
        d = Decimal(str(value).replace(",", "").replace("$", "").strip())
    except InvalidOperation:
        raise ValueError(f"{field} must be a number") from None
    if not d.is_finite() or d <= 0 or d >= MAX_DOLLARS:
        raise ValueError(f"{field} must be between 0 and 10,000,000")
    return int((d * 100).quantize(Decimal(1), ROUND_HALF_UP))

