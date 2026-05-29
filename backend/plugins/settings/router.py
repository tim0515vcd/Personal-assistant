from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from .models import Setting

router = APIRouter()


class SettingOut(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str


@router.get("/schema")
async def get_schema():
    from core.plugin_registry import registry
    from core.settings_service import get_setting

    result = []
    for plugin in registry.all():
        enabled = (await get_setting(f"plugin.{plugin.name}.enabled", "true")) == "true"
        if not enabled:
            continue
        for field in plugin.get_settings_schema():
            result.append(
                {
                    "plugin": plugin.name,
                    "plugin_description": plugin.description,
                    **field,
                }
            )
    return result


@router.get("", response_model=list[SettingOut])
async def list_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).order_by(Setting.key))
    return result.scalars().all()


@router.patch("/{key}", response_model=SettingOut)
async def update_setting(
    key: str, body: SettingUpdate, db: AsyncSession = Depends(get_db)
):
    row = await db.get(Setting, key)
    if row is None:
        row = Setting(key=key, value=body.value)
        db.add(row)
    else:
        row.value = body.value
    await db.commit()
    await db.refresh(row)

    # 通知時間變更時立即重新排程
    if key in ("notify_hour", "notify_minute"):
        from apscheduler.triggers.cron import CronTrigger
        from core.scheduler import scheduler

        hour_row = await db.get(Setting, "notify_hour")
        minute_row = await db.get(Setting, "notify_minute")
        h = int(hour_row.value if hour_row else "9")
        m = int(minute_row.value if minute_row else "0")
        from core.scheduler import notify_controlled_jobs

        for job in scheduler.get_jobs():
            if job.id in notify_controlled_jobs:
                scheduler.add_job(
                    job.func,
                    CronTrigger(hour=h, minute=m, timezone="Asia/Taipei"),
                    id=job.id,
                    replace_existing=True,
                )

    return row


@router.post("/reload-bot")
async def reload_bot(db: AsyncSession = Depends(get_db)):
    row = await db.get(Setting, "telegram_token")
    token = row.value if row else ""
    if not token.strip():
        raise HTTPException(400, "尚未設定 Telegram token")
    from core import telegram_bot

    await telegram_bot.restart(token.strip())
    return {"status": "ok"}
