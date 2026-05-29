import os
import httpx
import logging

logger = logging.getLogger(__name__)

LINE_CHANNEL_TOKEN = os.environ.get("LINE_CHANNEL_TOKEN", "")
LINE_USER_ID = os.environ.get("LINE_USER_ID", "")
_BASE = "https://api.line.me/v2/bot"


async def push_text(text: str, user_id: str | None = None) -> bool:
    """推播純文字訊息給指定 user（預設為環境變數的 LINE_USER_ID）。"""
    uid = user_id or LINE_USER_ID
    if not uid or not LINE_CHANNEL_TOKEN:
        logger.warning("LINE_CHANNEL_TOKEN or LINE_USER_ID not set, skipping push.")
        return False
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_BASE}/message/push",
            headers={
                "Authorization": f"Bearer {LINE_CHANNEL_TOKEN}",
                "Content-Type": "application/json",
            },
            json={"to": uid, "messages": [{"type": "text", "text": text}]},
        )
    if resp.status_code == 200:
        return True
    logger.error(f"LINE push failed: {resp.status_code} {resp.text}")
    return False


async def reply_text(reply_token: str, text: str) -> bool:
    """回覆 LINE webhook 的訊息（需要 reply_token，有時效限制）。"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_BASE}/message/reply",
            headers={
                "Authorization": f"Bearer {LINE_CHANNEL_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "replyToken": reply_token,
                "messages": [{"type": "text", "text": text}],
            },
        )
    return resp.status_code == 200
