import logging
from datetime import date

from sqlalchemy import select, text
from core.plugin_base import BasePlugin
from core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class Plugin(BasePlugin):
    display = "油耗記錄"
    name = "fuel"
    description = "油耗記錄與計算，追蹤每次加油與平均油耗"
    version = "1.0.0"

    def get_router(self):
        from .router import router
        return router

    def get_telegram_commands(self) -> list[str]:
        return ["油耗", "fuel", "加油記錄", "加油"]

    def on_startup(self):
        from . import models  # noqa: F401

    async def on_tables_ready(self) -> None:
        from .models import Car

        async with AsyncSessionLocal() as db:
            # Idempotent migration: add car_id column if not exists
            await db.execute(text(
                "ALTER TABLE fuel_records ADD COLUMN IF NOT EXISTS "
                "car_id INTEGER REFERENCES cars(id)"
            ))
            await db.commit()

            # Ensure at least one car exists
            result = await db.execute(select(Car))
            cars = result.scalars().all()
            if not cars:
                default_car = Car(name="我的車", is_default=True)
                db.add(default_car)
                await db.flush()
                await db.execute(
                    text("UPDATE fuel_records SET car_id = :id WHERE car_id IS NULL"),
                    {"id": default_car.id},
                )
                await db.commit()
            else:
                # Backfill any records still missing car_id
                result2 = await db.execute(select(Car).where(Car.is_default.is_(True)).limit(1))
                default_car = result2.scalar_one_or_none() or cars[0]
                await db.execute(
                    text("UPDATE fuel_records SET car_id = :id WHERE car_id IS NULL"),
                    {"id": default_car.id},
                )
                await db.commit()

    def get_help(self) -> str:
        return (
            "【油耗記錄】\n"
            "油耗 — 查看最近加油記錄與平均油耗\n"
            "加油 [里程] [公升] [油錢] — 新增記錄（例：加油 12500 40 1800）"
        )

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        t = text.strip()
        tl = t.lower()

        if tl in ("油耗", "fuel", "加油記錄"):
            return await self._list_stats()

        if tl.startswith("加油 ") or tl.startswith("fuel "):
            parts = t.split()
            if len(parts) == 4:
                try:
                    odometer = int(parts[1])
                    liters = float(parts[2])
                    cost = int(parts[3])
                    return await self._add_record(odometer, liters, cost)
                except ValueError:
                    return "格式錯誤，請用：加油 [里程] [公升] [油錢]\n例：加油 12500 40 1800"
            return "格式錯誤，請用：加油 [里程] [公升] [油錢]\n例：加油 12500 40 1800"

        return None

    async def _add_record(self, odometer: int, liters: float, cost: int) -> str:
        from .models import Car, FuelRecord

        async with AsyncSessionLocal() as db:
            # Use default car
            result = await db.execute(select(Car).where(Car.is_default.is_(True)).limit(1))
            car = result.scalar_one_or_none()
            if not car:
                result2 = await db.execute(select(Car).limit(1))
                car = result2.scalar_one_or_none()
            car_id = car.id if car else None

            prev_result = await db.execute(
                select(FuelRecord)
                .where(FuelRecord.car_id == car_id)
                .order_by(FuelRecord.odometer.desc())
                .limit(1)
            )
            prev = prev_result.scalar_one_or_none()

            record = FuelRecord(
                date=date.today(), odometer=odometer, liters=liters,
                cost=cost, car_id=car_id,
            )
            db.add(record)
            await db.commit()

        car_name = f"（{car.name}）" if car else ""
        lines = [f"已記錄加油{car_name}\n里程：{odometer:,} km\n油量：{liters} L，油錢：${cost:,}"]
        if prev and odometer > prev.odometer:
            distance = odometer - prev.odometer
            eff = round(distance / liters, 1)
            lines.append(f"距離上次：{distance:,} km\n油耗：{eff} km/L")
        return "\n".join(lines)

    async def _list_stats(self) -> str:
        from .models import Car, FuelRecord

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Car).where(Car.is_default.is_(True)).limit(1))
            car = result.scalar_one_or_none()
            if not car:
                result2 = await db.execute(select(Car).limit(1))
                car = result2.scalar_one_or_none()

            if car:
                records_result = await db.execute(
                    select(FuelRecord)
                    .where(FuelRecord.car_id == car.id)
                    .order_by(FuelRecord.odometer)
                )
            else:
                records_result = await db.execute(
                    select(FuelRecord).order_by(FuelRecord.odometer)
                )
            records = records_result.scalars().all()

        if not records:
            return "還沒有加油記錄。\n指令：加油 [里程] [公升] [油錢]"

        car_label = f"【{car.name}】" if car else ""
        efficiencies = []
        rows = []
        for i, r in enumerate(records):
            prev = records[i - 1] if i > 0 else None
            if prev and r.odometer > prev.odometer:
                distance = r.odometer - prev.odometer
                eff = round(distance / r.liters, 1)
                efficiencies.append(eff)
                eff_str = f"{eff} km/L"
            else:
                eff_str = "—"
            rows.append(
                f"{r.date.strftime('%m/%d')}  {r.odometer:,}km  {r.liters}L  {eff_str}  ${r.cost:,}"
            )

        recent = rows[max(0, len(rows) - 5):]
        summary = f"油耗記錄{car_label}（最近 5 次）\n\n" + "\n".join(recent)
        if efficiencies:
            avg = round(sum(efficiencies) / len(efficiencies), 1)
            summary += f"\n\n平均油耗：{avg} km/L\n共 {len(records)} 次記錄"
        return summary
