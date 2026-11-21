"""Structured trace collector and SQLite persistence for import pipeline telemetry."""

import json
import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.paycheques.models import ImportPipelineLog
from src.paycheques.schemas import (
    ImportPipelineLogDetail,
    ImportPipelineLogSummary,
    ParseResponse,
)

log = logging.getLogger(__name__)

# ponytail: unbounded table with capped step payloads; add retention pruning if >5k logs
MAX_TEXT_PREVIEW_CHARS = 4000
MAX_STORED_ROWS = 50
MAX_STORED_TABLES = 3


def truncate_text(text: str, limit: int = MAX_TEXT_PREVIEW_CHARS) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}... [truncated {len(text) - limit} chars]"


class PipelineTrace:
    """In-memory collector of ordered intermediate parser step outputs."""

    def __init__(self) -> None:
        self.steps: list[dict[str, Any]] = []

    def record(
        self,
        step: str,
        output: dict[str, Any],
        *,
        status: Literal["ok", "error", "skipped"] = "ok",
        duration_ms: int | None = None,
    ) -> None:
        self.steps.append(
            {
                "step": step,
                "status": status,
                "duration_ms": duration_ms,
                "output": output,
            }
        )


def compact_parse_response(resp: ParseResponse) -> dict[str, Any]:
    data = resp.model_dump(mode="json")
    rows = data.get("rows")
    if isinstance(rows, list) and len(rows) > MAX_STORED_ROWS:
        data["rows_total"] = len(rows)
        data["rows_truncated"] = True
        data["rows"] = rows[:MAX_STORED_ROWS]
    return data


def compact_submitted_rows(rows: Sequence[dict[str, Any]]) -> dict[str, Any]:
    return {
        "total_rows": len(rows),
        "truncated": len(rows) > MAX_STORED_ROWS,
        "rows": list(rows[:MAX_STORED_ROWS]),
    }


async def save_import_log(
    db: AsyncSession,
    *,
    stage: Literal["parse", "import"],
    status: Literal["ok", "error"],
    duration_ms: int,
    steps: list[dict[str, Any]] | None = None,
    response_data: dict[str, Any] | None = None,
    parse_log_id: int | None = None,
    filename: str | None = None,
    file_size_bytes: int | None = None,
    file_sha256: str | None = None,
    detected_mime: str | None = None,
    ocr_runtime: str | None = None,
    vision_model: str | None = None,
    parser_used: str | None = None,
    used_llm_fallback: bool = False,
    row_count: int = 0,
    warning_count: int = 0,
    error_message: str | None = None,
) -> int | None:
    """Persist a pipeline log row on the injected session; never raises to callers."""
    try:
        resolved_parse_log_id: int | None = None
        if parse_log_id is not None and parse_log_id > 0:
            existing = await db.execute(
                select(ImportPipelineLog.id).where(ImportPipelineLog.id == parse_log_id)
            )
            if existing.scalar_one_or_none() is not None:
                resolved_parse_log_id = parse_log_id

        entry = ImportPipelineLog(
            created_at=datetime.now(UTC).isoformat(timespec="milliseconds"),
            stage=stage,
            status=status,
            parse_log_id=resolved_parse_log_id,
            filename=filename,
            file_size_bytes=file_size_bytes,
            file_sha256=file_sha256,
            detected_mime=detected_mime,
            ocr_runtime=ocr_runtime,
            vision_model=vision_model,
            parser_used=parser_used,
            used_llm_fallback=1 if used_llm_fallback else 0,
            duration_ms=max(0, duration_ms),
            row_count=max(0, row_count),
            warning_count=max(0, warning_count),
            error_message=error_message,
            steps_json=json.dumps(steps or [], default=str, ensure_ascii=False),
            response_json=(
                json.dumps(response_data, default=str, ensure_ascii=False)
                if response_data is not None
                else None
            ),
        )
        db.add(entry)
        await db.commit()
        return entry.id
    except Exception:
        log.warning("Failed to save import pipeline log", exc_info=True)
        try:
            await db.rollback()
        except Exception:
            pass
        return None


async def list_import_logs(
    db: AsyncSession,
    *,
    limit: int = 50,
    stage: str | None = None,
    status_filter: str | None = None,
    parser_used: str | None = None,
    has_warnings: bool | None = None,
) -> list[ImportPipelineLog]:
    stmt = select(ImportPipelineLog)
    if stage is not None:
        stmt = stmt.where(ImportPipelineLog.stage == stage)
    if status_filter is not None:
        stmt = stmt.where(ImportPipelineLog.status == status_filter)
    if parser_used is not None:
        stmt = stmt.where(ImportPipelineLog.parser_used == parser_used)
    if has_warnings is True:
        stmt = stmt.where(ImportPipelineLog.warning_count > 0)
    elif has_warnings is False:
        stmt = stmt.where(ImportPipelineLog.warning_count == 0)
    stmt = stmt.order_by(ImportPipelineLog.id.desc()).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_import_log(db: AsyncSession, log_id: int) -> ImportPipelineLog | None:
    res = await db.execute(select(ImportPipelineLog).where(ImportPipelineLog.id == log_id))
    return res.scalar_one_or_none()


async def list_linked_import_ids(db: AsyncSession, parse_log_id: int) -> list[int]:
    res = await db.execute(
        select(ImportPipelineLog.id)
        .where(ImportPipelineLog.parse_log_id == parse_log_id)
        .order_by(ImportPipelineLog.id.desc())
    )
    return [row_id for (row_id,) in res.all()]


def _safe_json_loads(raw: str | None, fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except Exception:
        return fallback


def serialize_log_summary(entry: ImportPipelineLog) -> ImportPipelineLogSummary:
    steps = _safe_json_loads(entry.steps_json, [])
    step_names = (
        [str(s.get("step")) for s in steps if isinstance(s, dict) and s.get("step")]
        if isinstance(steps, list)
        else []
    )
    return ImportPipelineLogSummary(
        id=entry.id,
        created_at=entry.created_at,
        stage=entry.stage,  # type: ignore[arg-type]
        status=entry.status,  # type: ignore[arg-type]
        parse_log_id=entry.parse_log_id,
        filename=entry.filename,
        file_size_bytes=entry.file_size_bytes,
        file_sha256=entry.file_sha256,
        detected_mime=entry.detected_mime,
        ocr_runtime=entry.ocr_runtime,
        vision_model=entry.vision_model,
        parser_used=entry.parser_used,  # type: ignore[arg-type]
        used_llm_fallback=bool(entry.used_llm_fallback),
        duration_ms=entry.duration_ms,
        row_count=entry.row_count,
        warning_count=entry.warning_count,
        error_message=entry.error_message,
        step_names=step_names,
    )


def serialize_log_detail(
    entry: ImportPipelineLog, linked_import_ids: list[int] | None = None
) -> ImportPipelineLogDetail:
    summary = serialize_log_summary(entry)
    steps = _safe_json_loads(entry.steps_json, [])
    response = _safe_json_loads(entry.response_json, None)
    return ImportPipelineLogDetail(
        **summary.model_dump(),
        steps=steps if isinstance(steps, list) else [],
        response=response if isinstance(response, dict) else None,
        linked_import_ids=linked_import_ids or [],
    )
