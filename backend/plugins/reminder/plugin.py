import logging
from datetime import date

from sqlalchemy import select
from core.plugin_base import BasePlugin
from core.database import AsyncSessionLocal
from core.notifier import send_notification

logger = logging.getLogger(__name__)


class Plugin(BasePlugin):
    display = "排程提醒"
    name = "reminder"
    description = "定期排程提醒，追蹤任何需要週期性執行的事項"
    version = "1.0.0"

    def get_router(self):
        from .router import router

        return router

    def get_settings_schema(self) -> list[dict]:
        return [
            {
                "key": "notify_hour",
                "label": "每日通知時間（小時）",
                "type": "number",
                "default": "9",
                "min": 0,
                "max": 23,
                "description": "超期項目會在此時間推播 Telegram 通知",
            },
            {
                "key": "notify_minute",
                "label": "每日通知時間（分鐘）",
                "type": "select",
                "default": "0",
                "options": ["0", "15", "30", "45"],
            },
        ]

    def get_telegram_commands(self) -> list[str]:
        return ["提醒", "reminder", "提醒清單", "完成", "done"]

    def on_startup(self):
        from . import models  # noqa: F401

    def get_scheduler_jobs(self):
        return [
            {
                "func": self.daily_check,
                "trigger": "cron",
                "hour": 9,
                "minute": 0,
                "id": "reminder_daily",
                "notify_controlled": True,
            }
        ]

    async def daily_check(self):
        from .models import ReminderItem

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ReminderItem))
            items = result.scalars().all()

        overdue = [m for m in items if m.is_overdue]
        if not overdue:
            logger.info("[reminder] 今天沒有待辦提醒")
            return

        lines = []
        for m in overdue:
            ds = m.days_since
            cat = f"[{m.category}] " if m.category else ""
            if ds is None:
                lines.append(f"· {cat}{m.name}（從未完成）")
            else:
                lines.append(
                    f"· {cat}{m.name}（已 {ds} 天，建議每 {m.freq_days} 天一次）"
                )

        msg = "【排程提醒】\n\n" + "\n".join(lines)
        await send_notification(msg)
        logger.info(f"[reminder] 推播提醒：{len(overdue)} 項超期")

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        t = text.strip()
        tl = t.lower()

        if tl in ("提醒", "reminder", "提醒清單"):
            return await self._list_status()

        if tl.startswith("完成 ") or tl.startswith("done "):
            name = t.split(" ", 1)[1].strip()
            return await self._mark_done_by_name(name)

        return None

    async def _list_status(self) -> str:
        from .models import ReminderItem

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ReminderItem).order_by(ReminderItem.name))
            items = result.scalars().all()

        if not items:
            return "還沒有提醒項目，請到 Web 介面新增。"

        lines = []
        for m in items:
            ds = m.days_since
            status = "⚠️" if m.is_overdue else "✅"
            last = f"{ds}天前" if ds is not None else "從未"
            cat = f"[{m.category}] " if m.category else ""
            lines.append(f"{status} {cat}{m.name}（上次：{last}，每{m.freq_days}天）")
        return "📋 排程提醒清單\n\n" + "\n".join(lines)

    async def _mark_done_by_name(self, name: str) -> str:
        from .models import ReminderItem

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReminderItem).where(ReminderItem.name == name)
            )
            item = result.scalar_one_or_none()
            if not item:
                return f"找不到「{name}」，請確認名稱是否正確。"
            item.last_done = date.today()
            await db.commit()
        return f"✅ 已記錄完成「{name}」！"

    def get_help(self) -> str:
        return (
            "【排程提醒】\n"
            "提醒 — 查看所有提醒項目狀態\n"
            "完成 [名稱] — 標記今天已完成（例：完成 媽媽）"
        )
