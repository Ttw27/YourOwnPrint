"""Team kits built from real garments (Tim, Oct 2026).

Each kit = real PenCarrie garments (adult + kids versions), the customer picks
the colour of each part, and the price comes from a table worked out from the
supplier costs at ~55% margin after VAT + Stripe (kids clothing is zero-rated,
hence cheaper). Names & numbers on the back and the badge on the front are
included; socks and names can be switched off for a cheaper kit.

The kit products themselves live in server.PRODUCTS (ids below, category
"team-kits") and are ordered through TeamKitConfigurator on /product/:id.
Server pricing: server._resolve_line_pricing -> team_kit_pricing().
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import HTTPException

from deps import api_router

KIDS_SIZES = ["3-4", "5-6", "7-8", "9-11", "12-13"]
ADULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"]

# £ per player (inc VAT where due). Keys: "<socks|nosocks>_<names|badge>".
_CLASSIC = {
    "adult": {"socks_names": 28.99, "socks_badge": 25.99, "nosocks_names": 23.99, "nosocks_badge": 20.99},
    "kids":  {"socks_names": 21.99, "socks_badge": 18.99, "nosocks_names": 16.99, "nosocks_badge": 14.99},
}
_CONTRAST = {
    "adult": {"socks_names": 30.99, "socks_badge": 27.99, "nosocks_names": 25.99, "nosocks_badge": 22.99},
    "kids":  {"socks_names": 22.99, "socks_badge": 19.99, "nosocks_names": 17.99, "nosocks_badge": 15.99},
}

KITS: Dict[str, Dict] = {
    "kit-classic": {
        "parts": [
            {"key": "shirt", "label": "Shirt", "adult": "jc001", "kids": "jc001b"},
            {"key": "shorts", "label": "Shorts", "adult": "jc080", "kids": "jc080b"},
            {"key": "socks", "label": "Socks", "adult": "pa016", "kids": "pa016"},
        ],
        "prices": _CLASSIC, "defaults": {"socks": True, "names": True}, "options": True,
        "garments": "AWDis Cool T-Shirt (JC001) + AWDis Cool Shorts (JC080) + Proact football socks (PA016)",
    },
    "kit-contrast": {
        "parts": [
            {"key": "shirt", "label": "Shirt", "adult": "jc003", "kids": "jc003b"},
            {"key": "shorts", "label": "Shorts", "adult": "jc080", "kids": "jc080b"},
            {"key": "socks", "label": "Socks", "adult": "pa016", "kids": "pa016"},
        ],
        "prices": _CONTRAST, "defaults": {"socks": True, "names": True}, "options": True,
        "garments": "AWDis Cool Contrast T-Shirt (JC003) + AWDis Cool Shorts (JC080) + Proact football socks (PA016)",
    },
    "kit-training": {
        "parts": [
            {"key": "shirt", "label": "Top", "adult": "jc001", "kids": "jc001b"},
            {"key": "shorts", "label": "Shorts", "adult": "jc080", "kids": "jc080b"},
            {"key": "socks", "label": "Socks", "adult": "pa016", "kids": "pa016"},
        ],
        "prices": _CLASSIC, "defaults": {"socks": False, "names": False}, "options": True,
        "garments": "AWDis Cool T-Shirt (JC001) + AWDis Cool Shorts (JC080)",
    },
    "kit-tracksuit": {
        "parts": [
            {"key": "hoodie", "label": "Hoodie", "adult": "jh001", "kids": None},
            {"key": "joggers", "label": "Joggers", "adult": "jh072", "kids": None},
        ],
        "prices": {"adult": {"fixed": 38.99}}, "defaults": {"socks": False, "names": False}, "options": False,
        "garments": "AWDis College Hoodie (JH001) + AWDis College Cuffed Joggers (JH072) - badge on both",
        "adult_only": True,
    },
}


def is_kit(pid: str) -> bool:
    return pid in KITS


def kit_sizes(pid: str) -> List[str]:
    return ADULT_SIZES if KITS[pid].get("adult_only") else ADULT_SIZES + KIDS_SIZES


def _flag(meta: Dict, key: str, default: bool) -> bool:
    v = (meta or {}).get(key)
    if v is None or v == "":
        return default
    return str(v).lower() in ("yes", "true", "1", "on")


def kit_price(pid: str, group: str, socks: bool, names: bool) -> float:
    prices = KITS[pid]["prices"]
    if "fixed" in prices.get("adult", {}):
        return float(prices["adult"]["fixed"])
    return float(prices[group][f"{'socks' if socks else 'nosocks'}_{'names' if names else 'badge'}"])


def _colour_names(pid: Optional[str]) -> List[str]:
    from server import PRODUCTS
    p = PRODUCTS.get(pid or "") or {}
    return [(c.get("name") if isinstance(c, dict) else c) for c in (p.get("colors") or [])]


def team_kit_pricing(pid: str, design_meta: Dict, sizes: Optional[List[str]] = None) -> Dict:
    """Base (adult) price, per-size adjustments for kids sizes, allowed sizes,
    and the chosen options - validated. Used by server._resolve_line_pricing."""
    kit = KITS[pid]
    d = kit["defaults"]
    socks = _flag(design_meta, "kit_socks", d["socks"]) if kit["options"] else d["socks"]
    names = _flag(design_meta, "kit_names", d["names"]) if kit["options"] else d["names"]
    # Every part's colour must be one that part really comes in.
    for part in kit["parts"]:
        if part["key"] == "socks" and not socks:
            continue
        chosen = ((design_meta or {}).get(f"{part['key']}_colour") or "").strip()
        names_ok = set(_colour_names(part["adult"]))
        if not chosen or (names_ok and chosen not in names_ok):
            raise HTTPException(400, f"Please choose a colour for the {part['label'].lower()}")
        # kids sizes in the order -> that colour must come in the kids version too
        if part.get("kids") and part["kids"] != part["adult"] and any(s in KIDS_SIZES for s in (sizes or [])):
            kid_ok = set(_colour_names(part["kids"]))
            if kid_ok and chosen not in kid_ok:
                raise HTTPException(400, f"The {part['label'].lower()} in {chosen} isn't made in kids sizes - pick another colour for a squad with kids")
    adult = kit_price(pid, "adult", socks, names)
    ups = {} if kit.get("adult_only") else {s: round(kit_price(pid, "kids", socks, names) - adult, 2) for s in KIDS_SIZES}
    return {"base_price": adult, "size_upcharges": ups, "allowed_sizes": set(kit_sizes(pid)), "socks": socks, "names": names}


@api_router.get("/team-kits/kit/{pid}")
async def kit_details(pid: str):
    """What the kit configurator needs: each part with the colours it really
    comes in (and a photo of each), the price table and the default options."""
    from server import PRODUCTS
    if pid not in KITS:
        raise HTTPException(404, "Not a kit")
    kit = KITS[pid]
    # name -> hex across the AWDis/Proact ranges, so two-tone shirts
    # ("Fire Red/Arctic White") can show both halves as real colours
    hexes: Dict[str, str] = {}
    for src in ("jc001", "jc080", "pa016", "jh001"):
        for c in (PRODUCTS.get(src) or {}).get("colors") or []:
            if isinstance(c, dict) and c.get("name") and c.get("hex"):
                hexes.setdefault(c["name"].strip().lower(), c["hex"])
    parts = []
    for part in kit["parts"]:
        p = PRODUCTS.get(part["adult"]) or {}
        kids = PRODUCTS.get(part["kids"] or "") or {}
        kid_names = {(c.get("name") if isinstance(c, dict) else c) for c in (kids.get("colors") or [])}
        cols = []
        for c in (p.get("colors") or []):
            if not isinstance(c, dict) or not c.get("name"):
                continue
            halves = [h.strip() for h in c["name"].split("/")] if "/" in c["name"] else []
            two = [hexes.get(h.lower()) for h in halves] if halves else []
            cols.append({"name": c["name"], "hex": c.get("hex") or "#cccccc", "image": c.get("image") or p.get("image") or "",
                         "hexes": two if len(two) == 2 and all(two) else None,
                         # kids versions come in fewer colours - say which work for a mixed squad
                         "kids": (c["name"] in kid_names) if part["kids"] and part["kids"] != part["adult"] else True})
        parts.append({"key": part["key"], "label": part["label"], "product_id": part["adult"], "colours": cols})
    return {
        "id": pid, "parts": parts, "prices": kit["prices"], "defaults": kit["defaults"],
        "options": kit["options"], "garments": kit["garments"],
        "adult_sizes": ADULT_SIZES, "kids_sizes": [] if kit.get("adult_only") else KIDS_SIZES,
    }
