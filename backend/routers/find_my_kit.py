"""
Find My Kit — AI concierge that turns a job/trade into a ready-to-wear kit.

Instead of making a customer wade through collection after collection, they tell
us their trade ("mobile dog groomer", or pick "Construction & Trades") and we
hand back a curated, head-to-toe kit — tops, mid-layers, outerwear, legwear,
headwear and the right extras — grouped like a uniform advisor would lay it out.

How it works (hybrid, so it's fast and cheap for known trades but still copes
with an odd job title):
  1. Map the trade to one or more of our industry tags (direct match, alias, or
     a light keyword map). This is instant and free.
  2. Gather candidate products the shop actually stocks for those industries,
     grouped by collection so the AI has a real menu to choose from — never
     inventing products.
  3. Ask Claude to act as the concierge: pick a balanced ~15-item kit ACROSS
     categories and group it into sensible sections with a one-line reason each.
     The AI only chooses from the candidate IDs we supply, so every pick is a
     real, in-stock product.

Nothing here writes to the catalogue — it's read-only and per-request.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Dict, List, Optional

import httpx
from fastapi import Depends
from pydantic import BaseModel

from deps import api_router, db, _get_integration_value

MODEL = "claude-haiku-4-5-20251001"

# The fixed head-to-toe uniform skeleton. Every kit is built from these sections
# in this order; each maps to the collections it draws from and the primary
# collection its "see all" link points to. Sections with nothing to fill are
# dropped, so a hairdresser simply won't get a Hi-vis & Safety section.
UNIFORM_SECTIONS = [
    {"title": "Headwear",          "cats": ["hats"],                         "see_all": "hats"},
    {"title": "Tops",              "cats": ["t-shirts", "polos", "shirts"],  "see_all": "polos"},
    {"title": "Mid layers",        "cats": ["sweatshirts", "hoodies"],       "see_all": "hoodies"},
    {"title": "Outerwear",         "cats": ["jackets"],                      "see_all": "jackets"},
    {"title": "Hi-vis & Safety",   "cats": ["hi-vis"],                       "see_all": "hi-vis"},
    {"title": "Legwear",           "cats": ["bottoms", "shorts"],            "see_all": "bottoms"},
    {"title": "Footwear",          "cats": ["footwear"],                     "see_all": "footwear"},
    {"title": "Gloves & Extras",   "cats": ["accessories", "aprons", "towels", "bags"], "see_all": "accessories"},
]
_SECTION_ORDER = [x["title"] for x in UNIFORM_SECTIONS]
_SEE_ALL = {x["title"]: x["see_all"] for x in UNIFORM_SECTIONS}
_CAT_TO_SECTION = {}
for _sec in UNIFORM_SECTIONS:
    for _c in _sec["cats"]:
        _CAT_TO_SECTION[_c] = _sec["title"]

# The canonical industries a trade can map to (must match the site's tags).
CANONICAL_INDUSTRIES = [
    "healthcare", "construction-trades", "retail", "security", "corporate",
    "sports-fitness", "industrial", "beauty-wellness", "cleaning",
    "hospitality-catering", "education-schools",
]

# Aliases the customer's own words might use → canonical industry.
_ALIASES = {
    "trades": "construction-trades", "construction": "construction-trades",
    "builder": "construction-trades", "builders": "construction-trades",
    "trade": "construction-trades", "tradesman": "construction-trades",
    "logistics": "industrial", "warehouse": "industrial", "factory": "industrial",
    "fitness": "sports-fitness", "gym": "sports-fitness", "sport": "sports-fitness",
    "sports": "sports-fitness", "dance": "sports-fitness",
    "beauty": "beauty-wellness", "hair-beauty": "beauty-wellness",
    "salon": "beauty-wellness", "spa": "beauty-wellness", "barber": "beauty-wellness",
    "hospitality": "hospitality-catering", "catering": "hospitality-catering",
    "hotel": "hospitality-catering", "restaurant": "hospitality-catering",
    "cafe": "hospitality-catering", "bar": "hospitality-catering",
    "care": "healthcare", "dental": "healthcare", "vet": "healthcare",
    "clinic": "healthcare", "medical": "healthcare",
    "office": "corporate", "professional": "corporate",
    "shop": "retail", "store": "retail",
    "school": "education-schools", "college": "education-schools",
    "nursery": "education-schools", "teacher": "education-schools",
    "education": "education-schools",
    "cleaner": "cleaning", "janitor": "cleaning", "cleaning": "cleaning",
    "door": "security", "patrol": "security", "guard": "security",
    "security": "security",
}

# Light keyword hints for free-text job titles that don't match a slug/alias.
_KEYWORD_HINTS = [
    (("groom", "dog", "pet", "kennel"), ["beauty-wellness", "retail"]),
    (("plumb", "electric", "spark", "carpenter", "roofer", "scaffold", "brick", "joiner", "landscap", "garden"), ["construction-trades", "industrial"]),
    (("chef", "waiter", "waitress", "kitchen", "barista"), ["hospitality-catering"]),
    (("nurse", "carer", "dentist", "physio", "pharmac"), ["healthcare"]),
    (("teacher", "tutor", "classroom", "pupil"), ["education-schools"]),
    (("trainer", "coach", "yoga", "pilates", "martial"), ["sports-fitness"]),
    (("hairdress", "beautician", "nail", "makeup", "aesthetic"), ["beauty-wellness"]),
    (("driver", "courier", "forklift", "picker"), ["industrial"]),
    (("bouncer", "steward", "marshal"), ["security"]),
    (("receptionist", "admin", "account", "consultant", "estate agent"), ["corporate", "retail"]),
]


class KitRequest(BaseModel):
    industry: Optional[str] = None   # a chosen industry slug
    trade: Optional[str] = None      # free-text job title


def _resolve_industries(industry: Optional[str], trade: Optional[str]) -> List[str]:
    """Map the request to a list of canonical industry slugs."""
    out: List[str] = []

    def add(slug: str):
        s = _ALIASES.get(slug, slug)
        if s in CANONICAL_INDUSTRIES and s not in out:
            out.append(s)

    if industry:
        add(industry.strip().lower())

    if trade:
        t = trade.strip().lower()
        # direct slug / alias hit on any word
        for word in re.split(r"[^a-z]+", t):
            if not word:
                continue
            if word in CANONICAL_INDUSTRIES or word in _ALIASES:
                add(word)
        # keyword hints
        for keys, inds in _KEYWORD_HINTS:
            if any(k in t for k in keys):
                for i in inds:
                    add(i)

    return out


def _clean_json(text: str):
    t = text.strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    start = t.find("{")
    end = t.rfind("}")
    if start != -1 and end != -1 and end > start:
        t = t[start:end + 1]
    return json.loads(t)


def _gather_candidates(industries: List[str]) -> List[Dict]:
    """Products the shop stocks for these industries, as a compact candidate list."""
    from server import PRODUCTS, canonical_industries  # local import avoids cycle

    wanted = set()
    for i in industries:
        for c in canonical_industries([i]):
            wanted.add(c)

    cands = []
    _iter = sorted(PRODUCTS.values(), key=lambda x: (not bool(x.get("is_bestseller")), str(x.get("name") or "")))
    for p in _iter:
        # Designer-only products (blank canvases for the Design-Your-Own tool) are
        # not real off-the-shelf kit, so never surface them in Find My Kit.
        if p.get("designer_only"):
            continue
        # Design Shop (ready-made printed designs) are a separate consumer store,
        # never workwear kit.
        if p.get("design_shop"):
            continue
        tags = set(canonical_industries(p.get("industry_tags") or []))
        # A product is a candidate if it suits one of the wanted industries.
        # (If we found no industries at all, fall back to everything so the AI
        # can still assemble something sensible from the whole range.)
        if wanted and not (tags & wanted):
            continue
        cands.append({
            "id": p["id"],
            "name": p["name"],
            "category": p.get("category") or "",
            "price": round(float(p.get("price") or 0), 2),
            "fit": p.get("gender_fit") or "unisex",
            "bestseller": bool(p.get("is_bestseller")),
        })
    return cands


def _system_prompt() -> str:
    return (
        "You are a friendly uniform & workwear concierge for a UK custom-print shop. "
        "Given a customer's trade and a list of products the shop actually stocks for that trade, "
        "assemble ONE practical, head-to-toe kit for them.\n"
        "Rules:\n"
        "- Choose ONLY from the provided product ids. Never invent products.\n"
        "- Build a BALANCED kit ACROSS categories — not many of one type. Think like kitting out a "
        "team: everyday tops, a mid-layer/warm option, outerwear if relevant, appropriate legwear, "
        "headwear, and the genuinely useful extras (e.g. gloves, aprons, bags, towels) for THAT trade.\n"
        "- Organise the kit into these FIXED sections, in this order: "
        "Headwear, Tops, Mid layers, Outerwear, Hi-vis & Safety, Legwear, Footwear, Gloves & Extras.\n"
        "- Fill EVERY section you genuinely can from the available products — e.g. a plumber or builder "
        "should get Footwear (safety boots) and Hi-vis & Safety; don't skip those when suitable items exist. "
        "SKIP a section only when nothing in stock genuinely fits that trade (e.g. no Hi-vis for a hairdresser).\n"
        "- Put 1-3 items in each section you fill. Aim for a complete uniform, not a huge list.\n"
        "- For each item give a SHORT reason (max ~10 words) why it suits this trade.\n"
        "- STRONGLY prefer items marked BESTSELLER — lead each section with them; these are the shop's proven "
        "popular choices and should appear first whenever they fit the trade.\n"
        "- Favour sensible, good-value everyday all-rounders over niche or premium items. Don't fill the kit "
        "with the most expensive options; pick the practical choice a typical customer in that trade would want.\n"
        "- Be consistent: for the same trade, choose the same core items rather than varying them.\n"
        "Respond with ONLY JSON, no prose:\n"
        '{"intro":"<one friendly sentence>","sections":[{"title":"<section>","items":['
        '{"id":"<product id>","reason":"<short why>"}]}]}'
    )


@api_router.post("/find-my-kit")
async def find_my_kit(payload: KitRequest):
    """Build a grouped, concierge kit for a trade. Read-only."""
    industries = _resolve_industries(payload.industry, payload.trade)
    candidates = _gather_candidates(industries)

    # Nothing at all to work with.
    if not candidates:
        return {"ok": False, "reason": "no_products", "industries": industries,
                "message": "We couldn't find matching products just yet — try a broader trade or browse the collections."}

    api_key = await _get_integration_value("anthropic_api_key")
    if not api_key:
        # Graceful fallback: no AI available — return a simple balanced spread by
        # category so the feature still does something useful.
        return _fallback_kit(candidates, industries)

    # Keep the candidate list a sensible size for the prompt (the AI only needs a
    # good menu, not the entire catalogue). Cap per category so no single type
    # dominates the choices.
    trimmed = _trim_candidates(candidates, per_category=12, total_cap=160)

    menu = "\n".join(
        f'- id={c["id"]} | {c["name"]} | {c["category"]} | £{c["price"]:.2f} | {c["fit"]}'
        + (" | BESTSELLER" if c.get("bestseller") else "")
        for c in trimmed
    )
    who = payload.trade or (industries[0] if industries else "general workwear")
    user = f"Customer trade: {who}\nIndustries: {', '.join(industries) or 'general'}\n\nProducts in stock:\n{menu}"

    try:
        data = await _call_ai(api_key, user)
        result = _clean_json(data)
    except Exception:
        return _fallback_kit(candidates, industries)

    # Resolve the AI's chosen ids back to full product cards, dropping anything
    # that isn't a real candidate (defends against hallucinated ids).
    by_id = {c["id"]: c for c in candidates}
    from server import PRODUCTS

    # Bucket every chosen product into the FIXED uniform skeleton by its category,
    # regardless of how the AI labelled its own sections. This guarantees a
    # consistent head-to-toe structure across trades.
    buckets = {sec["title"]: [] for sec in UNIFORM_SECTIONS}
    used = set()
    for sec in (result.get("sections") or []):
        for it in (sec.get("items") or []):
            pid = str(it.get("id", ""))
            if pid in by_id and pid not in used and pid in PRODUCTS:
                used.add(pid)
                prod = PRODUCTS[pid]
                cat = prod.get("category") or ""
                title = _CAT_TO_SECTION.get(cat, "Gloves & Extras")
                buckets[title].append({
                    "id": pid,
                    "name": prod["name"],
                    "price": round(float(prod.get("price") or 0), 2),
                    "image": prod.get("image") or "",
                    "category": cat,
                    "reason": (it.get("reason") or "")[:120],
                    "bestseller": bool(prod.get("is_bestseller")),
                })

    # Emit sections in the fixed order, dropping any that stayed empty, and
    # attaching a "see all" link (whole collection) for each.
    out_sections = []
    for sec in UNIFORM_SECTIONS:
        items = buckets[sec["title"]]
        if not items:
            continue
        items.sort(key=lambda x: not x.get("bestseller"))  # bestsellers first
        out_sections.append({
            "title": sec["title"],
            "items": items,
            "see_all_slug": sec["see_all"],
        })

    if not out_sections:
        return _fallback_kit(candidates, industries)

    return {
        "ok": True,
        "intro": (result.get("intro") or "")[:240],
        "industries": industries,
        "sections": out_sections,
        "count": sum(len(x["items"]) for x in out_sections),
    }


async def _call_ai(api_key: str, user: str) -> str:
    payload = {
        "model": MODEL,
        "max_tokens": 1500,
        "system": _system_prompt(),
        "messages": [{"role": "user", "content": user}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    last = None
    for attempt in range(1, 4):
        try:
            async with httpx.AsyncClient(timeout=60) as http:
                resp = await http.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            if resp.status_code == 200:
                d = resp.json()
                return "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")
            if resp.status_code in (429, 500, 502, 503, 529):
                last = resp.status_code
                await asyncio.sleep(attempt * 1.5)
                continue
            raise RuntimeError(f"AI {resp.status_code}")
        except (httpx.TimeoutException, httpx.TransportError):
            await asyncio.sleep(attempt * 1.5)
    raise RuntimeError(f"AI failed after retries ({last})")


def _trim_candidates(cands: List[Dict], per_category: int, total_cap: int) -> List[Dict]:
    by_cat: Dict[str, List[Dict]] = {}
    for c in cands:
        by_cat.setdefault(c["category"], []).append(c)
    out = []
    for cat, items in by_cat.items():
        out.extend(items[:per_category])
    return out[:total_cap]


def _fallback_kit(candidates: List[Dict], industries: List[str]) -> Dict:
    """Simple balanced spread using the fixed skeleton when the AI isn't available."""
    from server import PRODUCTS
    by_cat: Dict[str, List[Dict]] = {}
    for c in candidates:
        by_cat.setdefault(c["category"], []).append(c)

    sections = []
    for sec in UNIFORM_SECTIONS:
        items = []
        for cat in sec["cats"]:
            for c in by_cat.get(cat, [])[:2]:
                prod = PRODUCTS.get(c["id"])
                if not prod:
                    continue
                items.append({
                    "id": c["id"], "name": prod["name"],
                    "price": round(float(prod.get("price") or 0), 2),
                    "image": prod.get("image") or "", "category": cat,
                    "reason": "", "bestseller": bool(prod.get("is_bestseller")),
                })
        if items:
            items.sort(key=lambda x: not x.get("bestseller"))
            sections.append({"title": sec["title"], "items": items[:3], "see_all_slug": sec["see_all"]})

    return {
        "ok": True,
        "intro": "Here's a starter kit based on what we stock for your trade.",
        "industries": industries,
        "sections": sections,
        "count": sum(len(x["items"]) for x in sections),
        "fallback": True,
    }
