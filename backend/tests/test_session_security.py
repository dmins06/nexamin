"""Non-destructive adversarial checks; synthetic users and an in-memory DB only."""

import asyncio
import hashlib
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import cast

import httpx
import jwt
import pytest
import pytest_asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import social as social_api
from app.api.v1.admin import lock_user, unlock_user
from app.api.v1.auth import router as auth_router
from app.config import Settings, settings
from app.core.exceptions import register_exception_handlers
from app.core.security import create_access_token, decode_access_token
from app.database import Base, get_db
from app.models import RefreshToken, Role, User
from app.realtime import RealtimeHub
from app.schemas import LoginRequest, PasswordChangeRequest, TokenPair, UserCreate
from app.services.auth import AuthService
from app.services.password_recovery import reset_password


@pytest_asyncio.fixture
async def api_client(session, monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", "synthetic-test-signing-key-not-for-production")
    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1")
    register_exception_handlers(app)

    async def test_db():
        yield session

    app.dependency_overrides[get_db] = test_db
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1"
    ) as client:
        yield client


async def student_pair(session):
    service = AuthService(session)
    pair = await service.register(UserCreate(
        email="security-fixture@example.edu", password="SyntheticPassword123",
        full_name="Security Fixture",
    ))
    user = await session.scalar(select(User).where(User.email == "security-fixture@example.edu"))
    assert user is not None
    return service, user, pair


async def auth_status(client, access_token):
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    if response.status_code == 200:
        assert "password_hash" not in response.json()
    return response.status_code


@pytest.mark.asyncio
@pytest.mark.parametrize("action", ["change", "reset", "lock-unlock"])
async def test_old_access_tokens_cannot_survive_account_recovery(session, api_client, action):
    service, user, pair = await student_pair(session)
    second = await service.login(LoginRequest(email=user.email, password="SyntheticPassword123"))
    assert await auth_status(api_client, pair.access_token) == 200
    if action == "change":
        await service.change_password(user, PasswordChangeRequest(
            current_password="SyntheticPassword123", new_password="NewSyntheticPassword456",
        ))
    elif action == "reset":
        token = jwt.encode({
            "sub": str(user.id), "purpose": "password_reset",
            "fingerprint": hashlib.sha256((user.password_hash or "").encode()).hexdigest(),
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        }, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        await reset_password(session, token, "NewSyntheticPassword456")
    else:
        admin = User(id=uuid.uuid4(), email="security-admin@example.edu", full_name="Admin",
                     role=Role.ADMIN)
        session.add(admin)
        await session.commit()
        await lock_user(user.id, session, admin)
        assert await auth_status(api_client, pair.access_token) == 401
        await unlock_user(user.id, session, admin)
    for old in (pair, second):
        assert await auth_status(api_client, old.access_token) == 401
        refreshed = await api_client.post("/api/v1/auth/refresh", json={
            "refresh_token": old.refresh_token,
        })
        assert refreshed.status_code == 401
    password = "SyntheticPassword123" if action == "lock-unlock" else "NewSyntheticPassword456"
    fresh = await service.login(LoginRequest(email=user.email, password=password))
    assert await auth_status(api_client, fresh.access_token) == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("rotate_first", [False, True])
async def test_logout_revokes_only_its_family_even_with_a_rotated_ancestor(
    session, api_client, rotate_first,
):
    service, user, pair = await student_pair(session)
    other = await service.login(LoginRequest(email=user.email, password="SyntheticPassword123"))
    current = await service.refresh(pair.refresh_token) if rotate_first else pair
    assert await auth_status(api_client, current.access_token) == 200
    response = await api_client.post("/api/v1/auth/logout", json={
        "refresh_token": pair.refresh_token,
    })
    assert response.status_code == 200
    assert await auth_status(api_client, pair.access_token) == 401
    assert await auth_status(api_client, current.access_token) == 401
    assert await auth_status(api_client, other.access_token) == 200


@pytest.mark.asyncio
async def test_rotation_preserves_family_until_replay_is_detected(session, api_client):
    service, _, pair = await student_pair(session)
    rotated = await service.refresh(pair.refresh_token)
    assert await auth_status(api_client, pair.access_token) == 200
    assert await auth_status(api_client, rotated.access_token) == 200
    response = await api_client.post("/api/v1/auth/refresh", json={
        "refresh_token": pair.refresh_token,
    })
    assert response.status_code == 401
    assert await auth_status(api_client, pair.access_token) == 401
    assert await auth_status(api_client, rotated.access_token) == 401


@pytest.mark.asyncio
async def test_legacy_access_can_only_transition_through_a_valid_refresh(session, api_client):
    service, user, pair = await student_pair(session)
    legacy, _ = create_access_token(user.id, user.role.value)
    assert await auth_status(api_client, legacy) == 401
    migrated = await service.refresh(pair.refresh_token)
    assert await auth_status(api_client, migrated.access_token) == 200


@pytest.mark.asyncio
async def test_family_is_bound_to_its_user_and_live_refresh_lifetime(session, api_client):
    _, user, pair = await student_pair(session)
    payload = decode_access_token(pair.access_token)
    payload["sub"] = str(uuid.uuid4())
    forged = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    assert await auth_status(api_client, forged) == 401
    refresh = await session.scalar(select(RefreshToken).where(RefreshToken.user_id == user.id))
    assert refresh is not None
    refresh.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await session.commit()
    assert await auth_status(api_client, pair.access_token) == 401


@pytest.mark.parametrize("bad_claim", ["missing", "invalid", "wrong-type"])
@pytest.mark.asyncio
async def test_invalid_session_claim_is_rejected_not_a_server_error(session, api_client, bad_claim):
    _, _, pair = await student_pair(session)
    payload = decode_access_token(pair.access_token)
    if bad_claim == "missing":
        payload.pop("sid", None)
    elif bad_claim == "invalid":
        payload["sid"] = "not-a-uuid"
    else:
        payload["sid"] = ["not", "a", "string"]
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    assert await auth_status(api_client, token) == 401


def test_production_cannot_start_with_the_published_development_signing_key():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(_env_file=None, app_env="production",
                 jwt_secret="development-secret-change-before-production-123456")


def test_production_cannot_allow_every_cors_origin():
    with pytest.raises(ValidationError, match="CORS"):
        Settings(_env_file=None, app_env="production",
                 jwt_secret="synthetic-production-config-test-key-123456", cors_origins=["*"])


def test_development_defaults_and_explicit_production_configuration_remain_supported():
    development = Settings(_env_file=None, app_env="development")
    assert development.app_env == "development"
    production = Settings(_env_file=None, app_env="production",
                          jwt_secret="synthetic-production-config-test-key-123456",
                          cors_origins=["https://nexamin.example"])
    assert production.app_env == "production"


class SecuritySocket:
    def __init__(self, token=""):
        self.scope = {"subprotocols": ["nexamin", f"bearer.{token}"]}
        self.accepted = False
        self.accepted_protocol = None
        self.close_code = None
        self.events = []
        self.on_receive = None

    async def accept(self, subprotocol=None):
        self.accepted = True
        self.accepted_protocol = subprotocol

    async def close(self, code):
        self.close_code = code

    async def send_json(self, event):
        self.events.append(event)

    async def receive_text(self):
        if self.on_receive is not None:
            await self.on_receive()
        raise WebSocketDisconnect()


@pytest.mark.asyncio
@pytest.mark.parametrize("already_revoked", [True, False])
async def test_websocket_cannot_connect_or_receive_after_session_revocation(
    session, api_client, monkeypatch, already_revoked,
):
    service, user, pair = await student_pair(session)
    hub = RealtimeHub()

    @asynccontextmanager
    async def local_session_factory():
        yield session

    monkeypatch.setattr(social_api, "SessionFactory", local_session_factory)
    monkeypatch.setattr(social_api, "realtime_hub", hub)
    socket = SecuritySocket(pair.access_token)
    if already_revoked:
        await service.logout(pair.refresh_token)
    else:
        async def revoke_then_send():
            await service.logout(pair.refresh_token)
            await hub.publish(user.id, {"type": "message.new", "message": "private fixture"})
        socket.on_receive = revoke_then_send
    await social_api.realtime_events(cast(WebSocket, socket))
    assert socket.close_code == 4401
    assert socket.events == []
    assert socket.accepted is (not already_revoked)
    assert socket.accepted_protocol == (None if already_revoked else "nexamin")
    assert not hub.is_online(user.id)


@pytest.mark.asyncio
async def test_idle_websocket_is_rechecked_and_closed_after_logout(session, api_client, monkeypatch):
    service, user, pair = await student_pair(session)
    ready = asyncio.Event()

    class IdleSocket(SecuritySocket):
        async def accept(self, subprotocol=None):
            await super().accept(subprotocol)
            ready.set()

        async def receive_text(self):
            await asyncio.Event().wait()

    @asynccontextmanager
    async def local_session_factory():
        yield session

    hub = RealtimeHub()
    monkeypatch.setattr(social_api, "SessionFactory", local_session_factory)
    monkeypatch.setattr(social_api, "realtime_hub", hub)
    monkeypatch.setattr(social_api, "WS_RECHECK_SECONDS", 0.05)
    socket = IdleSocket(pair.access_token)
    task = asyncio.create_task(social_api.realtime_events(cast(WebSocket, socket)))
    try:
        await asyncio.wait_for(ready.wait(), timeout=2)
        await service.logout(pair.refresh_token)
        await asyncio.wait_for(task, timeout=2)
    finally:
        if not task.done():
            task.cancel()
    assert socket.close_code == 4401
    assert not hub.is_online(user.id)


@pytest.mark.parametrize("use_protocol", [True, False])
def test_actual_asgi_websocket_handshake_never_accepts_a_query_token(
    monkeypatch, use_protocol,
):
    # TestClient owns its own loop. Its DB is created/disposed in that same loop,
    # not borrowed from pytest's async SQLite fixture across threads.
    monkeypatch.setattr(settings, "jwt_secret", "synthetic-transport-signing-key-not-for-production")
    issued: list[TokenPair] = []
    closed: list[asyncio.Event] = []

    @asynccontextmanager
    async def memory_lifespan(app):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            factory = async_sessionmaker(engine, expire_on_commit=False)
            completed = asyncio.Event()
            closed.append(completed)

            @asynccontextmanager
            async def socket_session():
                async with factory() as db:
                    yield db
                completed.set()

            monkeypatch.setattr(social_api, "SessionFactory", socket_session)
            async with factory() as db:
                issued.append(await AuthService(db).register(UserCreate(
                    email="wire-fixture@example.edu", password="SyntheticPassword123",
                    full_name="Wire Fixture",
                )))
            yield
        finally:
            await engine.dispose()

    monkeypatch.setattr(social_api, "realtime_hub", RealtimeHub())
    app = FastAPI(lifespan=memory_lifespan)
    app.include_router(social_api.router)
    with TestClient(app) as client:
        pair = issued[0]
        if use_protocol:
            with client.websocket_connect("/social/ws", subprotocols=[
                "nexamin", f"bearer.{pair.access_token}",
            ]) as socket:
                assert socket.accepted_subprotocol == "nexamin"
                assert pair.access_token not in socket.accepted_subprotocol
                assert client.portal is not None
                client.portal.call(closed[0].clear)
                socket.close()

                async def wait_for_session_cleanup():
                    await asyncio.wait_for(closed[0].wait(), timeout=2)

                client.portal.call(wait_for_session_cleanup)
        else:
            with pytest.raises(WebSocketDisconnect) as denied:
                with client.websocket_connect(f"/social/ws?token={pair.access_token}"):
                    pass
            assert denied.value.code == 4401
