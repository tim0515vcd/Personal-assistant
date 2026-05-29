from datetime import date
from sqlalchemy import Integer, Date, Float, String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class Car(Base):
    __tablename__ = "cars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    odometer: Mapped[int] = mapped_column(Integer, nullable=False)  # km
    liters: Mapped[float] = mapped_column(Float, nullable=False)  # 公升
    cost: Mapped[int] = mapped_column(Integer, nullable=False)  # 元
    car_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("cars.id"), nullable=True)
