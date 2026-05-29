from datetime import date
from sqlalchemy import String, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class ReminderItem(Base):
    __tablename__ = "reminder_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    freq_days: Mapped[int] = mapped_column(Integer, default=7)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_done: Mapped[date | None] = mapped_column(Date, nullable=True)

    @property
    def days_since(self) -> int | None:
        if self.last_done is None:
            return None
        return (date.today() - self.last_done).days

    @property
    def is_overdue(self) -> bool:
        ds = self.days_since
        return ds is None or ds >= self.freq_days
