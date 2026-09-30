"""
Bundle builder (admin) - /admin/bundles/*

Two kinds of bundle, both built from products already in the catalogue:
  - "pack": a bulk pack with fixed quantities (e.g. 20 x tees, or a team pack
    of 10 tees + 5 hoodies + 5 caps), like Penguin / Essential Workwear. Bought
    per pack; the customer splits sizes per garment on the product page.
  - "set": one of each item per person (e.g. tee + hoodie), sized once.
Pricing (both): every item includes ONE print position (INCLUDED_POSITION's
price) - "logo included". Price = (items + included print) minus a discount
that grows with the number of items, rounded to the nearest £x.99. Extra print
positions are charged per item at checkout (see _resolve_line_pricing).
The picture is built from the items' own photos (matching colour, background
cut out, branded background). Bundles are created HIDDEN (active=False).

Stored as imported_products docs with source="bundle", bundle_kind and
bundle_items, so they behave like any other product afterwards.
"""
from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from deps import api_router, db, require_admin, _get_integration_value

INCLUDED_POSITION = "left-breast"   # one print position included on every item


def _discount_for(n_items: int) -> float:
    """Bigger bundles, bigger saving - kept modest so packs stay profitable."""
    if n_items >= 50:
        return 0.12
    if n_items >= 20:
        return 0.10
    if n_items >= 10:
        return 0.08
    return 0.05


def _round99(x: float) -> float:
    """Down to the £x.99 at or below x (17.08 -> 16.99, 28.78 -> 27.99), so the
    promised saving is always met. Never below £0.99."""
    import math
    return max(0.99, round(math.floor(x + 0.01) - 0.01, 2))


def _included_print_value() -> float:
    from server import PLACEMENT_BY_ID
    return float((PLACEMENT_BY_ID.get(INCLUDED_POSITION) or {}).get("price") or 0)

_BROWSER_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://www.yourownprint.co.uk/",
}

# Suggested bundles, built from products already on the site - budget-friendly
# brands (Pro RTX, Gildan, Portwest, Beechfield) that share colour ranges, so one
# colour choice suits every item. `placements` = print positions offered.
_FRONT_BACK = ["left-breast", "right-breast", "full-front", "back-print"]
_FRONT = ["left-breast", "right-breast", "full-front"]
BUNDLE_TEMPLATES: List[Dict] = [
    # ---- Bulk packs: single garment ----
    {"kind": "pack", "group": "Bulk deals", "name": "20 x Promo T-Shirts Deal", "items": [["gd07", 20]], "placements": _FRONT_BACK,
     "industries": [], "blurb": "20 lightweight Gildan tees with your logo - perfect for events, giveaways and volunteers."},
    {"kind": "pack", "group": "Bulk deals", "name": "50 x Promo T-Shirts Deal", "items": [["gd07", 50]], "placements": _FRONT_BACK,
     "industries": [], "blurb": "50 Gildan tees with your logo at our lowest per-shirt price - ideal for big events and campaigns."},
    {"kind": "pack", "group": "Bulk deals", "name": "20 x Pro Work T-Shirts Deal", "items": [["rx151", 20]], "placements": _FRONT_BACK,
     "industries": ["construction-trades", "industrial", "cleaning"], "blurb": "20 hard-wearing Pro RTX work tees with your logo."},
    {"kind": "pack", "group": "Bulk deals", "name": "10 x Pro Polo Shirts Deal", "items": [["rx101", 10]], "placements": _FRONT_BACK,
     "industries": ["corporate", "retail", "hospitality-catering", "cleaning"], "blurb": "10 Pro RTX piqué polos with your logo - smart, tough and easy-care."},
    {"kind": "pack", "group": "Bulk deals", "name": "10 x Gildan Hoodies Deal", "items": [["gd57", 10]], "placements": _FRONT_BACK,
     "industries": ["construction-trades", "sports-fitness", "education-schools"], "blurb": "10 Gildan Heavy Blend hoodies with your logo."},
    {"kind": "pack", "group": "Bulk deals", "name": "10 x Pro Sweatshirts Deal", "items": [["rx301", 10]], "placements": _FRONT_BACK,
     "industries": ["corporate", "education-schools", "cleaning"], "blurb": "10 Pro RTX sweatshirts with your logo."},
    {"kind": "pack", "group": "Bulk deals", "name": "10 x Hi-Vis Vests Deal", "items": [["pw002", 10]], "placements": ["full-front", "back-print"],
     "industries": ["construction-trades", "industrial", "security"], "blurb": "10 Portwest hi-vis vests with your logo - be seen and be recognised."},
    {"kind": "pack", "group": "Bulk deals", "name": "25 x Branded Caps Deal", "items": [["bb10", 25]], "placements": ["full-front"],
     "industries": [], "blurb": "25 Beechfield caps with your logo on the front."},
    # ---- Bulk packs: teams ----
    {"kind": "pack", "group": "Team packs", "name": "Partner Pack - 2 People", "items": [["rx151", 4], ["rx101", 2], ["gd57", 2], ["bb10", 2]],
     "placements": _FRONT, "industries": [], "blurb": "Everything a 2-person business needs: 4 tees, 2 polos, 2 hoodies and 2 caps, all with your logo."},
    {"kind": "pack", "group": "Team packs", "name": "Team of 5 Starter Pack", "items": [["rx151", 10], ["gd57", 5], ["bb10", 5]],
     "placements": _FRONT, "industries": [], "blurb": "Kit out a team of 5: 2 tees, a hoodie and a cap each - all branded."},
    {"kind": "pack", "group": "Team packs", "name": "Team of 10 Pack", "items": [["rx151", 20], ["rx350", 10], ["bb10", 10]],
     "placements": _FRONT, "industries": [], "blurb": "Kit out a team of 10: 2 tees, a hoodie and a cap each - all branded."},
    # ---- Bulk packs: industries ----
    {"kind": "pack", "group": "Industry packs", "name": "Trades Team Pack - 3 People", "items": [["rx151", 6], ["rx350", 3], ["rx601", 3], ["pw002", 3], ["bb10", 3]],
     "placements": ["left-breast", "full-front", "back-print"], "industries": ["construction-trades", "industrial"],
     "blurb": "Complete kit for 3 tradespeople: 2 tees, a hoodie, work trousers, a hi-vis vest and a cap each.",
     "note": "Trousers carry a smaller matching logo on the leg or pocket."},
    {"kind": "pack", "group": "Industry packs", "name": "Site Crew Pack - 5 People", "items": [["rx151", 10], ["pw002", 5], ["rx601", 5]],
     "placements": ["left-breast", "full-front", "back-print"], "industries": ["construction-trades", "industrial", "security"],
     "blurb": "5 site workers kitted out: 2 tees, a hi-vis vest and work trousers each.",
     "note": "Trousers carry a smaller matching logo on the leg or pocket."},
    {"kind": "pack", "group": "Industry packs", "name": "Hospitality Team Pack - 5 People", "items": [["rx101", 10], ["pr155", 5], ["bb10", 5]],
     "placements": _FRONT, "industries": ["hospitality-catering", "retail"],
     "blurb": "5 front-of-house or kitchen staff: 2 polos, an apron and a cap each."},
    {"kind": "pack", "group": "Industry packs", "name": "Office & Corporate Pack - 5 People", "items": [["rx101", 10], ["rx301", 5]],
     "placements": _FRONT_BACK, "industries": ["corporate", "retail"],
     "blurb": "5 staff kitted out for the office and client days: 2 polos and a sweatshirt each."},
    {"kind": "pack", "group": "Industry packs", "name": "Cleaning Team Pack - 5 People", "items": [["rx101", 10], ["rx301", 5], ["pw002", 5]],
     "placements": _FRONT, "industries": ["cleaning"],
     "blurb": "5 cleaners kitted out: 2 polos, a sweatshirt and a hi-vis vest each."},
    {"kind": "pack", "group": "Industry packs", "name": "School Staff Pack - 10 People", "items": [["rx101", 10], ["rx301", 10]],
     "placements": _FRONT_BACK, "industries": ["education-schools"],
     "blurb": "10 school or nursery staff: a polo and a sweatshirt each."},
    {"kind": "pack", "group": "Industry packs", "name": "Event Crew Pack - 10 People", "items": [["gd07", 20], ["bb10", 10]],
     "placements": ["full-front", "back-print"], "industries": [],
     "blurb": "10 event staff or volunteers: 2 tees and a cap each - easy to spot in the crowd."},
    # ---- Per-person sets ----
    {"kind": "set", "group": "Per-person sets", "name": "Complete Tradesman Outfit", "items": [["rx151", 1], ["rx350", 1], ["rx601", 1], ["pw002", 1]],
     "placements": ["left-breast", "full-front", "back-print"], "industries": ["construction-trades", "industrial"],
     "blurb": "Head-to-toe kit for one tradesperson: tee, hoodie, work trousers and hi-vis vest - all branded.",
     "note": "Trousers carry a smaller matching logo; trouser and vest sizes are matched to your tee size (tell us if you need different)."},
    {"kind": "set", "group": "Per-person sets", "name": "Trades Set - Tee + Hoodie", "items": [["rx151", 1], ["gd57", 1]],
     "placements": _FRONT_BACK, "industries": ["construction-trades", "industrial"],
     "blurb": "A work tee and a hoodie per person - the everyday kit for trades and site teams."},
    {"kind": "set", "group": "Per-person sets", "name": "Hi-Vis Set - Tee + Vest + Cap", "items": [["rx151", 1], ["pw002", 1], ["bb10", 1]],
     "placements": ["full-front", "back-print"], "industries": ["construction-trades", "security"],
     "blurb": "A branded tee, hi-vis vest and cap per person.", "note": "The vest is matched to your tee size."},
    {"kind": "set", "group": "Per-person sets", "name": "Hospitality Set - Polo + Apron", "items": [["rx101", 1], ["pr155", 1]],
     "placements": _FRONT, "industries": ["hospitality-catering", "retail"],
     "blurb": "A polo and a 3-pocket apron per person for front-of-house and kitchen teams."},
    {"kind": "set", "group": "Per-person sets", "name": "Office Set - Polo + Sweatshirt", "items": [["rx101", 1], ["rx301", 1]],
     "placements": _FRONT_BACK, "industries": ["corporate", "education-schools"],
     "blurb": "A polo and a sweatshirt per person - smart and comfortable all year round."},
    {"kind": "set", "group": "Per-person sets", "name": "Hoodie & Joggers Set", "items": [["265m", 1], ["268m", 1]],
     "placements": ["left-breast", "full-front"], "industries": [],
     "blurb": "A matching hoodie and joggers in the same colour, both carrying your design.",
     "note": "The joggers get a matching smaller print on the leg."},
    {"kind": "set", "group": "Per-person sets", "name": "Tee & Shorts Set", "items": [["jc001", 1], ["jc080", 1]],
     "placements": ["left-breast", "full-front"], "industries": ["sports-fitness"],
     "blurb": "A performance tee and matching shorts - great for training kit and summer events.",
     "note": "The shorts get a matching smaller print on the leg."},
    {"kind": "set", "group": "Per-person sets", "name": "Merch Set - Tee + Tote + Cap", "items": [["gd05", 1], ["w101", 1], ["bb10", 1]],
     "placements": ["full-front"], "industries": [],
     "blurb": "A tee, a tote bag and a cap per person - ready-made merch for events and launches."},
]


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:70] or "bundle"


def _bundle_price(items: List[Tuple[Dict, int]]) -> Tuple[float, float, int]:
    """-> (bundle price, separate price incl. logo on every item, % saved)."""
    inc = _included_print_value()
    n = sum(q for _, q in items)
    full = round(sum((float(p.get("price") or 0) + inc) * q for p, q in items), 2)
    price = _round99(full * (1 - _discount_for(n)))
    pct = int(max(0, (full - price) / full * 100)) if full else 0
    return price, full, pct


def _resolve(items: List[List]) -> List[Tuple[Dict, int]]:
    from server import PRODUCTS
    out = []
    for pid, qty in items:
        p = PRODUCTS.get(pid)
        if not p:
            raise HTTPException(400, f"Product '{pid}' isn't in the catalogue")
        out.append((p, max(1, int(qty))))
    return out


# ---------------------------------------------------------------- images ----

async def _fetch_image(url: str):
    from PIL import Image
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        r = await client.get(url, headers=_BROWSER_HEADERS)
        r.raise_for_status()
    img = Image.open(io.BytesIO(r.content))
    img.load()
    return img, r.content


async def _removebg(raw: bytes, api_key: str):
    from PIL import Image
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post("https://api.remove.bg/v1.0/removebg",
                              files={"image_file": ("item.png", raw, "image/png")},
                              data={"size": "auto"}, headers={"X-Api-Key": api_key})
    if r.status_code != 200:
        raise HTTPException(502, f"remove.bg couldn't cut out an image ({r.status_code})")
    img = Image.open(io.BytesIO(r.content))
    img.load()
    return img.convert("RGBA")


def _cutout_auto(img):
    """Cut a product out of a plain studio background: flood-fill inwards from
    the edges over pixels close to the background colour, make them
    transparent. Returns (RGBA image, True) - or (image, False) when the photo
    isn't on a plain background (e.g. worn by a model), so it's shown as a
    rounded photo tile instead of a bad cut-out."""
    from PIL import Image, ImageDraw, ImageFilter
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        if rgba.getchannel("A").getextrema()[0] < 250:  # already has transparency
            return rgba, True
    rgb = img.convert("RGB")
    rgb.thumbnail((1000, 1000))
    w, h = rgb.size
    work = rgb.copy()
    marker = (255, 0, 254)
    step = max(8, min(w, h) // 40)
    seeds = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + \
            [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    # The background is the most common (roughly quantised) colour around the
    # edge. Only flood from edge points of that colour - a garment that touches
    # the edge of the photo must not be treated as background.
    from collections import Counter
    q = lambda c: tuple(v // 16 for v in c)  # noqa: E731
    counts = Counter(q(rgb.getpixel(p)) for p in seeds)
    bg_q = counts.most_common(1)[0][0]
    bg = tuple(v * 16 + 8 for v in bg_q)
    near = lambda c: sum(abs(a - b) for a, b in zip(c, bg)) <= 60  # noqa: E731
    for s in seeds:
        px = work.getpixel(s)
        if px != marker and near(px):
            ImageDraw.floodfill(work, s, marker, thresh=38)
    mask = Image.new("L", (w, h), 255)
    wp, mp = work.load(), mask.load()
    removed = 0
    for y in range(h):
        for x in range(w):
            if wp[x, y] == marker:
                mp[x, y] = 0
                removed += 1
    ratio = removed / float(w * h)
    if ratio < 0.12 or ratio > 0.88:
        # not a plain background, or the garment is the same colour as the
        # background (e.g. white on white) - show the photo as a tile instead
        return rgb.convert("RGBA"), False
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    bbox = out.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
    return (out.crop(bbox) if bbox else out), True


def _font(size: int):
    from PIL import ImageFont
    for name in ("DejaVuSans-Bold.ttf", "Arial Bold.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            pass
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def _pill(canvas, xy, text, bg, fg, size=40):
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    f = _font(size)
    tb = d.textbbox((0, 0), text, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    pad_x, pad_y = int(size * 0.6), int(size * 0.35)
    x, y = xy
    d.rounded_rectangle([x, y, x + tw + 2 * pad_x, y + th + 2 * pad_y], radius=(th + 2 * pad_y) // 2, fill=bg)
    d.text((x + pad_x - tb[0], y + pad_y - tb[1]), text, font=f, fill=fg)


def _compose(pieces: List[Tuple[object, bool, int]], top_label: str, save_label: str) -> bytes:
    """pieces: [(RGBA image, is_cutout, qty)] -> 1200x1200 PNG bytes."""
    from PIL import Image, ImageDraw, ImageFilter
    W = H = 1200
    canvas = Image.new("RGBA", (W, H))
    top, bottom = (240, 253, 244), (220, 252, 231)  # brand greens
    grad = ImageDraw.Draw(canvas)
    for y in range(H):
        t = y / (H - 1)
        grad.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    glow = Image.new("RGBA", (W, H), (255, 255, 255, 0))  # white-transparent, so the blur doesn't darken
    ImageDraw.Draw(glow).ellipse([150, 170, 1050, 1070], fill=(255, 255, 255, 170))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))

    n = len(pieces)
    show_qty = True
    if n == 1 and pieces[0][2] > 1:
        # single-garment deal (e.g. 20 x tees): a fanned stack of three
        img, cut, qty = pieces[0]
        pieces = [(img, cut, 1), (img, cut, 1), (img, cut, qty)]
        boxes = [(420, 590, 560, 640), (780, 590, 560, 640), (600, 660, 640, 720)]
    elif n == 1:
        boxes = [(600, 640, 820, 820)]
    elif n == 2:
        boxes = [(345, 650, 520, 760), (855, 650, 520, 760)]
    elif n == 3:
        boxes = [(275, 830, 380, 420), (925, 830, 380, 420), (600, 560, 560, 620)]  # sides first, main in front
        pieces = [pieces[1], pieces[2], pieces[0]]
    elif n == 4:
        boxes = [(330, 450, 470, 470), (870, 450, 470, 470), (330, 900, 470, 420), (870, 900, 470, 420)]
    else:
        boxes = [(260, 420, 380, 400), (600, 420, 380, 400), (940, 420, 380, 400), (420, 880, 380, 380), (780, 880, 380, 380)][:n]

    for (img, is_cut, qty), (cx, cy, bw, bh) in zip(pieces, boxes):
        im = img.copy()
        im.thumbnail((bw, bh), Image.LANCZOS)
        if not is_cut:
            m = Image.new("L", im.size, 0)
            ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=36, fill=255)
            im.putalpha(m)
        x, y = int(cx - im.size[0] / 2), int(cy - im.size[1] / 2)
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        if is_cut:
            sw = int(im.size[0] * 0.8)
            ImageDraw.Draw(shadow).ellipse([cx - sw // 2, y + im.size[1] - 30, cx + sw // 2, y + im.size[1] + 30], fill=(0, 0, 0, 70))
        else:
            ImageDraw.Draw(shadow).rounded_rectangle([x + 8, y + 16, x + im.size[0] + 8, y + im.size[1] + 16], radius=36, fill=(0, 0, 0, 60))
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
        canvas.alpha_composite(im, (x, y))
        if show_qty and qty > 1:
            _pill(canvas, (min(W - 170, x + im.size[0] - 120), max(130, y + 10)), f"x{qty}", (26, 26, 26, 255), (255, 255, 255, 255), size=40)

    _pill(canvas, (48, 48), top_label, (26, 26, 26, 255), (255, 255, 255, 255), size=40)
    _pill(canvas, (48, H - 120), "LOGO INCLUDED", (255, 255, 255, 255), (26, 26, 26, 255), size=36)
    if save_label:
        _pill(canvas, (W - 60 - 40 * len(save_label) * 0.62 - 50, H - 120), save_label, (123, 198, 126, 255), (26, 26, 26, 255), size=44)
    buf = io.BytesIO()
    canvas.convert("RGB").save(buf, "PNG", optimize=True)
    return buf.getvalue()


_PREFERRED_COLOURS = ["black", "jet black", "deep black", "french navy", "navy", "oxford navy", "new french navy",
                      "charcoal", "convoy grey", "bright royal", "royal blue", "bottle green", "red", "classic red"]
# Light colours disappear against the light bundle background and cut out badly.
_LIGHT_WORDS = ("white", "natural", "vanilla", "ice", "light", "pastel", "sand", "cream", "ash", "off white", "pink", "sport grey", "heather")


def _is_light(name: str) -> bool:
    return any(w in name for w in _LIGHT_WORDS)


def _photo_for_set(items: List[Tuple[Dict, int]]) -> List[str]:
    """One photo per item, all in the SAME colour where the items share one
    (black/navy first), so the set looks like a matching set. Items that don't
    have that colour (e.g. a hi-vis vest) use their own black/default photo."""
    def colour_photos(p):
        return {(c.get("name") or "").strip().lower(): c.get("image") for c in (p.get("colors") or []) if c.get("image")}
    maps = [colour_photos(p) for p, _ in items]
    shared = set.intersection(*[set(m) for m in maps]) if maps else set()
    # Only use a shared colour if it's a sensible "uniform" one (black, navy...);
    # otherwise each item uses its own best colour (e.g. black tee + yellow vest).
    pick = next((c for c in _PREFERRED_COLOURS if c in shared), None)
    urls = []
    for (p, _), m in zip(items, maps):
        own = pick if pick in m else (next((c for c in _PREFERRED_COLOURS if c in m), None)
                                      or next((c for c in m if not _is_light(c)), None))
        urls.append(m.get(own) if own else (p.get("image") or ""))
    return urls


async def _build_image(items: List[Tuple[Dict, int]], bundle_id: str, cutout: str, kind: str = "set") -> str:
    from server import _storage_put_async
    api_key = await _get_integration_value("removebg_api_key") if cutout == "removebg" else None
    if cutout == "removebg" and not api_key:
        raise HTTPException(400, "remove.bg isn't set up - add its key in Integrations, or use the automatic cut-out")
    pieces = []
    for (p, qty), url in zip(items, _photo_for_set(items)):
        if not url.startswith(("http://", "https://")):
            url = p.get("image") or ""
        if not url.startswith(("http://", "https://")):
            continue
        try:
            img, raw = await _fetch_image(url)
        except Exception:
            continue
        if api_key:
            buf = io.BytesIO()
            img.convert("RGB").save(buf, "PNG")
            pieces.append((await _removebg(buf.getvalue(), api_key), True, qty))
        else:
            cut, ok = _cutout_auto(img)
            pieces.append((cut, ok, qty))
    if not pieces:
        raise HTTPException(502, "Couldn't fetch any of the product photos to build the bundle image")
    n_items = sum(q for _, q in items)
    _, _, pct = _bundle_price(items)
    top = f"{'PACK' if kind == 'pack' else 'SET'}  ·  {n_items} ITEMS"
    png = _compose(pieces, top, f"SAVE {pct}%" if pct >= 5 else "")
    import os
    path = f"bundles/{bundle_id}.png"
    await _storage_put_async(path, png, "image/png")
    base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    if not base:
        raise HTTPException(500, "R2 storage isn't fully configured (missing R2_PUBLIC_URL).")
    return f"{base}/{path}?v={int(datetime.now(timezone.utc).timestamp())}"


# ------------------------------------------------------------ building ----

def _effective_placements(p: Dict) -> List[str]:
    from server import ALLOWED_PLACEMENT_OPTIONS, CATEGORY_PLACEMENT_DEFAULTS
    if p.get("allowed_placements") is not None:
        return list(p["allowed_placements"])
    return list(CATEGORY_PLACEMENT_DEFAULTS.get(p.get("category"), ALLOWED_PLACEMENT_OPTIONS))


def _bundle_doc(bundle_id: str, name: str, items: List[Tuple[Dict, int]], blurb: str = "",
                note: str = "", placements: Optional[List[str]] = None,
                industries: Optional[List[str]] = None, kind: str = "set") -> Dict:
    main = items[0][0]
    price, full, pct = _bundle_price(items)
    inc = _included_print_value()
    # Colours all the items share (by name); otherwise the main item's colours.
    names = [{(c.get("name") or "").strip().lower() for c in (p.get("colors") or [])} for p, _ in items]
    shared = set.intersection(*names) if names else set()
    colours = [{"name": c["name"], "hex": c.get("hex") or "#cccccc"}
               for c in (main.get("colors") or []) if (c.get("name") or "").strip().lower() in shared]
    if len(colours) < 2:
        colours = [{"name": c["name"], "hex": c.get("hex") or "#cccccc"} for c in (main.get("colors") or []) if c.get("name")]
    if placements is None:
        common = set(_effective_placements(main))
        for p, _ in items[1:]:
            common &= set(_effective_placements(p))
        placements = [x for x in _effective_placements(main) if x in common] or _effective_placements(main)
    n_items = sum(q for _, q in items)
    lines = "\n".join(f"- {q} x {p['name']}" for p, q in items)
    unit = "pack" if kind == "pack" else "set"
    short = blurb or f"{' + '.join(p['name'] for p, _ in items)}."
    how = ("Choose how many packs, then split the sizes for each garment below - they just need to add up."
           if kind == "pack" else "Pick your size and colour - we match every item in the set.")
    full_desc = (
        f"{short}\n\nWhat's in each {unit}:\n{lines}\n\n"
        f"Your logo is included - printed in one position (e.g. left chest) on every item. "
        f"Extra print positions can be added.\n"
        f"Price: £{price:.2f} per {unit} (£{full:.2f} if bought separately - you save {pct}%).\n{how}"
        + (f"\n\n{note}" if note else "")
    )
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": bundle_id, "name": name, "price": price, "category": main.get("category") or "t-shirts",
        "image": "", "additional_images": [p.get("image") for p, _ in items if p.get("image")],
        "description": short, "description_full_seed": full_desc,
        "gender_fit": main.get("gender_fit") or "unisex",
        "industry_tags": industries if industries is not None else list(main.get("industry_tags") or []),
        "colors": colours,
        # Packs are bought per pack ("PACK"); the size split per garment is given
        # on the product page. Sets are sized once, like a normal garment.
        "sizes": ["PACK"] if kind == "pack" else list(main.get("sizes") or []),
        "size_upcharges": {} if kind == "pack" else dict(main.get("size_upcharges") or {}),
        "allowed_placements": placements, "brand": main.get("brand") or "",
        "bulk_pricing_enabled": False,  # the bundle discount already applies
        "bundle_kind": kind,
        "bundle_items": [{"product_id": p["id"], "name": p["name"], "qty": q, "price": float(p["price"]),
                          "sizes": list(p.get("sizes") or []), "image": p.get("image") or ""} for p, q in items],
        "bundle_item_count": n_items,
        "bundle_included_print": {"position": INCLUDED_POSITION, "value": inc},
        "bundle_full_price": full,
        "bundle_saving_pct": pct,
        "source": "bundle", "active": False, "created_at": now, "imported_at": now,
    }


async def _create_bundle(name: str, items_spec: List[List], cutout: str, blurb: str = "", note: str = "",
                         placements: Optional[List[str]] = None, industries: Optional[List[str]] = None,
                         kind: str = "set") -> Dict:
    from server import _apply_imported_product, reapply_saved_settings, PRODUCTS
    if not name.strip():
        raise HTTPException(400, "Give the bundle a name")
    if kind not in ("set", "pack"):
        raise HTTPException(400, "kind must be 'set' or 'pack'")
    if not (1 <= len(items_spec) <= 5):
        raise HTTPException(400, "A bundle needs 1 to 5 products")
    items = _resolve(items_spec)
    bundle_id = "bundle-" + _slug(name)
    if bundle_id in PRODUCTS or await db.imported_products.find_one({"id": bundle_id}, {"_id": 1}):
        raise HTTPException(409, f"A bundle called '{name}' already exists")
    doc = _bundle_doc(bundle_id, name.strip(), items, blurb, note, placements, industries, kind)
    doc["image"] = await _build_image(items, bundle_id, cutout, kind)
    full_desc = doc.pop("description_full_seed")
    await db.imported_products.insert_one(dict(doc))
    await db.product_meta.update_one({"product_id": bundle_id},
                                     {"$set": {"product_id": bundle_id, "description_full": full_desc}}, upsert=True)
    _apply_imported_product(doc)
    await reapply_saved_settings([bundle_id])
    return {"id": bundle_id, "name": doc["name"], "price": doc["price"], "image": doc["image"]}


class BundleIn(BaseModel):
    name: str
    kind: str = "set"  # "set" | "pack"
    items: List[List]  # [[product_id, qty], ...]
    cutout: str = "auto"  # "auto" | "removebg"
    blurb: Optional[str] = ""


class TemplatesIn(BaseModel):
    names: Optional[List[str]] = None  # None = every suggested bundle not yet created
    cutout: str = "auto"


@api_router.get("/admin/bundles/templates", dependencies=[Depends(require_admin)])
async def bundle_templates():
    from server import PRODUCTS
    out = []
    for t in BUNDLE_TEMPLATES:
        missing = [pid for pid, _ in t["items"] if pid not in PRODUCTS]
        items = [(PRODUCTS[pid], q) for pid, q in t["items"] if pid in PRODUCTS]
        price, full, pct = _bundle_price(items) if items else (0, 0, 0)
        bid = "bundle-" + _slug(t["name"])
        out.append({
            "kind": t.get("kind", "set"), "saving_pct": pct, "item_count": sum(q for _, q in items),
            "group": t["group"], "name": t["name"], "blurb": t["blurb"], "id": bid,
            "created": bid in PRODUCTS,
            "items": [{"product_id": p["id"], "name": p["name"], "qty": q, "price": float(p["price"]), "image": p.get("image")} for p, q in items],
            "missing": missing, "price": price, "full_price": full,
        })
    return {"templates": out}


@api_router.post("/admin/bundles/create-templates", dependencies=[Depends(require_admin)])
async def create_template_bundles(payload: TemplatesIn):
    from server import PRODUCTS
    created, skipped, failed = [], [], []
    for t in BUNDLE_TEMPLATES:
        if payload.names is not None and t["name"] not in payload.names:
            continue
        if "bundle-" + _slug(t["name"]) in PRODUCTS:
            skipped.append({"name": t["name"], "reason": "already created"})
            continue
        try:
            created.append(await _create_bundle(t["name"], t["items"], payload.cutout, t.get("blurb", ""),
                                                t.get("note", ""), t.get("placements"), t.get("industries"),
                                                t.get("kind", "set")))
        except HTTPException as e:
            failed.append({"name": t["name"], "reason": e.detail})
    return {"created": created, "skipped": skipped, "failed": failed}


class PreviewIn(BaseModel):
    items: List[List]


@api_router.post("/admin/bundles/preview-price", dependencies=[Depends(require_admin)])
async def preview_bundle_price(payload: PreviewIn):
    items = _resolve(payload.items) if payload.items else []
    price, full, pct = _bundle_price(items) if items else (0, 0, 0)
    return {"price": price, "full_price": full, "saving_pct": pct, "item_count": sum(q for _, q in items),
            "included_print": _included_print_value()}


@api_router.post("/admin/bundles/create", dependencies=[Depends(require_admin)])
async def create_custom_bundle(payload: BundleIn):
    return await _create_bundle(payload.name, payload.items, payload.cutout, payload.blurb or "", kind=payload.kind)


@api_router.post("/admin/bundles/{bundle_id}/rebuild-image", dependencies=[Depends(require_admin)])
async def rebuild_bundle_image(bundle_id: str, cutout: str = "auto"):
    """Re-make a bundle's picture (e.g. with remove.bg for a cleaner cut-out)."""
    from server import _rebuild_product
    doc = await db.imported_products.find_one({"id": bundle_id, "source": "bundle"})
    if not doc:
        raise HTTPException(404, "Bundle not found")
    items = _resolve([[i["product_id"], i.get("qty", 1)] for i in doc.get("bundle_items") or []])
    url = await _build_image(items, bundle_id, cutout, doc.get("bundle_kind") or "set")
    await db.imported_products.update_one({"id": bundle_id}, {"$set": {"image": url}})
    await db.product_overrides.update_one({"product_id": bundle_id}, {"$unset": {"image": ""}})
    await _rebuild_product(bundle_id)
    return {"ok": True, "image": url}


@api_router.get("/bundles")
async def public_bundles():
    """Live bundles for the public /bundles page - packs first, then sets."""
    from server import live_products, is_zero_rated
    out = []
    for p in live_products():
        if p.get("bundle_items"):
            out.append({
                "id": p["id"], "name": p["name"], "price": float(p["price"]), "image": p.get("image") or "",
                "vat_zero_rated": is_zero_rated(p),
                "kind": p.get("bundle_kind") or "set", "item_count": p.get("bundle_item_count") or 0,
                "full_price": p.get("bundle_full_price"), "saving_pct": p.get("bundle_saving_pct"),
                "industry_tags": p.get("industry_tags") or [], "description": p.get("description") or "",
                "items": [{"name": i.get("name"), "qty": i.get("qty")} for i in p.get("bundle_items") or []],
            })
    out.sort(key=lambda b: (b["kind"] != "pack", b["price"]))
    return {"bundles": out}


@api_router.get("/admin/bundles/list", dependencies=[Depends(require_admin)])
async def admin_list_bundles():
    """Every bundle created (hidden or live) with its picture - for the
    'Your bundles' gallery in the Bundle builder."""
    from server import PRODUCTS, is_live
    out = [{
        "id": p["id"], "name": p["name"], "price": float(p["price"]), "image": p.get("image") or "",
        "kind": p.get("bundle_kind") or "set", "item_count": p.get("bundle_item_count") or 0,
        "saving_pct": p.get("bundle_saving_pct"), "live": is_live(p), "created_at": p.get("created_at") or "",
    } for p in PRODUCTS.values() if p.get("bundle_items")]
    out.sort(key=lambda b: b["created_at"], reverse=True)
    return {"bundles": out}
