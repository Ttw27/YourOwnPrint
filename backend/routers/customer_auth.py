"""Customer auth + account data — separate from admin auth.

Kept in one router file for simplicity: register, login, logout, me,
forgot-password, reset-password, plus customer-scoped cart persistence,
saved addresses, saved designs, and order history.

Design decisions:
- Customers live in the `customers` collection (admins live in `users`).
- Uses the SAME JWT secret + algorithm as admin auth but tokens carry
  `role="customer"`, so `require_admin` can't accept a customer token and
  `require_customer` can't accept an admin token.
- Access token = 7 days (matches admin pattern for MVP simplicity — refresh
  token flow can be added later without breaking clients).
- Brute-force: 5 failed attempts locks the account for 15min.
- Password reset: `secrets.token_urlsafe(32)` with 1-hour TTL, dispatched via Resend.
"""
from __future__ import annotations

import json
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from deps import api_router, db, JWT_SECRET, JWT_ALGORITHM
from services.email import email_wrap, send_email, shop_notification_recipient
from services.r2_storage import storage_put_async as _r2_put, get_public_url as _r2_public_url


def _parse_thumbnail_data_url(data_url: str, max_bytes: int = 2_000_000):
    """Minimal data-URL parser for design thumbnails (own copy — importing
    server.py's version here would create a circular import)."""
    import base64
    if not data_url or not data_url.startswith("data:"):
        return None, None
    try:
        header, b64 = data_url.split(",", 1)
        content_type = header.split(";")[0].replace("data:", "") or "image/png"
        raw = base64.b64decode(b64)
        if len(raw) > max_bytes:
            return None, None
        ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(content_type, "png")
        return raw, (content_type, ext)
    except Exception:
        return None, None


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
_CUSTOMER_TOKEN_DAYS = 7
_RESET_TOKEN_HOURS = 1
_LOCKOUT_MINUTES = 15
_MAX_ATTEMPTS = 5
_MIN_PASSWORD_LEN = 8
_PASSWORD_HAS_LETTER = re.compile(r"[A-Za-z]")
_PASSWORD_HAS_NUMBER = re.compile(r"[0-9]")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class CustomerRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)  # strength checked in handler → clean 400 error
    name: str = Field(min_length=1, max_length=120)


class CustomerLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class CustomerOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "customer"
    created_at: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=200)     # length checked in handler → clean 400 error
    new_password: str = Field(min_length=1, max_length=200)


class CartLineItemModel(BaseModel):
    line_id: Optional[str] = None
    product_id: str
    size_qtys: Dict[str, int]
    color: Optional[str] = None
    placements: Optional[List[str]] = None
    blank: bool = False
    design_meta: Optional[Dict] = None


class CartSyncRequest(BaseModel):
    items: List[CartLineItemModel]


class AddressIn(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    line1: str = Field(min_length=1, max_length=200)
    line2: Optional[str] = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    postcode: str = Field(min_length=1, max_length=20)
    country: str = Field(default="United Kingdom", max_length=100)
    phone: Optional[str] = Field(default=None, max_length=40)
    is_default: bool = False


class SavedDesignIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    product_id: str
    thumbnail_data_url: Optional[str] = Field(default=None, max_length=500_000)
    canvas_json: Dict


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_pw(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _validate_password_strength(pw: str) -> None:
    if len(pw) < _MIN_PASSWORD_LEN:
        raise HTTPException(400, f"Password must be at least {_MIN_PASSWORD_LEN} characters")
    if not _PASSWORD_HAS_LETTER.search(pw):
        raise HTTPException(400, "Password must contain at least one letter")
    if not _PASSWORD_HAS_NUMBER.search(pw):
        raise HTTPException(400, "Password must contain at least one number")


def _create_customer_token(customer_id: str, email: str) -> str:
    payload = {
        "sub": customer_id,
        "email": email,
        "role": "customer",
        "exp": datetime.now(timezone.utc) + timedelta(days=_CUSTOMER_TOKEN_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _serialise_customer(doc: Dict) -> Dict:
    return {
        "id": doc["id"],
        "email": doc["email"],
        "name": doc.get("name", ""),
        "role": "customer",
        "created_at": doc.get("created_at", ""),
    }


async def get_current_customer(request: Request) -> Dict:
    # Prefer Bearer header over cookie — API clients using explicit tokens shouldn't
    # be shadowed by a stale cookie from a previous session on the same origin.
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("customer_access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("role") != "customer" or payload.get("type") != "access":
        raise HTTPException(401, "Not a customer token")
    doc = await db.customers.find_one({"id": payload["sub"]})
    if not doc:
        raise HTTPException(401, "Customer not found")
    return _serialise_customer(doc)


require_customer = get_current_customer


async def _check_lockout(email: str) -> None:
    doc = await db.customer_login_attempts.find_one({"email": email})
    if not doc:
        return
    if doc.get("locked_until"):
        try:
            lock_ts = datetime.fromisoformat(doc["locked_until"])
        except Exception:
            return
        if lock_ts > datetime.now(timezone.utc):
            remaining = int((lock_ts - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            raise HTTPException(423, f"Too many failed attempts. Try again in {remaining} minutes.")


async def _record_login_attempt(email: str, success: bool) -> None:
    if success:
        await db.customer_login_attempts.delete_one({"email": email})
        return
    now = datetime.now(timezone.utc)
    doc = await db.customer_login_attempts.find_one({"email": email}) or {"email": email, "count": 0}
    count = int(doc.get("count", 0)) + 1
    update = {"email": email, "count": count, "last_attempt": now.isoformat()}
    if count >= _MAX_ATTEMPTS:
        update["locked_until"] = (now + timedelta(minutes=_LOCKOUT_MINUTES)).isoformat()
    await db.customer_login_attempts.update_one({"email": email}, {"$set": update}, upsert=True)


def _set_customer_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="customer_access_token",
        value=token,
        httponly=True,
        secure=False,          # kubernetes ingress terminates TLS — cookie flows over http internally
        samesite="lax",
        max_age=_CUSTOMER_TOKEN_DAYS * 86400,
        path="/",
    )


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api_router.post("/customer/register")
async def customer_register(payload: CustomerRegister, response: Response):
    email = payload.email.lower().strip()
    _validate_password_strength(payload.password)
    if await db.customers.find_one({"email": email}):
        raise HTTPException(409, "An account with that email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name.strip(),
        "password_hash": _hash_pw(payload.password),
        "role": "customer",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.customers.insert_one(doc)
    token = _create_customer_token(doc["id"], doc["email"])
    _set_customer_cookie(response, token)
    return {**_serialise_customer(doc), "token": token}  # token also returned for Bearer clients


@api_router.post("/customer/login")
async def customer_login(payload: CustomerLogin, response: Response):
    email = payload.email.lower().strip()
    await _check_lockout(email)
    doc = await db.customers.find_one({"email": email})
    if not doc or not _verify_pw(payload.password, doc.get("password_hash", "")):
        await _record_login_attempt(email, success=False)
        raise HTTPException(401, "Invalid email or password")
    await _record_login_attempt(email, success=True)
    token = _create_customer_token(doc["id"], doc["email"])
    _set_customer_cookie(response, token)
    return {**_serialise_customer(doc), "token": token}


@api_router.post("/customer/logout")
async def customer_logout(response: Response):
    response.delete_cookie("customer_access_token", path="/")
    return {"ok": True}


@api_router.get("/customer/me", response_model=CustomerOut)
async def customer_me(customer: Dict = Depends(require_customer)):
    return customer


# ---------------------------------------------------------------------------
# Password reset — Resend-backed
# ---------------------------------------------------------------------------
@api_router.post("/customer/forgot-password")
async def customer_forgot_password(payload: ForgotPasswordRequest, request: Request):
    """Always returns 200 (never leaks whether an email exists). Actually sends
    the reset email only if the account is real AND the Resend key is set."""
    email = payload.email.lower().strip()
    doc = await db.customers.find_one({"email": email})
    if doc:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=_RESET_TOKEN_HOURS)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "customer_id": doc["id"],
            "email": email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat(),
            "used": False,
        })
        origin = request.headers.get("origin") or request.headers.get("referer", "").rsplit("/", 1)[0]
        origin = (origin or "").rstrip("/")
        if not origin:
            # Fallback for server-to-server calls without an Origin header.
            import os
            origin = (os.environ.get("YOP_APP_ORIGIN") or "https://yourownprint.co.uk").rstrip("/")
        reset_link = f"{origin}/reset-password?token={token}"
        body = email_wrap(
            "Reset your password",
            f"""
            <p>Hi {doc.get('name', 'there')},</p>
            <p>Click the button below to reset your Your Own Print password. This link is valid for {_RESET_TOKEN_HOURS} hour.</p>
            <p style="text-align:center;margin:24px 0">
              <a href="{reset_link}" style="display:inline-block;background:#7bc67e;color:#1a1a1a;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:900">Reset password</a>
            </p>
            <p style="color:#4b5563;font-size:12px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
            <p style="color:#4b5563;font-size:11px;word-break:break-all">Or paste this link into your browser: {reset_link}</p>
            """,
        )
        reply_to = await shop_notification_recipient()
        await send_email(to=[email], subject="Reset your Your Own Print password", html=body, reply_to=reply_to)
    return {"ok": True}


@api_router.post("/customer/reset-password")
async def customer_reset_password(payload: ResetPasswordRequest, response: Response):
    if len(payload.token) < 8:
        raise HTTPException(400, "Reset link is invalid or already used")
    _validate_password_strength(payload.new_password)
    tok = await db.password_reset_tokens.find_one({"token": payload.token})
    if not tok or tok.get("used"):
        raise HTTPException(400, "Reset link is invalid or already used")
    try:
        expires = datetime.fromisoformat(tok["expires_at"])
    except Exception:
        raise HTTPException(400, "Reset link is invalid")
    if expires < datetime.now(timezone.utc):
        raise HTTPException(400, "Reset link has expired — request a new one")
    await db.customers.update_one({"id": tok["customer_id"]},
                                  {"$set": {"password_hash": _hash_pw(payload.new_password)}})
    await db.password_reset_tokens.update_one({"token": payload.token},
                                              {"$set": {"used": True,
                                                        "used_at": datetime.now(timezone.utc).isoformat()}})
    # Log the customer in
    doc = await db.customers.find_one({"id": tok["customer_id"]})
    if doc:
        token = _create_customer_token(doc["id"], doc["email"])
        _set_customer_cookie(response, token)
        return {**_serialise_customer(doc), "token": token}
    return {"ok": True}


# ---------------------------------------------------------------------------
# Cart persistence
# ---------------------------------------------------------------------------
def _line_id(line: Dict) -> str:
    """Stable identity for a cart line — same product+colour+placements+design → same id.
    Uses canonical JSON for design_meta so dict ordering doesn't affect the hash."""
    placements = ",".join(sorted(line.get("placements") or []))
    dm = json.dumps(line.get("design_meta") or {}, sort_keys=True)
    return f"{line['product_id']}::{line.get('color') or ''}::{placements}::{dm}"


@api_router.get("/customer/cart")
async def customer_get_cart(customer: Dict = Depends(require_customer)):
    doc = await db.customer_carts.find_one({"customer_id": customer["id"]})
    return {"items": (doc or {}).get("items", [])}


@api_router.put("/customer/cart")
async def customer_put_cart(payload: CartSyncRequest, customer: Dict = Depends(require_customer)):
    items = [item.model_dump() for item in payload.items]
    # Ensure line_id present
    for it in items:
        if not it.get("line_id"):
            it["line_id"] = _line_id(it)
    await db.customer_carts.update_one(
        {"customer_id": customer["id"]},
        {"$set": {"customer_id": customer["id"], "items": items,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "count": len(items)}


@api_router.post("/customer/cart/merge")
async def customer_cart_merge(payload: CartSyncRequest, customer: Dict = Depends(require_customer)):
    """Merge a guest cart into the customer's server-side cart. Matching lines
    (same line_id) have their size_qtys SUMMED; new lines are appended."""
    guest_items = [item.model_dump() for item in payload.items]
    doc = await db.customer_carts.find_one({"customer_id": customer["id"]})
    server_items = (doc or {}).get("items", [])

    # Index server items by stable line_id
    server_map: Dict[str, Dict] = {}
    for it in server_items:
        if not it.get("line_id"):
            it["line_id"] = _line_id(it)
        server_map[it["line_id"]] = it

    for guest in guest_items:
        lid = guest.get("line_id") or _line_id(guest)
        guest["line_id"] = lid
        if lid in server_map:
            existing = server_map[lid]
            merged_qtys = {**(existing.get("size_qtys") or {})}
            for sz, q in (guest.get("size_qtys") or {}).items():
                merged_qtys[sz] = merged_qtys.get(sz, 0) + int(q)
            existing["size_qtys"] = merged_qtys
        else:
            server_map[lid] = guest

    merged_items = list(server_map.values())
    await db.customer_carts.update_one(
        {"customer_id": customer["id"]},
        {"$set": {"customer_id": customer["id"], "items": merged_items,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "items": merged_items}


# ---------------------------------------------------------------------------
# Order history — reads payment_transactions where the checkout session had
# customer_email matching the logged-in user. Stripe automatically captures
# customer_email on the Checkout Session.
# ---------------------------------------------------------------------------
@api_router.get("/customer/orders")
async def customer_orders(customer: Dict = Depends(require_customer)):
    cursor = db.payment_transactions.find({
        "$or": [{"customer_email": customer["email"]}, {"metadata.customer_email": customer["email"]}]
    }).sort("created_at", -1).limit(50)
    orders = []
    async for doc in cursor:
        orders.append({
            "session_id": doc.get("session_id"),
            "kind": doc.get("kind", "product"),
            "product_name": doc.get("product_name"),
            "items": doc.get("items"),
            "amount": doc.get("amount"),
            "currency": doc.get("currency", "gbp"),
            "payment_status": doc.get("payment_status"),
            "status": doc.get("status"),
            "created_at": doc.get("created_at"),
        })
    return {"orders": orders}


# ---------------------------------------------------------------------------
# Address book
# ---------------------------------------------------------------------------
@api_router.get("/customer/addresses")
async def customer_list_addresses(customer: Dict = Depends(require_customer)):
    cursor = db.customer_addresses.find({"customer_id": customer["id"]})
    addresses = []
    async for doc in cursor:
        addresses.append({k: doc.get(k) for k in ("id", "label", "line1", "line2", "city",
                                                    "postcode", "country", "phone", "is_default")})
    return {"addresses": addresses}


@api_router.post("/customer/addresses")
async def customer_add_address(payload: AddressIn, customer: Dict = Depends(require_customer)):
    addr_id = str(uuid.uuid4())
    if payload.is_default:
        await db.customer_addresses.update_many({"customer_id": customer["id"]},
                                                {"$set": {"is_default": False}})
    doc = {"id": addr_id, "customer_id": customer["id"], **payload.model_dump()}
    await db.customer_addresses.insert_one(doc)
    return {"ok": True, "id": addr_id}


@api_router.delete("/customer/addresses/{addr_id}")
async def customer_delete_address(addr_id: str, customer: Dict = Depends(require_customer)):
    r = await db.customer_addresses.delete_one({"id": addr_id, "customer_id": customer["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Address not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Saved designs (DYO favourites)
# ---------------------------------------------------------------------------
@api_router.get("/customer/designs")
async def customer_list_designs(customer: Dict = Depends(require_customer)):
    cursor = db.customer_designs.find({"customer_id": customer["id"]}).sort("created_at", -1)
    designs = []
    async for doc in cursor:
        designs.append({
            "id": doc.get("id"),
            "name": doc.get("name"),
            "product_id": doc.get("product_id"),
            "thumbnail_data_url": doc.get("thumbnail_data_url"),
            "canvas_json": doc.get("canvas_json"),
            "created_at": doc.get("created_at"),
        })
    return {"designs": designs}


@api_router.post("/customer/designs")
async def customer_save_design(payload: SavedDesignIn, customer: Dict = Depends(require_customer)):
    design_id = str(uuid.uuid4())
    doc = payload.model_dump()

    thumb = doc.get("thumbnail_data_url")
    if thumb and thumb.startswith("data:"):
        raw, meta = _parse_thumbnail_data_url(thumb)
        if raw:
            content_type, ext = meta
            path = f"design-thumbnails/{design_id}.{ext}"
            try:
                await _r2_put(path, raw, content_type)
                r2_url = _r2_public_url(path)
                if r2_url:
                    doc["thumbnail_data_url"] = r2_url  # same field name — frontend renders it identically either way
            except Exception:
                pass  # fall back to the original data URL rather than lose the thumbnail entirely

    await db.customer_designs.insert_one({
        "id": design_id,
        "customer_id": customer["id"],
        **doc,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "id": design_id}


@api_router.delete("/customer/designs/{design_id}")
async def customer_delete_design(design_id: str, customer: Dict = Depends(require_customer)):
    r = await db.customer_designs.delete_one({"id": design_id, "customer_id": customer["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Design not found")
    return {"ok": True}
