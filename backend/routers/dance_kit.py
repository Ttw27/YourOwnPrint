"""Dance studio kit builder (Tim, Oct 2026) - /dance-studio-kit.

Real garments only (PenCarrie / Ralawise), women's + kids versions where they
exist. The customer picks one garment per set (top, bottoms, hoodie, joggers,
bag), a colour, the print options, and a size per dancer. The order goes
through the normal basket checkout: each line is the real product with
design_meta.flow == "dance", and server._resolve_line_pricing prices the print
with dance_print() below. Garment price = the product's own price (kids
versions are their own, cheaper, zero-rated products). Print prices are whole
pounds so totals keep ending .99.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException

from deps import api_router

LOGO_PRICE = 3.00        # small logo (chest / hip / bag) - "your logo" on every item
BIG_FRONT_PRICE = 5.00   # big logo across the front instead of the small one
NAME_PRICE = 3.00        # dancer's name on the back (or on the bag)
BACK_LOGO_PRICE = 5.00   # big studio logo on the back

# Gildan youth sizes are XS-XL - show them as ages.
_GILDAN_KIDS = {"XS": "3-4", "S": "5-6", "M": "7-8", "L": "9-11", "XL": "12-14"}

# kind -> which prints it can take. "front": small logo included (big front
# optional), "name"/"back": optional extras. Bottoms: small hip logo optional.
KINDS = {
    "top":     {"front": "chest", "big_front": True,  "name": True,  "back": True,  "logo_optional": False},
    "hoodie":  {"front": "chest", "big_front": True,  "name": True,  "back": True,  "logo_optional": False},
    "bottoms": {"front": "hip",   "big_front": False, "name": False, "back": False, "logo_optional": True},
    "bag":     {"front": "bag",   "big_front": False, "name": True,  "back": False, "logo_optional": False},
}

SETS: List[Dict] = [
    {"key": "top", "kind": "top", "title": "Studio top", "sub": "Crop tops for class, tees for crew and parents.",
     "options": [
         {"id": "crop", "label": "Fashion crop top", "adult": "sk236", "kids": "sm236", "note": "SF Clothing - women's + kids 5-12"},
         {"id": "sports-crop", "label": "Sports crop top", "adult": "jc017", "kids": None, "note": "AWDis Cool - wicking, women's"},
         {"id": "racer", "label": "Racer tank", "adult": "bl1019", "kids": None, "note": "Bella micro rib - teachers & seniors"},
         {"id": "tee", "label": "Studio tee", "adult": "gd01", "kids": "gd01b", "note": "Gildan Softstyle - unisex + kids", "kid_labels": _GILDAN_KIDS},
     ]},
    {"key": "bottoms", "kind": "bottoms", "title": "Studio bottoms", "sub": "Black leggings or shorts - small logo on the hip.",
     "options": [
         {"id": "leggings", "label": "Leggings", "adult": "sk64", "kids": "sm64", "note": "SF Clothing - women's + kids 3-12"},
         {"id": "flared", "label": "Flared leggings", "adult": "sk428", "kids": "sm428", "note": "SF Clothing - women's + kids 3-13"},
         {"id": "cycling", "label": "Cycling shorts", "adult": "sk427", "kids": "sm427", "note": "SF Clothing - women's + kids 5-12"},
     ]},
    {"key": "hoodie", "kind": "hoodie", "title": "Studio hoodie", "sub": "The one they'll wear everywhere - add their name on the back.",
     "options": [
         {"id": "cropped", "label": "Cropped hoodie", "adult": "jh016", "kids": None, "note": "AWDis - women's"},
         {"id": "college", "label": "College hoodie", "adult": "jh001", "kids": "jh001b", "note": "AWDis - unisex + kids, 100+ colours"},
         {"id": "zoodie", "label": "Zip hoodie (Zoodie)", "adult": "jh050", "kids": "jh050b", "note": "AWDis - unisex + kids, easy over hair & make-up"},
     ]},
    {"key": "joggers", "kind": "bottoms", "title": "Joggers", "sub": "Cuffed joggers to match the hoodie.",
     "options": [
         {"id": "joggers", "label": "Cuffed joggers", "adult": "jh072", "kids": "jh072b", "note": "AWDis College - unisex + kids"},
     ]},
    {"key": "bag", "kind": "bag", "title": "Dance bag", "sub": "Logo on the front - add their name too.",
     "options": [
         {"id": "dance-bag", "label": "Junior dance bag", "adult": "bg145", "kids": None, "note": "BagBase - holdall with shoe pocket"},
         {"id": "gymsac", "label": "Drawstring bag", "adult": "w110", "kids": None, "note": "Westford Mill cotton gymsac"},
     ]},
]

FRONT_LABEL = {"chest": "Logo on the chest", "hip": "Logo on the hip", "bag": "Logo on the front"}


def _kind_of(pid: str) -> Optional[Tuple[Dict, Dict]]:
    for s in SETS:
        for o in s["options"]:
            if pid in (o["adult"], o.get("kids")):
                return s, o
    return None


def _age_key(sz: str) -> Tuple[int, str]:
    m = re.match(r"(\d+)", sz or "")
    return (int(m.group(1)) if m else 99, sz)


_ADULT_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"]


def _adult_sorted(sizes: List[str]) -> List[str]:
    return sorted(sizes, key=lambda s: (_ADULT_ORDER.index(s) if s in _ADULT_ORDER else 50, s))


def dance_print(product_id: str, placements: List[str], color: Optional[str]) -> Tuple[List[str], float]:
    """Print positions + cost for a dance-kit line (called from
    server._resolve_line_pricing). Also checks the colour is a real one."""
    from server import PRODUCTS
    found = _kind_of(product_id)
    if not found:
        raise HTTPException(400, f"{product_id} isn't part of the dance studio kit")
    s, _ = found
    k = KINDS[s["kind"]]
    names = [(c.get("name") if isinstance(c, dict) else c) for c in ((PRODUCTS.get(product_id) or {}).get("colors") or [])]
    if names and color not in names:
        raise HTTPException(400, f"{(PRODUCTS.get(product_id) or {}).get('name', product_id)} isn't made in {color or 'that colour'} - pick another colour")
    wanted = set(placements or [])
    clean: List[str] = []
    cost = 0.0
    if k["big_front"] and "big-front" in wanted:
        clean.append("big-front"); cost += BIG_FRONT_PRICE
    elif "logo" in wanted or not k["logo_optional"]:
        clean.append("logo"); cost += LOGO_PRICE
    if k["name"] and "name" in wanted:
        clean.append("name"); cost += NAME_PRICE
    if k["back"] and "back-logo" in wanted:
        clean.append("back-logo"); cost += BACK_LOGO_PRICE
    return clean, round(cost, 2)


def _side(pid: Optional[str], kid_labels: Optional[Dict[str, str]] = None, kids: bool = False) -> Optional[Dict]:
    from server import PRODUCTS, is_live
    p = PRODUCTS.get(pid or "")
    if not p or not is_live(p):
        return None
    sizes = list(p.get("sizes") or [])
    if kids:
        sizes = sorted(sizes, key=lambda z: _age_key((kid_labels or {}).get(z, z)))
    else:
        sizes = _adult_sorted(sizes)
    ups = p.get("size_upcharges") or {}
    return {
        "product_id": p["id"], "name": p.get("name"), "price": float(p.get("price") or 0),
        "sizes": [{"value": z, "label": (kid_labels or {}).get(z, z), "price": round(float(p.get("price") or 0) + float(ups.get(z, 0) or 0), 2)} for z in sizes],
        "colour_upcharges": p.get("colour_upcharges") or {},
        "image": p.get("image") or "",
    }


@api_router.get("/dance-kit/config")
async def dance_kit_config():
    from server import PRODUCTS
    sets = []
    for s in SETS:
        opts = []
        for o in s["options"]:
            adult = _side(o["adult"])
            if not adult:
                continue
            kids = _side(o.get("kids"), o.get("kid_labels"), kids=True) if o.get("kids") else None
            kid_names = {(c.get("name") if isinstance(c, dict) else c) for c in ((PRODUCTS.get(o.get("kids") or "") or {}).get("colors") or [])}
            cols = [{"name": c["name"], "hex": c.get("hex") or "#cccccc", "image": c.get("image") or adult["image"],
                     "kids": (c["name"] in kid_names) if kids else None}
                    for c in (PRODUCTS[o["adult"]].get("colors") or []) if isinstance(c, dict) and c.get("name")]
            opts.append({"id": o["id"], "label": o["label"], "note": o["note"], "adult": adult, "kids": kids, "colours": cols})
        if opts:
            k = KINDS[s["kind"]]
            sets.append({"key": s["key"], "title": s["title"], "sub": s["sub"], "kind": s["kind"], "options": opts,
                         "prints": {"front_label": FRONT_LABEL[k["front"]], "logo_optional": k["logo_optional"],
                                    "big_front": k["big_front"], "name": k["name"], "back": k["back"]}})
    return {"sets": sets, "prices": {"logo": LOGO_PRICE, "big_front": BIG_FRONT_PRICE, "name": NAME_PRICE, "back_logo": BACK_LOGO_PRICE}}
