from fastapi import APIRouter, status

from src.database import DBDep
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

