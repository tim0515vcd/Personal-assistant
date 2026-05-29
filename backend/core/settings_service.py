from typing import Callable, Awaitable

_getter: Callable[[str, str], Awaitable[str]] | None = None


def register_getter(func: Callable[[str, str], Awaitable[str]]) -> None:
    """由 settings plugin 呼叫，向 core 註冊設定讀取函式。"""
    global _getter
    _getter = func


async def get_setting(key: str, default: str = "") -> str:
    """讀取設定值。若 settings plugin 未載入則回傳 default。"""
    if _getter is None:
        return default
    return await _getter(key, default)
