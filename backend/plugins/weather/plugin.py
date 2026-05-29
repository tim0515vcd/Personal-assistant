"""
Weather Plugin 骨架 — 示範如何加第二個 Plugin。
實際實作時替換 _fetch_weather() 內容即可，其餘架構不用改。
"""
import logging
from core.plugin_base import BasePlugin

logger = logging.getLogger(__name__)


class Plugin(BasePlugin):
    name = "weather"
    description = "查詢天氣（骨架示範，尚未實作）"
    version = "0.1.0"

    def get_telegram_commands(self) -> list[str]:
        return ["天氣", "weather"]

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        t = text.strip()
        if t.startswith("天氣") or t.startswith("weather"):
            city = t.replace("天氣", "").replace("weather", "").strip() or "台北"
            return await self._fetch_weather(city)
        return None

    async def _fetch_weather(self, city: str) -> str:
        # TODO: 串接 OpenWeatherMap API
        # import httpx
        # API_KEY = os.environ["OPENWEATHER_API_KEY"]
        # ...
        return f"🌤 {city} 的天氣功能開發中，敬請期待！"
