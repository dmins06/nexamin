import uuid
from typing import Any, cast

import pytest
from fastapi import WebSocket

from app.realtime import RealtimeHub


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.closed_code: int | None = None
        self.events: list[dict[str, Any]] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, event: dict[str, Any]) -> None:
        self.events.append(event)

    async def close(self, code: int) -> None:
        self.closed_code = code


@pytest.mark.asyncio
async def test_realtime_hub_delivers_event_to_connected_recipient() -> None:
    hub = RealtimeHub()
    user_id = uuid.uuid4()
    fake = FakeWebSocket()
    websocket = cast(WebSocket, fake)

    async def valid_session() -> bool:
        return True

    await hub.connect(user_id, websocket, valid_session)
    await hub.publish(user_id, {"type": "message.new", "message": {"id": "one"}})
    await hub.disconnect(user_id, websocket)

    assert fake.accepted is True
    assert fake.events == [{"type": "message.new", "message": {"id": "one"}}]


@pytest.mark.asyncio
@pytest.mark.parametrize("auth_outage", [False, True])
async def test_hub_fails_closed_before_sending_private_events(auth_outage) -> None:
    hub = RealtimeHub()
    user_id = uuid.uuid4()
    fake = FakeWebSocket()

    async def invalid_session() -> bool:
        if auth_outage:
            raise RuntimeError("Synthetic authorization backend outage")
        return False

    await hub.connect(user_id, cast(WebSocket, fake), invalid_session)
    await hub.publish(user_id, {"type": "message.new", "message": "private synthetic data"})
    assert fake.events == []
    assert fake.closed_code == 4401
    assert not hub.is_online(user_id)
