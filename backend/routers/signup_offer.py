"""10% off your first order for an email sign-up (Tim, Oct 2026).

POST /signup-offer {email}: saves the subscriber (marketing consent given on
the form), creates a single-use Stripe promotion code (WELCOME-XXXXXX, 10%
off, valid 60 days) on a shared Stripe coupon, and emails it. The customer
types it on Stripe's checkout page (every checkout allows promotion codes).
Admin > Email sign-ups lists everyone, with a CSV download.
"""
from __future__ import annotations

import asyncio
import csv
import html
import io
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

import stripe
from fastapi import Depends, HTTPException, Request, Response
from pydantic import BaseModel

from deps import api_router, db, require_admin

PERCENT_OFF = 10
VALID_DAYS = 60
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def _site() -> str:
    return (os.environ.get("SITE_BASE_URL") or "https://www.yourownprint.co.uk").rstrip("/")


async def _coupon_id(api_key: str) -> str:
    mode = "live" if api_key.startswith(("sk_live", "rk_live")) else "test"
    key = f"welcome_coupon_{mode}"
    doc = await db.settings.find_one({"key": key})
    if doc:
        return doc["coupon_id"]
    stripe.api_key = api_key
    c = await asyncio.to_thread(stripe.Coupon.create, percent_off=PERCENT_OFF, duration="once",
                                name=f"Welcome {PERCENT_OFF}% off first order")
    await db.settings.update_one({"key": key}, {"$set": {"key": key, "coupon_id": c.id}}, upsert=True)
    return c.id


class SignupIn(BaseModel):
    email: str
    source: str = "popup"


@api_router.post("/signup-offer")
async def signup_offer(payload: SignupIn, request: Request):
    from server import STRIPE_API_KEY
    from routers.followups import _optout_link
    from services.email import send_email, email_wrap
    email = (payload.email or "").strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 200:
        raise HTTPException(400, "Please enter a valid email address")
    now = datetime.now(timezone.utc)
    # at most 5 sign-ups an hour from one address (each makes a Stripe code)
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    hour_ago = (now - timedelta(hours=1)).isoformat()
    if await db.signup_attempts.count_documents({"ip": ip, "at": {"$gte": hour_ago}}) >= 5:
        raise HTTPException(429, "Too many sign-ups - please try again later")
    await db.signup_attempts.insert_one({"ip": ip, "at": now.isoformat()})
    existing = await db.subscribers.find_one({"email": email})
    if existing and existing.get("code"):
        # don't hand out a second code - just resend the first (at most every 10 minutes)
        if existing.get("sent_at", "") > (now - timedelta(minutes=10)).isoformat():
            return {"ok": True}
        code = existing["code"]
    else:
        if not STRIPE_API_KEY:
            raise HTTPException(503, "Sign-ups are paused just now - please try again later")
        try:
            coupon = await _coupon_id(STRIPE_API_KEY)
            code = "WELCOME-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
            stripe.api_key = STRIPE_API_KEY
            await asyncio.to_thread(stripe.PromotionCode.create, coupon=coupon, code=code, max_redemptions=1,
                                    expires_at=int((now + timedelta(days=VALID_DAYS)).timestamp()))
        except Exception as e:
            raise HTTPException(502, f"Couldn't create your code just now - please try again ({str(e)[:80]})")
        await db.subscribers.update_one({"email": email}, {"$set": {
            "email": email, "code": code, "source": (payload.source or "")[:40], "consent": True,
            "created_at": now.isoformat()}}, upsert=True)
    body = (f"<p>Thanks for signing up! Here's <strong>{PERCENT_OFF}% off</strong> your first order:</p>"
            f"<p style='font-size:26px;font-weight:900;letter-spacing:3px;background:#f0fdf4;border:2px dashed #7bc67e;"
            f"padding:14px;text-align:center;border-radius:12px'>{html.escape(code)}</p>"
            f"<p>Enter it on the payment page (&quot;Add promotion code&quot;). Valid for {VALID_DAYS} days, one order.</p>"
            f"<p style='margin:22px 0'><a href='{_site()}' style='background:#7bc67e;color:#1a1a1a;font-weight:800;text-decoration:none;"
            f"padding:12px 22px;border-radius:999px;display:inline-block'>Start shopping</a></p>"
            f"<p style='color:#9ca3af;font-size:11px'>You signed up for offers from Your Own Print. "
            f"<a href='{await _optout_link(email)}' style='color:#9ca3af'>Unsubscribe</a></p>")
    res = await send_email(to=[email], subject=f"Your {PERCENT_OFF}% off code", html=email_wrap(f"Here's {PERCENT_OFF}% off", body))
    await db.subscribers.update_one({"email": email}, {"$set": {"sent_at": now.isoformat(), "email_ok": bool(res.get("ok"))}})
    return {"ok": True}


@api_router.get("/admin/subscribers", dependencies=[Depends(require_admin)])
async def admin_subscribers(format: str = "json"):
    rows = [d async for d in db.subscribers.find({}, {"_id": 0}).sort("created_at", -1)]
    stopped = {d["email"] async for d in db.email_optouts.find({}, {"email": 1})}
    for r in rows:
        r["unsubscribed"] = r.get("email") in stopped
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["email", "signed_up", "code", "source", "unsubscribed"])
        for r in rows:
            w.writerow([r.get("email"), (r.get("created_at") or "")[:10], r.get("code"), r.get("source"), "yes" if r["unsubscribed"] else ""])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=email-signups.csv"})
    return {"items": rows, "total": len(rows)}
