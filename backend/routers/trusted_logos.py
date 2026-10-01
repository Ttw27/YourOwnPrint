"""
"Trusted by" - customer logos shown on the homepage (like the old Shopify site).

Stored in db.settings "trusted_logos" as [{name, image}], managed in Admin >
Photo gallery ("Trusted by logos"). On first run the 11 logos from the old
Shopify homepage are copied into our own R2 storage (they were served from the
old domain, which stops working once it points at the new site).
"""
from __future__ import annotations

import logging
from typing import Dict, List

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from deps import api_router, db, require_admin

KEY = "trusted_logos"
_SHOPIFY = "https://cdn.shopify.com/s/files/1/0572/8278/9513/files/"
OLD_SITE_LOGOS = [
    ("The Flower Rooms", "The_Flower_Rooms.jpg"), ("Fitness Sweatbox", "Fitness_Sweatbox.jpg"),
    ("Dreamscapes Landscaping Designs", "Dreamscapes.jpg"), ("Beaumont Park FC", "Beaumont_Park.jpg"),
    ("The White Horse", "The_White_Horse.jpg"), ("BBC", "p09xtmrp.jpg"), ("Cabaero", "Cabaero.jpg"),
    ("Platinum Garden Design", "Platinum_Garden_Design_LTD.jpg"), ("The Old Plough", "The_Old_Plough.jpg"),
    ("PepsiCo", "Pepsico.jpg"), ("Highcliffe", "Highcliffe.jpg"),
]


class Logo(BaseModel):
    name: str = ""
    image: str


class LogosIn(BaseModel):
    logos: List[Logo]


async def seed_from_old_site() -> None:
    if await db.settings.find_one({"key": KEY}):
        return
    from services.r2_storage import mirror_external_image
    logos: List[Dict] = []
    for name, fn in OLD_SITE_LOGOS:
        url = _SHOPIFY + fn
        try:
            url = (await mirror_external_image(url, folder="trusted-logos")) or url
        except Exception:
            pass
        logos.append({"name": name, "image": url})
    await db.settings.update_one({"key": KEY}, {"$set": {"key": KEY, "logos": logos}}, upsert=True)
    logging.info(f"Trusted-by logos: {len(logos)} copied from the old site")


@api_router.on_event("startup")
async def _seed_trusted_logos():
    import asyncio
    async def run():
        try:
            await seed_from_old_site()
        except Exception as e:
            logging.warning(f"trusted logos seed skipped: {e}")
    asyncio.create_task(run())


@api_router.get("/trusted-logos")
async def trusted_logos():
    doc = await db.settings.find_one({"key": KEY}) or {}
    return {"logos": doc.get("logos") or []}


@api_router.put("/admin/trusted-logos", dependencies=[Depends(require_admin)])
async def save_trusted_logos(payload: LogosIn):
    logos = [{"name": l.name.strip()[:80], "image": l.image.strip()} for l in payload.logos if l.image.strip()]
    if len(logos) > 40:
        raise HTTPException(400, "Up to 40 logos")
    await db.settings.update_one({"key": KEY}, {"$set": {"key": KEY, "logos": logos}}, upsert=True)
    return {"ok": True, "logos": logos}
