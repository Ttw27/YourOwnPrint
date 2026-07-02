"""Configurator addon prices — Full Squad + Sports Outfit + combined GET.

Admin can edit per-addon prices at `/admin/configurator-settings`. Prices are
merged over the code defaults so a partial save never clobbers other fields.

We import `FULL_SQUAD_ADDON_DEFAULTS` and `SPORTS_OUTFIT_ADDON_DEFAULTS` from
server.py at import time — this router module is imported at the END of server.py
so the defaults are already defined.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict

from fastapi import Depends, HTTPException

from deps import api_router, db, require_admin
from server import FULL_SQUAD_ADDON_DEFAULTS, SPORTS_OUTFIT_ADDON_DEFAULTS


_FULL_SQUAD_KEYS = (
    "sleeve_print_price", "back_upload_print_price",
    "back_name_and_number_price", "gym_bag_addon_price",
)
_SPORTS_OUTFIT_KEYS = (
    "unbranded_price", "breast_print_price",
    "back_print_price", "full_front_print_price",
)


def _clean_prices(values: Dict, allowed_keys: tuple) -> Dict:
    """Validate + clamp addon prices to 0–999 £. Ignores unknown keys."""
    cleaned: Dict = {}
    for k in allowed_keys:
        if k in values:
            try:
                v = round(float(values[k]), 2)
            except (TypeError, ValueError):
                raise HTTPException(400, f"{k} must be a number")
            if v < 0 or v > 999:
                raise HTTPException(400, f"{k} must be between 0 and 999")
            cleaned[k] = v
    return cleaned


async def _merge_and_save(settings_key: str, cleaned: Dict) -> Dict:
    """Read existing settings.<key>.values, merge in cleaned, write back."""
    existing = (await db.settings.find_one({"key": settings_key}) or {}).get("values") or {}
    merged = {**existing, **cleaned}
    await db.settings.update_one(
        {"key": settings_key},
        {"$set": {"key": settings_key, "values": merged,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return merged


@api_router.patch("/admin/sports-outfit/addons", dependencies=[Depends(require_admin)])
async def admin_update_sports_outfit_addons(payload: Dict):
    values = payload.get("values") or {}
    if not isinstance(values, dict):
        raise HTTPException(400, "values must be an object")
    merged = await _merge_and_save("sports_outfit_addons", _clean_prices(values, _SPORTS_OUTFIT_KEYS))
    return {"ok": True, "values": merged}


@api_router.patch("/admin/full-squad/addons", dependencies=[Depends(require_admin)])
async def admin_update_full_squad_addons(payload: Dict):
    values = payload.get("values") or {}
    if not isinstance(values, dict):
        raise HTTPException(400, "values must be an object")
    merged = await _merge_and_save("full_squad_addons", _clean_prices(values, _FULL_SQUAD_KEYS))
    return {"ok": True, "values": merged}


@api_router.get("/admin/configurator-settings", dependencies=[Depends(require_admin)])
async def admin_get_configurator_settings():
    """Returns full-squad + sports-outfit addon prices, defaults merged with any admin overrides."""
    fs = (await db.settings.find_one({"key": "full_squad_addons"}) or {}).get("values") or {}
    so = (await db.settings.find_one({"key": "sports_outfit_addons"}) or {}).get("values") or {}
    return {
        "full_squad": {**FULL_SQUAD_ADDON_DEFAULTS, **fs},
        "sports_outfit": {**SPORTS_OUTFIT_ADDON_DEFAULTS, **so},
    }
