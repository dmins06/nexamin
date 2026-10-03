import uuid

import pytest

from app.services.private_migration import copy_private_file, private_file_key


class SyntheticStorage:
    def __init__(self, objects=None):
        self.objects = dict(objects or {})
        self.deleted = []
        self.uploaded = []
        self.corrupt = False

    async def download(self, key):
        if key not in self.objects:
            raise FileNotFoundError(key)
        return self.objects[key]

    async def upload(self, key, content, mime):
        self.uploaded.append(key)
        self.objects[key] = b"corrupt" if self.corrupt else content

    async def delete(self, key):
        self.deleted.append(key)
        self.objects.pop(key, None)


@pytest.mark.asyncio
async def test_copy_keeps_source_then_retirement_verifies_identical_private_bytes():
    key = f"messages/{uuid.uuid4()}/{uuid.uuid4()}.txt"
    source = SyntheticStorage({key: b"synthetic"})
    target = SyntheticStorage()
    first = await copy_private_file(key, source.download, target.download, target.upload)
    assert first.copied and not first.retired
    assert source.objects[key] == target.objects[key] == b"synthetic"
    second = await copy_private_file(
        key, source.download, target.download, target.upload, retire_source=source.delete,
    )
    assert not second.copied and second.retired
    assert target.uploaded == [key]
    assert source.deleted == [key]
    assert target.objects[key] == b"synthetic"


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["corrupt-write", "target-collision", "oversize", "read-outage"])
async def test_failure_never_retires_source(failure):
    key = f"messages/{uuid.uuid4()}/{uuid.uuid4()}.txt"
    source = SyntheticStorage({key: b"synthetic"})
    target = SyntheticStorage({key: b"different"} if failure == "target-collision" else {})
    target.corrupt = failure == "corrupt-write"

    async def read_target(storage_key):
        if failure == "read-outage":
            raise ConnectionError("synthetic outage")
        return await target.download(storage_key)

    with pytest.raises((ValueError, ConnectionError)):
        await copy_private_file(
            key, source.download, read_target, target.upload,
            retire_source=source.delete, maximum_bytes=1 if failure == "oversize" else 32,
        )
    assert source.deleted == []
    assert source.objects[key] == b"synthetic"


@pytest.mark.parametrize("key", [
    f"users/{uuid.uuid4()}/avatar/{uuid.uuid4()}.png",
    f"social/{uuid.uuid4()}/{uuid.uuid4()}.png", "../../secret.txt",
    f"messages/{uuid.uuid4()}/{uuid.uuid4()}.html", "",
])
def test_migration_does_not_touch_public_assets_or_untrusted_keys(key):
    assert not private_file_key(key)
