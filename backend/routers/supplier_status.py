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

from fastapi import Depends, File, HTTPException, UploadFile

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
    return {"checked_at": doc.get("checked_at"), "counts": doc.get("counts") or {}, "source": doc.get("source") or ""}


@api_router.post("/admin/clearance/hide-ending", dependencies=[Depends(require_admin)])
async def clearance_hide_ending(include_gone: bool = True):
    """Hide every product that's fully clearance/discontinued (and, by default,
    ones no longer in PenCarrie's export). Hidden, never deleted - reversible."""
    from server import _set_product_active
    statuses = ["ending", "gone"] if include_gone else ["ending"]
    hidden = 0
    ending_ids = set()
    async for doc in db.imported_products.find({"supplier_status": {"$in": statuses}}, {"id": 1, "active": 1}):
        ending_ids.add(doc["id"])
        if doc.get("active") is not False and await _set_product_active(doc["id"], False):
            hidden += 1
    # Bundles that include any of them can't be fulfilled either - hide those too.
    bundles_hidden = 0
    async for b in db.imported_products.find({"source": "bundle", "active": {"$ne": False}}, {"id": 1, "bundle_items": 1}):
        if any(i.get("product_id") in ending_ids for i in b.get("bundle_items") or []):
            if await _set_product_active(b["id"], False):
                bundles_hidden += 1
    return {"ok": True, "hidden": hidden, "bundles_hidden": bundles_hidden}


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
    # Bundles using those products: drop the ending colours from the bundle's
    # colour choices too (never removing every colour).
    ending_by_pid = {}
    async for doc in db.imported_products.find({"supplier_status": "partial"}, {"id": 1, "ending_colours": 1}):
        ending_by_pid[doc["id"]] = {(c or "").strip().lower() for c in doc.get("ending_colours") or []}
    bundles_changed = 0
    async for b in db.imported_products.find({"source": "bundle"}):
        drop = set().union(*[ending_by_pid.get(i.get("product_id"), set()) for i in b.get("bundle_items") or []] or [set()])
        keep = [c for c in (b.get("colors") or []) if (c.get("name") or "").strip().lower() not in drop]
        if drop and keep and len(keep) < len(b.get("colors") or []):
            await db.imported_products.update_one({"id": b["id"]}, {"$set": {"colors": keep}})
            _apply_imported_product({**b, "colors": keep})
            ids.append(b["id"])
            bundles_changed += 1
    await reapply_saved_settings(ids)
    return {"ok": True, "products_changed": changed, "colours_removed": colours_removed, "bundles_changed": bundles_changed}


@api_router.post("/admin/clearance/scan-file", dependencies=[Depends(require_admin)])
async def clearance_scan_file(file: UploadFile = File(...)):
    """Same check, from PenCarrie's product export uploaded by hand (the .zip
    from their website, or the products.csv inside it) - no API token needed.
    Read as a stream, keeping only the few columns the check needs."""
    import csv
    import io
    import tempfile
    import zipfile
    csv.field_size_limit(10 ** 9)
    keep = ("style code", "colourway name", "clearance", "discontinued")
    rows: List[Dict] = []
    with tempfile.TemporaryFile() as tmp:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        tmp.seek(0)
        head = tmp.read(4)
        tmp.seek(0)
        if head.startswith(b"PK"):
            try:
                zf = zipfile.ZipFile(tmp)
            except zipfile.BadZipFile:
                raise HTTPException(400, "That zip file couldn't be opened")
            name = next((n for n in zf.namelist() if n.lower().endswith(".csv")), None)
            if not name:
                raise HTTPException(400, "No CSV file inside that zip")
            raw = zf.open(name)
        else:
            raw = tmp
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="")
        reader = csv.DictReader(text)
        if not reader.fieldnames or "clearance" not in {h.strip().lower() for h in reader.fieldnames}:
            raise HTTPException(400, "That doesn't look like PenCarrie's product export (no Clearance column)")
        for r in reader:
            rows.append({k: v for k, v in r.items() if k and k.strip().lower() in keep})
    if not rows:
        raise HTTPException(400, "The file had no product rows")
    return await apply_status(summarise_rows(rows))


# ---------------------------------------------------------------------------
# One-off: apply the clearance/discontinued list taken from PenCarrie's
# 10 Jul 2026 product export (data/pencarrie_clearance_2026_07.json), since
# there's no working API connection. Runs once (marker-guarded) after the
# products load: tags matching products, hides the fully discontinued ones
# (and bundles that include them), and removes ending colours from the rest.
# Products not in the list are left alone (not marked "gone" - we only know
# what the file said). All reversible from Product settings.
# ---------------------------------------------------------------------------
CLEARANCE_LIST_FILE = "pencarrie_clearance_2026_07.json"
CLEARANCE_LIST_MARKER = "clearance_list_2026_07_v1"


async def apply_clearance_list() -> Dict:
    import json
    from pathlib import Path
    from server import PRODUCTS
    data = json.loads((Path(__file__).resolve().parent.parent / "data" / CLEARANCE_LIST_FILE).read_text())
    styles: Dict[str, Dict] = data.get("styles") or {}
    now = datetime.now(timezone.utc).isoformat()
    counts = {"ending": 0, "partial": 0}
    async for doc in db.imported_products.find({"source": "pencarrie"}, {"id": 1}):
        info = styles.get(doc["id"].lower())
        if not info:
            continue
        counts[info["status"]] += 1
        await db.imported_products.update_one({"id": doc["id"]}, {"$set": {
            "supplier_status": info["status"], "ending_colours": info.get("ending_colours") or [],
            "supplier_status_checked_at": now}})
        if doc["id"] in PRODUCTS:
            PRODUCTS[doc["id"]]["supplier_status"] = info["status"]
            PRODUCTS[doc["id"]]["ending_colours"] = info.get("ending_colours") or []
    hidden = await clearance_hide_ending(include_gone=False)
    colours = await clearance_remove_ending_colours()
    await db.settings.update_one({"key": "clearance_check"}, {"$set": {
        "key": "clearance_check", "checked_at": now, "counts": {**counts, "gone": 0},
        "source": data.get("source") or "PenCarrie export"}}, upsert=True)
    return {"counts": counts, **hidden, **colours}


@api_router.on_event("startup")
async def _apply_clearance_list_once():
    import logging
    try:
        if await db.settings.find_one({"key": CLEARANCE_LIST_MARKER}):
            return
        result = await apply_clearance_list()
        await db.settings.update_one({"key": CLEARANCE_LIST_MARKER},
                                     {"$set": {"key": CLEARANCE_LIST_MARKER, "result": result,
                                               "ran_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        logging.info(f"clearance list applied: {result}")
    except Exception as e:
        logging.warning(f"clearance list skipped: {e}")
