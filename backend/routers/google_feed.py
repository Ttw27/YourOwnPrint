"""Google Merchant Center product feed (free Shopping listings + Shopping ads).

GET /api/feeds/google.xml - RSS 2.0 with the g: namespace. One item per
colour x size of every live catalogue garment (item_group_id = product id),
priced exactly as the product page shows it (garment price + colour upcharge;
sizes with a size upcharge are left out so the landing page price always
matches). Built once and cached for 6 hours - Merchant Center fetches it daily.

Left out: hidden products, Design Shop, Designer products, Fight Night tees,
Leavers, team kits and bundles (sold through builders / their own pages, not
a plain product page), and anything still on a stock photo.
"""
from __future__ import annotations

import asyncio
import gzip
import html
import io
import os
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote

from fastapi import Response

from deps import api_router

_CACHE: Dict[str, object] = {"at": 0.0, "xml": b""}
_TTL = 6 * 3600

# our category slug -> Google product taxonomy path
_TAXONOMY = {
    "t-shirts": "Apparel & Accessories > Clothing > Shirts & Tops",
    "polos": "Apparel & Accessories > Clothing > Shirts & Tops",
    "shirts": "Apparel & Accessories > Clothing > Shirts & Tops",
    "hoodies": "Apparel & Accessories > Clothing > Activewear > Sweatshirts",
    "sweatshirts": "Apparel & Accessories > Clothing > Activewear > Sweatshirts",
    "jackets": "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
    "fleece": "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
    "softshells": "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
    "hi-vis": "Apparel & Accessories > Clothing > Uniforms > Work Uniforms",
    "workwear": "Apparel & Accessories > Clothing > Uniforms > Work Uniforms",
    "aprons": "Apparel & Accessories > Clothing > Uniforms > Chef's Uniforms > Chef's Aprons",
    "bottoms": "Apparel & Accessories > Clothing > Pants",
    "trousers": "Apparel & Accessories > Clothing > Pants",
    "shorts": "Apparel & Accessories > Clothing > Shorts",
    "hats": "Apparel & Accessories > Clothing Accessories > Hats",
    "bags": "Luggage & Bags",
    "kids-baby": "Apparel & Accessories > Clothing",
    "sports": "Apparel & Accessories > Clothing > Activewear",
}


def _site() -> str:
    return (os.environ.get("SITE_BASE_URL") or "https://www.yourownprint.co.uk").rstrip("/")


def _x(v) -> str:
    return html.escape(str(v or ""), quote=False)


def _plain(text: str, limit: int = 4800) -> str:
    t = re.sub(r"<[^>]+>", " ", text or "")
    t = re.sub(r"\s+", " ", t).strip()
    return t[:limit]


def _gender(p: Dict) -> str:
    g = (p.get("gender_fit") or "").lower()
    name = (p.get("name") or "").lower()
    if g in ("womens", "ladies", "women", "female") or re.search(r"\b(ladies|women'?s|girls?)\b", name):
        return "female"
    if g in ("mens", "men", "male") and not re.search(r"\bunisex\b", name):
        return "male"
    return "unisex"


def _eligible(p: Dict) -> bool:
    from server import FIGHT_NIGHT_IDS
    # only products whose own /product page is where they're bought
    if p.get("design_shop") or p.get("designer_only") or p.get("designer_enabled") or p.get("bundle_items"):
        return False
    if p["id"] in FIGHT_NIGHT_IDS or "pexels.com" in (p.get("image") or ""):
        return False
    if p.get("category") in ("leavers", "team-kits"):
        return False
    return bool(p.get("image")) and float(p.get("price") or 0) > 0


class _Out:
    """Writes the feed straight into a gzip buffer (~84k items - too big to
    hold as text), swapping old r2.dev photo URLs for the image domain."""
    def __init__(self):
        from services.image_host import _rewrites
        self.buf = io.BytesIO()
        self.gz = gzip.GzipFile(fileobj=self.buf, mode="wb", compresslevel=6)
        self.swap = [(a.decode(), b.decode()) for a, b in _rewrites()]

    def append(self, text: str):
        for old, new in self.swap:
            text = text.replace(old, new)
        self.gz.write(text.encode("utf-8") + b"\n")

    def done(self) -> bytes:
        self.gz.close()
        return self.buf.getvalue()


def build_feed() -> bytes:
    from server import live_products, is_zero_rated
    site = _site()
    out = _Out()
    for line in [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>',
        "<title>Your Own Print</title>",
        f"<link>{_x(site)}</link>",
        "<description>Custom printed clothing and workwear, printed in Leicester, UK</description>",
    ]:
        out.append(line)
    for p in list(live_products()):
        if not _eligible(p):
            continue
        pid = p["id"]
        price = float(p["price"])
        ups = p.get("size_upcharges") or {}
        cups = p.get("colour_upcharges") or {}
        sizes = [s for s in (p.get("sizes") or []) if not ups.get(s)] or ["One Size"]
        brand = p.get("brand") or p.get("_brand") or "Your Own Print"
        kids = is_zero_rated(p)
        desc = _plain(p.get("description_full") or p.get("description") or p.get("name"), 900)
        desc = f"{desc} Printed with your logo in the UK - free artwork proof before we print."
        cat = _TAXONOMY.get(p.get("category") or "", "Apparel & Accessories > Clothing")
        extra_imgs = [u for u in (p.get("image_gallery") or p.get("additional_images") or []) if isinstance(u, str) and u.startswith("http")][:5]
        colours = [c for c in (p.get("colors") or []) if isinstance(c, dict) and c.get("name")] or [{"name": "", "image": p.get("image")}]
        for c in colours:
            cname = c["name"]
            cprice = round(price + float(cups.get(cname, 0) or 0), 2)
            img = c.get("image") or p.get("image")
            link = f"{site}/product/{quote(pid)}" + (f"?colour={quote(cname)}" if cname else "")
            for sz in sizes:
                vid = re.sub(r"[^A-Za-z0-9_-]+", "-", f"{pid}-{cname}-{sz}").strip("-")[:50]
                title = f"{p['name']}{' - ' + cname if cname else ''}"[:150]
                out.append(
                    "<item>"
                    f"<g:id>{_x(vid)}</g:id><g:item_group_id>{_x(pid)}</g:item_group_id>"
                    f"<g:title>{_x(title)}</g:title><g:description>{_x(desc)}</g:description>"
                    f"<g:link>{_x(link)}</g:link><g:image_link>{_x(img)}</g:image_link>"
                    + "".join(f"<g:additional_image_link>{_x(u)}</g:additional_image_link>" for u in extra_imgs)
                    + f"<g:availability>in_stock</g:availability><g:price>{cprice:.2f} GBP</g:price>"
                    f"<g:brand>{_x(brand)}</g:brand><g:condition>new</g:condition>"
                    f"<g:mpn>{_x((p.get('source_sku') or pid).upper())}</g:mpn><g:identifier_exists>no</g:identifier_exists>"
                    f"<g:google_product_category>{_x(cat)}</g:google_product_category><g:product_type>{_x(p.get('category') or '')}</g:product_type>"
                    f"<g:age_group>{'kids' if kids else 'adult'}</g:age_group><g:gender>{_gender(p)}</g:gender>"
                    + (f"<g:color>{_x(cname)}</g:color>" if cname else "")
                    + f"<g:size>{_x(sz)}</g:size><g:size_system>UK</g:size_system>"
                    "<g:custom_label_0>customisable</g:custom_label_0>"
                    "</item>"
                )
    out.append("</channel></rss>")
    return out.done()


@api_router.get("/feeds/google.xml")
async def google_feed():
    now = time.time()
    if not _CACHE["xml"] or now - float(_CACHE["at"]) > _TTL:
        _CACHE["xml"] = await asyncio.to_thread(build_feed)
        _CACHE["at"] = now
    # stored gzipped; sent with Content-Encoding so browsers / Google read plain XML
    return Response(content=_CACHE["xml"], media_type="application/xml",
                    headers={"Content-Encoding": "gzip", "Cache-Control": "public, max-age=3600"})
