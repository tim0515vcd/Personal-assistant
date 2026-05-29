from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base, AsyncSessionLocal


class Setting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(1000), nullable=False, default="")


async def get_setting(key: str, default: str = "") -> str:
    async with AsyncSessionLocal() as db:
        row = await db.get(Setting, key)
        return row.value if row else default
