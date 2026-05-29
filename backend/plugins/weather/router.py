import time
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter()

_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 600  # 10 分鐘

WMO_WEATHER: dict[int, tuple[str, str]] = {
    0: ("晴天", "☀️"),
    1: ("大致晴朗", "🌤"),
    2: ("部分多雲", "⛅"),
    3: ("陰天", "☁️"),
    45: ("霧", "🌫"),
    48: ("凍霧", "🌫"),
    51: ("毛毛雨", "🌦"),
    53: ("毛毛雨", "🌦"),
    55: ("毛毛雨", "🌦"),
    61: ("小雨", "🌧"),
    63: ("中雨", "🌧"),
    65: ("大雨", "🌧"),
    71: ("小雪", "❄️"),
    73: ("中雪", "❄️"),
    75: ("大雪", "❄️"),
    77: ("冰晶", "❄️"),
    80: ("陣雨", "🌦"),
    81: ("陣雨", "🌧"),
    82: ("強陣雨", "⛈"),
    85: ("陣雪", "❄️"),
    86: ("強陣雪", "❄️"),
    95: ("雷雨", "⛈"),
    96: ("雷雨夾冰雹", "⛈"),
    99: ("強雷雨", "⛈"),
}


def _desc(code: int) -> tuple[str, str]:
    return WMO_WEATHER.get(code, ("未知", "🌡"))


# ── Schemas ───────────────────────────────────────────────────


class DayForecast(BaseModel):
    date: str
    weather_code: int
    weather_desc: str
    weather_icon: str
    temp_max: float
    temp_min: float
    precipitation_prob: int


class WeatherOut(BaseModel):
    city: str
    temperature: float
    apparent_temperature: float
    humidity: int
    wind_speed: float
    weather_code: int
    weather_desc: str
    weather_icon: str
    forecast: list[DayForecast]


# ── Internal helpers ──────────────────────────────────────────


async def _geocode(city: str) -> tuple[float, float, str]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": city, "format": "json", "limit": 1},
            headers={"User-Agent": "PersonalAssistant/1.0"},
        )
        r.raise_for_status()
        results = r.json()
        if not results:
            raise HTTPException(404, f"找不到城市：{city}")
        loc = results[0]
        display_name = loc.get("display_name", city).split(",")[0].strip()
        return float(loc["lat"]), float(loc["lon"]), display_name


async def _fetch_weather(city: str) -> WeatherOut:
    cache_key = city.strip().lower()
    now = time.monotonic()
    if cache_key in _cache:
        ts, cached = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return WeatherOut(**cached)

    lat, lon, display_name = await _geocode(city)

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": ",".join(
                    [
                        "temperature_2m",
                        "apparent_temperature",
                        "weather_code",
                        "wind_speed_10m",
                        "relative_humidity_2m",
                    ]
                ),
                "daily": ",".join(
                    [
                        "weather_code",
                        "temperature_2m_max",
                        "temperature_2m_min",
                        "precipitation_probability_max",
                    ]
                ),
                "timezone": "Asia/Taipei",
                "forecast_days": 4,
            },
        )
        r.raise_for_status()
        data = r.json()

    cur = data["current"]
    daily = data["daily"]
    cur_desc, cur_icon = _desc(cur["weather_code"])

    forecast = []
    for i in range(len(daily["time"])):
        d_desc, d_icon = _desc(daily["weather_code"][i])
        forecast.append(
            DayForecast(
                date=daily["time"][i],
                weather_code=daily["weather_code"][i],
                weather_desc=d_desc,
                weather_icon=d_icon,
                temp_max=daily["temperature_2m_max"][i],
                temp_min=daily["temperature_2m_min"][i],
                precipitation_prob=daily["precipitation_probability_max"][i] or 0,
            )
        )

    out = WeatherOut(
        city=display_name,
        temperature=cur["temperature_2m"],
        apparent_temperature=cur["apparent_temperature"],
        humidity=cur["relative_humidity_2m"],
        wind_speed=cur["wind_speed_10m"],
        weather_code=cur["weather_code"],
        weather_desc=cur_desc,
        weather_icon=cur_icon,
        forecast=forecast,
    )
    _cache[cache_key] = (now, out.model_dump())
    return out


# ── Endpoint ──────────────────────────────────────────────────


@router.get("/weather", response_model=WeatherOut)
async def get_weather(city: str | None = Query(None)):
    if not city:
        from core.settings_service import get_setting

        city = await get_setting("weather.default_city", "Taipei")
    try:
        return await _fetch_weather(city)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"天氣資料獲取失敗：{e}")
