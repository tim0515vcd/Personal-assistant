import logging
from datetime import date, timedelta

from sqlalchemy import select, func, text
from core.plugin_base import BasePlugin
from core.database import AsyncSessionLocal, engine
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

    async def on_tables_ready(self):
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE reminder_items "
                "ADD COLUMN IF NOT EXISTS target_count INTEGER NOT NULL DEFAULT 1"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS reminder_logs (
                    id SERIAL PRIMARY KEY,
                    item_id INTEGER NOT NULL
                        REFERENCES reminder_items(id) ON DELETE CASCADE,
                    done_date DATE NOT NULL
                )
            """))
            # Migrate existing last_done → one log entry per item (only once)
            await conn.execute(text("""
                INSERT INTO reminder_logs (item_id, done_date)
                SELECT id, last_done FROM reminder_items
                WHERE last_done IS NOT NULL
                  AND id NOT IN (SELECT DISTINCT item_id FROM reminder_logs)
            """))

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

    async def _count_in_window(self, db, item_id: int, freq_days: int) -> int:
        from .models import ReminderLog

        since = date.today() - timedelta(days=freq_days - 1)
        result = await db.execute(
            select(func.count()).select_from(ReminderLog).where(
                ReminderLog.item_id == item_id,
                ReminderLog.done_date >= since,
            )
        )
        return result.scalar() or 0

    async def daily_check(self):
        from .models import ReminderItem

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ReminderItem))
            items = result.scalars().all()

            overdue = []
            for m in items:
                cc = await self._count_in_window(db, m.id, m.freq_days)
                if cc < m.target_count:
                    overdue.append((m, cc))

        if not overdue:
            logger.info("[reminder] 今天沒有待辦提醒")
            return

        lines = []
        for m, cc in overdue:
            cat = f"[{m.category}] " if m.category else ""
            if m.target_count > 1:
                lines.append(f"· {cat}{m.name}（{cc}/{m.target_count} 次，每 {m.freq_days} 天）")
            else:
                ds = m.days_since
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
                cc = await self._count_in_window(db, m.id, m.freq_days)
                is_overdue = cc < m.target_count
                status = "⚠️" if is_overdue else "✅"
                cat = f"[{m.category}] " if m.category else ""
                if m.target_count > 1:
                    lines.append(
                        f"{status} {cat}{m.name}（{cc}/{m.target_count} 次，每{m.freq_days}天）"
                    )
                else:
                    ds = m.days_since
                    last = f"{ds}天前" if ds is not None else "從未"
                    lines.append(
                        f"{status} {cat}{m.name}（上次：{last}，每{m.freq_days}天）"
                    )

        return "📋 排程提醒清單\n\n" + "\n".join(lines)

    async def _mark_done_by_name(self, name: str) -> str:
        from .models import ReminderItem, ReminderLog

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ReminderItem).where(ReminderItem.name == name)
            )
            item = result.scalar_one_or_none()
            if not item:
                return f"找不到「{name}」，請確認名稱是否正確。"
            today = date.today()
            item.last_done = today
            db.add(ReminderLog(item_id=item.id, done_date=today))
            await db.commit()

            cc = await self._count_in_window(db, item.id, item.freq_days)

        if item.target_count > 1:
            return f"✅ 已記錄完成「{name}」！（{cc}/{item.target_count} 次）"
        return f"✅ 已記錄完成「{name}」！"

    def get_help(self) -> str:
        return (
            "【排程提醒】\n"
            "提醒 — 查看所有提醒項目狀態\n"
            "完成 [名稱] — 標記今天已完成（例：完成 媽媽）"
        )
