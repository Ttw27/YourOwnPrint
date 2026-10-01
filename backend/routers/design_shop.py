"""
The Design Shop - ready-made printed designs (a store within the store).

This is deliberately kept SEPARATE from the workwear/custom side:
  * Design-shop products carry `design_shop: True` and never appear in the normal
    workwear collections, industry pages, or the Find My Kit concierge.
  * They live under their own set of themed collections (Funny, Gym, Food, …) and
    their own browse experience with its own sidebar + filters (garment, colour).
  * Each design is one artwork printed onto a choice of garments (tee, hoodie,
    sweater, tote, tank, long-sleeve). For v1 the print artwork itself is the main
    image - clean and fast to maintain; real mockups can be layered on later.

Nothing here writes to the catalogue on read. Products are created via the admin
upload tool (see routers/design_shop_admin - Stage 2) or the normal product admin.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from deps import api_router, db, require_admin

# The themed collections of the Design Shop (separate from workwear collections).
DESIGN_CATEGORIES = [
    {"slug": "funny-sarcastic", "title": "Funny & Sarcastic", "blurb": "Slogans and gags that get a laugh."},
    {"slug": "gym-fitness",     "title": "Gym & Fitness",     "blurb": "For the lifters, runners and gym rats."},
    {"slug": "food-drink",      "title": "Food & Drink",      "blurb": "Coffee, beer, pizza - the good stuff."},
    {"slug": "animals-pets",    "title": "Animals & Pets",    "blurb": "For dog people, cat people and everyone between."},
    {"slug": "family-occasions","title": "Family & Occasions","blurb": "Birthdays, retirement, mum & dad, milestones."},
    {"slug": "music-festival",  "title": "Music & Festival",  "blurb": "Festival-ready and music-lover designs."},
    {"slug": "geek-gaming",     "title": "Geek & Gaming",     "blurb": "Original gaming and geek-culture art."},
    {"slug": "trade-work",      "title": "Trade & Work Humour","blurb": "In-jokes for the trades and the workplace."},
    {"slug": "rude-adult",      "title": "Rude & Adult",      "blurb": "Cheeky, rude and definitely not for work.", "adult": True},
]
DESIGN_CATEGORY_SLUGS = {c["slug"] for c in DESIGN_CATEGORIES}

# The garments a design can be printed on, with the base price for each.
# (These are the Design-Shop retail prices - flat per garment, not the blank cost.)
DESIGN_GARMENTS = [
    {"slug": "t-shirt",      "title": "T-Shirt",           "price": 14.99},
    {"slug": "sweater",      "title": "Sweater",           "price": 26.99},
    {"slug": "hoodie",       "title": "Hoodie",            "price": 29.99},
    {"slug": "tote-bag",     "title": "Tote Bag",          "price": 12.99},
    {"slug": "tank-top",     "title": "Tank Top",          "price": 14.99},
    {"slug": "long-sleeve",  "title": "Long Sleeve T-Shirt","price": 17.99},
]
DESIGN_GARMENT_SLUGS = {g["slug"] for g in DESIGN_GARMENTS}
DESIGN_GARMENT_PRICE = {g["slug"]: g["price"] for g in DESIGN_GARMENTS}


# Which real garment each Design Shop garment type is printed on - and so whose
# photos (one per colour, from Designer products) the mockups use, and whose
# colours/sizes customers choose from. Admin can change these + the prices in
# Admin > Design Shop ("Garments & prices"); stored in db.settings.
DEFAULT_GARMENT_PRODUCTS = {
    "t-shirt": "personalised-tee",
    "hoodie": "personalised-hoodie",
    "sweater": "workwear-sweatshirt",
}
GARMENTS_SETTINGS_KEY = "design_shop_garments"


async def garment_settings() -> Dict[str, Dict]:
    """{slug: {slug, title, price, product_id}} - stored choices over defaults."""
    doc = await db.settings.find_one({"key": GARMENTS_SETTINGS_KEY}) or {}
    stored = doc.get("garments") or {}
    out: Dict[str, Dict] = {}
    for g in DESIGN_GARMENTS:
        st = stored.get(g["slug"]) or {}
        try:
            price = float(st.get("price")) if st.get("price") not in (None, "") else g["price"]
        except (TypeError, ValueError):
            price = g["price"]
        pid = st["product_id"] if "product_id" in st else DEFAULT_GARMENT_PRODUCTS.get(g["slug"])
        out[g["slug"]] = {"slug": g["slug"], "title": g["title"], "price": round(price, 2), "product_id": pid or None}
    return out


def _colour_name(c) -> str:
    return (c.get("name") if isinstance(c, dict) else str(c or "")) or ""


async def resolve_design_garment(design: Dict, garment_slug: Optional[str]) -> Dict:
    """The garment a design-shop line is printed on: {slug, title, price,
    product_id, base}. 400 if it isn't one this design is offered on (or no real
    garment is linked to that type yet). Used by checkout pricing."""
    from server import PRODUCTS
    gs = await garment_settings()
    g = gs.get(garment_slug or "")
    if not g or garment_slug not in (design.get("design_garments") or []):
        raise HTTPException(400, f"Please choose a garment for {design.get('name') or 'this design'}.")
    base = PRODUCTS.get(g["product_id"] or "")
    if not base:
        raise HTTPException(400, f"Sorry, {g['title']} isn't available for this design right now.")
    return {**g, "base": base}


def is_design_product(p: Dict) -> bool:
    return bool(p.get("design_shop"))


@api_router.get("/design-shop/categories")
async def design_shop_categories():
    """The themed collections + garment options for the Design Shop nav/sidebar."""
    from server import PRODUCTS
    # live counts per category so the sidebar can show how many designs are in each
    counts: Dict[str, int] = {}
    for p in PRODUCTS.values():
        if not is_design_product(p) or p.get("active") is False:
            continue
        for c in (p.get("design_categories") or []):
            counts[c] = counts.get(c, 0) + 1
    cats = [{**c, "count": counts.get(c["slug"], 0)} for c in DESIGN_CATEGORIES]
    return {"categories": cats, "garments": DESIGN_GARMENTS}


@api_router.get("/design-shop/products")
async def design_shop_products(
    category: Optional[str] = None,
    garment: Optional[str] = None,
    sort: str = "newest",
    limit: int = 60,
    offset: int = 0,
):
    """Browse the Design Shop. Only returns design-shop products (never workwear)."""
    from server import PRODUCTS

    items = []
    for p in PRODUCTS.values():
        if not is_design_product(p) or p.get("active") is False:
            continue
        if category and category not in (p.get("design_categories") or []):
            continue
        if garment and garment not in (p.get("design_garments") or []):
            continue
        items.append(p)

    if sort == "price-low":
        items.sort(key=lambda x: float(x.get("price") or 0))
    elif sort == "price-high":
        items.sort(key=lambda x: -float(x.get("price") or 0))
    else:  # newest
        items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    total = len(items)
    limit = min(max(1, limit), 120)
    page = items[offset:offset + limit]
    out = [{
        "id": p["id"],
        "name": p["name"],
        "price": round(float(p.get("price") or 0), 2),
        "image": p.get("design_image") or p.get("image") or "",
        "categories": p.get("design_categories") or [],
        "garments": p.get("design_garments") or [],
    } for p in page]
    return {"items": out, "total": total, "offset": offset, "returned": len(page)}


@api_router.get("/design-shop/product/{pid}")
async def design_shop_product(pid: str):
    """One design + the garments it can be bought on, each with the real
    garment's colours (and per-colour photo + print area for the mockup) and
    sizes. Garment types with no real garment linked yet are left out."""
    from server import PRODUCTS, is_live, _vat_fields
    p = PRODUCTS.get(pid)
    if not p or not is_design_product(p) or not is_live(p):
        raise HTTPException(404, "Design not found")
    gs = await garment_settings()
    garments = []
    for slug in (p.get("design_garments") or []):
        g = gs.get(slug)
        base = PRODUCTS.get((g or {}).get("product_id") or "")
        if not g or not base or not (base.get("sizes") or []):
            continue
        by_colour = base.get("designer_images_by_colour") or {}
        colours = [{"name": _colour_name(c), "hex": (c.get("hex") if isinstance(c, dict) else None),
                    "photo": by_colour.get(_colour_name(c)) or ""} for c in (base.get("colors") or [])]
        garments.append({
            "slug": slug, "title": g["title"], "price": g["price"],
            **{k: v for k, v in _vat_fields({**base, "price": g["price"]}).items()},
            "product_id": base["id"],
            "photo": base.get("designer_image") or base.get("image") or "",
            "print_area": base.get("designer_print_area") or {"x": 30, "y": 22, "w": 40, "h": 42},
            "colours": colours,
            "sizes": list(base.get("sizes") or []),
            "size_upcharges": base.get("size_upcharges") or {},
            "size_guide_table": base.get("size_guide_table") or [],
        })
    return {
        "id": p["id"], "name": p["name"], "description": p.get("description") or "",
        "design_image": p.get("design_image") or p.get("image") or "",
        "categories": p.get("design_categories") or [],
        "garments": garments,
    }


class GarmentSettingIn(BaseModel):
    slug: str
    price: Optional[float] = None
    product_id: Optional[str] = None


class GarmentSettingsIn(BaseModel):
    garments: List[GarmentSettingIn]


@api_router.get("/admin/design-shop/garments", dependencies=[Depends(require_admin)])
async def admin_design_garments():
    """Garment types + price + which real garment each is printed on, and the
    garments that can be picked (anything in Designer products)."""
    from server import PRODUCTS
    gs = await garment_settings()
    options = [{"id": p["id"], "name": p["name"], "colours": len(p.get("colors") or []),
                "colour_photos": len(p.get("designer_images_by_colour") or {}),
                "has_photo": bool(p.get("designer_image"))}
               for p in PRODUCTS.values() if p.get("designer_enabled")]
    options.sort(key=lambda x: x["name"].lower())
    return {"garments": list(gs.values()), "options": options}


@api_router.put("/admin/design-shop/garments", dependencies=[Depends(require_admin)])
async def admin_save_design_garments(payload: GarmentSettingsIn):
    from server import PRODUCTS
    doc = await db.settings.find_one({"key": GARMENTS_SETTINGS_KEY}) or {}
    stored = dict(doc.get("garments") or {})
    for g in payload.garments:
        if g.slug not in DESIGN_GARMENT_SLUGS:
            raise HTTPException(400, f"Unknown garment type '{g.slug}'")
        cur = dict(stored.get(g.slug) or {})
        if g.price is not None:
            if not (1 <= g.price <= 500):
                raise HTTPException(400, "Prices must be between £1 and £500")
            cur["price"] = round(float(g.price), 2)
        if "product_id" in g.model_fields_set:
            if g.product_id and g.product_id not in PRODUCTS:
                raise HTTPException(400, f"Unknown garment '{g.product_id}'")
            cur["product_id"] = g.product_id or ""
        stored[g.slug] = cur
    await db.settings.update_one({"key": GARMENTS_SETTINGS_KEY},
                                 {"$set": {"key": GARMENTS_SETTINGS_KEY, "garments": stored}}, upsert=True)
    return {"ok": True, "garments": list((await garment_settings()).values())}
