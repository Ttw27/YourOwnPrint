"""
The Design Shop — ready-made printed designs (a store within the store).

This is deliberately kept SEPARATE from the workwear/custom side:
  * Design-shop products carry `design_shop: True` and never appear in the normal
    workwear collections, industry pages, or the Find My Kit concierge.
  * They live under their own set of themed collections (Funny, Gym, Food, …) and
    their own browse experience with its own sidebar + filters (garment, colour).
  * Each design is one artwork printed onto a choice of garments (tee, hoodie,
    sweater, tote, tank, long-sleeve). For v1 the print artwork itself is the main
    image — clean and fast to maintain; real mockups can be layered on later.

Nothing here writes to the catalogue on read. Products are created via the admin
upload tool (see routers/design_shop_admin — Stage 2) or the normal product admin.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import Depends
from pydantic import BaseModel

from deps import api_router, db, require_admin

# The themed collections of the Design Shop (separate from workwear collections).
DESIGN_CATEGORIES = [
    {"slug": "funny-sarcastic", "title": "Funny & Sarcastic", "blurb": "Slogans and gags that get a laugh."},
    {"slug": "gym-fitness",     "title": "Gym & Fitness",     "blurb": "For the lifters, runners and gym rats."},
    {"slug": "food-drink",      "title": "Food & Drink",      "blurb": "Coffee, beer, pizza — the good stuff."},
    {"slug": "animals-pets",    "title": "Animals & Pets",    "blurb": "For dog people, cat people and everyone between."},
    {"slug": "family-occasions","title": "Family & Occasions","blurb": "Birthdays, retirement, mum & dad, milestones."},
    {"slug": "music-festival",  "title": "Music & Festival",  "blurb": "Festival-ready and music-lover designs."},
    {"slug": "geek-gaming",     "title": "Geek & Gaming",     "blurb": "Original gaming and geek-culture art."},
    {"slug": "trade-work",      "title": "Trade & Work Humour","blurb": "In-jokes for the trades and the workplace."},
    {"slug": "rude-adult",      "title": "Rude & Adult",      "blurb": "Cheeky, rude and definitely not for work.", "adult": True},
]
DESIGN_CATEGORY_SLUGS = {c["slug"] for c in DESIGN_CATEGORIES}

# The garments a design can be printed on, with the base price for each.
# (These are the Design-Shop retail prices — flat per garment, not the blank cost.)
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
