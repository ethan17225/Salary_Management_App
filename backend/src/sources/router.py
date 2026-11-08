from fastapi import APIRouter, status

from src.database import DBDep
from src.models import CreatedResponse, ErrorResponse, OkResponse
from src.sources import service
from src.sources.dependencies import ValidSourceDep
from src.sources.schemas import SourceCreate, SourceResponse, SourceUpdate

router = APIRouter(
    prefix="/api/sources",
    tags=["sources"],
)


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List income sources",
    description="Returns all income sources ordered by archived flag and name.",
)
async def list_sources(db: DBDep) -> list[SourceResponse]:
    sources = await service.list_sources(db)
    return [SourceResponse.model_validate(s) for s in sources]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create an income source",
    description="Creates a new income source with unique case-insensitive name.",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Validation error",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Source name already exists",
        },
    },
)
async def create_source(payload: SourceCreate, db: DBDep) -> CreatedResponse:
    source = await service.create_source(db, payload)
    return CreatedResponse(id=source.id)


@router.put(
    "/{source_id}",
    status_code=status.HTTP_200_OK,
    summary="Update an income source",
    description="Updates an existing income source by ID.",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Validation error",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Source not found",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Source name already exists",
        },
    },
)
async def update_source(
    source: ValidSourceDep,
    payload: SourceUpdate,
    db: DBDep,
) -> OkResponse:
    await service.update_source(db, source, payload)
    return OkResponse()


@router.delete(
    "/{source_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an income source",
    description="Deletes an income source if it has no associated paycheques.",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Source not found",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Source has paycheques and cannot be deleted",
        },
    },
)
async def delete_source(source: ValidSourceDep, db: DBDep) -> OkResponse:
    await service.delete_source(db, source)
    return OkResponse()

