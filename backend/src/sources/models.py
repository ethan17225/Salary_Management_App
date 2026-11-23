from sqlalchemy import CheckConstraint, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base
from src.sources.constants import DEFAULT_SOURCE_COLOR, PaySchedule, SourceKind


class Source(Base):
    __tablename__ = "sources"
    __table_args__ = (
        CheckConstraint("kind IN ('job', 'government', 'other')", name="kind"),
        CheckConstraint("is_tax_withheld IN (0, 1)", name="is_tax_withheld"),
        CheckConstraint(
            "tax_reserve_bps >= 0 AND tax_reserve_bps <= 6000", name="tax_reserve_bps"
        ),
        CheckConstraint(
            "pay_schedule IN ('auto', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'irregular')",
            name="pay_schedule",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text(collation="NOCASE"), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(Text, default=SourceKind.JOB.value, nullable=False)
    color: Mapped[str] = mapped_column(Text, default=DEFAULT_SOURCE_COLOR, nullable=False)
    archived: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_tax_withheld: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    tax_reserve_bps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pay_schedule: Mapped[str] = mapped_column(Text, default=PaySchedule.AUTO.value, nullable=False)


class SourceAlias(Base):
    __tablename__ = "source_aliases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    raw_name: Mapped[str] = mapped_column(Text(collation="NOCASE"), unique=True, nullable=False)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False
    )
