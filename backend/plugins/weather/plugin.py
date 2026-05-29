import logging
from core.plugin_base import BasePlugin
from core.settings_service import get_setting

logger = logging.getLogger(__name__)


class Plugin(BasePlugin):
    name = "weather"
    display = "天氣"
    description = "查詢目前天氣與未來 4 天預報（Open-Meteo）"
    version = "1.0.0"

    def get_router(self):
        from .router import router

        return router

    def get_telegram_commands(self) -> list[str]:
        return ["天氣", "weather"]

    def get_settings_schema(self) -> list[dict]:
        return [
            {
                "key": "weather.default_city",
                "label": "預設城市",
                "type": "text",
                "default": "Taipei",
                "description": "Telegram 下「天氣」指令時查詢的預設城市",
            }
        ]

    def get_help(self) -> str:
        return "【天氣】\n" "天氣 — 查詢預設城市天氣\n" "天氣 高雄 — 查詢指定城市"

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        t = text.strip()
        tl = t.lower()
        if t.startswith("天氣") or tl.startswith("weather"):
            city = t.replace("天氣", "").replace("weather", "").strip()
            if not city:
                city = await get_setting("weather.default_city", "Taipei")
            return await self._weather_text(city)
        return None

    async def _weather_text(self, city: str) -> str:
        from .router import _fetch_weather
        from fastapi import HTTPException

        try:
            w = await _fetch_weather(city)
        except HTTPException as e:
            return f"查詢失敗：{e.detail}"
        except Exception as e:
            return f"查詢失敗：{e}"

        lines = [
            f"{w.weather_icon} {w.city} 目前天氣",
            f"氣溫：{w.temperature}°C（體感 {w.apparent_temperature}°C）",
            f"濕度：{w.humidity}%  風速：{w.wind_speed} km/h",
            f"狀況：{w.weather_desc}",
            "",
            "📅 未來 4 天",
        ]
        for d in w.forecast:
            lines.append(
                f"{d.date}  {d.weather_icon} {d.temp_min}–{d.temp_max}°C  "
                f"降雨 {d.precipitation_prob}%"
            )
        return "\n".join(lines)
