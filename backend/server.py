from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Tuple
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

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


require_admin = get_current_admin

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

    # ----- Front-print-only kit variants (cheaper — no names/numbers, just badge + front sponsor) -----
    "football-kit-front-only": {
        "id": "football-kit-front-only",
        "name": "Football Kit — Front Print Only",
        "price": 18.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg",
        "description": "Jersey + shorts per player. Club badge + 1 front sponsor only. No names/numbers — saves you £6/kit.",
    },
    "football-premium-front-only": {
        "id": "football-premium-front-only",
        "name": "Football Premium — Front Print Only",
        "price": 22.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg",
        "description": "Jersey + shorts + socks. Badge + 1 front sponsor. No names/numbers — cheaper match-day setup.",
    },
    "rugby-kit-front-only": {
        "id": "rugby-kit-front-only",
        "name": "Rugby Kit — Front Print Only",
        "price": 25.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/342361/pexels-photo-342361.jpeg",
        "description": "Heavy-grade rugby shirt + shorts. Crest + front sponsor only — names/numbers excluded.",
    },
    "training-pack-front-only": {
        "id": "training-pack-front-only",
        "name": "Training Pack — Front Print Only",
        "price": 12.99,
        "category": "team-kits",
        "image": "https://images.pexels.com/photos/4720234/pexels-photo-4720234.jpeg",
        "description": "Tee + shorts per player. Club crest + front sponsor only. Cheapest training option.",
    },

    # ----- Sports — additional standalone garments (use Team Kit configurator) -----
    "basketball-vest": {
        "id": "basketball-vest", "name": "Basketball Vest", "price": 19.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/1080884/pexels-photo-1080884.jpeg",
        "description": "Reversible-cut basketball vest with mesh side panels. Names, numbers, sponsor.",
    },
    "cricket-polo": {
        "id": "cricket-polo", "name": "Cricket Polo", "price": 21.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/3641377/pexels-photo-3641377.jpeg",
        "description": "Coloured-cricket polo with tape-print friendly fabric. Club crest + sponsors.",
    },
    "hockey-shirt": {
        "id": "hockey-shirt", "name": "Hockey Shirt", "price": 22.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/8412264/pexels-photo-8412264.jpeg",
        "description": "Field-hockey-cut shirt with reinforced shoulders. Names, numbers, badge.",
    },
    "athletics-vest": {
        "id": "athletics-vest", "name": "Athletics Vest", "price": 14.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/2304793/pexels-photo-2304793.jpeg",
        "description": "Lightweight athletics vest. Club name + sponsor on the front.",
    },
    "cycling-jersey": {
        "id": "cycling-jersey", "name": "Cycling Jersey", "price": 32.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/415992/pexels-photo-415992.jpeg",
        "description": "Sublimation-style cycling jersey, full-body print friendly. Club + sponsors.",
    },

    # ----- Leavers' hoodies & varsity jackets -----
    "leavers-pullover-hoodie": {
        "id": "leavers-pullover-hoodie", "name": "Leavers' Pullover Hoodie", "price": 24.99, "category": "leavers",
        "image": "https://images.pexels.com/photos/8839894/pexels-photo-8839894.jpeg",
        "description": "Classic 320 GSM pullover. Names list, nicknames, year, school crest — printed UK in 7-10 days.",
    },
    "leavers-zip-hoodie": {
        "id": "leavers-zip-hoodie", "name": "Leavers' Zip Hoodie", "price": 29.99, "category": "leavers",
        "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg",
        "description": "Full-zip hoodie with brushed-back fleece. Bigger back-print area for class lists.",
    },
    "varsity-jacket": {
        "id": "varsity-jacket", "name": "Varsity Jacket", "price": 39.99, "category": "leavers",
        "image": "https://images.pexels.com/photos/16429777/pexels-photo-16429777.jpeg",
        "description": "American varsity-style jacket. Letter on chest, year on back, names on sleeves.",
    },
    "leavers-sweatshirt": {
        "id": "leavers-sweatshirt", "name": "Leavers' Crew Sweatshirt", "price": 22.99, "category": "leavers",
        "image": "https://images.pexels.com/photos/8839894/pexels-photo-8839894.jpeg",
        "description": "Crew-neck sweatshirt — lighter than the hoodie, same print options.",
    },
    "leavers-drawstring-bag": {
        "id": "leavers-drawstring-bag", "name": "Printed Drawstring Bag", "price": 3.99, "category": "leavers",
        "image": "https://images.pexels.com/photos/6764015/pexels-photo-6764015.jpeg",
        "description": "Westford Mill-style carry-all. Same design as your hoodie — add as an addon per person.",
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
    "football-kit-front-only":     {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "football-premium-front-only": {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "rugby-kit-front-only":        {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "training-pack-front-only":    {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "basketball-vest":             {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES,              "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "cricket-polo":                {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES,              "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "hockey-shirt":                {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "athletics-vest":              {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES + KIDS_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "cycling-jersey":              {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES,              "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "leavers-pullover-hoodie":     {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES,              "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "leavers-zip-hoodie":          {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES,              "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "varsity-jacket":              {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES,              "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "leavers-sweatshirt":          {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES,              "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "leavers-drawstring-bag":      {"colors": COLOURS_GARMENT, "sizes": ["One Size"],              "size_upcharges": {}},
}
for _pid, _meta in _VARIANT_MAP.items():
    if _pid in PRODUCTS:
        PRODUCTS[_pid].update(_meta)


# ---------- Designer (Design Your Own) configuration ----------
# Products enabled in the designer + their canvas image + print-area bounds (percent).
DEFAULT_PRINT_AREA = {"x": 22, "y": 20, "w": 56, "h": 55}
_DESIGNER_DEFAULTS: Dict[str, Dict] = {
    "personalised-tee":     {"designer_enabled": True, "designer_image": PRODUCTS["personalised-tee"]["image"],     "designer_print_area": DEFAULT_PRINT_AREA},
    "personalised-hoodie":  {"designer_enabled": True, "designer_image": PRODUCTS["personalised-hoodie"]["image"],  "designer_print_area": DEFAULT_PRINT_AREA},
    "kids-tee":             {"designer_enabled": True, "designer_image": PRODUCTS["kids-tee"]["image"],             "designer_print_area": DEFAULT_PRINT_AREA},
    "polo-shirt":           {"designer_enabled": True, "designer_image": PRODUCTS["polo-shirt"]["image"],           "designer_print_area": {"x": 28, "y": 26, "w": 44, "h": 40}},
    "workwear-tshirt":      {"designer_enabled": True, "designer_image": PRODUCTS["workwear-tshirt"]["image"],      "designer_print_area": DEFAULT_PRINT_AREA},
    "workwear-sweatshirt":  {"designer_enabled": True, "designer_image": PRODUCTS["workwear-sweatshirt"]["image"],  "designer_print_area": DEFAULT_PRINT_AREA},
    "school-hoodie":        {"designer_enabled": True, "designer_image": PRODUCTS["school-hoodie"]["image"],        "designer_print_area": DEFAULT_PRINT_AREA},
    "sports-tee":           {"designer_enabled": True, "designer_image": PRODUCTS["sports-tee"]["image"],           "designer_print_area": DEFAULT_PRINT_AREA},
}
for _pid, _meta in _DESIGNER_DEFAULTS.items():
    if _pid in PRODUCTS:
        PRODUCTS[_pid].update(_meta)


# Designer product info (composition / long description / use-case badges).
# Surfaced in the Designer product picker to help brand-builders pick the right blank.
_DESIGNER_INFO: Dict[str, Dict] = {
    "personalised-tee":     {"composition": "180 GSM · 100% ring-spun cotton",            "description_long": "Mid-weight everyday tee. Soft hand, durable wash, slight stretch in the collar. Our most versatile blank.",                  "use_cases": ["branded-to-sell", "daily-use"]},
    "personalised-hoodie":  {"composition": "320 GSM · 80% cotton / 20% polyester brushed-back fleece", "description_long": "Heavyweight pullover hoodie with kangaroo pocket and double-lined hood. Premium feel — sits well on the high street.", "use_cases": ["branded-to-sell", "daily-use"]},
    "kids-tee":             {"composition": "165 GSM · 100% combed cotton",                "description_long": "Lightweight kids' tee, sized 3–14yrs. Soft against young skin and wash-resistant down to 40°C.",                                "use_cases": ["kids", "daily-use"]},
    "polo-shirt":           {"composition": "210 GSM · 65% polyester / 35% cotton piqué",  "description_long": "Easy-iron piqué polo with reinforced taped neckline. Pro look, ideal for client-facing teams.",                                "use_cases": ["workwear", "branded-to-sell"]},
    "workwear-tshirt":      {"composition": "200 GSM · 100% ring-spun cotton heavy",       "description_long": "Workwear-grade tee with reinforced shoulders and tear-away neck label. Industrial-wash safe up to 60°C.",                       "use_cases": ["workwear", "daily-use"]},
    "workwear-sweatshirt":  {"composition": "280 GSM · 50/50 cotton-poly fleece",          "description_long": "Crew-neck workwear sweatshirt. Ribbed cuffs/hem, no pilling, holds shape across heavy use.",                                  "use_cases": ["workwear"]},
    "school-hoodie":        {"composition": "300 GSM · 80% cotton / 20% polyester",        "description_long": "Robust school-grade hoodie. Soft inner brushed fleece, durable seams, named-print friendly.",                                "use_cases": ["kids", "daily-use"]},
    "sports-tee":           {"composition": "150 GSM · 100% recycled polyester wicking",   "description_long": "Lightweight performance tee with moisture-wicking finish and four-way stretch. Eco-credentials on the swing tag.",            "use_cases": ["sports", "eco"]},
}
for _pid, _meta in _DESIGNER_INFO.items():
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

# Team-kit addon pricing (per player, applied to category=team-kits products only).
# Front sponsor is FREE & included. Sleeves & back print are paid extras.
TEAM_KIT_ADDONS: Dict[str, Dict] = {
    "left-sleeve":  {"label": "Left sleeve logo",  "price": 3.00},
    "right-sleeve": {"label": "Right sleeve logo", "price": 3.00},
    "back-print":   {"label": "Back print",        "price": 3.50},
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


@api_router.get("/team-kits/addons")
async def list_team_kit_addons():
    return [{"id": k, **v} for k, v in TEAM_KIT_ADDONS.items()]


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


@api_router.post("/team-kit-brands", dependencies=[Depends(require_admin)])
async def create_brand(payload: TeamKitBrand):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Unknown product_id")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.team_kit_brands.insert_one(doc)
    return {k: doc.get(k) for k in ["id", "product_id", "brand", "name", "price", "image", "description", "active"]}


@api_router.put("/team-kit-brands/{brand_id}", dependencies=[Depends(require_admin)])
async def update_brand(brand_id: str, payload: TeamKitBrand):
    update = {k: v for k, v in payload.model_dump().items() if k != "id"}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.team_kit_brands.update_one({"id": brand_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Brand not found")
    return {"ok": True}


@api_router.delete("/team-kit-brands/{brand_id}", dependencies=[Depends(require_admin)])
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
    elif product.get("category") == "team-kits":
        # Team-kit addons (sleeves + back print). Front sponsor is free & not a placement.
        placements_clean = [p for p in (payload.placements or []) if p in TEAM_KIT_ADDONS]
        print_cost = round(sum(TEAM_KIT_ADDONS[p]["price"] for p in placements_clean), 2)
    elif product.get("category") == "leavers":
        # Leavers flow — only optional addon is drawstring-bag (+£3.99/garment)
        wanted = set(payload.placements or [])
        placements_clean = ["drawstring-bag"] if "drawstring-bag" in wanted else []
        print_cost = LEAVERS_BAG_PRICE if "drawstring-bag" in wanted else 0.0
    elif (payload.design_meta or {}).get("flow") == "designer":
        # Designer flow: back-print = 60% of unit price rounded to nearest £.99 (£0.99 floor).
        #                neck-label = flat NECK_LABEL_PRICE per garment.
        wanted = set(payload.placements or [])
        placements_clean = []
        extra = 0.0
        if "back-print" in wanted:
            placements_clean.append("back-print")
            extra += designer_back_print_price(base_price)
        if "neck-label" in wanted:
            placements_clean.append("neck-label")
            extra += NECK_LABEL_PRICE
        print_cost = round(extra, 2)
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

    # Bulk-tier pricing (override base_price for matching flows)
    if payload.product_id == "boxing-fight-tee":
        base_price = tier_unit_price(FIGHT_NIGHT_BULK_TIERS, base_price, total_qty)
    elif product.get("category") == "leavers" and payload.product_id != "leavers-drawstring-bag":
        base_price = tier_unit_price(LEAVERS_BULK_TIERS_DEFAULT, base_price, total_qty)
    elif product.get("bulk_pricing_enabled"):
        # Generic % tier pricing — use per-product overrides if present, else global defaults
        ovr = product.get("bulk_pricing_overrides")
        if ovr:
            tiers_pct = sorted(
                [(int(t["min_qty"]), float(t["pct"])) for t in ovr if "min_qty" in t and "pct" in t],
                key=lambda x: -x[0],
            )
        else:
            doc = await db.settings.find_one({"key": SETTINGS_KEY_BULK_DEFAULTS})
            tiers_pct = doc["tiers"] if doc and "tiers" in doc else DEFAULT_BULK_TIERS_PCT
            tiers_pct = sorted([(int(t[0]), float(t[1])) for t in tiers_pct], key=lambda x: -x[0])
        base_price = apply_bulk_tier_pct(base_price, total_qty, tiers_pct)

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


@api_router.post("/reviews/import-judgeme", dependencies=[Depends(require_admin)])
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


# ---------- Designer (Design Your Own) endpoints ----------
class DesignerSettings(BaseModel):
    designer_enabled: bool = True
    designer_image: str
    designer_print_area: Dict[str, float]  # {x,y,w,h} percent
    composition: Optional[str] = None
    description_long: Optional[str] = None
    use_cases: Optional[List[str]] = None


ALLOWED_PLACEMENT_OPTIONS = ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve", "neck-label"]


class ProductMeta(BaseModel):
    brand: Optional[str] = None
    sku: Optional[str] = None
    description_full: Optional[str] = None
    size_guide_image: Optional[str] = None
    size_guide_table: Optional[List[Dict]] = None
    bulk_pricing_enabled: bool = False
    bulk_pricing_overrides: Optional[List[Dict]] = None
    allowed_placements: Optional[List[str]] = None


class DesignerArtwork(BaseModel):
    product_id: str
    artwork_png: str           # data URL / base64 (front, transparent, print-quality)
    preview_png: Optional[str] = None  # smaller preview (front)
    back_png: Optional[str] = None             # data URL / base64 (back, transparent, print-quality)
    back_preview_png: Optional[str] = None     # smaller preview (back)
    neck_label_pngs: Optional[Dict[str, str]] = None         # {"M": data-url, "L": data-url, ...}
    neck_label_preview_pngs: Optional[Dict[str, str]] = None  # smaller previews per size
    items_count: int = 0
    back_items_count: int = 0
    neck_label_items_count: int = 0
    width: Optional[int] = None
    height: Optional[int] = None
    session_id: Optional[str] = None


def designer_back_print_price(unit_price: float) -> float:
    """60% of unit price, snapped to nearest £.99 (with a £0.99 floor)."""
    return max(0.99, round(unit_price * 0.6) - 0.01)


NECK_LABEL_PRICE = 1.50  # Flat per-garment DTF neck-label upcharge

USE_CASE_OPTIONS = ["workwear", "branded-to-sell", "daily-use", "sports", "kids", "eco"]

# ----- Per-flow bulk pricing tiers (ascending threshold, descending unit price) -----
# Applied when product_id matches and total qty meets the threshold.
FIGHT_NIGHT_BULK_TIERS = [(25, 9.99), (10, 10.99)]   # tee base £11.99 → £10.99 @ 10+, £9.99 @ 25+
LEAVERS_BULK_TIERS_DEFAULT = [(100, 15.99), (60, 16.99), (30, 17.99), (20, 19.99)]

LEAVERS_BAG_PRICE = 3.99  # printed drawstring carry-all addon, per garment

# Generic per-product bulk-discount tiers (% off base price, snapped to nearest £.99)
DEFAULT_BULK_TIERS_PCT: List[Tuple[int, float]] = [(200, 35.0), (100, 28.0), (25, 18.0), (10, 10.0)]
SETTINGS_KEY_BULK_DEFAULTS = "bulk_tiers_pct_default"


def snap_to_99(price: float) -> float:
    """Snap to the nearest £x.99 with a £0.99 floor (e.g. 5.42 → 4.99, 5.51 → 5.99)."""
    return max(0.99, round(price) - 0.01)


def apply_bulk_tier_pct(base_price: float, total_qty: int, tiers_pct: List[Tuple[int, float]]) -> float:
    """Return discounted unit price using the highest matching % tier; tiers must be desc by qty."""
    for threshold, pct in tiers_pct:
        if total_qty >= threshold:
            return snap_to_99(base_price * (1.0 - pct / 100.0))
    return base_price


def tier_unit_price(tiers: List[Tuple[int, float]], default_price: float, total_qty: int) -> float:
    """Return the highest-discount tier matching total_qty, else default."""
    for threshold, price in tiers:  # tiers must be sorted desc by threshold
        if total_qty >= threshold:
            return price
    return default_price


async def _merge_designer_overrides():
    """Read /designer_settings collection and overlay onto in-memory PRODUCTS."""
    async for doc in db.designer_settings.find({}):
        pid = doc.get("product_id")
        if pid in PRODUCTS:
            for k in ("designer_enabled", "designer_image", "designer_print_area",
                     "composition", "description_long", "use_cases"):
                if k in doc and doc[k] is not None:
                    PRODUCTS[pid][k] = doc[k]
    # Product meta overlay (brand/SKU/size guide/bulk pricing)
    async for doc in db.product_meta.find({}):
        pid = doc.get("product_id")
        if pid in PRODUCTS:
            for k in ("brand", "sku", "description_full", "size_guide_image", "size_guide_table",
                     "bulk_pricing_enabled", "bulk_pricing_overrides", "allowed_placements"):
                if k in doc and doc[k] is not None:
                    PRODUCTS[pid][k] = doc[k]


@app.on_event("startup")
async def _designer_startup():
    try:
        await _merge_designer_overrides()
    except Exception as e:
        logger.error(f"designer overlay failed: {e}")


@api_router.get("/designer/products")
async def list_designer_products():
    """Products available in the Design Your Own canvas."""
    out = []
    for p in PRODUCTS.values():
        if p.get("designer_enabled"):
            out.append({
                "id": p["id"],
                "name": p["name"],
                "price": p["price"],
                "image": p.get("designer_image") or p["image"],
                "print_area": p.get("designer_print_area") or DEFAULT_PRINT_AREA,
                "sizes": p.get("sizes", []),
                "size_upcharges": p.get("size_upcharges", {}),
                "back_print_price": designer_back_print_price(float(p["price"])),
                "neck_label_price": NECK_LABEL_PRICE,
                "composition": p.get("composition"),
                "description_long": p.get("description_long"),
                "use_cases": p.get("use_cases") or [],
            })
    return out


@api_router.get("/designer/use-cases")
async def list_use_cases():
    return USE_CASE_OPTIONS


@api_router.get("/admin/designer-products", dependencies=[Depends(require_admin)])
async def admin_list_designer_products():
    """Admin view — ALL products with their current designer settings."""
    out = []
    for p in PRODUCTS.values():
        out.append({
            "id": p["id"],
            "name": p["name"],
            "category": p["category"],
            "main_image": p["image"],
            "designer_enabled": bool(p.get("designer_enabled")),
            "designer_image": p.get("designer_image") or p["image"],
            "designer_print_area": p.get("designer_print_area") or DEFAULT_PRINT_AREA,
            "composition": p.get("composition") or "",
            "description_long": p.get("description_long") or "",
            "use_cases": p.get("use_cases") or [],
        })
    return out


@api_router.patch("/admin/designer-products/{product_id}", dependencies=[Depends(require_admin)])
async def update_designer_settings(product_id: str, payload: DesignerSettings):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Product not found")
    pa = payload.designer_print_area
    for k in ("x", "y", "w", "h"):
        if k not in pa:
            raise HTTPException(400, f"print_area missing '{k}'")
        if not (0 <= float(pa[k]) <= 100):
            raise HTTPException(400, f"print_area '{k}' must be 0-100")
    use_cases = payload.use_cases or []
    for uc in use_cases:
        if uc not in USE_CASE_OPTIONS:
            raise HTTPException(400, f"unknown use_case '{uc}'. Allowed: {USE_CASE_OPTIONS}")
    doc = {
        "product_id": product_id,
        "designer_enabled": payload.designer_enabled,
        "designer_image": payload.designer_image,
        "designer_print_area": pa,
        "composition": (payload.composition or None),
        "description_long": (payload.description_long or None),
        "use_cases": use_cases,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.designer_settings.update_one({"product_id": product_id}, {"$set": doc}, upsert=True)
    # Apply to in-memory PRODUCTS so it's immediately reflected.
    PRODUCTS[product_id]["designer_enabled"] = payload.designer_enabled
    PRODUCTS[product_id]["designer_image"] = payload.designer_image
    PRODUCTS[product_id]["designer_print_area"] = pa
    if payload.composition is not None:
        PRODUCTS[product_id]["composition"] = payload.composition or None
    if payload.description_long is not None:
        PRODUCTS[product_id]["description_long"] = payload.description_long or None
    PRODUCTS[product_id]["use_cases"] = use_cases
    return {"ok": True}


@api_router.post("/designer/artwork")
async def save_designer_artwork(payload: DesignerArtwork):
    """Save a composed transparent PNG (and optional preview) for an order."""
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Unknown product_id")
    if not payload.artwork_png or len(payload.artwork_png) > 6_000_000:
        raise HTTPException(400, "artwork_png missing or too large")
    if payload.back_png and len(payload.back_png) > 6_000_000:
        raise HTTPException(400, "back_png too large")
    # Neck-label PNGs are smaller — cap each at 2MB to keep the doc reasonable
    for pngs in ((payload.neck_label_pngs or {}), (payload.neck_label_preview_pngs or {})):
        for sz, data in pngs.items():
            if data and len(data) > 2_000_000:
                raise HTTPException(400, f"neck_label_pngs['{sz}'] too large")
    doc = {
        "id": str(uuid.uuid4()),
        "product_id": payload.product_id,
        "artwork_png": payload.artwork_png,
        "preview_png": payload.preview_png,
        "back_png": payload.back_png,
        "back_preview_png": payload.back_preview_png,
        "neck_label_pngs": payload.neck_label_pngs,
        "neck_label_preview_pngs": payload.neck_label_preview_pngs,
        "items_count": payload.items_count,
        "back_items_count": payload.back_items_count,
        "neck_label_items_count": payload.neck_label_items_count,
        "width": payload.width,
        "height": payload.height,
        "session_id": payload.session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.designer_artwork.insert_one(doc)
    return {"id": doc["id"]}


@api_router.get("/designer/artwork/{artwork_id}")
async def get_designer_artwork(artwork_id: str):
    """Retrieve a saved artwork — used by fulfilment/admin."""
    doc = await db.designer_artwork.find_one({"id": artwork_id})
    if not doc:
        raise HTTPException(404, "Artwork not found")
    return {k: doc.get(k) for k in (
        "id", "product_id", "artwork_png", "preview_png",
        "back_png", "back_preview_png",
        "neck_label_pngs", "neck_label_preview_pngs",
        "items_count", "back_items_count", "neck_label_items_count",
        "width", "height", "session_id", "created_at",
    )}


# ---------- Bulk tiers (public) ----------
@api_router.get("/bulk-tiers/fight-night")
async def get_fight_night_tiers():
    return {
        "base_price": float(PRODUCTS["boxing-fight-tee"]["price"]),
        "tiers": [{"min_qty": t, "unit_price": p} for t, p in FIGHT_NIGHT_BULK_TIERS],
    }


# ---------- Generic bulk pricing ----------
async def _get_bulk_defaults() -> List[Tuple[int, float]]:
    doc = await db.settings.find_one({"key": SETTINGS_KEY_BULK_DEFAULTS})
    if doc and "tiers" in doc:
        return sorted([(int(t[0]), float(t[1])) for t in doc["tiers"]], key=lambda x: -x[0])
    return DEFAULT_BULK_TIERS_PCT


@api_router.get("/bulk-tiers/defaults")
async def get_bulk_defaults():
    tiers = await _get_bulk_defaults()
    return {"tiers": [{"min_qty": q, "pct": p} for q, p in tiers]}


@api_router.patch("/admin/bulk-tiers/defaults", dependencies=[Depends(require_admin)])
async def update_bulk_defaults(payload: Dict):
    tiers = payload.get("tiers")
    if not isinstance(tiers, list) or not tiers:
        raise HTTPException(400, "tiers must be a non-empty list")
    cleaned = []
    for t in tiers:
        try:
            q = int(t["min_qty"])
            p = float(t["pct"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(400, "each tier needs min_qty (int) + pct (number)")
        if q < 1 or not (0 <= p <= 90):
            raise HTTPException(400, "min_qty >=1; pct 0-90")
        cleaned.append([q, p])
    await db.settings.update_one(
        {"key": SETTINGS_KEY_BULK_DEFAULTS},
        {"$set": {"key": SETTINGS_KEY_BULK_DEFAULTS, "tiers": cleaned, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/bulk-tiers/product/{product_id}")
async def get_product_bulk_tiers(product_id: str):
    """Resolved bulk-pricing preview for a product — used by the PDP ladder."""
    p = PRODUCTS.get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    base_price = float(p["price"])
    # Fight Night & Leavers use absolute tiers (not % based)
    if product_id == "boxing-fight-tee":
        return {"mode": "absolute", "base_price": base_price,
                "tiers": [{"min_qty": q, "unit_price": up, "savings_per_unit": round(base_price - up, 2)} for q, up in FIGHT_NIGHT_BULK_TIERS]}
    if p.get("category") == "leavers" and product_id != "leavers-drawstring-bag":
        return {"mode": "absolute", "base_price": base_price,
                "tiers": [{"min_qty": q, "unit_price": up, "savings_per_unit": round(base_price - up, 2)} for q, up in LEAVERS_BULK_TIERS_DEFAULT]}
    if not p.get("bulk_pricing_enabled"):
        return {"mode": "none", "base_price": base_price, "tiers": []}
    ovr = p.get("bulk_pricing_overrides")
    if ovr:
        tiers_pct = sorted([(int(t["min_qty"]), float(t["pct"])) for t in ovr if "min_qty" in t and "pct" in t], key=lambda x: -x[0])
    else:
        tiers_pct = await _get_bulk_defaults()
    return {
        "mode": "percent", "base_price": base_price,
        "tiers": [
            {"min_qty": q, "pct": pct, "unit_price": snap_to_99(base_price * (1 - pct / 100)),
             "savings_per_unit": round(base_price - snap_to_99(base_price * (1 - pct / 100)), 2)}
            for q, pct in tiers_pct
        ],
    }


# ---------- Product meta (brand, SKU, size guide, bulk pricing flag) ----------
@api_router.get("/admin/products", dependencies=[Depends(require_admin)])
async def admin_list_all_products():
    """Admin overview of all products with editable meta fields."""
    out = []
    for p in PRODUCTS.values():
        out.append({
            "id": p["id"], "name": p["name"], "price": float(p["price"]),
            "category": p["category"], "image": p["image"],
            "brand": p.get("brand") or "",
            "sku": p.get("sku") or "",
            "description_full": p.get("description_full") or "",
            "size_guide_image": p.get("size_guide_image") or "",
            "size_guide_table": p.get("size_guide_table") or [],
            "bulk_pricing_enabled": bool(p.get("bulk_pricing_enabled")),
            "bulk_pricing_overrides": p.get("bulk_pricing_overrides") or [],
            "allowed_placements": p.get("allowed_placements") or list(ALLOWED_PLACEMENT_OPTIONS),
        })
    return out


@api_router.get("/products/{product_id}/allowed-placements")
async def get_allowed_placements(product_id: str):
    """Public endpoint — used by PDP and Designer to hide disallowed placements."""
    p = PRODUCTS.get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return {"allowed_placements": p.get("allowed_placements") or list(ALLOWED_PLACEMENT_OPTIONS)}


@api_router.patch("/admin/products/{product_id}/meta", dependencies=[Depends(require_admin)])
async def update_product_meta(product_id: str, payload: ProductMeta):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Product not found")
    if payload.bulk_pricing_overrides:
        for t in payload.bulk_pricing_overrides:
            if "min_qty" not in t or "pct" not in t:
                raise HTTPException(400, "each override needs min_qty + pct")
            try:
                q = int(t["min_qty"])
                p = float(t["pct"])
            except (TypeError, ValueError):
                raise HTTPException(400, "min_qty must be int, pct must be number")
            if q < 1 or not (0 <= p <= 90):
                raise HTTPException(400, "override min_qty >=1; pct 0-90")
    if payload.allowed_placements is not None:
        for pl in payload.allowed_placements:
            if pl not in ALLOWED_PLACEMENT_OPTIONS:
                raise HTTPException(400, f"unknown placement '{pl}'. Allowed: {ALLOWED_PLACEMENT_OPTIONS}")
    doc = {
        "product_id": product_id,
        "brand": payload.brand,
        "sku": payload.sku,
        "description_full": payload.description_full,
        "size_guide_image": payload.size_guide_image,
        "size_guide_table": payload.size_guide_table,
        "bulk_pricing_enabled": bool(payload.bulk_pricing_enabled),
        "bulk_pricing_overrides": payload.bulk_pricing_overrides,
        "allowed_placements": payload.allowed_placements,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.product_meta.update_one({"product_id": product_id}, {"$set": doc}, upsert=True)
    for k in ("brand", "sku", "description_full", "size_guide_image", "size_guide_table",
              "bulk_pricing_enabled", "bulk_pricing_overrides", "allowed_placements"):
        v = doc.get(k)
        if v is not None or k == "bulk_pricing_enabled":
            PRODUCTS[product_id][k] = v
    return {"ok": True}


@api_router.get("/bulk-tiers/leavers")
async def get_leavers_tiers():
    return {
        "tiers": [{"min_qty": t, "unit_price": p} for t, p in LEAVERS_BULK_TIERS_DEFAULT],
        "bag_price": LEAVERS_BAG_PRICE,
    }


@api_router.get("/leavers/products")
async def list_leavers_products():
    out = []
    for p in PRODUCTS.values():
        if p.get("category") == "leavers":
            out.append({k: p.get(k) for k in ("id", "name", "price", "image", "description", "sizes")})
    return out


# ---------- Group orders (leavers' hoodies shared link) ----------
class GroupOrderCreate(BaseModel):
    school: str
    year_group: str
    deadline: str           # ISO date string
    contact_name: str
    contact_email: str
    contact_phone: Optional[str] = None
    product_id: str
    design_brief: Optional[str] = None
    include_bag: bool = False


class GroupOrderJoin(BaseModel):
    name: str
    nickname: Optional[str] = None
    size: str
    qty: int = 1
    note: Optional[str] = None


def _group_order_public(doc: dict) -> dict:
    """Strip internal fields before returning to public callers."""
    return {
        "token": doc["token"],
        "school": doc["school"],
        "year_group": doc["year_group"],
        "deadline": doc["deadline"],
        "product_id": doc["product_id"],
        "design_brief": doc.get("design_brief"),
        "include_bag": bool(doc.get("include_bag")),
        "status": doc.get("status", "open"),
        "roster_count": len(doc.get("roster", [])),
        "created_at": doc.get("created_at"),
    }


@api_router.post("/group-orders")
async def create_group_order(payload: GroupOrderCreate):
    if payload.product_id not in PRODUCTS or PRODUCTS[payload.product_id].get("category") != "leavers":
        raise HTTPException(400, "Unknown leavers product")
    token = uuid.uuid4().hex[:10]
    manage_token = uuid.uuid4().hex
    doc = {
        "id": str(uuid.uuid4()),
        "token": token,
        "manage_token": manage_token,
        "school": payload.school.strip(),
        "year_group": payload.year_group.strip(),
        "deadline": payload.deadline,
        "contact_name": payload.contact_name.strip(),
        "contact_email": payload.contact_email.strip(),
        "contact_phone": (payload.contact_phone or "").strip() or None,
        "product_id": payload.product_id,
        "design_brief": payload.design_brief,
        "include_bag": bool(payload.include_bag),
        "roster": [],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.group_orders.insert_one(doc)
    return {"token": token, "manage_token": manage_token}


@api_router.get("/group-orders/{token}")
async def get_group_order_public(token: str):
    doc = await db.group_orders.find_one({"token": token})
    if not doc:
        raise HTTPException(404, "Group order not found")
    return _group_order_public(doc)


@api_router.post("/group-orders/{token}/join")
async def join_group_order(token: str, payload: GroupOrderJoin):
    doc = await db.group_orders.find_one({"token": token})
    if not doc:
        raise HTTPException(404, "Group order not found")
    if doc.get("status") != "open":
        raise HTTPException(400, "This group order is closed")
    if not payload.name.strip():
        raise HTTPException(400, "Name is required")
    qty = max(1, min(10, int(payload.qty or 1)))
    member = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip()[:60],
        "nickname": (payload.nickname or "").strip()[:30] or None,
        "size": payload.size.strip(),
        "qty": qty,
        "note": (payload.note or "").strip()[:120] or None,
        "joined_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.group_orders.update_one({"token": token}, {"$push": {"roster": member}})
    return {"ok": True, "member_id": member["id"]}


@api_router.get("/group-orders/{token}/manage/{manage_token}")
async def manage_group_order(token: str, manage_token: str):
    doc = await db.group_orders.find_one({"token": token})
    if not doc or doc.get("manage_token") != manage_token:
        raise HTTPException(404, "Group order not found")
    return {
        **_group_order_public(doc),
        "manage_token": manage_token,
        "contact_name": doc.get("contact_name"),
        "contact_email": doc.get("contact_email"),
        "contact_phone": doc.get("contact_phone"),
        "roster": doc.get("roster", []),
    }


@api_router.delete("/group-orders/{token}/manage/{manage_token}/members/{member_id}")
async def remove_group_member(token: str, manage_token: str, member_id: str):
    doc = await db.group_orders.find_one({"token": token})
    if not doc or doc.get("manage_token") != manage_token:
        raise HTTPException(404, "Group order not found")
    await db.group_orders.update_one({"token": token}, {"$pull": {"roster": {"id": member_id}}})
    return {"ok": True}


@api_router.post("/group-orders/{token}/manage/{manage_token}/close")
async def close_group_order(token: str, manage_token: str):
    doc = await db.group_orders.find_one({"token": token})
    if not doc or doc.get("manage_token") != manage_token:
        raise HTTPException(404, "Group order not found")
    await db.group_orders.update_one({"token": token}, {"$set": {"status": "closed", "closed_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


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


# ---------- Admin Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@api_router.post("/auth/login")
async def admin_login(payload: LoginRequest, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not an admin account")
    token = _create_access_token(email)
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=False,
        samesite="lax", max_age=7 * 24 * 3600, path="/",
    )
    return {"token": token, "user": {"email": email, "role": "admin", "name": user.get("name", "Admin")}}


@api_router.post("/auth/logout")
async def admin_logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def admin_me(current=Depends(require_admin)):
    return current


# ---------- Customer Q&A ----------
class QACreate(BaseModel):
    product_id: str
    question: str
    asker_name: Optional[str] = "Customer"


class QAAnswer(BaseModel):
    answer: str


@api_router.get("/qa/{product_id}")
async def list_qa(product_id: str):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Product not found")
    out = []
    async for d in db.product_qa.find({"product_id": product_id}).sort("asked_at", -1):
        out.append({
            "id": d.get("id"),
            "product_id": d.get("product_id"),
            "question": d.get("question"),
            "answer": d.get("answer"),
            "asker_name": d.get("asker_name") or "Customer",
            "asked_at": d.get("asked_at"),
            "answered_at": d.get("answered_at"),
        })
    return out


@api_router.post("/qa")
async def create_qa(payload: QACreate):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Unknown product_id")
    question = (payload.question or "").strip()
    if len(question) < 5:
        raise HTTPException(400, "Question is too short")
    if len(question) > 500:
        raise HTTPException(400, "Question is too long (max 500 chars)")
    doc = {
        "id": str(uuid.uuid4()),
        "product_id": payload.product_id,
        "question": question,
        "answer": None,
        "asker_name": (payload.asker_name or "Customer").strip()[:60] or "Customer",
        "asked_at": datetime.now(timezone.utc).isoformat(),
        "answered_at": None,
    }
    await db.product_qa.insert_one(doc)
    return {k: doc[k] for k in ("id", "product_id", "question", "answer", "asker_name", "asked_at", "answered_at")}


@api_router.post("/admin/qa/{qa_id}/answer", dependencies=[Depends(require_admin)])
async def answer_qa(qa_id: str, payload: QAAnswer):
    answer = (payload.answer or "").strip()
    if len(answer) < 1:
        raise HTTPException(400, "Answer cannot be empty")
    res = await db.product_qa.update_one(
        {"id": qa_id},
        {"$set": {"answer": answer[:1000], "answered_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Q&A not found")
    return {"ok": True}


@api_router.delete("/admin/qa/{qa_id}", dependencies=[Depends(require_admin)])
async def delete_qa(qa_id: str):
    res = await db.product_qa.delete_one({"id": qa_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Q&A not found")
    return {"ok": True}


@api_router.get("/admin/qa", dependencies=[Depends(require_admin)])
async def admin_list_all_qa():
    """Admin overview — all questions across products, unanswered first."""
    out = []
    async for d in db.product_qa.find({}).sort("asked_at", -1):
        out.append({
            "id": d.get("id"),
            "product_id": d.get("product_id"),
            "product_name": PRODUCTS.get(d.get("product_id"), {}).get("name", d.get("product_id")),
            "question": d.get("question"),
            "answer": d.get("answer"),
            "asker_name": d.get("asker_name") or "Customer",
            "asked_at": d.get("asked_at"),
            "answered_at": d.get("answered_at"),
        })
    out.sort(key=lambda x: (x["answer"] is not None, x["asked_at"] or ""), reverse=True)
    # unanswered first, then most-recent answered
    out.sort(key=lambda x: (x["answer"] is None, x["asked_at"] or ""), reverse=True)
    return out


@app.on_event("startup")
async def _seed_admin_user():
    try:
        existing = await db.users.find_one({"email": ADMIN_EMAIL})
        if existing is None:
            await db.users.insert_one({
                "email": ADMIN_EMAIL,
                "password_hash": _hash_password(ADMIN_PASSWORD),
                "name": "Admin",
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        elif not _verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"password_hash": _hash_password(ADMIN_PASSWORD)}},
            )
        await db.users.create_index("email", unique=True)
    except Exception as e:
        # logger is configured further down — print as fallback
        print(f"admin seed failed: {e}")


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
