"""Page copy CMS — public GET + admin PATCH/DELETE/slugs. Fully self-contained
(only needs db + auth), so it lives in a router of its own.

Slug allow-list keeps the admin UI focused and prevents typos.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from deps import api_router, db, require_admin


# Allow-list of page slugs — keeps admin UI focused + prevents typos.
PAGE_COPY_SLUGS = [
    "home", "contact", "sports", "workwear", "portfolio", "reviews",
    "teams-schools", "specials", "fight-night", "leavers-hoodies",
    "kit-your-workforce", "design-your-own", "full-squad-configurator",
    "sports-outfit-configurator", "team-kits", "team-kit-builder",
    "festival-tees-brands",
]


class PageCopyPatch(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    subtitle: Optional[str] = Field(default=None, max_length=400)
    body: Optional[str] = Field(default=None, max_length=20000)
    bullets: Optional[List[str]] = None
    faq: Optional[List[Dict]] = None
    cta_label: Optional[str] = Field(default=None, max_length=80)
    cta_link: Optional[str] = Field(default=None, max_length=500)
    extras: Optional[Dict] = None
    # Admin-editable imagery. Previously every marketing image (homepage hero,
    # the sector tiles, etc.) was hardcoded in the frontend source, so the only
    # way to change one was to edit a file — which meant a later code change to
    # that same file could silently overwrite it. Stored here they live in the
    # database instead and survive every deploy.
    hero_image: Optional[str] = Field(default=None, max_length=1000)
    images: Optional[Dict[str, str]] = None  # arbitrary named slots, e.g. {"sector:Healthcare": "https://…"}
    # Richer media slots that can hold a still OR a short looping clip, plus the
    # aspect ratio to display it at. Kept separate from `images` so existing
    # image-only slots stay simple.
    #   {"promo": {"url": "...", "kind": "video", "ratio": "9:16"}}
    media: Optional[Dict[str, Dict[str, str]]] = None


@api_router.get("/page-copy/{slug}")
async def get_page_copy(slug: str):
    """Public — returns admin-editable copy for a page, or {} if never edited."""
    if slug not in PAGE_COPY_SLUGS:
        raise HTTPException(404, "Unknown page slug")
    doc = await db.settings.find_one({"key": f"page_copy:{slug}"})
    if not doc:
        return {}
    return {
        k: doc.get(k)
        for k in ("title", "subtitle", "body", "bullets", "faq", "cta_label", "cta_link", "extras", "hero_image", "images", "media")
        if doc.get(k) is not None
    }


@api_router.patch("/admin/page-copy/{slug}", dependencies=[Depends(require_admin)])
async def admin_update_page_copy(slug: str, patch: PageCopyPatch):
    if slug not in PAGE_COPY_SLUGS:
        raise HTTPException(400, f"Slug must be one of: {PAGE_COPY_SLUGS}")
    up = patch.model_dump(exclude_none=True)
    if up.get("faq") is not None:
        up["faq"] = [
            {"q": (f.get("q") or "")[:200], "a": (f.get("a") or "")[:1000]}
            for f in up["faq"][:30]
            if isinstance(f, dict) and (f.get("q") or "").strip()
        ]
    up["key"] = f"page_copy:{slug}"
    up["slug"] = slug
    up["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"key": up["key"]}, {"$set": up}, upsert=True)
    return {"ok": True, "slug": slug, "copy": {k: v for k, v in up.items() if k not in ("key", "slug", "updated_at")}}


@api_router.delete("/admin/page-copy/{slug}", dependencies=[Depends(require_admin)])
async def admin_delete_page_copy(slug: str):
    if slug not in PAGE_COPY_SLUGS:
        raise HTTPException(400, f"Slug must be one of: {PAGE_COPY_SLUGS}")
    r = await db.settings.delete_one({"key": f"page_copy:{slug}"})
    return {"ok": True, "deleted": r.deleted_count}


@api_router.get("/admin/page-copy-slugs", dependencies=[Depends(require_admin)])
async def admin_list_page_copy_slugs():
    return {"slugs": PAGE_COPY_SLUGS}
