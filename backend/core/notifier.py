from typing import Callable, Awaitable

_sender: Callable[[str], Awaitable[None]] | None = None


def register_sender(func: Callable[[str], Awaitable[None]]) -> None:
    global _sender
    _sender = func


async def send_notification(text: str) -> None:
    if _sender is None:
        return
    await _sender(text)
