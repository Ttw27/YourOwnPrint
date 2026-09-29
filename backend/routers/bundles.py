"""
Bundle builder (admin) - /admin/bundles/*

Creates "set" products from products already in the catalogue: e.g. a tee +
hoodie set, sold per person like the existing sports bundles. For each bundle:
  - price  = sum of the items' current prices, minus 10%
  - image  = the items' own photos, backgrounds cut out, arranged together on a
             branded background (uploaded to R2)
  - colours/sizes = what the items share (falling back to the main item's)
  - print  = each chosen print position is charged once per item in the set
             (see _resolve_line_pricing / ProductDetail)
Bundles are created HIDDEN (active=False) so they can be checked first.

Bundles are stored as imported_products docs with source="bundle" and a
`bundle_items` list, so they behave like any other product afterwards.
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

BUNDLE_DISCOUNT = 0.10

_BROWSER_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://www.yourownprint.co.uk/",
}

# Suggested bundles, built from products already on the site (matching brands
# where possible so one colour choice suits every item). `placements` are the
# print positions offered on the set.
_FRONT_BACK = ["left-breast", "right-breast", "full-front", "back-print"]
BUNDLE_TEMPLATES: List[Dict] = [
    # Workwear
    {"group": "Workwear", "name": "Trades Starter Set - Tee + Hoodie", "items": [["215m", 1], ["265m", 1]],
     "placements": _FRONT_BACK, "industries": ["construction-trades", "industrial"],
     "blurb": "A heavyweight tee and a hoodie per person - the everyday kit for trades and site teams."},
    {"group": "Workwear", "name": "Site Crew Hi-Vis Set - Tee + Hi-Vis Vest", "items": [["215m", 1], ["rs21", 1]],
     "placements": _FRONT_BACK, "industries": ["construction-trades", "industrial", "security"],
     "blurb": "A branded tee plus a hi-vis vest per person, so your crew are seen and recognised on site.",
     "note": "The hi-vis vest comes in yellow (or orange - just add a note) and is matched to the tee size."},
    {"group": "Workwear", "name": "Hospitality Set - Polo + Apron", "items": [["570m", 1], ["pr155", 1]],
     "placements": ["left-breast", "right-breast", "full-front"], "industries": ["hospitality-catering", "retail"],
     "blurb": "A smart polo and a 3-pocket apron per person for front-of-house and kitchen teams."},
    {"group": "Workwear", "name": "Office & Corporate Set - Polo + Sweatshirt", "items": [["570m", 1], ["262m", 1]],
     "placements": _FRONT_BACK, "industries": ["corporate", "retail"],
     "blurb": "A polo and a sweatshirt per person - smart, comfortable and on-brand all year round."},
    # Schools & clubs
    {"group": "Schools & clubs", "name": "School Staff Set - Polo + Sweatshirt", "items": [["jc040", 1], ["jh030", 1]],
     "placements": _FRONT_BACK, "industries": ["education-schools"],
     "blurb": "A breathable polo and a sweatshirt per person for school and nursery staff teams."},
    {"group": "Schools & clubs", "name": "Club Set - Tee + Hoodie", "items": [["jc001", 1], ["jh001", 1]],
     "placements": _FRONT_BACK, "industries": ["sports-fitness", "education-schools"],
     "blurb": "A performance tee and a college hoodie per member - ideal for clubs, teams and societies."},
    # Personal sets
    {"group": "Personal sets", "name": "Hoodie & Joggers Set", "items": [["265m", 1], ["268m", 1]],
     "placements": ["left-breast", "full-front"], "industries": [],
     "blurb": "A matching hoodie and joggers in the same colour, both carrying your design.",
     "note": "The joggers get a matching smaller print on the leg."},
    {"group": "Personal sets", "name": "Tee & Shorts Set", "items": [["jc001", 1], ["jc080", 1]],
     "placements": ["left-breast", "full-front"], "industries": ["sports-fitness"],
     "blurb": "A performance tee and matching shorts - great for training kit and summer events.",
     "note": "The shorts get a matching smaller print on the leg."},
    # Event / merch
    {"group": "Event & merch", "name": "Event Merch Pack - Tee + Tote + Cap", "items": [["jc001", 1], ["w101", 1], ["bb610", 1]],
     "placements": ["full-front"], "industries": [],
     "blurb": "A tee, a tote bag and a cap per person - ready-made merch for events, festivals and launches."},
    {"group": "Event & merch", "name": "Festival Tee & Tote Pack", "items": [["jc001", 1], ["w101", 1]],
     "placements": ["full-front", "back-print"], "industries": [],
     "blurb": "A tee and a tote bag per person - simple, popular merch for festivals, gigs and fundraisers."},
]


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:70] or "bundle"


def _bundle_price(items: List[Tuple[Dict, int]]) -> Tuple[float, float]:
    total = sum(float(p.get("price") or 0) * q for p, q in items)
    return round(total * (1 - BUNDLE_DISCOUNT), 2), round(total, 2)


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
    for s in seeds:
        if work.getpixel(s) != marker:
            ImageDraw.floodfill(work, s, marker, thresh=38)
    mask = Image.new("L", (w, h), 255)
    wp, mp = work.load(), mask.load()
    removed = 0
    for y in range(h):
        for x in range(w):
            if wp[x, y] == marker:
                mp[x, y] = 0
                removed += 1
    if removed / float(w * h) < 0.12:
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


def _compose(pieces: List[Tuple[object, bool, int]], n_items: int) -> bytes:
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
    if n == 1:
        boxes = [(600, 640, 820, 820)]
    elif n == 2:
        boxes = [(345, 650, 520, 760), (855, 650, 520, 760)]
    else:
        boxes = [(600, 560, 560, 620), (275, 830, 380, 420), (925, 830, 380, 420)][:n]
        # draw the side items first so the main one sits in front
        order = [1, 2, 0][:n] if n >= 3 else list(range(n))
        pieces = [pieces[i] for i in order]
        boxes = [boxes[i] for i in order]

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
        if qty > 1:
            _pill(canvas, (x + im.size[0] - 110, y + 10), f"x{qty}", (26, 26, 26, 255), (255, 255, 255, 255), size=34)

    _pill(canvas, (48, 48), f"SET  ·  {n_items} ITEMS", (26, 26, 26, 255), (255, 255, 255, 255), size=40)
    _pill(canvas, (W - 330, H - 120), "SAVE 10%", (123, 198, 126, 255), (26, 26, 26, 255), size=44)
    buf = io.BytesIO()
    canvas.convert("RGB").save(buf, "PNG", optimize=True)
    return buf.getvalue()


_PREFERRED_COLOURS = ["black", "jet black", "deep black", "french navy", "navy", "oxford navy", "new french navy",
                      "white", "arctic white", "charcoal", "convoy grey", "bright royal", "royal blue",
                      "yellow"]  # hi-vis: yellow is the usual look


def _photo_for_set(items: List[Tuple[Dict, int]]) -> List[str]:
    """One photo per item, all in the SAME colour where the items share one
    (black/navy first), so the set looks like a matching set. Items that don't
    have that colour (e.g. a hi-vis vest) use their own black/default photo."""
    def colour_photos(p):
        return {(c.get("name") or "").strip().lower(): c.get("image") for c in (p.get("colors") or []) if c.get("image")}
    maps = [colour_photos(p) for p, _ in items]
    shared = set.intersection(*[set(m) for m in maps]) if maps else set()
    pick = next((c for c in _PREFERRED_COLOURS if c in shared), None) or (sorted(shared)[0] if shared else None)
    urls = []
    for (p, _), m in zip(items, maps):
        own = pick if pick in m else next((c for c in _PREFERRED_COLOURS if c in m), None)
        urls.append(m.get(own) if own else (p.get("image") or ""))
    return urls


async def _build_image(items: List[Tuple[Dict, int]], bundle_id: str, cutout: str) -> str:
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
    png = _compose(pieces, sum(q for _, q in items))
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
                industries: Optional[List[str]] = None) -> Dict:
    main = items[0][0]
    price, full = _bundle_price(items)
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
    lines = "\n".join(f"- {q} x {p['name']} (usually £{float(p['price']):.2f})" for p, q in items)
    short = blurb or f"{' + '.join(p['name'] for p, _ in items)} - one set per person."
    full_desc = (
        f"{short}\n\nWhat's in each set:\n{lines}\n\n"
        f"Set price: £{price:.2f} per set (£{full:.2f} if bought separately - you save 10%).\n"
        f"Choose your print positions and your design is printed on every item in the set "
        f"(printing is charged per item). Pick your size and colour - we match every item in the set."
        + (f"\n\n{note}" if note else "")
    )
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": bundle_id, "name": name, "price": price, "category": main.get("category") or "t-shirts",
        "image": "", "additional_images": [p.get("image") for p, _ in items if p.get("image")],
        "description": short, "description_full_seed": full_desc,
        "gender_fit": main.get("gender_fit") or "unisex",
        "industry_tags": industries if industries is not None else list(main.get("industry_tags") or []),
        "colors": colours, "sizes": list(main.get("sizes") or []),
        "size_upcharges": dict(main.get("size_upcharges") or {}),
        "allowed_placements": placements, "brand": main.get("brand") or "",
        "bulk_pricing_enabled": True,
        "bundle_items": [{"product_id": p["id"], "name": p["name"], "qty": q, "price": float(p["price"])} for p, q in items],
        "bundle_item_count": n_items,
        "source": "bundle", "active": False, "created_at": now, "imported_at": now,
    }


async def _create_bundle(name: str, items_spec: List[List], cutout: str, blurb: str = "", note: str = "",
                         placements: Optional[List[str]] = None, industries: Optional[List[str]] = None) -> Dict:
    from server import _apply_imported_product, reapply_saved_settings, PRODUCTS
    if not name.strip():
        raise HTTPException(400, "Give the bundle a name")
    if not (1 <= len(items_spec) <= 4):
        raise HTTPException(400, "A bundle needs 1 to 4 products")
    items = _resolve(items_spec)
    bundle_id = "bundle-" + _slug(name)
    if bundle_id in PRODUCTS or await db.imported_products.find_one({"id": bundle_id}, {"_id": 1}):
        raise HTTPException(409, f"A bundle called '{name}' already exists")
    doc = _bundle_doc(bundle_id, name.strip(), items, blurb, note, placements, industries)
    doc["image"] = await _build_image(items, bundle_id, cutout)
    full_desc = doc.pop("description_full_seed")
    await db.imported_products.insert_one(dict(doc))
    await db.product_meta.update_one({"product_id": bundle_id},
                                     {"$set": {"product_id": bundle_id, "description_full": full_desc}}, upsert=True)
    _apply_imported_product(doc)
    await reapply_saved_settings([bundle_id])
    return {"id": bundle_id, "name": doc["name"], "price": doc["price"], "image": doc["image"]}


class BundleIn(BaseModel):
    name: str
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
        price, full = _bundle_price(items) if items else (0, 0)
        bid = "bundle-" + _slug(t["name"])
        out.append({
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
                                                t.get("note", ""), t.get("placements"), t.get("industries")))
        except HTTPException as e:
            failed.append({"name": t["name"], "reason": e.detail})
    return {"created": created, "skipped": skipped, "failed": failed}


@api_router.post("/admin/bundles/create", dependencies=[Depends(require_admin)])
async def create_custom_bundle(payload: BundleIn):
    return await _create_bundle(payload.name, payload.items, payload.cutout, payload.blurb or "")


@api_router.post("/admin/bundles/{bundle_id}/rebuild-image", dependencies=[Depends(require_admin)])
async def rebuild_bundle_image(bundle_id: str, cutout: str = "auto"):
    """Re-make a bundle's picture (e.g. with remove.bg for a cleaner cut-out)."""
    from server import _rebuild_product
    doc = await db.imported_products.find_one({"id": bundle_id, "source": "bundle"})
    if not doc:
        raise HTTPException(404, "Bundle not found")
    items = _resolve([[i["product_id"], i.get("qty", 1)] for i in doc.get("bundle_items") or []])
    url = await _build_image(items, bundle_id, cutout)
    await db.imported_products.update_one({"id": bundle_id}, {"$set": {"image": url}})
    await db.product_overrides.update_one({"product_id": bundle_id}, {"$unset": {"image": ""}})
    await _rebuild_product(bundle_id)
    return {"ok": True, "image": url}
