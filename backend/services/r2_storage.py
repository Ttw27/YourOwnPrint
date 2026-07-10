"""Cloudflare R2 object storage.

Replaces the old Emergent-hosted object store (`https://integrations.emergentagent.com/objstore/...`,
gated behind EMERGENT_LLM_KEY), which only works inside the Emergent sandbox.

R2 is S3-compatible, so this uses `boto3`'s S3 client pointed at R2's endpoint.

Required environment variables:
    R2_ACCOUNT_ID       — Cloudflare account ID
    R2_ACCESS_KEY_ID    — R2 API token access key
    R2_SECRET_ACCESS_KEY — R2 API token secret
    R2_BUCKET_NAME      — bucket to store objects in
    R2_PUBLIC_URL       — public base URL for the bucket (custom domain or
                           the bucket's r2.dev URL), no trailing slash.
                           Only needed if you want get_public_url() to work;
                           get_object() reads directly from R2 regardless.
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional, Tuple

import boto3
from botocore.config import Config
from fastapi import HTTPException

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not (account_id and access_key and secret_key):
        return None

    _client = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )
    return _client


def _bucket() -> str:
    return os.environ.get("R2_BUCKET_NAME", "")


def storage_put(path: str, data: bytes, content_type: str) -> dict:
    """Synchronous — call via asyncio.to_thread from async endpoints (see storage_put_async)."""
    client = _get_client()
    bucket = _bucket()
    if not client or not bucket:
        raise HTTPException(500, "Object storage not configured (R2 env vars missing)")
    client.put_object(Bucket=bucket, Key=path, Body=data, ContentType=content_type)
    return {"path": path, "bucket": bucket}


def storage_get(path: str) -> Tuple[bytes, str]:
    client = _get_client()
    bucket = _bucket()
    if not client or not bucket:
        raise HTTPException(404, "Object storage not configured")
    try:
        resp = client.get_object(Bucket=bucket, Key=path)
    except client.exceptions.NoSuchKey:
        raise HTTPException(404, "File not found")
    except Exception as e:
        code = getattr(getattr(e, "response", {}), "get", lambda *_: {})("Error", {}).get("Code") if hasattr(e, "response") else None
        if code == "NoSuchKey":
            raise HTTPException(404, "File not found")
        raise HTTPException(500, f"object-storage fetch failed: {e}")
    data = resp["Body"].read()
    content_type = resp.get("ContentType", "application/octet-stream")
    return data, content_type


async def storage_put_async(path: str, data: bytes, content_type: str) -> dict:
    return await asyncio.to_thread(storage_put, path, data, content_type)


async def storage_get_async(path: str) -> Tuple[bytes, str]:
    return await asyncio.to_thread(storage_get, path)


def get_public_url(path: str) -> Optional[str]:
    base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    if not base:
        return None
    return f"{base}/{path}"


async def mirror_external_image(url: str, folder: str = "imported-products") -> Optional[str]:
    """Downloads an image from an external URL (e.g. a supplier's product page)
    and re-uploads it into R2, returning the new permanent R2 URL.

    Used so imported product photos live on our own storage rather than being
    hotlinked from a supplier's site — if the supplier reorganises or removes
    their images later, ours keep working regardless.

    Returns None (never raises) on any failure — callers should fall back to
    the original URL so one bad image never breaks a whole bulk import.
    """
    import hashlib
    import httpx

    if not url or not url.startswith(("http://", "https://")):
        return None
    # Already one of ours — nothing to do.
    public_base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    if public_base and url.startswith(public_base):
        return url

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; YourOwnPrintBot/1.0)"},
            )
            resp.raise_for_status()
            data = resp.content
            if len(data) > 8_000_000:
                return None  # refuse absurdly large files rather than hang R2 upload
            content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]

        ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(content_type, "jpg")
        digest = hashlib.sha256(url.encode()).hexdigest()[:24]
        path = f"{folder}/{digest}.{ext}"

        await storage_put_async(path, data, content_type)
        return get_public_url(path)
    except Exception:
        return None
