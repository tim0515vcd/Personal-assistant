from datetime import date
from sqlalchemy import Integer, Date, String
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class CycleRecord(Base):
    __tablename__ = "cycle_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    cycle_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
