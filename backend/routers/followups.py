"""Follow-up emails (Tim, Oct 2026) - run in the background every 30 minutes.

1. Review requests: REVIEW_DAYS after an order is paid (paid_at / paid_email
   are stamped by server._maybe_send_order_emails), email the customer a link
   to /review/<token>: star rating + comment for each thing they bought and
   for the shop. Reviews come in verified, and wait in Admin > Reviews for
   approval like every other review.
2. Abandoned baskets:
   - basket checkouts (kind "cart") that were never paid: once the Stripe
     session is 3+ hours old, if the customer typed their email on Stripe's
     page (or we already had it) and hasn't paid since, send one reminder with
     a link that puts the same basket back (/basket/restore/<token>);
   - logged-in customers whose saved basket hasn't changed for 4+ hours.
   One reminder per basket, at most one a week per person, never after they've
   ordered, and every email has a "no more reminders" link.

Orders and baskets from before this was switched on are left alone.
"""
from __future__ import annotations

import asyncio
import html
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel

from deps import api_router, db

log = logging.getLogger(__name__)

REVIEW_DAYS = int(os.environ.get("REVIEW_REQUEST_DAYS", "10"))
CART_HOURS = 3
SAVED_CART_HOURS = 4
REMIND_GAP_DAYS = 7
STARTED_KEY = "followups_started_at"


def _site() -> str:
    return (os.environ.get("SITE_BASE_URL") or "https://www.yourownprint.co.uk").rstrip("/")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d: datetime) -> str:
    return d.isoformat()


async def _started_at() -> str:
    """Only orders / baskets after the feature went live get emails."""
    doc = await db.settings.find_one({"key": STARTED_KEY})
    if doc:
        return doc["at"]
    at = _iso(_now())
    await db.settings.update_one({"key": STARTED_KEY}, {"$setOnInsert": {"key": STARTED_KEY, "at": at}}, upsert=True)
    return (await db.settings.find_one({"key": STARTED_KEY}))["at"]


async def _opted_out(email: str) -> bool:
    return bool(await db.email_optouts.find_one({"email": (email or "").lower()}))


async def _optout_link(email: str) -> str:
    email = (email or "").lower()
    doc = await db.email_optout_tokens.find_one({"email": email})
    if not doc:
        doc = {"email": email, "token": secrets.token_urlsafe(16)}
        await db.email_optout_tokens.insert_one(doc)
    from server import _backend_public_url
    return f"{_backend_public_url()}/api/email/stop/{doc['token']}"


def _order_products(doc: Dict) -> List[Dict]:
    from server import PRODUCTS
    ids = [it.get("product_id") for it in (doc.get("items") or [])] or [doc.get("product_id")]
    out, seen = [], set()
    for pid in ids:
        p = PRODUCTS.get(pid or "")
        if not p or pid in seen:
            continue
        seen.add(pid)
        out.append({"id": pid, "name": p.get("name"), "image": p.get("image") or ""})
    return out[:6]


async def _send(to: str, subject: str, title: str, body: str) -> bool:
    from services.email import send_email, email_wrap
    res = await send_email(to=[to], subject=subject, html=email_wrap(title, body))
    return bool(res.get("ok"))


def _btn(url: str, label: str) -> str:
    return (f"<p style='margin:22px 0'><a href='{html.escape(url)}' style='background:#7bc67e;color:#1a1a1a;"
            f"font-weight:800;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block'>{html.escape(label)}</a></p>")


def _list(products: List[Dict]) -> str:
    return "<ul style='padding-left:18px;font-size:14px'>" + "".join(f"<li>{html.escape(p['name'] or '')}</li>" for p in products) + "</ul>"


# ---------------------------------------------------------------- reviews

async def _review_requests():
    started = await _started_at()
    due = _iso(_now() - timedelta(days=REVIEW_DAYS))
    q = {"payment_status": "paid", "paid_at": {"$gte": started, "$lte": due},
         "paid_email": {"$nin": [None, ""]}, "review_request_sent": {"$ne": True}}
    async for doc in db.payment_transactions.find(q).limit(40):
        claim = await db.payment_transactions.update_one(
            {"session_id": doc["session_id"], "review_request_sent": {"$ne": True}},
            {"$set": {"review_request_sent": True}})
        if not claim.modified_count:
            continue
        email = doc["paid_email"]
        if await _opted_out(email):
            continue
        products = _order_products(doc)
        token = secrets.token_urlsafe(18)
        await db.payment_transactions.update_one({"session_id": doc["session_id"]}, {"$set": {"review_token": token}})
        url = f"{_site()}/review/{token}"
        body = (
            "<p>Hope you're happy with your order! Would you take 30 seconds to tell us how we did?</p>"
            + (_list(products) if products else "")
            + "<p style='font-size:22px;letter-spacing:4px;margin:12px 0'>"
            + "".join(f"<a href='{url}?stars={n}' style='text-decoration:none;color:#f59e0b'>&#9733;</a>" for n in range(1, 6))
            + "</p>" + _btn(url, "Leave a quick review")
            + "<p style='color:#4b5563;font-size:13px'>Photos of your kit in action are always brilliant to see too.</p>"
            + f"<p style='color:#9ca3af;font-size:11px;margin-top:20px'><a href='{await _optout_link(email)}' style='color:#9ca3af'>Don't send me emails like this</a></p>")
        ok = await _send(email, "How did we do? Quick review of your Your Own Print order", "How did we do?", body)
        if not ok:
            await db.payment_transactions.update_one({"session_id": doc["session_id"]}, {"$set": {"review_request_sent": False}})


@api_router.get("/review-request/{token}")
async def review_request(token: str):
    doc = await db.payment_transactions.find_one({"review_token": token})
    if not doc:
        raise HTTPException(404, "This review link has expired")
    return {"products": _order_products(doc), "done": bool(doc.get("review_done")),
            "name": ((doc.get("delivery") or {}).get("name") or "").split(" ")[0]}


class ReviewItem(BaseModel):
    product_id: str
    rating: int
    body: str = ""
    title: str = ""
    photos: List[str] = []


class ReviewSubmit(BaseModel):
    reviewer_name: str = ""
    reviews: List[ReviewItem]


@api_router.post("/review-request/{token}")
async def review_request_submit(token: str, payload: ReviewSubmit):
    from server import STORE_REVIEW_ID, _photo_ok
    doc = await db.payment_transactions.find_one({"review_token": token})
    if not doc:
        raise HTTPException(404, "This review link has expired")
    if doc.get("review_done"):
        raise HTTPException(400, "Thanks - we've already got your review!")
    allowed = {p["id"] for p in _order_products(doc)} | {STORE_REVIEW_ID}
    saved = 0
    for r in payload.reviews[:7]:
        if r.product_id not in allowed or not (1 <= r.rating <= 5):
            continue
        await db.reviews.insert_one({
            "id": secrets.token_hex(16), "product_id": r.product_id,
            "reviewer_name": (payload.reviewer_name or "").strip()[:80] or "Verified customer",
            "reviewer_email": doc.get("paid_email"), "rating": int(r.rating),
            "title": (r.title or "").strip()[:120], "body": (r.body or "").strip()[:2000],
            "photos": [p for p in (r.photos or [])[:4] if _photo_ok(p)],
            "verified": True, "source": "native", "approved": False,
            "order_session": doc["session_id"], "created_at": _iso(_now()),
        })
        saved += 1
    if not saved:
        raise HTTPException(400, "Pick a star rating first")
    await db.payment_transactions.update_one({"session_id": doc["session_id"]}, {"$set": {"review_done": True}})
    return {"ok": True, "saved": saved}


# --------------------------------------------------------- abandoned baskets

async def _paid_since(email: str, since: str) -> bool:
    return bool(await db.payment_transactions.find_one(
        {"payment_status": "paid", "paid_email": {"$regex": f"^{_re_escape(email)}$", "$options": "i"}, "paid_at": {"$gte": since}}))


def _re_escape(s: str) -> str:
    import re
    return re.escape(s or "")


async def _recently_reminded(email: str) -> bool:
    doc = await db.basket_reminder_people.find_one({"email": email.lower()})
    return bool(doc and doc.get("at", "") >= _iso(_now() - timedelta(days=REMIND_GAP_DAYS)))


async def _remind(email: str, items: List[Dict], key: str) -> bool:
    """Send one basket reminder (items = cart lines). Returns True if sent."""
    email = (email or "").strip().lower()
    if not email or not items or await _opted_out(email) or await _recently_reminded(email):
        return False
    if await db.basket_reminders.find_one({"key": key}):
        return False
    token = secrets.token_urlsafe(18)
    await db.basket_restores.insert_one({"token": token, "items": items, "created_at": _iso(_now())})
    await db.basket_reminder_people.update_one({"email": email}, {"$set": {"email": email, "at": _iso(_now())}}, upsert=True)
    await db.basket_reminders.insert_one({"key": key, "email": email, "at": _iso(_now())})
    products = _order_products({"items": items})
    url = f"{_site()}/basket/restore/{token}"
    body = ("<p>You left a few things in your basket - we've saved it for you.</p>" + _list(products)
            + _btn(url, "Back to my basket")
            + "<p style='color:#4b5563;font-size:13px'>Questions about printing, sizes or your logo? Just reply to this email or WhatsApp us - happy to help.</p>"
            + f"<p style='color:#9ca3af;font-size:11px;margin-top:20px'><a href='{await _optout_link(email)}' style='color:#9ca3af'>Don't send me basket reminders</a></p>")
    return await _send(email, "You left something in your basket", "Still thinking it over?", body)


def _restore_lines(items: List[Dict]) -> List[Dict]:
    keep = ("product_id", "size_qtys", "color", "placements", "blank", "design_meta")
    out = []
    for it in items:
        if it.get("product_id") and it.get("size_qtys"):
            ln = {k: it.get(k) for k in keep}
            ln["placements"] = ln.get("placements") or []
            ln["blank"] = bool(ln.get("blank"))
            ln["design_meta"] = ln.get("design_meta") or {}
            out.append(ln)
    return out


async def _abandoned_checkouts():
    from server import STRIPE_API_KEY
    from services.stripe_checkout import get_checkout_status
    started = await _started_at()
    cutoff = _iso(_now() - timedelta(hours=CART_HOURS))
    oldest = _iso(_now() - timedelta(hours=30))
    q = {"kind": "cart", "payment_status": {"$ne": "paid"}, "created_at": {"$gte": max(started, oldest), "$lte": cutoff},
         "basket_reminder_checked": {"$ne": True}}
    async for doc in db.payment_transactions.find(q).limit(40):
        await db.payment_transactions.update_one({"session_id": doc["session_id"]}, {"$set": {"basket_reminder_checked": True}})
        email = doc.get("customer_email")
        try:
            st = await get_checkout_status(STRIPE_API_KEY, doc["session_id"])
            if getattr(st, "payment_status", "") == "paid":
                continue
            details = getattr(st, "customer_details", None)
            email = email or (getattr(details, "email", None) if details else None)
        except Exception as e:
            log.info(f"basket reminder: stripe lookup failed {e}")
        if not email or await _paid_since(email, doc["created_at"]):
            continue
        await _remind(email, _restore_lines(doc.get("items") or []), f"checkout:{doc['session_id']}")


async def _abandoned_saved_carts():
    started = await _started_at()
    cutoff = _iso(_now() - timedelta(hours=SAVED_CART_HOURS))
    async for cart in db.customer_carts.find({"updated_at": {"$gte": started, "$lte": cutoff}, "items.0": {"$exists": True}}).limit(60):
        key = f"saved:{cart['customer_id']}:{cart['updated_at']}"
        if await db.basket_reminders.find_one({"key": key}):
            continue
        cust = await db.customers.find_one({"id": cart["customer_id"]}, {"email": 1})
        email = (cust or {}).get("email")
        if not email or await _paid_since(email, cart["updated_at"]):
            await db.basket_reminders.insert_one({"key": key, "email": (email or "").lower(), "at": _iso(_now()), "skipped": True})
            continue
        await _remind(email, _restore_lines(cart.get("items") or []), key)


@api_router.get("/basket/restore/{token}")
async def basket_restore(token: str):
    doc = await db.basket_restores.find_one({"token": token})
    if not doc:
        raise HTTPException(404, "This basket link has expired")
    return {"items": doc.get("items") or []}


@api_router.get("/email/stop/{token}")
async def email_stop(token: str):
    from fastapi.responses import HTMLResponse
    doc = await db.email_optout_tokens.find_one({"token": token})
    if doc:
        await db.email_optouts.update_one({"email": doc["email"]}, {"$set": {"email": doc["email"], "at": _iso(_now())}}, upsert=True)
    return HTMLResponse("<html><body style='font-family:sans-serif;text-align:center;padding:60px'>"
                        "<h2>Done - no more emails like that.</h2><p>You'll still get receipts and updates about orders you place.</p>"
                        f"<p><a href='{_site()}'>Back to Your Own Print</a></p></body></html>")


# ---------------------------------------------------------------- loop

async def _loop():
    await asyncio.sleep(90)
    while True:
        for job in (_review_requests, _abandoned_checkouts, _abandoned_saved_carts):
            try:
                await job()
            except Exception as e:
                log.warning(f"follow-up job {job.__name__} failed: {e}")
        await asyncio.sleep(30 * 60)


def start():
    asyncio.create_task(_loop())
