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

    # ----- Sports & Combat -----
    "football-jersey": {
        "id": "football-jersey",
        "name": "Football Match Jersey",
        "price": 18.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg",
        "description": "Performance match jersey. Club crest, sponsor, names & numbers — match-day ready.",
    },
    "football-shorts": {
        "id": "football-shorts",
        "name": "Football Shorts",
        "price": 8.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/3651597/pexels-photo-3651597.jpeg",
        "description": "Lightweight match shorts to pair with the jersey. Number & sponsor print available.",
    },
    "rugby-shirt": {
        "id": "rugby-shirt",
        "name": "Rugby Match Shirt",
        "price": 24.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/342361/pexels-photo-342361.jpeg",
        "description": "Heavy-grade rugby shirt. Reinforced collar. Crest, sponsor, names + numbers.",
    },
    "training-tracksuit": {
        "id": "training-tracksuit",
        "name": "Training Tracksuit",
        "price": 39.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/8260101/pexels-photo-8260101.jpeg",
        "description": "Full tracksuit (jacket + bottoms). Branded for training & travel days.",
    },
    "training-tee": {
        "id": "training-tee",
        "name": "Training Tee",
        "price": 9.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/4720234/pexels-photo-4720234.jpeg",
        "description": "Breathable training tee — squad name, initials, club crest.",
    },
    "boxing-fight-tee": {
        "id": "boxing-fight-tee",
        "name": "Boxing Fight Night Sponsor Tee",
        "price": 11.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/9311461/pexels-photo-9311461.jpeg",
        "description": "Walk-out tee for fight night — main sponsor + multiple supporting logos. Free proof included.",
    },
    "muay-thai-shorts": {
        "id": "muay-thai-shorts",
        "name": "Muay Thai / Kickboxing Shorts",
        "price": 22.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/4761779/pexels-photo-4761779.jpeg",
        "description": "Traditional cut Muay Thai shorts. Custom names, club logo, sponsor — vibrant satin print.",
    },
    "fight-shorts": {
        "id": "fight-shorts",
        "name": "MMA / BJJ Fight Shorts",
        "price": 19.99,
        "category": "sports",
        "image": "https://images.pexels.com/photos/4761787/pexels-photo-4761787.jpeg",
        "description": "Stretch panel fight shorts. Sublimated print — names, sponsors, gym branding.",
    },

    # ----- Team Kit Bundles (price-per-player, includes club badge + names & numbers) -----
    "football-kit-bundle": {
        "id": "football-kit-bundle",
        "name": "Football Kit Bundle",
        "price": 24.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg",
        "description": "Jersey + shorts per player. Includes club badge & names/numbers. Just upload your badge.",
    },
    "football-premium-bundle": {
        "id": "football-premium-bundle",
        "name": "Football Premium Bundle",
        "price": 29.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg",
        "description": "Jersey + shorts + socks per player. Match-day ready. Badge + names/numbers included.",
    },
    "rugby-kit-bundle": {
        "id": "rugby-kit-bundle",
        "name": "Rugby Kit Bundle",
        "price": 32.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/342361/pexels-photo-342361.jpeg",
        "description": "Heavy-grade rugby shirt + shorts per player. Crest + names included.",
    },
    "training-pack-bundle": {
        "id": "training-pack-bundle",
        "name": "Training Pack",
        "price": 17.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/4720234/pexels-photo-4720234.jpeg",
        "description": "Breathable training tee + shorts. Club crest + initials. Perfect for mid-week sessions.",
    },
    "full-squad-pack": {
        "id": "full-squad-pack",
        "name": "Full Squad Pack",
        "price": 54.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/8260101/pexels-photo-8260101.jpeg",
        "description": "Match jersey + shorts + tracksuit per player. The complete squad bundle.",
    },
}


# ---------- Variant defaults applied to every product ----------
DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"]
DEFAULT_SIZE_UPCHARGES = {"3XL": 1.50, "4XL": 3.00}
KIDS_SIZES = ["3-4", "5-6", "7-8", "9-11", "12-13"]

COLOURS_GARMENT = [
    {"name": "White", "hex": "#ffffff"},
    {"name": "Black", "hex": "#0d0d0d"},
    {"name": "Navy", "hex": "#1a2a4a"},
    {"name": "Royal Blue", "hex": "#1d4ed8"},
    {"name": "Red", "hex": "#b91c1c"},
    {"name": "Bottle Green", "hex": "#14532d"},
    {"name": "Grey Marl", "hex": "#9ca3af"},
    {"name": "Yellow", "hex": "#facc15"},
]
COLOURS_HIVIS = [
    {"name": "Hi-Vis Yellow", "hex": "#facc15"},
    {"name": "Hi-Vis Orange", "hex": "#fb923c"},
]
COLOURS_HOODIE = [
    {"name": "Black", "hex": "#0d0d0d"},
    {"name": "Grey Marl", "hex": "#9ca3af"},
    {"name": "Navy", "hex": "#1a2a4a"},
    {"name": "Burgundy", "hex": "#7f1d1d"},
    {"name": "Bottle Green", "hex": "#14532d"},
    {"name": "White", "hex": "#ffffff"},
]

# Apply variants to each product
_VARIANT_MAP = {
    "personalised-tee":    {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "personalised-hoodie": {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "kids-tee":            {"colors": COLOURS_GARMENT, "sizes": KIDS_SIZES, "size_upcharges": {}},
    "polo-shirt":          {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "workwear-jacket":     {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Charcoal", "hex": "#374151"}], "sizes": DEFAULT_SIZES[1:], "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "hi-vis-vest":         {"colors": COLOURS_HIVIS, "sizes": ["S/M", "L/XL", "XXL"], "size_upcharges": {}},
    "workwear-tshirt":     {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "workwear-sweatshirt": {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "school-hoodie":       {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "team-polo":           {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "dance-tee":           {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "sports-tee":          {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    # Sports & combat
    "football-jersey":     {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "football-shorts":     {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "White", "hex": "#ffffff"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Royal", "hex": "#1d4ed8"}, {"name": "Red", "hex": "#b91c1c"}], "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": {}},
    "rugby-shirt":         {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "training-tracksuit":  {"colors": COLOURS_HOODIE, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "training-tee":        {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "boxing-fight-tee":    {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "White", "hex": "#ffffff"}, {"name": "Red", "hex": "#b91c1c"}, {"name": "Royal", "hex": "#1d4ed8"}], "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "muay-thai-shorts":    {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Red", "hex": "#b91c1c"}, {"name": "Royal", "hex": "#1d4ed8"}, {"name": "Gold", "hex": "#d4a017"}], "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "fight-shorts":        {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Red", "hex": "#b91c1c"}], "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    # Team kit bundles — full size range incl. kids
    "football-kit-bundle":    {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "football-premium-bundle":{"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "rugby-kit-bundle":       {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "training-pack-bundle":   {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "full-squad-pack":        {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
}
for _pid, _meta in _VARIANT_MAP.items():
    if _pid in PRODUCTS:
        PRODUCTS[_pid].update(_meta)


# ---------- Print placements ----------
PLACEMENTS: List[Dict] = [
    {"id": "left-breast",  "label": "Left breast",  "price": 2.50, "excludes": ["full-front"]},
    {"id": "right-breast", "label": "Right breast", "price": 2.50, "excludes": ["full-front"]},
    {"id": "full-front",   "label": "Full front",   "price": 3.50, "excludes": ["left-breast", "right-breast"]},
    {"id": "back-print",   "label": "Back print",   "price": 3.50, "excludes": []},
    {"id": "left-sleeve",  "label": "Left sleeve",  "price": 1.50, "excludes": []},
    {"id": "right-sleeve", "label": "Right sleeve", "price": 1.50, "excludes": []},
]
PLACEMENT_BY_ID = {p["id"]: p for p in PLACEMENTS}

# Fight-night tee specific addon prices (overrides PLACEMENT_BY_ID for product_id='boxing-fight-tee')
FIGHT_NIGHT_ADDONS: Dict[str, Dict] = {
    "back-print":   {"label": "Back print",   "price": 3.50},
    "left-sleeve":  {"label": "Left sleeve",  "price": 3.00},
    "right-sleeve": {"label": "Right sleeve", "price": 3.00},
}


def _validate_placements(placements: List[str]) -> List[str]:
    """Return cleaned placements list, raising 400 if exclusivity rules are broken."""
    cleaned = [p for p in (placements or []) if p in PLACEMENT_BY_ID]
    for pid in cleaned:
        for excl in PLACEMENT_BY_ID[pid]["excludes"]:
            if excl in cleaned:
                raise HTTPException(400, f"'{pid}' cannot be combined with '{excl}'")
    return cleaned


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
    quantity: int = 1  # legacy single-size path
    size: Optional[str] = "M"  # legacy
    # New richer fields (preferred):
    size_qtys: Optional[Dict[str, int]] = None  # {"M": 5, "L": 10, ...}
    color: Optional[str] = None
    placements: Optional[List[str]] = None
    blank: bool = False  # "buy blank" — no placements
    origin_url: str
    design_meta: Optional[Dict[str, str]] = None


class CheckoutResponse(BaseModel):
    url: str
    session_id: str


class CheckoutStatusOut(BaseModel):
    session_id: str
    status: str
    payment_status: str
    amount_total: float
    currency: str


# ---------- Reviews ----------
class ReviewCreate(BaseModel):
    product_id: str
    reviewer_name: str
    reviewer_email: Optional[EmailStr] = None
    rating: int  # 1-5
    title: str
    body: str
    photos: Optional[List[str]] = None  # base64 data URLs, max 4
    verified: bool = False  # set by backend, not client


class ReviewOut(BaseModel):
    id: str
    product_id: str
    reviewer_name: str
    rating: int
    title: str
    body: str
    photos: List[str] = []
    verified: bool = False
    source: str = "native"  # 'native' | 'judgeme'
    created_at: str


class JudgeMeImportRequest(BaseModel):
    # Accepts either a list of raw Judge.me review objects, or the shape returned by the widget API.
    reviews: List[Dict] = Field(default_factory=list)
    default_product_id: Optional[str] = None  # fallback if review has no mapping
    product_id_map: Optional[Dict[str, str]] = None  # judgeme product_id/title -> our product_id


class QuoteRequest(BaseModel):
    """Generic quote request — used for team kits 10+, fight-night 'do it for us', bespoke print enquiries."""
    kind: str  # 'team_kit' | 'fight_night' | 'bespoke_print' | 'general'
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    company: Optional[str] = ""  # club / gym / business name
    sport: Optional[str] = ""
    kit_type: Optional[str] = ""  # home/away/training/etc.
    quantity: Optional[int] = 0
    deadline: Optional[str] = ""
    message: str
    # File metadata only — files referenced by data URL or external URL.
    artwork: Optional[List[str]] = None  # base64 data URLs; size-limited each
    roster: Optional[List[Dict]] = None  # [{name, number, size, qty}, ...]
    product_id: Optional[str] = None


def _photo_ok(s: str) -> bool:
    return isinstance(s, str) and s.startswith("data:image/") and len(s) < 1_500_000  # < ~1.5MB


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


@api_router.get("/placements")
async def list_placements():
    return PLACEMENTS


@api_router.get("/fight-night/addons")
async def list_fight_night_addons():
    return [{"id": k, **v} for k, v in FIGHT_NIGHT_ADDONS.items()]


# ---------- Team-kit brands (admin-editable) ----------
class TeamKitBrand(BaseModel):
    id: Optional[str] = None
    product_id: str  # links to one of the team-kits products
    brand: str
    name: str
    price: float
    image: Optional[str] = ""
    description: Optional[str] = ""
    active: bool = True


@api_router.get("/team-kit-brands")
async def list_brands(product_id: Optional[str] = None):
    q = {"active": True}
    if product_id:
        q["product_id"] = product_id
    out = []
    async for d in db.team_kit_brands.find(q).sort("price", 1):
        out.append({k: d.get(k) for k in ["id", "product_id", "brand", "name", "price", "image", "description", "active"]})
    return out


@api_router.post("/team-kit-brands")
async def create_brand(payload: TeamKitBrand):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Unknown product_id")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.team_kit_brands.insert_one(doc)
    return {k: doc.get(k) for k in ["id", "product_id", "brand", "name", "price", "image", "description", "active"]}


@api_router.put("/team-kit-brands/{brand_id}")
async def update_brand(brand_id: str, payload: TeamKitBrand):
    update = {k: v for k, v in payload.model_dump().items() if k != "id"}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.team_kit_brands.update_one({"id": brand_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Brand not found")
    return {"ok": True}


@api_router.delete("/team-kit-brands/{brand_id}")
async def delete_brand(brand_id: str):
    res = await db.team_kit_brands.delete_one({"id": brand_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Brand not found")
    return {"ok": True}


@api_router.post("/quote-request")
async def create_quote_request(payload: QuoteRequest):
    # Limit artwork sizes silently
    artwork = [a for a in (payload.artwork or []) if isinstance(a, str) and len(a) < 1_500_000][:12]
    doc = {
        "id": str(uuid.uuid4()),
        "kind": payload.kind,
        "name": payload.name.strip()[:80],
        "email": payload.email,
        "phone": (payload.phone or "")[:40],
        "company": (payload.company or "")[:120],
        "sport": (payload.sport or "")[:60],
        "kit_type": (payload.kit_type or "")[:60],
        "quantity": int(payload.quantity or 0),
        "deadline": (payload.deadline or "")[:60],
        "message": (payload.message or "")[:5000],
        "artwork": artwork,
        "roster": (payload.roster or [])[:300],
        "product_id": payload.product_id,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quote_requests.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


# ---------- Stripe Checkout ----------
@api_router.post("/checkout/session", response_model=CheckoutResponse)
async def create_checkout(payload: CheckoutRequest, http_request: Request):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Invalid product")

    product = PRODUCTS[payload.product_id]
    base_price = float(product["price"])
    size_upcharges: Dict[str, float] = product.get("size_upcharges", {}) or {}
    allowed_sizes = set(product.get("sizes", []))

    # Resolve placements (blank wins). Special override for fight-night tee.
    if payload.blank:
        placements_clean: List[str] = []
        print_cost = 0.0
    elif payload.product_id == "boxing-fight-tee":
        # Fight night addons use bespoke pricing
        placements_clean = [p for p in (payload.placements or []) if p in FIGHT_NIGHT_ADDONS]
        print_cost = round(sum(FIGHT_NIGHT_ADDONS[p]["price"] for p in placements_clean), 2)
    else:
        placements_clean = _validate_placements(payload.placements or [])
        print_cost = round(sum(PLACEMENT_BY_ID[p]["price"] for p in placements_clean), 2)

    # Resolve size quantities (new path preferred, legacy fallback)
    size_qtys: Dict[str, int] = {}
    if payload.size_qtys:
        for sz, q in payload.size_qtys.items():
            try:
                q_int = int(q)
            except (TypeError, ValueError):
                continue
            if q_int <= 0:
                continue
            if allowed_sizes and sz not in allowed_sizes:
                raise HTTPException(400, f"Size '{sz}' not available for this product")
            size_qtys[sz] = q_int
    else:
        # Legacy: single size + quantity
        sz = payload.size or "M"
        q_int = int(payload.quantity) if payload.quantity is not None else 1
        if q_int < 1:
            raise HTTPException(400, "Quantity must be ≥ 1")
        if allowed_sizes and sz not in allowed_sizes:
            sz = next(iter(allowed_sizes)) if allowed_sizes else sz
        size_qtys[sz] = q_int

    if not size_qtys:
        raise HTTPException(400, "Select at least one size with quantity ≥ 1")

    total_qty = sum(size_qtys.values())
    if total_qty < 1 or total_qty > 5000:
        raise HTTPException(400, "Total quantity must be 1-5000")

    # Compute total server-side
    total_amount = 0.0
    line_breakdown = []
    for sz, q in size_qtys.items():
        unit = base_price + float(size_upcharges.get(sz, 0.0)) + print_cost
        line = round(unit * q, 2)
        total_amount += line
        line_breakdown.append(f"{sz}×{q}@£{unit:.2f}")
    total_amount = round(total_amount, 2)

    if total_amount < 0.5:
        raise HTTPException(400, "Total below Stripe minimum (£0.50)")

    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/product/{payload.product_id}"

    metadata = {
        "product_id": payload.product_id,
        "product_name": product["name"],
        "color": (payload.color or "")[:60],
        "blank": "true" if payload.blank or not placements_clean else "false",
        "placements": ",".join(placements_clean)[:400],
        "sizes": ",".join(line_breakdown)[:400],
        "total_qty": str(total_qty),
        "print_cost_per_garment": f"£{print_cost:.2f}",
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
            "color": payload.color,
            "placements": placements_clean,
            "blank": bool(payload.blank or not placements_clean),
            "size_qtys": size_qtys,
            "total_quantity": total_qty,
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


@api_router.post("/reviews", response_model=ReviewOut)
async def create_review(payload: ReviewCreate):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Unknown product_id")
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(400, "Rating must be 1-5")
    photos = []
    for p in (payload.photos or [])[:4]:
        if _photo_ok(p):
            photos.append(p)
    doc = {
        "id": str(uuid.uuid4()),
        "product_id": payload.product_id,
        "reviewer_name": payload.reviewer_name.strip()[:80] or "Anonymous",
        "reviewer_email": payload.reviewer_email,
        "rating": payload.rating,
        "title": payload.title.strip()[:120],
        "body": payload.body.strip()[:2000],
        "photos": photos,
        "verified": False,
        "source": "native",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(doc)
    return ReviewOut(**{k: doc[k] for k in ReviewOut.model_fields.keys()})


@api_router.get("/reviews/product/{product_id}")
async def list_product_reviews(product_id: str, limit: int = 50):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Unknown product")
    cursor = db.reviews.find({"product_id": product_id}).sort("created_at", -1).limit(limit)
    items = []
    total = 0
    rating_sum = 0
    async for r in cursor:
        items.append({k: r.get(k) for k in ReviewOut.model_fields.keys()})
        total += 1
        rating_sum += int(r.get("rating", 0))
    avg = round(rating_sum / total, 2) if total else 0
    return {"product_id": product_id, "average": avg, "count": total, "reviews": items}


@api_router.get("/reviews/aggregate")
async def reviews_aggregate():
    pipeline = [
        {"$group": {"_id": "$product_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    out = {}
    async for doc in db.reviews.aggregate(pipeline):
        out[doc["_id"]] = {"average": round(doc["avg"], 2), "count": doc["count"]}
    return out


@api_router.get("/reviews/recent")
async def recent_reviews(limit: int = 12):
    cursor = db.reviews.find({}).sort("created_at", -1).limit(limit)
    items = []
    async for r in cursor:
        items.append({k: r.get(k) for k in ReviewOut.model_fields.keys()})
    return items


@api_router.post("/reviews/import-judgeme")
async def import_judgeme(payload: JudgeMeImportRequest):
    """Accepts a paste/upload of Judge.me reviews JSON (one-off migration).
    Maps each review to one of our product IDs via product_id_map (judgeme key -> our id)
    or falls back to default_product_id. Supports the standard Judge.me review object shape
    AND the widget review shape.
    """
    imported = 0
    skipped = 0
    pmap = payload.product_id_map or {}
    for r in payload.reviews:
        # Normalise — Judge.me review object fields
        jm_pid = str(r.get("product_id") or r.get("product_external_id") or r.get("product_handle") or "")
        jm_title_key = str(r.get("product_title") or "")
        mapped = pmap.get(jm_pid) or pmap.get(jm_title_key) or payload.default_product_id
        if not mapped or mapped not in PRODUCTS:
            skipped += 1
            continue
        rating = int(r.get("rating") or 5)
        rating = max(1, min(5, rating))
        body = str(r.get("body") or r.get("review_body") or r.get("content") or "")[:2000]
        title = str(r.get("title") or r.get("review_title") or "Verified review")[:120]
        reviewer = str(r.get("reviewer_name") or r.get("name") or r.get("author") or "Customer")[:80]
        created = str(r.get("created_at") or r.get("date") or datetime.now(timezone.utc).isoformat())
        pictures = r.get("pictures") or r.get("photos") or []
        photos = []
        for p in pictures[:4]:
            if isinstance(p, dict):
                u = p.get("urls", {}).get("original") or p.get("url") or p.get("original")
                if u:
                    photos.append(u)
            elif isinstance(p, str):
                photos.append(p)
        doc = {
            "id": str(uuid.uuid4()),
            "product_id": mapped,
            "reviewer_name": reviewer or "Customer",
            "reviewer_email": None,
            "rating": rating,
            "title": title,
            "body": body,
            "photos": photos,
            "verified": True,
            "source": "judgeme",
            "created_at": created,
            "judgeme_id": r.get("id") or r.get("review_id"),
        }
        await db.reviews.insert_one(doc)
        imported += 1
    return {"imported": imported, "skipped": skipped}


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
