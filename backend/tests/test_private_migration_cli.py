"""Exercise the migration CLI's SDK contract and preflight ordering."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from unittest.mock import AsyncMock

import pytest

from app.services.private_migration import CopyResult
from scripts import migrate_private_blob as cli

PRIVATE_KEY = "messages/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.txt"
PUBLIC_KEY = "social/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png"


@dataclass(frozen=True)
class ListedObject:
    pathname: str
    size: int


class InventoryClient:
    def __init__(self, items: list[ListedObject]) -> None:
        self.items = items
        self.finished_listing = False
        self.closed = False
        self.delete = AsyncMock()

    async def iter_objects(self, *, batch_size: int) -> AsyncIterator[ListedObject]:
        # vercel 0.11 returns the iterator from a coroutine, rather than
        # exposing an async generator directly on AsyncBlobClient.
        assert batch_size == 100

        async def objects() -> AsyncIterator[ListedObject]:
            for item in self.items:
                yield item
            self.finished_listing = True

        return objects()

    async def aclose(self) -> None:
        self.closed = True


def configure(monkeypatch: pytest.MonkeyPatch, client: InventoryClient) -> AsyncMock:
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "synthetic-public-token")
    monkeypatch.setattr(cli.settings, "private_blob_read_write_token", "synthetic-private-token")
    monkeypatch.setattr(cli.settings, "private_file_writes_paused", True)
    monkeypatch.setattr(cli, "AsyncBlobClient", lambda *, token: client)

    async def copy_after_preflight(*args: object, **kwargs: object) -> CopyResult:
        assert client.finished_listing
        return CopyResult(size=9, copied=True, retired=kwargs.get("retire_source") is not None)

    copy = AsyncMock(side_effect=copy_after_preflight)
    monkeypatch.setattr(cli, "copy_private_file", copy)
    return copy


@pytest.mark.asyncio
async def test_cli_dry_run_awaits_sdk_inventory_and_never_copies_or_deletes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = InventoryClient([ListedObject(PRIVATE_KEY, 9), ListedObject(PUBLIC_KEY, 9)])
    copy = configure(monkeypatch, client)
    assert await cli.migrate(apply=False, retire_public=False) == 1
    copy.assert_not_awaited()
    client.delete.assert_not_awaited()
    assert client.finished_listing and client.closed


@pytest.mark.asyncio
async def test_cli_retirement_starts_only_after_inventory_finishes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = InventoryClient([ListedObject(PRIVATE_KEY, 9), ListedObject(PUBLIC_KEY, 9)])
    copy = configure(monkeypatch, client)
    assert await cli.migrate(apply=True, retire_public=True) == 1
    copy.assert_awaited_once_with(
        PRIVATE_KEY, cli.blob_storage.download, cli.private_blob_storage.download_private,
        cli.private_blob_storage.upload, retire_source=client.delete,
    )
    assert client.closed


@pytest.mark.asyncio
async def test_cli_invalid_later_inventory_item_prevents_all_mutations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = InventoryClient([ListedObject(PRIVATE_KEY, 9), ListedObject(PRIVATE_KEY, 0)])
    copy = configure(monkeypatch, client)
    with pytest.raises(ValueError, match="size bound"):
        await cli.migrate(apply=True, retire_public=True)
    copy.assert_not_awaited()
    client.delete.assert_not_awaited()
    assert client.closed
