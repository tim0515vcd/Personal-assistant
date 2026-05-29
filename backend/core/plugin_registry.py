import importlib
import pkgutil
import logging
from pathlib import Path

from core.plugin_base import BasePlugin

logger = logging.getLogger(__name__)


class PluginRegistry:
    """掃描 plugins/ 資料夾，自動發現並載入所有 Plugin。"""

    def __init__(self) -> None:
        self._plugins: list[BasePlugin] = []

    def discover(self) -> None:
        plugins_dir = Path(__file__).parent.parent / "plugins"
        for _, name, _ in pkgutil.iter_modules([str(plugins_dir)]):
            if name.startswith("_"):
                continue
            try:
                module = importlib.import_module(f"plugins.{name}.plugin")
                plugin: BasePlugin = module.Plugin()
                self._plugins.append(plugin)
                logger.info(f"Plugin loaded: {plugin.name} ({name})")
            except Exception as e:
                logger.error(f"Failed to load plugin '{name}': {e}")

    def all(self) -> list[BasePlugin]:
        return self._plugins

    def get(self, name: str) -> BasePlugin | None:
        return next((p for p in self._plugins if p.name == name), None)

    def check_command_conflicts(self) -> None:
        """檢查各 plugin 宣告的 Telegram 指令是否有重複，有則 log 警告。"""
        seen: dict[str, str] = {}
        for plugin in self._plugins:
            for cmd in plugin.get_telegram_commands():
                if cmd in seen:
                    logger.warning(
                        f"Telegram 指令衝突：'{cmd}' 同時被 '{seen[cmd]}' 和 '{plugin.name}' 宣告，"
                        f"'{seen[cmd]}' 會優先處理（依載入順序）"
                    )
                else:
                    seen[cmd] = plugin.name

    async def _is_enabled(self, plugin: BasePlugin) -> bool:
        from core.settings_service import get_setting
        return (await get_setting(f"plugin.{plugin.name}.enabled", "true")) == "true"

    async def _ordered_plugins(self) -> list[BasePlugin]:
        from core.settings_service import get_setting
        order_str = await get_setting("plugins.order", "")
        if not order_str:
            return self._plugins
        order_map = {name: i for i, name in enumerate(order_str.split(","))}
        return sorted(self._plugins, key=lambda p: order_map.get(p.name, 999))

    async def dispatch_line_message(self, user_id: str, text: str) -> str:
        """依序讓每個啟用的 plugin 嘗試處理訊息，第一個有回應的獲勝。"""
        if text.strip().lower() in ("說明", "help", "?", "？"):
            return await self._build_help()

        for plugin in await self._ordered_plugins():
            if not await self._is_enabled(plugin):
                continue
            try:
                result = await plugin.handle_line_message(user_id, text)
                if result is not None:
                    return result
            except Exception as e:
                logger.error(f"Plugin {plugin.name} error on LINE message: {e}")
        return "我還不懂這個指令，輸入「說明」看可用功能。"

    async def _build_help(self) -> str:
        sections = []
        for plugin in await self._ordered_plugins():
            if not await self._is_enabled(plugin):
                continue
            help_text = plugin.get_help()
            if help_text:
                sections.append(help_text)
        if not sections:
            return "目前沒有可用的指令說明。"
        return "\n\n".join(sections)


registry = PluginRegistry()
