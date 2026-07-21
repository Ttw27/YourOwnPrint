from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends, Response, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne
import os
import asyncio
import re
import random
import hashlib
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Tuple, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

from services.stripe_checkout import (
    create_checkout_session,
    get_checkout_status,
    construct_webhook_event,
)
import stripe as _stripe_sdk

# Shared runtime lives in deps.py — mongo client, api_router, auth deps,
# integration key resolver. All router modules import from there so this
# file can stay focused on catalogue seed data + startup handlers.
from deps import (
    ROOT_DIR, client, db,
    STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, JWT_SECRET, JWT_ALGORITHM, ADMIN_EMAIL, ADMIN_PASSWORD,
    _hash_password, _verify_password, _create_access_token,
    get_current_admin, require_admin,
    api_router, _get_integration_value,
)


app = FastAPI()

# ---------- Server-side product catalogue (prices NEVER taken from frontend) ----------
PRODUCTS: Dict[str, Dict] = {
    "personalised-tee": {
        "id": "personalised-tee",
        "name": "Personalised T-Shirt",
        "price": 6.99,
        "category": "t-shirts",
        "is_bestseller": True,
        "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg",
        "description": "Gildan SoftStyle 100% cotton. Upload your photo, logo or text.",
    },
    "personalised-hoodie": {
        "id": "personalised-hoodie",
        "name": "Personalised Hoodie",
        "price": 14.99,
        "category": "hoodies",
        "is_bestseller": True,
        "image": "https://images.pexels.com/photos/8217544/pexels-photo-8217544.jpeg",
        "description": "Gildan Heavy Blend Hooded Sweatshirt. Free logo print included.",
    },
    "kids-tee": {
        "id": "kids-tee",
        "name": "Kids T-Shirt",
        "price": 7.99,
        "category": "kids-baby",
        "is_bestseller": True,
        "image": "https://images.pexels.com/photos/31977041/pexels-photo-31977041.jpeg",
        "description": "Soft Gildan Youth tee. Perfect for schools, leavers & teams.",
    },
    "polo-shirt": {
        "id": "polo-shirt",
        "name": "Pique Polo Shirt",
        "price": 8.99,
        "category": "polos",
        "is_bestseller": True,
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
    "sports-team-bundle": {
        "id": "sports-team-bundle", "name": "Sports Team Kit Bundle", "price": 21.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/1618200/pexels-photo-1618200.jpeg",
        "description": "Generic sports team kit bundle — pick a brand from the variant list (Nike / AWD / Umbro) and we'll build your club's set to spec.",
    },

    # ----- Full Squad Configurator "set" slots -----
    # These act as bundle IDs for admin-managed brand variants. Each represents a whole set
    # (shirt + shorts + socks / hoodie + joggers / etc). Not sold as individual SKUs — they're
    # entry points for /full-squad-configurator and /sports-outfit-configurator.
    "full-squad-match-day": {
        "id": "full-squad-match-day", "name": "Match Day Set", "price": 34.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg",
        "description": "Complete match-day set — shirt, shorts and socks. Names + numbers on the back included. Pick your brand and colours.",
    },
    "full-squad-training": {
        "id": "full-squad-training", "name": "Training Set", "price": 24.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/6740803/pexels-photo-6740803.jpeg",
        "description": "Complete training set — top, shorts and socks. Clean front badge print. Pick your brand and colours.",
    },
    "full-squad-tracksuit": {
        "id": "full-squad-tracksuit", "name": "Tracksuit Set", "price": 39.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/6740053/pexels-photo-6740053.jpeg",
        "description": "Full tracksuit — hoodie/jacket and joggers. Match-day arrival, warm-up, or squad travel wear.",
    },
    "sports-outfit-training": {
        "id": "sports-outfit-training", "name": "Training Kit (top + shorts)", "price": 19.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/6551070/pexels-photo-6551070.jpeg",
        "description": "Simple training kit for gyms, PTs and combat sports — top and shorts, no socks. Add breast, back or full-front print.",
    },
    "sports-outfit-tracksuit": {
        "id": "sports-outfit-tracksuit", "name": "Tracksuit (hoodie + joggers)", "price": 34.99, "category": "team-kits",
        "image": "https://images.pexels.com/photos/6740053/pexels-photo-6740053.jpeg",
        "description": "Comfortable tracksuit set for gyms, PTs and combat sports — hoodie and joggers. Add breast, back or full-front print.",
    },
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
        "id": "joggers", "name": "Branded Joggers", "price": 19.99, "category": "bottoms", "is_bestseller": True,
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
    # Sports team generic bundle
    "sports-team-bundle":          {"colors": COLOURS_GARMENT, "sizes": KIDS_SIZES + DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    # Full Squad Configurator "set" slots
    "full-squad-match-day":        {"colors": COLOURS_GARMENT, "sizes": KIDS_SIZES + DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "full-squad-training":         {"colors": COLOURS_GARMENT, "sizes": KIDS_SIZES + DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "full-squad-tracksuit":        {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "sports-outfit-training":      {"colors": COLOURS_GARMENT, "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
    "sports-outfit-tracksuit":     {"colors": COLOURS_HOODIE,  "sizes": DEFAULT_SIZES, "size_upcharges": DEFAULT_SIZE_UPCHARGES},
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
    {"id": "left-pocket",  "label": "Below left pocket",  "price": 2.00, "excludes": []},
    {"id": "right-pocket", "label": "Below right pocket", "price": 2.00, "excludes": []},
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
# A review about the shop as a whole rather than one garment. Reserved product
# id, so a store review is just a review with a special product_id and needs no
# separate collection or code path.
STORE_REVIEW_ID = "store"

# Reviews written before moderation existed have no `approved` field at all, so
# the test is "not explicitly rejected" rather than "explicitly approved" —
# otherwise every historic review would vanish the moment this deployed.
APPROVED_ONLY = {"approved": {"$ne": False}}


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
    approved: bool = True  # defaults True so pre-moderation records serialise fine
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
    attachments: Optional[List[Dict]] = None  # [{id, url, filename, purpose}, ...] from /api/uploads/artwork
    roster: Optional[List[Dict]] = None  # [{name, number, size, qty}, ...]
    product_id: Optional[str] = None


def _photo_ok(s: str) -> bool:
    return isinstance(s, str) and s.startswith("data:image/") and len(s) < 1_500_000  # < ~1.5MB


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Your Own Print API"}


SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://your-own-print.vercel.app")


@api_router.get("/sitemap.xml")
async def sitemap_xml():
    """Dynamically generated sitemap — includes every product, collection,
    and industry page currently live, so it never goes stale as the
    catalogue grows or changes. Served at the real /sitemap.xml via a
    Vercel rewrite (see frontend/vercel.json)."""
    urls = [
        ("/", "1.0", "daily"),
        ("/workwear", "0.9", "daily"),
        ("/sports-fitness", "0.8", "weekly"),
        ("/team-kits", "0.8", "weekly"),
        ("/specials", "0.7", "weekly"),
        ("/design", "0.7", "weekly"),
        ("/industries", "0.7", "weekly"),
        ("/reviews", "0.5", "weekly"),
    ]
    for t in GARMENT_TYPE_CATALOGUE:
        urls.append((f"/shop/{t['slug']}", "0.8", "daily"))
    for i in INDUSTRIES_CATALOGUE:
        if not i.get("alias_of"):  # skip aliases, only canonical pages
            urls.append((f"/industries/{i['slug']}", "0.7", "weekly"))
    for pid, p in PRODUCTS.items():
        if p.get("active", True):
            urls.append((f"/product/{pid}", "0.6", "weekly"))

    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, priority, freq in urls:
        loc = f"{SITE_BASE_URL}{path}"
        xml_parts.append(f"<url><loc>{loc}</loc><changefreq>{freq}</changefreq><priority>{priority}</priority></url>")
    xml_parts.append("</urlset>")
    return Response(content="".join(xml_parts), media_type="application/xml")


@api_router.get("/robots.txt")
async def robots_txt():
    content = f"User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: {SITE_BASE_URL}/sitemap.xml\n"
    return Response(content=content, media_type="text/plain")


@api_router.get("/products/best-sellers")
async def best_sellers(limit: int = 12):
    """Manually-flagged best sellers first, topped up with one representative
    product per garment category so the homepage always shows a genuine
    spread of the catalogue — rather than being frozen at whatever's been
    manually flagged, which is especially important on a catalogue this size."""
    flagged = [p for p in PRODUCTS.values() if p.get("is_bestseller") and p.get("active", True)]
    flagged.sort(key=lambda x: x.get("name", ""))
    picks = list(flagged)
    seen_ids = {p["id"] for p in picks}
    seen_categories = {p["category"] for p in picks}

    if len(picks) < limit:
        by_category: Dict[str, Dict] = {}
        for p in PRODUCTS.values():
            if p["id"] in seen_ids or not p.get("active", True):
                continue
            cat = p["category"]
            if cat in seen_categories:
                continue
            # Keep the first one seen per category — good enough for a diverse spread.
            if cat not in by_category:
                by_category[cat] = p
        for cat, p in by_category.items():
            if len(picks) >= limit:
                break
            picks.append(p)
            seen_categories.add(cat)

    items = [{
        "id": p["id"], "name": p["name"], "price": float(p["price"]),
        "image": p["image"], "category": p["category"],
    } for p in picks[:limit]]
    return {"items": items, "total": len(items)}


@api_router.get("/search")
async def search_products(q: str = "", limit: int = 25, offset: int = 0):
    """Site-wide product search by name/brand — powers the header search bar."""
    query = (q or "").strip().lower()
    if not query:
        return {"items": [], "total": 0, "offset": offset, "returned": 0, "query": q}

    def matches(p: Dict) -> bool:
        hay = f"{p.get('name', '')} {p.get('brand', '') or p.get('_brand', '')}".lower()
        return query in hay

    results = [p for p in PRODUCTS.values() if matches(p)]
    # Names that start with the query rank above names that merely contain it.
    results.sort(key=lambda p: (0 if p.get("name", "").lower().startswith(query) else 1, p.get("name", "")))
    total = len(results)
    limit = min(limit, 100)
    page = results[offset:offset + limit]
    items = [{
        "id": p["id"], "name": p["name"], "price": float(p["price"]),
        "image": p["image"], "category": p["category"],
    } for p in page]
    return {"items": items, "total": total, "offset": offset, "returned": len(items), "query": q}


@api_router.get("/products")
async def list_products(category: Optional[str] = None, industries: Optional[str] = None, gender_fit: Optional[str] = None, limit: int = 500, offset: int = 0):
    """`industries` is an optional comma-separated list of industry tags (e.g.
    "trades,construction,cleaning"). When both `category` and `industries` are
    given, a product matches if it satisfies EITHER — this is what lets a page
    like /workwear show both the original hand-built "workwear" category
    products AND any imported product (t-shirts, polos, jackets, etc.) tagged
    as relevant to trade/construction/cleaning work, rather than requiring
    every product to literally have category="workwear"."""
    # Fold the requested slugs too, so /industries/trades matches products
    # stored as construction-trades.
    industry_list = canonical_industries((industries or "").split(","))

    def matches(p):
        cat_ok = bool(category) and p["category"] == category
        ind_ok = bool(industry_list) and any(t in canonical_industries(p.get("industry_tags")) for t in industry_list)
        if category and industry_list:
            return cat_ok or ind_ok
        if category:
            return cat_ok
        if industry_list:
            return ind_ok
        return True

    items = [p for p in PRODUCTS.values() if matches(p)]
    if gender_fit and gender_fit != "all":
        items = [p for p in items if (p.get("gender_fit") or "unisex") == gender_fit]
    total = len(items)
    limit = min(limit, 1000)
    page = items[offset:offset + limit]
    return {"items": page, "total": total, "offset": offset, "returned": len(page)}


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Product not found")
    return PRODUCTS[product_id]


@api_router.post("/contact")
async def submit_contact(payload: ContactRequest):
    record = ContactRecord(**payload.model_dump())
    await db.contact_submissions.insert_one(record.model_dump())
    # Fire Resend notification to the shop — non-blocking. Failures don't affect the response.
    try:
        shop_to = await _shop_notification_recipient()
        if shop_to:
            body = _email_wrap(
                f"New quote enquiry — {payload.name}",
                f"""
                <p><strong>{payload.name}</strong> {'(' + payload.company + ')' if payload.company else ''} has submitted the /contact form.</p>
                <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-top:8px">
                  <tr><td style="color:#4b5563"><strong>Email</strong></td><td>{payload.email}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Phone</strong></td><td>{payload.phone or '—'}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Sector</strong></td><td>{payload.sector or '—'}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Est. qty</strong></td><td>{payload.quantity or '—'}</td></tr>
                  <tr><td style="color:#4b5563" valign="top"><strong>Message</strong></td><td>{(payload.message or '—').replace(chr(10),'<br>')}</td></tr>
                </table>
                """,
            )
            await _send_email(to=[shop_to], subject=f"[Quote] {payload.name} — {payload.company or 'no company'}",
                              html=body, reply_to=payload.email)
    except Exception as e:
        logging.warning(f"contact email dispatch skipped: {e}")
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
    product_id: str  # links to one of the team-kits products OR a full-squad "set" slot
    brand: str
    name: str
    price: float
    image: Optional[str] = ""
    description: Optional[str] = ""
    active: bool = True
    # New optional fields for the Full Squad + Sports Outfit configurators
    colours: Optional[List[Dict]] = None       # [{name, hex}, ...] — kit colour choices per variant
    sizes: Optional[List[str]] = None          # available body sizes (overrides product default when set)
    sock_sizes: Optional[List[str]] = None     # per-variant sock size options (falls back to global settings)
    size_guide: Optional[str] = ""              # free-form markdown/table shown in dropdown
    included_items: Optional[List[str]] = None  # e.g. ["Shirt", "Shorts", "Socks"] — displayed on the tile
    display_order: Optional[int] = 0


@api_router.get("/team-kit-brands")
async def list_brands(product_id: Optional[str] = None):
    q = {"active": True}
    if product_id:
        q["product_id"] = product_id
    out = []
    _fields = ["id", "product_id", "brand", "name", "price", "image", "description", "active",
               "colours", "sizes", "sock_sizes", "size_guide", "included_items", "display_order"]
    async for d in db.team_kit_brands.find(q).sort([("display_order", 1), ("price", 1)]):
        out.append({k: d.get(k) for k in _fields})
    return out


@api_router.post("/team-kit-brands", dependencies=[Depends(require_admin)])
async def create_brand(payload: TeamKitBrand):
    if payload.product_id not in PRODUCTS:
        raise HTTPException(400, "Unknown product_id")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    # Support data-URL images — persist to object storage and swap in a stable URL
    if doc.get("image") and doc["image"].startswith("data:"):
        try:
            raw, content_type, ext = _parse_data_url(doc["image"])
            storage_path = f"{_OBJ_APP_NAME}/team-kit-brands/{doc['id']}.{ext}"
            _storage_put(storage_path, raw, content_type)
            doc["image"] = f"/api/portfolio/file/{doc['id']}.{ext}"
            await db.portfolio.insert_one({
                "id": doc["id"], "title": f"{payload.brand} {payload.name}".strip(),
                "category": "other", "image_url": doc["image"], "storage_path": storage_path,
                "content_type": content_type, "size_bytes": len(raw),
                "display_order": 9999, "featured": False, "is_hidden": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except HTTPException:
            pass    # fall back to inline data URL
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.team_kit_brands.insert_one(doc)
    _fields = ["id", "product_id", "brand", "name", "price", "image", "description", "active",
               "colours", "sizes", "sock_sizes", "size_guide", "included_items", "display_order"]
    return {k: doc.get(k) for k in _fields}


@api_router.put("/team-kit-brands/{brand_id}", dependencies=[Depends(require_admin)])
async def update_brand(brand_id: str, payload: TeamKitBrand):
    update = {k: v for k, v in payload.model_dump().items() if k != "id"}
    # Data-URL image → object storage
    if update.get("image") and update["image"].startswith("data:"):
        try:
            raw, content_type, ext = _parse_data_url(update["image"])
            storage_path = f"{_OBJ_APP_NAME}/team-kit-brands/{brand_id}.{ext}"
            _storage_put(storage_path, raw, content_type)
            update["image"] = f"/api/portfolio/file/{brand_id}.{ext}"
            await db.portfolio.update_one(
                {"id": brand_id},
                {"$set": {"id": brand_id, "image_url": update["image"], "storage_path": storage_path,
                          "content_type": content_type, "size_bytes": len(raw),
                          "is_hidden": True, "category": "other"}},
                upsert=True,
            )
        except HTTPException:
            pass
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
        "attachments": [
            {
                "id": str(a.get("id") or "")[:60],
                "url": str(a.get("url") or "")[:400],
                "filename": str(a.get("filename") or "")[:200],
                "purpose": str(a.get("purpose") or "")[:60],
                "section": str(a.get("section") or "")[:80],
                "size_bytes": int(a.get("size_bytes") or 0),
            }
            for a in (payload.attachments or [])[:12]
            if isinstance(a, dict)
        ],
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
    # Normalise legacy {size, quantity} → {size_qtys} so the shared helper can price it
    if payload.size_qtys:
        size_qtys = dict(payload.size_qtys)
    else:
        sz = payload.size or "M"
        q_int = int(payload.quantity) if payload.quantity is not None else 1
        if q_int < 1:
            raise HTTPException(400, "Quantity must be ≥ 1")
        product = PRODUCTS.get(payload.product_id) or {}
        allowed_sizes = set(product.get("sizes") or [])
        if allowed_sizes and sz not in allowed_sizes:
            sz = next(iter(allowed_sizes)) if allowed_sizes else sz
        size_qtys = {sz: q_int}

    priced = await _resolve_line_pricing(
        product_id=payload.product_id,
        size_qtys=size_qtys,
        placements=payload.placements,
        blank=payload.blank,
        color=payload.color,
        design_meta=payload.design_meta,
    )
    product = priced["product"]
    placements_clean = priced["placements_clean"]
    size_qtys = priced["size_qtys"]
    total_qty = priced["total_qty"]
    total_amount = priced["line_total"]
    line_breakdown = priced["breakdown"]
    print_cost = priced["print_cost"]

    if total_amount < 0.5:
        raise HTTPException(400, "Total below Stripe minimum (£0.50)")

    _assert_origin_ok(payload.origin_url)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/product/{payload.product_id}"

    metadata = {
        "product_id": payload.product_id,
        "product_name": product["name"],
        "color": (payload.color or "")[:60],
        "blank": "true" if priced["blank"] else "false",
        "placements": ",".join(placements_clean)[:400],
        "sizes": ",".join(line_breakdown)[:400],
        "total_qty": str(total_qty),
        "print_cost_per_garment": f"£{print_cost:.2f}",
    }
    if payload.design_meta:
        for k, v in payload.design_meta.items():
            metadata[f"design_{k}"] = str(v)[:400]

    session = await create_checkout_session(
        api_key=STRIPE_API_KEY,
        amount=total_amount,
        currency="gbp",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        product_name=product["name"],
    )

    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "product_id": payload.product_id,
            "product_name": product["name"],
            "color": payload.color,
            "placements": placements_clean,
            "blank": priced["blank"],
            "size_qtys": size_qtys,
            "total_quantity": total_qty,
            "amount": total_amount,
            "currency": "gbp",
            "metadata": metadata,
            "payment_status": "pending",
            "status": "initiated",
            "receipt_sent": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return CheckoutResponse(url=session.url, session_id=session.id)


async def _maybe_send_order_emails(doc: dict, status_resp) -> None:
    """Fires the shop notification + customer receipt for a completed order.
    Idempotent: only sends once per order, guarded by the `receipt_sent` flag
    (set atomically here so a webhook and a status-poll firing near-simultaneously
    can't both send). Never raises — a failed email must never break checkout."""
    if not doc or doc.get("receipt_sent"):
        return
    # Atomic claim: only proceed if we're the one flipping receipt_sent False -> True.
    claim = await db.payment_transactions.update_one(
        {"session_id": doc["session_id"], "receipt_sent": {"$ne": True}},
        {"$set": {"receipt_sent": True}},
    )
    if claim.modified_count == 0:
        return  # someone else already claimed it (webhook vs poll race)

    try:
        customer_email = None
        details = getattr(status_resp, "customer_details", None)
        if details:
            customer_email = getattr(details, "email", None)
        customer_email = customer_email or doc.get("customer_email") or doc.get("contact_email")

        amount = float(getattr(status_resp, "amount_total", None) or 0) / 100.0
        currency = (getattr(status_resp, "currency", None) or "gbp").upper()
        order_label = doc.get("product_name") or doc.get("flow") or doc.get("kind") or "order"
        qty = doc.get("total_quantity", "")

        shop_to = await _shop_notification_recipient()
        if shop_to:
            body_shop = _email_wrap(
                f"New paid order — {order_label}",
                f"""
                <p>A new order has just been paid.</p>
                <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-top:8px">
                  <tr><td style="color:#4b5563"><strong>Order</strong></td><td>{order_label}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Quantity</strong></td><td>{qty or '—'}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Amount</strong></td><td>£{amount:.2f} {currency}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Customer</strong></td><td>{customer_email or '—'}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Session</strong></td><td>{doc.get('session_id','')}</td></tr>
                </table>
                """,
            )
            await _send_email(to=[shop_to], subject=f"[Paid order] {order_label} — £{amount:.2f}", html=body_shop)

        if customer_email:
            body_cust = _email_wrap(
                "Order confirmed — thank you!",
                f"""
                <p>Thanks for your order — we've received payment and it's on its way into production.</p>
                <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-top:8px">
                  <tr><td style="color:#4b5563"><strong>Order</strong></td><td>{order_label}</td></tr>
                  <tr><td style="color:#4b5563"><strong>Amount paid</strong></td><td>£{amount:.2f} {currency}</td></tr>
                </table>
                <p style="margin-top:16px;color:#4b5563">We'll be in touch if we need anything from you (like artwork approval); otherwise we'll email you again once it's shipped.</p>
                <p style="margin-top:16px">— The Your Own Print team</p>
                """,
            )
            await _send_email(to=[customer_email], subject="Your Your Own Print order is confirmed", html=body_cust)
    except Exception as e:
        logging.getLogger(__name__).warning(f"order confirmation email failed: {e}")


@api_router.get("/checkout/status/{session_id}", response_model=CheckoutStatusOut)
async def checkout_status(session_id: str, http_request: Request):
    status_resp = await get_checkout_status(STRIPE_API_KEY, session_id)

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
    if existing and status_resp.payment_status == "paid":
        await _maybe_send_order_emails(existing, status_resp)

    return CheckoutStatusOut(
        session_id=session_id,
        status=status_resp.status,
        payment_status=status_resp.payment_status,
        amount_total=float(status_resp.amount_total or 0) / 100.0,
        currency=status_resp.currency,
    )


# ---------- Multi-product cart checkout ----------
# Server-side pricing per line — clients cannot spoof totals.
class CartLineItem(BaseModel):
    product_id: str
    size_qtys: Dict[str, int]                     # {"M": 2, "L": 1}
    color: Optional[str] = None
    placements: Optional[List[str]] = None
    blank: bool = False
    design_meta: Optional[Dict[str, str]] = None  # DYO artwork ref, etc.


class CartCheckoutRequest(BaseModel):
    items: List[CartLineItem]
    origin_url: str
    customer_email: Optional[str] = None


async def _resolve_line_pricing(
    *,
    product_id: str,
    size_qtys: Dict[str, int],
    placements: Optional[List[str]] = None,
    blank: bool = False,
    color: Optional[str] = None,
    design_meta: Optional[Dict] = None,
) -> Dict:
    """Canonical per-line pricing — called by both single-item /checkout/session
    and multi-line /checkout/cart-session so bulk-tier + upcharge maths is
    guaranteed identical.

    Returns:
        {product, product_id, base_price, size_upcharges, size_qtys (validated),
         placements_clean, print_cost, blank, color, total_qty, line_total,
         breakdown, design_meta}
    """
    if product_id not in PRODUCTS:
        raise HTTPException(400, f"Invalid product: {product_id}")
    product = PRODUCTS[product_id]
    base_price = float(product["price"])
    size_upcharges: Dict[str, float] = product.get("size_upcharges", {}) or {}
    allowed_sizes = set(product.get("sizes", []))

    # Strip back-print for bottoms / shorts / joggers etc.
    placements = list(placements or [])
    if product_id in NO_BACK_PRINT_PRODUCT_IDS and placements:
        placements = [p for p in placements if "back" not in (p or "").lower()]

    # Resolve print cost using the same rules across every flow
    if blank:
        placements_clean: List[str] = []
        print_cost = 0.0
    elif product_id == "boxing-fight-tee":
        placements_clean = [p for p in placements if p in FIGHT_NIGHT_ADDONS]
        print_cost = round(sum(FIGHT_NIGHT_ADDONS[p]["price"] for p in placements_clean), 2)
    elif product.get("category") == "team-kits":
        placements_clean = [p for p in placements if p in TEAM_KIT_ADDONS]
        print_cost = round(sum(TEAM_KIT_ADDONS[p]["price"] for p in placements_clean), 2)
    elif product.get("category") == "leavers":
        wanted = set(placements)
        placements_clean = ["drawstring-bag"] if "drawstring-bag" in wanted else []
        print_cost = LEAVERS_BAG_PRICE if "drawstring-bag" in wanted else 0.0
    elif (design_meta or {}).get("flow") == "designer":
        wanted = set(placements)
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
        placements_clean = _validate_placements(placements)
        print_cost = round(sum(PLACEMENT_BY_ID[p]["price"] for p in placements_clean), 2)

    # Validate sizes/qtys
    resolved_qtys: Dict[str, int] = {}
    for sz, q in (size_qtys or {}).items():
        try:
            q_int = int(q)
        except (TypeError, ValueError):
            continue
        if q_int <= 0:
            continue
        if allowed_sizes and sz not in allowed_sizes:
            raise HTTPException(400, f"Size '{sz}' not available for {product_id}")
        resolved_qtys[sz] = q_int
    if not resolved_qtys:
        raise HTTPException(400, f"{product_id}: select at least one size")

    total_qty = sum(resolved_qtys.values())
    if total_qty < 1 or total_qty > 5000:
        raise HTTPException(400, f"{product_id}: qty must be 1–5000")

    # Bulk-tier pricing
    if product_id == "boxing-fight-tee":
        base_price = tier_unit_price(FIGHT_NIGHT_BULK_TIERS, base_price, total_qty)
    elif product.get("category") == "leavers" and product_id != "leavers-drawstring-bag":
        base_price = tier_unit_price(LEAVERS_BULK_TIERS_DEFAULT, base_price, total_qty)
    elif product.get("bulk_pricing_enabled"):
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

    line_total = 0.0
    breakdown: List[str] = []
    for sz, q in resolved_qtys.items():
        unit = base_price + float(size_upcharges.get(sz, 0.0)) + print_cost
        line_total += round(unit * q, 2)
        breakdown.append(f"{sz}×{q}@£{unit:.2f}")
    line_total = round(line_total, 2)

    return {
        "product": product,
        "product_id": product_id,
        "base_price": base_price,
        "size_upcharges": size_upcharges,
        "size_qtys": resolved_qtys,
        "placements_clean": placements_clean,
        "print_cost": print_cost,
        "blank": blank or not placements_clean,
        "color": color,
        "total_qty": total_qty,
        "line_total": line_total,
        "breakdown": breakdown,
        "design_meta": design_meta or {},
    }


async def _price_line_item(item: CartLineItem) -> Dict:
    """Backwards-compatible wrapper — resolves the pricing for one CartLineItem
    by delegating to the shared `_resolve_line_pricing()` helper."""
    return await _resolve_line_pricing(
        product_id=item.product_id,
        size_qtys=item.size_qtys or {},
        placements=item.placements,
        blank=item.blank,
        color=item.color,
        design_meta=item.design_meta,
    )



def _assert_origin_ok(origin_url: str) -> None:
    """Guard the Stripe success/cancel URL host — reject any origin outside
    our production domain + preview environments. Prevents an attacker from
    hijacking the checkout success redirect to steal session_ids."""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(origin_url)
    except Exception:
        raise HTTPException(400, "Invalid origin_url")
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "origin_url must be http or https")
    host = (parsed.hostname or "").lower()
    if not host:
        raise HTTPException(400, "origin_url missing host")
    allowed_suffixes = ("yourownprint.co.uk", "vercel.app", "emergentagent.com", "localhost", "127.0.0.1")
    if not any(host == s or host.endswith("." + s) for s in allowed_suffixes):
        raise HTTPException(400, f"origin_url host not allowed: {host}")


@api_router.post("/checkout/cart-session", response_model=CheckoutResponse)
async def create_cart_checkout(payload: CartCheckoutRequest, http_request: Request):
    """Combined Stripe session for a multi-line cart. Reprices every line server-side."""
    if not payload.items:
        raise HTTPException(400, "Cart is empty")
    if len(payload.items) > 20:
        raise HTTPException(400, "Cart limit is 20 lines — please split into two orders")
    _assert_origin_ok(payload.origin_url)

    priced = [await _price_line_item(item) for item in payload.items]
    grand_total = round(sum(p["line_total"] for p in priced), 2)
    total_qty = sum(p["total_qty"] for p in priced)

    if grand_total < 0.5:
        raise HTTPException(400, "Cart total below Stripe minimum (£0.50)")

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/cart"

    # Compact metadata — Stripe caps values at 500 chars each. Full breakdown is stored in Mongo below.
    item_summary = " | ".join(
        f"{p['product']['name']} ({sum(p['size_qtys'].values())})" for p in priced
    )[:490]
    metadata = {
        "kind": "cart",
        "items_count": str(len(priced)),
        "total_qty": str(total_qty),
        "items_summary": item_summary,
    }

    session = await create_checkout_session(
        api_key=STRIPE_API_KEY,
        amount=grand_total,
        currency="gbp",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        product_name="Your Own Print cart order",
    )

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "kind": "cart",
        "customer_email": payload.customer_email,
        "items": [
            {
                "product_id": p["product_id"],
                "product_name": p["product"]["name"],
                "color": p["color"],
                "placements": p["placements_clean"],
                "blank": p["blank"],
                "size_qtys": p["size_qtys"],
                "total_quantity": p["total_qty"],
                "line_total": p["line_total"],
                "breakdown": p["breakdown"],
                "design_meta": p["design_meta"],
            }
            for p in priced
        ],
        "total_quantity": total_qty,
        "amount": grand_total,
        "currency": "gbp",
        "metadata": metadata,
        "payment_status": "pending",
        "status": "initiated",
        "receipt_sent": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return CheckoutResponse(url=session.url, session_id=session.id)


@api_router.post("/cart/price")
async def price_cart(payload: CartCheckoutRequest):
    """Repriced cart preview — used by the drawer to show the correct total incl. bulk tiers,
    print upcharges, size upcharges. Does NOT create a Stripe session."""
    if not payload.items:
        return {"items": [], "grand_total": 0.0, "total_qty": 0}
    if len(payload.items) > 20:
        raise HTTPException(400, "Cart limit is 20 lines")
    priced = [await _price_line_item(item) for item in payload.items]
    grand_total = round(sum(p["line_total"] for p in priced), 2)
    return {
        "items": [
            {
                "product_id": p["product_id"],
                "product_name": p["product"]["name"],
                "product_image": p["product"].get("image"),
                "size_qtys": p["size_qtys"],
                "placements": p["placements_clean"],
                "blank": p["blank"],
                "color": p["color"],
                "total_qty": p["total_qty"],
                "line_total": p["line_total"],
                "breakdown": p["breakdown"],
                "unit_hint": round(p["line_total"] / p["total_qty"], 2) if p["total_qty"] else 0.0,
            }
            for p in priced
        ],
        "grand_total": grand_total,
        "total_qty": sum(p["total_qty"] for p in priced),
    }


@api_router.post("/reviews", response_model=ReviewOut)
async def create_review(payload: ReviewCreate):
    if payload.product_id != STORE_REVIEW_ID and payload.product_id not in PRODUCTS:
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
        # Held back until approved in /admin/reviews. Anything customer-submitted
        # is a spam vector, so nothing goes live on the say-so of the submitter.
        "approved": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(doc)
    return ReviewOut(**{k: doc[k] for k in ReviewOut.model_fields.keys()})


@api_router.get("/reviews/product/{product_id}")
async def list_product_reviews(product_id: str, limit: int = 50):
    if product_id != STORE_REVIEW_ID and product_id not in PRODUCTS:
        raise HTTPException(404, "Unknown product")
    cursor = db.reviews.find({"product_id": product_id, **APPROVED_ONLY}).sort("created_at", -1).limit(limit)
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
        {"$match": APPROVED_ONLY},
        {"$group": {"_id": "$product_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    out = {}
    async for doc in db.reviews.aggregate(pipeline):
        out[doc["_id"]] = {"average": round(doc["avg"], 2), "count": doc["count"]}
    return out


@api_router.get("/reviews/recent")
async def recent_reviews(limit: int = 12):
    cursor = db.reviews.find(APPROVED_ONLY).sort("created_at", -1).limit(limit)
    items = []
    async for r in cursor:
        items.append({k: r.get(k) for k in ReviewOut.model_fields.keys()})
    return items


@api_router.get("/reviews/store")
async def store_reviews(limit: int = 50):
    """Reviews about the shop as a whole rather than a specific garment."""
    cursor = db.reviews.find({"product_id": STORE_REVIEW_ID, **APPROVED_ONLY}).sort("created_at", -1).limit(limit)
    items = []
    total = 0
    rating_sum = 0
    async for r in cursor:
        items.append({k: r.get(k) for k in ReviewOut.model_fields.keys()})
        total += 1
        rating_sum += int(r.get("rating", 0))
    return {
        "average": round(rating_sum / total, 2) if total else 0,
        "count": total,
        "reviews": items,
    }


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
            # Already public on the old Shopify store, so no point re-moderating.
            "approved": True,
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
    designer_images_by_colour: Optional[Dict[str, str]] = None  # colour name -> image URL override
    # Back-view equivalents — optional. If not set, the designer falls back
    # to showing the front photo/print area when a customer switches to back
    # view, same as it always has (not ideal, but not a regression either).
    designer_image_back: Optional[str] = None
    designer_print_area_back: Optional[Dict[str, float]] = None
    designer_images_by_colour_back: Optional[Dict[str, str]] = None
    composition: Optional[str] = None
    description_long: Optional[str] = None
    use_cases: Optional[List[str]] = None


ALLOWED_PLACEMENT_OPTIONS = ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve", "neck-label", "left-pocket", "right-pocket"]

# Sensible default placement set per garment category — used to mass-populate
# allowed_placements across imported products, rather than every product
# defaulting to the full generic set (which is how a sleeveless vest ends up
# offering "left sleeve" print, or trousers end up offering "neck label").
CATEGORY_PLACEMENT_DEFAULTS: Dict[str, List[str]] = {
    "t-shirts":     ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve", "neck-label"],
    "polos":        ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve"],
    "shirts":       ["left-breast", "right-breast", "full-front", "back-print"],
    "hoodies":      ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve", "neck-label"],
    "sweatshirts":  ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve", "neck-label"],
    "jackets":      ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve"],
    "hi-vis":       ["left-breast", "right-breast", "full-front", "back-print"],  # sleeves added back per-product if it's a hi-vis jacket, not a vest
    "bottoms":      ["left-pocket", "right-pocket", "back-print"],
    "shorts":       ["left-pocket", "right-pocket"],
    "aprons":       ["full-front", "left-breast", "right-breast"],
    "hats":         ["full-front"],
    "bags":         ["full-front"],
    "footwear":     [],
    "towels":       ["full-front"],
    "socks":        [],
    "accessories":  ["full-front"],
    "promotional":  ["full-front"],
    "kids-baby":    ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve"],
}


def _repair_size_value(raw: str) -> str:
    """Repairs kids age-range sizes already corrupted in imported data —
    e.g. "2026-04-03 00:00:00" (was "3-4", auto-converted to a date by Excel
    in PenCarrie's own source file before it ever reached us) or "1213"
    (was "12-13", couldn't parse as a date so Excel just dropped the dash)."""
    s = str(raw).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?:\s+00:00:00)?$", s)
    if m:
        _, mm, dd = m.groups()
        return f"{int(dd)}-{int(mm)}"
    if s.isdigit() and len(s) == 4:
        return f"{s[:2]}-{s[2:]}"
    return s


def _auto_allowed_placements(name: str, category: str) -> List[str]:
    normalized_category = str(category or "").strip().lower()
    base = list(CATEGORY_PLACEMENT_DEFAULTS.get(normalized_category, ALLOWED_PLACEMENT_OPTIONS))
    hay = name.lower()
    # Hi-vis defaults assume a sleeveless vest (the most common case) — but a
    # hi-vis jacket/softshell/coat genuinely has sleeves, so add them back.
    if normalized_category == "hi-vis" and any(k in hay for k in ("jacket", "softshell", "coat", "parka", "bomber")):
        for p in ("left-sleeve", "right-sleeve"):
            if p not in base:
                base.append(p)
    # Sleeveless items (vests, tanks) can't take a sleeve print regardless of category.
    if any(k in hay for k in ("vest", "tank", "sleeveless", "singlet")):
        base = [p for p in base if p not in ("left-sleeve", "right-sleeve")]
    return base


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
    is_bestseller: Optional[bool] = None
    gender_fit: Optional[str] = None  # mens | womens | unisex | kids
    industry_tags: Optional[List[str]] = None


GENDER_FIT_OPTIONS = ["mens", "womens", "unisex", "kids"]
INDUSTRY_SLUGS = ["healthcare", "construction-trades", "retail", "security", "corporate", "sports-fitness", "industrial", "beauty-wellness", "cleaning", "hospitality-catering"]
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


# ---------- Industry vocabulary ----------
# Derived from the catalogue above rather than typed out again, so adding an
# alias there can never leave this list stale — the exact failure mode that
# fragmented the sidebar counts before.
INDUSTRY_ALIASES: Dict[str, str] = {
    e["slug"]: e["alias_of"] for e in INDUSTRIES_CATALOGUE if e.get("alias_of")
}
CANONICAL_INDUSTRIES: List[str] = [
    e["slug"] for e in INDUSTRIES_CATALOGUE if not e.get("alias_of")
]


def canonical_industries(tags) -> List[str]:
    """Fold alias slugs onto their canonical form, lowercase, de-duplicated,
    order preserved.

    Aliases exist so old URLs like /industries/trades keep working. They must
    never be *stored* on a product: a product tagged both "trades" and
    "construction-trades" shows up as two separate sidebar rows with split
    counts, which is what produced the row of stray 1s.

    Unrecognised values are kept rather than dropped — a slug that hasn't made
    it into the catalogue yet is more likely a new industry than junk, and
    silently discarding tags would be a far worse failure than showing one.
    """
    out: List[str] = []
    for t in tags or []:
        s = str(t or "").strip().lower()
        if not s:
            continue
        s = INDUSTRY_ALIASES.get(s, s)
        if s not in out:
            out.append(s)
    return out


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
            for k in ("designer_enabled", "designer_image", "designer_print_area", "designer_images_by_colour",
                     "designer_image_back", "designer_print_area_back", "designer_images_by_colour_back",
                     "composition", "description_long", "use_cases"):
                if k in doc and doc[k] is not None:
                    PRODUCTS[pid][k] = doc[k]
    # Product meta overlay (brand/SKU/size guide/bulk pricing)
    async for doc in db.product_meta.find({}):
        pid = doc.get("product_id")
        if pid in PRODUCTS:
            for k in ("brand", "sku", "description_full", "size_guide_image", "size_guide_table",
                     "bulk_pricing_enabled", "bulk_pricing_overrides", "allowed_placements",
                     "workforce_eligible", "also_bought", "match_with", "image_gallery", "specials_eligible", "is_bestseller",
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
                "images_by_colour": p.get("designer_images_by_colour") or {},
                "image_back": p.get("designer_image_back") or p.get("designer_image") or p["image"],
                "images_by_colour_back": p.get("designer_images_by_colour_back") or {},
                "colors": p.get("colors") or [],
                "print_area": p.get("designer_print_area") or DEFAULT_PRINT_AREA,
                "print_area_back": p.get("designer_print_area_back") or p.get("designer_print_area") or DEFAULT_PRINT_AREA,
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


@api_router.get("/admin/products/{pid}/suggest-cross-sell", dependencies=[Depends(require_admin)])
async def suggest_cross_sell(pid: str, limit: int = 6):
    """Suggests cross-sell candidates for the also-bought / match-with pickers:
    same brand, spread across different categories (so a hi-vis jacket suggests
    that brand's trousers/polo/etc rather than 6 more hi-vis jackets) — this is
    the 'complete the workwear outfit' pattern for a supplier catalogue import."""
    prod = PRODUCTS.get(pid)
    if not prod:
        raise HTTPException(404, "Product not found")
    brand = (prod.get("brand") or "").strip()
    if not brand:
        return {"suggestions": [], "brand": None, "reason": "This product has no brand set, so there's nothing to match it by."}

    seen_categories = {prod.get("category")}
    suggestions = []
    for p in PRODUCTS.values():
        if p["id"] == pid:
            continue
        if (p.get("brand") or "").strip().lower() != brand.lower():
            continue
        cat = p.get("category")
        if cat in seen_categories:
            continue  # prefer variety across categories over near-duplicates
        seen_categories.add(cat)
        suggestions.append({"id": p["id"], "name": p["name"], "category": cat, "image": p.get("image")})
        if len(suggestions) >= limit:
            break
    return {"suggestions": suggestions, "brand": brand}


@api_router.post("/admin/upload-image", dependencies=[Depends(require_admin)])
async def admin_upload_image(file: UploadFile = File(...), folder: str = "admin-uploads"):
    """Accepts a raw image file upload (not a URL) and stores it in R2,
    returning the public URL. Used for designer canvas images and anywhere
    else an admin wants to upload a file directly rather than paste a link."""
    content_type = (file.content_type or "").split(";")[0]
    if not content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are accepted.")
    data = await file.read()
    if len(data) > 8_000_000:
        raise HTTPException(400, "Image too large — please keep it under 8MB.")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(content_type, "jpg")
    safe_folder = re.sub(r"[^a-z0-9_-]+", "-", folder.lower())[:40] or "admin-uploads"
    digest = hashlib.sha256(data).hexdigest()[:24]
    path = f"{safe_folder}/{digest}.{ext}"
    await _storage_put_async(path, data, content_type)
    url = _get_public_url(path)
    if not url:
        raise HTTPException(500, "R2 storage isn't fully configured (missing R2_PUBLIC_URL).")
    return {"url": url}


MEDIA_UPLOAD_LIMITS = {
    "image": 8_000_000,    # 8MB — plenty for a photo
    "video": 20_000_000,   # 20MB — a compressed 10-20s clip lands well under this
}
_MEDIA_EXTENSIONS = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
}


@api_router.post("/admin/upload-media", dependencies=[Depends(require_admin)])
async def admin_upload_media(file: UploadFile = File(...), folder: str = "page-media"):
    """Like /admin/upload-image but also accepts short video clips.

    Video is capped deliberately low: the file is downloaded in full by every
    visitor to the page, so a large clip makes the page slow even though R2
    egress itself is free. Anything bigger should be compressed first, or
    uploaded straight to R2 and pasted in as a URL.
    """
    content_type = (file.content_type or "").split(";")[0]
    kind = "image" if content_type.startswith("image/") else "video" if content_type.startswith("video/") else None
    if kind is None:
        raise HTTPException(400, "Only image or video files are accepted.")
    if content_type not in _MEDIA_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format '{content_type}'. Use JPG, PNG, WEBP, GIF, MP4 or WEBM.")

    data = await file.read()
    limit = MEDIA_UPLOAD_LIMITS[kind]
    if len(data) > limit:
        mb = limit // 1_000_000
        actual_mb = round(len(data) / 1_000_000, 1)
        raise HTTPException(
            400,
            f"That {kind} is {actual_mb}MB — please keep it under {mb}MB. "
            f"For video, exporting at 720p for 10-20 seconds usually lands around 2-5MB.",
        )

    ext = _MEDIA_EXTENSIONS[content_type]
    safe_folder = re.sub(r"[^a-z0-9_-]+", "-", folder.lower())[:40] or "page-media"
    digest = hashlib.sha256(data).hexdigest()[:24]
    path = f"{safe_folder}/{digest}.{ext}"
    await _storage_put_async(path, data, content_type)
    url = _get_public_url(path)
    if not url:
        raise HTTPException(500, "R2 storage isn't fully configured (missing R2_PUBLIC_URL).")
    return {"url": url, "kind": kind, "content_type": content_type, "bytes": len(data)}


@api_router.get("/admin/designer-products", dependencies=[Depends(require_admin)])
async def admin_list_designer_products(offset: int = 0, limit: int = 25, q: str = ""):
    """Admin view — ALL products with their current designer settings, paginated."""
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
            "designer_images_by_colour": p.get("designer_images_by_colour") or {},
            "designer_image_back": p.get("designer_image_back") or "",
            "designer_print_area_back": p.get("designer_print_area_back"),
            "designer_images_by_colour_back": p.get("designer_images_by_colour_back") or {},
            "colors": [{"name": c.get("name"), "hex": c.get("hex")} for c in (p.get("colors") or [])],
            "composition": p.get("composition") or "",
            "description_long": p.get("description_long") or "",
            "use_cases": p.get("use_cases") or [],
        })
    if q:
        q_lower = q.strip().lower()
        out = [it for it in out if q_lower in f"{it['name']} {it['id']}".lower()]
    total = len(out)
    limit = min(limit, 200)
    page = out[offset:offset + limit]
    return {"items": page, "total": total, "offset": offset, "returned": len(page)}


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
    pa_back = None
    if payload.designer_print_area_back is not None:
        pa_back = payload.designer_print_area_back
        for k in ("x", "y", "w", "h"):
            if k not in pa_back:
                raise HTTPException(400, f"print_area_back missing '{k}'")
            if not (0 <= float(pa_back[k]) <= 100):
                raise HTTPException(400, f"print_area_back '{k}' must be 0-100")
    use_cases = payload.use_cases or []
    for uc in use_cases:
        if uc not in USE_CASE_OPTIONS:
            raise HTTPException(400, f"unknown use_case '{uc}'. Allowed: {USE_CASE_OPTIONS}")
    doc = {
        "product_id": product_id,
        "designer_enabled": payload.designer_enabled,
        "designer_image": payload.designer_image,
        "designer_print_area": pa,
        "designer_images_by_colour": payload.designer_images_by_colour or {},
        "designer_image_back": payload.designer_image_back or None,
        "designer_print_area_back": pa_back,
        "designer_images_by_colour_back": payload.designer_images_by_colour_back or {},
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
    PRODUCTS[product_id]["designer_images_by_colour"] = payload.designer_images_by_colour or {}
    PRODUCTS[product_id]["designer_image_back"] = payload.designer_image_back or None
    PRODUCTS[product_id]["designer_print_area_back"] = pa_back
    PRODUCTS[product_id]["designer_images_by_colour_back"] = payload.designer_images_by_colour_back or {}
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
async def admin_list_all_products(offset: int = 0, limit: int = 25, q: str = ""):
    """Admin overview of all products with editable meta fields.
    Paginated (default 25/page) and searchable — this list can run into the
    thousands once a supplier catalogue (e.g. PenCarrie) has been imported, so
    it's never returned in one go."""
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
            "allowed_placements": p.get("allowed_placements") if p.get("allowed_placements") is not None else list(ALLOWED_PLACEMENT_OPTIONS),
            "workforce_eligible": bool(p.get("workforce_eligible")),
            "also_bought": p.get("also_bought") or [],
            "match_with": p.get("match_with") or [],
            "image_gallery": p.get("image_gallery") or [],
            "specials_eligible": bool(p.get("specials_eligible")),
            "gender_fit": p.get("gender_fit") or "unisex",
            "industry_tags": p.get("industry_tags") or [],
        })
    if q:
        q_lower = q.strip().lower()
        out = [it for it in out if q_lower in f"{it['name']} {it['id']} {it['brand']} {it['sku']}".lower()]
    total = len(out)
    limit = min(limit, 200)
    page = out[offset:offset + limit]
    return {"items": page, "total": total, "offset": offset, "returned": len(page)}


@api_router.get("/products/{product_id}/allowed-placements")
async def get_allowed_placements(product_id: str):
    """Public endpoint — used by PDP and Designer to hide disallowed placements."""
    p = PRODUCTS.get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    stored = p.get("allowed_placements")
    # `stored` can legitimately be an empty list (e.g. footwear/socks — no
    # print placement makes sense at all), which is different from it never
    # having been set. `or` treats both the same (empty list is falsy), which
    # was wrongly falling back to the full unrestricted set for those products.
    return {"allowed_placements": stored if stored is not None else list(ALLOWED_PLACEMENT_OPTIONS)}


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
        payload.industry_tags = canonical_industries(payload.industry_tags)
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
        "is_bestseller": payload.is_bestseller if payload.is_bestseller is not None else bool(PRODUCTS[product_id].get("is_bestseller")),
        "gender_fit": payload.gender_fit,
        "industry_tags": payload.industry_tags,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.product_meta.update_one({"product_id": product_id}, {"$set": doc}, upsert=True)
    for k in ("brand", "sku", "description_full", "size_guide_image", "size_guide_table",
              "bulk_pricing_enabled", "bulk_pricing_overrides", "allowed_placements",
              "workforce_eligible", "also_bought", "match_with", "image_gallery", "specials_eligible", "is_bestseller",
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

    session = await create_checkout_session(
        api_key=STRIPE_API_KEY,
        amount=total_amount, currency="gbp",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
        product_name="Leavers hoodie order",
    )

    artwork_id = None
    if any([payload.custom_design_data_url, payload.custom_back_design_data_url, payload.names_file_data_url]):
        artwork_id = str(uuid.uuid4())
        await db.leavers_artwork.insert_one({
            "id": artwork_id,
            "session_id": session.id,
            "custom_design": payload.custom_design_data_url,               # front
            "custom_back_design": payload.custom_back_design_data_url,     # back
            "names_file": payload.names_file_data_url,                     # names list
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
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
        "receipt_sent": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return CheckoutResponse(url=session.url, session_id=session.id)


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

    # Fire-and-forget email notifications via Resend. Failures don't block the response.
    shop_to = await _shop_notification_recipient()
    body_shop = _email_wrap(
        "New bespoke leavers quote",
        f"""
        <p><strong>{payload.contact_name}</strong> from {payload.school} ({payload.year_group}) has asked for a bespoke leavers' hoodies quote.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-top:8px">
          <tr><td style="color:#4b5563"><strong>Estimated qty</strong></td><td>{payload.estimated_qty}</td></tr>
          <tr><td style="color:#4b5563"><strong>Email</strong></td><td>{payload.contact_email}</td></tr>
          <tr><td style="color:#4b5563"><strong>Phone</strong></td><td>{payload.contact_phone or '—'}</td></tr>
          <tr><td style="color:#4b5563" valign="top"><strong>Notes</strong></td><td>{(payload.notes or '—').replace(chr(10),'<br>')}</td></tr>
        </table>
        <p style="margin-top:16px;color:#4b5563;font-size:12px">Reply to this email to reach the customer directly.</p>
        """,
    )
    if shop_to:
        await _send_email(to=[shop_to], subject=f"[Leavers] {payload.school} — {payload.estimated_qty} hoodies",
                          html=body_shop, reply_to=payload.contact_email)
    # Confirmation to customer
    body_cust = _email_wrap(
        "Got it — we're on the case!",
        f"""
        <p>Hi {payload.contact_name.split(' ')[0]},</p>
        <p>Thanks for your bespoke leavers' hoodies enquiry for <strong>{payload.school}</strong> ({payload.year_group}). A real human will be in touch within 1 working day with fabric options, a design proof and pricing.</p>
        <p style="color:#4b5563">In the meantime, feel free to reply to this email with any extra details or mock-up ideas.</p>
        <p style="margin-top:16px">— The Your Own Print team</p>
        """,
    )
    reply_to = shop_to or None
    await _send_email(to=[payload.contact_email], subject="Your bespoke leavers' hoodies enquiry",
                      html=body_cust, reply_to=reply_to)
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
                "allowed_placements": p.get("allowed_placements") if p.get("allowed_placements") is not None else list(ALLOWED_PLACEMENT_OPTIONS),
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
    {"slug": "shirts",      "title": "Shirts & Blouses", "image": "https://images.pexels.com/photos/6764028/pexels-photo-6764028.jpeg"},
    {"slug": "sweatshirts", "title": "Sweatshirts",  "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg"},
    {"slug": "jackets",     "title": "Jackets",      "image": "https://images.pexels.com/photos/16429777/pexels-photo-16429777.jpeg"},
    {"slug": "hi-vis",      "title": "Hi-Vis",       "image": "https://images.pexels.com/photos/8961331/pexels-photo-8961331.jpeg"},
    {"slug": "shorts",      "title": "Shorts",       "image": "https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg"},
    {"slug": "bottoms",     "title": "Joggers & Trousers", "image": "https://images.pexels.com/photos/5384423/pexels-photo-5384423.jpeg"},
    {"slug": "aprons",      "title": "Aprons",       "image": "https://images.pexels.com/photos/4252136/pexels-photo-4252136.jpeg"},
    {"slug": "hats",        "title": "Caps & Headwear", "image": "https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg"},
    {"slug": "footwear",    "title": "Footwear",     "image": "https://images.pexels.com/photos/2385477/pexels-photo-2385477.jpeg"},
    {"slug": "towels",      "title": "Towels & Robes", "image": "https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg"},
    {"slug": "promotional", "title": "Promotional & Gifts", "image": "https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg"},
    {"slug": "kids-baby",   "title": "Kids & Baby",   "image": "https://images.pexels.com/photos/3933281/pexels-photo-3933281.jpeg"},
    {"slug": "accessories", "title": "Accessories",  "image": "https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg"},
]


def _garment_type_of(product: Dict) -> Optional[str]:
    # Prefer the product's explicit `category` when it matches a catalogue slug.
    # This lets bulk-imported products land in the collection admin chose at import
    # time without depending on fragile name-substring heuristics.
    cat = (product.get("category") or "").lower()
    _catalogue_slugs = {t["slug"] for t in GARMENT_TYPE_CATALOGUE}
    if cat in _catalogue_slugs:
        return cat
    if cat in ("bags", "socks"):
        return "accessories"  # importer-side categories with no dedicated collection page
    pid = product["id"].lower()
    name = (product.get("name") or "").lower()
    if "apron" in pid or "apron" in name:
        return "aprons"
    if "legging" in pid or "trouser" in pid or "jogger" in pid or "legging" in name or "trouser" in name or "jogger" in name:
        return "bottoms"
    if "short" in pid or "short" in name:
        return "shorts"
    if "jacket" in pid or "jacket" in name or "varsity" in pid or "softshell" in pid:
        return "jackets"
    if "hi-vis" in pid or "hi vis" in name:
        return "hi-vis"
    if "polo" in pid or "polo" in name:
        return "polos"
    if "hoodie" in pid or "hoodie" in name or "pullover" in pid or "zoodie" in name:
        return "hoodies"
    if "sweatshirt" in pid or "crewneck" in pid:
        return "sweatshirts"
    if "trainer" in name or "boot" in name or "hiker" in name or "clog" in name or "slider" in name:
        return "footwear"
    if "towel" in name or "robe" in name:
        return "towels"
    if "mumbles" in name or "teddy" in name or "keyring" in name or "key ring" in name:
        return "promotional"
    if "larkwood" in name or "toddler" in name or "sleepsuit" in name or "dungaree" in name:
        return "kids-baby"
    if "tee" in pid or "tshirt" in pid or "t-shirt" in name or "shirt" in pid:
        return "t-shirts"
    if "cap" in pid or "cap" in name or "beanie" in pid or "beanie" in name or "bucket hat" in name:
        return "hats"
    if "sock" in pid or "sock" in name:
        return "accessories"
    if "bag" in pid or "drawstring" in pid:
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


def _collect_variant_field(prod: Dict, field: str) -> List:
    """Extract a variant field (colors, sizes). Products merge variants flat via _VARIANT_MAP."""
    v = prod.get(field)
    if v is None:
        nested = prod.get("variants") or {}
        v = nested.get(field) or []
    return v if isinstance(v, list) else []


def _facets_from_products(products: List[Dict]) -> Dict:
    """Compute auto-derived facets. Only facets with variance (>1 distinct value) are returned."""
    from collections import Counter
    gender_c: Counter = Counter()
    colour_c: Counter = Counter()
    size_c: Counter = Counter()
    industry_c: Counter = Counter()
    prices: List[float] = []
    for p in products:
        gender_c[p.get("gender_fit") or "unisex"] += 1
        for c in _collect_variant_field(p, "colors"):
            if isinstance(c, dict):
                name = c.get("name")
                if name:
                    colour_c[name] += 1
            elif isinstance(c, str):
                colour_c[c] += 1
        for s in _collect_variant_field(p, "sizes"):
            if isinstance(s, str):
                size_c[s] += 1
        # Canonicalised on the way in, so a stray legacy tag still in the
        # database counts toward its proper row instead of making its own.
        for t in canonical_industries(p.get("industry_tags")):
            industry_c[t] += 1
        try:
            prices.append(float(p.get("price") or 0))
        except (TypeError, ValueError):
            pass
    facets: Dict = {}
    if len(gender_c) > 1:
        facets["gender_fit"] = [{"value": k, "count": v} for k, v in gender_c.most_common()]
    if len(colour_c) > 1:
        # Order colours by frequency and cap to 24 to keep the sidebar tidy.
        facets["colour"] = [{"value": k, "count": v} for k, v in colour_c.most_common(24)]
    if len(size_c) > 1:
        # Preserve garment-industry natural size order when possible.
        SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL",
                      "3-4 yrs", "5-6 yrs", "7-8 yrs", "9-11 yrs", "12-13 yrs",
                      "kids-S", "kids-M", "kids-L", "0-3M", "3-6M", "6-12M"]
        keys = list(size_c.keys())
        keys.sort(key=lambda k: (SIZE_ORDER.index(k) if k in SIZE_ORDER else 999, k))
        facets["size"] = [{"value": k, "count": size_c[k]} for k in keys]
    if len(industry_c) > 1:
        facets["industry"] = [{"value": k, "count": v} for k, v in industry_c.most_common(20)]
    if prices:
        facets["price_range"] = {"min": round(min(prices), 2), "max": round(max(prices), 2)}
    return facets


async def _collection_seo_copy(slug: str) -> Dict:
    """Return admin-editable SEO copy for a shop-type slug. Keys: intro, body, faq."""
    doc = await db.settings.find_one({"key": f"collection_seo:{slug}"})
    if not doc:
        return {"intro": "", "body": "", "faq": []}
    return {
        "intro": doc.get("intro") or "",
        "body": doc.get("body") or "",
        "faq": doc.get("faq") or [],
    }


@api_router.get("/shop/type/{slug}")
async def shop_by_garment_type(
    slug: str,
    gender_fit: Optional[str] = None,
    colour: Optional[str] = None,     # comma-separated list of colour names
    size: Optional[str] = None,        # comma-separated list of sizes
    industry: Optional[str] = None,    # comma-separated list of industry tags
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    limit: int = 25,
    offset: int = 0,
):
    meta = next((t for t in GARMENT_TYPE_CATALOGUE if t["slug"] == slug), None)
    if not meta:
        raise HTTPException(404, "Garment type not found")
    # All products in this collection (used to derive facets — before applying filters).
    all_prods = [p for p in PRODUCTS.values() if _garment_type_of(p) == slug]
    facets = _facets_from_products(all_prods)

    colour_set = {c.strip() for c in (colour or "").split(",") if c.strip()}
    size_set = {s.strip() for s in (size or "").split(",") if s.strip()}
    industry_set = {i.strip() for i in (industry or "").split(",") if i.strip()}

    def matches(p: Dict) -> bool:
        if gender_fit and (p.get("gender_fit") or "unisex") != gender_fit:
            return False
        if colour_set:
            names = {(c.get("name") if isinstance(c, dict) else c) for c in _collect_variant_field(p, "colors")}
            if not (colour_set & names):
                return False
        if size_set:
            szs = set(_collect_variant_field(p, "sizes"))
            if not (size_set & szs):
                return False
        if industry_set:
            tags = set(p.get("industry_tags") or [])
            if not (industry_set & tags):
                return False
        try:
            price = float(p.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        if price_min is not None and price < price_min:
            return False
        if price_max is not None and price > price_max:
            return False
        return True

    items: List[Dict] = []
    for p in all_prods:
        if not matches(p):
            continue
        items.append({
            "id": p["id"], "name": p["name"], "price": float(p["price"]),
            "image": p["image"], "category": p["category"],
            "description": p.get("description") or "",
            "gender_fit": p.get("gender_fit") or "unisex",
            "industry_tags": p.get("industry_tags") or [],
            "colors": [{"name": c.get("name"), "hex": c.get("hex")} for c in (p.get("colors") or [])][:40],
        })
    items.sort(key=lambda x: x["price"])
    matched_total = len(items)
    limit = min(limit, 200)
    page_items = items[offset:offset + limit]
    seo = await _collection_seo_copy(slug)
    return {**meta, "products": page_items, "facets": facets, "seo": seo, "total": len(all_prods), "matched_total": matched_total, "offset": offset, "returned": len(page_items)}


# Industries that make up the "Workwear" umbrella collection. Uses the
# canonical slugs — the frontend previously requested the old aliases
# ("trades,construction,logistics"), which stopped matching anything once
# tagging was canonicalised, so the page was filtering on dead values.
WORKWEAR_INDUSTRY_SLUGS = ["construction-trades", "cleaning", "industrial", "security"]


@api_router.get("/collections/workwear")
async def workwear_collection(
    gender_fit: Optional[str] = None,
    colour: Optional[str] = None,
    size: Optional[str] = None,
    industry: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    limit: int = 25,
    offset: int = 0,
):
    """Workwear umbrella collection — same shape as /shop/type/{slug} so the
    page can use the identical sidebar/facet UI as every other collection."""
    umbrella = set(WORKWEAR_INDUSTRY_SLUGS)
    # Safety net: also include products whose garment category is inherently
    # workwear. Without this the page would be completely empty until the
    # "Re-tag industries" bulk action had been run, since selection would
    # depend entirely on tags.
    workwear_categories = {"workwear", "hi-vis", "aprons", "polos", "shirts"}
    all_prods = [
        p for p in PRODUCTS.values()
        if p.get("active", True) and (
            (umbrella & set(p.get("industry_tags") or []))
            or str(p.get("category") or "").strip().lower() in workwear_categories
        )
    ]
    facets = _facets_from_products(all_prods)

    colour_set = {c.strip() for c in (colour or "").split(",") if c.strip()}
    size_set = {s.strip() for s in (size or "").split(",") if s.strip()}
    industry_set = {i.strip() for i in (industry or "").split(",") if i.strip()}

    def matches(p: Dict) -> bool:
        if gender_fit and (p.get("gender_fit") or "unisex") != gender_fit:
            return False
        if colour_set:
            names = {(c.get("name") if isinstance(c, dict) else c) for c in _collect_variant_field(p, "colors")}
            if not (colour_set & names):
                return False
        if size_set:
            szs = set(_collect_variant_field(p, "sizes"))
            if not (size_set & szs):
                return False
        if industry_set:
            tags = set(p.get("industry_tags") or [])
            if not (industry_set & tags):
                return False
        try:
            price = float(p.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        if price_min is not None and price < price_min:
            return False
        if price_max is not None and price > price_max:
            return False
        return True

    items: List[Dict] = []
    for p in all_prods:
        if not matches(p):
            continue
        items.append({
            "id": p["id"], "name": p["name"], "price": float(p["price"]),
            "image": p["image"], "category": p["category"],
            "description": p.get("description") or "",
            "gender_fit": p.get("gender_fit") or "unisex",
            "industry_tags": p.get("industry_tags") or [],
            "colors": [{"name": c.get("name"), "hex": c.get("hex")} for c in (p.get("colors") or [])][:40],
        })
    items.sort(key=lambda x: x["price"])
    matched_total = len(items)
    limit = min(limit, 200)
    page_items = items[offset:offset + limit]
    return {
        "slug": "workwear", "title": "Workwear",
        "products": page_items, "facets": facets,
        "total": len(all_prods), "matched_total": matched_total,
        "offset": offset, "returned": len(page_items),
    }


@api_router.patch("/admin/collection-seo/{slug}", dependencies=[Depends(require_admin)])
async def admin_update_collection_seo(slug: str, payload: Dict):
    """Save admin-editable SEO block for a shop-type collection.
    Body: {intro?: str, body?: str, faq?: [{q,a}]}"""
    meta = next((t for t in GARMENT_TYPE_CATALOGUE if t["slug"] == slug), None)
    if not meta:
        raise HTTPException(404, "Unknown collection slug")
    doc = {
        "key": f"collection_seo:{slug}",
        "slug": slug,
        "intro": (payload.get("intro") or "")[:2000],
        "body": (payload.get("body") or "")[:8000],
        "faq": [
            {"q": (f.get("q") or "")[:200], "a": (f.get("a") or "")[:1000]}
            for f in (payload.get("faq") or [])[:20]
            if isinstance(f, dict) and (f.get("q") or "").strip()
        ],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.settings.update_one({"key": doc["key"]}, {"$set": doc}, upsert=True)
    return {"ok": True, **doc}


@api_router.get("/admin/collection-seo/{slug}", dependencies=[Depends(require_admin)])
async def admin_get_collection_seo(slug: str):
    return await _collection_seo_copy(slug)


@api_router.get("/industries/{slug}")
async def get_industry(
    slug: str,
    gender_fit: Optional[str] = None,
    colour: Optional[str] = None,
    size: Optional[str] = None,
    category: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    limit: int = 25,
    offset: int = 0,
):
    ind = next((i for i in INDUSTRIES_CATALOGUE if i["slug"] == slug), None)
    if not ind:
        raise HTTPException(404, "Industry not found")
    # Resolve canonical (if this is a legacy alias)
    canonical_slug = ind.get("alias_of") or ind["slug"]
    canonical = next((i for i in INDUSTRIES_CATALOGUE if i["slug"] == canonical_slug), ind)
    # Tags to match: canonical + any aliases pointing to it
    match_slugs = {canonical_slug} | {a["slug"] for a in INDUSTRIES_CATALOGUE if a.get("alias_of") == canonical_slug}

    all_prods = [p for p in PRODUCTS.values() if set(p.get("industry_tags") or []) & match_slugs]
    facets = _facets_from_products(all_prods)
    # Category facet too (which garment types show up within this industry) —
    # not part of the shared _facets_from_products helper, built here directly.
    category_counts: Dict[str, int] = {}
    for p in all_prods:
        category_counts[p["category"]] = category_counts.get(p["category"], 0) + 1
    facets["category"] = [{"value": k, "count": v} for k, v in sorted(category_counts.items(), key=lambda kv: -kv[1])]

    colour_set = {c.strip() for c in (colour or "").split(",") if c.strip()}
    size_set = {s.strip() for s in (size or "").split(",") if s.strip()}

    def matches(p: Dict) -> bool:
        if gender_fit and (p.get("gender_fit") or "unisex") != gender_fit:
            return False
        if category and p["category"] != category:
            return False
        if colour_set:
            names = {(c.get("name") if isinstance(c, dict) else c) for c in _collect_variant_field(p, "colors")}
            if not (colour_set & names):
                return False
        if size_set:
            szs = set(_collect_variant_field(p, "sizes"))
            if not (size_set & szs):
                return False
        try:
            price = float(p.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        if price_min is not None and price < price_min:
            return False
        if price_max is not None and price > price_max:
            return False
        return True

    items: List[Dict] = []
    for p in all_prods:
        if not matches(p):
            continue
        items.append({
            "id": p["id"], "name": p["name"], "price": float(p["price"]),
            "image": p["image"], "category": p["category"],
            "description": p.get("description") or "",
            "gender_fit": p.get("gender_fit") or "unisex",
            "colors": [{"name": c.get("name"), "hex": c.get("hex")} for c in (p.get("colors") or [])][:40],
        })
    items.sort(key=lambda x: x["price"])
    matched_total = len(items)
    limit = min(limit, 200)
    page_items = items[offset:offset + limit]

    # Strip the alias_of marker from the response
    out = {k: v for k, v in canonical.items() if k != "alias_of"}
    return {**out, "products": page_items, "facets": facets, "total": len(all_prods), "matched_total": matched_total, "offset": offset, "returned": len(page_items)}


# ---------- Sports & Fitness Teams (SEO landings) ----------
@api_router.get("/sports-teams")
async def list_sports_teams():
    out = []
    for s in SPORTS_TEAMS_CATALOGUE:
        out.append({"slug": s["slug"], "title": s["title"], "subtitle": s["subtitle"],
                    "hero_image": s["hero_image"], "intro": s["intro"]})
    return out


# Words that appear in nearly every landing page title, so scoring a hit on them
# says nothing about relevance. Kept deliberately short: "gym" and "studio" look
# generic but only appear on two titles each, and dropping them left the Gyms
# page with no usable keyword at all, so everything tied and fell back to
# alphabetical.
_SPORTS_STOPWORDS = {"kits", "kit", "apparel", "and", "the"}


def _sports_team_keywords(s: Dict) -> List[str]:
    """Distinctive words for a landing page, from its slug and title."""
    raw = f"{s.get('slug', '')} {s.get('title', '')}".lower().replace("-", " ")
    words = {w for w in re.findall(r"[a-z]+", raw) if len(w) > 2}
    return sorted(words - _SPORTS_STOPWORDS)


def _sports_team_products(s: Dict) -> List[Dict]:
    """Curated picks first, then the rest of the sports catalogue behind them.

    Returns the full product records, not trimmed ones — the facet sidebar needs
    colours, sizes and fit, which a cut-down dict wouldn't carry.

    The curated `product_ids` are hand-chosen and include bundles and
    configurator entries that no automatic rule would surface, so they stay
    pinned at the top. But on their own they were only ever 5-8 items, which
    left pages like Gyms and Personal Trainers looking like the shop had
    almost nothing in stock — the hundreds of sports-tagged products in the
    imported catalogue never appeared at all.
    """
    out: List[Dict] = []
    seen: set = set()

    def add(p: Optional[Dict]) -> None:
        if not p or p.get("id") in seen:
            return
        seen.add(p["id"])
        out.append(p)

    for pid in s.get("product_ids", []):
        add(PRODUCTS.get(pid))

    keywords = _sports_team_keywords(s)
    pool: List[Tuple[int, str, Dict]] = []
    for p in PRODUCTS.values():
        if p.get("id") in seen:
            continue
        if "sports-fitness" not in canonical_industries(p.get("industry_tags")):
            continue
        hay = f"{p.get('name', '')} {p.get('category', '')}".lower()
        score = sum(1 for k in keywords if k in hay)
        # Negative score sorts highest-relevance first; name keeps it stable so
        # the same page doesn't shuffle between requests and duplicate items
        # across page boundaries.
        pool.append((-score, str(p.get("name") or ""), p))

    for _, _, p in sorted(pool, key=lambda t: (t[0], t[1])):
        add(p)

    return out


@api_router.get("/sports-teams/{slug}")
async def get_sports_team(
    slug: str,
    gender_fit: Optional[str] = None,
    colour: Optional[str] = None,
    size: Optional[str] = None,
    category: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    limit: int = 12,
    offset: int = 0,
):
    s = next((i for i in SPORTS_TEAMS_CATALOGUE if i["slug"] == slug), None)
    if not s:
        raise HTTPException(404, "Sports landing not found")
    limit = max(1, min(int(limit or 12), 60))
    offset = max(0, int(offset or 0))

    all_prods = _sports_team_products(s)

    # Facets describe the whole lineup, not the filtered view, so the counts
    # beside each option don't collapse to zero as soon as one is ticked.
    facets = _facets_from_products(all_prods)
    category_counts: Dict[str, int] = {}
    for p in all_prods:
        category_counts[p.get("category") or ""] = category_counts.get(p.get("category") or "", 0) + 1
    facets["category"] = [{"value": k, "count": v}
                          for k, v in sorted(category_counts.items(), key=lambda kv: -kv[1]) if k]

    colour_set = {c.strip() for c in (colour or "").split(",") if c.strip()}
    size_set = {z.strip() for z in (size or "").split(",") if z.strip()}

    def matches(p: Dict) -> bool:
        if gender_fit and (p.get("gender_fit") or "unisex") != gender_fit:
            return False
        if category and p.get("category") != category:
            return False
        if colour_set:
            names = {(c.get("name") if isinstance(c, dict) else c) for c in _collect_variant_field(p, "colors")}
            if not (colour_set & names):
                return False
        if size_set:
            if not (size_set & set(_collect_variant_field(p, "sizes"))):
                return False
        try:
            price = float(p.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        if price_min is not None and price < price_min:
            return False
        if price_max is not None and price > price_max:
            return False
        return True

    # Filtering preserves the curated-first order rather than re-sorting by
    # price — the hand-picked bundles are meant to lead, filtered or not.
    matched = [p for p in all_prods if matches(p)]
    page = matched[offset:offset + limit]

    products = [{
        "id": p["id"], "name": p["name"], "price": float(p.get("price") or 0),
        "image": p.get("image") or "", "category": p.get("category") or "",
        "description": p.get("description") or "",
        "gender_fit": p.get("gender_fit") or "unisex",
        "colors": [{"name": c.get("name"), "hex": c.get("hex")} for c in (p.get("colors") or []) if isinstance(c, dict)][:40],
    } for p in page]

    return {
        **s,
        "products": products,
        "facets": facets,
        "total": len(all_prods),
        "matched_total": len(matched),
        "offset": offset,
        "limit": limit,
        "returned": len(products),
    }


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

    session = await create_checkout_session(
        api_key=STRIPE_API_KEY,
        amount=total_amount, currency="gbp",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
        product_name="Workforce order",
    )

    artwork_doc_id = str(uuid.uuid4())
    await db.workforce_artwork.insert_one({
        "id": artwork_doc_id,
        "session_id": session.id,
        "breast_logo": payload.breast_logo_data_url,
        "back_print": payload.back_print_data_url,
        "needs_back_print": needs_back_print,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
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
        "receipt_sent": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return CheckoutResponse(url=session.url, session_id=session.id)


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
    """Curator-picked complementary products, with an automatic fallback —
    same industry tag(s), different category — so "complete the look"
    actually shows something for the vast majority of the catalogue that
    hasn't been manually curated, rather than showing nothing at all."""
    p = PRODUCTS.get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    picks = list(p.get("match_with") or [])
    if not picks:
        my_tags = set(p.get("industry_tags") or [])
        candidates = [
            q for q in PRODUCTS.values()
            if q["id"] != product_id and q["category"] != p["category"]
            and (not my_tags or my_tags & set(q.get("industry_tags") or []))
        ]
        # Prefer same-brand matches first (a genuine "goes together" signal),
        # then stable order by price so results don't jump around.
        my_brand = (p.get("brand") or p.get("_brand") or "").strip().lower()
        candidates.sort(key=lambda x: (
            0 if my_brand and (x.get("brand") or x.get("_brand") or "").strip().lower() == my_brand else 1,
            float(x["price"]), x["id"],
        ))
        picks = [q["id"] for q in candidates[:limit]]
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


@api_router.get("/admin/orders", dependencies=[Depends(require_admin)])
async def admin_list_orders(status: str = "all", limit: int = 200):
    """Read-only feed of every checkout attempt (paid, pending, expired…) across
    all 4 checkout flows (single product, cart, leavers, workforce)."""
    query = {} if status == "all" else {"payment_status": status}
    cursor = db.payment_transactions.find(query).sort("created_at", -1).limit(min(limit, 500))
    orders = []
    async for doc in cursor:
        doc.pop("_id", None)
        orders.append(doc)
    return {"orders": orders, "count": len(orders)}


@api_router.get("/admin/enquiries", dependencies=[Depends(require_admin)])
async def admin_list_enquiries(limit: int = 200):
    """Merged, read-only feed of /contact submissions and /quote-request leads
    (team kits, fight night, bespoke leavers, general enquiries, etc.), newest first."""
    per_source = min(limit, 500)
    contacts, quotes = [], []
    async for doc in db.contact_submissions.find({}).sort("created_at", -1).limit(per_source):
        doc.pop("_id", None)
        doc["source"] = "contact"
        contacts.append(doc)
    async for doc in db.quote_requests.find({}).sort("created_at", -1).limit(per_source):
        doc.pop("_id", None)
        doc["source"] = "quote"
        quotes.append(doc)
    merged = sorted(contacts + quotes, key=lambda d: d.get("created_at", ""), reverse=True)
    return {"enquiries": merged[:limit], "count": len(merged[:limit])}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    try:
        if not STRIPE_WEBHOOK_SECRET:
            # No signing secret configured — accept-and-log rather than hard-fail, so
            # local/dev setups without a configured webhook still don't 500. Set
            # STRIPE_WEBHOOK_SECRET in production so signatures are actually verified.
            logger.warning("STRIPE_WEBHOOK_SECRET not set — skipping signature verification")
            import json as _json
            event = _json.loads(body)
        else:
            event = construct_webhook_event(body, signature, STRIPE_WEBHOOK_SECRET)

        event_type = event.get("type") if isinstance(event, dict) else event["type"]
        data_object = (event.get("data") or {}).get("object") if isinstance(event, dict) else event["data"]["object"]
        session_id = data_object.get("id") if isinstance(data_object, dict) else None
        payment_status = data_object.get("payment_status") if isinstance(data_object, dict) else None

        if event_type == "checkout.session.completed" and session_id:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "payment_status": payment_status or "paid",
                        "status": "completed",
                        "webhook_event": event_type,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            existing = await db.payment_transactions.find_one({"session_id": session_id})
            if existing and (payment_status or "").lower() == "paid":
                full_session = await get_checkout_status(STRIPE_API_KEY, session_id)
                await _maybe_send_order_emails(existing, full_session)
        return {"received": True}
    except _stripe_sdk.error.SignatureVerificationError as e:
        logger.error(f"Stripe webhook signature error: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Admin Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


_ADMIN_LOGIN_MAX_ATTEMPTS = 5
_ADMIN_LOGIN_LOCKOUT_MINUTES = 15


async def _check_admin_lockout(email: str) -> None:
    doc = await db.admin_login_attempts.find_one({"email": email})
    if not doc or not doc.get("locked_until"):
        return
    try:
        lock_ts = datetime.fromisoformat(doc["locked_until"])
    except Exception:
        return
    if lock_ts > datetime.now(timezone.utc):
        remaining = int((lock_ts - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        raise HTTPException(423, f"Too many failed attempts. Try again in {remaining} minutes.")


async def _record_admin_login_attempt(email: str, success: bool) -> None:
    if success:
        await db.admin_login_attempts.delete_one({"email": email})
        return
    now = datetime.now(timezone.utc)
    doc = await db.admin_login_attempts.find_one({"email": email}) or {"email": email, "count": 0}
    count = int(doc.get("count", 0)) + 1
    update = {"email": email, "count": count, "last_attempt": now.isoformat()}
    if count >= _ADMIN_LOGIN_MAX_ATTEMPTS:
        update["locked_until"] = (now + timedelta(minutes=_ADMIN_LOGIN_LOCKOUT_MINUTES)).isoformat()
    await db.admin_login_attempts.update_one({"email": email}, {"$set": update}, upsert=True)


@api_router.post("/auth/login")
async def admin_login(payload: LoginRequest, response: Response):
    email = payload.email.lower().strip()
    await _check_admin_lockout(email)
    user = await db.users.find_one({"email": email})
    valid = bool(user) and _verify_password(payload.password, user.get("password_hash", ""))
    await _record_admin_login_attempt(email, success=valid)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not an admin account")
    token = _create_access_token(email)
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
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
import base64 as _base64
from services.r2_storage import storage_put as _storage_put, storage_get as _storage_get, mirror_external_image as _mirror_external_image, storage_put_async as _storage_put_async, get_public_url as _get_public_url

_OBJ_APP_NAME = "yourownprint"


@app.on_event("startup")
async def _startup_init_storage():
    # R2 client is created lazily on first use (see services/r2_storage.py);
    # nothing to pre-warm at boot, but we keep this hook so future storage
    # backends can plug in here without touching call sites.
    pass


# ============================================================================
# Portfolio (admin-curated gallery of past prints)
# ============================================================================

PORTFOLIO_CATEGORIES = [
    "workwear", "team-kits", "leavers", "sports", "fitness", "hospitality",
    "schools", "events", "beauty", "barbering", "other",
    # Carousels / design libraries — same admin CRUD, but consumed by specific pages
    "fight-night-action",
    "festival-tees-and-brands",
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
async def list_portfolio(category: Optional[str] = None, featured_only: bool = False,
                         featured: bool = False, limit: int = 200, offset: int = 0):
    q: Dict = {"is_hidden": {"$ne": True}}
    if category and category != "all":
        q["category"] = category
    # `featured` is accepted as well as `featured_only` because a caller passing
    # the shorter name got no error and no filtering — the request just quietly
    # returned everything. Better to honour both than to fail silently again.
    if featured_only or featured:
        q["featured"] = True
    limit = max(1, min(int(limit or 200), 500))
    offset = max(0, int(offset or 0))
    total = await db.portfolio.count_documents(q)
    items: List[Dict] = []
    # Sorted in the query, not just after the fact. Previously the limit was
    # applied to Mongo's natural order and only the returned slice was sorted,
    # so past the cap you got an arbitrary batch of photos rather than the first
    # N by display order — reordering in the admin had no effect on which ones
    # made the cut, only on how that arbitrary batch was arranged.
    cursor = db.portfolio.find(q).sort([("display_order", 1), ("created_at", 1)]).skip(offset).limit(limit)
    async for d in cursor:
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
    # Re-sorted here too: documents saved before display_order existed have no
    # such field, and Mongo sorts a missing field ahead of every number whereas
    # this treats it as 0, which is how the gallery has always looked.
    items.sort(key=lambda x: (x["display_order"], x["created_at"] or ""))
    return {
        "categories": PORTFOLIO_CATEGORIES,
        "items": items,
        "total": total,
        "offset": offset,
        "limit": limit,
    }


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


# ---------- Public artwork upload (for configurator design uploads) ----------
class ArtworkUploadPayload(BaseModel):
    image_data_url: str
    filename: Optional[str] = ""
    purpose: Optional[str] = "artwork"  # informational tag: 'front-artwork' | 'back-artwork' | etc.


@api_router.post("/uploads/artwork")
async def upload_artwork(payload: ArtworkUploadPayload):
    """Public endpoint used by the configurators to attach print files to quote requests.
    Stores the file in R2 and returns a public URL served via
    /api/uploads/artwork/{filename} (auth-free since these are quote attachments)."""
    raw, content_type, ext = _parse_data_url(payload.image_data_url, max_bytes=10_000_000)
    item_id = str(uuid.uuid4())
    storage_path = f"{_OBJ_APP_NAME}/artwork/{item_id}.{ext}"
    try:
        _storage_put(storage_path, raw, content_type)
    except HTTPException:
        raise HTTPException(500, "Artwork upload failed — storage not configured")
    doc = {
        "id": item_id,
        "storage_path": storage_path,
        "content_type": content_type,
        "filename": (payload.filename or f"{item_id}.{ext}")[:200],
        "purpose": (payload.purpose or "artwork")[:60],
        "size_bytes": len(raw),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.artwork_uploads.insert_one(doc)
    return {
        "id": item_id,
        "url": f"/api/uploads/artwork/{item_id}.{ext}",
        "filename": doc["filename"],
        "size_bytes": doc["size_bytes"],
    }


@api_router.get("/uploads/artwork/{filename}")
async def get_artwork(filename: str):
    item_id = filename.rsplit(".", 1)[0]
    doc = await db.artwork_uploads.find_one({"id": item_id})
    if not doc:
        raise HTTPException(404, "Artwork not found")
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
                    {"label": "Festival & DJ Merch", "to": "/festival-tees-and-brands"},
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
                    {"label": "Promotional & Gifts", "to": "/shop/promotional"},
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
                    {"label": "Full Squad Configurator", "to": "/full-squad-configurator", "badge": "New"},
                ]},
                {"heading": "Fitness", "links": [
                    {"label": "Sports Outfit Configurator", "to": "/sports-outfit-configurator", "badge": "New"},
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


# ============================================================================
# Bundle variants — admin-defined brand/tier options for kit bundle products
# (e.g. AWD / Nike / Umbro / Pro / Standard). Each variant carries its own
# price, image, description, size guide + display order.
# ============================================================================

BUNDLE_ELIGIBLE_IDS = {
    "football-kit-bundle", "football-premium-bundle",
    "football-kit-front-only", "football-premium-front-only",
    "rugby-kit-bundle", "rugby-kit-front-only",
    "training-tracksuit", "training-tee", "training-pack-bundle", "training-pack-front-only",
    "sports-team-bundle",
    # Full Squad Configurator set slots
    "full-squad-match-day", "full-squad-training", "full-squad-tracksuit",
    # Sports Outfit Configurator set slots (gyms/PTs/boxing)
    "sports-outfit-training", "sports-outfit-tracksuit",
}


class BundleVariantIn(BaseModel):
    bundle_product_id: str
    brand: str = ""
    name: str
    description: str = ""
    price: float
    image: Optional[str] = None      # data-URL or existing image_url
    size_guide_table: Optional[List[Dict[str, Any]]] = None
    display_order: int = 0
    is_active: bool = True


class BundleVariantPatch(BaseModel):
    brand: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    size_guide_table: Optional[List[Dict[str, Any]]] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


def _serialise_variant(d: Dict) -> Dict:
    return {
        "id": d["id"],
        "bundle_product_id": d["bundle_product_id"],
        "brand": d.get("brand", ""),
        "name": d.get("name", ""),
        "description": d.get("description", ""),
        "price": float(d.get("price") or 0),
        "image": d.get("image"),
        "size_guide_table": d.get("size_guide_table") or [],
        "display_order": int(d.get("display_order") or 0),
        "is_active": bool(d.get("is_active", True)),
    }


@api_router.get("/bundles/{bundle_id}/variants")
async def list_bundle_variants(bundle_id: str):
    """Public — variants shown to customers on the configurator."""
    out: List[Dict] = []
    async for d in db.bundle_variants.find({"bundle_product_id": bundle_id, "is_active": True}):
        out.append(_serialise_variant(d))
    out.sort(key=lambda x: (x["display_order"], x["price"]))
    return out


@api_router.get("/admin/bundle-variants", dependencies=[Depends(require_admin)])
async def admin_list_bundle_variants(bundle_id: Optional[str] = None):
    q: Dict = {}
    if bundle_id:
        q["bundle_product_id"] = bundle_id
    out: List[Dict] = []
    async for d in db.bundle_variants.find(q):
        item = _serialise_variant(d)
        item["created_at"] = d.get("created_at")
        out.append(item)
    out.sort(key=lambda x: (x["bundle_product_id"], x["display_order"], x["price"]))
    # Return meta about eligible bundles too so the admin UI can show a dropdown
    return {"eligible_bundles": sorted([{"id": pid, "name": PRODUCTS[pid]["name"]} for pid in BUNDLE_ELIGIBLE_IDS if pid in PRODUCTS], key=lambda x: x["name"]), "variants": out}


@api_router.post("/admin/bundle-variants", dependencies=[Depends(require_admin)])
async def admin_create_bundle_variant(payload: BundleVariantIn):
    if payload.bundle_product_id not in PRODUCTS:
        raise HTTPException(400, f"Unknown bundle product '{payload.bundle_product_id}'")
    if payload.bundle_product_id not in BUNDLE_ELIGIBLE_IDS:
        raise HTTPException(400, f"'{payload.bundle_product_id}' isn't a bundle-eligible product")
    if payload.price < 0.5:
        raise HTTPException(400, "Price must be at least £0.50 (Stripe minimum)")

    variant_id = str(uuid.uuid4())
    image_url = payload.image
    # If a data-URL was uploaded, store it on the R2/object-storage and return a stable URL
    if image_url and image_url.startswith("data:"):
        raw, content_type, ext = _parse_data_url(image_url)
        storage_path = f"{_OBJ_APP_NAME}/bundle-variants/{variant_id}.{ext}"
        try:
            _storage_put(storage_path, raw, content_type)
            image_url = f"/api/portfolio/file/{variant_id}.{ext}"
            # We reuse the portfolio.file endpoint — store a portfolio doc so it can serve
            await db.portfolio.insert_one({
                "id": variant_id,
                "title": f"{payload.brand} {payload.name}".strip() or "Bundle variant",
                "category": "other", "caption": "Bundle variant image", "alt_text": payload.name,
                "image_url": image_url, "storage_path": storage_path,
                "content_type": content_type, "size_bytes": len(raw),
                "display_order": 9999, "featured": False, "is_hidden": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except HTTPException:
            # Object storage not configured — keep the data-URL inline (works fine, just bigger payload)
            pass

    doc = {
        "id": variant_id,
        "bundle_product_id": payload.bundle_product_id,
        "brand": payload.brand.strip()[:60],
        "name": payload.name.strip()[:80] or "Variant",
        "description": (payload.description or "").strip()[:800],
        "price": round(float(payload.price), 2),
        "image": image_url,
        "size_guide_table": payload.size_guide_table or [],
        "display_order": int(payload.display_order or 0),
        "is_active": bool(payload.is_active),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bundle_variants.insert_one(doc)
    return _serialise_variant(doc)


@api_router.patch("/admin/bundle-variants/{variant_id}", dependencies=[Depends(require_admin)])
async def admin_update_bundle_variant(variant_id: str, payload: BundleVariantPatch):
    existing = await db.bundle_variants.find_one({"id": variant_id})
    if not existing:
        raise HTTPException(404, "Variant not found")
    patch: Dict = {}
    for k in ("brand", "name", "description", "display_order", "is_active", "size_guide_table"):
        v = getattr(payload, k)
        if v is not None:
            patch[k] = v
    if payload.price is not None:
        if payload.price < 0.5:
            raise HTTPException(400, "Price must be at least £0.50")
        patch["price"] = round(float(payload.price), 2)
    if payload.image is not None:
        img = payload.image
        if img.startswith("data:"):
            raw, content_type, ext = _parse_data_url(img)
            storage_path = f"{_OBJ_APP_NAME}/bundle-variants/{variant_id}.{ext}"
            try:
                _storage_put(storage_path, raw, content_type)
                img = f"/api/portfolio/file/{variant_id}.{ext}"
                await db.portfolio.update_one(
                    {"id": variant_id},
                    {"$set": {"id": variant_id, "image_url": img, "storage_path": storage_path,
                              "content_type": content_type, "size_bytes": len(raw),
                              "is_hidden": True, "category": "other"}},
                    upsert=True,
                )
            except HTTPException:
                pass
        patch["image"] = img
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bundle_variants.update_one({"id": variant_id}, {"$set": patch})
    return {"ok": True}


@api_router.delete("/admin/bundle-variants/{variant_id}", dependencies=[Depends(require_admin)])
async def admin_delete_bundle_variant(variant_id: str):
    res = await db.bundle_variants.delete_one({"id": variant_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Variant not found")
    return {"ok": True}


# ============================================================================
# Full Squad Configurator — generic multi-set builder (match-day + training + tracksuit)
# ============================================================================

# Which garments show up under each section. Admin can override via the products catalogue.
FULL_SQUAD_SECTIONS: List[Dict] = [
    {
        "key": "match_day",
        "title": "Match Day set",
        "subtitle": "Shirt + shorts + socks — names & numbers on the back, included in the price.",
        "set_product_id": "full-squad-match-day",     # bundle_product_id used for brand variants
        "included_items": ["Shirt", "Shorts", "Socks"],
        "supports_names_numbers": True,
        "requires_per_player_roster": True,
    },
    {
        "key": "training",
        "title": "Training set",
        "subtitle": "Top + shorts + socks — clean front badge, each kit labelled with the player's name.",
        "set_product_id": "full-squad-training",
        "included_items": ["Top", "Shorts", "Socks"],
        "supports_names_numbers": False,
        "requires_per_player_roster": True,
    },
    {
        "key": "tracksuit",
        "title": "Tracksuit set",
        "subtitle": "Hoodie/jacket + joggers — arrival, warm-up and travel wear, labelled per player.",
        "set_product_id": "full-squad-tracksuit",
        "included_items": ["Hoodie/Jacket", "Joggers"],
        "supports_names_numbers": False,
        "requires_per_player_roster": True,
    },
]

# Sports Outfit Configurator (Gyms/PTs/Boxing/Thai/Kick) — a simpler, socks-less two-set builder.
SPORTS_OUTFIT_SECTIONS: List[Dict] = [
    {
        "key": "training",
        "title": "Training kit",
        "subtitle": "Top + shorts — perfect for gyms, PTs and combat sports.",
        "set_product_id": "sports-outfit-training",
        "included_items": ["Top", "Shorts"],
    },
    {
        "key": "tracksuit",
        "title": "Tracksuit",
        "subtitle": "Hoodie + joggers — arrivals, warm-up, seminars.",
        "set_product_id": "sports-outfit-tracksuit",
        "included_items": ["Hoodie", "Joggers"],
    },
]

# Optional add-on print upcharges (£) — admin can override at settings.full_squad_addons.
FULL_SQUAD_ADDON_DEFAULTS = {
    "sleeve_print_price": 2.00,
    "back_upload_print_price": 4.00,
    "back_name_and_number_price": 6.00,   # only relevant on non-match-day items if they opt in
    "gym_bag_addon_price": 4.00,          # printed drawstring gym bag with badge + player name
}

# Sports Outfit print add-ons — mutually exclusive on the customer side.
SPORTS_OUTFIT_ADDON_DEFAULTS = {
    "unbranded_price": 0.00,          # no print
    "breast_print_price": 3.00,        # small left-breast logo
    "back_print_price": 4.00,          # centred back print (tops only)
    "full_front_print_price": 6.00,    # large front print — replaces breast option
    # Global rule: shorts / joggers / bottoms NEVER get back-print orders.
}

# Default sock size options (UK shoe-size ranges). Admin can edit via /api/admin/sock-sizes.
DEFAULT_SOCK_SIZES = ["3–5", "6–8", "9–11", "12–14"]

# Global rule: product IDs (or category matches) that CANNOT receive a back print.
NO_BACK_PRINT_PRODUCT_IDS = {
    "football-shorts", "gym-shorts", "performance-leggings",
    "joggers", "workwear-trousers",
}


async def _brand_variants_for(product_id: str) -> List[Dict]:
    """Return active brand variants for a set slot product ID, sorted by display_order then price."""
    out: List[Dict] = []
    _fields = ["id", "product_id", "brand", "name", "price", "image", "description", "active",
               "colours", "sizes", "sock_sizes", "size_guide", "included_items", "display_order"]
    async for d in db.team_kit_brands.find({"product_id": product_id, "active": True}) \
            .sort([("display_order", 1), ("price", 1)]):
        out.append({k: d.get(k) for k in _fields})
    return out


async def _get_sock_sizes() -> List[str]:
    doc = await db.settings.find_one({"key": "sock_size_options"})
    if doc and isinstance(doc.get("values"), list) and doc["values"]:
        return [str(s) for s in doc["values"]]
    return list(DEFAULT_SOCK_SIZES)


@api_router.get("/full-squad/config")
async def get_full_squad_config():
    """Return the config for the Full Squad Configurator — sections + brand variants + prices."""
    doc = await db.settings.find_one({"key": "full_squad_addons"}) or {}
    addons = {**FULL_SQUAD_ADDON_DEFAULTS, **(doc.get("values") or {})}
    sock_sizes = await _get_sock_sizes()
    sections: List[Dict] = []
    for sec in FULL_SQUAD_SECTIONS:
        set_pid = sec["set_product_id"]
        base_product = PRODUCTS.get(set_pid, {})
        variants = await _brand_variants_for(set_pid)
        # If admin hasn't added any variants for this set slot yet, expose a synthetic "default"
        # variant so the configurator still works out-of-the-box.
        if not variants and base_product:
            variants = [{
                "id": f"default-{set_pid}",
                "product_id": set_pid,
                "brand": "Standard",
                "name": base_product.get("name", set_pid),
                "price": float(base_product.get("price", 0)),
                "image": base_product.get("image", ""),
                "description": base_product.get("description", ""),
                "colours": base_product.get("colors") or [],
                "sizes": base_product.get("sizes") or [],
                "sock_sizes": sock_sizes,
                "size_guide": "",
                "included_items": sec.get("included_items", []),
                "display_order": 0,
                "active": True,
                "is_default": True,
            }]
        else:
            # Fill in fallbacks (colours / sizes / sock_sizes / included_items) from the product record
            # so admin doesn't have to duplicate them on every variant.
            for v in variants:
                if not v.get("colours"):
                    v["colours"] = base_product.get("colors") or []
                if not v.get("sizes"):
                    v["sizes"] = base_product.get("sizes") or []
                if not v.get("sock_sizes"):
                    v["sock_sizes"] = sock_sizes
                if not v.get("included_items"):
                    v["included_items"] = sec.get("included_items", [])
        sections.append({**sec, "variants": variants})
    return {
        "sections": sections,
        "addons": addons,
        "sock_sizes": sock_sizes,
        "proof_days": 2,
    }


@api_router.get("/sports-outfit/config")
async def get_sports_outfit_config():
    """Config for the simpler Gyms/PTs/Boxing sports outfit configurator."""
    doc = await db.settings.find_one({"key": "sports_outfit_addons"}) or {}
    addons = {**SPORTS_OUTFIT_ADDON_DEFAULTS, **(doc.get("values") or {})}
    sections: List[Dict] = []
    for sec in SPORTS_OUTFIT_SECTIONS:
        set_pid = sec["set_product_id"]
        base_product = PRODUCTS.get(set_pid, {})
        variants = await _brand_variants_for(set_pid)
        if not variants and base_product:
            variants = [{
                "id": f"default-{set_pid}",
                "product_id": set_pid,
                "brand": "Standard",
                "name": base_product.get("name", set_pid),
                "price": float(base_product.get("price", 0)),
                "image": base_product.get("image", ""),
                "description": base_product.get("description", ""),
                "colours": base_product.get("colors") or [],
                "sizes": base_product.get("sizes") or [],
                "size_guide": "",
                "included_items": sec.get("included_items", []),
                "display_order": 0,
                "active": True,
                "is_default": True,
            }]
        else:
            for v in variants:
                if not v.get("colours"):
                    v["colours"] = base_product.get("colors") or []
                if not v.get("sizes"):
                    v["sizes"] = base_product.get("sizes") or []
                if not v.get("included_items"):
                    v["included_items"] = sec.get("included_items", [])
        sections.append({**sec, "variants": variants})
    return {"sections": sections, "addons": addons, "proof_days": 2}


@api_router.get("/sock-sizes")
async def get_sock_sizes():
    return {"sock_sizes": await _get_sock_sizes()}


@api_router.patch("/admin/sock-sizes", dependencies=[Depends(require_admin)])
async def admin_update_sock_sizes(payload: Dict):
    values = payload.get("values")
    if not isinstance(values, list):
        raise HTTPException(400, "values must be a list of strings")
    cleaned = [str(v).strip()[:24] for v in values if str(v).strip()][:12]
    if not cleaned:
        raise HTTPException(400, "At least one sock size is required")
    await db.settings.update_one(
        {"key": "sock_size_options"},
        {"$set": {"key": "sock_size_options", "values": cleaned,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "values": cleaned}


# Configurator addons — extracted to /app/backend/routers/configurator_addons.py.
# The following endpoints now live there: PATCH /admin/sports-outfit/addons,
# PATCH /admin/full-squad/addons, GET /admin/configurator-settings.


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


def _nav_all_targets(config: Dict) -> set:
    """Every `to` value present anywhere in a nav config."""
    out = set()
    for item in (config.get("menu") or []):
        if item.get("to"):
            out.add(item["to"])
        for col in (item.get("columns") or []):
            for lnk in (col.get("links") or []):
                if lnk.get("to"):
                    out.add(lnk["to"])
    return out


def _nav_missing_defaults(saved: Dict) -> List[Dict]:
    """Links that exist in the shipped default menu but not in the admin's
    saved menu — i.e. new sections added by a site update that the admin
    hasn't got yet. Returned with enough context to insert them in the
    right place, without touching anything the admin has customised."""
    have = _nav_all_targets(saved)
    missing: List[Dict] = []
    for item in DEFAULT_NAV_CONFIG["menu"]:
        for col in (item.get("columns") or []):
            for lnk in (col.get("links") or []):
                if lnk.get("to") and lnk["to"] not in have:
                    missing.append({
                        "menu_key": item["key"],
                        "menu_label": item["label"],
                        "column_heading": col.get("heading") or "",
                        "label": lnk["label"],
                        "to": lnk["to"],
                        "badge": lnk.get("badge"),
                    })
    return missing


@api_router.get("/admin/navigation/missing-defaults", dependencies=[Depends(require_admin)])
async def navigation_missing_defaults():
    """Non-destructive check: what has the site added since this menu was saved?"""
    doc = await db.settings.find_one({"key": "navigation_config"})
    if not doc or not doc.get("config"):
        # No saved override — the default is live already, nothing is missing.
        return {"using_default": True, "missing": []}
    return {"using_default": False, "missing": _nav_missing_defaults(doc["config"])}


@api_router.post("/admin/navigation/add-missing-defaults", dependencies=[Depends(require_admin)])
async def navigation_add_missing_defaults():
    """Adds only the missing default links into the saved menu, leaving every
    existing item, label, order and customisation exactly as it is. This is
    the safe alternative to 'Reset to default', which discards changes."""
    doc = await db.settings.find_one({"key": "navigation_config"})
    if not doc or not doc.get("config"):
        return {"ok": True, "added": 0, "using_default": True}

    config = doc["config"]
    missing = _nav_missing_defaults(config)
    if not missing:
        return {"ok": True, "added": 0}

    by_key = {m.get("key"): m for m in config.get("menu", [])}
    for entry in missing:
        target_menu = by_key.get(entry["menu_key"])
        if target_menu is None:
            # Whole menu section is absent — recreate it from the default.
            src = next((m for m in DEFAULT_NAV_CONFIG["menu"] if m["key"] == entry["menu_key"]), None)
            if not src:
                continue
            target_menu = {"key": src["key"], "label": src["label"], "to": src.get("to"), "columns": []}
            config.setdefault("menu", []).append(target_menu)
            by_key[entry["menu_key"]] = target_menu

        columns = target_menu.setdefault("columns", [])
        col = next((c for c in columns if (c.get("heading") or "") == entry["column_heading"]), None)
        if col is None:
            col = {"heading": entry["column_heading"], "links": []}
            columns.append(col)
        link = {"label": entry["label"], "to": entry["to"]}
        if entry.get("badge"):
            link["badge"] = entry["badge"]
        col.setdefault("links", []).append(link)

    config["version"] = int(config.get("version", 1)) + 1
    await db.settings.update_one(
        {"key": "navigation_config"},
        {"$set": {"key": "navigation_config", "config": config,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "added": len(missing), "version": config["version"]}


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
    "pencarrie_api_token": {"label": "PenCarrie API Token", "kind": "secret", "env": "PENCARRIE_API_TOKEN",
                             "help": "From PenCarrie: My Account > Account Settings > API Access Tokens. Used to pull the product catalogue automatically."},
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


from deps import _get_integration_value  # replaces the local duplicate


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
async def _canonicalise_stored_industry_tags():
    """One-time repair: fold alias industry slugs already in the database onto
    their canonical form.

    The original seed wrote both forms on purpose (a product got "trades" *and*
    "construction-trades"), which is what produced the row of stray 1s in the
    sidebar. Canonicalising on read fixes the display, but leaving the aliases
    in the database means anything reading the collection directly still sees
    them, so clean the stored rows too.

    Marker-guarded, and only writes rows that actually change — a no-op on
    every boot after the first.
    """
    try:
        marker = await db.settings.find_one({"key": "industry_canonicalise_v1"})
        if marker is not None:
            return
        fixed = 0
        cursor = db.product_meta.find({"industry_tags": {"$exists": True, "$ne": []}})
        async for row in cursor:
            pid = row.get("product_id")
            before = row.get("industry_tags") or []
            after = canonical_industries(before)
            if after == before:
                continue
            await db.product_meta.update_one(
                {"product_id": pid},
                {"$set": {"industry_tags": after,
                          "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            # Keep the in-memory copy in step, or the sidebar keeps showing the
            # old counts until the next restart.
            if pid in PRODUCTS:
                PRODUCTS[pid]["industry_tags"] = after
            fixed += 1

        # Imported products keep their tags on the product document itself.
        cursor = db.imported_products.find({"industry_tags": {"$exists": True, "$ne": []}})
        async for row in cursor:
            pid = row.get("id")
            before = row.get("industry_tags") or []
            after = canonical_industries(before)
            if after == before:
                continue
            await db.imported_products.update_one(
                {"id": pid},
                {"$set": {"industry_tags": after}},
            )
            if pid in PRODUCTS:
                PRODUCTS[pid]["industry_tags"] = after
            fixed += 1

        await db.settings.update_one(
            {"key": "industry_canonicalise_v1"},
            {"$set": {"key": "industry_canonicalise_v1", "fixed": fixed,
                      "ran_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        print(f"industry canonicalisation: {fixed} product(s) tidied")
    except Exception as e:
        print(f"industry canonicalisation failed: {e}")


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
            tags = canonical_industries(tags)
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


# ============================================================================
# Product overrides — admin can edit ANY hardcoded product's name/price/etc.
# Overrides live in Mongo `product_overrides` and are applied on startup +
# on write.
# ============================================================================
class ProductOverride(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image: Optional[str] = None
    additional_images: Optional[List[str]] = None
    category: Optional[str] = None
    gender_fit: Optional[str] = None
    industry_tags: Optional[List[str]] = None
    colors: Optional[List[Dict]] = None
    sizes: Optional[List[str]] = None
    active: Optional[bool] = None


def _apply_product_override(pid: str, ov: Dict) -> None:
    """Apply an override doc onto the in-memory PRODUCTS entry (skips None values)."""
    if pid not in PRODUCTS or not ov:
        return
    for field in ("name", "price", "description", "image", "additional_images",
                  "category", "gender_fit", "industry_tags", "colors", "sizes"):
        val = ov.get(field)
        if val is not None:
            PRODUCTS[pid][field] = val
    if ov.get("active") is False:
        PRODUCTS[pid]["_hidden"] = True
    elif ov.get("active") is True:
        PRODUCTS[pid].pop("_hidden", None)


# Snapshot the pristine hardcoded PRODUCTS entries so admin can fully revert an
# override at runtime (without waiting for a supervisor restart).
import copy as _copy
_PRISTINE_PRODUCTS: Dict[str, Dict] = _copy.deepcopy(PRODUCTS)


@app.on_event("startup")
async def _load_product_overrides():
    try:
        count = 0
        async for d in db.product_overrides.find():
            _apply_product_override(d["product_id"], d)
            count += 1
        if count:
            logging.info(f"Applied {count} product overrides.")
    except Exception as e:
        logging.warning(f"Product-override load skipped: {e}")


@api_router.patch("/admin/products/{pid}/override", dependencies=[Depends(require_admin)])
async def upsert_product_override(pid: str, patch: ProductOverride):
    if pid not in PRODUCTS:
        raise HTTPException(404, "Product not found")
    up = patch.model_dump(exclude_none=True)
    if not up:
        return {"ok": True, "unchanged": True}
    up["product_id"] = pid
    up["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.product_overrides.update_one({"product_id": pid}, {"$set": up}, upsert=True)
    _apply_product_override(pid, up)
    return {"ok": True, "override": up}


@api_router.delete("/admin/products/{pid}/override", dependencies=[Depends(require_admin)])
async def clear_product_override(pid: str):
    r = await db.product_overrides.delete_one({"product_id": pid})
    # Restore the in-memory PRODUCTS entry to its pristine hardcoded values so the
    # site reflects the revert immediately (no restart needed).
    if pid in _PRISTINE_PRODUCTS:
        PRODUCTS[pid] = _copy.deepcopy(_PRISTINE_PRODUCTS[pid])
    if r.deleted_count == 0:
        return {"ok": True, "deleted": 0, "note": "no override existed"}
    return {"ok": True, "deleted": r.deleted_count}


@api_router.get("/admin/products/{pid}/override", dependencies=[Depends(require_admin)])
async def get_product_override(pid: str):
    doc = await db.product_overrides.find_one({"product_id": pid})
    if not doc:
        return {"product_id": pid, "override": None}
    doc.pop("_id", None)
    return {"product_id": pid, "override": doc}


# ============================================================================
# Page copy CMS — extracted to /app/backend/routers/cms_page_copy.py
# The `PAGE_COPY_SLUGS` allow-list, `PageCopyPatch` model, and CRUD endpoints
# all live there now.
# ============================================================================
from routers.cms_page_copy import PAGE_COPY_SLUGS, PageCopyPatch  # noqa: F401 — re-exported for legacy imports


# ============================================================================
# Configurator addons — extracted to /app/backend/routers/configurator_addons.py
# ============================================================================


# ============================================================================
# Imported products (one-off bulk import — PenCarrie / manual)
# ============================================================================
class ImportedProduct(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    category: Optional[str] = "t-shirts"
    image: str
    additional_images: Optional[List[str]] = None
    description: Optional[str] = ""
    gender_fit: Optional[str] = "unisex"
    industry_tags: Optional[List[str]] = None
    colors: Optional[List[Dict]] = None
    sizes: Optional[List[str]] = None
    size_upcharges: Optional[Dict[str, float]] = None
    source: Optional[str] = "manual"
    source_sku: Optional[str] = ""
    brand: Optional[str] = ""
    active: Optional[bool] = True


# Keyword → internal category. First match wins. Falls back to "t-shirts".
_AUTO_CATEGORY_RULES: List[Tuple[str, str]] = [
    ("apron", "aprons"),
    ("polo", "polos"),
    ("zoodie", "hoodies"),  # zip-up hoodie
    ("hoodie", "hoodies"),
    ("hoody", "hoodies"),
    ("sweatshirt", "sweatshirts"),
    ("sweat top", "sweatshirts"),
    ("sweater", "sweatshirts"),
    ("cardigan", "sweatshirts"),
    ("crew", "sweatshirts"),
    ("jog pant", "bottoms"),
    ("jogger", "bottoms"),
    ("track pant", "bottoms"),
    ("legging", "bottoms"),
    ("chino", "bottoms"),
    ("trouser", "bottoms"),
    ("cargo", "bottoms"),
    ("jean", "bottoms"),
    ("skort", "bottoms"),
    ("pant", "bottoms"),  # catches remaining "...pants" not matched above
    ("shorts", "shorts"),  # gym shorts, jog shorts, training shorts, campus shorts, etc. — plural specifically, so this never matches "short sleeve"
    ("jacket", "jackets"),
    ("softshell", "jackets"),
    ("gilet", "jackets"),
    ("body warmer", "jackets"),
    ("bodywarmer", "jackets"),
    ("fleece", "jackets"),
    ("coat", "jackets"),
    ("coverall", "jackets"),
    ("waistcoat", "jackets"),
    ("hi vis", "hi-vis"),
    ("hi-vis", "hi-vis"),
    ("hivis", "hi-vis"),
    ("high visibility", "hi-vis"),
    ("cap", "hats"),
    ("beanie", "hats"),
    ("snapback", "hats"),
    ("fedora", "hats"),
    ("trilby", "hats"),
    ("bucket hat", "hats"),
    ("hat", "hats"),
    ("bag", "bags"),
    ("rucksack", "bags"),
    ("backpack", "bags"),
    ("tote", "bags"),
    ("shopper", "bags"),
    ("holdall", "bags"),
    ("weekender", "bags"),
    ("gymsac", "bags"),
    ("daypack", "bags"),
    ("pouch", "bags"),
    ("case", "bags"),
    ("sock", "socks"),
    ("trainer", "footwear"),
    ("boot", "footwear"),
    ("hiker", "footwear"),
    ("clog", "footwear"),
    ("slider", "footwear"),
    ("glove", "accessories"),
    ("scarf", "accessories"),
    ("hand warmer", "accessories"),
    ("headband", "accessories"),
    ("tie", "accessories"),
    ("towel", "towels"),
    ("blanket", "towels"),
    ("robe", "towels"),
    ("tunic", "shirts"),
    ("blouse", "shirts"),
    ("bodysuit", "t-shirts"),
    ("vest", "t-shirts"),
    ("base layer", "t-shirts"),
    ("top", "t-shirts"),
    ("neck warmer", "hats"),
    ("snood", "hats"),
    ("balaclava", "hats"),
    ("visor", "hats"),
    ("blazer", "jackets"),
    ("jersey", "t-shirts"),
    ("singlet", "t-shirts"),
    ("sports bra", "t-shirts"),
    # Gift / promotional novelty items — teddy bears, keyrings, comforters etc.
    # (not garments, but a real product line worth its own collection).
    ("mumbles", "promotional"),
    ("teddy", "promotional"),
    (" bear", "promotional"),
    ("comforter", "promotional"),
    ("key ring", "promotional"),
    ("keyring", "promotional"),
    ("rattle", "promotional"),
    # Baby/toddler wear — a distinct customer (parents), not workwear/teamwear.
    ("larkwood", "kids-baby"),
    ("sleepsuit", "kids-baby"),
    ("dungaree", "kids-baby"),
    ("pyjama", "kids-baby"),
    ("baby/toddler", "kids-baby"),
    ("toddler", "kids-baby"),
    (" bib", "kids-baby"),
    ("shirt", "t-shirts"),
    ("tee", "t-shirts"),
    ("t-shirt", "t-shirts"),
]


def _auto_category(name: str, description: str = "") -> str:
    hay = f"{name} {description}".lower()
    for keyword, category in _AUTO_CATEGORY_RULES:
        if keyword in hay:
            return category
    return "t-shirts"


def _auto_gender_fit(name: str) -> str:
    hay = name.lower()
    if any(k in hay for k in ("ladies", "women's", "womens", "female fit")):
        return "womens"
    if any(k in hay for k in ("men's", "mens fit", "male fit")) and "women" not in hay and "ladies" not in hay:
        return "mens"
    if any(k in hay for k in ("kids", "children", "junior", "youth", " infant")):
        return "kids"
    return "unisex"


# Best-guess only — garment type/name doesn't reliably imply a sector, so this
# is deliberately conservative (max 2 tags) and meant to be spot-checked, not
# treated as gospel. Only fires into REAL industry slugs (INDUSTRY_SLUGS).
_AUTO_INDUSTRY_TAG_RULES: List[Tuple[str, List[str]]] = [
    ("hi-vis", ["construction-trades"]),
    ("hi vis", ["construction-trades"]),
    ("apron", ["hospitality-catering"]),
    ("chef", ["hospitality-catering"]),
    ("tunic", ["healthcare", "beauty-wellness"]),
    ("scrub", ["healthcare"]),
    ("nurse", ["healthcare"]),
    ("salon", ["beauty-wellness"]),
    ("beauty", ["beauty-wellness"]),
    ("barber", ["beauty-wellness"]),
    ("gym", ["sports-fitness"]),
    ("tracksuit", ["sports-fitness"]),
    ("hoodie", ["sports-fitness"]),
    # sports-fitness previously had only 3 keywords, so gym/fitness pages were
    # very thinly populated — most activewear names never matched anything.
    ("performance", ["sports-fitness"]),
    ("running", ["sports-fitness"]),
    ("jogger", ["sports-fitness"]),
    ("jog ", ["sports-fitness"]),
    ("training", ["sports-fitness"]),
    ("athletic", ["sports-fitness"]),
    ("sport", ["sports-fitness"]),
    ("football", ["sports-fitness"]),
    ("rugby", ["sports-fitness"]),
    ("netball", ["sports-fitness"]),
    ("cricket", ["sports-fitness"]),
    ("baselayer", ["sports-fitness"]),
    ("base layer", ["sports-fitness"]),
    ("active", ["sports-fitness"]),
    ("fitness", ["sports-fitness"]),
    ("wicking", ["sports-fitness"]),
    ("sweatpant", ["sports-fitness"]),
    ("legging", ["sports-fitness"]),
    ("yoga", ["sports-fitness"]),
    ("boxing", ["sports-fitness"]),
    ("marathon", ["sports-fitness"]),
    ("softshell", ["construction-trades"]),
    ("workwear", ["construction-trades"]),
    ("cleaning", ["cleaning"]),
    ("security", ["security"]),
    ("door supervisor", ["security"]),
    ("guard", ["security"]),
    ("sia ", ["security"]),
    ("warehouse", ["industrial"]),
    ("forklift", ["industrial"]),
    ("industrial", ["industrial"]),
    ("corporate", ["corporate"]),
    ("office", ["corporate"]),
    ("executive", ["corporate"]),
    ("blazer", ["corporate"]),
    ("retail", ["retail"]),
]

# Generic blanks (plain tees, sweatshirts, hoodies, jackets, trousers) are
# very commonly bought and branded as everyday workwear across trades — tag
# them for that too, on top of anything more specific, so browsing by
# industry/sector actually surfaces the realistic full range rather than
# only specialist items like hi-vis or chef wear.
_BROAD_WORKWEAR_CATEGORIES = {"t-shirts", "sweatshirts", "hoodies", "jackets", "bottoms"}

# Polos and shirts are genuinely worn as branded uniform across trades,
# security, AND corporate/office settings — unlike the categories above,
# a single fallback tag would under-represent how these actually get used,
# so give them a richer, plausible spread instead of trades-only.
_VERSATILE_CATEGORY_FALLBACKS = {
    "polos": ["construction-trades", "corporate", "security"],
    "shirts": ["corporate", "construction-trades"],
    # Shorts previously had no fallback of any kind, so a product like
    # "Running Shorts" ended up with zero tags and showed on no industry page.
    "shorts": ["sports-fitness"],
}


def _auto_industry_tags(name: str, category: str) -> List[str]:
    hay = f"{name} {category}".lower()
    tags: List[str] = []
    for keyword, industries in _AUTO_INDUSTRY_TAG_RULES:
        if keyword in hay:
            for t in industries:
                if t not in tags:
                    tags.append(t)
    norm_category = str(category or "").strip().lower()
    if norm_category in _BROAD_WORKWEAR_CATEGORIES and "construction-trades" not in tags:
        tags.append("construction-trades")
    if norm_category in _VERSATILE_CATEGORY_FALLBACKS:
        for t in _VERSATILE_CATEGORY_FALLBACKS[norm_category]:
            if t not in tags:
                tags.append(t)
    return canonical_industries(tags)[:3]


def _apply_imported_product(doc: Dict) -> None:
    """Merge an imported product doc into in-memory PRODUCTS so all endpoints see it."""
    pid = doc.get("id")
    if not pid:
        return
    PRODUCTS[pid] = {
        "id": pid,
        "name": doc.get("name", ""),
        "price": float(doc.get("price") or 0),
        "category": doc.get("category") or "t-shirts",
        "image": doc.get("image") or "",
        "additional_images": doc.get("additional_images") or [],
        "image_gallery": doc.get("additional_images") or [],
        "description": doc.get("description") or "",
        "gender_fit": doc.get("gender_fit") or "unisex",
        "industry_tags": canonical_industries(doc.get("industry_tags")),
        "colors": doc.get("colors") or [],
        "sizes": doc.get("sizes") or [],
        "size_upcharges": doc.get("size_upcharges") or {},
        # These were previously dropped entirely every time this function ran
        # (including on every server restart and every bulk-update call) —
        # meaning allowed_placements got silently wiped back to unset moments
        # after being correctly computed and saved, and brand was stored
        # under the wrong key name (_brand) that nothing else ever read.
        "allowed_placements": doc.get("allowed_placements"),
        "brand": doc.get("brand") or "",
        "source_sku": doc.get("source_sku") or "",
        "source_price": doc.get("source_price"),
        "active": doc.get("active", True),
        "imported_at": doc.get("imported_at") or "",
        "bulk_pricing_enabled": bool(doc.get("bulk_pricing_enabled")),
        "designer_enabled": doc.get("designer_enabled", False),
        "designer_image": doc.get("designer_image") or "",
        "designer_print_area": doc.get("designer_print_area"),
        "designer_images_by_colour": doc.get("designer_images_by_colour") or {},
        "_imported": True,
        "_source": doc.get("source") or "manual",
        "_brand": doc.get("brand") or "",  # kept for backward compatibility with any code still reading this key
    }


@app.on_event("startup")
async def _load_imported_products():
    """Hydrate PRODUCTS with any admin-imported products at boot."""
    try:
        count = 0
        async for d in db.imported_products.find({"active": {"$ne": False}}):
            _apply_imported_product(d)
            count += 1
        if count:
            logging.info(f"Loaded {count} imported products from Mongo.")
    except Exception as e:
        logging.warning(f"Imported-product load skipped: {e}")


def _slugify_source_sku(name: str, sku: str = "") -> str:
    import re
    src = sku or name or "product"
    s = re.sub(r"[^a-z0-9]+", "-", src.lower()).strip("-")[:60]
    return s or f"import-{uuid.uuid4().hex[:8]}"


class BulkUpdateImportedPayload(BaseModel):
    # Filter — leave all blank to apply to every imported product.
    q: Optional[str] = ""
    brand: Optional[str] = ""
    category: Optional[str] = ""
    ids: Optional[List[str]] = None  # if provided, restricts to exactly these product IDs (hand-picked)
    # Re-pricing — recalculated from each product's saved trade cost (source_price).
    # Only applies to products that actually have a source_price saved (i.e.
    # were imported with one) — products without one are left untouched.
    reprice: Optional[bool] = False
    markup_pct: Optional[float] = 0.0
    apply_vat: Optional[bool] = True
    vat_rate_pct: Optional[float] = 20.0
    charm_price_99: Optional[bool] = True
    # Bulk quantity-discount pricing toggle — None = don't touch, True/False = set for all matched.
    set_bulk_pricing_enabled: Optional[bool] = None
    # Re-runs the current industry-tag auto-detection against each matched
    # product's existing name/category — useful after the tagging rules
    # themselves change, so already-imported products can catch up without
    # needing to be re-imported from scratch.
    retag_industries: Optional[bool] = False
    # Picks a random photo from the product's own existing images (main + gallery)
    # to be the new main image, so a whole collection page doesn't default to
    # showing the same colour (often whichever came first in the supplier data)
    # for every single product.
    randomize_main_image: Optional[bool] = False
    # Re-computes allowed_placements per product from category + name (e.g.
    # sleeveless vests lose sleeve options, trousers get pocket placements
    # instead of breast/sleeve) — the sensible default set, overwritten.
    apply_placement_defaults: Optional[bool] = False
    # Repairs kids age-range sizes (e.g. "3-4", "12-13") that Excel silently
    # corrupted into real dates or bare numbers in PenCarrie's source data
    # before it was ever imported (confirmed: "3-4" typed into their sheet
    # became a stored date, "12-13" became the plain number 1213).
    fix_corrupted_sizes: Optional[bool] = False
    # Rebuilds the main image + photo gallery from each product's own
    # colors[].image list — for products where the top-level image/gallery
    # fields ended up thinned out or corrupted somewhere along the way, but
    # the per-colour images (used by the colour swatch switcher) are still intact.
    rebuild_gallery_from_colours: Optional[bool] = False
    # Re-runs garment-category auto-detection against each product's name —
    # use this after a category-detection rule changes (e.g. tunics used to
    # wrongly map to "t-shirts"), so already-imported products catch up.
    # Runs FIRST in the per-product pass, before retag/placements, so those
    # steps see the corrected category rather than the stale one.
    recategorize_products: Optional[bool] = False
    # Which page of matching products to process — required for repeated
    # calls to actually advance through different products instead of
    # reprocessing the same first batch every time.
    offset: Optional[int] = 0
    dry_run: Optional[bool] = False


@api_router.post("/admin/products/bulk-update-imported", dependencies=[Depends(require_admin)])
async def bulk_update_imported(payload: BulkUpdateImportedPayload):
    query: Dict = {}
    if payload.ids:
        query["id"] = {"$in": payload.ids}
    if payload.brand:
        query["brand"] = {"$regex": f"^{re.escape(payload.brand)}$", "$options": "i"}
    if payload.category:
        query["category"] = payload.category
    if payload.q:
        query["name"] = {"$regex": re.escape(payload.q), "$options": "i"}

    # Hard cap per request — this endpoint previously had none at all, meaning
    # "apply to all imported products" on a catalogue of thousands could hold
    # a single request open for minutes, which is exactly the kind of thing
    # that looks like the whole site going down. Process in batches instead.
    # Lowered alongside making writes concurrent below — a smaller, fast batch
    # beats a larger, slow one for keeping the site responsive meanwhile.
    HARD_CAP = 200
    total_matching = await db.imported_products.count_documents(query)
    truncated = total_matching > (payload.offset or 0) + HARD_CAP

    matched = 0
    repriced = 0
    skipped_no_cost = 0
    bulk_flag_set = 0
    retagged = 0
    randomized = 0
    placements_updated = 0
    sizes_repaired = 0
    gallery_rebuilt = 0
    recategorized = 0
    errors = 0
    error_examples = []

    # ---- Pass 1: compute every doc's update in memory (fast, no I/O) ----
    pending: List[Tuple[str, Dict]] = []
    cursor = db.imported_products.find(query).sort("id", 1).skip(payload.offset or 0).limit(HARD_CAP)
    async for doc in cursor:
        matched += 1
        update: Dict = {}
        per_doc_error = False
        effective_category = doc.get("category") or ""

        if payload.recategorize_products:
            try:
                new_category = _auto_category(doc.get("name") or "", doc.get("description") or "")
                if new_category and new_category != effective_category:
                    update["category"] = new_category
                    effective_category = new_category
                    recategorized += 1
            except Exception as e:
                per_doc_error = True
                if len(error_examples) < 5:
                    error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "step": "recategorize_products", "error": str(e)[:200]})

        if payload.reprice:
            try:
                sp = doc.get("source_price")
                if sp is None:
                    skipped_no_cost += 1
                else:
                    new_price = _price_with_vat_and_charm(
                        float(sp), payload.markup_pct, payload.apply_vat, payload.vat_rate_pct, payload.charm_price_99
                    )
                    update["price"] = new_price
                    repriced += 1
            except Exception as e:
                per_doc_error = True
                if len(error_examples) < 5:
                    error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "step": "reprice", "error": str(e)[:200]})

        if payload.set_bulk_pricing_enabled is not None:
            update["bulk_pricing_enabled"] = payload.set_bulk_pricing_enabled
            bulk_flag_set += 1

        if payload.retag_industries:
            try:
                new_tags = _auto_industry_tags(doc.get("name") or "", effective_category)
                if new_tags != canonical_industries(doc.get("industry_tags")):
                    update["industry_tags"] = new_tags
                    retagged += 1
            except Exception as e:
                per_doc_error = True
                if len(error_examples) < 5:
                    error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "step": "retag_industries", "error": str(e)[:200]})

        if payload.randomize_main_image:
            try:
                current_main = doc.get("image") or ""
                gallery = [u for u in (doc.get("additional_images") or []) if u]
                pool = ([current_main] if current_main else []) + gallery
                if len(pool) > 1:
                    new_main = random.choice(pool)
                    if new_main != current_main:
                        update["image"] = new_main
                        update["additional_images"] = [u for u in pool if u != new_main]
                        randomized += 1
            except Exception as e:
                per_doc_error = True
                if len(error_examples) < 5:
                    error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "step": "randomize_main_image", "error": str(e)[:200]})

        if payload.apply_placement_defaults:
            try:
                new_placements = _auto_allowed_placements(doc.get("name") or "", effective_category)
                if new_placements != (doc.get("allowed_placements") or []):
                    update["allowed_placements"] = new_placements
                    placements_updated += 1
            except Exception as e:
                per_doc_error = True
                if len(error_examples) < 5:
                    error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "step": "apply_placement_defaults", "error": str(e)[:200]})

        if payload.fix_corrupted_sizes:
            try:
                current_sizes = doc.get("sizes") or []
                repaired_sizes = [_repair_size_value(s) for s in current_sizes]
                if repaired_sizes != current_sizes:
                    update["sizes"] = repaired_sizes
                    sizes_repaired += 1
            except Exception as e:
                per_doc_error = True
                if len(error_examples) < 5:
                    error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "step": "fix_corrupted_sizes", "error": str(e)[:200]})

        if payload.rebuild_gallery_from_colours:
            try:
                colour_images = [c.get("image") for c in (doc.get("colors") or []) if isinstance(c, dict) and c.get("image")]
                # De-duplicate while preserving order.
                seen = set()
                colour_images = [u for u in colour_images if not (u in seen or seen.add(u))]
                if colour_images:
                    current_main = doc.get("image") or ""
                    # Keep the current main photo if it's genuinely one of this
                    # product's own colour photos; otherwise just use the first.
                    new_main = current_main if current_main in colour_images else colour_images[0]
                    new_gallery = [u for u in colour_images if u != new_main]
                    if new_main != current_main or new_gallery != (doc.get("additional_images") or []):
                        update["image"] = new_main
                        update["additional_images"] = new_gallery
                        gallery_rebuilt += 1
            except Exception as e:
                per_doc_error = True
                if len(error_examples) < 5:
                    error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "step": "rebuild_gallery_from_colours", "error": str(e)[:200]})

        if per_doc_error:
            errors += 1

        try:
            pid = doc.get("id")
            if not payload.dry_run and pid:
                merged = {**doc, **update}
                _apply_imported_product(merged)  # always sync memory to the freshly-computed state, even if no DB write was needed this time — otherwise a stale in-memory copy from before a fix existed could persist indefinitely
                if update:
                    pending.append((pid, update))
        except Exception as e:
            errors += 1
            if len(error_examples) < 5:
                error_examples.append({"id": doc.get("id"), "name": doc.get("name"), "error": str(e)[:200]})

    # ---- Pass 2: write everything to Mongo concurrently (capped), instead of
    # one-at-a-time — this is what let even a 200-500 item batch take long
    # enough to look like the site had gone down. ----
    if pending:
        semaphore = asyncio.Semaphore(20)

        async def _write_one(pid: str, update: Dict):
            async with semaphore:
                try:
                    await db.imported_products.update_one({"id": pid}, {"$set": update})
                except Exception as e:
                    return pid, str(e)[:200]
            return None

        results = await asyncio.gather(*[_write_one(pid, u) for pid, u in pending])
        for r in results:
            if r:
                errors += 1
                if len(error_examples) < 5:
                    error_examples.append({"id": r[0], "error": r[1]})

    return {
        "ok": True,
        "matched": matched,
        "repriced": repriced,
        "errors": errors,
        "error_examples": error_examples,
        "skipped_no_cost": skipped_no_cost,
        "bulk_pricing_flag_set_on": bulk_flag_set,
        "retagged": retagged,
        "randomized": randomized,
        "placements_updated": placements_updated,
        "sizes_repaired": sizes_repaired,
        "gallery_rebuilt": gallery_rebuilt,
        "recategorized": recategorized,
        "total_matching": total_matching,
        "truncated": truncated,
        "next_offset": (payload.offset or 0) + matched,
        "dry_run": payload.dry_run,
    }


@api_router.get("/admin/products/imported", dependencies=[Depends(require_admin)])
async def list_imported_products(offset: int = 0, limit: int = 25, q: str = ""):
    query = {}
    if q:
        query = {"name": {"$regex": q.strip(), "$options": "i"}}
    total = await db.imported_products.count_documents(query)
    out = []
    cursor = db.imported_products.find(query).sort("imported_at", -1).skip(offset).limit(min(limit, 200))
    async for d in cursor:
        out.append({k: d.get(k) for k in [
            "id", "name", "price", "source_price", "category", "image", "description",
            "gender_fit", "industry_tags", "colors", "sizes", "size_upcharges",
            "source", "source_sku", "brand", "active", "imported_at",
        ]})
    return {"items": out, "total": total, "offset": offset, "returned": len(out)}


class BulkImportPayload(BaseModel):
    items: List[Dict]
    default_source: Optional[str] = "manual"
    default_brand: Optional[str] = ""
    default_markup_pct: Optional[float] = 0.0
    default_gender_fit: Optional[str] = "unisex"
    dry_run: Optional[bool] = False
    # Pricing: source_price from a supplier CSV (e.g. Pencarrie) is treated as
    # ex-VAT trade cost, standard practice for UK wholesale suppliers. We apply
    # your markup, then add VAT, then round up to a charm price — only when
    # `price` isn't explicitly given in the row (an explicit price is always
    # used as-is, untouched).
    apply_vat: Optional[bool] = True
    vat_rate_pct: Optional[float] = 20.0
    charm_price_99: Optional[bool] = True


def _price_with_vat_and_charm(source_price: float, markup_pct: float, apply_vat: bool, vat_rate_pct: float, charm: bool) -> float:
    """source_price is treated as ex-VAT trade cost (standard for UK wholesale
    suppliers). Applies markup, then VAT, then (optionally) rounds UP to the
    nearest £X.99 — never down, so the charm-priced figure never undercuts
    the margin you actually asked for."""
    price = source_price * (1 + markup_pct / 100.0)
    if apply_vat:
        price = price * (1 + vat_rate_pct / 100.0)
    if charm:
        import math
        pounds = math.floor(price)
        candidate = round(pounds + 0.99, 2)
        if candidate < price:
            candidate = round(candidate + 1.0, 2)
        price = candidate
    return round(price, 2)


@api_router.get("/admin/pencarrie/fetch-catalogue", dependencies=[Depends(require_admin)])
async def pencarrie_fetch_catalogue(offset: int = 0, limit: int = 500, brand: str = "", q: str = ""):
    """Pulls PenCarrie's product export directly via their public API (no manual
    CSV download needed) — see https://www.pencarrie.com/data/enhanced-data.
    Requires a PenCarrie API token set in /admin/integrations (My Account >
    Account Settings > API Access Tokens on PenCarrie's site).

    `brand` filters to an exact brand match (see `available_brands` in the
    response for valid values). `q` is a free-text search across every column
    (name, style code, description, etc.) — the natural way to filter by
    style/garment type since PenCarrie doesn't expose a single "style" field.

    Returns raw CSV rows (as-is, whatever column names PenCarrie uses) for the
    frontend's existing flexible column-matching to normalise — same path as
    a manually pasted CSV."""
    token = await _get_integration_value("pencarrie_api_token")
    if not token:
        raise HTTPException(400, "PenCarrie API token not set — add it in /admin/integrations first.")
    # Defensive: strip an accidentally-pasted "Bearer " prefix — some dashboards
    # display the token that way, and people copy it verbatim including the word.
    # Defensive: strip all whitespace/newlines (a trailing newline from copy-paste
    # is a very common invisible cause of auth failures) and any "Bearer " prefix
    # some dashboards display the token with.
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    import httpx
    import zipfile
    import io
    import csv as csv_module

    url = "https://www.pencarrie.com/api/public/v1/export/products.zip"
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/zip, application/octet-stream, */*",
                    # Some WAFs / anti-bot layers block requests carrying an
                    # obvious HTTP-library default User-Agent (e.g. "python-httpx/0.27").
                    # A realistic browser UA is the standard, well-documented workaround.
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                },
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        detail = (e.response.text or "").strip()[:300]
        msg = f"PenCarrie API returned {e.response.status_code}"
        if detail.lower().startswith(("<!doctype html", "<html")):
            msg += " — this looks like a generic web-server/firewall block page, not an API error from PenCarrie's app (their real API errors would come back as JSON). Likely their anti-bot protection blocking the request rather than the token itself being wrong."
        elif detail:
            msg += f" — their response: {detail}"
        else:
            msg += " (no further detail from PenCarrie) — double-check the API token in /admin/integrations, and that API access is actually enabled on your PenCarrie account, not just that a token exists."
        raise HTTPException(502, msg)
    except Exception as e:
        raise HTTPException(502, f"Couldn't reach PenCarrie's API: {e}")

    try:
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        csv_filename = next((n for n in zf.namelist() if n.lower().endswith(".csv")), None)
        if not csv_filename:
            raise HTTPException(502, "PenCarrie's response didn't contain a CSV file — their export format may have changed.")
        raw_bytes = zf.read(csv_filename)
    except zipfile.BadZipFile:
        raise HTTPException(502, "PenCarrie's response wasn't a valid ZIP file — their API format may have changed.")

    text = raw_bytes.decode("utf-8-sig", errors="replace")
    all_rows = list(csv_module.DictReader(io.StringIO(text)))

    # Auto-detect which column holds the brand — varies until we've seen a real export.
    brand_col = None
    if all_rows:
        headers_lower = {h.lower(): h for h in all_rows[0].keys()}
        for candidate in ("brand", "brand_name", "manufacturer", "make"):
            if candidate in headers_lower:
                brand_col = headers_lower[candidate]
                break
    available_brands = sorted({
        r[brand_col].strip() for r in all_rows if brand_col and r.get(brand_col, "").strip()
    }) if brand_col else []

    filtered = all_rows
    if brand:
        if not brand_col:
            raise HTTPException(400, "Couldn't find a brand column in PenCarrie's export to filter on.")
        filtered = [r for r in filtered if r.get(brand_col, "").strip().lower() == brand.strip().lower()]
    if q:
        q_lower = q.strip().lower()
        filtered = [r for r in filtered if any(q_lower in str(v).lower() for v in r.values())]

    limit = min(limit, 2000)
    page = filtered[offset:offset + limit]
    return {
        "rows": page,
        "columns": list(all_rows[0].keys()) if all_rows else [],
        "total_available": len(all_rows),
        "total_matching": len(filtered),
        "available_brands": available_brands[:500],
        "brand_column_detected": brand_col,
        "offset": offset,
        "returned": len(page),
    }


@api_router.post("/admin/products/bulk-import", dependencies=[Depends(require_admin)])
async def bulk_import_products(payload: BulkImportPayload):
    if len(payload.items) > 1500:
        raise HTTPException(413, "Too many items in one request (max 1500) — please import in smaller batches (use the brand/search filters, or split a big CSV up).")
    now = datetime.now(timezone.utc).isoformat()
    created: List[Dict] = []
    skipped: List[Dict] = []
    images_mirrored = 0
    images_failed = 0

    # ---- Pass 1: build every doc's non-image fields, and collect every unique
    # image URL that needs mirroring (without fetching anything yet). ----
    docs: List[Dict] = []
    urls_to_mirror: set = set()
    for raw in payload.items:
        try:
            name = str(raw.get("name") or "").strip()
            if not name:
                skipped.append({"reason": "missing name", "row": raw})
                continue
            if "silicone" in name.lower() and ("patch" in name.lower() or "template" in name.lower()):
                skipped.append({"reason": "excluded: decoration component, not a sellable product", "row": raw})
                continue
            source_sku = str(raw.get("source_sku") or "").strip()
            pid = str(raw.get("id") or "").strip() or _slugify_source_sku(name, source_sku)
            price = raw.get("price")
            source_price_val = raw.get("source_price")
            if price is None and source_price_val is not None:
                sp = float(source_price_val)
                markup = float(raw.get("markup_pct", payload.default_markup_pct or 0))
                price = _price_with_vat_and_charm(
                    sp, markup, payload.apply_vat, payload.vat_rate_pct, payload.charm_price_99
                )
            price = float(price or 0)
            category = raw.get("category") or _auto_category(name, raw.get("description") or "")

            image_url = str(raw.get("image") or "").strip()
            additional_urls = [str(u).strip() for u in (raw.get("additional_images") or []) if str(u).strip()]
            color_image_urls = [
                str(c.get("image") or "").strip()
                for c in (raw.get("colors") or [])
                if isinstance(c, dict) and str(c.get("image") or "").strip()
            ]
            if not payload.dry_run:
                if image_url:
                    urls_to_mirror.add(image_url)
                for u in additional_urls:
                    urls_to_mirror.add(u)
                for u in color_image_urls:
                    urls_to_mirror.add(u)

            doc = {
                "id": pid,
                "name": name,
                "price": price,
                "category": category,
                "image": image_url,
                "additional_images": additional_urls,
                "description": str(raw.get("description") or "").strip()[:4000],
                "gender_fit": (raw.get("gender_fit") or payload.default_gender_fit or _auto_gender_fit(name)),
                "industry_tags": raw.get("industry_tags") or _auto_industry_tags(name, category),
                "colors": [
                    {"name": str(c.get("name") or c) if isinstance(c, dict) else str(c),
                     "hex":  str((c.get("hex") if isinstance(c, dict) else "#cccccc") or "#cccccc"),
                     "image": str(c.get("image") or "").strip() if isinstance(c, dict) else ""}
                    for c in (raw.get("colors") or [])
                ][:24],
                "sizes": [str(s) for s in (raw.get("sizes") or [])],
                "size_upcharges": raw.get("size_upcharges") or {},
                "source": raw.get("source") or payload.default_source or "manual",
                "source_sku": source_sku,
                "source_price": float(source_price_val) if source_price_val is not None else None,
                "brand": raw.get("brand") or payload.default_brand or "",
                "active": bool(raw.get("active", True)),
                "imported_at": now,
            }
            docs.append(doc)
        except Exception as e:
            skipped.append({"reason": str(e)[:200], "row": raw})

    # ---- Pass 2: mirror every unique image URL concurrently (capped at 15 at
    # once — fast, but polite to both R2 and whatever site we're fetching from). ----
    url_map: Dict[str, str] = {}
    if urls_to_mirror:
        semaphore = asyncio.Semaphore(15)

        async def _mirror_one(url: str):
            async with semaphore:
                result = await _mirror_external_image(url)
                return url, result

        results = await asyncio.gather(*[_mirror_one(u) for u in urls_to_mirror])
        for original_url, mirrored_url in results:
            if mirrored_url:
                url_map[original_url] = mirrored_url
                images_mirrored += 1
            else:
                images_failed += 1  # doc keeps the original (hotlinked) URL as fallback, applied below

    # ---- Pass 3: apply mirrored URLs and write to Mongo. ----
    for doc in docs:
        if doc["image"] in url_map:
            doc["image"] = url_map[doc["image"]]
        doc["additional_images"] = [url_map.get(u, u) for u in doc["additional_images"]]
        for c in doc.get("colors") or []:
            if c.get("image"):
                c["image"] = url_map.get(c["image"], c["image"])
        try:
            if not payload.dry_run:
                await db.imported_products.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
                _apply_imported_product(doc)
            created.append({"id": doc["id"], "name": doc["name"], "category": doc["category"], "price": doc["price"]})
        except Exception as e:
            skipped.append({"reason": str(e)[:200], "row": doc})

    return {
        "ok": True,
        "created": created,
        "skipped": skipped,
        "dry_run": payload.dry_run,
        "images_mirrored_to_r2": images_mirrored,
        "images_failed_to_mirror": images_failed,
    }


class ImportedProductPatch(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image: Optional[str] = None
    additional_images: Optional[List[str]] = None
    description: Optional[str] = None
    gender_fit: Optional[str] = None
    industry_tags: Optional[List[str]] = None
    colors: Optional[List[Dict]] = None
    sizes: Optional[List[str]] = None
    size_upcharges: Optional[Dict[str, float]] = None
    source: Optional[str] = None
    source_sku: Optional[str] = None
    brand: Optional[str] = None
    active: Optional[bool] = None


@api_router.patch("/admin/products/imported/{pid}", dependencies=[Depends(require_admin)])
async def patch_imported_product(pid: str, patch: ImportedProductPatch):
    existing = await db.imported_products.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Imported product not found")
    up = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if up:
        await db.imported_products.update_one({"id": pid}, {"$set": up})
        doc = await db.imported_products.find_one({"id": pid})
        if doc.get("active"):
            _apply_imported_product(doc)
        else:
            PRODUCTS.pop(pid, None)
    return {"ok": True}


@api_router.delete("/admin/products/imported/{pid}", dependencies=[Depends(require_admin)])
async def delete_imported_product(pid: str):
    r = await db.imported_products.delete_one({"id": pid})
    PRODUCTS.pop(pid, None)
    return {"ok": True, "deleted": r.deleted_count}


@app.on_event("startup")
async def _seed_default_product_meta():
    """Non-destructive: only fills empty/None fields. Admin overrides remain untouched.
    Includes a one-time blanket 'bulk pricing on' pass guarded by settings.product_meta_seed_v1.

    Runs as a background task, not awaited directly in the startup event —
    this loops over every product in the catalogue (thousands, once PenCarrie
    imports are in), and awaiting it inline here previously meant the whole
    app sat unable to accept ANY request for 9+ minutes on every single
    restart while it worked through them one at a time. The site itself
    doesn't depend on this having finished — it only fills in defaults —
    so there's no reason it needs to block startup.
    """
    asyncio.create_task(_seed_default_product_meta_impl())


async def _seed_default_product_meta_impl():
    try:
        marker = await db.settings.find_one({"key": "product_meta_seed_v1"})
        first_run = marker is None

        # One bulk read instead of one find_one() per product (was the actual
        # cause of the multi-minute startup delay — thousands of individual
        # round-trips to Mongo Atlas, one per product, every restart).
        existing_by_id: Dict[str, Dict] = {}
        async for doc in db.product_meta.find({}):
            existing_by_id[doc.get("product_id")] = doc

        writes = []
        for pid, p in PRODUCTS.items():
            existing = existing_by_id.get(pid) or {}
            patch: Dict = {}

            if not existing.get("description_full") and not p.get("description_full"):
                patch["description_full"] = _default_description(p)

            if not existing.get("size_guide_table") and not p.get("size_guide_table"):
                sg = _default_size_guide(p)
                if sg:
                    patch["size_guide_table"] = sg

            if first_run and not existing.get("bulk_pricing_enabled") and not p.get("bulk_pricing_enabled"):
                patch["bulk_pricing_enabled"] = True

            if patch:
                patch["product_id"] = pid
                patch["updated_at"] = datetime.now(timezone.utc).isoformat()
                writes.append(UpdateOne({"product_id": pid}, {"$set": patch}, upsert=True))
                for k, v in patch.items():
                    if k not in ("product_id", "updated_at"):
                        PRODUCTS[pid][k] = v

        if writes:
            # Still capped-concurrency rather than one giant unbounded bulk_write,
            # to keep this polite to Atlas regardless of catalogue size.
            for i in range(0, len(writes), 500):
                await db.product_meta.bulk_write(writes[i:i + 500], ordered=False)

        if first_run:
            await db.settings.update_one(
                {"key": "product_meta_seed_v1"},
                {"$set": {"key": "product_meta_seed_v1", "ran_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
        logging.info(f"product-meta seed finished in background ({len(writes)} products updated).")
    except Exception as e:
        print(f"product-meta seed failed: {e}")


@app.on_event("startup")
async def _seed_customer_indexes():
    """Ensure unique email + TTL on password_reset_tokens.expires_at + login_attempts."""
    try:
        await db.customers.create_index("email", unique=True)
        await db.password_reset_tokens.create_index("expires_at")
        await db.customer_login_attempts.create_index("email")
        await db.customer_carts.create_index("customer_id", unique=True)
        await db.customer_addresses.create_index("customer_id")
        await db.customer_designs.create_index("customer_id")
    except Exception as e:
        print(f"customer index setup failed: {e}")


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


# ============================================================================
# Router modules (split out from this monolith — see /app/backend/routers/)
# ============================================================================
import routers.designer_ai  # noqa: F401 — registers /designer/remove-bg, /designer/ai-effect, /admin/test-email
import routers.cms_page_copy  # noqa: F401 — registers /page-copy/*, /admin/page-copy/*
import routers.configurator_addons  # noqa: F401 — registers /admin/full-squad/addons, /admin/sports-outfit/addons, /admin/configurator-settings
import routers.customer_auth  # noqa: F401 — registers /customer/register, /customer/login, /customer/cart, /customer/orders, addresses, designs
import routers.admin_reviews  # noqa: F401 — registers /admin/reviews list/edit/delete

# Legacy helpers still used by leavers/bespoke and /contact — thin wrappers that
# proxy to the new services.email module. Kept here until those endpoints move
# into their own router in a follow-up.
from services.email import send_email as _send_email
from services.email import shop_notification_recipient as _shop_notification_recipient
from services.email import email_wrap as _email_wrap


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    # Vercel gives every project several live URLs (the main domain, a
    # `-git-<branch>-<team>.vercel.app` alias, and a unique URL per preview
    # deployment). Rather than needing CORS_ORIGINS updated every time one of
    # those is used, also allow anything under this Vercel team's namespace
    # plus the production alias, via regex.
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+-)?ttw27s-projects\.vercel\.app$|^https://your-own-print\.vercel\.app$|^https://(www\.)?yourownprint\.co\.uk$",
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
