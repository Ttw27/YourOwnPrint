"""Meta (Facebook) Conversions API - the server-side half of "Maximum" data sharing.

When an order is paid, the Purchase is sent to Meta straight from the server
(as well as by the browser pixel), so sales still count when the browser event
is blocked (ad blockers, iOS tracking protection). It uses the same event_id as
the browser pixel (the Stripe session id), so Meta counts each sale once.

Only sent for customers who pressed "Accept all" on the cookie message
(checkouts record it from the X-Consent header). Customer details (email,
phone, name, town, postcode) are SHA-256 hashed before sending, as Meta requires.

Settings (Admin > Integrations): meta_pixel_id, meta_capi_token, and optionally
meta_test_event_code (shows the events in Events Manager > Test events).
"""
from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from deps import _get_integration_value, db

GRAPH = "https://graph.facebook.com/v21.0"
log = logging.getLogger(__name__)


def _h(v: Optional[str]) -> Optional[str]:
    v = (v or "").strip().lower()
    return hashlib.sha256(v.encode()).hexdigest() if v else None


def _phone(v: Optional[str]) -> Optional[str]:
    d = re.sub(r"\D", "", v or "")
    if not d:
        return None
    if d.startswith("00"):
        d = d[2:]
    elif d.startswith("0"):
        d = "44" + d[1:]          # UK numbers -> country code
    return hashlib.sha256(d.encode()).hexdigest()


def tracking_context(request) -> Dict:
    """What the browser told us at checkout - cookie consent, Meta's own ids,
    the page, IP and browser - saved on the order for the server-side event."""
    h = request.headers if request is not None else {}
    ip = (h.get("x-forwarded-for") or (request.client.host if request is not None and request.client else "")).split(",")[0].strip()
    return {k: v for k, v in {
        "consent": (h.get("x-consent") or "")[:20],
        "fbp": (h.get("x-fbp") or "")[:120],
        "fbc": (h.get("x-fbc") or "")[:300],
        "page": (h.get("x-page-url") or h.get("referer") or "")[:500],
        "ip": ip[:64],
        "ua": (h.get("user-agent") or "")[:400],
    }.items() if v}


async def send_purchase(doc: Dict, status_resp) -> Dict:
    """Server-side Purchase for a paid order. Never raises."""
    try:
        t = doc.get("tracking") or {}
        if t.get("consent") != "all":
            return {"skipped": "no marketing consent"}
        pixel = (await _get_integration_value("meta_pixel_id") or "").strip()
        token = (await _get_integration_value("meta_capi_token") or "").strip()
        if not pixel or not token:
            return {"skipped": "pixel id / access token not set"}
        details = getattr(status_resp, "customer_details", None)
        addr = getattr(details, "address", None) if details else None
        name = (getattr(details, "name", None) or (doc.get("delivery") or {}).get("name") or "").strip()
        first, _, last = name.partition(" ")
        email = (getattr(details, "email", None) if details else None) or doc.get("paid_email") or doc.get("customer_email") or doc.get("contact_email")
        phone = (getattr(details, "phone", None) if details else None) or (doc.get("delivery") or {}).get("phone") or doc.get("contact_phone")
        user = {k: v for k, v in {
            "em": [_h(email)] if email else None,
            "ph": [_phone(phone)] if phone else None,
            "fn": [_h(first)] if first else None,
            "ln": [_h(last.split(" ")[-1])] if last else None,
            "ct": [_h(re.sub(r"\s+", "", getattr(addr, "city", "") or ""))] if addr and getattr(addr, "city", None) else None,
            "zp": [_h(re.sub(r"\s+", "", getattr(addr, "postal_code", "") or ""))] if addr and getattr(addr, "postal_code", None) else None,
            "country": [_h((getattr(addr, "country", "") or "gb"))] if addr else [_h("gb")],
            "client_ip_address": t.get("ip"),
            "client_user_agent": t.get("ua"),
            "fbp": t.get("fbp"),
            "fbc": t.get("fbc"),
        }.items() if v}
        items = doc.get("items") or ([{"product_id": doc.get("product_id"), "total_quantity": doc.get("total_quantity")}] if doc.get("product_id") else [])
        value = float(getattr(status_resp, "amount_total", 0) or 0) / 100.0 or float(doc.get("amount") or 0)
        event = {
            "event_name": "Purchase",
            "event_time": int(time.time()),
            "event_id": doc["session_id"],           # same as the browser pixel's eventID -> counted once
            "action_source": "website",
            "event_source_url": t.get("page") or "https://www.yourownprint.co.uk/",
            "user_data": user,
            "custom_data": {
                "currency": "GBP", "value": round(value, 2),
                "content_type": "product",
                "content_ids": [i.get("product_id") for i in items if i.get("product_id")][:50],
                "num_items": int(sum(int(i.get("total_quantity") or 0) for i in items) or doc.get("total_quantity") or 1),
                "order_id": doc["session_id"],
            },
        }
        body = {"data": [event], "access_token": token}   # in the body, not the URL (URLs end up in logs)
        test_code = (await _get_integration_value("meta_test_event_code") or "").strip()
        if test_code:
            body["test_event_code"] = test_code
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{GRAPH}/{pixel}/events", json=body)
        res = {"status": r.status_code, "body": r.text[:300]}
        await db.settings.update_one({"key": "meta_capi_last"}, {"$set": {
            "key": "meta_capi_last", "at": datetime.now(timezone.utc).isoformat(), "session": doc["session_id"], **res}}, upsert=True)
        if r.status_code >= 300:
            log.warning(f"Meta CAPI purchase failed: {res}")
        return res
    except Exception as e:
        log.warning(f"Meta CAPI purchase error: {e}")
        return {"error": str(e)}
