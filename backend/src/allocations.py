from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
import re
from typing import Any

from fastapi import APIRouter, Depends, Path, status
from pydantic import field_validator, model_validator
from sqlalchemy import CheckConstraint, Integer, Text, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from src.database import DBDep
from src.exceptions import BadRequestError, ConflictError, NotFoundError
from src.models import Base, CreatedResponse, CustomModel, OkResponse
from src.sources.constants import HEX_COLOR_PATTERN

VALID_ALLOCATION_CATEGORIES = {"essentials", "investments", "savings", "lifestyle"}

ALLOCATION_PRESETS: dict[str, list[dict[str, Any]]] = {
    "50-30-20": [
        {"name": "Essentials & Bills", "category": "essentials", "weight_bps": 5000, "color": "#3b82f6", "sort_order": 1},
        {"name": "Long-Term Investments", "category": "investments", "weight_bps": 2000, "color": "#10b981", "sort_order": 2},
        {"name": "Guilt-Free Lifestyle", "category": "lifestyle", "weight_bps": 3000, "color": "#8b5cf6", "sort_order": 3},
    ],
    "student-coop": [
        {"name": "Tuition & Rent Reserve", "category": "essentials", "weight_bps": 5000, "color": "#3b82f6", "sort_order": 1},
        {"name": "TFSA / FHSA Index Funds", "category": "investments", "weight_bps": 2500, "color": "#10b981", "sort_order": 2},
        {"name": "Emergency Buffer", "category": "savings", "weight_bps": 1000, "color": "#f59e0b", "sort_order": 3},
        {"name": "Campus & Personal Spending", "category": "lifestyle", "weight_bps": 1500, "color": "#ec4899", "sort_order": 4},
    ],
    "aggressive-saver": [
        {"name": "Index & Retirement Portfolio", "category": "investments", "weight_bps": 4500, "color": "#10b981", "sort_order": 1},
        {"name": "Fixed Living Costs", "category": "essentials", "weight_bps": 3500, "color": "#3b82f6", "sort_order": 2},
        {"name": "High-Yield Cash Reserve", "category": "savings", "weight_bps": 1000, "color": "#06b6d4", "sort_order": 3},
        {"name": "Discretionary Fun", "category": "lifestyle", "weight_bps": 1000, "color": "#8b5cf6", "sort_order": 4},
    ],
}


def parse_weight_bps(payload: dict[str, Any]) -> int:
    """
    Extracts integer basis points from `weight_bps` (int) or `percentage` (float/str).
    Validates 1 <= weight_bps <= 10000.
    """
    if "weight_bps" in payload and payload["weight_bps"] is not None:
        if isinstance(payload["weight_bps"], bool):
            raise ValueError("weight_bps must be an integer")
        try:
            bps = int(payload["weight_bps"])
        except (ValueError, TypeError) as exc:
            raise ValueError("weight_bps must be an integer") from exc
    elif "percentage" in payload and payload["percentage"] is not None:
        if isinstance(payload["percentage"], bool):
            raise ValueError("Invalid percentage value")
        try:
            pct = Decimal(str(payload["percentage"])).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            bps = int(pct * 100)
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("Invalid percentage value") from exc
    else:
        raise ValueError("Either weight_bps or percentage is required")

    if not (1 <= bps <= 10000):
        raise ValueError("Allocation weight must be between 0.01% (1 bps) and 100.00% (10000 bps)")
    return bps


def allocate_cents_largest_remainder(
    amount_cents: int,
    active_rules: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Splits `amount_cents` across `active_rules` using the Largest Remainder Method.
    Guarantees sum(b['allocated_cents'] for b in buckets) + unallocated_cents == amount_cents.
    """
    if amount_cents <= 0 or not active_rules:
        return {
            "distributable_cents": max(0, amount_cents),
            "allocated_total_cents": 0,
            "unallocated_cents": max(0, amount_cents),
            "buckets": [
                {
                    "rule_id": r["id"],
                    "name": r["name"],
                    "category": r["category"],
                    "color": r["color"],
                    "weight_bps": int(r["weight_bps"]),
                    "allocated_cents": 0,
                }
                for r in active_rules
            ],
        }

    total_bps = sum(int(r["weight_bps"]) for r in active_rules)
    if total_bps > 10000:
        raise ValueError(f"Active allocation rules sum to {total_bps} bps, exceeding 10000 bps (100%)")

    pool_cents = (amount_cents * total_bps) // 10000
    unallocated_cents = amount_cents - pool_cents

    quotients: list[int] = []
    remainders: list[tuple[int, int]] = []

    for idx, rule in enumerate(active_rules):
        w = int(rule["weight_bps"])
        q, rem = divmod(amount_cents * w, 10000)
        quotients.append(q)
        remainders.append((rem, idx))

    shortfall = pool_cents - sum(quotients)
    remainders.sort(key=lambda item: (-item[0], item[1]))
    for i in range(shortfall):
        _, target_idx = remainders[i]
        quotients[target_idx] += 1

    buckets = [
        {
            "rule_id": rule["id"],
            "name": rule["name"],
            "category": rule["category"],
            "color": rule["color"],
            "weight_bps": int(rule["weight_bps"]),
            "allocated_cents": quotients[idx],
        }
        for idx, rule in enumerate(active_rules)
    ]

    return {
        "distributable_cents": amount_cents,
        "allocated_total_cents": pool_cents,
        "unallocated_cents": unallocated_cents,
        "buckets": buckets,
    }


class AllocationRule(Base):
    __tablename__ = "allocation_rules"
    __table_args__ = (
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 50", name="name_len"),
        CheckConstraint(
            "category IN ('essentials', 'investments', 'savings', 'lifestyle')",
            name="category",
        ),
        CheckConstraint("weight_bps > 0 AND weight_bps <= 10000", name="weight_bps"),
        CheckConstraint(
            "color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'",
            name="color",
        ),
        CheckConstraint("active IN (0, 1)", name="active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text(collation="NOCASE"), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    weight_bps: Mapped[int] = mapped_column(Integer, nullable=False)
    color: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class AllocationRulePayload(CustomModel):
    name: str
    category: str
    weight_bps: int | None = None
    percentage: float | str | int | None = None
    color: str
    sort_order: int = 0
    active: int = 1

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Any) -> str:
        s = str(value or "").strip()
        if not (1 <= len(s) <= 50):
            raise ValueError("Bucket name must be between 1 and 50 characters.")
        return s

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, value: Any) -> str:
        c = str(value or "").strip()
        if c not in VALID_ALLOCATION_CATEGORIES:
            raise ValueError("Category must be essentials, investments, savings, or lifestyle.")
        return c

    @field_validator("color", mode="before")
    @classmethod
    def validate_color(cls, value: Any) -> str:
        c = str(value or "").strip()
        if not re.fullmatch(HEX_COLOR_PATTERN, c):
            raise ValueError("Colour must be a 6-digit hex code like #0d7480.")
        return c

    @field_validator("sort_order", mode="before")
    @classmethod
    def validate_sort_order(cls, value: Any) -> int:
        if value is None or value == "":
            return 0
        try:
            return int(value)
        except (ValueError, TypeError) as exc:
            raise ValueError("sort_order must be an integer") from exc

    @field_validator("active", mode="before")
    @classmethod
    def validate_active(cls, value: Any) -> int:
        if value is None:
            return 1
        return int(bool(value))

    @model_validator(mode="after")
    def resolve_weight(self) -> "AllocationRulePayload":
        self.weight_bps = parse_weight_bps(
            {"weight_bps": self.weight_bps, "percentage": self.percentage}
        )
        return self


class AllocationRuleResponse(CustomModel):
    id: int
    name: str
    category: str
    weight_bps: int
    color: str
    sort_order: int
    active: int


class AllocationsListResponse(CustomModel):
    allocations: list[AllocationRuleResponse]
    total_active_bps: int
    unallocated_bps: int


class AllocationPresetPayload(CustomModel):
    preset: str

    @field_validator("preset", mode="before")
    @classmethod
    def validate_preset(cls, value: Any) -> str:
        p = str(value or "").strip()
        if p not in ALLOCATION_PRESETS:
            raise ValueError("Invalid preset name.")
        return p


class PresetAppliedResponse(CustomModel):
    ok: bool = True
    count: int


async def list_allocations(db: AsyncSession) -> list[AllocationRule]:
    stmt = select(AllocationRule).order_by(
        AllocationRule.sort_order.asc(), AllocationRule.id.asc()
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_active_bps_sum(db: AsyncSession, exclude_id: int | None = None) -> int:
    stmt = select(func.coalesce(func.sum(AllocationRule.weight_bps), 0)).where(
        AllocationRule.active == 1
    )
    if exclude_id is not None:
        stmt = stmt.where(AllocationRule.id != exclude_id)
    res = await db.execute(stmt)
    return int(res.scalar_one() or 0)


async def valid_allocation_rule(
    db: DBDep,
    rule_id: int = Path(..., ge=1),
) -> AllocationRule:
    rule = await db.get(AllocationRule, rule_id)
    if not rule:
        raise NotFoundError()
    return rule


router = APIRouter(prefix="/api/allocations", tags=["allocations"])


@router.get("", status_code=status.HTTP_200_OK)
async def get_allocations(db: DBDep) -> AllocationsListResponse:
    rules = await list_allocations(db)
    total_active = sum(r.weight_bps for r in rules if r.active == 1)
    return AllocationsListResponse(
        allocations=[AllocationRuleResponse.model_validate(r) for r in rules],
        total_active_bps=total_active,
        unallocated_bps=max(0, 10000 - total_active),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_allocation(payload: AllocationRulePayload, db: DBDep) -> CreatedResponse:
    assert payload.weight_bps is not None
    if payload.active == 1:
        current_active = await get_active_bps_sum(db)
        if current_active + payload.weight_bps > 10000:
            raise BadRequestError("Total active allocations cannot exceed 100% (10000 bps).")

    rule = AllocationRule(
        name=payload.name,
        category=payload.category,
        weight_bps=payload.weight_bps,
        color=payload.color,
        sort_order=payload.sort_order,
        active=payload.active,
    )
    db.add(rule)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("An allocation bucket with that name already exists.") from exc
    await db.refresh(rule)
    return CreatedResponse(id=rule.id)


@router.put("/{rule_id}", status_code=status.HTTP_200_OK)
async def update_allocation(
    payload: AllocationRulePayload,
    db: DBDep,
    rule: AllocationRule = Depends(valid_allocation_rule),
) -> OkResponse:
    assert payload.weight_bps is not None
    if payload.active == 1:
        other_active = await get_active_bps_sum(db, exclude_id=rule.id)
        if other_active + payload.weight_bps > 10000:
            raise BadRequestError("Total active allocations cannot exceed 100% (10000 bps).")

    rule.name = payload.name
    rule.category = payload.category
    rule.weight_bps = payload.weight_bps
    rule.color = payload.color
    rule.sort_order = payload.sort_order
    rule.active = payload.active
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("An allocation bucket with that name already exists.") from exc
    return OkResponse()


@router.delete("/{rule_id}", status_code=status.HTTP_200_OK)
async def delete_allocation(
    db: DBDep,
    rule: AllocationRule = Depends(valid_allocation_rule),
) -> OkResponse:
    await db.delete(rule)
    await db.commit()
    return OkResponse()


@router.post("/presets", status_code=status.HTTP_200_OK)
async def apply_preset(payload: AllocationPresetPayload, db: DBDep) -> PresetAppliedResponse:
    preset_rules = ALLOCATION_PRESETS[payload.preset]
    await db.execute(delete(AllocationRule))
    for r in preset_rules:
        db.add(
            AllocationRule(
                name=r["name"],
                category=r["category"],
                weight_bps=r["weight_bps"],
                color=r["color"],
                sort_order=r["sort_order"],
                active=1,
            )
        )
    await db.commit()
    return PresetAppliedResponse(ok=True, count=len(preset_rules))
