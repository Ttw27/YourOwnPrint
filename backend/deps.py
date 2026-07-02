"""Shared runtime state for the FastAPI backend.

`server.py` remains the boot file and the single source of truth for product
catalogue seed data + startup handlers. Router modules under `backend/routers/`
import `api_router`, `db`, `client`, `require_admin`, and helper functions from
here — this breaks the circular-import problem that would otherwise force us to
keep every endpoint in `server.py`.

The core objects (db handle, api_router, PRODUCTS dict) are created here so
they're safe to import from anywhere and mutable state (like PRODUCTS after
startup seeding) stays in-sync across modules because Python module globals
are singletons.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Mongo
# ---------------------------------------------------------------------------
_mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(_mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------------------------------------------------------------------------
# Auth config
# ---------------------------------------------------------------------------
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _create_access_token(email: str) -> str:
    payload = {
        "sub": email,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> Dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access" or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload.get("sub")})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Admin not found")
    return {"email": user["email"], "role": user["role"], "name": user.get("name", "Admin")}


# Shorthand — most `Depends(...)` calls use this alias.
require_admin = get_current_admin


# ---------------------------------------------------------------------------
# The one and only APIRouter that all endpoints hang off. Router modules import
# this and decorate their handlers with `@api_router.get(...)` etc.
# ---------------------------------------------------------------------------
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Integration key lookup — read from settings collection first (admin-editable
# at /admin/integrations), fall back to environment variables.
# ---------------------------------------------------------------------------
INTEGRATION_ENV_MAP: Dict[str, str] = {
    "stripe_api_key": "STRIPE_API_KEY",
    "resend_api_key": "RESEND_API_KEY",
    "removebg_api_key": "REMOVEBG_API_KEY",
    "cutoutpro_api_key": "CUTOUTPRO_API_KEY",
    "judgeme_shop_domain": "JUDGEME_SHOP_DOMAIN",
    "judgeme_api_token": "JUDGEME_API_TOKEN",
    "whatsapp_number": "WHATSAPP_NUMBER",
    "contact_email": "CONTACT_EMAIL",
}


async def _get_integration_value(key: str) -> Optional[str]:
    doc = await db.settings.find_one({"key": "integration_keys"})
    values = (doc or {}).get("values") or {}
    v = values.get(key)
    if v and str(v).strip():
        return str(v).strip()
    env_var = INTEGRATION_ENV_MAP.get(key)
    if env_var:
        env_v = os.environ.get(env_var, "")
        return env_v.strip() or None
    return None
