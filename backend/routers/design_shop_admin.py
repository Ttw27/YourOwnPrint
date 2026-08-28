"""
Design Shop admin — the easy upload tool.

Flow (thread-drops style): admin uploads ONE print artwork, gives it a name, and
picks which garments + which themed collections it belongs to. This creates ONE
design product (the artwork is the main image) priced from the cheapest chosen
garment, carrying the garment list so the product page can offer the choice.

Auto-tagging: if the admin doesn't pick categories, we guess them from the design
name using a keyword map (e.g. "gym", "beer", "dog") so tagging is one less chore.
The admin can always override.

Keeping it to ONE product per design (rather than one per garment) keeps the shop
tidy and maintainable — the garment choice lives on the product page, like a
variant, not as separate catalogue entries.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import Depends
from pydantic import BaseModel

from deps import api_router, db, require_admin
from routers.design_shop import (
    DESIGN_CATEGORY_SLUGS, DESIGN_GARMENT_SLUGS, DESIGN_GARMENT_PRICE, DESIGN_CATEGORIES,
)

# Keyword → category guesses for auto-tagging from the design name.
_AUTO_TAGS = {
    "funny-sarcastic": ["funny", "sarcas", "joke", "lol", "humour", "humor", "sassy", "irony", "sarky"],
    "gym-fitness": ["gym", "lift", "fitness", "workout", "swole", "gains", "muscle", "run", "yoga", "crossfit", "deadlift", "squat"],
    "food-drink": ["beer", "wine", "coffee", "pizza", "food", "taco", "gin", "prosecco", "cake", "chocolate", "tea", "snack", "hungry"],
    "animals-pets": ["dog", "cat", "pet", "puppy", "kitten", "paw", "doggo", "horse", "animal", "bird", "fox", "panda"],
    "family-occasions": ["dad", "mum", "mom", "birthday", "retire", "nan", "grandad", "family", "papa", "mama", "anniversary", "wedding"],
    "music-festival": ["festival", "music", "rave", "dj", "band", "rock", "vinyl", "guitar", "concert", "rap", "techno"],
    "geek-gaming": ["game", "gamer", "gaming", "geek", "nerd", "pixel", "retro", "console", "controller", "level", "boss", "code"],
    "trade-work": ["plumb", "electric", "spark", "builder", "trade", "work", "boss", "office", "engineer", "welder", "chippy", "sparky"],
    "rude-adult": ["rude", "adult", "18", "naughty", "explicit", "swear"],
}


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s[:48] or "design"


def _auto_categories(name: str) -> List[str]:
    n = (name or "").lower()
    hits = [cat for cat, keys in _AUTO_TAGS.items() if any(k in n for k in keys)]
    return hits or ["funny-sarcastic"]  # sensible default so it never lands uncategorised


class CreateDesignIn(BaseModel):
    name: str
    design_image: str                       # R2 URL of the print artwork
    garments: List[str]                     # slugs from DESIGN_GARMENT_SLUGS
    categories: Optional[List[str]] = None  # slugs; auto-guessed if omitted
    description: Optional[str] = None
    price_override: Optional[float] = None  # optional flat price; else cheapest garment


@api_router.post("/admin/design-shop/create", dependencies=[Depends(require_admin)])
async def create_design(payload: CreateDesignIn):
    from server import _apply_imported_product

    name = (payload.name or "").strip()
    if not name:
        return {"ok": False, "error": "A design name is required."}
    if not payload.design_image:
        return {"ok": False, "error": "A print image is required."}

    garments = [g for g in (payload.garments or []) if g in DESIGN_GARMENT_SLUGS]
    if not garments:
        return {"ok": False, "error": "Pick at least one garment."}

    cats = [c for c in (payload.categories or []) if c in DESIGN_CATEGORY_SLUGS]
    if not cats:
        cats = _auto_categories(name)

    # Price = explicit override, else the cheapest chosen garment (the "from £X").
    price = payload.price_override if payload.price_override else min(DESIGN_GARMENT_PRICE[g] for g in garments)

    pid = f"design-{_slugify(name)}-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": pid,
        "name": name,
        "price": round(float(price), 2),
        "category": "t-shirts",           # nominal; design_shop flag governs visibility
        "image": payload.design_image,
        "design_image": payload.design_image,
        "description": (payload.description or f"{name} — printed to order on your choice of garment.")[:600],
        "design_shop": True,
        "design_categories": cats,
        "design_garments": garments,
        "active": True,
        "source": "design-shop",
        "created_at": now,
        "imported_at": now,
    }
    await db.imported_products.update_one({"id": pid}, {"$set": doc}, upsert=True)
    _apply_imported_product(doc)
    return {"ok": True, "id": pid, "categories": cats, "garments": garments, "price": doc["price"]}


@api_router.get("/admin/design-shop/list", dependencies=[Depends(require_admin)])
async def list_designs(offset: int = 0, limit: int = 60):
    from server import PRODUCTS
    designs = [p for p in PRODUCTS.values() if p.get("design_shop")]
    designs.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    total = len(designs)
    page = designs[offset:offset + limit]
    return {
        "items": [{
            "id": p["id"], "name": p["name"], "price": round(float(p.get("price") or 0), 2),
            "image": p.get("design_image") or p.get("image") or "",
            "categories": p.get("design_categories") or [],
            "garments": p.get("design_garments") or [],
            "active": p.get("active", True),
        } for p in page],
        "total": total, "offset": offset,
        "all_categories": DESIGN_CATEGORIES,
    }


class DeleteDesignIn(BaseModel):
    product_id: str


@api_router.post("/admin/design-shop/delete", dependencies=[Depends(require_admin)])
async def delete_design(payload: DeleteDesignIn):
    from server import PRODUCTS
    pid = payload.product_id
    await db.imported_products.update_one({"id": pid}, {"$set": {"active": False}})
    if pid in PRODUCTS:
        PRODUCTS[pid]["active"] = False
    return {"ok": True}
