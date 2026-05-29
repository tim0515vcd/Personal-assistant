from abc import ABC
from fastapi import APIRouter


class BasePlugin(ABC):
    """所有 Plugin 必須繼承此類別。
    加新功能只要在 plugins/ 建資料夾、繼承這個 class，重啟自動載入。
    """

    display: str = ""
    name: str = ""
    description: str = ""
    version: str = "1.0.0"

    def get_router(self) -> APIRouter | None:
        """回傳此 plugin 的 FastAPI Router。無 HTTP 端點則回傳 None。"""
        return None

    def get_scheduler_jobs(self) -> list[dict]:
        """回傳 APScheduler 排程設定。
        格式範例：
          [{"func": self.daily_check, "trigger": "cron", "hour": 9, "minute": 0}]
        """
        return []

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        """處理 LINE 傳入的訊息。
        回傳字串 → 送回給使用者。
        回傳 None → 此 plugin 不處理，交給下一個。
        """
        return None

    def get_help(self) -> str | None:
        """回傳此 plugin 的說明文字，會被彙整到全域說明指令中。"""
        return None

    def get_settings_schema(self) -> list[dict]:
        """回傳此 plugin 需要的設定欄位。
        格式：
          [{"key": "plugin.key", "label": "顯示名稱",
            "type": "text|password|number|select",
            "default": "", "description": "...",   # 選填
            "action": "reload_bot",                # 選填，儲存後顯示的額外操作
            "min": 0, "max": 23,                   # 選填，type=number 時用
            "options": ["0","15","30"]}]            # 選填，type=select 時用
        """
        return []

    def get_telegram_commands(self) -> list[str]:
        """回傳此 plugin 會攔截的 Telegram 指令關鍵字，用於啟動時衝突檢查。"""
        return []

    def get_nav_path(self) -> str:
        """回傳此 plugin 在前端的導覽路徑。空字串代表不出現在導覽列。"""
        return f"/plugins/{self.name}"

    def on_startup(self) -> None:
        """FastAPI 啟動時呼叫，可做初始化（建 DB 表等）。"""

    async def on_tables_ready(self) -> None:
        """DB tables 建立完成後呼叫，可做資料 seed 等需要 DB 的初始化。"""

    def __repr__(self) -> str:
        return f"<Plugin {self.name} v{self.version}>"
