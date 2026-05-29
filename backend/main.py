import hashlib
import hmac
import json
import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.plugin_registry import registry
from core.scheduler import scheduler, register_plugin_jobs
from core.database import create_all_tables
from core.line_client import reply_text

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

LINE_CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 找 plugin
    registry.discover()
    for plugin in registry.all():
        # 每個插件做初始化（例如確保 DB model 被載入）
        plugin.on_startup()

    # 在資料庫建立所有還不存在的表格
    await create_all_tables()

    # 讓需要 DB 的 plugin 做初始化（例如 seed 預設設定）
    for plugin in registry.all():
        await plugin.on_tables_ready()

    # 掛路由
    for plugin in registry.all():
        router = plugin.get_router()
        if router:
            app.include_router(
                router, prefix=f"/api/plugins/{plugin.name}", tags=[plugin.name]
            )

    # 從 DB 讀通知時間，直接以正確時間建排程（避免先建再 reschedule 的競態問題）
    from core.settings_service import get_setting

    notify_hour = int(await get_setting("notify_hour", "9"))
    notify_minute = int(await get_setting("notify_minute", "0"))
    register_plugin_jobs(
        registry.all(), daily_hour=notify_hour, daily_minute=notify_minute
    )
    scheduler.start()

    # 從 DB 讀 token（env 作為後備），啟動 Telegram Bot
    token = (await get_setting("telegram_token")) or TELEGRAM_BOT_TOKEN
    if token:
        from core.telegram_bot import start as tg_start

        await tg_start(token)
    registry.check_command_conflicts()
    logger.info(
        f"Started with {len(registry.all())} plugins: {[p.name for p in registry.all()]}"
    )
    yield

    # 伺服器關閉時，停掉排程器和 Telegram Bot，避免資源洩漏
    scheduler.shutdown()
    from core.telegram_bot import stop as tg_stop, is_running as tg_running

    if tg_running():
        await tg_stop()


app = FastAPI(title="Personal Assistant API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 系統 API ──────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/plugins")
async def list_plugins():
    from core.settings_service import get_setting

    order_str = await get_setting("plugins.order", "")
    if order_str:
        order_map = {name: i for i, name in enumerate(order_str.split(","))}
        plugins_list = sorted(registry.all(), key=lambda p: order_map.get(p.name, 999))
    else:
        plugins_list = registry.all()

    result = []
    for p in plugins_list:
        enabled = (await get_setting(f"plugin.{p.name}.enabled", "true")) == "true"
        show_nav = (await get_setting(f"plugin.{p.name}.show_nav", "true")) == "true"
        result.append(
            {
                "name": p.name,
                "display": p.display,
                "description": p.description,
                "version": p.version,
                "enabled": enabled,
                "show_nav": show_nav,
                "nav_path": p.get_nav_path() if enabled else "",
            }
        )
    return result


# ── LINE Webhook ──────────────────────────────────────────


def _verify_signature(body: bytes, signature: str) -> bool:
    if not LINE_CHANNEL_SECRET:
        return True  # dev mode: skip verify
    mac = hmac.new(LINE_CHANNEL_SECRET.encode(), body, hashlib.sha256).digest()
    import base64

    return hmac.compare_digest(base64.b64encode(mac).decode(), signature)


@app.post("/webhook/line")
async def line_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("X-Line-Signature", "")
    if not _verify_signature(body, sig):
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = json.loads(body)
    for event in payload.get("events", []):
        if event.get("type") != "message":
            continue
        if event["message"].get("type") != "text":
            continue
        user_id = event["source"]["userId"]
        text = event["message"]["text"].strip()
        reply_token = event["replyToken"]

        response = await registry.dispatch_line_message(user_id, text)
        await reply_text(reply_token, response)

    return {"status": "ok"}
