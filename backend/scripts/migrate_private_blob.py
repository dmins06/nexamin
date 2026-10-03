"""Stage private copies of course/direct-message files; dry-run by default.

Needs public BLOB_READ_WRITE_TOKEN and a separate PRIVATE_BLOB_READ_WRITE_TOKEN.
--apply copies and verifies; --apply --retire-public also removes verified public
copies. No DB mutation, no token/content output, no avatar/post deletion.
"""

import argparse
import asyncio
import os

from vercel.blob import AsyncBlobClient

from app.config import settings
from app.core.storage import blob_storage, private_blob_storage
from app.services.private_migration import copy_private_file, private_file_key


async def migrate(*, apply: bool, retire_public: bool) -> int:
    public_token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    if not public_token:
        raise ValueError("Public store token is required for inventory")
    if retire_public and not apply:
        raise ValueError("Retirement requires --apply; dry-run never deletes")
    if apply and (
        not settings.private_blob_read_write_token
        or settings.private_blob_read_write_token == public_token
    ):
        raise ValueError("A separate private store token is required")
    if apply and not settings.private_file_writes_paused:
        raise ValueError("Pause private-file writes on the deployed backend before migration")
    public = AsyncBlobClient(token=public_token)
    inventory: list[tuple[str, int]] = []
    try:
        objects = await public.iter_objects(batch_size=100)
        async for item in objects:
            if not private_file_key(item.pathname):
                continue
            if item.size > 32 * 1024 * 1024 or item.size <= 0:
                raise ValueError("A private file exceeds the size bound; no retirement attempted")
            inventory.append((item.pathname, item.size))
            if len(inventory) > 100000:
                raise ValueError("Inventory bound reached; stop and review the migration")
        # Finish preflight before mutation; deleting while paginating can change
        # the listing and must not silently skip files on subsequent pages.
        for key, size in inventory:
            print(f"{'COPY' if apply else 'CHECK'} {key} ({size} bytes)")
            if apply:
                result = await copy_private_file(
                    key, blob_storage.download, private_blob_storage.download_private,
                    private_blob_storage.upload,
                    retire_source=public.delete if retire_public else None,
                )
                print(f"VERIFIED {result.size} bytes; public_retired={result.retired}")
    finally:
        await public.aclose()
    print(f"Private files checked: {len(inventory)}; apply={apply}; retire_public={retire_public}")
    return len(inventory)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--retire-public", action="store_true")
    args = parser.parse_args()
    try:
        asyncio.run(migrate(apply=args.apply, retire_public=args.retire_public))
    except Exception as exc:
        # SDK/network exceptions may contain signed URLs. Do not print raw text.
        raise SystemExit(f"Migration stopped ({type(exc).__name__}); review configuration/copy checks before retry.") from None


if __name__ == "__main__":
    main()
