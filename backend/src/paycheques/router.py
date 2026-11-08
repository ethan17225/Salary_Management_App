from collections.abc import AsyncIterator, Mapping
from datetime import date

from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse

from src.database import DBDep
from src.models import CreatedResponse, ErrorResponse, OkResponse
from src.paycheques import service
from src.paycheques.dependencies import ValidPaychequeDep
from src.paycheques.schemas import PaychequeCreate, PaychequeResponse, PaychequeUpdate


class CSVStreamingResponse(StreamingResponse):
    media_type = "text/csv; charset=utf-8"

    def init_headers(self, headers: Mapping[str, str] | None = None) -> None:
        filename = f"paycheques-{date.today().isoformat()}.csv"
        merged = dict(headers or {})
        merged.setdefault("Content-Disposition", f'attachment; filename="{filename}"')
        super().init_headers(merged)


router = APIRouter(
    prefix="/api/paycheques",
    tags=["paycheques"],
)

export_router = APIRouter(
    prefix="/api",
    tags=["paycheques"],
)


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List paycheques",
    description="Returns all paycheques ordered by payment date descending.",
)
async def list_paycheques(db: DBDep) -> list[PaychequeResponse]:
    paycheques = await service.list_paycheques(db)
    return [PaychequeResponse.model_validate(p) for p in paycheques]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a paycheque",
    description="Records a new paycheque for an existing income source.",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Validation error",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Referenced source does not exist",
        },
    },
)
async def create_paycheque(
    payload: PaychequeCreate,
    db: DBDep,
) -> CreatedResponse:
    paycheque = await service.create_paycheque(db, payload)
    return CreatedResponse(id=paycheque.id)


@router.put(
    "/{paycheque_id}",
    status_code=status.HTTP_200_OK,
    summary="Update a paycheque",
    description="Updates an existing paycheque by ID.",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Validation error",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Paycheque not found",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Referenced source does not exist",
        },
    },
)
async def update_paycheque(
    paycheque: ValidPaychequeDep,
    payload: PaychequeUpdate,
    db: DBDep,
) -> OkResponse:
    await service.update_paycheque(db, paycheque, payload)
    return OkResponse()


@router.delete(
    "/{paycheque_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a paycheque",
    description="Deletes an existing paycheque by ID.",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Paycheque not found",
        },
    },
)
async def delete_paycheque(
    paycheque: ValidPaychequeDep,
    db: DBDep,
) -> OkResponse:
    await service.delete_paycheque(db, paycheque)
    return OkResponse()


@export_router.get(
    "/export.csv",
    response_class=CSVStreamingResponse,
    status_code=status.HTTP_200_OK,
    summary="Export paycheques as CSV",
    description="Streams all paycheques joined with their source name in CSV format.",
)
async def export_paycheques_csv(db: DBDep) -> AsyncIterator[bytes]:
    yield await service.build_export_csv(db)
