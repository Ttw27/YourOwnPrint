"""
Your Own Print Specials - the discount range: one breast-pocket logo print
included in the price, White / Grey / Black only (Black costs a little more,
via `colour_upcharges`). Brought over from the old Shopify store.

`backend/data/specials_range.json` holds the 13 products (prices, sizes, size
extras, colours and the original "YOUROWNPRINT SPECIAL OFFER" banner photos).
`create_specials_range()` creates any that don't exist yet - once, marker
guarded - copying the photos into our own R2 storage so they keep working after
Shopify is closed. Anything Tim edits afterwards (Product settings) is kept:
existing products are never touched.

Pricing: checkout includes the breast print for any `specials_eligible`
product (see server._resolve_line_pricing) - nothing extra is charged for it.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional

from deps import ROOT_DIR, db

MARKER = "specials_range_2026_v1"
KIDS_AGE_TO_SIZE = {"3-4 yrs": "XS", "5-6 yrs": "S", "7-8 yrs": "M", "9-11 yrs": "L", "12-14 yrs": "XL"}


def _size_chart(spec: Dict) -> List[Dict]:
    """The maker's real 'to fit' sizes (PenCarrie data) for this special's sizes."""
    try:
        data = json.load(open(ROOT_DIR / "data" / "pencarrie_size_charts.json"))
    except Exception:
        return []
    chart = data.get(spec["base"].upper()) or {}
    rows = []
    for sz in spec["sizes"]:
        key = KIDS_AGE_TO_SIZE.get(sz, sz)
        d = chart.get(re.sub(r"[^A-Z0-9.]", "", key.upper()))
        if d:
            rows.append({"size": sz, **{k: v for k, v in d.items() if k != "Age (years)"}})
    return rows if len(rows) == len(spec["sizes"]) else rows or []


def _description(spec: Dict) -> str:
    colours = ", ".join(c["name"] for c in spec["colors"])
    extra = " (Black +£2.00)" if spec.get("colour_upcharges", {}).get("Black") else ""
    return (f"Part of our Your Own Print Specials range - your logo printed on the breast pocket, "
            f"included in the price. No minimum order, no set-up fees.\n\n"
            f"Available in: {colours}{extra}.\n\n"
            f"Upload your logo when you order and we'll send a free proof before we print. "
            f"Printed in-house in the UK.")


async def create_specials_range(force: bool = False) -> Dict:
    from server import PRODUCTS, _apply_imported_product, reapply_saved_settings
    from services.r2_storage import mirror_external_image
    if not force and await db.settings.find_one({"key": MARKER}):
        return {"skipped": True}
    specs = json.load(open(ROOT_DIR / "data" / "specials_range.json"))
    created, existing = [], []
    for spec in specs:
        pid = spec["id"]
        if pid in PRODUCTS or await db.imported_products.find_one({"id": pid}, {"_id": 1}):
            existing.append(pid)
            continue

        async def keep(url: str) -> str:
            try:
                return (await mirror_external_image(url, folder="specials")) or url
            except Exception:
                return url

        images = [await keep(u) for u in spec["images"]]
        colors = []
        for c in spec["colors"]:
            c = dict(c)
            if c.get("image"):
                c["image"] = await keep(c["image"])
            colors.append(c)
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": pid,
            "name": f"Your Own Print {spec['name']}",
            "price": float(spec["price"]),
            "category": spec["category"],
            "image": images[0],
            "additional_images": images[1:],
            "description": _description(spec).split("\n\n")[0],
            "gender_fit": spec["gender_fit"],
            "industry_tags": [],
            "colors": colors,
            "sizes": spec["sizes"],
            "size_upcharges": spec.get("size_upcharges") or {},
            "colour_upcharges": spec.get("colour_upcharges") or {},
            "allowed_placements": ["left-breast"],
            "brand": "Gildan" if spec["base"].upper().startswith("GD") else "Pro RTX",
            "source_sku": spec["base"].upper(),
            "source": "special",
            "active": True,
            "created_at": now,
            "imported_at": now,
        }
        await db.imported_products.insert_one(dict(doc))
        await db.product_meta.update_one({"product_id": pid}, {"$set": {
            "product_id": pid, "specials_eligible": True, "allowed_placements": ["left-breast"],
            "gender_fit": spec["gender_fit"], "description_full": _description(spec),
            "size_guide_table": _size_chart(spec), "brand": doc["brand"], "sku": doc["source_sku"],
            "updated_at": now}}, upsert=True)
        _apply_imported_product(doc)
        created.append(pid)
    if created:
        await reapply_saved_settings(created)
    await db.settings.update_one({"key": MARKER}, {"$set": {
        "key": MARKER, "created": created, "existing": existing,
        "ran_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    logging.info(f"Specials range: {len(created)} created, {len(existing)} already there")
    return {"created": created, "existing": existing}
