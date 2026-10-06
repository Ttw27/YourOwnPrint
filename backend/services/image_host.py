"""Serve R2 photos from the shop's own image domain.

Every photo URL saved so far (products, portfolio, page images...) points at
Cloudflare's r2.dev test address, which Cloudflare rate-limits and says is not
for production. Once a custom domain is connected to the R2 bucket, set
R2_PUBLIC_URL on Railway to it (e.g. https://images.yourownprint.co.uk) and
this middleware rewrites the old r2.dev address to the new one in every API
response - nothing in the database needs changing, and new uploads already
use R2_PUBLIC_URL. While R2_PUBLIC_URL is still the r2.dev address it does
nothing.
"""
from __future__ import annotations

import os

LEGACY_R2_BASES = (
    b"https://pub-b995388ef13c4c14a498c874668ad48e.r2.dev",
)
_REWRITE_TYPES = (b"application/json", b"application/xml", b"text/xml", b"text/html", b"application/rss+xml")


def _new_base() -> bytes:
    base = os.environ.get("R2_PUBLIC_URL", "").strip().rstrip("/")
    if not base or ".r2.dev" in base:
        return b""
    return base.encode()


class ImageHostMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        new = _new_base()
        if scope["type"] != "http" or not new:
            await self.app(scope, receive, send)
            return
        start = {}
        chunks = []
        passthrough = {"on": False}

        async def _send(message):
            if message["type"] == "http.response.start":
                ctype = b""
                for k, v in message.get("headers", []):
                    if k.lower() == b"content-type":
                        ctype = v.lower()
                if not any(t in ctype for t in _REWRITE_TYPES):
                    passthrough["on"] = True
                    await send(message)
                    return
                start.update(message)
                return
            if message["type"] == "http.response.body":
                if passthrough["on"]:
                    await send(message)
                    return
                chunks.append(message.get("body", b""))
                if message.get("more_body"):
                    return
                body = b"".join(chunks)
                for old in LEGACY_R2_BASES:
                    body = body.replace(old, new)
                headers = [(k, v) for k, v in start.get("headers", []) if k.lower() != b"content-length"]
                headers.append((b"content-length", str(len(body)).encode()))
                await send({**start, "headers": headers})
                await send({"type": "http.response.body", "body": body})
                return
            await send(message)

        await self.app(scope, receive, _send)
