"""Designer AI endpoints — remove.bg background removal, Cutout.pro effects,
and an admin `test-email` endpoint that pings Resend using the currently-saved key.

Handlers previously lived at the bottom of server.py; extracted here so the
DYO canvas has a clean home for future AI wizardry (auto-vectorise, smart
colour picker, safe-print bounds, etc.).
"""
from __future__ import annotations

import base64
from typing import Dict

import httpx
from fastapi import Depends, HTTPException

from deps import api_router, require_admin, _get_integration_value
from services.email import email_wrap, send_email


# ---------------------------------------------------------------------------
# Admin: send a test email via Resend
# ---------------------------------------------------------------------------
@api_router.post("/admin/test-email", dependencies=[Depends(require_admin)])
async def admin_test_email(payload: Dict):
    """Admin helper — POST {to} to send a Resend test email using the saved key."""
    to = (payload.get("to") or "").strip()
    if not to:
        raise HTTPException(400, "`to` required")
    return await send_email(
        to=[to],
        subject="Your Own Print — Resend test email",
        html=email_wrap(
            "Resend is wired up ✅",
            "<p>This is a test email from your Your Own Print admin dashboard. "
            "If you're seeing this, your Resend API key is working.</p>",
        ),
    )


# ---------------------------------------------------------------------------
# remove.bg — strip background from the currently-selected image
# ---------------------------------------------------------------------------
@api_router.post("/designer/remove-bg")
async def designer_remove_bg(payload: Dict):
    """Accepts {image_base64} (data URL or raw base64) and returns
    {image_base64: 'data:image/png;base64,...'} with the background stripped.
    Raises 503 when the API key isn't set so the UI can prompt the admin."""
    img = (payload.get("image_base64") or "").strip()
    if not img:
        raise HTTPException(400, "image_base64 required")
    b64 = img.split(",", 1)[1] if img.startswith("data:") else img
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(400, "image_base64 is not valid base64")
    if len(raw) > 22 * 1024 * 1024:
        raise HTTPException(413, "Image exceeds 22MB (remove.bg limit)")
    api_key = await _get_integration_value("removebg_api_key")
    if not api_key:
        raise HTTPException(503, "remove.bg API key not configured — paste it in /admin/integrations")
    try:
        async with httpx.AsyncClient(timeout=45.0) as http:
            resp = await http.post(
                "https://api.remove.bg/v1.0/removebg",
                files={"image_file": ("upload.png", raw, "image/png")},
                data={"size": "auto"},
                headers={"X-Api-Key": api_key},
            )
    except httpx.TimeoutException:
        raise HTTPException(504, "remove.bg timed out — try a smaller image")
    except Exception as e:
        raise HTTPException(502, f"remove.bg error: {e}")
    if resp.status_code != 200:
        try:
            detail = resp.json().get("errors", [{}])[0].get("title") or resp.text[:180]
        except Exception:
            detail = resp.text[:180]
        raise HTTPException(resp.status_code, f"remove.bg: {detail}")
    out_b64 = base64.b64encode(resp.content).decode("ascii")
    return {"image_base64": f"data:image/png;base64,{out_b64}"}


# ---------------------------------------------------------------------------
# Cutout.pro — AI image effects (sketch / cartoon / poster / enhance)
# ---------------------------------------------------------------------------
_CUTOUT_EFFECT_MAP = {
    "sketch": "https://www.cutout.pro/api/v1/photoEnhance/sketchImage",
    "cartoon": "https://www.cutout.pro/api/v1/photoEnhance/aiCartoon",
    "poster": "https://www.cutout.pro/api/v1/photoEnhance/poster",
    "enhance": "https://www.cutout.pro/api/v1/matting/photoEnhance",
}


@api_router.post("/designer/ai-effect")
async def designer_ai_effect(payload: Dict):
    """Applies a Cutout.pro effect. Payload: {image_base64, effect} where
    effect ∈ {"sketch","cartoon","poster","enhance"}."""
    img = (payload.get("image_base64") or "").strip()
    effect = (payload.get("effect") or "cartoon").strip().lower()
    if effect not in _CUTOUT_EFFECT_MAP:
        raise HTTPException(400, f"effect must be one of {list(_CUTOUT_EFFECT_MAP)}")
    if not img:
        raise HTTPException(400, "image_base64 required")
    b64 = img.split(",", 1)[1] if img.startswith("data:") else img
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(400, "image_base64 is not valid base64")
    api_key = await _get_integration_value("cutoutpro_api_key")
    if not api_key:
        raise HTTPException(503, "Cutout.pro API key not configured — paste it in /admin/integrations")
    try:
        async with httpx.AsyncClient(timeout=60.0) as http:
            resp = await http.post(
                _CUTOUT_EFFECT_MAP[effect],
                files={"file": ("upload.png", raw, "image/png")},
                headers={"APIKEY": api_key},
            )
    except httpx.TimeoutException:
        raise HTTPException(504, "Cutout.pro timed out — try a smaller image")
    except Exception as e:
        raise HTTPException(502, f"Cutout.pro error: {e}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Cutout.pro: {resp.text[:180]}")
    try:
        j = resp.json()
        d = j.get("data") or {}
        out_b64 = d.get("imageBase64")
        out_url = d.get("imageUrl") or d.get("resultImageUrl")
        if out_b64:
            return {"image_base64": f"data:image/png;base64,{out_b64}"}
        if out_url:
            return {"image_url": out_url}
        raise HTTPException(502, f"Cutout.pro unexpected response: {str(j)[:180]}")
    except HTTPException:
        raise
    except Exception:
        # Some endpoints return raw image bytes on success
        out_b64 = base64.b64encode(resp.content).decode("ascii")
        return {"image_base64": f"data:image/png;base64,{out_b64}"}
