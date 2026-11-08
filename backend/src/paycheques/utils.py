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


def parse_optional_cents(
    val: object, field_name: str, allow_zero: bool = True
) -> int | None:
    """
    Parses an optional dollar value (string, int, float, or None) into integer cents.
    Returns None if val is None or empty string "".
    Raises ValueError on invalid format or negative numbers.
    """
    if val is None or isinstance(val, bool):
        if isinstance(val, bool):
            raise ValueError(f"Invalid monetary amount for {field_name}")
        return None
    if isinstance(val, str):
        cleaned = val.strip().replace("$", "").replace(",", "")
        if cleaned == "":
            return None
        val = cleaned
    try:
        dec = Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid monetary amount for {field_name}") from exc
    if not dec.is_finite():
        raise ValueError(f"Invalid monetary amount for {field_name}")

    cents = int(dec * 100)
    if allow_zero and cents < 0:
        raise ValueError(f"{field_name} cannot be negative")
    if not allow_zero and cents <= 0:
        raise ValueError(f"{field_name} must be greater than zero")
    return cents


def validate_paystub_breakdown(
    amount_cents: int,
    gross_cents: int | None,
    tax_cents: int | None,
    deductions_cents: int | None,
) -> tuple[int | None, int | None, int | None]:
    """
    Validates cross-field invariants for a paycheque breakdown.
    If tax_cents or deductions_cents are provided without gross_cents, auto-derives gross_cents.
    """
    if gross_cents is None and (tax_cents is not None or deductions_cents is not None):
        gross_cents = amount_cents + (tax_cents or 0) + (deductions_cents or 0)

    if gross_cents is not None:
        if gross_cents < amount_cents:
            raise ValueError("Gross pay must be greater than or equal to net pay.")
        total_withheld = (tax_cents or 0) + (deductions_cents or 0)
        if total_withheld > (gross_cents - amount_cents):
            raise ValueError(
                "Sum of taxes and deductions cannot exceed the difference between gross and net pay."
            )

    return gross_cents, tax_cents, deductions_cents


def parse_tax_reserve_bps(val: object) -> int:
    """
    Accepts basis points (0..6000) or percentage if passed via `tax_reserve_percent`.
    Validates range 0 <= bps <= 6000 (0% to 60%).
    """
    if val is None or val == "":
        return 0
    if isinstance(val, bool):
        raise ValueError("tax_reserve_bps must be an integer between 0 and 6000")
    try:
        bps = int(val)  # type: ignore[call-overload]
    except (ValueError, TypeError) as exc:
        raise ValueError("tax_reserve_bps must be an integer between 0 and 6000") from exc
    if not (0 <= bps <= 6000):
        raise ValueError("tax_reserve_bps must be between 0 and 6000 (0% to 60%)")
    return bps

