import os
from core.plugin_base import BasePlugin


class Plugin(BasePlugin):
    display = "系統設定"
    name = "settings"
    description = "系統設定，包含 Telegram Bot 與通知時間"
    version = "1.0.0"

    def get_nav_path(self) -> str:
        return ""

    def get_router(self):
        from .router import router

        return router

    def on_startup(self):
        from . import models  # noqa: F401

    def get_settings_schema(self) -> list[dict]:
        return [
            {
                "key": "telegram_token",
                "label": "Bot Token",
                "type": "password",
                "default": "",
                "description": "透過 @BotFather 建立 Bot 後取得",
                "action": "reload_bot",
            },
        ]

    async def on_tables_ready(self):
        from core.database import AsyncSessionLocal
        from core.plugin_registry import registry
        from .models import Setting, get_setting as _get_setting
        from core import settings_service

        settings_service.register_getter(_get_setting)

        async with AsyncSessionLocal() as db:
            for plugin in registry.all():
                for field in plugin.get_settings_schema():
                    key = field["key"]
                    default = field.get("default", "")
                    if key == "telegram_token":
                        default = os.environ.get("TELEGRAM_BOT_TOKEN", default)
                    existing = await db.get(Setting, key)
                    if existing is None:
                        db.add(Setting(key=key, value=default))
            await db.commit()
