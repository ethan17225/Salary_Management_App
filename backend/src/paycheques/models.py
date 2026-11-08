from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class Paycheque(Base):
    __tablename__ = "paycheques"
    __table_args__ = (
        CheckConstraint("date(paid_on) = paid_on", name="paid_on"),
        CheckConstraint("amount_cents > 0", name="amount_cents"),
        CheckConstraint("hours IS NULL OR hours > 0", name="hours"),
        Index("paycheques_paid_on", "paid_on"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="RESTRICT"), nullable=False
    )
    paid_on: Mapped[str] = mapped_column(Text, nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)

