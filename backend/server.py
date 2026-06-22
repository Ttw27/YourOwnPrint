from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
    CheckoutSessionRequest,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Server-side product catalogue (prices NEVER taken from frontend) ----------
PRODUCTS: Dict[str, Dict] = {
    "personalised-tee": {
        "id": "personalised-tee",
        "name": "Personalised T-Shirt",
        "price": 6.99,
        "category": "best-sellers",
        "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg",
        "description": "Gildan SoftStyle 100% cotton. Upload your photo, logo or text.",
    },
    "personalised-hoodie": {
        "id": "personalised-hoodie",
        "name": "Personalised Hoodie",
        "price": 14.99,
        "category": "best-sellers",
        "image": "https://images.pexels.com/photos/8217544/pexels-photo-8217544.jpeg",
        "description": "Gildan Heavy Blend Hooded Sweatshirt. Free logo print included.",
    },
    "kids-tee": {
        "id": "kids-tee",
        "name": "Kids T-Shirt",
        "price": 7.99,
        "category": "best-sellers",
        "image": "https://images.pexels.com/photos/31977041/pexels-photo-31977041.jpeg",
        "description": "Soft Gildan Youth tee. Perfect for schools, leavers & teams.",
    },
    "polo-shirt": {
        "id": "polo-shirt",
        "name": "Pique Polo Shirt",
        "price": 8.99,
        "category": "best-sellers",
        "image": "https://images.pexels.com/photos/26063373/pexels-photo-26063373.jpeg",
        "description": "Pro RTX Pique Polo. Breast print included in price.",
    },
    "workwear-jacket": {
        "id": "workwear-jacket",
        "name": "Workwear Softshell Jacket",
        "price": 24.99,
        "category": "workwear",
        "image": "https://images.pexels.com/photos/8821005/pexels-photo-8821005.jpeg",
        "description": "Durable softshell with chest logo print, UK stock.",
    },
    "hi-vis-vest": {
        "id": "hi-vis-vest",
        "name": "Hi-Vis Vest",
        "price": 9.99,
        "category": "workwear",
        "image": "https://images.pexels.com/photos/34859873/pexels-photo-34859873.jpeg",
        "description": "EN ISO 20471 compliant. Custom print or embroidery.",
    },
    "workwear-tshirt": {
        "id": "workwear-tshirt",
        "name": "Heavy Cotton Workwear Tee",
        "price": 7.49,
        "category": "workwear",
        "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg",
        "description": "Built for the trades. Breast logo print included.",
    },
    "workwear-sweatshirt": {
        "id": "workwear-sweatshirt",
        "name": "Crewneck Sweatshirt",
        "price": 12.99,
        "category": "workwear",
        "image": "https://images.pexels.com/photos/8217544/pexels-photo-8217544.jpeg",
        "description": "Warm crewneck for site days. Add your brand for free.",
    },
    "school-hoodie": {
        "id": "school-hoodie",
        "name": "Leavers Hoodie",
        "price": 16.99,
        "category": "teams-schools",
        "image": "https://images.pexels.com/photos/8926904/pexels-photo-8926904.jpeg",
        "description": "Class-of-XXXX leavers hoodie. Names on the back included.",
    },
    "team-polo": {
        "id": "team-polo",
        "name": "Team Pique Polo",
        "price": 9.99,
        "category": "teams-schools",
        "image": "https://images.pexels.com/photos/26063373/pexels-photo-26063373.jpeg",
        "description": "Match-day polo with crest and initials.",
    },
    "dance-tee": {
        "id": "dance-tee",
        "name": "Dance & Theatre Tee",
        "price": 7.99,
        "category": "teams-schools",
        "image": "https://images.pexels.com/photos/4250534/pexels-photo-4250534.jpeg",
        "description": "Soft drape tee for dance schools & theatre groups.",
    },
    "sports-tee": {
        "id": "sports-tee",
        "name": "Cool Sports Tee",
        "price": 8.49,
        "category": "teams-schools",
        "image": "https://images.pexels.com/photos/12097160/pexels-photo-12097160.jpeg",
        "description": "Performance fabric tee, club crest included.",
    },
}


# ---------- Models ----------
class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""
    message: str
    quantity: Optional[str] = ""
    sector: Optional[str] = ""


class ContactRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str = ""
    company: str = ""
    message: str
    quantity: str = ""
    sector: str = ""
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ThemeSelectionRequest(BaseModel):
    theme_id: str
    note: Optional[str] = ""


class CheckoutRequest(BaseModel):
    product_id: str
    quantity: int = 1
    size: Optional[str] = "M"
    origin_url: str
    design_meta: Optional[Dict[str, str]] = None  # text/filter notes only — no prices


class CheckoutResponse(BaseModel):
    url: str
    session_id: str


class CheckoutStatusOut(BaseModel):
    session_id: str
    status: str
    payment_status: str
    amount_total: float
    currency: str


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Your Own Print API"}


@api_router.get("/products")
async def list_products(category: Optional[str] = None):
    if category:
        return [p for p in PRODUCTS.values() if p["category"] == category]
    return list(PRODUCTS.values())


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Product not found")
    return PRODUCTS[product_id]


@api_router.post("/contact")
async def submit_contact(payload: ContactRequest):
    record = ContactRecord(**payload.model_dump())
    await db.contact_submissions.insert_one(record.model_dump())
    return {"ok": True, "id": record.id}


@api_router.post("/theme-selection")
async def select_theme(payload: ThemeSelectionRequest):
    doc = {
        "id": str(uuid.uuid4()),
        "theme_id": payload.theme_id,
        "note": payload.note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.theme_selections.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


# ---------- Stripe Checkout ----------
@api_router.post("/checkout/session", response_model=CheckoutResponse)
async def create_checkout(payload: CheckoutRequest, http_request: Request):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Invalid product")
    if payload.quantity < 1 or payload.quantity > 500:
        raise HTTPException(400, "Quantity must be 1-500")

    product = PRODUCTS[payload.product_id]
    unit_price = float(product["price"])
    total_amount = round(unit_price * payload.quantity, 2)

    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/design"

    metadata = {
        "product_id": payload.product_id,
        "product_name": product["name"],
        "size": payload.size or "M",
        "quantity": str(payload.quantity),
    }
    if payload.design_meta:
        for k, v in payload.design_meta.items():
            metadata[f"design_{k}"] = str(v)[:400]

    checkout_request = CheckoutSessionRequest(
        amount=total_amount,
        currency="gbp",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(
        checkout_request
    )

    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "product_id": payload.product_id,
            "product_name": product["name"],
            "quantity": payload.quantity,
            "size": payload.size or "M",
            "amount": total_amount,
            "currency": "gbp",
            "metadata": metadata,
            "payment_status": "pending",
            "status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return CheckoutResponse(url=session.url, session_id=session.session_id)


@api_router.get("/checkout/status/{session_id}", response_model=CheckoutStatusOut)
async def checkout_status(session_id: str, http_request: Request):
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    status_resp: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(
        session_id
    )

    existing = await db.payment_transactions.find_one({"session_id": session_id})
    if existing and existing.get("payment_status") != status_resp.payment_status:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "payment_status": status_resp.payment_status,
                    "status": status_resp.status,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

    return CheckoutStatusOut(
        session_id=session_id,
        status=status_resp.status,
        payment_status=status_resp.payment_status,
        amount_total=float(status_resp.amount_total) / 100.0,
        currency=status_resp.currency,
    )


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {
                    "$set": {
                        "payment_status": webhook_response.payment_status,
                        "status": "completed",
                        "webhook_event": webhook_response.event_type,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
        return {"received": True}
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
