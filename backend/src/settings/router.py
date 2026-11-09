from datetime import date
from typing import Any

from fastapi import APIRouter, Query, status

from src.database import DBDep
from src.exceptions import BadRequestError
from src.models import ErrorResponse, OkResponse
from src.settings import service
from src.settings.schemas import GoalUpdate, StateResponse

router = APIRouter(
    prefix="/api",
    tags=["settings"],
)


@router.get(
    "/state",
    status_code=status.HTTP_200_OK,
    summary="Get full application state",
    description="Returns all sources, paycheques, and settings in a single snapshot.",
)
async def get_state(db: DBDep) -> StateResponse:
    return await service.get_full_state(db)


@router.get(
    "/forecast",
    status_code=status.HTTP_200_OK,
    summary="Get schedule-aware income forecast",
    description="Computes deterministic schedule-aware year-end income projections and goal crossover date.",
)
async def get_forecast(
    db: DBDep,
    ref_date: str | None = Query(default=None, alias="date"),
) -> dict[str, Any]:
    parsed_date: date | None = None
    if ref_date:
        try:
            parsed_date = date.fromisoformat(ref_date.strip())
        except ValueError as exc:
            raise BadRequestError("date must be a valid YYYY-MM-DD date") from exc
    return await service.get_forecast_payload(db, parsed_date)


@router.put(
    "/settings",
    status_code=status.HTTP_200_OK,
    summary="Update annual income goal",
    description="Sets or clears the annual income goal in cents.",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Validation error",
        },
    },
)
async def update_settings(payload: GoalUpdate, db: DBDep) -> OkResponse:
    await service.update_goal(db, payload)
    return OkResponse()

