# Personal Assistant

個人助手平台——可擴充的 Plugin 架構，支援 Telegram Bot 互動與 Web Dashboard 管理。

## 技術棧

| 層級 | 技術 |
|------|------|
| 後端 | FastAPI + SQLAlchemy (async) + APScheduler |
| 資料庫 | PostgreSQL 16 + Redis 7 |
| 前端 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| 通知 | Telegram Bot（python-telegram-bot 21.6）|
| 容器 | Docker Compose |

---

## 快速開始

### 1. 環境設定

```bash
cp .env.example .env
# 編輯 .env，填入以下變數：
# LINE_CHANNEL_SECRET=...    （選填，LINE Bot）
# TELEGRAM_BOT_TOKEN=...     （選填，可在 Web 設定頁填入）
```

### 2. 啟動所有服務

```bash
docker compose up --build
```

- 前端 Dashboard：http://localhost:3000
- 後端 API：http://localhost:8000
- API 文件：http://localhost:8000/docs

---

## 已實作功能

### 排程提醒（reminder）
追蹤任何需要週期性執行的事項（例如：換牙刷、保養車子、繳費）。

**Telegram 指令：**
```
提醒          → 查看所有超期項目
完成 換牙刷   → 標記今日完成
說明          → 查看所有可用指令
```

### 油耗記錄（fuel）
記錄每次加油，自動計算油耗（km/L），支援**多台車輛**管理。

**Telegram 指令（對預設車輛操作）：**
```
加油 12500 40 1800   → 新增記錄（里程 公升 油錢）
油耗                 → 查看最近 5 筆記錄與平均油耗
```

**Web UI 功能：**
- 車輛分頁切換，每台車獨立統計
- 油耗趨勢折線圖、每月油費長條圖
- CSV 匯出（當前車輛）

### 記帳（expense）
日常支出記錄，分類統計，支援**多帳戶**（信用卡/銀行）管理，可與既有 Excel 互通。

**Telegram 指令：**
```
記 70 吃午餐              → 記到預設帳戶（今天）
記 70 吃午餐 台新 跟同事  → 指定帳戶與備註
本月                     → 本月總支出與分類前 5 名
記帳                     → 最近 5 筆
刪記帳                   → 刪除最後一筆
```

**Web UI 功能：**
- 帳戶分頁切換（含「全部」），月份切換瀏覽
- 本月摘要（支出、筆數、日均、對比上月）
- 分類佔比長條圖、近 6 個月趨勢圖
- Excel 匯入（可重複匯入、自動去重）與匯出（還原成原月份並排格式）

### 排卵期計算（cycle）
月經週期追蹤與排卵期預測。

**Telegram 指令：**
```
來了      → 記錄今日月經開始
週期      → 查看預測（下次月經、排卵日、易孕期）
歷史      → 查看最近 5 筆記錄
```

**Web UI 功能：**
- 月曆視圖，標記排卵日、易孕期、月經期、今天
- 可設定預設週期天數與月經天數

### 系統設定（settings）
- Telegram Bot Token 設定與重新連線
- 每日通知時間設定
- 各 Plugin 參數設定

---

## Plugin 管理頁（首頁）

- **清單模式**：拖曳調整順序，獨立控制「啟用」與「顯示在導覽列」
- **格狀模式**：2 欄卡片瀏覽，快速啟用/停用

---

## Plugin 開發指南

新增功能只需三步，**不用動任何現有程式碼**：

### 步驟 1：建立資料夾

```
backend/plugins/my_feature/
├── __init__.py
└── plugin.py
```

### 步驟 2：實作 Plugin class

```python
# backend/plugins/my_feature/plugin.py
from core.plugin_base import BasePlugin
from fastapi import APIRouter

class Plugin(BasePlugin):
    name = "my_feature"
    display = "我的功能"
    description = "功能說明"
    version = "1.0.0"

    def get_router(self) -> APIRouter | None:
        from .router import router
        return router

    def get_telegram_commands(self) -> list[str]:
        return ["指令一", "指令二"]

    def get_settings_schema(self) -> list[dict]:
        return [
            {"key": "my_feature.some_setting", "label": "設定名稱",
             "type": "text", "default": "預設值", "description": "說明"}
        ]

    async def on_tables_ready(self) -> None:
        # 建完 DB 後執行（seed 資料、DB migration 等）
        pass

    async def handle_line_message(self, user_id: str, text: str) -> str | None:
        if text.startswith("指令一"):
            return "回應！"
        return None

    def get_scheduler_jobs(self) -> list[dict]:
        return [
            {"func": self._daily_job, "trigger": "cron", "hour": 9,
             "id": "my_feature_daily", "notify_controlled": True}
        ]

    async def _daily_job(self):
        from core.notifier import send_notification
        await send_notification("每日推播內容")
```

### 步驟 3：重啟服務

```bash
docker compose restart backend
```

系統自動發現並載入，路由掛在 `/api/plugins/my_feature/`，設定頁自動出現該 plugin 的設定區塊。

---

## 專案結構

```
personal-assistant/
├── backend/
│   ├── main.py
│   ├── core/
│   │   ├── plugin_base.py       # BasePlugin 介面
│   │   ├── plugin_registry.py   # 自動發現、LINE/Telegram 派發
│   │   ├── scheduler.py         # APScheduler 整合
│   │   ├── settings_service.py  # Service Locator（設定）
│   │   ├── notifier.py          # Service Locator（推播）
│   │   ├── telegram_bot.py      # Telegram Bot
│   │   ├── database.py          # SQLAlchemy async
│   │   └── line_client.py       # LINE API
│   └── plugins/
│       ├── reminder/            # 排程提醒
│       ├── fuel/                # 油耗記錄（多車）
│       ├── expense/             # 記帳（多帳戶、Excel 匯入匯出）
│       ├── cycle/               # 排卵期計算
│       ├── settings/            # 系統設定
│       └── weather/             # 天氣（骨架）
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Plugin 管理首頁
│   │   ├── NavLinks.tsx         # 動態導覽列
│   │   ├── layout.tsx
│   │   └── plugins/
│   │       ├── reminder/
│   │       ├── fuel/
│   │       ├── cycle/
│   │       └── settings/
│   └── lib/api.ts               # API 請求封裝
├── docker-compose.yml
├── .env.example
└── README.md
```
