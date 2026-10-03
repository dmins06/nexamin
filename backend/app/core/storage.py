import asyncio
from pathlib import Path
from typing import Protocol

import boto3  # type: ignore[import-untyped]
from botocore.client import BaseClient  # type: ignore[import-untyped]
from vercel.blob import AsyncBlobClient, BlobNotFoundError

from app.config import settings
from app.core.exceptions import AppError

MEDIA_ROOT = Path(__file__).resolve().parents[2] / "media"


class StorageBackend(Protocol):
    async def upload(self, key: str, content: bytes, content_type: str) -> None: ...

    async def download(self, key: str) -> bytes: ...

    async def delete(self, key: str) -> None: ...


class LocalStorage:
    async def upload(self, key: str, content: bytes, content_type: str) -> None:
        del content_type
        destination = (MEDIA_ROOT / key).resolve()
        if MEDIA_ROOT.resolve() not in destination.parents:
            raise ValueError("Invalid storage key")
        await asyncio.to_thread(destination.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(destination.write_bytes, content)

    async def download(self, key: str) -> bytes:
        source = (MEDIA_ROOT / key).resolve()
        if MEDIA_ROOT.resolve() not in source.parents:
            raise ValueError("Invalid storage key")
        return await asyncio.to_thread(source.read_bytes)

    async def delete(self, key: str) -> None:
        target = (MEDIA_ROOT / key).resolve()
        if MEDIA_ROOT.resolve() not in target.parents:
            raise ValueError("Invalid storage key")
        if target.exists():
            await asyncio.to_thread(target.unlink)


class ObjectStorage:
    def __init__(self) -> None:
        self.client: BaseClient = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        )
        self.bucket = settings.s3_bucket

    async def ensure_bucket(self) -> None:
        def ensure() -> None:
            try:
                self.client.head_bucket(Bucket=self.bucket)
            except self.client.exceptions.ClientError:
                self.client.create_bucket(Bucket=self.bucket)

        await asyncio.to_thread(ensure)

    async def upload(self, key: str, content: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            self.client.put_object,
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )

    async def download(self, key: str) -> bytes:
        response = await asyncio.to_thread(self.client.get_object, Bucket=self.bucket, Key=key)
        return await asyncio.to_thread(response["Body"].read)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)


class BlobStorage:
    """Vercel Blob with stable pathnames matching existing document storage keys."""

    async def upload(self, key: str, content: bytes, content_type: str) -> None:
        client = AsyncBlobClient()
        try:
            await client.put(key, content, access="public", content_type=content_type, overwrite=True)
        finally:
            await client.aclose()

    async def download(self, key: str) -> bytes:
        client = AsyncBlobClient()
        try:
            result = await client.get(key, access="public")
            if result is None:
                raise FileNotFoundError(key)
            content = result.content
            if not isinstance(content, bytes):
                raise ValueError("Blob SDK returned invalid content")
            return content
        except BlobNotFoundError as exc:
            raise FileNotFoundError(key) from exc
        finally:
            await client.aclose()

    async def delete(self, key: str) -> None:
        client = AsyncBlobClient()
        try:
            await client.delete(key)
        finally:
            await client.aclose()

    async def public_url(self, key: str) -> str:
        client = AsyncBlobClient()
        try:
            result = await client.head(key)
            url = result.url
            if not isinstance(url, str):
                raise ValueError("Blob URL is missing")
            return url
        except BlobNotFoundError as exc:
            raise FileNotFoundError(key) from exc
        finally:
            await client.aclose()


storage = ObjectStorage()
local_storage = LocalStorage()
blob_storage = BlobStorage()


class PrivateBlobStorage:
    """Private writes; authorized legacy reads while the migration is staged.

    Never returns a public URL. Existing public copies must be retired separately
    after verified migration; this adapter alone cannot revoke their old URLs.
    """

    def _client(self) -> AsyncBlobClient:
        if not settings.private_blob_read_write_token:
            raise AppError(
                "PRIVATE_STORAGE_NOT_CONFIGURED",
                "Chưa cấu hình lưu trữ riêng tư. Không tải file lên kho công khai.", 503,
            )
        return AsyncBlobClient(token=settings.private_blob_read_write_token)

    async def upload(self, key: str, content: bytes, content_type: str) -> None:
        client = self._client()
        try:
            await client.put(
                key, content, access="private", content_type=content_type, overwrite=True,
                cache_control_max_age=60,
            )
        finally:
            await client.aclose()

    async def download(self, key: str) -> bytes:
        if settings.private_blob_read_write_token:
            try:
                return await self.download_private(key)
            except FileNotFoundError:
                pass
        # Only called after API ownership/participant authorization (or trusted
        # document processing). No fallback on permission/network errors.
        return await blob_storage.download(key)

    async def download_private(self, key: str) -> bytes:
        """Strict read for copy verification: no public fallback is permitted."""
        client = self._client()
        try:
            result = await client.get(key, access="private", use_cache=False)
            if result is None:
                raise FileNotFoundError(key)
            content = result.content
            if not isinstance(content, bytes):
                raise ValueError("Blob SDK returned invalid content")
            return content
        except BlobNotFoundError as exc:
            raise FileNotFoundError(key) from exc
        finally:
            await client.aclose()

    async def delete(self, key: str) -> None:
        if settings.private_blob_read_write_token:
            client = self._client()
            try:
                await client.delete(key)
            except BlobNotFoundError:
                pass
            finally:
                await client.aclose()
        try:
            await blob_storage.delete(key)
        except BlobNotFoundError:
            pass


private_blob_storage = PrivateBlobStorage()


def selected_storage() -> StorageBackend:
    if settings.storage_provider == "s3":
        return storage
    if settings.storage_provider == "blob":
        return private_blob_storage
    return local_storage
