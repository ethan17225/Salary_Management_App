import re
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response, UploadFile, status

from src.database import DBDep
from src.exceptions import BadRequestError
from src.models import CreatedResponse, ErrorResponse, OkResponse
from src.paycheques import service
from src.paycheques.constants import MAX_UPLOAD_BYTES
from src.paycheques.dependencies import ValidPaychequeDep
from src.paycheques.exceptions import FileTooLarge
from src.paycheques.parsers import parse_upload
from src.paycheques.schemas import (
    ParseResponse,
    PaychequeCreate,
    PaychequeImportPayload,
    PaychequeImportResponse,
    PaychequeResponse,
    PaychequeUpdate,
)

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


@router.post(
    "/import",
    status_code=status.HTTP_200_OK,
    summary="Bulk import paycheques from CSV",
    description=(
        "Parses CSV text or rows, deduplicates idempotently via SHA-256 import hash, "
        "and commits valid records atomically."
    ),
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Invalid import payload",
        },
    },
)
async def import_paycheques(
    payload: PaychequeImportPayload,
    db: DBDep,
) -> PaychequeImportResponse:
    return await service.import_paycheques_batch(db, payload)


@router.post(
    "/parse",
    status_code=status.HTTP_200_OK,
    summary="Parse an uploaded paystub or spreadsheet",
    description=(
        "Reads CSV, TSV, XLSX, PDF, or image files into candidate rows for review. "
        "Saves nothing; commit reviewed rows via POST /api/paycheques/import."
    ),
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ErrorResponse, "description": "Unreadable file"},
        status.HTTP_413_CONTENT_TOO_LARGE: {"model": ErrorResponse},
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: {"model": ErrorResponse},
    },
)
async def parse_paycheque_file(file: UploadFile) -> ParseResponse:
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise FileTooLarge()
    if not content:
        raise BadRequestError("The file is empty.")
    return await parse_upload(content, file.filename or "upload")


@export_router.get(
    "/export.csv",
    status_code=status.HTTP_200_OK,
    summary="Export paycheques as CSV",
    description="Streams paycheques joined with their source name in CSV format.",
)
async def export_paycheques_csv(
    db: DBDep,
    year: Annotated[str | None, Query()] = None,
    source_id: Annotated[int | None, Query(ge=1)] = None,
    q: Annotated[str | None, Query()] = None,
) -> Response:
    year_slug = f"-{year}" if year and re.fullmatch(r"\d{4}", year) else ""
    filename = f"paycheques{year_slug}-{date.today().isoformat()}.csv"
    return Response(
        content=await service.build_export_csv(db, year=year, source_id=source_id, q=q),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
