"""Site-wide launch offer - LAUNCH10, 10% off until 30 Nov 2026 (Tim, Oct 2026).

Admin > Launch offer switches it on/off. Switching ON makes sure Stripe has the
promotion code (10% coupon, used once per order, expires at the end date) and
re-activates it; switching OFF deactivates it in Stripe. While it's on (and the
end date hasn't passed) GET /site/launch-offer tells the site to show the banner
(LaunchBanner.jsx) and pause the email sign-up popup. Customers type the code on
Stripe's checkout page; it's hidden on orders already 15%+ off (server.promo_codes_ok).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from deps import api_router, db, require_admin

KEY = "launch_offer"
DEFAULTS = {"on": False, "code": "LAUNCH10", "pct": 10, "ends": "2026-11-30"}


async def _settings() -> dict:
    doc = await db.settings.find_one({"key": KEY}) or {}
    return {**DEFAULTS, **{k: v for k, v in doc.items() if k != "_id"}}


def _mode(api_key: str) -> str:
    return "live" if api_key.startswith(("sk_live", "rk_live")) else "test"


def _ends_ts(ends: str) -> int:
    """End of the end date, UK time (GMT in late November)."""
    d = datetime.strptime(ends, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    return int(d.timestamp())


def _running(s: dict) -> bool:
    try:
        return bool(s.get("on")) and datetime.now(timezone.utc).timestamp() <= _ends_ts(s["ends"])
    except (KeyError, ValueError):
        return False


async def _stripe_code(api_key: str, s: dict, active: bool) -> dict:
    """Find or create the promotion code in Stripe and set it active/inactive."""
    stripe.api_key = api_key
    mode = _mode(api_key)
    pid = (s.get("promo_ids") or {}).get(mode)
    promo = None
    if pid:
        try:
            promo = await asyncio.to_thread(stripe.PromotionCode.retrieve, pid)
        except Exception:
            promo = None
    if promo is None:
        # made by hand in Stripe already? reuse it rather than clash on the code
        found = await asyncio.to_thread(stripe.PromotionCode.list, code=s["code"], limit=1)
        promo = found.data[0] if found.data else None
    if promo is None:
        if not active:
            return {}
        cname = f"{s['code']} - {s['pct']}% off (launch)"
        # reuse our coupon from an earlier try (e.g. one whose code failed), else make it
        coupons = await asyncio.to_thread(stripe.Coupon.list, limit=100)
        coupon = next((c for c in coupons.data if c.name == cname and c.valid), None) or \
            await asyncio.to_thread(stripe.Coupon.create, percent_off=s["pct"], duration="once", name=cname)
        promo = await asyncio.to_thread(stripe.PromotionCode.create, promotion={"type": "coupon", "coupon": coupon.id}, code=s["code"],
                                        expires_at=_ends_ts(s["ends"]))
    elif bool(promo.active) != active:
        promo = await asyncio.to_thread(stripe.PromotionCode.modify, promo.id, active=active)
    await db.settings.update_one({"key": KEY}, {"$set": {f"promo_ids.{mode}": promo.id}}, upsert=True)
    return {"id": promo.id, "active": bool(promo.active), "times_redeemed": int(promo.times_redeemed or 0),
            "expires_at": promo.expires_at}


@api_router.get("/site/launch-offer")
async def public_launch_offer():
    s = await _settings()
    if not _running(s):
        return {"on": False}
    return {"on": True, "code": s["code"], "pct": s["pct"], "ends": s["ends"]}


@api_router.get("/admin/launch-offer", dependencies=[Depends(require_admin)])
async def admin_get_launch_offer():
    from server import STRIPE_API_KEY
    s = await _settings()
    stripe_info, err = {}, ""
    pid = (s.get("promo_ids") or {}).get(_mode(STRIPE_API_KEY or ""))
    if STRIPE_API_KEY and pid:
        try:
            stripe.api_key = STRIPE_API_KEY
            p = await asyncio.to_thread(stripe.PromotionCode.retrieve, pid)
            stripe_info = {"active": bool(p.active), "times_redeemed": int(p.times_redeemed or 0)}
        except Exception as e:
            err = str(e)[:120]
    return {"on": bool(s["on"]), "running": _running(s), "code": s["code"], "pct": s["pct"], "ends": s["ends"],
            "stripe_mode": _mode(STRIPE_API_KEY or ""), "stripe": stripe_info, "error": err}


class LaunchOfferIn(BaseModel):
    on: bool
    ends: Optional[str] = None


@api_router.put("/admin/launch-offer", dependencies=[Depends(require_admin)])
async def admin_set_launch_offer(payload: LaunchOfferIn):
    from server import STRIPE_API_KEY
    s = await _settings()
    if payload.ends:
        try:
            _ends_ts(payload.ends)
        except ValueError:
            raise HTTPException(400, "End date must look like 2026-11-30")
        if payload.ends != s["ends"] and (s.get("promo_ids") or {}):
            raise HTTPException(400, "The end date is fixed once the code exists in Stripe - "
                                     "Stripe can't change a code's expiry. Ask Claude to set up a new code instead.")
        s["ends"] = payload.ends
    if payload.on and not STRIPE_API_KEY:
        raise HTTPException(503, "Stripe isn't connected (Admin > Integrations)")
    if STRIPE_API_KEY:
        try:
            await _stripe_code(STRIPE_API_KEY, s, payload.on)
        except Exception as e:
            raise HTTPException(502, f"Stripe didn't accept that just now: {str(e)[:120]}")
    await db.settings.update_one({"key": KEY}, {"$set": {"key": KEY, "on": payload.on, "ends": s["ends"],
                                                         "code": s["code"], "pct": s["pct"],
                                                         "updated_at": datetime.now(timezone.utc).isoformat()}},
                                 upsert=True)
    return await admin_get_launch_offer()
