"""
Delivery - chosen on Stripe's checkout page (so every checkout path gets it):

  * Collect from us (Leicester) - free
  * Free local delivery - Leicester postcodes LE1-LE5 (checked after payment; an
    address outside the area is flagged on the order for Tim to sort)
  * UK delivery - priced by the order's total WEIGHT (garment weights below),
    free over a set order value

Rates, the free-over value, the local postcodes and the garment weights are
editable in Admin > Delivery (db.settings "delivery_settings"); the defaults
here are the starting point. Stripe collects the delivery address + phone.
"""
from __future__ import annotations

import math
import re
from typing import Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from deps import api_router, db, require_admin

SETTINGS_KEY = "delivery_settings"
DEFAULTS: Dict = {
    "collection_enabled": True,
    "collection_label": "Collect from us in Leicester - FREE (we'll email when it's ready)",
    "local_enabled": True,
    "local_postcodes": ["LE1", "LE2", "LE3", "LE4", "LE5"],
    "free_over": 150.0,             # UK delivery free when the goods total is at least this (0 = never)
    # UK delivery by weight: [up to kg, price]; above the last band, each extra
    # started `box_kg` box costs `extra_box_price`.
    "bands": [[1, 3.99], [5, 4.99], [10, 8.99], [15, 10.99], [25, 13.99]],
    "box_kg": 25,
    "extra_box_price": 12.99,
    # Weight per garment (kg), by type. First matching word wins.
    "weights": {
        "hoodie": 0.95, "hooded": 0.95,
        "jacket": 1.0, "softshell": 1.0, "fleece": 0.8, "gilet": 0.7, "bodywarmer": 0.7, "coat": 1.2,
        "sweatshirt": 0.65, "sweater": 0.65, "jumper": 0.65, "crew": 0.65,
        "trouser": 0.6, "jogger": 0.55, "sweatpant": 0.55, "short": 0.3,
        "long sleeve": 0.3, "t-shirt": 0.25, "tee": 0.25, "polo": 0.3, "shirt": 0.3,
        "vest": 0.25, "tank": 0.25,
        "apron": 0.25, "bag": 0.3, "tote": 0.25, "cap": 0.15, "hat": 0.15, "beanie": 0.12,
        "towel": 0.5, "sock": 0.1,
    },
    "default_weight": 0.4,
    # International - the customer picks the region in the basket; Stripe's
    # checkout then only offers that region's price and only accepts addresses
    # in its countries. Prices based on Royal Mail International Tracked
    # (Europe) and UPS Worldwide Economy via a broker (rest of world), Oct 2026.
    "international_enabled": True,
    "zones": {
        "europe": {
            "label": "Europe tracked delivery", "days": [5, 10],
            "bands": [[1, 14.99], [2, 17.99], [5, 22.99], [10, 29.99], [20, 44.99]],
            "box_kg": 20, "extra_box_price": 39.99,
            "countries": ["IE", "FR", "DE", "NL", "BE", "LU", "ES", "PT", "IT", "AT", "DK", "SE", "FI", "NO",
                          "CH", "PL", "CZ", "SK", "HU", "SI", "HR", "RO", "BG", "GR", "CY", "MT", "EE", "LV",
                          "LT", "IS", "LI", "MC", "AD", "SM", "GI"],
        },
        "world": {
            "label": "Worldwide tracked delivery", "days": [6, 14],
            "bands": [[1, 19.99], [2, 24.99], [5, 34.99], [10, 49.99], [20, 79.99]],
            "box_kg": 20, "extra_box_price": 69.99,
            "countries": ["US", "CA", "AU", "NZ", "JP", "SG", "HK", "AE", "SA", "QA", "KW", "BH", "OM", "IL",
                          "ZA", "IN", "MY", "KR", "TW", "TH", "PH", "MX", "BR"],
        },
    },
}


async def get_settings() -> Dict:
    doc = await db.settings.find_one({"key": SETTINGS_KEY}) or {}
    out = {**DEFAULTS, **{k: v for k, v in (doc.get("values") or {}).items() if k in DEFAULTS}}
    out["weights"] = {**DEFAULTS["weights"], **((doc.get("values") or {}).get("weights") or {})}
    out["zones"] = {k: {**v, **(((doc.get("values") or {}).get("zones") or {}).get(k) or {})}
                    for k, v in DEFAULTS["zones"].items()}
    return out


def garment_weight_kg(product: Dict, s: Dict) -> float:
    """Weight of ONE item (bundles: everything in the pack/set)."""
    from server import PRODUCTS
    if product.get("weight_kg"):
        try:
            return float(product["weight_kg"])
        except (TypeError, ValueError):
            pass
    if product.get("bundle_items"):
        return sum(garment_weight_kg(PRODUCTS.get(bi.get("product_id")) or {"name": bi.get("name", "")}, s)
                   * int(bi.get("qty") or 1) for bi in product["bundle_items"])
    text = f" {product.get('name', '')} {product.get('category', '')} ".lower()
    for word, kg in s["weights"].items():
        if re.search(r"\b" + re.escape(word), text):
            return float(kg)
    return float(s.get("default_weight") or 0.4)


def band_price(weight_kg: float, bands_in, box_kg: float, extra_box_price: float) -> float:
    bands = sorted([(float(k), float(p)) for k, p in bands_in])
    for kg, price in bands:
        if weight_kg <= kg:
            return price
    top_kg, top_price = bands[-1]
    extra_boxes = math.ceil((weight_kg - top_kg) / float(box_kg or 20))
    return round(top_price + extra_boxes * float(extra_box_price or 0), 2)


def zone_price(zone: str, weight_kg: float, s: Dict) -> Optional[float]:
    z = (s.get("zones") or {}).get(zone)
    if not z or not s.get("international_enabled"):
        return None
    return band_price(weight_kg, z["bands"], z.get("box_kg") or 20, z.get("extra_box_price") or 0)


def uk_price(weight_kg: float, goods_total: float, s: Dict) -> float:
    if s.get("free_over") and goods_total >= float(s["free_over"]):
        return 0.0
    bands = sorted([(float(k), float(p)) for k, p in s["bands"]])
    for kg, price in bands:
        if weight_kg <= kg:
            return price
    top_kg, top_price = bands[-1]
    extra_boxes = math.ceil((weight_kg - top_kg) / float(s.get("box_kg") or 25))
    return round(top_price + extra_boxes * float(s.get("extra_box_price") or 0), 2)


async def quote(weight_kg: float, goods_total: float) -> Dict:
    s = await get_settings()
    return {"weight_kg": round(weight_kg, 2), "uk_price": uk_price(weight_kg, goods_total, s),
            "international": {z: zone_price(z, weight_kg, s) for z in (s.get("zones") or {})} if s.get("international_enabled") else {},
            "free_over": s.get("free_over") or 0,
            "local_postcodes": s["local_postcodes"] if s.get("local_enabled") else [],
            "collection": bool(s.get("collection_enabled"))}


async def stripe_shipping_options(weight_kg: float, goods_total: float, region: str = "uk") -> List[Dict]:
    """The delivery choices shown on Stripe's checkout page (for the region the
    customer picked in the basket)."""
    s = await get_settings()
    uk = uk_price(weight_kg, goods_total, s)

    def opt(name: str, amount: float, lo: Optional[int] = None, hi: Optional[int] = None) -> Dict:
        d: Dict = {"type": "fixed_amount", "display_name": name[:100],
                   "fixed_amount": {"amount": int(round(amount * 100)), "currency": "gbp"}}
        if lo and hi:
            d["delivery_estimate"] = {"minimum": {"unit": "business_day", "value": lo},
                                      "maximum": {"unit": "business_day", "value": hi}}
        return {"shipping_rate_data": d}

    zp = zone_price(region, weight_kg, s) if region and region != "uk" else None
    if zp is not None:
        z = s["zones"][region]
        lo, hi = (z.get("days") or [5, 12])[:2]
        return [opt(z.get("label") or "International tracked delivery", zp, lo, hi)]
    out = [opt(("UK delivery - FREE" if uk == 0 else "UK delivery (tracked)"), uk, 3, 7)]
    if s.get("local_enabled") and s.get("local_postcodes"):
        out.append(opt(f"Free local delivery - Leicester {', '.join(s['local_postcodes'])} only", 0))
    if s.get("collection_enabled"):
        out.append(opt(s.get("collection_label") or "Collect from us - FREE", 0))
    return out


def postcode_district(postcode: str) -> str:
    """'LE2 7AB' / 'le27ab' -> 'LE2'."""
    pc = re.sub(r"\s+", "", (postcode or "").upper())
    return pc[:-3] if len(pc) > 3 else pc


async def allowed_countries(region: str = "uk") -> List[str]:
    s = await get_settings()
    if region and region != "uk" and s.get("international_enabled") and region in (s.get("zones") or {}):
        return list(s["zones"][region]["countries"])
    return ["GB"]


async def local_ok(postcode: str) -> bool:
    s = await get_settings()
    return postcode_district(postcode) in {p.upper() for p in s.get("local_postcodes") or []}


class DeliveryEstimateIn(BaseModel):
    weight_kg: float = 0
    goods_total: float = 0


@api_router.get("/delivery/info")
async def delivery_info():
    """For the basket / delivery page: what the options and rates are."""
    s = await get_settings()
    return {"collection": s["collection_enabled"], "local_postcodes": s["local_postcodes"] if s["local_enabled"] else [],
            "free_over": s["free_over"], "bands": s["bands"], "box_kg": s["box_kg"],
            "extra_box_price": s["extra_box_price"],
            "international": ({k: {"label": z.get("label"), "bands": z["bands"], "days": z.get("days")}
                               for k, z in (s.get("zones") or {}).items()} if s.get("international_enabled") else {})}


@api_router.get("/admin/delivery-settings", dependencies=[Depends(require_admin)])
async def admin_get_delivery():
    return await get_settings()


@api_router.put("/admin/delivery-settings", dependencies=[Depends(require_admin)])
async def admin_save_delivery(payload: Dict):
    vals = {k: v for k, v in (payload or {}).items() if k in DEFAULTS}
    if "bands" in vals:
        try:
            vals["bands"] = sorted([[float(a), round(float(b), 2)] for a, b in vals["bands"] if float(a) > 0])
        except Exception:
            raise HTTPException(400, "Each weight band needs a weight (kg) and a price")
        if not vals["bands"]:
            raise HTTPException(400, "Add at least one weight band")
    if "local_postcodes" in vals:
        vals["local_postcodes"] = sorted({re.sub(r"\s+", "", str(p).upper()) for p in vals["local_postcodes"] if str(p).strip()})
    for k in ("free_over", "box_kg", "extra_box_price", "default_weight"):
        if k in vals:
            try:
                vals[k] = max(0.0, float(vals[k]))
            except (TypeError, ValueError):
                raise HTTPException(400, f"{k} must be a number")
    if "zones" in vals:
        clean = {}
        for k, z in (vals["zones"] or {}).items():
            if k not in DEFAULTS["zones"]:
                continue
            zz = {}
            if "bands" in z:
                zz["bands"] = sorted([[float(a), round(float(b), 2)] for a, b in z["bands"] if float(a) > 0])
            for f in ("box_kg", "extra_box_price"):
                if f in z:
                    zz[f] = max(0.0, float(z[f]))
            if "label" in z:
                zz["label"] = str(z["label"])[:80]
            clean[k] = zz
        vals["zones"] = clean
    if "weights" in vals:
        vals["weights"] = {str(k).lower().strip(): float(v) for k, v in (vals["weights"] or {}).items() if str(k).strip()}
    doc = await db.settings.find_one({"key": SETTINGS_KEY}) or {}
    merged = {**(doc.get("values") or {}), **vals}
    await db.settings.update_one({"key": SETTINGS_KEY}, {"$set": {"key": SETTINGS_KEY, "values": merged}}, upsert=True)
    return await get_settings()
