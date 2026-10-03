"""Private-file regression; synthetic users/storage, never cloud or user data."""

import io
import json
import uuid
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, UploadFile
from fastapi.staticfiles import StaticFiles
from sqlalchemy import update

from app.api.v1 import documents, social
from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.database import get_db
from app.models import Course, DirectMessage, Document, RefreshToken, Role, User
from app.services.auth import AuthService


@pytest_asyncio.fixture
async def private_api(session, users, monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", "synthetic-private-file-test-key-not-production")
    monkeypatch.setattr(settings, "media_base_url", "https://synthetic.example/media")
    app = FastAPI()
    app.include_router(documents.router, prefix="/api/v1")
    app.include_router(social.router, prefix="/api/v1")
    register_exception_handlers(app)

    async def db():
        yield session

    app.dependency_overrides[get_db] = db
    headers = []
    for user in users:
        pair = await AuthService(session)._issue_pair(user)
        headers.append({"Authorization": f"Bearer {pair.access_token}"})
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1"
    ) as client:
        yield client, headers


async def make_document(session, owner):
    course = Course(id=uuid.uuid4(), owner_id=owner.id, name="Synthetic private course")
    session.add(course)
    await session.flush()
    document_id = uuid.uuid4()
    document = Document(
        id=document_id, user_id=owner.id, course_id=course.id,
        filename="fixture.txt", original_filename="fixture.txt", mime_type="text/plain",
        size=9, storage_key=f"users/{owner.id}/courses/{course.id}/{document_id}.txt",
    )
    session.add(document)
    await session.commit()
    return document


@pytest.mark.asyncio
async def test_document_download_requires_owner_and_does_not_redirect_to_public_blob(
    session, users, private_api, monkeypatch,
):
    document = await make_document(session, users[0])
    client, headers = private_api
    calls = []

    async def download(key):
        calls.append(key)
        return b"synthetic"

    monkeypatch.setattr(documents.document_storage(), "download", download)
    url = f"/api/v1/documents/{document.id}/download"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=headers[1])).status_code == 404
    assert calls == []
    response = await client.get(url, headers=headers[0])
    assert response.status_code == 200
    assert response.content == b"synthetic"
    assert "location" not in response.headers
    assert response.headers["cache-control"] == "private, no-store"
    assert "attachment" in response.headers["content-disposition"]
    assert calls == [document.storage_key]
    await session.execute(update(RefreshToken).where(
        RefreshToken.user_id == users[0].id,
    ).values(revoked_at=datetime.now(UTC)))
    await session.commit()
    assert (await client.get(url, headers=headers[0])).status_code == 401
    assert calls == [document.storage_key]


@pytest.mark.asyncio
async def test_message_attachment_is_only_readable_by_participants_not_admin(
    session, users, private_api, monkeypatch,
):
    from app.services import private_files

    owner, recipient = users
    key = f"messages/{owner.id}/{uuid.uuid4()}.txt"
    message = DirectMessage(sender_id=owner.id, recipient_id=recipient.id, content=json.dumps({
        "text": "Synthetic", "attachment": {
            "url": f"https://synthetic.example/media/{key}",
            "name": "fixture.txt", "mime_type": "text/plain",
        },
    }))
    admin = User(email="private-fixture-admin@example.edu", full_name="Admin", role=Role.ADMIN)
    session.add_all([message, admin])
    await session.commit()
    pair = await AuthService(session)._issue_pair(admin)
    calls = []

    class MemoryStorage:
        async def download(self, storage_key):
            calls.append(storage_key)
            return b"synthetic"

    monkeypatch.setattr(private_files, "selected_storage", lambda: MemoryStorage())
    client, headers = private_api
    url = f"/api/v1/social/messages/{message.id}/attachment"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers={"Authorization": f"Bearer {pair.access_token}"})).status_code == 404
    assert calls == []
    for auth in headers:
        response = await client.get(url, headers=auth)
        assert response.status_code == 200
        assert response.content == b"synthetic"
        assert response.headers["cache-control"] == "private, no-store"
        assert "location" not in response.headers
    assert calls == [key, key]


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "https://attacker.invalid/media/messages/{owner}/{file}.txt",
    "https://synthetic.example/media/messages/{other}/{file}.txt",
    "https://synthetic.example/media/messages/{owner}/../secret.txt",
    "javascript:alert(1)",
    "https://synthetic.example/media/messages/{owner}/{file}.html",
])
async def test_forged_attachment_cannot_read_other_owner_or_fetch_arbitrary_url(
    session, users, private_api, url,
):
    owner, recipient = users
    message = DirectMessage(sender_id=owner.id, recipient_id=recipient.id, content=json.dumps({
        "attachment": {"url": url.format(owner=owner.id, other=recipient.id, file=uuid.uuid4()),
                       "name": "fixture.txt", "mime_type": "text/plain"},
    }))
    session.add(message)
    await session.commit()
    client, headers = private_api
    assert (await client.get(
        f"/api/v1/social/messages/{message.id}/attachment", headers=headers[1]
    )).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["document", "message"])
async def test_old_media_urls_are_not_public_even_when_local_file_exists(
    tmp_path, monkeypatch, kind,
):
    from app import main

    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    key = (f"users/{uuid.uuid4()}/courses/{uuid.uuid4()}/{uuid.uuid4()}.txt"
           if kind == "document" else f"messages/{uuid.uuid4()}/{uuid.uuid4()}.txt")
    fixture = tmp_path / key
    fixture.parent.mkdir(parents=True)
    fixture.write_bytes(b"SYNTHETIC_ONLY")
    monkeypatch.setattr(main, "MEDIA_ROOT", tmp_path)
    # Repoint the old mount to the same synthetic fixture before the fix.
    for route in main.app.routes:
        if getattr(route, "path", None) == "/media":
            monkeypatch.setattr(route, "app", StaticFiles(directory=tmp_path))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app), base_url="http://127.0.0.1"
    ) as client:
        response = await client.get(f"/media/{key}")
    assert response.status_code == 404
    assert b"SYNTHETIC_ONLY" not in response.content


@pytest.mark.asyncio
async def test_missing_private_blob_configuration_cannot_silently_upload_public(monkeypatch):
    from app.core import storage as storage_module
    from app.core.exceptions import AppError
    from app.core.storage import selected_storage

    monkeypatch.setattr(settings, "storage_provider", "blob")
    monkeypatch.setattr(settings, "private_blob_read_write_token", "", raising=False)
    class NeverCloudClient:
        def __init__(self, *args, **kwargs):
            raise AssertionError("Missing private configuration must not call any cloud client")
    monkeypatch.setattr(storage_module, "AsyncBlobClient", NeverCloudClient)
    with pytest.raises(AppError, match="riêng tư"):
        await selected_storage().upload(
            f"messages/{uuid.uuid4()}/{uuid.uuid4()}.txt", b"synthetic", "text/plain"
        )


@pytest.mark.asyncio
async def test_private_sdk_uses_private_access_and_closes_client_after_read(monkeypatch):
    from datetime import UTC, datetime

    from vercel.blob.types import GetBlobResult

    from app.core import storage as storage_module

    monkeypatch.setattr(settings, "private_blob_read_write_token", "synthetic-private-store-token")
    calls = []

    class Client:
        def __init__(self, *, token):
            assert token == "synthetic-private-store-token"

        async def put(self, key, content, **kwargs):
            assert kwargs["access"] == "private"
            calls.append("upload")

        async def get(self, key, **kwargs):
            assert kwargs == {"access": "private", "use_cache": False}
            calls.append("read")
            return GetBlobResult(
                url="https://synthetic.private.blob.vercel-storage.com/fixture.txt",
                download_url="https://synthetic.private.blob.vercel-storage.com/fixture.txt",
                pathname="fixture.txt", content_type="text/plain", size=9,
                content_disposition="attachment", cache_control="private, no-store",
                uploaded_at=datetime.now(UTC), etag="synthetic", content=b"synthetic",
                status_code=200,
            )

        async def aclose(self):
            calls.append("close")

    monkeypatch.setattr(storage_module, "AsyncBlobClient", Client)
    backend = storage_module.PrivateBlobStorage()
    await backend.upload("synthetic-key", b"synthetic", "text/plain")
    assert await backend.download_private("synthetic-key") == b"synthetic"
    assert calls == ["upload", "close", "read", "close"]


@pytest.mark.asyncio
async def test_public_legacy_download_uses_sdk_content_bytes(monkeypatch):
    from datetime import UTC, datetime

    from vercel.blob.types import GetBlobResult

    from app.core import storage as storage_module

    calls = []

    class Client:
        async def get(self, key, **kwargs):
            assert kwargs == {"access": "public"}
            calls.append("read")
            return GetBlobResult(
                url="https://synthetic.public.blob.vercel-storage.com/fixture.txt",
                download_url="https://synthetic.public.blob.vercel-storage.com/fixture.txt",
                pathname="fixture.txt", content_type="text/plain", size=9,
                content_disposition="attachment", cache_control="public",
                uploaded_at=datetime.now(UTC), etag="synthetic", content=b"synthetic",
                status_code=200,
            )

        async def aclose(self):
            calls.append("close")

    monkeypatch.setattr(storage_module, "AsyncBlobClient", Client)
    assert await storage_module.BlobStorage().download("fixture.txt") == b"synthetic"
    assert calls == ["read", "close"]


@pytest.mark.asyncio
async def test_private_read_outage_cannot_fall_back_to_public(monkeypatch):
    from app.core import storage as storage_module

    monkeypatch.setattr(settings, "private_blob_read_write_token", "synthetic-private-store-token")
    backend = storage_module.PrivateBlobStorage()

    async def outage(key):
        raise ConnectionError("synthetic outage")

    async def never_public(key):
        raise AssertionError("Access/network failures must not fall back to public")

    monkeypatch.setattr(backend, "download_private", outage)
    monkeypatch.setattr(storage_module.blob_storage, "download", never_public)
    with pytest.raises(ConnectionError):
        await backend.download("synthetic-key")


@pytest.mark.asyncio
async def test_migration_pause_preserves_documents_and_refuses_new_private_uploads(
    session, users, monkeypatch,
):
    from app.core.exceptions import AppError
    from app.services.documents import DocumentService

    owner = users[0]
    document = await make_document(session, owner)
    monkeypatch.setattr(settings, "private_file_writes_paused", True)
    class NeverMutate:
        async def delete(self, key):
            raise AssertionError("Must not delete during migration")
        async def upload(self, key, content, mime):
            raise AssertionError("Must not upload during migration")
    service = DocumentService(session, owner.id, NeverMutate())
    with pytest.raises(AppError, match="bảo trì"):
        await service.delete(document.id)
    assert await session.get(Document, document.id) is document
    with pytest.raises(AppError, match="bảo trì"):
        await service.upload(document.course_id, UploadFile(filename="fixture.txt", file=io.BytesIO(b"synthetic")))
    with pytest.raises(AppError, match="bảo trì"):
        await social.upload_message_attachment(
            session, owner, UploadFile(filename="fixture.txt", file=io.BytesIO(b"synthetic")),
        )


@pytest.mark.asyncio
async def test_public_avatar_and_post_paths_still_work_with_private_routes(tmp_path, monkeypatch):
    from app import main

    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    monkeypatch.setattr(settings, "storage_provider", "local")
    monkeypatch.setattr(main, "MEDIA_ROOT", tmp_path)
    keys = [f"users/{uuid.uuid4()}/avatar/{uuid.uuid4()}.png", f"social/{uuid.uuid4()}/{uuid.uuid4()}.png"]
    for key in keys:
        fixture = tmp_path / key
        fixture.parent.mkdir(parents=True)
        fixture.write_bytes(b"SYNTHETIC_PUBLIC_IMAGE")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app), base_url="http://127.0.0.1",
    ) as client:
        for key in keys:
            response = await client.get(f"/media/{key}")
            assert response.status_code == 200
            assert response.content == b"SYNTHETIC_PUBLIC_IMAGE"


@pytest.mark.asyncio
async def test_missing_public_blob_image_returns_404_and_closes_client(monkeypatch):
    from app import main
    from app.core import storage as storage_module

    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    monkeypatch.setattr(settings, "storage_provider", "blob")
    closed = []

    class MissingBlobClient:
        async def head(self, key):
            raise storage_module.BlobNotFoundError()

        async def aclose(self):
            closed.append(True)

    monkeypatch.setattr(storage_module, "AsyncBlobClient", MissingBlobClient)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app), base_url="http://127.0.0.1",
    ) as client:
        response = await client.get(f"/media/users/{uuid.uuid4()}/avatar/{uuid.uuid4()}.png")
    assert response.status_code == 404
    assert closed == [True]
