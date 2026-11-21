import hashlib
import re
import time
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, UploadFile, status
from sqlalchemy import select

from src.config import settings
from src.database import DBDep
from src.exceptions import BadRequestError, NotFoundError
from src.models import CreatedResponse, ErrorResponse, OkResponse
from src.paycheques import import_logs, service
from src.paycheques.constants import MAX_UPLOAD_BYTES
from src.paycheques.dependencies import ValidPaychequeDep
from src.paycheques.exceptions import FileTooLarge
from src.paycheques.import_logs import PipelineTrace
from src.paycheques.parsers import detect_mime, parse_upload
from src.paycheques.schemas import (
    ImportPipelineLogDetail,
    ImportPipelineLogSummary,
    ParseResponse,
    PaychequeCreate,
    PaychequeImportPayload,
    PaychequeImportResponse,
    PaychequeResponse,
    PaychequeUpdate,
)
from src.sources.models import Source

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
    t0 = time.monotonic()
    step_output: dict[str, object] = {
        "input_mode": "csv_text" if payload.csv_text is not None else "rows",
        "auto_create_sources": payload.auto_create_sources,
    }
    if payload.rows is not None:
        step_output["submitted_rows"] = import_logs.compact_submitted_rows(payload.rows)
    elif payload.csv_text is not None:
        step_output["csv_chars"] = len(payload.csv_text)

    try:
        result = await service.import_paycheques_batch(db, payload)
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        await import_logs.save_import_log(
            db,
            stage="import",
            status="ok",
            duration_ms=elapsed_ms,
            parse_log_id=payload.parse_log_id,
            row_count=result.imported_count + result.skipped_duplicates + result.error_count,
            warning_count=result.error_count,
            steps=[
                {
                    "step": "import_commit",
                    "status": "ok",
                    "duration_ms": elapsed_ms,
                    "output": step_output,
                }
            ],
            response_data=result.model_dump(mode="json"),
        )
        return result
    except Exception as exc:
        await db.rollback()
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        await import_logs.save_import_log(
            db,
            stage="import",
            status="error",
            duration_ms=elapsed_ms,
            parse_log_id=payload.parse_log_id,
            error_message=getattr(exc, "detail", None) or str(exc),
            steps=[
                {
                    "step": "import_commit",
                    "status": "error",
                    "duration_ms": elapsed_ms,
                    "output": step_output,
                }
            ],
        )
        raise


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
async def parse_paycheque_file(file: UploadFile, db: DBDep) -> ParseResponse:
    t0 = time.monotonic()
    trace = PipelineTrace()
    filename = file.filename or "upload"
    ocr_runtime = settings.OCR_RUNTIME
    vision_model = settings.VISION_MODEL_NAME if settings.effective_vision_base_url else None

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        err = FileTooLarge()
        await import_logs.save_import_log(
            db,
            stage="parse",
            status="error",
            duration_ms=int((time.monotonic() - t0) * 1000),
            filename=filename,
            file_size_bytes=len(content),
            ocr_runtime=ocr_runtime,
            vision_model=vision_model,
            error_message=err.detail,
        )
        raise err
    if not content:
        err_empty = BadRequestError("The file is empty.")
        await import_logs.save_import_log(
            db,
            stage="parse",
            status="error",
            duration_ms=int((time.monotonic() - t0) * 1000),
            filename=filename,
            file_size_bytes=0,
            ocr_runtime=ocr_runtime,
            vision_model=vision_model,
            error_message=err_empty.detail,
        )
        raise err_empty

    file_sha256 = hashlib.sha256(content).hexdigest()
    try:
        res = await db.execute(select(Source.name))
        source_names = [name for (name,) in res.all()]
        result = await parse_upload(content, filename, known_sources=source_names, trace=trace)
        log_id = await import_logs.save_import_log(
            db,
            stage="parse",
            status="ok",
            duration_ms=int((time.monotonic() - t0) * 1000),
            filename=filename,
            file_size_bytes=len(content),
            file_sha256=file_sha256,
            detected_mime=result.detected_mime,
            ocr_runtime=ocr_runtime,
            vision_model=vision_model,
            parser_used=result.parser_used,
            used_llm_fallback=result.used_llm_fallback,
            row_count=len(result.rows),
            warning_count=sum(len(r.warnings) for r in result.rows),
            steps=trace.steps,
            response_data=import_logs.compact_parse_response(result),
        )
        result.parse_log_id = log_id
        return result
    except Exception as exc:
        await db.rollback()
        await import_logs.save_import_log(
            db,
            stage="parse",
            status="error",
            duration_ms=int((time.monotonic() - t0) * 1000),
            filename=filename,
            file_size_bytes=len(content),
            file_sha256=file_sha256,
            detected_mime=detect_mime(content, filename),
            ocr_runtime=ocr_runtime,
            vision_model=vision_model,
            error_message=getattr(exc, "detail", None) or str(exc),
            steps=trace.steps,
        )
        raise


@router.get(
    "/import-logs",
    status_code=status.HTTP_200_OK,
    summary="List import pipeline logs",
    description="Returns recent paycheque parse and import telemetry logs.",
)
async def list_import_pipeline_logs(
    db: DBDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    stage: Annotated[Literal["parse", "import"] | None, Query()] = None,
    status_filter: Annotated[Literal["ok", "error"] | None, Query(alias="status")] = None,
    parser_used: Annotated[Literal["tabular", "pdf_text", "vision", "ocr"] | None, Query()] = None,
    has_warnings: Annotated[bool | None, Query()] = None,
) -> list[ImportPipelineLogSummary]:
    entries = await import_logs.list_import_logs(
        db,
        limit=limit,
        stage=stage,
        status_filter=status_filter,
        parser_used=parser_used,
        has_warnings=has_warnings,
    )
    return [import_logs.serialize_log_summary(entry) for entry in entries]


@router.get(
    "/import-logs/{log_id}",
    status_code=status.HTTP_200_OK,
    summary="Get import pipeline log detail",
    description="Returns step-by-step parser telemetry and linked import commits for a log entry.",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Import log not found",
        },
    },
)
async def get_import_pipeline_log(log_id: int, db: DBDep) -> ImportPipelineLogDetail:
    entry = await import_logs.get_import_log(db, log_id)
    if entry is None:
        raise NotFoundError("Import log not found.")
    linked = await import_logs.list_linked_import_ids(db, log_id)
    return import_logs.serialize_log_detail(entry, linked_import_ids=linked)


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
