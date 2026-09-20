import uuid
from typing import Any, cast

import pytest
from fastapi import WebSocket

from app.realtime import RealtimeHub


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.events: list[dict[str, Any]] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, event: dict[str, Any]) -> None:
        self.events.append(event)


@pytest.mark.asyncio
async def test_realtime_hub_delivers_event_to_connected_recipient() -> None:
    hub = RealtimeHub()
    user_id = uuid.uuid4()
    fake = FakeWebSocket()
    websocket = cast(WebSocket, fake)

    await hub.connect(user_id, websocket)
    await hub.publish(user_id, {"type": "message.new", "message": {"id": "one"}})
    await hub.disconnect(user_id, websocket)

    assert fake.accepted is True
    assert fake.events == [{"type": "message.new", "message": {"id": "one"}}]
