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
