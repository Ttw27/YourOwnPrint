"""Direct Stripe Checkout integration.

Replaces the old `emergentintegrations.payments.stripe.checkout` wrapper, which:
  1. is not safely installable outside the Emergent sandbox (the public PyPI
     package of the same name has been flagged as malicious — it is NOT the
     same thing Emergent's own environment resolves it to), and
  2. added an extra layer of indirection for no benefit — Stripe Checkout
     Sessions are simple enough to call directly.

This module is a thin async wrapper around the official `stripe` SDK. The
returned Stripe `Session` object exposes `.id`, `.url`, `.status`,
`.payment_status`, `.amount_total` (in pence), and `.currency` — the same
fields the old wrapper exposed (it was itself just a passthrough), so callers
only need to rename `session.session_id` -> `session.id`.
"""
from __future__ import annotations

import asyncio
from typing import Dict, Optional

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
):
    """Creates a single-line-item Checkout Session for `amount` (major units, e.g. GBP)."""
    _configure(api_key)
    return await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="payment",
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {"name": product_name},
                    "unit_amount": int(round(amount * 100)),
                },
                "quantity": 1,
            }
        ],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata or {},
    )


async def get_checkout_status(api_key: str, session_id: str):
    _configure(api_key)
    return await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)


def construct_webhook_event(payload: bytes, signature: str, webhook_secret: str):
    """Verifies and parses an incoming Stripe webhook. Raises stripe.error.SignatureVerificationError
    (or ValueError on malformed payload) on failure — callers should catch and return 400."""
    return stripe.Webhook.construct_event(payload, signature, webhook_secret)
