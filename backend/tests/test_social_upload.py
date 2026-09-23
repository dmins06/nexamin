import io

from fastapi import UploadFile

from app.api.v1 import social as social_api


async def test_message_attachment_upload_returns_receivable_url(
    session, users, monkeypatch
) -> None:
    owner, _ = users
    captured: dict[str, object] = {}

    async def fake_upload(key: str, content: bytes, content_type: str) -> None:
        captured.update(key=key, content=content, content_type=content_type)

    monkeypatch.setattr(social_api.local_storage, "upload", fake_upload)
    monkeypatch.setattr(social_api.settings, "storage_provider", "local")
    monkeypatch.setattr(social_api.settings, "media_base_url", "https://studyhub.example/media")
    file = UploadFile(
        filename="lecture notes.txt",
        file=io.BytesIO(b"Shared study notes"),
        headers={"content-type": "text/plain"},
    )

    result = await social_api.upload_message_attachment(session, owner, file)

    assert result.name == "lecture notes.txt"
    assert result.mime_type == "text/plain"
    assert result.url.startswith("https://studyhub.example/media/messages/")
    assert captured["content"] == b"Shared study notes"
    assert captured["content_type"] == "text/plain"


async def test_message_attachment_rejects_unsupported_type(session, users) -> None:
    owner, _ = users
    file = UploadFile(
        filename="program.exe",
        file=io.BytesIO(b"MZ"),
        headers={"content-type": "application/octet-stream"},
    )

    try:
        await social_api.upload_message_attachment(session, owner, file)
    except Exception as error:
        assert getattr(error, "code", None) == "UNSUPPORTED_ATTACHMENT"
    else:
        raise AssertionError("Unsupported attachment should be rejected")
