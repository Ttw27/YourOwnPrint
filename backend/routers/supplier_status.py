"""
Clearance check (admin) - /admin/clearance/*

PenCarrie's export flags every style/colour/size row as Clearance and/or
Discontinued, but the product import ignored those columns - so clearance
stock (which disappears soon) got imported like normal lines. This checks the
LIVE PenCarrie export and marks each PenCarrie product with:
  supplier_status = "ending"   every colour/size is clearance or discontinued
                    "partial"  some colours are ending (see ending_colours)
                    "gone"     no longer in PenCarrie's export at all
                    "ok"       nothing ending
Stored on the imported_products doc (so it survives restarts), shown as a
badge/filter in Product settings, with one-click "hide all ending" and
"remove ending colours" actions.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import Depends, HTTPException

from deps import api_router, db, require_admin

_TRUE = ("1", "true", "yes", "y")


def _col(row: Dict, *names: str) -> str:
    lower = {k.lower().strip(): k for k in row.keys()}
    for n in names:
        k = lower.get(n.lower())
        if k is not None:
            return str(row.get(k) or "").strip()
    return ""


def summarise_rows(rows: List[Dict]) -> Dict[str, Dict]:
    """style code (lower) -> {status, ending_colours, rows, ending_rows}."""
    styles: Dict[str, Dict] = defaultdict(lambda: {"rows": 0, "ending": 0, "colours": defaultdict(lambda: [0, 0])})
    for r in rows:
        sc = _col(r, "Style Code", "style_code", "style").lower()
        if not sc:
            continue
        ending = _col(r, "Clearance").lower() in _TRUE or _col(r, "Discontinued").lower() in _TRUE
        s = styles[sc]
        s["rows"] += 1
        s["ending"] += int(ending)
        c = s["colours"][_col(r, "Colourway Name", "Colour", "colour_name") or "?"]
        c[0] += 1
        c[1] += int(ending)
    out = {}
    for sc, s in styles.items():
        ending_colours = sorted(name for name, (n, e) in s["colours"].items() if n and e == n)
        if s["rows"] and s["ending"] == s["rows"]:
            status = "ending"
        elif ending_colours:
            status = "partial"
        else:
            status = "ok"
        out[sc] = {"status": status, "ending_colours": ending_colours if status == "partial" else [],
                   "rows": s["rows"], "ending_rows": s["ending"]}
    return out


async def apply_status(summary: Dict[str, Dict]) -> Dict:
    """Write supplier_status onto every PenCarrie product; returns counts + lists."""
    from server import PRODUCTS
    now = datetime.now(timezone.utc).isoformat()
    counts = {"ending": 0, "partial": 0, "gone": 0, "ok": 0}
    lists: Dict[str, List[Dict]] = {"ending": [], "partial": [], "gone": []}
    async for doc in db.imported_products.find({"source": "pencarrie"}, {"id": 1, "name": 1, "active": 1}):
        pid = doc["id"]
        info = summary.get(pid.lower()) or summary.get(pid.split("-")[0].lower())
        status = info["status"] if info else "gone"
        ending_colours = info["ending_colours"] if info else []
        counts[status] += 1
        await db.imported_products.update_one({"id": pid}, {"$set": {
            "supplier_status": status, "ending_colours": ending_colours, "supplier_status_checked_at": now}})
        if pid in PRODUCTS:
            PRODUCTS[pid]["supplier_status"] = status
            PRODUCTS[pid]["ending_colours"] = ending_colours
        if status != "ok":
            lists[status].append({"id": pid, "name": doc.get("name"), "hidden": doc.get("active") is False,
                                  "ending_colours": ending_colours})
    await db.settings.update_one({"key": "clearance_check"}, {"$set": {"key": "clearance_check", "checked_at": now, "counts": counts}}, upsert=True)
    return {"checked_at": now, "counts": counts, **{k: v[:500] for k, v in lists.items()}}


@api_router.post("/admin/clearance/scan", dependencies=[Depends(require_admin)])
async def clearance_scan():
    from server import _pencarrie_export_rows
    rows = await _pencarrie_export_rows()
    if not rows or not any(k.strip().lower() == "clearance" for k in rows[0].keys()):
        raise HTTPException(502, "PenCarrie's export didn't include a Clearance column - their format may have changed.")
    return await apply_status(summarise_rows(rows))


@api_router.get("/admin/clearance/status", dependencies=[Depends(require_admin)])
async def clearance_status():
    doc = await db.settings.find_one({"key": "clearance_check"}) or {}
    return {"checked_at": doc.get("checked_at"), "counts": doc.get("counts") or {}}


@api_router.post("/admin/clearance/hide-ending", dependencies=[Depends(require_admin)])
async def clearance_hide_ending(include_gone: bool = True):
    """Hide every product that's fully clearance/discontinued (and, by default,
    ones no longer in PenCarrie's export). Hidden, never deleted - reversible."""
    from server import _set_product_active
    statuses = ["ending", "gone"] if include_gone else ["ending"]
    hidden = 0
    async for doc in db.imported_products.find({"supplier_status": {"$in": statuses}, "active": {"$ne": False}}, {"id": 1}):
        if await _set_product_active(doc["id"], False):
            hidden += 1
    return {"ok": True, "hidden": hidden}


@api_router.post("/admin/clearance/remove-ending-colours", dependencies=[Depends(require_admin)])
async def clearance_remove_ending_colours():
    """For products where only SOME colours are ending, drop those colours so
    customers can't pick a colour that's about to run out."""
    from server import _apply_imported_product, reapply_saved_settings
    changed = colours_removed = 0
    ids = []
    async for doc in db.imported_products.find({"supplier_status": "partial", "ending_colours.0": {"$exists": True}}):
        ending = set(doc.get("ending_colours") or [])
        keep = [c for c in (doc.get("colors") or []) if (c.get("name") if isinstance(c, dict) else c) not in ending]
        if not keep or len(keep) == len(doc.get("colors") or []):
            continue  # never strip every colour; nothing to do if none matched
        colours_removed += len(doc.get("colors") or []) - len(keep)
        await db.imported_products.update_one({"id": doc["id"]}, {"$set": {"colors": keep, "removed_ending_colours": sorted(ending)}})
        _apply_imported_product({**doc, "colors": keep})
        ids.append(doc["id"])
        changed += 1
    await reapply_saved_settings(ids)
    return {"ok": True, "products_changed": changed, "colours_removed": colours_removed}
