from typing import Any

from pydantic import field_validator

from src.allocations import AllocationRuleResponse
from src.models import CustomModel
from src.paycheques.schemas import PaychequeResponse
from src.paycheques.utils import parse_cents
from src.sources.schemas import SourceResponse


class GoalUpdate(CustomModel):
    goal: int | None = None

    @field_validator("goal", mode="before")
    @classmethod
    def validate_goal(cls, value: Any) -> int | None:
        return parse_cents(value, "Goal", required=False)


class StateResponse(CustomModel):
    sources: list[SourceResponse]
    paycheques: list[PaychequeResponse]
    settings: dict[str, str]
    allocations: list[AllocationRuleResponse] = []
    forecast: dict[str, Any] | None = None

