from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class Paycheque(Base):
    __tablename__ = "paycheques"
    __table_args__ = (
        CheckConstraint("date(paid_on) = paid_on", name="paid_on"),
        CheckConstraint("amount_cents > 0", name="amount_cents"),
        CheckConstraint("gross_cents IS NULL OR gross_cents >= amount_cents", name="gross_cents"),
        CheckConstraint("tax_cents IS NULL OR tax_cents >= 0", name="tax_cents"),
        CheckConstraint(
            "deductions_cents IS NULL OR deductions_cents >= 0", name="deductions_cents"
        ),
        CheckConstraint("hours IS NULL OR hours > 0", name="hours"),
        Index("paycheques_paid_on", "paid_on"),
        Index("paycheques_source_id_paid_on", "source_id", "paid_on"),
        Index(
            "idx_paycheques_import_hash",
            "import_hash",
            unique=True,
            sqlite_where=text("import_hash IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="RESTRICT"), nullable=False
    )
    paid_on: Mapped[str] = mapped_column(Text, nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    gross_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tax_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deductions_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    import_hash: Mapped[str | None] = mapped_column(Text, nullable=True)


class ImportPipelineLog(Base):
    __tablename__ = "import_pipeline_logs"
    __table_args__ = (
        CheckConstraint("stage IN ('parse', 'import')", name="import_log_stage"),
        CheckConstraint("status IN ('ok', 'error')", name="import_log_status"),
        CheckConstraint(
            "file_size_bytes IS NULL OR file_size_bytes >= 0", name="import_log_file_size"
        ),
        CheckConstraint(
            "parser_used IS NULL OR parser_used IN ('tabular', 'pdf_text', 'vision', 'ocr')",
            name="import_log_parser_used",
        ),
        CheckConstraint("used_llm_fallback IN (0, 1)", name="import_log_used_llm"),
        CheckConstraint("duration_ms >= 0", name="import_log_duration_ms"),
        CheckConstraint("row_count >= 0", name="import_log_row_count"),
        CheckConstraint("warning_count >= 0", name="import_log_warning_count"),
        Index("idx_import_pipeline_logs_created_at", "created_at"),
        Index("idx_import_pipeline_logs_stage_status", "stage", "status"),
        Index(
            "idx_import_pipeline_logs_parse_log_id",
            "parse_log_id",
            sqlite_where=text("parse_log_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    stage: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    parse_log_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("import_pipeline_logs.id", ondelete="SET NULL"), nullable=True
    )
    filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_sha256: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_mime: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_runtime: Mapped[str | None] = mapped_column(Text, nullable=True)
    vision_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    parser_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    used_llm_fallback: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    warning_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    response_json: Mapped[str | None] = mapped_column(Text, nullable=True)
