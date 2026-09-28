"""
Proof maker (admin) - /admin/proof/*

Lets admin mock up a customer's logo on any catalogue product + colour and
download a watermarked proof. The browser builds the proof on a <canvas>, and
a canvas can only be exported if the garment photo is CORS-readable - supplier
CDNs (and possibly R2) aren't, so the photo is fetched here and passed through.

The photo endpoint only ever fetches the photo that belongs to a real product
and colour - never a caller-supplied URL - so it can't be used as an open proxy.
"""
from __future__ import annotations

from typing import Dict, Optional

import httpx
from fastapi import Depends, HTTPException, Response

from deps import api_router, require_admin

# Supplier CDNs block obvious bots (see CLAUDE.md), so look like a browser.
_BROWSER_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://www.yourownprint.co.uk/",
}
_MAX_BYTES = 10_000_000


def _get_product(pid: str) -> Dict:
    from server import PRODUCTS  # local import avoids a cycle
    p = PRODUCTS.get(pid)
    if not p:
        raise HTTPException(404, "Product not found")
    return p


def _colour_photos(p: Dict) -> Dict[str, str]:
    """Colour name -> photo URL. Designer photos (set per colour in admin) win
    over the supplier's per-colour photos, as they're chosen for mock-ups."""
    out: Dict[str, str] = {}
    for c in p.get("colors") or []:
        if isinstance(c, dict) and c.get("name") and c.get("image"):
            out[c["name"]] = c["image"]
    for name, url in (p.get("designer_images_by_colour") or {}).items():
        if name and url:
            out[name] = url
    return out


@api_router.get("/admin/proof/product/{pid}", dependencies=[Depends(require_admin)])
async def proof_product(pid: str):
    from server import DEFAULT_PRINT_AREA
    p = _get_product(pid)
    photos = _colour_photos(p)
    colours = []
    for c in p.get("colors") or []:
        if isinstance(c, dict) and c.get("name"):
            colours.append({"name": c["name"], "hex": c.get("hex") or "", "has_photo": c["name"] in photos})
    return {
        "id": p["id"],
        "name": p.get("name") or "",
        "brand": p.get("brand") or "",
        "sku": p.get("sku") or p.get("source_sku") or "",
        "colors": colours,
        "print_area": p.get("designer_print_area") or DEFAULT_PRINT_AREA,
    }


@api_router.get("/admin/proof/photo/{pid}", dependencies=[Depends(require_admin)])
async def proof_photo(pid: str, colour: Optional[str] = ""):
    """The garment photo for a product (and colour, if it has one), as image bytes."""
    p = _get_product(pid)
    url = (_colour_photos(p).get(colour) if colour else None) or p.get("designer_image") or p.get("image") or ""
    if not url.startswith(("http://", "https://")):
        raise HTTPException(404, "This product has no photo to use")
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers=_BROWSER_HEADERS)
            resp.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(502, "Couldn't fetch the product photo from the supplier")
    content_type = resp.headers.get("content-type", "").split(";")[0].strip()
    if not content_type.startswith("image/") or len(resp.content) > _MAX_BYTES:
        raise HTTPException(502, "The product photo isn't a usable image")
    return Response(content=resp.content, media_type=content_type,
                    headers={"Cache-Control": "private, max-age=3600"})
