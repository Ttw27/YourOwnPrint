"""Resend transactional email helpers.

Non-blocking send: all callers `await _send_email(...)` and use the returned
`{ok, id?, error?}` dict. We never raise from here — a failed notification
must never block a form submission.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Dict, List, Optional

import resend

from deps import _get_integration_value


async def send_email(*, to: List[str], subject: str, html: str,
                     reply_to: Optional[str] = None) -> Dict:
    """Send a transactional email via Resend. Returns {ok, id?, error?}."""
    api_key = await _get_integration_value("resend_api_key")
    if not api_key:
        return {"ok": False, "error": "Resend API key not configured (paste it in /admin/integrations)"}
    resend.api_key = api_key
    sender = os.environ.get("SENDER_EMAIL") or "Your Own Print <onboarding@resend.dev>"
    params = {"from": sender, "to": to, "subject": subject, "html": html}
    if reply_to:
        params["reply_to"] = reply_to
    try:
        res = await asyncio.to_thread(resend.Emails.send, params)
        return {"ok": True, "id": (res or {}).get("id")}
    except Exception as e:
        logging.warning(f"Resend email failed: {e}")
        return {"ok": False, "error": str(e)}


async def shop_notification_recipient() -> Optional[str]:
    """The `contact_email` set in /admin/integrations — where quote enquiries land."""
    return (await _get_integration_value("contact_email")) or None


def email_wrap(title: str, body_html: str) -> str:
    """Inline-CSS email wrapper — works across Gmail/Outlook."""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#1a1a1a">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:2px solid #dcfce7;overflow:hidden">
          <tr><td style="background:#7bc67e;padding:16px 24px;font-weight:900;font-size:18px;color:#1a1a1a">Your Own Print</td></tr>
          <tr><td style="padding:24px">
            <h2 style="margin:0 0 12px 0;font-size:22px;font-weight:900">{title}</h2>
            {body_html}
          </td></tr>
          <tr><td style="background:#f0fdf4;padding:12px 24px;font-size:11px;color:#4b5563">yourownprint.co.uk — no minimums, free artwork proofs, UK printed</td></tr>
        </table>
      </td></tr>
    </table>
    """
