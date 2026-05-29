import logging
from datetime import date, timedelta

from sqlalchemy import select
from core.plugin_base import BasePlugin
from core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class Plugin(BasePlugin):
    display = "排卵期計算"
    name = "cycle"
    description = "月經週期追蹤與排卵期預測"
    version = "1.0.0"

    def get_router(self):
        from .router import router
        return router

    def get_telegram_commands(self) -> list[str]:
        return ["來了", "period", "週期", "cycle", "歷史", "history"]

    def on_startup(self):
        from . import models  # noqa: F401

    def get_settings_schema(self) -> list[dict]:
        return [
            {
                "key": "cycle_default_length",
                "label": "預設週期天數",
                "type": "number",
                "default": "28",
                "min": 21,
                "max": 45,
                "description": "尚無記錄時使用的預設週期天數",
            },
            {
                "key": "period_default_length",
                "label": "月經天數",
                "type": "number",
                "default": "8",
                "min": 1,
                "max": 14,
                "description": "月經持續天數，用於在日曆標示經期範圍",
            },
        ]

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        t = text.strip()
        tl = t.lower()

        if tl in ("來了", "period"):
            return await self._log_today()
        if tl in ("週期", "cycle"):
            return await self._show_forecast()
        if tl in ("歷史", "history"):
            return await self._show_history()
        return None

    async def _log_today(self) -> str:
        from .models import CycleRecord
        async with AsyncSessionLocal() as db:
            db.add(CycleRecord(start_date=date.today()))
            await db.commit()
        return f"✅ 已記錄月經開始日：{date.today().strftime('%Y/%m/%d')}"

    async def _show_forecast(self) -> str:
        from .models import CycleRecord
        from core.settings_service import get_setting

        default_cycle = int(await get_setting("cycle_default_length", "28"))

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(CycleRecord).order_by(CycleRecord.start_date))
            records = result.scalars().all()

        if not records:
            return "還沒有月經記錄，發送「來了」可以記錄今天。"

        lengths = []
        for i in range(len(records) - 1):
            if records[i].cycle_length is not None:
                lengths.append(records[i].cycle_length)
            else:
                delta = (records[i + 1].start_date - records[i].start_date).days
                if 15 <= delta <= 60:
                    lengths.append(delta)

        avg = round(sum(lengths) / len(lengths)) if lengths else default_cycle

        last = records[-1]
        today = date.today()
        current_day = (today - last.start_date).days + 1
        next_period = last.start_date + timedelta(days=avg)
        ovulation = last.start_date + timedelta(days=avg - 14)
        fertile_start = ovulation - timedelta(days=5)
        fertile_end = ovulation + timedelta(days=1)

        def days_label(d: date) -> str:
            diff = (d - today).days
            if diff == 0:
                return "今天"
            if diff > 0:
                return f"{diff} 天後"
            return f"已過 {abs(diff)} 天"

        return (
            f"📅 週期預測（平均 {avg} 天）\n\n"
            f"今天是第 {current_day} 天\n"
            f"🌸 排卵日：{ovulation.strftime('%m/%d')}（{days_label(ovulation)}）\n"
            f"🟢 易孕期：{fertile_start.strftime('%m/%d')} ~ {fertile_end.strftime('%m/%d')}\n"
            f"🔴 下次預計：{next_period.strftime('%m/%d')}（{days_label(next_period)}）"
        )

    async def _show_history(self) -> str:
        from .models import CycleRecord
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CycleRecord).order_by(CycleRecord.start_date.desc()).limit(5)
            )
            records = result.scalars().all()

        if not records:
            return "還沒有月經記錄。"

        lines = ["📋 最近記錄"]
        for r in records:
            cyc = f"（{r.cycle_length}天）" if r.cycle_length else ""
            note = f"　{r.notes}" if r.notes else ""
            lines.append(f"· {r.start_date.strftime('%Y/%m/%d')}{cyc}{note}")
        return "\n".join(lines)

    def get_help(self) -> str:
        return (
            "【排卵期計算】\n"
            "來了 — 記錄今天為月經開始日\n"
            "週期 — 查看排卵日與易孕期預測\n"
            "歷史 — 最近 5 次記錄"
        )
