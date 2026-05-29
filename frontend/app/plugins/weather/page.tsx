"use client";
import { useState } from "react";
import useSWR from "swr";
import { Search, Wind, Droplets, Thermometer } from "lucide-react";
import { weatherApi, type WeatherData } from "@/lib/api";

function WeatherPage() {
  const [inputCity, setInputCity] = useState("");
  const [queryCity, setQueryCity] = useState<string | null>(""); // "" = 預設城市

  const { data, isLoading, error } = useSWR<WeatherData>(
    queryCity !== null ? ["weather", queryCity] : null,
    () => weatherApi.get(queryCity || undefined),
    { shouldRetryOnError: false }
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const city = inputCity.trim();
    if (city) setQueryCity(city);
  }

  const dayLabels = ["今天", "明天", "後天", "大後天"];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">天氣</h1>
        <p className="mt-1 text-sm text-slate-500">
          Telegram 指令：
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">天氣</code>
          <span className="mx-1">·</span>
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">天氣 高雄</code>
        </p>
      </div>

      {/* 搜尋列 */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={inputCity}
          onChange={(e) => setInputCity(e.target.value)}
          placeholder="輸入城市名稱（例：台北、高雄、Tokyo）"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition bg-white"
        />
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Search size={15} />
          查詢
        </button>
      </form>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin" />
          <span className="text-sm">查詢中...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error.message?.includes("404") ? "找不到該城市，請確認名稱是否正確" : "天氣資料獲取失敗，請稍後再試"}
        </div>
      )}

      {!isLoading && !error && !data && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-4">🌤</div>
          <div className="text-sm">輸入城市名稱查詢天氣，或查詢預設城市</div>
          <button
            onClick={() => setQueryCity("")}
            className="mt-3 text-sky-500 hover:text-sky-600 text-sm underline underline-offset-2"
          >
            查詢預設城市
          </button>
        </div>
      )}

      {data && (
        <>
          {/* 目前天氣卡片 */}
          <div className="bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl p-6 mb-4 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold opacity-90">{data.city}</div>
                <div className="text-6xl font-bold mt-1">{Math.round(data.temperature)}°</div>
                <div className="text-sm opacity-80 mt-1">{data.weather_desc}</div>
              </div>
              <div className="text-7xl leading-none">{data.weather_icon}</div>
            </div>

            <div className="flex gap-4 mt-5 pt-4 border-t border-white/20">
              <div className="flex items-center gap-1.5 text-sm opacity-90">
                <Thermometer size={14} />
                體感 {Math.round(data.apparent_temperature)}°C
              </div>
              <div className="flex items-center gap-1.5 text-sm opacity-90">
                <Droplets size={14} />
                濕度 {data.humidity}%
              </div>
              <div className="flex items-center gap-1.5 text-sm opacity-90">
                <Wind size={14} />
                {data.wind_speed} km/h
              </div>
            </div>
          </div>

          {/* 4 天預報 */}
          <div className="grid grid-cols-4 gap-2">
            {data.forecast.map((d, i) => (
              <div
                key={d.date}
                className="bg-white border border-slate-200 rounded-xl p-3 text-center"
              >
                <div className="text-xs font-medium text-slate-500 mb-2">{dayLabels[i]}</div>
                <div className="text-2xl mb-2">{d.weather_icon}</div>
                <div className="text-xs text-slate-600 mb-2 leading-snug">{d.weather_desc}</div>
                <div className="text-sm font-semibold text-slate-800">
                  {Math.round(d.temp_max)}°
                  <span className="text-slate-400 font-normal"> / {Math.round(d.temp_min)}°</span>
                </div>
                {d.precipitation_prob > 0 && (
                  <div className="flex items-center justify-center gap-0.5 mt-1 text-xs text-sky-500">
                    <Droplets size={11} />
                    {d.precipitation_prob}%
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-3 text-right">
            資料來源：Open-Meteo · 每 10 分鐘更新
          </p>
        </>
      )}
    </div>
  );
}

export default WeatherPage;
