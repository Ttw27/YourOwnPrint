"""
Image Health — find products whose main image is broken or missing.

Some products (early manual imports, dead supplier CDN links) ended up with an
image URL that no longer loads. This tool scans the catalogue, checks each main
image actually responds, and reports the broken ones so you can either jump
straight to a product to fix it, or bulk-hide the broken ones from the live site
so customers never see a broken card.

Endpoints (all admin-only):
  POST /admin/image-health/scan    → check images, return the broken list + counts
  POST /admin/image-health/hide    → set active=false on the given product ids
  POST /admin/image-health/unhide  → set active=true on the given product ids

Nothing is changed by a scan — it's read-only. Hiding is an explicit second step.
"""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional

import httpx
from fastapi import Depends
from pydantic import BaseModel

from deps import api_router, db, require_admin


class ScanIn(BaseModel):
    limit: int = 4000          # safety cap
    check_urls: bool = True    # actually HEAD-check each URL (vs just empties)


class HideIn(BaseModel):
    product_ids: List[str]


def _looks_missing(url: Optional[str]) -> bool:
    """Obvious problems we can spot without a network call."""
    if not url or not isinstance(url, str):
        return True
    u = url.strip()
    if not u:
        return True
    if not (u.startswith("http://") or u.startswith("https://") or u.startswith("data:")):
        return True
    return False


async def _url_ok(client: httpx.AsyncClient, url: str) -> bool:
    """Return True unless the image is DEFINITIVELY gone (404/410).

    Server-side image checks get blocked by many supplier CDNs (pimber.ly,
    Ralawise, etc.) — they return 403 or time out for a bot even though the image
    loads perfectly in a customer's browser. Treating those as "broken" produces
    thousands of false alarms, so we only mark an image broken when the server
    gives a definitive "gone" (404/410) or the URL is malformed. Blocks, timeouts
    and other errors are treated as OK (assume it loads for real visitors)."""
    if not url or url.startswith("data:"):
        return bool(url)
    browser_headers = {
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.yourownprint.co.uk/",
    }
    try:
        r = await client.head(url, headers=browser_headers, follow_redirects=True)
        if r.status_code in (404, 410):
            return False
        if r.status_code == 405:  # HEAD not allowed — try a tiny GET
            r = await client.get(url, headers={**browser_headers, "Range": "bytes=0-0"}, follow_redirects=True)
            if r.status_code in (404, 410):
                return False
        # Any other outcome (200, 403 block, timeout handled below) → assume OK.
        return True
    except Exception:
        # Timeout / connection blocked → NOT evidence the image is broken.
        return True


@api_router.post("/admin/image-health/scan", dependencies=[Depends(require_admin)])
async def image_health_scan(payload: ScanIn):
    """Scan products and return which have a broken/missing main image."""
    from server import PRODUCTS  # local import avoids cycle

    products = list(PRODUCTS.values())[: max(1, payload.limit)]

    # Stage 1: obvious empties/malformed (no network needed).
    definitely_bad = []
    to_check = []
    for p in products:
        img = p.get("image")
        if _looks_missing(img):
            definitely_bad.append((p, "missing"))
        else:
            to_check.append(p)

    # Stage 2: network-check the rest (only if asked; capped concurrency).
    checked_bad = []
    checked_count = 0
    if payload.check_urls and to_check:
        sem = asyncio.Semaphore(20)
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            async def _one(p):
                async with sem:
                    ok = await _url_ok(client, p["image"])
                    return p, ok
            results = await asyncio.gather(*[_one(p) for p in to_check])
        for p, ok in results:
            checked_count += 1
            if not ok:
                checked_bad.append((p, "unreachable"))

    broken = definitely_bad + checked_bad
    # Sort: active (still live, most urgent) first, then by name.
    broken.sort(key=lambda t: (not t[0].get("active", True), str(t[0].get("name") or "")))

    items = [{
        "id": p["id"],
        "name": p.get("name") or "(unnamed)",
        "category": p.get("category") or "",
        "image": p.get("image") or "",
        "reason": reason,
        "active": bool(p.get("active", True)),
        "source": p.get("source") or p.get("_source") or "native",
    } for (p, reason) in broken]

    live_broken = sum(1 for it in items if it["active"])
    return {
        "ok": True,
        "total_products": len(products),
        "checked": checked_count,
        "broken_count": len(items),
        "live_broken_count": live_broken,     # broken AND still visible to customers
        "hidden_broken_count": len(items) - live_broken,
        "items": items,
    }


async def _set_active(product_ids: List[str], active: bool) -> int:
    from server import _apply_imported_product, PRODUCTS
    changed = 0
    for pid in product_ids:
        res = await db.imported_products.update_one({"id": pid}, {"$set": {"active": active}})
        if res.matched_count:
            changed += 1
            # keep in-memory catalogue in sync
            doc = await db.imported_products.find_one({"id": pid})
            if doc:
                _apply_imported_product(doc)
        elif pid in PRODUCTS:
            # non-imported (seed) product — update memory directly
            PRODUCTS[pid]["active"] = active
            changed += 1
    return changed


@api_router.post("/admin/image-health/hide", dependencies=[Depends(require_admin)])
async def image_health_hide(payload: HideIn):
    """Hide (active=false) the given products so they drop off the live site."""
    n = await _set_active(payload.product_ids, False)
    return {"ok": True, "hidden": n}


@api_router.post("/admin/image-health/unhide", dependencies=[Depends(require_admin)])
async def image_health_unhide(payload: HideIn):
    """Un-hide (active=true) the given products."""
    n = await _set_active(payload.product_ids, True)
    return {"ok": True, "unhidden": n}
