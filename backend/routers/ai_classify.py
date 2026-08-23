"""
Smart Re-classify — AI-driven product categorisation.

Keyword rules can't reliably sort thousands of imported products (soon from
multiple suppliers) into the right collection and industry pages: a "Cargo
Bucket Hat" trips the "cargo" rule, a kids' tartan lounge set looks like
"bottoms", and healthcare is starved because only a handful of narrow words ever
match. This module reads each product NAME and asks Claude to make a per-item
decision across every collection and industry the site actually has — the "go
through each item and decide properly" approach, automated so it's feasible
across the whole catalogue.

Flow (nothing is saved until the admin approves):
  1. POST /admin/ai-classify/preview   → classify a batch, store proposals, return them
  2. (repeat for each batch until the whole catalogue is covered)
  3. GET  /admin/ai-classify/proposals → review everything proposed so far
  4. POST /admin/ai-classify/apply     → write approved proposals back to products
  5. POST /admin/ai-classify/clear     → discard proposals and start over

Proposals live in db.ai_classify_proposals (one doc per product) so the browser
never has to hold or round-trip thousands of rows.
"""
from __future__ import annotations

import json
import re
from typing import Dict, List, Optional

import httpx
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from deps import api_router, db, require_admin, _get_integration_value

# The canonical vocabularies the AI must choose from. Kept here (not imported
# from server.py) so this module has no import cycle; the AI is constrained to
# exactly these values and anything else is rejected at validation.
CATEGORIES = [
    "t-shirts", "hoodies", "polos", "shirts", "sweatshirts", "jackets",
    "hi-vis", "shorts", "bottoms", "aprons", "hats", "footwear",
    "towels", "promotional", "kids-baby", "bags", "accessories",
]
INDUSTRIES = [
    "healthcare", "construction-trades", "retail", "security", "corporate",
    "sports-fitness", "industrial", "beauty-wellness", "cleaning",
    "hospitality-catering", "education-schools",
]
FITS = ["mens", "womens", "unisex", "kids"]

CATEGORY_HELP = (
    "t-shirts (incl. tunics/vests worn as tops), hoodies, polos, shirts (formal/oxford/blouses), "
    "sweatshirts (crew/jumper), jackets (incl. fleece/gilet/softshell/coat/coverall), "
    "hi-vis (any high-visibility garment), shorts, bottoms (trousers/joggers/leggings/chinos), "
    "aprons, hats (caps/beanies/bucket hats), footwear (boots/shoes/wellies), "
    "towels (towels/robes), promotional (mugs/bottles/pens/gifts), "
    "kids-baby (anything sized for children/babies/toddlers, incl. pyjamas & lounge sets), "
    "bags (backpacks/duffles/holdalls/drawstring bags/tote bags/shoe bags/kit bags/gym bags), "
    "accessories (socks/gloves/knee pads/lanyards/scarves/beanies-if-not-hats/anything else that is not a garment or a bag)"
)
INDUSTRY_HELP = (
    "healthcare (clinics, dental, care, vets — tunics, scrubs, soft polos), "
    "construction-trades (builders, sparks, plumbers — hi-vis, workwear tees/hoodies/trousers, NOT kids or leisure wear), "
    "retail (shop floor polos/tees), security (door/patrol — often bold black), "
    "corporate (office — shirts, blouses, smart polos, softshells), "
    "sports-fitness (gym/running/team/dance/martial arts activewear), "
    "industrial (factory/warehouse/logistics durable workwear), "
    "beauty-wellness (salons, spa, barber, hair — tunics, aprons), "
    "cleaning (cleaners/janitorial — tabards, polos, hi-vis), "
    "hospitality-catering (chefs, waiting, bar, hotel — aprons, chef wear, tunics), "
    "education-schools (school/college/nursery staff and teams — polos, sweatshirts, hoodies, fleeces)"
)

BATCH_SIZE = 25   # products per AI call — keeps each prompt small and reliable
MODEL = "claude-haiku-4-5-20251001"


class PreviewIn(BaseModel):
    offset: int = 0
    limit: int = BATCH_SIZE
    only_missing: bool = False   # if True, only classify products with no tags yet


class ApplyIn(BaseModel):
    # Optional list of product IDs to apply; if omitted, applies ALL proposals.
    product_ids: Optional[List[str]] = None
    # If False (default) we never overwrite a product an admin has hand-edited.
    overwrite_manual: bool = False


def _clean_json(text: str):
    """Claude sometimes wraps JSON in prose or ```json fences. Strip and parse."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    start = t.find("[")
    end = t.rfind("]")
    if start != -1 and end != -1 and end > start:
        t = t[start:end + 1]
    return json.loads(t)


def _system_prompt() -> str:
    return (
        "You are a product classifier for a UK custom-print & workwear shop. "
        "For each product you are given (an id and a name), decide:\n"
        f"1. category — EXACTLY ONE of: {', '.join(CATEGORIES)}.\n   Meanings: {CATEGORY_HELP}.\n"
        f"2. industries — choose EVERY industry this product genuinely suits, from: {', '.join(INDUSTRIES)}.\n"
        f"   Meanings: {INDUSTRY_HELP}.\n"
        f"3. fit — EXACTLY ONE of: {', '.join(FITS)}.\n"
        "Rules: Judge by the product NAME. Children's/baby/toddler items go to category kids-baby, "
        "fit kids, and industries [] (never trade pages). Pyjamas, lounge sets, nightwear, dressing gowns, "
        "and rain suits are consumer wear — never construction-trades. Boots/shoes go to footwear. "
        "Bags of any kind (backpacks, duffles, holdalls, drawstring, tote, shoe/gym/kit bags) go to bags. "
        "Socks, gloves, knee pads, lanyards, scarves go to accessories. Only tag an industry when the garment is "
        "genuinely a natural, common choice for that trade's uniform — not merely possible. "
        "There is NO limit: tag EVERY industry the product genuinely suits. A plain, versatile garment "
        "(a classic polo, basic tee, crew sweatshirt, softshell) honestly suits many trades — corporate, retail, "
        "hospitality-catering, industrial, cleaning, security, education-schools, healthcare — so list ALL of them. "
        "A niche or specialised item should get few or none: [] is a valid, common answer. Judge each product on its "
        "own merits — never force an industry that isn't a real fit, and never invent fit to reach a number. "
        "Never tag kids/baby, pyjamas, lounge, nightwear or leisure items with any trade. "
        "Respond with ONLY a JSON array, one object per product, no prose:\n"
        '[{"id":"<id>","category":"<one>","industries":["<..>"],"fit":"<one>"}]'
    )


async def _classify_batch(api_key: str, items: List[Dict]) -> List[Dict]:
    """Call Claude once for a batch of {id,name}. Returns list of proposals."""
    user = "Classify these products:\n" + "\n".join(
        f'- id={it["id"]} name="{it["name"]}"' for it in items
    )
    async with httpx.AsyncClient(timeout=120) as http:
        resp = await http.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": 4000,
                "system": _system_prompt(),
                "messages": [{"role": "user", "content": user}],
            },
        )
    if resp.status_code != 200:
        raise HTTPException(502, f"AI request failed ({resp.status_code}): {resp.text[:300]}")
    data = resp.json()
    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    try:
        rows = _clean_json(text)
    except Exception as e:
        raise HTTPException(502, f"Couldn't parse AI response: {str(e)[:200]}")

    valid_by_id = {it["id"]: it["name"] for it in items}
    out = []
    for r in rows:
        pid = str(r.get("id", ""))
        if pid not in valid_by_id:
            continue
        cat = r.get("category")
        if cat not in CATEGORIES:
            cat = None
        # No cap: Claude judges per product which industries genuinely fit. We only
        # keep valid, de-duplicated slugs (order preserved).
        seen = set()
        inds = []
        for i in (r.get("industries") or []):
            if i in INDUSTRIES and i not in seen:
                seen.add(i); inds.append(i)
        fit = r.get("fit") if r.get("fit") in FITS else None
        out.append({
            "id": pid,
            "name": valid_by_id[pid],
            "category": cat,
            "industries": inds,
            "fit": fit,
        })
    return out


@api_router.post("/admin/ai-classify/preview", dependencies=[Depends(require_admin)])
async def ai_classify_preview(payload: PreviewIn):
    """Classify one batch and STORE the proposals (no product is changed).
    Returns the proposals plus paging info so the UI can loop through the catalogue."""
    api_key = await _get_integration_value("anthropic_api_key")
    if not api_key:
        raise HTTPException(400, "No Anthropic API key set. Add it in Admin → Integrations first.")

    query: Dict = {}
    if payload.only_missing:
        query = {"$or": [{"industry_tags": {"$exists": False}}, {"industry_tags": []}]}

    total = await db.imported_products.count_documents(query)
    cursor = db.imported_products.find(query).sort("id", 1).skip(max(0, payload.offset)).limit(
        max(1, min(payload.limit, BATCH_SIZE))
    )
    items = []
    async for doc in cursor:
        pid = doc.get("id")
        name = doc.get("name") or ""
        if pid and name:
            items.append({"id": pid, "name": name})

    if not items:
        return {"proposals": [], "processed": 0, "total": total, "next_offset": None, "done": True}

    proposals = await _classify_batch(api_key, items)

    for p in proposals:
        cur = await db.imported_products.find_one({"id": p["id"]}, {"category": 1, "industry_tags": 1, "gender_fit": 1})
        await db.ai_classify_proposals.update_one(
            {"id": p["id"]},
            {"$set": {
                "id": p["id"],
                "name": p["name"],
                "proposed": {"category": p["category"], "industries": p["industries"], "fit": p["fit"]},
                "current": {
                    "category": (cur or {}).get("category"),
                    "industries": (cur or {}).get("industry_tags") or [],
                    "fit": (cur or {}).get("gender_fit"),
                },
            }},
            upsert=True,
        )

    next_offset = payload.offset + len(items)
    done = next_offset >= total
    return {
        "proposals": proposals,
        "processed": len(proposals),
        "total": total,
        "next_offset": None if done else next_offset,
        "done": done,
    }


@api_router.get("/admin/ai-classify/proposals", dependencies=[Depends(require_admin)])
async def ai_classify_proposals(offset: int = 0, limit: int = 50, changed_only: bool = True):
    """Page through stored proposals for review. changed_only hides products the
    AI would leave exactly as they are."""
    all_docs = []
    async for d in db.ai_classify_proposals.find({}).sort("name", 1):
        prop = d.get("proposed", {})
        cur = d.get("current", {})
        changed = (
            prop.get("category") != cur.get("category")
            or sorted(prop.get("industries") or []) != sorted(cur.get("industries") or [])
            or prop.get("fit") != cur.get("fit")
        )
        if changed_only and not changed:
            continue
        all_docs.append({
            "id": d["id"], "name": d.get("name"),
            "proposed": prop, "current": cur, "changed": changed,
        })
    total = await db.ai_classify_proposals.count_documents({})
    window = all_docs[offset:offset + limit]
    return {"proposals": window, "changed_total": len(all_docs), "grand_total": total}


@api_router.post("/admin/ai-classify/apply", dependencies=[Depends(require_admin)])
async def ai_classify_apply(payload: ApplyIn):
    """Write approved proposals back to the products. Updates category on the
    imported product and industry_tags/gender_fit on product_meta (so the rest of
    the site picks them up exactly as if set by hand in the admin)."""
    q: Dict = {}
    if payload.product_ids:
        q = {"id": {"$in": payload.product_ids}}

    applied = 0
    skipped_manual = 0
    async for d in db.ai_classify_proposals.find(q):
        pid = d["id"]
        prop = d.get("proposed", {})
        if not prop.get("category"):
            continue

        meta = await db.product_meta.find_one({"product_id": pid}) or {}
        if meta.get("_manual_edit") and not payload.overwrite_manual:
            skipped_manual += 1
            continue

        # 1) category lives on the imported product record
        await db.imported_products.update_one(
            {"id": pid}, {"$set": {"category": prop["category"]}}
        )
        # 2) industry tags + fit live on product_meta (the admin-editable overlay)
        meta_update = {"industry_tags": prop.get("industries") or []}
        if prop.get("fit"):
            meta_update["gender_fit"] = prop["fit"]
        await db.product_meta.update_one(
            {"product_id": pid},
            {"$set": {"product_id": pid, **meta_update}},
            upsert=True,
        )
        applied += 1

    return {"applied": applied, "skipped_manual": skipped_manual}


@api_router.post("/admin/ai-classify/clear", dependencies=[Depends(require_admin)])
async def ai_classify_clear():
    """Discard all stored proposals (start a fresh run)."""
    res = await db.ai_classify_proposals.delete_many({})
    return {"cleared": res.deleted_count}


@api_router.get("/admin/ai-classify/status", dependencies=[Depends(require_admin)])
async def ai_classify_status():
    """Quick counts for the UI: total products, how many proposals stored, and
    whether an API key is configured."""
    total_products = await db.imported_products.count_documents({})
    proposals = await db.ai_classify_proposals.count_documents({})
    has_key = bool(await _get_integration_value("anthropic_api_key"))
    return {"total_products": total_products, "proposals_stored": proposals, "has_key": has_key, "batch_size": BATCH_SIZE}
