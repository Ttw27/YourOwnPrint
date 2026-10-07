"""Direct Stripe Checkout integration.

Replaces the old `emergentintegrations.payments.stripe.checkout` wrapper, which:
  1. is not safely installable outside the Emergent sandbox (the public PyPI
     package of the same name has been flagged as malicious - it is NOT the
     same thing Emergent's own environment resolves it to), and
  2. added an extra layer of indirection for no benefit - Stripe Checkout
     Sessions are simple enough to call directly.

This module is a thin async wrapper around the official `stripe` SDK. The
returned Stripe `Session` object exposes `.id`, `.url`, `.status`,
`.payment_status`, `.amount_total` (in pence), and `.currency` - the same
fields the old wrapper exposed (it was itself just a passthrough), so callers
only need to rename `session.session_id` -> `session.id`.
"""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional

import stripe


def _configure(api_key: str) -> None:
    stripe.api_key = api_key


async def create_checkout_session(
    api_key: str,
    amount: float,
    currency: str,
    success_url: str,
    cancel_url: str,
    metadata: Optional[Dict[str, str]] = None,
    product_name: str = "Your Own Print order",
    shipping_options: Optional[List[Dict]] = None,
    allowed_countries: Optional[List[str]] = None,
    lines: Optional[List[Dict]] = None,
):
    """Creates a Checkout Session for `amount` (major units, e.g. GBP).

    `lines` = what the customer sees on Stripe's page, one row per item:
    [{"name", "description", "amount" (line total, major units), "image"}]. Used
    only if they add up to `amount` to the penny; otherwise one summary row."""
    _configure(api_key)
    total_p = int(round(amount * 100))
    items = None
    if lines:
        items = []
        for ln in lines:
            pd = {"name": (ln.get("name") or product_name)[:250]}
            if ln.get("description"):
                pd["description"] = str(ln["description"])[:500]
            img = ln.get("image") or ""
            if img.startswith("https://"):
                pd["images"] = [img]
            items.append({"price_data": {"currency": currency, "product_data": pd,
                                         "unit_amount": int(round(float(ln["amount"]) * 100))}, "quantity": 1})
        if sum(i["price_data"]["unit_amount"] for i in items) != total_p or any(i["price_data"]["unit_amount"] < 0 for i in items):
            items = None
    return await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="payment",
        payment_method_types=["card"],
        line_items=items or [
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {"name": product_name},
                    "unit_amount": total_p,
                },
                "quantity": 1,
            }
        ],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata or {},
        # sign-up codes (WELCOME-XXXXXX, routers/signup_offer.py) and any codes made in Stripe
        allow_promotion_codes=True,
        # Delivery choice (collect / local / UK by weight) + address + phone on
        # Stripe's page - see routers/delivery.py.
        **({"shipping_options": shipping_options,
            "shipping_address_collection": {"allowed_countries": allowed_countries or ["GB"]},
            "phone_number_collection": {"enabled": True}} if shipping_options else {}),
    )


async def get_checkout_status(api_key: str, session_id: str):
    _configure(api_key)
    return await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id,
                                   expand=["shipping_cost.shipping_rate"])


def construct_webhook_event(payload: bytes, signature: str, webhook_secret: str):
    """Verifies and parses an incoming Stripe webhook. Raises stripe.error.SignatureVerificationError
    (or ValueError on malformed payload) on failure - callers should catch and return 400."""
    return stripe.Webhook.construct_event(payload, signature, webhook_secret)
