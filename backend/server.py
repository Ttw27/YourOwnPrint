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

    # ----- Aprons -----
    "bib-apron": {
        "id": "bib-apron", "name": "Bib Apron", "price": 9.99, "category": "workwear",
        "image": "https://images.pexels.com/photos/4252136/pexels-photo-4252136.jpeg",
        "description": "Classic bib apron with double front pocket. Hospitality, catering, baristas, baking — printed or embroidered.",
    },
    "waist-apron": {
        "id": "waist-apron", "name": "Waist Apron", "price": 7.49, "category": "workwear",
        "image": "https://images.pexels.com/photos/4252888/pexels-photo-4252888.jpeg",
        "description": "Short waist apron with pockets — perfect for front-of-house, baristas and servers.",
    },
    "denim-apron": {
        "id": "denim-apron", "name": "Denim Workshop Apron", "price": 18.99, "category": "workwear",
        "image": "https://images.pexels.com/photos/8430335/pexels-photo-8430335.jpeg",
        "description": "Heavyweight denim workshop apron with cross-back straps. Barbers, baristas, makers and trade workshops.",
    },

    # ----- Bottoms (joggers / trousers / leggings) -----
    "joggers": {
        "id": "joggers", "name": "Branded Joggers", "price": 19.99, "category": "best-sellers",
        "image": "https://images.pexels.com/photos/5384423/pexels-photo-5384423.jpeg",
        "description": "Tapered fleece-back joggers — your logo on the thigh or hip. Gyms, leavers, fitness coaches.",
    },
    "workwear-trousers": {
        "id": "workwear-trousers", "name": "Workwear Cargo Trousers", "price": 27.99, "category": "workwear",
        "image": "https://images.pexels.com/photos/7681056/pexels-photo-7681056.jpeg",
        "description": "Knee-pad ready cargo trousers. Reinforced seams, multiple pockets. Branded with your logo on the thigh.",
    },
    "performance-leggings": {
        "id": "performance-leggings", "name": "Performance Leggings", "price": 17.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/3760275/pexels-photo-3760275.jpeg",
        "description": "Full-length performance leggings with squat-proof fabric. Gym, PT, dance — branded with your logo.",
    },
    "gym-shorts": {
        "id": "gym-shorts", "name": "Gym & Training Shorts", "price": 11.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/4753986/pexels-photo-4753986.jpeg",
        "description": "Lightweight gym shorts with elastic drawcord. Branded with your gym name or logo.",
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
    # Aprons
    "bib-apron":                   {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Burgundy", "hex": "#7f1d1d"}, {"name": "Khaki", "hex": "#8b7355"}, {"name": "White", "hex": "#ffffff"}], "sizes": ["One Size"], "size_upcharges": {}},
    "waist-apron":                 {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Burgundy", "hex": "#7f1d1d"}], "sizes": ["One Size"], "size_upcharges": {}},
    "denim-apron":                 {"colors": [{"name": "Indigo Denim", "hex": "#1e3a8a"}, {"name": "Black Denim", "hex": "#1a1a1a"}], "sizes": ["One Size"], "size_upcharges": {}},
    # Bottoms
    "joggers":                     {"colors": COLOURS_HOODIE, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "workwear-trousers":           {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Charcoal", "hex": "#374151"}, {"name": "Khaki", "hex": "#8b7355"}], "sizes": ["28", "30", "32", "34", "36", "38", "40", "42"], "size_upcharges": {"40": 1.50, "42": 3.00}},
    "performance-leggings":        {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Burgundy", "hex": "#7f1d1d"}], "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "gym-shorts":                  {"colors": [{"name": "Black", "hex": "#0d0d0d"}, {"name": "Navy", "hex": "#1a2a4a"}, {"name": "Grey Marl", "hex": "#9ca3af"}], "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
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
    workforce_eligible: Optional[bool] = None
    also_bought: Optional[List[str]] = None
    match_with: Optional[List[str]] = None
    image_gallery: Optional[List[str]] = None
    specials_eligible: Optional[bool] = None
    gender_fit: Optional[str] = None  # mens | womens | unisex | kids
    industry_tags: Optional[List[str]] = None


GENDER_FIT_OPTIONS = ["mens", "womens", "unisex", "kids"]
INDUSTRY_SLUGS = ["trades", "hospitality", "healthcare", "beauty", "construction", "logistics", "fitness", "cleaning", "hair-beauty"]
INDUSTRIES_CATALOGUE = [
    {"slug": "healthcare", "title": "Healthcare", "subtitle": "Clinics, dental, mobile carers", "hero_image": "https://images.pexels.com/photos/4173324/pexels-photo-4173324.jpeg", "blurb": "Polos, tunics and sweatshirts customers recognise — soft fabrics, clean print, easy on hot washes."},
    {"slug": "construction-trades", "title": "Construction & Trades", "subtitle": "Builders, sparks, plumbers, joiners, site crews", "hero_image": "https://images.pexels.com/photos/8961331/pexels-photo-8961331.jpeg", "blurb": "Hi-vis vests, workwear tees, jackets and trousers that survive site life. EN ISO 20471 options ready to print."},
    {"slug": "retail", "title": "Retail", "subtitle": "Shops, garden centres, market stalls", "hero_image": "https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg", "blurb": "On-brand polos and tees that make your team unmistakable on the shop floor. Tidy logo print on the chest."},
    {"slug": "security", "title": "Security", "subtitle": "Door staff, mobile patrol, events", "hero_image": "https://images.pexels.com/photos/35562107/pexels-photo-35562107.png", "blurb": "Bold 'SECURITY' prints front and back. Polos, softshells and hi-vis kit — printed in the UK and ready quickly."},
    {"slug": "corporate", "title": "Corporate", "subtitle": "Offices, agencies, professional services", "hero_image": "https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg", "blurb": "Smart polos, jumpers and softshells for client days, exhibitions and team away-days. Embroidery or print."},
    {"slug": "sports-fitness", "title": "Sports & Fitness", "subtitle": "Gyms, PTs, coaches, clubs", "hero_image": "https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg", "blurb": "Performance tees, hoodies, joggers and leggings cut for the gym floor. Crisp prints, full-range movement."},
    {"slug": "industrial", "title": "Industrial", "subtitle": "Warehousing, manufacturing, fabrication, logistics", "hero_image": "https://images.pexels.com/photos/4391483/pexels-photo-4391483.jpeg", "blurb": "Heavy-cotton workwear, hi-vis and softshells built for the floor. Reorder in any quantity."},
    {"slug": "beauty-wellness", "title": "Beauty & Wellness", "subtitle": "Salons, spas, beauticians, hair & barbering, holistic studios", "hero_image": "https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg", "blurb": "Branded tees, aprons and sweatshirts that look as polished as the treatments. Statement prints land beautifully."},
    {"slug": "cleaning", "title": "Cleaning & Maintenance", "subtitle": "Cleaning crews, facilities, janitorial", "hero_image": "https://images.pexels.com/photos/4099235/pexels-photo-4099235.jpeg", "blurb": "Identifiable, easy-care polos and tees. Branded right, your team is recognisable on every site."},
    {"slug": "hospitality-catering", "title": "Hospitality & Catering", "subtitle": "Cafés, bars, pubs, restaurants, mobile caterers", "hero_image": "https://images.pexels.com/photos/3007355/pexels-photo-3007355.jpeg", "blurb": "Smart polos, tees and aprons that look right behind the bar and front of house. Tidy logo print on the chest."},

    # Back-compat aliases (legacy routes still resolve)
    {"slug": "trades", "title": "Trades", "subtitle": "Builders, sparks, plumbers, joiners", "hero_image": "https://images.pexels.com/photos/8961326/pexels-photo-8961326.jpeg", "blurb": "Hard-wearing tees, hoodies and hi-vis kitted out with your logo. Built for site, washed at 60°.", "alias_of": "construction-trades"},
    {"slug": "hospitality", "title": "Hospitality", "subtitle": "Cafés, bars, pubs, restaurants", "hero_image": "https://images.pexels.com/photos/3007355/pexels-photo-3007355.jpeg", "blurb": "Smart polos and tees that look right behind the bar and front of house. Tidy logo print on the chest.", "alias_of": "hospitality-catering"},
    {"slug": "beauty", "title": "Beauty & Spa", "subtitle": "Salons, beauticians, holistic studios", "hero_image": "https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg", "blurb": "Branded tees and sweatshirts that look as polished as the treatments. Tone-on-tone prints land beautifully.", "alias_of": "beauty-wellness"},
    {"slug": "construction", "title": "Construction", "subtitle": "Site crews, foremen, contractors", "hero_image": "https://images.pexels.com/photos/8961331/pexels-photo-8961331.jpeg", "blurb": "Hi-vis vests, workwear tees and jackets that survive site life. EN ISO 20471 compliant options ready to print.", "alias_of": "construction-trades"},
    {"slug": "logistics", "title": "Logistics & Couriers", "subtitle": "Delivery, warehouse, fleets", "hero_image": "https://images.pexels.com/photos/4391483/pexels-photo-4391483.jpeg", "blurb": "Comfortable polos, softshells and hi-vis tops branded with your fleet name. Reorder in any quantity.", "alias_of": "industrial"},
    {"slug": "fitness", "title": "Fitness & Coaching", "subtitle": "PT studios, gyms, sports coaches", "hero_image": "https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg", "blurb": "Performance tees, hoodies and joggers fit for the gym floor. Crisp prints, full-range movement.", "alias_of": "sports-fitness"},
    {"slug": "hair-beauty", "title": "Hair & Barbering", "subtitle": "Barbers, hairdressers, mobile stylists", "hero_image": "https://images.pexels.com/photos/3998365/pexels-photo-3998365.jpeg", "blurb": "Statement tees, polos and aprons that bring the salon brand to life. Style as sharp as the cuts.", "alias_of": "beauty-wellness"},
]


# ---------- Sports & Fitness Teams catalogue (SEO landings) ----------
SPORTS_TEAMS_CATALOGUE = [
    {"slug": "football", "title": "Football Kits", "h1": "Custom Football Kits, Printed in the UK", "subtitle": "Jerseys, shorts, socks — match-day ready",
     "hero_image": "https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg",
     "intro": "From Sunday League to academy squads — we print and ship full football kits with your crest, sponsor, names and numbers. UK printed, fast turnaround, low minimums.",
     "seo_paragraph": "Our custom football kits use breathable, sublimation-friendly performance fabric cut for movement. Add a club badge, front sponsor, sleeve sponsors, player names and squad numbers — all baked into the price. We handle artwork, mock-ups and proofs in-house in the UK, so your team gets match-ready quicker.",
     "faqs": [
       {"q": "What's the minimum order for a custom football kit?", "a": "There's no minimum — order one kit or fifty. Bulk discounts kick in from 10+ kits."},
       {"q": "How long until match day?", "a": "Most full football kits ship in 7–10 working days from artwork approval. Rush options available on request."},
       {"q": "Can I add a sponsor on the back?", "a": "Yes — front sponsor, sleeve sponsors and a small back-of-shorts logo are all supported."},
     ],
     "product_ids": ["football-jersey", "football-shorts", "football-kit-bundle", "football-premium-bundle", "football-kit-front-only", "football-premium-front-only", "training-tee", "training-tracksuit"],
    },
    {"slug": "rugby", "title": "Rugby Kits", "h1": "Custom Rugby Kits — Heavy-Grade Match Shirts",
     "subtitle": "Match shirts, training tops, club tracksuits",
     "hero_image": "https://images.pexels.com/photos/342361/pexels-photo-342361.jpeg",
     "intro": "Reinforced rugby shirts built to take a battering. Club crest, sponsor, player names and squad numbers baked into the price. UK printed, ready in 7–10 days.",
     "seo_paragraph": "Our rugby shirts use heavy-grade fabric with a reinforced collar and twin-needle seams — designed to survive line-outs and laundry day. Add badges, sponsors and back numbers; we'll deliver match-ready kit for any age group, from U7s to seniors.",
     "faqs": [
       {"q": "Are kits available in junior sizes?", "a": "Yes — full junior size range from 5–6 years up to 12–13 plus the adult range."},
       {"q": "Can you replicate our existing crest?", "a": "Absolutely — send us any file (JPG, PNG, PDF, vector) and we'll mock it up for free."},
       {"q": "Do you do training shirts as well?", "a": "Yes — match shirts, training tees and full tracksuits all under one order."},
     ],
     "product_ids": ["rugby-shirt", "rugby-kit-bundle", "rugby-kit-front-only", "training-tee", "training-tracksuit", "sports-tee"],
    },
    {"slug": "gyms", "title": "Gym Kit & Branded Apparel", "h1": "Branded Kit for Gyms — Built for the Floor",
     "subtitle": "Tees, hoodies, joggers, leggings — branded for your gym",
     "hero_image": "https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg",
     "intro": "Branded gym kit your members will actually want to wear. Statement prints, soft fabrics, performance fits — and a price that lets you mark them up.",
     "seo_paragraph": "Whether you run a CrossFit box, a strength gym, a HYROX squad or a high-street commercial gym — branded apparel turns your members into walking billboards. Our gym-ready kit covers tees, hoodies, joggers, leggings and shorts in performance-friendly fabrics. UK printed, low minimums, bulk discounts.",
     "faqs": [
       {"q": "Can I sell these to my members?", "a": "Yes — we set you up with bulk pricing so you can mark them up and sell. Just upload your logo, choose your colours and order."},
       {"q": "Do you do front and back prints?", "a": "Yes — front breast logo plus a larger back print are both included on most products."},
       {"q": "What's the lead time on a bulk gym kit order?", "a": "Typically 7–10 working days from artwork approval, faster on smaller orders."},
     ],
     "product_ids": ["personalised-tee", "personalised-hoodie", "joggers", "performance-leggings", "gym-shorts", "training-tee", "sports-tee"],
    },
    {"slug": "personal-trainers", "title": "Personal Trainer Kit", "h1": "Personal Trainer Kit — Branded For Your Studio",
     "subtitle": "Coach polos, performance tees, hoodies — sorted",
     "hero_image": "https://images.pexels.com/photos/4720234/pexels-photo-4720234.jpeg",
     "intro": "Look the part on session day. Branded coach polos, training tees, hoodies and joggers — printed with your logo and ready to wear.",
     "seo_paragraph": "Personal trainers, group coaches and online coaches need kit that travels well, washes hot and looks professional in client photos. We print PT-friendly performance fabrics with your logo on the chest, name on the sleeve, and your slogan on the back — your call.",
     "faqs": [
       {"q": "Can I order just one or two pieces?", "a": "Yes — no minimum. Most PTs start with a tee + hoodie + polo set."},
       {"q": "Will my logo look right on dark colours?", "a": "Yes — we'll mock it up for free on any colour before you commit, so there's no nasty surprises."},
       {"q": "Can I add my Instagram handle?", "a": "Of course — pop it under the logo or on the sleeve."},
     ],
     "product_ids": ["personalised-tee", "polo-shirt", "personalised-hoodie", "joggers", "training-tee", "sports-tee", "performance-leggings"],
    },
    {"slug": "boxing-gyms", "title": "Boxing Gym Kit", "h1": "Boxing Gym Kit — Walk-out Tees, Hoodies & More",
     "subtitle": "Fight night tees, gym hoodies, sponsor shirts",
     "hero_image": "https://images.pexels.com/photos/9311461/pexels-photo-9311461.jpeg",
     "intro": "Branded kit for boxing gyms, white-collar nights and amateur clubs. Fight night sponsor tees, gym hoodies, training kit — printed in the UK and ready quickly.",
     "seo_paragraph": "Boxing gyms run on identity. Our Fight Night Sponsor Tees carry your main sponsor plus multiple supporting logos at the back, while branded hoodies, walk-out tees and gym staples cover the day-to-day. Low minimums and quick turnaround.",
     "faqs": [
       {"q": "Can you handle multiple sponsor logos for fight night?", "a": "Yes — we routinely lay up 4–8 sponsor logos on a single tee, with a free mock-up before approval."},
       {"q": "How quick can you turn around a fight night order?", "a": "Standard turnaround is 7–10 days; we'll often beat that for fight cards — speak to us if you're tight on time."},
       {"q": "Do you do walk-out hoodies too?", "a": "Yes — branded gym hoodies, joggers, beanies, drawstring bags — anything you need to outfit your corner."},
     ],
     "product_ids": ["boxing-fight-tee", "personalised-tee", "personalised-hoodie", "joggers", "sports-tee", "training-tee"],
    },
    {"slug": "thai-boxing", "title": "Thai Boxing Gym Kit", "h1": "Muay Thai Gym Kit & Custom Shorts",
     "subtitle": "Branded Thai shorts, walk-out tees, gym hoodies",
     "hero_image": "https://images.pexels.com/photos/4761779/pexels-photo-4761779.jpeg",
     "intro": "Traditional-cut Muay Thai shorts printed in vibrant satin, branded gym tees and hoodies — kit out your fighters and your members.",
     "seo_paragraph": "Muay Thai gyms work hard for their identity — and our traditional-cut shorts, sublimated in vibrant colours, do them justice. Add custom names, club logo, sponsor logos and gym branding on full-print shorts, plus matching walk-out tees and hoodies.",
     "faqs": [
       {"q": "Can I have my fighter's name on the shorts?", "a": "Yes — names, gym logo, sponsor logos — all baked into the print."},
       {"q": "Do you offer kids' Thai shorts?", "a": "Yes — we cover junior sizes from 7–8 up to adult."},
       {"q": "How vibrant is the print on satin?", "a": "Very — sublimation print on satin makes colours pop. We always send a mock-up before printing."},
     ],
     "product_ids": ["muay-thai-shorts", "boxing-fight-tee", "personalised-tee", "personalised-hoodie", "training-tee"],
    },
    {"slug": "kick-boxing", "title": "Kickboxing Gym Kit", "h1": "Kickboxing Gym Kit, Shorts & Walk-out Tees",
     "subtitle": "Custom kickboxing shorts, club hoodies, training kit",
     "hero_image": "https://images.pexels.com/photos/4761787/pexels-photo-4761787.jpeg",
     "intro": "Branded kickboxing shorts, walk-out tees and club hoodies. Sublimated, durable, ready for the ring or class.",
     "seo_paragraph": "Kickboxing gyms running anything from after-school junior classes to amateur fight cards rely on kit that survives the bag work and looks sharp on social. We print full sublimated kickboxing shorts, branded tees and hoodies with your gym logo, fighter names and sponsor logos.",
     "faqs": [
       {"q": "Can I get the same design on both shorts and tee?", "a": "Yes — we line up matching prints across the kit so the whole squad looks unified."},
       {"q": "Will the print survive grappling?", "a": "Yes — sublimation prints sit inside the fibres, not on top, so they don't crack or peel."},
       {"q": "Minimums?", "a": "No minimum — order one set or fifty."},
     ],
     "product_ids": ["fight-shorts", "muay-thai-shorts", "boxing-fight-tee", "personalised-tee", "personalised-hoodie", "training-tee"],
    },
    {"slug": "dance-studios", "title": "Dance Studio Apparel", "h1": "Custom Dance Studio Apparel & Crew Kit",
     "subtitle": "Studio tees, hoodies, leggings, joggers — branded",
     "hero_image": "https://images.pexels.com/photos/4250534/pexels-photo-4250534.jpeg",
     "intro": "Branded dance studio kit your students, parents and crew will love. Soft tees, comfy hoodies, performance leggings and joggers — printed with your studio's logo.",
     "seo_paragraph": "From baby ballet to street dance crews — every studio needs branded kit. Our soft-drape tees, hoodies, joggers and leggings carry your studio's logo, dancer's name and crew slogans cleanly. Parents and dancers love them, and they make brilliant studio fundraisers too.",
     "faqs": [
       {"q": "Can I sell these to my parents?", "a": "Yes — pre-order forms work brilliantly. We offer bulk pricing for orders of 10+."},
       {"q": "Do you do small sizes for kids?", "a": "Yes — junior sizes from 3–4 up to 12–13 across most styles."},
       {"q": "Can dancers have their name on the back?", "a": "Yes — names, year groups, studio colours, crew names — your call."},
     ],
     "product_ids": ["dance-tee", "personalised-hoodie", "joggers", "performance-leggings", "personalised-tee", "kids-tee"],
    },
]


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
                     "bulk_pricing_enabled", "bulk_pricing_overrides", "allowed_placements",
                     "workforce_eligible", "also_bought", "match_with", "image_gallery", "specials_eligible",
                     "gender_fit", "industry_tags"):
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
            "workforce_eligible": bool(p.get("workforce_eligible")),
            "also_bought": p.get("also_bought") or [],
            "match_with": p.get("match_with") or [],
            "image_gallery": p.get("image_gallery") or [],
            "specials_eligible": bool(p.get("specials_eligible")),
            "gender_fit": p.get("gender_fit") or "unisex",
            "industry_tags": p.get("industry_tags") or [],
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
    if payload.also_bought is not None:
        if len(payload.also_bought) > 6:
            raise HTTPException(400, "also_bought capped at 6 products")
        for pid in payload.also_bought:
            if pid == product_id:
                raise HTTPException(400, "Cannot cross-sell a product to itself")
            if pid not in PRODUCTS:
                raise HTTPException(400, f"Unknown also_bought product_id '{pid}'")
    if payload.match_with is not None:
        if len(payload.match_with) > 4:
            raise HTTPException(400, "match_with capped at 4 products")
        for pid in payload.match_with:
            if pid == product_id:
                raise HTTPException(400, "Cannot match a product with itself")
            if pid not in PRODUCTS:
                raise HTTPException(400, f"Unknown match_with product_id '{pid}'")
    if payload.image_gallery is not None:
        if len(payload.image_gallery) > 8:
            raise HTTPException(400, "image_gallery capped at 8 images")
        for u in payload.image_gallery:
            if not isinstance(u, str) or not (u.startswith("http://") or u.startswith("https://") or u.startswith("data:image/")):
                raise HTTPException(400, "image_gallery entries must be http(s) or data: URLs")
    if payload.gender_fit is not None and payload.gender_fit not in GENDER_FIT_OPTIONS:
        raise HTTPException(400, f"gender_fit must be one of {GENDER_FIT_OPTIONS}")
    if payload.industry_tags is not None:
        for t in payload.industry_tags:
            if t not in INDUSTRY_SLUGS:
                raise HTTPException(400, f"Unknown industry '{t}'. Allowed: {INDUSTRY_SLUGS}")
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
        "workforce_eligible": payload.workforce_eligible if payload.workforce_eligible is not None else bool(PRODUCTS[product_id].get("workforce_eligible")),
        "also_bought": payload.also_bought,
        "match_with": payload.match_with,
        "image_gallery": payload.image_gallery,
        "specials_eligible": payload.specials_eligible if payload.specials_eligible is not None else bool(PRODUCTS[product_id].get("specials_eligible")),
        "gender_fit": payload.gender_fit,
        "industry_tags": payload.industry_tags,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.product_meta.update_one({"product_id": product_id}, {"$set": doc}, upsert=True)
    for k in ("brand", "sku", "description_full", "size_guide_image", "size_guide_table",
              "bulk_pricing_enabled", "bulk_pricing_overrides", "allowed_placements",
              "workforce_eligible", "also_bought", "match_with", "image_gallery", "specials_eligible",
              "gender_fit", "industry_tags"):
        v = doc.get(k)
        if v is not None or k in ("bulk_pricing_enabled", "workforce_eligible", "specials_eligible"):
            PRODUCTS[product_id][k] = v
    return {"ok": True}


@api_router.get("/bulk-tiers/leavers")
async def get_leavers_tiers():
    return {
        "tiers": [{"min_qty": t, "unit_price": p} for t, p in LEAVERS_BULK_TIERS_DEFAULT],
        "bag_price": LEAVERS_BAG_PRICE,
    }


# Full-front print upgrade for Leavers — replaces the standard breast pocket print
LEAVERS_FULL_FRONT_UPCHARGE = 2.50
# Products that can NOT accept a full-front print (varsity jackets stay chest-panel only)
LEAVERS_NO_FULL_FRONT_IDS = {"leavers-varsity", "varsity-jacket"}


@api_router.get("/leavers/config")
async def get_leavers_config():
    """Public config for the Leavers order flow — pricing & rules used by the UI."""
    return {
        "full_front_upcharge": LEAVERS_FULL_FRONT_UPCHARGE,
        "bag_price": LEAVERS_BAG_PRICE,
        "bulk_tiers": [{"min_qty": t, "unit_price": p} for t, p in LEAVERS_BULK_TIERS_DEFAULT],
        "no_full_front_product_ids": sorted(LEAVERS_NO_FULL_FRONT_IDS),
        "proof_days": 2,
        "names_deadline_days": 7,
        "design_libraries": {
            "front_breast": "leavers-front-designs",
            "back": "leavers-back-designs",
            "full_front": "leavers-full-front-designs",
        },
    }


@api_router.get("/leavers/products")
async def list_leavers_products():
    out = []
    for p in PRODUCTS.values():
        if p.get("category") == "leavers":
            item = {k: p.get(k) for k in ("id", "name", "price", "image", "description", "sizes")}
            item["allows_full_front"] = p["id"] not in LEAVERS_NO_FULL_FRONT_IDS
            out.append(item)
    return out


# ---------- Leavers' design templates (admin-editable) ----------
DEFAULT_LEAVERS_TEMPLATES = [
    {"id": "year-nicknames", "title": "Year + nicknames", "description": "Big year on the front, nicknames list on the back. The classic.",
     "image": "https://images.pexels.com/photos/8839894/pexels-photo-8839894.jpeg", "active": True, "sort_order": 1},
    {"id": "class-list", "title": "Class list", "description": "Every leaver's name printed on the back. One hoodie, the whole year.",
     "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg", "active": True, "sort_order": 2},
    {"id": "varsity", "title": "Varsity letter", "description": "Letter on chest, year on the back, your name on the left sleeve.",
     "image": "https://images.pexels.com/photos/16429777/pexels-photo-16429777.jpeg", "active": True, "sort_order": 3},
]


class LeaversTemplate(BaseModel):
    title: str
    description: Optional[str] = ""
    image: str
    active: bool = True
    sort_order: int = 100


@api_router.get("/leavers/templates")
async def list_leavers_templates():
    out = []
    async for d in db.leavers_templates.find({}).sort([("sort_order", 1), ("title", 1)]):
        if d.get("active", True):
            out.append({k: d.get(k) for k in ("id", "title", "description", "image", "sort_order")})
    return out


@api_router.get("/admin/leavers/templates", dependencies=[Depends(require_admin)])
async def admin_list_leavers_templates():
    out = []
    async for d in db.leavers_templates.find({}).sort([("sort_order", 1), ("title", 1)]):
        out.append({k: d.get(k) for k in ("id", "title", "description", "image", "active", "sort_order")})
    return out


@api_router.post("/admin/leavers/templates", dependencies=[Depends(require_admin)])
async def admin_create_leavers_template(payload: LeaversTemplate):
    if not (payload.image.startswith("http://") or payload.image.startswith("https://") or payload.image.startswith("data:image/")):
        raise HTTPException(400, "Image must be http(s) or data: URL")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.leavers_templates.insert_one(doc)
    return {k: doc[k] for k in ("id", "title", "description", "image", "active", "sort_order")}


@api_router.put("/admin/leavers/templates/{template_id}", dependencies=[Depends(require_admin)])
async def admin_update_leavers_template(template_id: str, payload: LeaversTemplate):
    if not (payload.image.startswith("http://") or payload.image.startswith("https://") or payload.image.startswith("data:image/")):
        raise HTTPException(400, "Image must be http(s) or data: URL")
    res = await db.leavers_templates.update_one(
        {"id": template_id},
        {"$set": {**payload.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Template not found")
    return {"ok": True}


@api_router.delete("/admin/leavers/templates/{template_id}", dependencies=[Depends(require_admin)])
async def admin_delete_leavers_template(template_id: str):
    res = await db.leavers_templates.delete_one({"id": template_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"ok": True}


# ---------- Leavers' direct checkout (no group-order flow) ----------
class LeaversSizeQty(BaseModel):
    size: str
    qty: int


class LeaversCheckoutRequest(BaseModel):
    school: str
    year_group: str
    contact_name: str
    contact_email: EmailStr
    contact_phone: Optional[str] = ""
    product_id: str
    template_id: Optional[str] = None
    template_title: Optional[str] = None
    # Custom uploads (optional — user can also pick from the design library)
    custom_design_data_url: Optional[str] = None            # legacy: front design (breast pocket)
    custom_back_design_data_url: Optional[str] = None       # back print artwork
    # Design library picks (portfolio ids from PORTFOLIO_CATEGORIES leavers-front/back/full-front-designs)
    front_design_id: Optional[str] = None
    back_design_id: Optional[str] = None
    # Print position — "breast" (default, included) OR "full_front" (+£2.50 upcharge, not allowed on varsity)
    print_position: str = "breast"
    # Names — either the customer uploads a file OR they tick to be contacted after purchase
    names_file_data_url: Optional[str] = None
    names_collection_mode: str = "upload"                   # "upload" | "we-will-contact"
    sizes: List[LeaversSizeQty]
    add_drawstring_bag: bool = False
    origin_url: str


@api_router.post("/leavers/checkout", response_model=CheckoutResponse)
async def leavers_checkout(payload: LeaversCheckoutRequest, http_request: Request):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, f"Unknown product '{payload.product_id}'")
    p = PRODUCTS[payload.product_id]
    if p.get("category") != "leavers":
        raise HTTPException(400, "Selected product is not a leavers' garment")
    sizes_set = set(p.get("sizes") or [])
    total_qty = 0
    line_summary: List[str] = []
    for s in payload.sizes:
        if s.qty < 1:
            continue
        if sizes_set and s.size not in sizes_set:
            raise HTTPException(400, f"Size '{s.size}' unavailable for {p['name']}")
        total_qty += int(s.qty)
        line_summary.append(f"{s.size}×{s.qty}")
    if total_qty < 1:
        raise HTTPException(400, "Add at least one item")

    # Validate print position
    if payload.print_position not in ("breast", "full_front"):
        raise HTTPException(400, "print_position must be 'breast' or 'full_front'")
    if payload.print_position == "full_front" and payload.product_id in LEAVERS_NO_FULL_FRONT_IDS:
        raise HTTPException(400, f"{p['name']} does not support a full-front print — please choose the breast option.")
    full_front_upcharge = LEAVERS_FULL_FRONT_UPCHARGE if payload.print_position == "full_front" else 0.0

    base = float(p["price"])
    unit = tier_unit_price(LEAVERS_BULK_TIERS_DEFAULT, base, total_qty) + full_front_upcharge
    bag_each = LEAVERS_BAG_PRICE if payload.add_drawstring_bag else 0.0
    per_unit = unit + bag_each
    total_amount = round(per_unit * total_qty, 2)
    if total_amount < 0.5:
        raise HTTPException(400, "Total below Stripe minimum (£0.50)")

    # Require SOME kind of design — either a template, a picked design from the library, or a custom upload
    has_design = any([
        payload.template_id,
        payload.front_design_id,
        payload.back_design_id,
        payload.custom_design_data_url,
        payload.custom_back_design_data_url,
    ])
    if not has_design:
        raise HTTPException(400, "Pick a design (front or back) or upload your own artwork")

    # Validate data-URL uploads
    for label, du in (
        ("front", payload.custom_design_data_url),
        ("back", payload.custom_back_design_data_url),
        ("names", payload.names_file_data_url),
    ):
        if not du:
            continue
        if not (du.startswith("data:image/") or du.startswith("data:application/")):
            raise HTTPException(400, f"{label} upload must be an image or file data URL")
        if len(du) > 8 * 1024 * 1024:
            raise HTTPException(400, f"{label} upload too large (max ~6 MB)")

    if payload.names_collection_mode not in ("upload", "we-will-contact"):
        raise HTTPException(400, "names_collection_mode must be 'upload' or 'we-will-contact'")

    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/leavers-hoodies"

    metadata = {
        "flow": "leavers",
        "school": payload.school[:80],
        "year_group": payload.year_group[:60],
        "contact_name": payload.contact_name[:80],
        "contact_email": payload.contact_email[:80],
        "product_id": payload.product_id,
        "template_id": payload.template_id or "custom",
        "template_title": (payload.template_title or "")[:80],
        "print_position": payload.print_position,
        "front_design_id": (payload.front_design_id or "")[:60],
        "back_design_id": (payload.back_design_id or "")[:60],
        "names_mode": payload.names_collection_mode,
        "total_qty": str(total_qty),
        "unit_price": f"{unit:.2f}",
        "bag_each": f"{bag_each:.2f}",
        "lines": ",".join(line_summary)[:450],
    }

    checkout_request = CheckoutSessionRequest(
        amount=total_amount, currency="gbp",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    artwork_id = None
    if any([payload.custom_design_data_url, payload.custom_back_design_data_url, payload.names_file_data_url]):
        artwork_id = str(uuid.uuid4())
        await db.leavers_artwork.insert_one({
            "id": artwork_id,
            "session_id": session.session_id,
            "custom_design": payload.custom_design_data_url,               # front
            "custom_back_design": payload.custom_back_design_data_url,     # back
            "names_file": payload.names_file_data_url,                     # names list
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "flow": "leavers",
        "school": payload.school,
        "year_group": payload.year_group,
        "contact_name": payload.contact_name,
        "contact_email": payload.contact_email,
        "contact_phone": payload.contact_phone,
        "product_id": payload.product_id,
        "template_id": payload.template_id,
        "template_title": payload.template_title,
        "front_design_id": payload.front_design_id,
        "back_design_id": payload.back_design_id,
        "print_position": payload.print_position,
        "names_collection_mode": payload.names_collection_mode,
        "custom_design_artwork_id": artwork_id,
        "sizes": [s.model_dump() for s in payload.sizes if s.qty > 0],
        "add_drawstring_bag": bool(payload.add_drawstring_bag),
        "total_quantity": total_qty,
        "unit_price": unit,
        "full_front_upcharge": full_front_upcharge,
        "amount": total_amount,
        "currency": "gbp",
        "metadata": metadata,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return CheckoutResponse(url=session.url, session_id=session.session_id)


class LeaversBespokeRequest(BaseModel):
    school: str
    year_group: str
    contact_name: str
    contact_email: EmailStr
    contact_phone: Optional[str] = ""
    estimated_qty: int
    notes: Optional[str] = ""


@api_router.post("/leavers/bespoke")
async def leavers_bespoke(payload: LeaversBespokeRequest):
    if payload.estimated_qty < 1:
        raise HTTPException(400, "Estimated quantity must be at least 1")
    doc = {
        "id": str(uuid.uuid4()),
        "kind": "leavers_bespoke",
        "name": payload.contact_name,
        "email": payload.contact_email,
        "phone": payload.contact_phone or "",
        "company": payload.school,
        "year_group": payload.year_group,
        "quantity": int(payload.estimated_qty),
        "message": payload.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quote_requests.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


# ---------- Kit Your Workforce ----------
SETTINGS_KEY_WORKFORCE_TIERS = "workforce_tiers_pct"
SETTINGS_KEY_WORKFORCE_QUOTE_THRESHOLD = "workforce_quote_threshold"
WORKFORCE_QUOTE_THRESHOLD_DEFAULT = 100  # > 100 garments → quote-only
WORKFORCE_BACK_PRINT_PRICE = 3.50  # per-garment add-on


async def _get_workforce_tiers() -> List[Tuple[int, float]]:
    """Return [(min_qty, pct)] sorted desc; falls back to default % bulk tiers."""
    doc = await db.settings.find_one({"key": SETTINGS_KEY_WORKFORCE_TIERS})
    if doc and "tiers" in doc and doc["tiers"]:
        tiers = doc["tiers"]
    else:
        tiers = DEFAULT_BULK_TIERS_PCT
    return sorted([(int(t[0]), float(t[1])) for t in tiers], key=lambda x: -x[0])


async def _get_workforce_threshold() -> int:
    doc = await db.settings.find_one({"key": SETTINGS_KEY_WORKFORCE_QUOTE_THRESHOLD})
    try:
        return int(doc["value"]) if doc and "value" in doc else WORKFORCE_QUOTE_THRESHOLD_DEFAULT
    except (TypeError, ValueError):
        return WORKFORCE_QUOTE_THRESHOLD_DEFAULT


@api_router.get("/workforce/products")
async def list_workforce_products():
    """Garments admin has flagged 'workforce_eligible' in /admin/product-settings."""
    out = []
    for p in PRODUCTS.values():
        if p.get("workforce_eligible"):
            out.append({
                "id": p["id"], "name": p["name"], "price": float(p["price"]),
                "image": p["image"],
                "description": p.get("description") or "",
                "sizes": p.get("sizes", []),
                "size_upcharges": p.get("size_upcharges", {}),
                "category": p["category"],
                "brand": p.get("brand") or "",
                "allowed_placements": p.get("allowed_placements") or list(ALLOWED_PLACEMENT_OPTIONS),
            })
    out.sort(key=lambda x: x["price"])
    return out


@api_router.get("/specials/products")
async def list_specials_products():
    """Your Own Print Specials — single breast-pocket logo print, no MOQ, starter-business pricing."""
    out = []
    for p in PRODUCTS.values():
        if p.get("specials_eligible"):
            out.append({
                "id": p["id"], "name": p["name"], "price": float(p["price"]),
                "image": p["image"],
                "description": p.get("description") or "",
                "sizes": p.get("sizes", []),
                "category": p["category"],
                "brand": p.get("brand") or "",
                "gender_fit": p.get("gender_fit") or "unisex",
            })
    out.sort(key=lambda x: x["price"])
    return out


# ---------- Industries ----------
@api_router.get("/industries")
async def list_industries():
    out = []
    for ind in INDUSTRIES_CATALOGUE:
        if ind.get("alias_of"):
            continue
        # Match by canonical slug OR any legacy alias slug pointing to it
        legacy = {a["slug"] for a in INDUSTRIES_CATALOGUE if a.get("alias_of") == ind["slug"]}
        count = sum(1 for p in PRODUCTS.values()
                    if any(s in (p.get("industry_tags") or []) for s in {ind["slug"], *legacy}))
        out.append({**ind, "product_count": count})
    return out


# ---------- Shop by garment type ----------
GARMENT_TYPE_CATALOGUE = [
    {"slug": "t-shirts",    "title": "T-shirts",     "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg"},
    {"slug": "hoodies",     "title": "Hoodies",      "image": "https://images.pexels.com/photos/8839894/pexels-photo-8839894.jpeg"},
    {"slug": "polos",       "title": "Polos",        "image": "https://images.pexels.com/photos/8217544/pexels-photo-8217544.jpeg"},
    {"slug": "sweatshirts", "title": "Sweatshirts",  "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg"},
    {"slug": "jackets",     "title": "Jackets",      "image": "https://images.pexels.com/photos/16429777/pexels-photo-16429777.jpeg"},
    {"slug": "hi-vis",      "title": "Hi-Vis",       "image": "https://images.pexels.com/photos/8961331/pexels-photo-8961331.jpeg"},
    {"slug": "shorts",      "title": "Shorts",       "image": "https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg"},
    {"slug": "bottoms",     "title": "Joggers & Trousers", "image": "https://images.pexels.com/photos/5384423/pexels-photo-5384423.jpeg"},
    {"slug": "aprons",      "title": "Aprons",       "image": "https://images.pexels.com/photos/4252136/pexels-photo-4252136.jpeg"},
    {"slug": "accessories", "title": "Accessories",  "image": "https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg"},
]


def _garment_type_of(product: Dict) -> Optional[str]:
    pid = product["id"].lower()
    name = (product.get("name") or "").lower()
    cat = (product.get("category") or "").lower()
    if "apron" in pid or "apron" in name:
        return "aprons"
    if "legging" in pid or "trouser" in pid or "jogger" in pid or "legging" in name or "trouser" in name or "jogger" in name:
        return "bottoms"
    if "short" in pid or "short" in name:
        return "shorts"
    if "jacket" in pid or "jacket" in name or "varsity" in pid or "softshell" in pid:
        return "jackets"
    if "vest" in pid or "hi-vis" in pid or "hi vis" in name:
        return "hi-vis"
    if "polo" in pid or "polo" in name:
        return "polos"
    if "hoodie" in pid or "hoodie" in name or "pullover" in pid:
        return "hoodies"
    if "sweatshirt" in pid or "crewneck" in pid:
        return "sweatshirts"
    if "tee" in pid or "tshirt" in pid or "t-shirt" in name or "shirt" in pid:
        return "t-shirts"
    if "bag" in pid or "beanie" in pid or "drawstring" in pid:
        return "accessories"
    if cat == "leavers":
        return "hoodies"
    return None


@api_router.get("/shop/types")
async def list_shop_garment_types():
    out = []
    for t in GARMENT_TYPE_CATALOGUE:
        count = sum(1 for p in PRODUCTS.values() if _garment_type_of(p) == t["slug"])
        out.append({**t, "product_count": count})
    return out


@api_router.get("/shop/type/{slug}")
async def shop_by_garment_type(slug: str, gender_fit: Optional[str] = None):
    meta = next((t for t in GARMENT_TYPE_CATALOGUE if t["slug"] == slug), None)
    if not meta:
        raise HTTPException(404, "Garment type not found")
    items = []
    for p in PRODUCTS.values():
        if _garment_type_of(p) == slug:
            if gender_fit and (p.get("gender_fit") or "unisex") != gender_fit:
                continue
            items.append({
                "id": p["id"], "name": p["name"], "price": float(p["price"]),
                "image": p["image"], "category": p["category"],
                "description": p.get("description") or "",
                "gender_fit": p.get("gender_fit") or "unisex",
            })
    items.sort(key=lambda x: x["price"])
    return {**meta, "products": items}


@api_router.get("/industries/{slug}")
async def get_industry(slug: str, gender_fit: Optional[str] = None):
    ind = next((i for i in INDUSTRIES_CATALOGUE if i["slug"] == slug), None)
    if not ind:
        raise HTTPException(404, "Industry not found")
    # Resolve canonical (if this is a legacy alias)
    canonical_slug = ind.get("alias_of") or ind["slug"]
    canonical = next((i for i in INDUSTRIES_CATALOGUE if i["slug"] == canonical_slug), ind)
    # Tags to match: canonical + any aliases pointing to it
    match_slugs = {canonical_slug} | {a["slug"] for a in INDUSTRIES_CATALOGUE if a.get("alias_of") == canonical_slug}
    products = []
    for p in PRODUCTS.values():
        tags = set(p.get("industry_tags") or [])
        if tags & match_slugs:
            if gender_fit and (p.get("gender_fit") or "unisex") != gender_fit:
                continue
            products.append({
                "id": p["id"], "name": p["name"], "price": float(p["price"]),
                "image": p["image"], "category": p["category"],
                "description": p.get("description") or "",
                "gender_fit": p.get("gender_fit") or "unisex",
            })
    products.sort(key=lambda x: x["price"])
    # Strip the alias_of marker from the response
    out = {k: v for k, v in canonical.items() if k != "alias_of"}
    return {**out, "products": products}


# ---------- Sports & Fitness Teams (SEO landings) ----------
@api_router.get("/sports-teams")
async def list_sports_teams():
    out = []
    for s in SPORTS_TEAMS_CATALOGUE:
        out.append({"slug": s["slug"], "title": s["title"], "subtitle": s["subtitle"],
                    "hero_image": s["hero_image"], "intro": s["intro"]})
    return out


@api_router.get("/sports-teams/{slug}")
async def get_sports_team(slug: str):
    s = next((i for i in SPORTS_TEAMS_CATALOGUE if i["slug"] == slug), None)
    if not s:
        raise HTTPException(404, "Sports landing not found")
    products = []
    for pid in s.get("product_ids", []):
        p = PRODUCTS.get(pid)
        if p:
            products.append({
                "id": p["id"], "name": p["name"], "price": float(p["price"]),
                "image": p["image"], "category": p["category"],
                "description": p.get("description") or "",
            })
    return {**s, "products": products}


@api_router.get("/workforce/tiers")
async def get_workforce_tiers():
    tiers = await _get_workforce_tiers()
    return {
        "tiers": [{"min_qty": q, "pct": p} for q, p in sorted(tiers, key=lambda x: x[0])],
        "quote_threshold": await _get_workforce_threshold(),
        "back_print_price": WORKFORCE_BACK_PRINT_PRICE,
    }


@api_router.patch("/admin/workforce-tiers", dependencies=[Depends(require_admin)])
async def update_workforce_tiers(payload: Dict):
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
        {"key": SETTINGS_KEY_WORKFORCE_TIERS},
        {"$set": {"key": SETTINGS_KEY_WORKFORCE_TIERS, "tiers": cleaned,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    threshold = payload.get("quote_threshold")
    if threshold is not None:
        try:
            tv = int(threshold)
            if tv < 1:
                raise ValueError()
        except (TypeError, ValueError):
            raise HTTPException(400, "quote_threshold must be a positive integer")
        await db.settings.update_one(
            {"key": SETTINGS_KEY_WORKFORCE_QUOTE_THRESHOLD},
            {"$set": {"key": SETTINGS_KEY_WORKFORCE_QUOTE_THRESHOLD, "value": tv,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    return {"ok": True}


class WorkforceLine(BaseModel):
    product_id: str
    size: str
    qty: int
    back_print: bool = False  # +£3.50/garment


class WorkforceCheckoutRequest(BaseModel):
    lines: List[WorkforceLine]
    origin_url: str
    company: Optional[str] = ""
    contact_name: Optional[str] = ""
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = ""
    breast_logo_data_url: Optional[str] = None
    back_print_data_url: Optional[str] = None


def _resolve_workforce_tier(total_qty: int, tiers: List[Tuple[int, float]]) -> float:
    """Return the % discount that applies for this total qty (0 if below smallest tier)."""
    for threshold, pct in tiers:  # already desc
        if total_qty >= threshold:
            return pct
    return 0.0


@api_router.post("/workforce/quote", response_model=Dict)
async def workforce_quote(payload: WorkforceCheckoutRequest):
    """Used when total qty exceeds quote_threshold. Logs a QuoteRequest entry."""
    threshold = await _get_workforce_threshold()
    total_qty = sum(int(ln.qty) for ln in payload.lines if ln.qty > 0)
    if total_qty <= threshold:
        raise HTTPException(400, f"Quote-only above {threshold} items. Total submitted: {total_qty}.")
    if not payload.contact_email or not payload.contact_name:
        raise HTTPException(400, "Contact name and email are required for a quote")
    items = []
    for ln in payload.lines:
        if ln.product_id not in PRODUCTS or ln.qty < 1:
            continue
        items.append({
            "product_id": ln.product_id,
            "product_name": PRODUCTS[ln.product_id]["name"],
            "size": ln.size, "qty": int(ln.qty), "back_print": bool(ln.back_print),
        })
    doc = {
        "id": str(uuid.uuid4()),
        "kind": "workforce",
        "name": payload.contact_name, "email": payload.contact_email,
        "phone": payload.contact_phone or "", "company": payload.company or "",
        "quantity": total_qty,
        "message": f"Workforce kit quote — {len(items)} line items, {total_qty} total garments.",
        "items": items,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quote_requests.insert_one(doc)
    return {"ok": True, "id": doc["id"], "total_qty": total_qty}


@api_router.post("/workforce/checkout", response_model=CheckoutResponse)
async def workforce_checkout(payload: WorkforceCheckoutRequest, http_request: Request):
    threshold = await _get_workforce_threshold()
    tiers = await _get_workforce_tiers()

    # Validate lines
    valid_lines: List[Dict] = []
    total_qty = 0
    for ln in payload.lines:
        if ln.product_id not in PRODUCTS:
            raise HTTPException(400, f"Unknown product '{ln.product_id}'")
        p = PRODUCTS[ln.product_id]
        if not p.get("workforce_eligible"):
            raise HTTPException(400, f"Product '{p['name']}' is not workforce-eligible")
        if ln.qty < 1:
            continue
        allowed_sizes = set(p.get("sizes") or [])
        if allowed_sizes and ln.size not in allowed_sizes:
            raise HTTPException(400, f"Size '{ln.size}' unavailable for {p['name']}")
        # Back-print only allowed if the product permits it
        ap = set(p.get("allowed_placements") or ALLOWED_PLACEMENT_OPTIONS)
        if ln.back_print and "back-print" not in ap:
            raise HTTPException(400, f"Back print not available on {p['name']}")
        size_upcharge = float((p.get("size_upcharges") or {}).get(ln.size, 0.0))
        valid_lines.append({
            "product_id": ln.product_id,
            "product_name": p["name"],
            "size": ln.size, "qty": int(ln.qty),
            "back_print": bool(ln.back_print),
            "base_price": float(p["price"]),
            "size_upcharge": size_upcharge,
        })
        total_qty += int(ln.qty)

    if total_qty < 1:
        raise HTTPException(400, "Add at least one garment to the kit")
    if total_qty > threshold:
        raise HTTPException(
            status_code=422,
            detail=f"Over {threshold} garments — please request a quote (POST /api/workforce/quote)",
        )

    # Validate artwork
    if not payload.breast_logo_data_url or not payload.breast_logo_data_url.startswith("data:image/"):
        raise HTTPException(400, "Please upload your breast-logo artwork before checking out")
    needs_back_print = any(ln["back_print"] for ln in valid_lines)
    if needs_back_print:
        if not payload.back_print_data_url or not payload.back_print_data_url.startswith("data:image/"):
            raise HTTPException(400, "You've selected back print on some garments — please upload your back-print artwork")
    # Cap size to ~8 MB total each (Stripe metadata won't carry the image; we'll save to artwork doc)
    MAX_DATA_URL = 8 * 1024 * 1024
    if len(payload.breast_logo_data_url) > MAX_DATA_URL:
        raise HTTPException(400, "Breast logo image too large (max ~6 MB)")
    if payload.back_print_data_url and len(payload.back_print_data_url) > MAX_DATA_URL:
        raise HTTPException(400, "Back print image too large (max ~6 MB)")

    discount_pct = _resolve_workforce_tier(total_qty, tiers)
    factor = 1 - (discount_pct / 100.0)

    # Compute total
    total_amount = 0.0
    breakdown_strs: List[str] = []
    for ln in valid_lines:
        # tier discount applies only to the garment base (not size upcharges or back-print)
        unit_garment = snap_to_99(ln["base_price"] * factor) if discount_pct > 0 else ln["base_price"]
        unit = unit_garment + ln["size_upcharge"] + (WORKFORCE_BACK_PRINT_PRICE if ln["back_print"] else 0.0)
        line_total = round(unit * ln["qty"], 2)
        ln["unit_price"] = unit
        ln["line_total"] = line_total
        total_amount += line_total
        breakdown_strs.append(f"{ln['product_id']}·{ln['size']}×{ln['qty']}@£{unit:.2f}")
    total_amount = round(total_amount, 2)

    if total_amount < 0.5:
        raise HTTPException(400, "Total below Stripe minimum (£0.50)")

    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/workforce"

    metadata = {
        "flow": "workforce",
        "total_qty": str(total_qty),
        "discount_pct": f"{discount_pct:.1f}",
        "lines": "|".join(breakdown_strs)[:450],
        "company": (payload.company or "")[:80],
        "contact_name": (payload.contact_name or "")[:80],
        "contact_email": (payload.contact_email or "")[:80],
    }

    checkout_request = CheckoutSessionRequest(
        amount=total_amount, currency="gbp",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    artwork_doc_id = str(uuid.uuid4())
    await db.workforce_artwork.insert_one({
        "id": artwork_doc_id,
        "session_id": session.session_id,
        "breast_logo": payload.breast_logo_data_url,
        "back_print": payload.back_print_data_url,
        "needs_back_print": needs_back_print,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "flow": "workforce",
        "lines": valid_lines,
        "total_quantity": total_qty,
        "discount_pct": discount_pct,
        "amount": total_amount,
        "currency": "gbp",
        "metadata": metadata,
        "artwork_id": artwork_doc_id,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return CheckoutResponse(url=session.url, session_id=session.session_id)


# ---------- Also bought with (cross-sells) ----------
@api_router.get("/products/{product_id}/also-bought")
async def also_bought(product_id: str, limit: int = 4):
    p = PRODUCTS.get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    picks = list(p.get("also_bought") or [])
    # Auto-fallback: same category if admin hasn't picked any
    if not picks:
        same_cat = [
            q for q in PRODUCTS.values()
            if q["id"] != product_id and q["category"] == p["category"]
        ]
        # Take up to limit, stable order (by price asc then id)
        same_cat.sort(key=lambda x: (float(x["price"]), x["id"]))
        picks = [q["id"] for q in same_cat[:limit]]
    out = []
    seen = set()
    for pid in picks:
        if pid in seen:
            continue
        seen.add(pid)
        q = PRODUCTS.get(pid)
        if not q:
            continue
        out.append({
            "id": q["id"], "name": q["name"], "price": float(q["price"]),
            "image": q["image"], "category": q["category"],
        })
        if len(out) >= max(1, min(int(limit or 4), 8)):
            break
    return out


@api_router.get("/products/{product_id}/match-with")
async def match_with(product_id: str, limit: int = 4):
    """Curator-picked complementary products (no auto-fallback — returns empty if admin hasn't picked any)."""
    p = PRODUCTS.get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    picks = list(p.get("match_with") or [])
    out = []
    seen = set()
    for pid in picks:
        if pid in seen:
            continue
        seen.add(pid)
        q = PRODUCTS.get(pid)
        if not q:
            continue
        out.append({
            "id": q["id"], "name": q["name"], "price": float(q["price"]),
            "image": q["image"], "category": q["category"],
        })
        if len(out) >= max(1, min(int(limit or 4), 6)):
            break
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


# ============================================================================
# Object Storage (Emergent R2-style) — for Portfolio + future asset uploads
# ============================================================================
import requests as _requests
import base64 as _base64

_OBJ_STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
_OBJ_APP_NAME = "yourownprint"
_storage_key: Optional[str] = None


def _init_storage() -> Optional[str]:
    """Call once at startup. Sets module-level storage_key."""
    global _storage_key
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return None
    try:
        resp = _requests.post(f"{_OBJ_STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json().get("storage_key")
        return _storage_key
    except Exception as e:
        logging.getLogger(__name__).error(f"object-storage init failed: {e}")
        return None


def _storage_put(path: str, data: bytes, content_type: str) -> Dict:
    key = _init_storage()
    if not key:
        raise HTTPException(500, "Object storage not configured (EMERGENT_LLM_KEY missing)")
    resp = _requests.put(
        f"{_OBJ_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code >= 400:
        raise HTTPException(500, f"object-storage upload failed: {resp.status_code} {resp.text[:200]}")
    return resp.json()


def _storage_get(path: str) -> Tuple[bytes, str]:
    key = _init_storage()
    if not key:
        raise HTTPException(404, "Object storage not configured")
    resp = _requests.get(
        f"{_OBJ_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code == 404:
        raise HTTPException(404, "File not found")
    if resp.status_code >= 400:
        raise HTTPException(500, f"object-storage fetch failed: {resp.status_code}")
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@app.on_event("startup")
async def _startup_init_storage():
    _init_storage()


# ============================================================================
# Portfolio (admin-curated gallery of past prints)
# ============================================================================

PORTFOLIO_CATEGORIES = [
    "workwear", "team-kits", "leavers", "sports", "fitness", "hospitality",
    "schools", "events", "beauty", "barbering", "other",
    # Carousels / design libraries — same admin CRUD, but consumed by specific pages
    "fight-night-action",
    "leavers-front-designs",
    "leavers-back-designs",
    "leavers-full-front-designs",
]


class PortfolioCreate(BaseModel):
    title: str
    category: str = "other"
    caption: Optional[str] = ""
    alt_text: Optional[str] = ""
    image_data_url: str       # data:image/...;base64,...
    display_order: int = 0
    featured: bool = False


class PortfolioPatch(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    caption: Optional[str] = None
    alt_text: Optional[str] = None
    image_data_url: Optional[str] = None    # provided to replace the image
    display_order: Optional[int] = None
    featured: Optional[bool] = None
    is_hidden: Optional[bool] = None


def _parse_data_url(data_url: str, max_bytes: int = 8_000_000) -> Tuple[bytes, str, str]:
    """Returns (bytes, content_type, ext). Raises HTTPException on invalid input."""
    if not data_url or not data_url.startswith("data:"):
        raise HTTPException(400, "image_data_url must be a data: URL")
    try:
        head, b64 = data_url.split(",", 1)
        content_type = head.split(";")[0].replace("data:", "") or "image/png"
        raw = _base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "invalid data URL")
    if not content_type.startswith("image/"):
        raise HTTPException(400, "image content-type required")
    if len(raw) > max_bytes:
        raise HTTPException(400, f"image too large (max {max_bytes // 1_000_000}MB)")
    ext = content_type.split("/")[-1].split("+")[0]
    return raw, content_type, (ext if ext in {"png", "jpeg", "jpg", "webp", "gif"} else "png")


@api_router.get("/portfolio")
async def list_portfolio(category: Optional[str] = None, featured_only: bool = False, limit: int = 200):
    q: Dict = {"is_hidden": {"$ne": True}}
    if category and category != "all":
        q["category"] = category
    if featured_only:
        q["featured"] = True
    items: List[Dict] = []
    async for d in db.portfolio.find(q).limit(limit):
        items.append({
            "id": d["id"], "title": d.get("title", ""),
            "category": d.get("category", "other"),
            "caption": d.get("caption", ""),
            "alt_text": d.get("alt_text", ""),
            "image_url": d.get("image_url"),
            "display_order": d.get("display_order", 0),
            "featured": bool(d.get("featured", False)),
            "created_at": d.get("created_at"),
        })
    items.sort(key=lambda x: (x["display_order"], x["created_at"] or ""))
    return {"categories": PORTFOLIO_CATEGORIES, "items": items}


@api_router.get("/portfolio/categories")
async def portfolio_categories():
    return PORTFOLIO_CATEGORIES


@api_router.post("/admin/portfolio", dependencies=[Depends(require_admin)])
async def admin_create_portfolio(payload: PortfolioCreate):
    if payload.category not in PORTFOLIO_CATEGORIES:
        raise HTTPException(400, f"unknown category. Allowed: {PORTFOLIO_CATEGORIES}")
    raw, content_type, ext = _parse_data_url(payload.image_data_url)
    item_id = str(uuid.uuid4())
    storage_path = f"{_OBJ_APP_NAME}/portfolio/{item_id}.{ext}"
    image_url: str
    storage_meta: Optional[Dict] = None
    # Try object storage; fall back to inline base64 if it fails (so admin can still upload)
    try:
        storage_meta = _storage_put(storage_path, raw, content_type)
        image_url = f"/api/portfolio/file/{item_id}.{ext}"
    except HTTPException:
        # No storage configured — fall back to inline base64
        image_url = payload.image_data_url
        storage_path = ""
    doc = {
        "id": item_id,
        "title": payload.title.strip()[:120],
        "category": payload.category,
        "caption": (payload.caption or "")[:600],
        "alt_text": (payload.alt_text or payload.title)[:200],
        "image_url": image_url,
        "storage_path": storage_path,
        "storage_meta": storage_meta,
        "content_type": content_type,
        "display_order": int(payload.display_order or 0),
        "featured": bool(payload.featured),
        "is_hidden": False,
        "size_bytes": len(raw),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.portfolio.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.patch("/admin/portfolio/{item_id}", dependencies=[Depends(require_admin)])
async def admin_update_portfolio(item_id: str, payload: PortfolioPatch):
    existing = await db.portfolio.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Portfolio item not found")
    patch: Dict = {}
    for k in ("title", "category", "caption", "alt_text", "display_order", "featured", "is_hidden"):
        v = getattr(payload, k)
        if v is not None:
            if k == "category" and v not in PORTFOLIO_CATEGORIES:
                raise HTTPException(400, f"unknown category. Allowed: {PORTFOLIO_CATEGORIES}")
            patch[k] = v
    if payload.image_data_url:
        raw, content_type, ext = _parse_data_url(payload.image_data_url)
        storage_path = f"{_OBJ_APP_NAME}/portfolio/{item_id}.{ext}"
        try:
            _storage_put(storage_path, raw, content_type)
            patch["image_url"] = f"/api/portfolio/file/{item_id}.{ext}"
            patch["storage_path"] = storage_path
        except HTTPException:
            patch["image_url"] = payload.image_data_url
            patch["storage_path"] = ""
        patch["content_type"] = content_type
        patch["size_bytes"] = len(raw)
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.portfolio.update_one({"id": item_id}, {"$set": patch})
    return {"ok": True}


@api_router.delete("/admin/portfolio/{item_id}", dependencies=[Depends(require_admin)])
async def admin_delete_portfolio(item_id: str):
    res = await db.portfolio.update_one({"id": item_id}, {"$set": {"is_hidden": True, "deleted_at": datetime.now(timezone.utc).isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Portfolio item not found")
    return {"ok": True}


@api_router.get("/admin/portfolio", dependencies=[Depends(require_admin)])
async def admin_list_portfolio():
    items = []
    async for d in db.portfolio.find({}).sort("display_order", 1):
        items.append({
            "id": d["id"], "title": d.get("title", ""),
            "category": d.get("category", "other"),
            "caption": d.get("caption", ""),
            "alt_text": d.get("alt_text", ""),
            "image_url": d.get("image_url"),
            "display_order": d.get("display_order", 0),
            "featured": bool(d.get("featured", False)),
            "is_hidden": bool(d.get("is_hidden", False)),
            "created_at": d.get("created_at"),
            "size_bytes": d.get("size_bytes", 0),
        })
    return items


@api_router.get("/portfolio/file/{filename}")
async def portfolio_file(filename: str):
    # filename = "{uuid}.{ext}"
    item_id = filename.rsplit(".", 1)[0]
    doc = await db.portfolio.find_one({"id": item_id, "is_hidden": {"$ne": True}})
    if not doc or not doc.get("storage_path"):
        raise HTTPException(404, "File not found")
    data, ct = _storage_get(doc["storage_path"])
    return Response(content=data, media_type=doc.get("content_type") or ct)


# ============================================================================
# Site navigation config (admin-editable)
# ============================================================================

DEFAULT_NAV_CONFIG = {
    "version": 1,
    "menu": [
        {
            "key": "shop", "label": "Shop", "to": None,
            "columns": [
                {"heading": "Featured", "links": [
                    {"label": "Your Own Print Specials", "to": "/specials", "badge": "Starter"},
                    {"label": "Kit Your Workforce", "to": "/workforce", "badge": "Bulk"},
                    {"label": "Workwear", "to": "/workwear"},
                    {"label": "Portfolio", "to": "/portfolio"},
                ]},
                {"heading": "By collection", "links": [
                    {"label": "Fight Night Tees", "to": "/fight-night-tee"},
                    {"label": "Leavers' Hoodies", "to": "/leavers-hoodies"},
                    {"label": "Team Kits", "to": "/team-kits"},
                    {"label": "Teams & Schools", "to": "/teams-schools"},
                ]},
                {"heading": "By garment", "links": [
                    {"label": "T-shirts", "to": "/shop/t-shirts"},
                    {"label": "Hoodies", "to": "/shop/hoodies"},
                    {"label": "Polos", "to": "/shop/polos"},
                    {"label": "Sweatshirts", "to": "/shop/sweatshirts"},
                    {"label": "Jackets", "to": "/shop/jackets"},
                    {"label": "Hi-Vis", "to": "/shop/hi-vis"},
                    {"label": "Joggers & Trousers", "to": "/shop/bottoms"},
                    {"label": "Aprons", "to": "/shop/aprons"},
                    {"label": "Shorts", "to": "/shop/shorts"},
                    {"label": "Accessories", "to": "/shop/accessories"},
                ]},
            ],
        },
        {
            "key": "teams", "label": "Sports & Fitness", "to": None,
            "columns": [
                {"heading": "Sports", "links": [
                    {"label": "Football Kits", "to": "/sports-teams/football"},
                    {"label": "Rugby Kits", "to": "/sports-teams/rugby"},
                    {"label": "Team Kits configurator", "to": "/team-kits"},
                ]},
                {"heading": "Fitness", "links": [
                    {"label": "Gyms", "to": "/sports-teams/gyms"},
                    {"label": "Personal Trainers", "to": "/sports-teams/personal-trainers"},
                    {"label": "Boxing Gyms", "to": "/sports-teams/boxing-gyms"},
                    {"label": "Thai Boxing", "to": "/sports-teams/thai-boxing"},
                    {"label": "Kickboxing", "to": "/sports-teams/kick-boxing"},
                    {"label": "Dance Studios", "to": "/sports-teams/dance-studios"},
                ]},
                {"heading": "Schools & Leavers", "links": [
                    {"label": "Teams & Schools", "to": "/teams-schools"},
                    {"label": "Leavers' Hoodies", "to": "/leavers-hoodies"},
                    {"label": "Fight Night Tees", "to": "/fight-night-tee"},
                ]},
            ],
        },
        {
            "key": "industries", "label": "Workwear", "to": None,
            "columns": [
                {"heading": "Trades & Site", "links": [
                    {"label": "Construction & Trades", "to": "/industries/construction-trades"},
                    {"label": "Industrial", "to": "/industries/industrial"},
                    {"label": "Cleaning & Maintenance", "to": "/industries/cleaning"},
                    {"label": "Kit Your Workforce", "to": "/workforce", "badge": "Bulk"},
                ]},
                {"heading": "Front-of-house", "links": [
                    {"label": "Healthcare", "to": "/industries/healthcare"},
                    {"label": "Hospitality & Catering", "to": "/industries/hospitality-catering"},
                    {"label": "Retail", "to": "/industries/retail"},
                    {"label": "Beauty & Wellness", "to": "/industries/beauty-wellness"},
                ]},
                {"heading": "Office & Field", "links": [
                    {"label": "Corporate", "to": "/industries/corporate"},
                    {"label": "Security", "to": "/industries/security"},
                    {"label": "Sports & Fitness", "to": "/industries/sports-fitness"},
                    {"label": "All Industries →", "to": "/industries"},
                ]},
            ],
        },
        {"key": "portfolio", "label": "Portfolio", "to": "/portfolio"},
        {"key": "design", "label": "Design Your Own", "to": "/design"},
        {"key": "contact", "label": "Get a quote", "to": "/contact", "cta": True},
    ],
}


@api_router.get("/navigation")
async def get_navigation():
    doc = await db.settings.find_one({"key": "navigation_config"})
    if doc and doc.get("config"):
        return doc["config"]
    return DEFAULT_NAV_CONFIG


@api_router.patch("/admin/navigation", dependencies=[Depends(require_admin)])
async def update_navigation(payload: Dict):
    config = payload.get("config")
    if not isinstance(config, dict) or not isinstance(config.get("menu"), list):
        raise HTTPException(400, "config.menu must be a list")
    # light validation
    for item in config["menu"]:
        if "key" not in item or "label" not in item:
            raise HTTPException(400, "each menu item needs key + label")
        if "columns" in item:
            for col in item["columns"]:
                if "links" not in col or not isinstance(col["links"], list):
                    raise HTTPException(400, "column.links must be a list")
                for lnk in col["links"]:
                    if "label" not in lnk or "to" not in lnk:
                        raise HTTPException(400, "link needs label + to")
    config["version"] = int(config.get("version", 1)) + 1
    await db.settings.update_one(
        {"key": "navigation_config"},
        {"$set": {"key": "navigation_config", "config": config,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "version": config["version"]}


@api_router.post("/admin/navigation/reset", dependencies=[Depends(require_admin)])
async def reset_navigation():
    await db.settings.update_one(
        {"key": "navigation_config"},
        {"$set": {"key": "navigation_config", "config": DEFAULT_NAV_CONFIG,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


# ============================================================================
# Integration keys (admin manages from /admin/integrations)
# ============================================================================

INTEGRATION_KEYS = {
    "stripe_api_key": {"label": "Stripe Secret Key", "kind": "secret", "env": "STRIPE_API_KEY",
                       "help": "From https://dashboard.stripe.com/apikeys — Secret key (sk_live_... or sk_test_...)"},
    "resend_api_key": {"label": "Resend API Key", "kind": "secret", "env": "RESEND_API_KEY",
                       "help": "From https://resend.com/api-keys — used for transactional emails (quotes, reviews)."},
    "removebg_api_key": {"label": "remove.bg API Key", "kind": "secret", "env": "REMOVEBG_API_KEY",
                         "help": "From https://www.remove.bg/api — background removal in Design Your Own."},
    "cutoutpro_api_key": {"label": "Cutout.pro API Key", "kind": "secret", "env": "CUTOUTPRO_API_KEY",
                         "help": "From https://www.cutout.pro/api — AI image effects (sketch, poster)."},
    "judgeme_shop_token": {"label": "Judge.me Shop Token", "kind": "secret", "env": "JUDGEME_SHOP_TOKEN",
                            "help": "From your Judge.me dashboard — used to import reviews."},
    "whatsapp_number": {"label": "WhatsApp Number (E.164)", "kind": "text", "env": "WHATSAPP_NUMBER",
                         "help": "e.g. +447xxxxxxxxx — appears site-wide and on Get-a-Quote."},
    "contact_email": {"label": "Contact / Reply-to Email", "kind": "text", "env": "CONTACT_EMAIL",
                       "help": "Where quote requests and bespoke leavers' enquiries are emailed."},
}


def _mask_secret(val: Optional[str]) -> str:
    if not val:
        return ""
    if len(val) <= 8:
        return "•" * len(val)
    return val[:4] + "•" * 6 + val[-4:]


@api_router.get("/admin/integrations", dependencies=[Depends(require_admin)])
async def list_integrations():
    doc = await db.settings.find_one({"key": "integration_keys"}) or {}
    saved = doc.get("values") or {}
    out = []
    for k, meta in INTEGRATION_KEYS.items():
        env_val = os.environ.get(meta["env"]) or ""
        db_val = saved.get(k) or ""
        effective = db_val or env_val
        out.append({
            "key": k,
            "label": meta["label"],
            "kind": meta["kind"],
            "help": meta["help"],
            "env_var": meta["env"],
            "is_set": bool(effective),
            "source": "db" if db_val else ("env" if env_val else "none"),
            "masked": _mask_secret(effective) if meta["kind"] == "secret" else effective,
        })
    return out


@api_router.patch("/admin/integrations", dependencies=[Depends(require_admin)])
async def update_integrations(payload: Dict):
    values = payload.get("values") or {}
    if not isinstance(values, dict):
        raise HTTPException(400, "values must be an object")
    doc = await db.settings.find_one({"key": "integration_keys"}) or {}
    saved = doc.get("values") or {}
    for k, v in values.items():
        if k not in INTEGRATION_KEYS:
            raise HTTPException(400, f"unknown integration key: {k}")
        if v == "" or v is None:
            saved.pop(k, None)
        else:
            saved[k] = str(v).strip()
    await db.settings.update_one(
        {"key": "integration_keys"},
        {"$set": {"key": "integration_keys", "values": saved,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    # Hot-apply Stripe key + WhatsApp number for the running process
    global STRIPE_API_KEY
    if "stripe_api_key" in values and values["stripe_api_key"]:
        STRIPE_API_KEY = values["stripe_api_key"]
    return {"ok": True}


async def _get_integration_value(key: str) -> Optional[str]:
    """Resolve a key from DB (preferred) or env (fallback)."""
    doc = await db.settings.find_one({"key": "integration_keys"})
    if doc:
        v = (doc.get("values") or {}).get(key)
        if v:
            return v
    meta = INTEGRATION_KEYS.get(key)
    if meta:
        return os.environ.get(meta["env"])
    return None


@api_router.get("/site/whatsapp")
async def get_site_whatsapp():
    """Public — returns the configured WhatsApp number so frontend can use it."""
    number = await _get_integration_value("whatsapp_number")
    return {"number": number or ""}


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


# ---- Default product-meta seed (non-destructive: only fills empty fields) ----
def _classify_garment(product: Dict) -> str:
    pid = product["id"].lower()
    name = product["name"].lower()
    if "short" in pid or "short" in name:
        return "shorts"
    if "jacket" in pid or "jacket" in name or "varsity" in pid:
        return "jacket"
    if "vest" in pid or "vest" in name:
        return "vest"
    if "polo" in pid or "polo" in name:
        return "polo"
    if "tracksuit" in pid:
        return "tracksuit"
    if "hoodie" in pid or "hoodie" in name or "pullover" in pid:
        return "hoodie"
    if "sweatshirt" in pid or "crewneck" in pid:
        return "sweatshirt"
    if "jersey" in pid or "rugby" in pid or "football" in pid or "cycling" in pid or "hockey" in pid:
        return "jersey"
    if "bag" in pid or "drawstring" in pid:
        return "bag"
    if "bundle" in pid or "squad-pack" in pid or "training-pack" in pid:
        return "bundle"
    return "tee"


# UK adult sizing in cm (chest, length, sleeve, waist, inseam) — DTF garment averages.
_SIZE_TABLE_TEMPLATES = {
    "tee":        [{"chest": 91},  {"chest": 96},  {"chest": 101}, {"chest": 106}, {"chest": 111}, {"chest": 121}, {"chest": 131}, {"chest": 141}],
    "polo":       [{"chest": 91},  {"chest": 96},  {"chest": 101}, {"chest": 106}, {"chest": 111}, {"chest": 121}, {"chest": 131}, {"chest": 141}],
    "vest":       [{"chest": 96},  {"chest": 101}, {"chest": 106}, {"chest": 111}],
    "jersey":     [{"chest": 91},  {"chest": 96},  {"chest": 101}, {"chest": 106}, {"chest": 111}, {"chest": 121}],
    "hoodie":     [{"chest": 96, "sleeve": 64},  {"chest": 101, "sleeve": 65}, {"chest": 106, "sleeve": 66}, {"chest": 111, "sleeve": 67}, {"chest": 121, "sleeve": 68}, {"chest": 131, "sleeve": 69}],
    "sweatshirt": [{"chest": 96, "sleeve": 64},  {"chest": 101, "sleeve": 65}, {"chest": 106, "sleeve": 66}, {"chest": 111, "sleeve": 67}, {"chest": 121, "sleeve": 68}, {"chest": 131, "sleeve": 69}],
    "jacket":     [{"chest": 96, "sleeve": 64},  {"chest": 101, "sleeve": 65}, {"chest": 106, "sleeve": 66}, {"chest": 111, "sleeve": 67}, {"chest": 121, "sleeve": 68}],
    "shorts":     [{"waist": 71, "inseam": 25}, {"waist": 76, "inseam": 26}, {"waist": 81, "inseam": 27}, {"waist": 86, "inseam": 28}, {"waist": 91, "inseam": 29}],
    "tracksuit":  [{"chest": 96, "waist": 76}, {"chest": 101, "waist": 81}, {"chest": 106, "waist": 86}, {"chest": 111, "waist": 91}, {"chest": 121, "waist": 96}],
}

_TEE_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"]
_SIZE_LABELS = {
    "tee": _TEE_SIZES, "polo": _TEE_SIZES,
    "vest": ["S", "M", "L", "XL"],
    "jersey": ["XS", "S", "M", "L", "XL", "XXL"],
    "hoodie": ["XS", "S", "M", "L", "XL", "XXL"],
    "sweatshirt": ["XS", "S", "M", "L", "XL", "XXL"],
    "jacket": ["S", "M", "L", "XL", "XXL"],
    "shorts": ["S", "M", "L", "XL", "XXL"],
    "tracksuit": ["S", "M", "L", "XL", "XXL"],
}


def _default_size_guide(product: Dict) -> Optional[List[Dict]]:
    garment_type = _classify_garment(product)
    rows_tpl = _SIZE_TABLE_TEMPLATES.get(garment_type)
    if not rows_tpl:
        return None
    labels = _SIZE_LABELS.get(garment_type, _TEE_SIZES)
    # Match length to whichever is shorter (avoid IndexError)
    n = min(len(rows_tpl), len(labels))
    rows: List[Dict] = []
    for i in range(n):
        row = {"size": labels[i]}
        row.update(rows_tpl[i])
        # Add length proportional to chest where applicable
        if "chest" in row and "length" not in row:
            base_length = 66 if garment_type in ("tee", "polo", "vest") else 70
            row["length"] = base_length + (i * 2)
        rows.append(row)
    return rows


def _default_description(product: Dict) -> str:
    garment_type = _classify_garment(product)
    name = product["name"]
    composition = product.get("composition") or ""
    brand = product.get("brand") or "Your Own Print"
    type_blurb = {
        "tee": f"A go-to {name.lower()} you'll reach for week after week. Soft handfeel, reinforced shoulder seams and a UK-printed DTF transfer that won't crack, peel or fade.",
        "polo": f"Smart-casual {name.lower()} built to look the part in client meetings and on-site. Self-fabric collar, twin-needle stitching at the hem.",
        "vest": f"High-vis {name.lower()} engineered for trade and warehouse use. Reflective banding plus an unmissable colourway keep your crew seen on every shift.",
        "jersey": f"Match-day {name.lower()} cut for movement. Breathable moisture-wicking knit, raglan sleeves and an athletic fit.",
        "hoodie": f"Premium-weight {name.lower()} that's earned its place as our most-printed garment. Brushed-back fleece, kangaroo pocket, ribbed cuffs and hem.",
        "sweatshirt": f"Classic crewneck {name.lower()} with a soft brushed inside. Roomy enough to layer, sharp enough to wear solo.",
        "jacket": f"All-weather {name.lower()} engineered for British conditions. Wind-resistant outer, fleece-backed liner, YKK zip.",
        "shorts": f"Performance {name.lower()} cut for full range of motion. Elasticated waistband with drawcord, anti-bunch panelling.",
        "tracksuit": f"Two-piece {name.lower()} for warm-ups, travel days and post-match recovery.",
        "bag": f"Lightweight {name.lower()} — printed front, perfect leavers' takeaway or team gym bag.",
        "bundle": f"Pre-built {name.lower()} — everything your squad needs to take to the pitch in one box.",
    }.get(garment_type, f"A {name.lower()} printed in the UK using DTF — durable transfers that survive hot washes and tumble-dries.")

    parts = [type_blurb]
    if composition:
        parts.append(f"\n\nFabric: {composition}.")
    parts.append("\n\nPrinted in-house in the UK using our DTF (Direct to Film) process — flexible, full-colour and hard-wearing. Wash inside-out at 30°C, do not iron directly over print.")
    if brand and brand != "Your Own Print":
        parts.append(f"\n\nGarment by: {brand}.")
    return "".join(parts)


@app.on_event("startup")
async def _seed_specials_defaults():
    """One-time seed: flag a sensible starter lineup as Specials-eligible (left-breast only)."""
    try:
        marker = await db.settings.find_one({"key": "specials_seed_v2"})
        if marker is not None:
            return
        defaults = ["workwear-tshirt", "polo-shirt", "workwear-sweatshirt", "personalised-tee", "personalised-hoodie", "hi-vis-vest"]
        for pid in defaults:
            if pid in PRODUCTS:
                await db.product_meta.update_one(
                    {"product_id": pid},
                    {"$set": {"product_id": pid, "specials_eligible": True,
                              "allowed_placements": ["left-breast"],
                              "updated_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )
                PRODUCTS[pid]["specials_eligible"] = True
                PRODUCTS[pid]["allowed_placements"] = ["left-breast"]
        await db.settings.update_one(
            {"key": "specials_seed_v2"},
            {"$set": {"key": "specials_seed_v2", "ran_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    except Exception as e:
        print(f"specials seed failed: {e}")


@app.on_event("startup")
async def _seed_industry_tags_defaults():
    """One-time seed: assign sensible industry tags + gender_fit to existing catalogue."""
    try:
        marker = await db.settings.find_one({"key": "industry_seed_v2"})
        if marker is not None:
            return
        # Maps of product_id → industry_tags / gender_fit defaults
        industry_map = {
            "workwear-tshirt":     ["construction-trades", "industrial", "cleaning", "trades", "construction", "logistics"],
            "workwear-sweatshirt": ["construction-trades", "industrial", "cleaning", "trades", "logistics"],
            "workwear-jacket":     ["construction-trades", "industrial", "logistics", "trades", "construction"],
            "workwear-trousers":   ["construction-trades", "industrial", "trades", "construction"],
            "hi-vis-vest":         ["construction-trades", "industrial", "security", "trades", "construction", "logistics"],
            "polo-shirt":          ["hospitality-catering", "healthcare", "beauty-wellness", "retail", "corporate", "security", "cleaning", "hospitality", "beauty", "hair-beauty", "fitness"],
            "personalised-tee":    ["hospitality-catering", "beauty-wellness", "retail", "sports-fitness", "hospitality", "beauty", "hair-beauty", "fitness"],
            "personalised-hoodie": ["sports-fitness", "beauty-wellness", "retail", "corporate", "fitness", "beauty", "hair-beauty"],
            "bib-apron":           ["hospitality-catering", "beauty-wellness", "retail", "hospitality", "beauty", "hair-beauty"],
            "waist-apron":         ["hospitality-catering", "retail", "hospitality"],
            "denim-apron":         ["beauty-wellness", "hospitality-catering", "retail", "hair-beauty", "beauty"],
            "joggers":             ["sports-fitness", "corporate", "fitness"],
            "performance-leggings":["sports-fitness", "fitness"],
            "gym-shorts":          ["sports-fitness", "fitness"],
        }
        for pid, tags in industry_map.items():
            if pid in PRODUCTS:
                await db.product_meta.update_one(
                    {"product_id": pid},
                    {"$set": {"product_id": pid, "industry_tags": tags,
                              "gender_fit": "unisex",
                              "updated_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )
                PRODUCTS[pid]["industry_tags"] = tags
                PRODUCTS[pid]["gender_fit"] = "unisex"
        # Default everything else to unisex too (so filter pills work)
        for pid, p in PRODUCTS.items():
            if not p.get("gender_fit"):
                await db.product_meta.update_one(
                    {"product_id": pid},
                    {"$set": {"product_id": pid, "gender_fit": "unisex",
                              "updated_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )
                PRODUCTS[pid]["gender_fit"] = "unisex"
        await db.settings.update_one(
            {"key": "industry_seed_v2"},
            {"$set": {"key": "industry_seed_v2", "ran_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    except Exception as e:
        print(f"industry seed failed: {e}")


@app.on_event("startup")
async def _seed_leavers_templates():
    try:
        existing = await db.leavers_templates.count_documents({})
        if existing == 0:
            for t in DEFAULT_LEAVERS_TEMPLATES:
                await db.leavers_templates.insert_one({**t, "created_at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        print(f"leavers templates seed failed: {e}")


@app.on_event("startup")
async def _seed_default_product_meta():
    """Non-destructive: only fills empty/None fields. Admin overrides remain untouched.
    Includes a one-time blanket 'bulk pricing on' pass guarded by settings.product_meta_seed_v1."""
    try:
        marker = await db.settings.find_one({"key": "product_meta_seed_v1"})
        first_run = marker is None
        for pid, p in PRODUCTS.items():
            existing = await db.product_meta.find_one({"product_id": pid}) or {}
            patch: Dict = {}

            if not existing.get("description_full") and not p.get("description_full"):
                patch["description_full"] = _default_description(p)

            if not existing.get("size_guide_table") and not p.get("size_guide_table"):
                sg = _default_size_guide(p)
                if sg:
                    patch["size_guide_table"] = sg

            # One-time blanket enable of bulk pricing (admins can disable per-product after).
            if first_run and not existing.get("bulk_pricing_enabled") and not p.get("bulk_pricing_enabled"):
                patch["bulk_pricing_enabled"] = True

            if patch:
                patch["product_id"] = pid
                patch["updated_at"] = datetime.now(timezone.utc).isoformat()
                await db.product_meta.update_one({"product_id": pid}, {"$set": patch}, upsert=True)
                for k, v in patch.items():
                    if k not in ("product_id", "updated_at"):
                        PRODUCTS[pid][k] = v

        if first_run:
            await db.settings.update_one(
                {"key": "product_meta_seed_v1"},
                {"$set": {"key": "product_meta_seed_v1", "ran_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
    except Exception as e:
        print(f"product-meta seed failed: {e}")


# Kit bundle categorisation — used by the PDP to swap UI (e.g. hide back-print options on
# front-only bundles) and by admin listings. Keeps things declarative.
FRONT_ONLY_BUNDLE_IDS = {
    "football-kit-front-only", "football-premium-front-only",
    "rugby-kit-front-only", "training-pack-front-only",
}


@app.on_event("startup")
async def _seed_front_only_bundle_placements():
    """One-time seed: locks all *-front-only kit bundles to front placements only —
    no back-print, no back-name/number. Admin overrides win afterwards."""
    try:
        marker = await db.settings.find_one({"key": "front_only_placements_seed_v1"})
        if marker is not None:
            return
        FRONT_ONLY_PLACEMENTS = ["left-breast", "right-breast", "full-front", "left-sleeve", "right-sleeve"]
        for pid in FRONT_ONLY_BUNDLE_IDS:
            if pid not in PRODUCTS:
                continue
            existing = await db.product_meta.find_one({"product_id": pid}) or {}
            if existing.get("allowed_placements"):
                # Admin already set explicit placements — respect that.
                continue
            await db.product_meta.update_one(
                {"product_id": pid},
                {"$set": {
                    "product_id": pid,
                    "allowed_placements": FRONT_ONLY_PLACEMENTS,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
            PRODUCTS[pid]["allowed_placements"] = FRONT_ONLY_PLACEMENTS
        await db.settings.update_one(
            {"key": "front_only_placements_seed_v1"},
            {"$set": {"key": "front_only_placements_seed_v1", "ran_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    except Exception as e:
        print(f"front-only placements seed failed: {e}")


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
