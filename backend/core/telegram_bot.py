import logging
from pathlib import Path
from telegram import Update
from telegram.ext import Application, MessageHandler, filters, ContextTypes

logger = logging.getLogger(__name__)

_app: Application | None = None
_chat_id: str | None = None
_CHAT_ID_FILE = Path("/app/telegram_chat_id.txt")


def _load_chat_id() -> str | None:
    if _CHAT_ID_FILE.exists():
        return _CHAT_ID_FILE.read_text().strip() or None
    return None


def _save_chat_id(chat_id: str) -> None:
    _CHAT_ID_FILE.write_text(chat_id)


async def send_notification(text: str) -> None:
    """主動推播訊息給使用者（需先與 Bot 互動過一次）。"""
    if not _app or not _chat_id:
        logger.warning("Telegram: 尚未有使用者聊天記錄，無法發送通知")
        return
    await _app.bot.send_message(chat_id=_chat_id, text=text)


async def _handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global _chat_id
    from core.plugin_registry import registry

    if not update.message or not update.message.text:
        return

    cid = str(update.effective_chat.id)
    if _chat_id != cid:
        _chat_id = cid
        _save_chat_id(cid)
        logger.info(f"Telegram chat_id 已儲存: {cid}")

    user_id = str(update.effective_user.id)
    text = update.message.text.strip()
    response = await registry.dispatch_line_message(user_id, text)
    await update.message.reply_text(response)


async def start(token: str) -> None:
    global _app, _chat_id
    _chat_id = _load_chat_id()
    if _chat_id:
        logger.info(f"Telegram: 載入已儲存的 chat_id: {_chat_id}")

    _app = Application.builder().token(token).build()
    _app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _handle_message))
    await _app.initialize()
    await _app.start()
    await _app.updater.start_polling()

    from core import notifier

    notifier.register_sender(send_notification)
    logger.info("Telegram bot polling started")


async def stop() -> None:
    global _app
    if _app:
        await _app.updater.stop()
        await _app.stop()
        await _app.shutdown()
        _app = None
        logger.info("Telegram bot stopped")


async def restart(token: str) -> None:
    await stop()
    await start(token)
    logger.info("Telegram bot restarted")


def is_running() -> bool:
    return _app is not None
