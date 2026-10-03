import asyncio
import uuid
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import WebSocket


class RealtimeHub:
    """Process-local fan-out for the single-worker web service.

    Render runs one Uvicorn worker for this project. The hub keeps delivery immediate
    while PostgreSQL remains the source of truth and polling remains a safe fallback.
    """

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        self._validators: dict[WebSocket, Callable[[], Awaitable[bool]]] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self, user_id: uuid.UUID, websocket: WebSocket,
        validate_session: Callable[[], Awaitable[bool]],
        *, subprotocol: str | None = None,
    ) -> None:
        if subprotocol is None:
            await websocket.accept()
        else:
            await websocket.accept(subprotocol=subprotocol)
        async with self._lock:
            self._connections[user_id].add(websocket)
            self._validators[websocket] = validate_session

    async def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> bool:
        async with self._lock:
            self._validators.pop(websocket, None)
            sockets = self._connections.get(user_id)
            if sockets is None:
                return False
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(user_id, None)
                return False
            return True

    def is_online(self, user_id: uuid.UUID) -> bool:
        return bool(self._connections.get(user_id))

    async def publish(self, user_id: uuid.UUID, event: dict[str, Any]) -> None:
        async with self._lock:
            sockets = tuple(
                (socket, self._validators[socket])
                for socket in self._connections.get(user_id, ())
            )
        stale: list[WebSocket] = []
        for websocket, validate_session in sockets:
            try:
                authorized = await validate_session()
            except Exception:
                # A DB/auth outage must not turn into private-event delivery.
                authorized = False
            if not authorized:
                stale.append(websocket)
                try:
                    await websocket.close(code=4401)
                except RuntimeError:
                    pass
                continue
            try:
                await websocket.send_json(event)
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(user_id, websocket)


realtime_hub = RealtimeHub()
