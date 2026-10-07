"""School group order builders (Tim, Oct 2026) - same engine, two pages:

  school-trip  -> /school-trips/order   (trip tees, hoodies, polos, caps, hi-vis...)
  sports-day   -> /sports-day           (house colours: several colours of one garment)

A school ticks garments (each a real adult + kids pair), picks colour(s), chooses
what's printed - front (their logo / design upload) and/or back (typed wording,
a house name per colour, or an uploaded back design) - and enters quantities by
size. Garment = the product's own price; the first print is £3 and a second +£3
(PRINT_PRICE); bulk % off the garments for the WHOLE order (LEAVERS tiers),
counted server-side across every line with the same group_id.

Ordered through the normal basket: lines carry design_meta.flow == "group_kit",
priced in server._resolve_line_pricing via group_print().
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException

from deps import api_router

PRINT_PRICE = 3.00

_GILDAN_TEE_KIDS = {"XS": "3-4", "S": "5-6", "M": "7-8", "L": "9-11", "XL": "12-14"}
_GILDAN_HEAVY_KIDS = {"XS": "4-5", "S": "5-6", "M": "7-8", "L": "9-11", "XL": "12-14"}

GARMENTS = {
    "tee": {"label": "T-shirt", "adult": "gd01", "kids": "gd01b", "kid_labels": _GILDAN_TEE_KIDS, "note": "Gildan Softstyle - 50+ colours incl. brights", "kind": "top"},
    "sports-tee": {"label": "Sports T-shirt", "adult": "jc001", "kids": "jc001b", "note": "AWDis Cool - wicking, 50+ colours", "kind": "top"},
    "vest": {"label": "Sports vest", "adult": "jc007", "kids": "jc007b", "note": "AWDis Cool vest", "kind": "top"},
    "hoodie": {"label": "Hoodie", "adult": "gd57", "kids": "gd57b", "kid_labels": _GILDAN_HEAVY_KIDS, "note": "Gildan Heavy Blend", "kind": "top"},
    "sweatshirt": {"label": "Sweatshirt", "adult": "gd56", "kids": "gd56b", "kid_labels": _GILDAN_HEAVY_KIDS, "note": "Gildan Heavy Blend", "kind": "top"},
    "polo": {"label": "Polo shirt", "adult": "ss11", "kids": "ss11b", "note": "Fruit of the Loom 65/35 piqué", "kind": "top"},
    "cool-polo": {"label": "Sports polo", "adult": "jc040", "kids": "jc040b", "note": "AWDis Cool polo - wicking", "kind": "top"},
    "cap": {"label": "Cap", "adult": "bb10", "kids": "bb10b", "note": "Beechfield 5-panel", "kind": "hat"},
    "hivis": {"label": "Hi-vis vest", "adult": "rs200", "kids": "rs200b", "note": "Result Core - spot them anywhere", "kind": "vest"},
    "bucket": {"label": "Bucket hat", "adult": "bb90n", "kids": "bb90nb", "note": "Beechfield organic cotton - summer trips", "kind": "hat"},
}

PAGES: Dict[str, Dict] = {
    "school-trip": {"garments": ["tee", "hoodie", "sweatshirt", "polo", "cap", "hivis", "bucket"], "houses": False},
    "sports-day": {"garments": ["sports-tee", "tee", "vest", "cool-polo", "hoodie", "cap"], "houses": True},
}

# where each print can go on each kind of garment
PRINTS = {
    "top": {"front": "Front (chest / centre)", "back": "Back"},
    "vest": {"front": "Front (chest)", "back": "Back"},
    "hat": {"front": "Front"},
}


def _find(product_id: str, page: str) -> Optional[Tuple[str, Dict]]:
    for key in PAGES.get(page, {}).get("garments", []):
        g = GARMENTS[key]
        if product_id in (g["adult"], g.get("kids")):
            return key, g
    return None


def group_print(product_id: str, placements: List[str], color: Optional[str], design_meta: Dict) -> Tuple[List[str], float]:
    """Print positions + cost for a school group line (server._resolve_line_pricing)."""
    from server import PRODUCTS
    page = (design_meta or {}).get("page") or ""
    found = _find(product_id, page)
    if not found:
        raise HTTPException(400, f"{product_id} isn't part of this order builder")
    _, g = found
    names = [(c.get("name") if isinstance(c, dict) else c) for c in ((PRODUCTS.get(product_id) or {}).get("colors") or [])]
    if names and color not in names:
        raise HTTPException(400, f"{(PRODUCTS.get(product_id) or {}).get('name', product_id)} isn't made in {color or 'that colour'}")
    allowed = PRINTS[g["kind"]]
    clean = [p for p in ("front", "back") if p in (placements or []) and p in allowed]
    if not clean:
        raise HTTPException(400, "Choose what's printed - front, back or both")
    return clean, round(PRINT_PRICE * len(clean), 2)


@api_router.get("/group-kits/{page}")
async def group_kit_config(page: str):
    from server import PRODUCTS, LEAVERS_BULK_TIERS_PCT
    from routers.dance_kit import _side
    if page not in PAGES:
        raise HTTPException(404, "Unknown page")
    out = []
    for key in PAGES[page]["garments"]:
        g = GARMENTS[key]
        adult = _side(g["adult"])
        if not adult:
            continue
        kids = _side(g.get("kids"), g.get("kid_labels"), kids=True) if g.get("kids") else None
        kid_names = {(c.get("name") if isinstance(c, dict) else c) for c in ((PRODUCTS.get(g.get("kids") or "") or {}).get("colors") or [])}
        cols = [{"name": c["name"], "hex": c.get("hex") or "#cccccc", "image": c.get("image") or adult["image"],
                 "kids": (c["name"] in kid_names) if kids else None}
                for c in (PRODUCTS[g["adult"]].get("colors") or []) if isinstance(c, dict) and c.get("name")]
        out.append({"key": key, "label": g["label"], "note": g["note"], "kind": g["kind"], "adult": adult, "kids": kids,
                    "colours": cols, "prints": PRINTS[g["kind"]]})
    return {"page": page, "garments": out, "houses": PAGES[page]["houses"], "print_price": PRINT_PRICE,
            "bulk_tiers": [{"min_qty": q, "pct": pct} for q, pct in sorted(LEAVERS_BULK_TIERS_PCT)]}


# Photos for the "Build your kit" banners / tiles (KitBuilders.jsx) - a real
# garment photo per builder. Admin can replace any of them in Admin > Page copy >
# "Pictures used across the whole site" (builder:<key>).
_BUILDER_PHOTOS = {
    "dance": ("sk236", ["Black/Black", "Black/White", "Black"]),
    "school-trip": ("gd01", ["Royal Blue", "Orange", "Red"]),
    "sports-day": ("jc001", ["Fire Red", "Royal Blue"]),
    "leavers": ("leavers-varsity-hoodie", ["Jet Black/White"]),
}


@api_router.get("/kit-builders/photos")
async def kit_builder_photos():
    from server import PRODUCTS
    out = {}
    for key, (pid, prefer) in _BUILDER_PHOTOS.items():
        p = PRODUCTS.get(pid) or {}
        cols = [c for c in (p.get("colors") or []) if isinstance(c, dict) and c.get("image")]
        pick = next((c for n in prefer for c in cols if c.get("name") == n), None)
        img = (pick or {}).get("image") or p.get("image")
        if img:
            out[key] = img
    return out
