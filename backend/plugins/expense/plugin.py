import logging
from datetime import date

from sqlalchemy import select, func
from core.plugin_base import BasePlugin
from core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

USAGE = "格式錯誤，請用：記 [金額] [分類] [帳戶] [備註]\n例：記 70 吃午餐 台新 跟同事"


class Plugin(BasePlugin):
    display = "記帳"
    name = "expense"
    description = "日常支出記錄，分類統計與 Excel 匯入匯出"
    version = "1.0.0"

    def get_router(self):
        from .router import router
        return router

    def get_telegram_commands(self) -> list[str]:
        return ["記", "記帳", "本月", "刪記帳"]

    def on_startup(self):
        from . import models  # noqa: F401

    def get_help(self) -> str:
        return (
            "【記帳】\n"
            "記 [金額] [分類] [帳戶] [備註] — 新增支出（例：記 70 吃午餐）\n"
            "記帳 — 查看最近 5 筆\n"
            "本月 — 本月支出統計\n"
            "刪記帳 — 刪除最後一筆"
        )

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        t = text.strip()

        if t == "記帳":
            return await self._recent()
        if t == "本月":
            return await self._month_summary()
        if t == "刪記帳":
            return await self._delete_last()
        if t.startswith("記 "):
            parts = t.split()
            if len(parts) < 3:
                return USAGE
            try:
                amount = round(float(parts[1]))
            except ValueError:
                return USAGE
            category = parts[2]
            rest = parts[3:]
            account_name = None
            if rest:
                names = await self._all_account_names()
                if rest[0] in names:
                    account_name = rest[0]
                    rest = rest[1:]
            note = " ".join(rest) or None
            return await self._add(amount, category, account_name, note)

        return None

    async def _all_account_names(self) -> set[str]:
        from .models import ExpenseAccount

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ExpenseAccount.name))
            return set(result.scalars().all())

    async def _add(self, amount: int, category: str, account_name: str | None, note: str | None) -> str:
        from .models import ExpenseAccount, ExpenseRecord
        from .router import _get_or_create_default_account, _month_range

        async with AsyncSessionLocal() as db:
            if account_name:
                result = await db.execute(
                    select(ExpenseAccount).where(ExpenseAccount.name == account_name).limit(1)
                )
                account = result.scalar_one()
            else:
                account = await _get_or_create_default_account(db)

            record = ExpenseRecord(
                date=date.today(), amount=amount, category=category,
                note=note, account_id=account.id,
            )
            db.add(record)
            await db.commit()

            today = date.today()
            start, end = _month_range(today.year, today.month)
            month_total = await db.scalar(
                select(func.coalesce(func.sum(ExpenseRecord.amount), 0))
                .where(ExpenseRecord.date >= start, ExpenseRecord.date < end)
            )

        lines = [f"已記帳：${amount:,} {category}（{account.name}）"]
        if note:
            lines.append(f"備註:{note}")
        lines.append(f"本月累計:${month_total:,}")
        return "\n".join(lines)

    async def _recent(self) -> str:
        from .models import ExpenseAccount, ExpenseRecord

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ExpenseRecord)
                .order_by(ExpenseRecord.date.desc(), ExpenseRecord.id.desc())
                .limit(5)
            )
            records = result.scalars().all()
            names_result = await db.execute(select(ExpenseAccount))
            names = {a.id: a.name for a in names_result.scalars().all()}

        if not records:
            return "還沒有記帳記錄。\n指令：記 [金額] [分類]（例：記 70 吃午餐）"

        rows = []
        for r in records:
            parts = [r.date.strftime("%m/%d"), f"${r.amount:,}", r.category or "（未分類）"]
            if r.account_id and r.account_id in names:
                parts.append(names[r.account_id])
            if r.note:
                parts.append(r.note)
            rows.append("  ".join(parts))
        return "最近 5 筆記帳\n\n" + "\n".join(rows)

    async def _month_summary(self) -> str:
        from .models import ExpenseRecord
        from .router import _month_range

        today = date.today()
        start, end = _month_range(today.year, today.month)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ExpenseRecord)
                .where(ExpenseRecord.date >= start, ExpenseRecord.date < end)
            )
            records = result.scalars().all()

        if not records:
            return f"{today.month} 月還沒有記帳記錄。"

        total = sum(r.amount for r in records)
        by_cat: dict[str, int] = {}
        for r in records:
            cat = r.category or "（未分類）"
            by_cat[cat] = by_cat.get(cat, 0) + r.amount
        top = sorted(by_cat.items(), key=lambda x: x[1], reverse=True)[:5]

        lines = [f"{today.month} 月支出:${total:,}（{len(records)} 筆）", ""]
        lines += [f"{cat}:${amt:,}" for cat, amt in top]
        return "\n".join(lines)

    async def _delete_last(self) -> str:
        from .models import ExpenseRecord

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ExpenseRecord).order_by(ExpenseRecord.id.desc()).limit(1)
            )
            record = result.scalar_one_or_none()
            if not record:
                return "沒有可刪除的記帳記錄。"
            info = f"{record.date.strftime('%m/%d')} ${record.amount:,} {record.category or ''}".strip()
            await db.delete(record)
            await db.commit()
        return f"已刪除最後一筆：{info}"
