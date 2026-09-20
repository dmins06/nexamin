import asyncio
from pathlib import Path
from typing import Protocol

import boto3  # type: ignore[import-untyped]
from botocore.client import BaseClient  # type: ignore[import-untyped]

from app.config import settings

MEDIA_ROOT = Path(__file__).resolve().parents[2] / "media"


class StorageBackend(Protocol):
    async def upload(self, key: str, content: bytes, content_type: str) -> None: ...

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


storage = ObjectStorage()
local_storage = LocalStorage()
