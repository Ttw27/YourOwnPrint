"""Club shops - parent / member pre-order links (Tim, Oct 2026).

An organiser (dance studio, club, school, PTA...) sets up a shop at
/club-shop/new: their name, logo, a closing date and up to 8 garments (each in
one colour, name on the back optional). They get a link to share (/club/<code>)
and a private organiser link. Each parent picks sizes (and the child's name)
and pays for their own order through the normal basket checkout - lines carry
design_meta.flow == "club_shop" + club_code, and server._resolve_line_pricing
prices them with club_print() (garment price + logo £3 + name £3). Everything
for one shop is listed together for the organiser and in Admin > Club shops.

Staff order links (mode == "company", Oct 2026): same shop, but staff only pick
garments + sizes (no payment, optional allowance per item = max_each). Their
choices are stored in db.club_shop_staff; the organiser sees them on the manage
page and sends ONE order - pay everything by card (normal basket checkout, lines
flow "club_shop") or request an invoice (saved as a quote request, emailed to the
shop). club_print allows company shops after they close, since the organiser pays.
"""
from __future__ import annotations

import csv
import io
import os
import re
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import Depends, HTTPException, Response
from pydantic import BaseModel

from deps import api_router, db, require_admin

LOGO_PRICE = 3.00
NAME_PRICE = 3.00
MAX_ITEMS = 8


def _site() -> str:
    return (os.environ.get("SITE_BASE_URL") or "https://www.yourownprint.co.uk").rstrip("/")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _open(shop: Dict) -> bool:
    if shop.get("status") != "open":
        return False
    d = shop.get("closes_on") or ""
    return not d or d >= datetime.now(timezone.utc).date().isoformat()


def _item_view(it: Dict) -> Optional[Dict]:
    from server import PRODUCTS, is_live
    p = PRODUCTS.get(it["product_id"])
    if not p or not is_live(p):
        return None
    col = next((c for c in (p.get("colors") or []) if isinstance(c, dict) and c.get("name") == it.get("colour")), None)
    ups = p.get("size_upcharges") or {}
    cup = float((p.get("colour_upcharges") or {}).get(it.get("colour") or "", 0) or 0)
    base = float(p.get("price") or 0) + cup + LOGO_PRICE
    return {"product_id": p["id"], "name": it.get("label") or p.get("name"), "garment": p.get("name"),
            "colour": it.get("colour"), "image": (col or {}).get("image") or p.get("image"),
            "names": bool(it.get("names")), "max_each": int(it.get("max_each") or 0),
            "sizes": [{"size": s, "price": round(base + float(ups.get(s, 0) or 0), 2)} for s in (p.get("sizes") or [])]}


async def club_logo(code: str) -> str:
    shop = await db.club_shops.find_one({"code": code}, {"logo": 1})
    return (shop or {}).get("logo") or ""


async def club_print(product_id: str, placements: List[str], color: Optional[str], design_meta: Dict) -> Tuple[List[str], float]:
    """Called from server._resolve_line_pricing for flow == "club_shop"."""
    code = (design_meta or {}).get("club_code") or ""
    shop = await db.club_shops.find_one({"code": code})
    if not shop:
        raise HTTPException(400, "That club shop doesn't exist")
    if not _open(shop) and shop.get("mode") != "company":
        raise HTTPException(400, f"Sorry - the {shop.get('name')} shop has closed")
    it = next((i for i in shop.get("items") or [] if i["product_id"] == product_id and i.get("colour") == color), None)
    if not it:
        raise HTTPException(400, "That item isn't in this club shop")
    clean, cost = ["logo"], LOGO_PRICE
    if it.get("names") and (design_meta or {}).get("child_name", "").strip():
        clean.append("name"); cost += NAME_PRICE
    return clean, round(cost, 2)


# ------------------------------------------------------------- create

class ShopItemIn(BaseModel):
    product_id: str
    colour: str
    names: bool = False
    label: str = ""
    max_each: int = 0         # staff links: most of this item one person can choose (0 = no limit)


class ShopIn(BaseModel):
    name: str
    organiser: str = ""
    email: str
    phone: str = ""
    logo: str                 # /api/uploads/artwork/... from uploadOrderArtwork
    closes_on: str = ""       # YYYY-MM-DD
    message: str = ""
    items: List[ShopItemIn]
    mode: str = "pay_each"    # "pay_each" (club shop) | "company" (staff order link)


@api_router.post("/club-shops")
async def create_club_shop(payload: ShopIn):
    from server import PRODUCTS, is_live, _backend_public_url
    from services.email import send_email, email_wrap, shop_notification_recipient
    name = payload.name.strip()[:80]
    email = payload.email.strip().lower()
    if not name or not re.match(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$", email):
        raise HTTPException(400, "Add your club / school name and a valid email")
    if not payload.logo:
        raise HTTPException(400, "Upload your logo")
    if payload.closes_on and not re.match(r"^\d{4}-\d{2}-\d{2}$", payload.closes_on):
        raise HTTPException(400, "Closing date should be a date")
    items = []
    for it in payload.items[:MAX_ITEMS]:
        p = PRODUCTS.get(it.product_id)
        if not p or not is_live(p) or p.get("design_shop") or p.get("bundle_items") or p.get("category") in ("leavers", "team-kits"):
            continue
        cols = [c.get("name") for c in (p.get("colors") or []) if isinstance(c, dict)]
        if cols and it.colour not in cols:
            continue
        items.append({"product_id": p["id"], "colour": it.colour, "names": bool(it.names), "label": it.label.strip()[:60],
                      "max_each": max(0, min(int(it.max_each or 0), 50))})
    if not items:
        raise HTTPException(400, "Pick at least one item for your shop")
    mode = "company" if payload.mode == "company" else "pay_each"
    code = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:24] + "-" + secrets.token_hex(2)
    manage = secrets.token_urlsafe(16)
    await db.club_shops.insert_one({
        "code": code, "manage_token": manage, "name": name, "organiser": payload.organiser.strip()[:80],
        "email": email, "phone": payload.phone.strip()[:30], "logo": payload.logo, "closes_on": payload.closes_on,
        "message": payload.message.strip()[:600], "items": items, "status": "open", "created_at": _now(), "mode": mode,
    })
    shop_url, manage_url = f"{_site()}/club/{code}", f"{_site()}/club/{code}/manage/{manage}"
    who = "staff - each person picks their garments and sizes (no payment)" if mode == "company" else "parents / members - each person picks their sizes and pays for their own"
    await send_email(to=[email], subject=f"Your {name} {'staff order link' if mode == 'company' else 'shop'} is ready", html=email_wrap(
        "Your staff order link is ready" if mode == "company" else "Your club shop is ready",
        f"<p>Share this link with your {who}:</p>"
        f"<p style='font-size:16px;font-weight:800'><a href='{shop_url}'>{shop_url}</a></p>"
        f"<p>Your private organiser page ({'everyone' + chr(39) + 's choices, download the list, send the order' if mode == 'company' else 'see every order, download the list, close the shop'}):<br><a href='{manage_url}'>{manage_url}</a></p>"
        + (f"<p style='color:#4b5563'>When everyone's chosen, send the order from your organiser page - pay by card, or ask us for an invoice. We send a proof before printing.</p>" if mode == "company" else
           f"<p style='color:#4b5563'>We'll print everything together once the shop closes{(' on ' + payload.closes_on) if payload.closes_on else ''} and send you a proof first.</p>")))
    shop_to = await shop_notification_recipient()
    if shop_to:
        await send_email(to=[shop_to], subject=f"[{'Staff order link' if mode == 'company' else 'Club shop'}] {name} set up", html=email_wrap(
            "New staff order link" if mode == "company" else "New club shop", f"<p><strong>{name}</strong> ({email}) set up a {'staff order link' if mode == 'company' else 'club shop'} with {len(items)} item(s), closing {payload.closes_on or 'no date'}.</p>"
                             f"<p><a href='{shop_url}'>{shop_url}</a> - logo: <a href='{_backend_public_url()}{payload.logo}'>file</a></p>"))
    return {"code": code, "shop_url": shop_url, "manage_url": manage_url}


# ------------------------------------------------------------- public

@api_router.get("/club-shops/{code}")
async def get_club_shop(code: str):
    shop = await db.club_shops.find_one({"code": code})
    if not shop:
        raise HTTPException(404, "Shop not found")
    return {"code": code, "name": shop["name"], "logo": shop.get("logo"), "closes_on": shop.get("closes_on"),
            "message": shop.get("message"), "open": _open(shop), "mode": shop.get("mode") or "pay_each",
            "items": [v for v in (_item_view(i) for i in shop.get("items") or []) if v],
            "prices": {"logo": LOGO_PRICE, "name": NAME_PRICE}}


async def _shop_orders(code: str) -> List[Dict]:
    rows = []
    q = {"payment_status": "paid", "items.design_meta.club_code": code}
    async for doc in db.payment_transactions.find(q).sort("created_at", 1):
        who = (doc.get("delivery") or {}).get("name") or doc.get("paid_email") or ""
        for it in doc.get("items") or []:
            dm = it.get("design_meta") or {}
            if dm.get("club_code") != code:
                continue
            for size, qty in (it.get("size_qtys") or {}).items():
                rows.append({"date": (doc.get("paid_at") or doc.get("created_at") or "")[:10], "parent": who,
                             "email": doc.get("paid_email") or "", "item": it.get("product_name"), "colour": it.get("color"),
                             "size": size, "qty": qty, "name_on_back": dm.get("child_name") or "",
                             "paid": it.get("line_total")})
    return rows


def _csv(rows: List[Dict]) -> Response:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["date", "parent", "email", "item", "colour", "size", "qty", "name_on_back", "paid"])
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=club-shop-orders.csv"})


@api_router.get("/club-shops/{code}/manage/{token}")
async def manage_club_shop(code: str, token: str, format: str = "json"):
    shop = await db.club_shops.find_one({"code": code, "manage_token": token})
    if not shop:
        raise HTTPException(404, "Not found")
    if shop.get("mode") == "company":
        staff = await _staff(code)
        if format == "csv":
            return _staff_csv(staff)
        return {"name": shop["name"], "mode": "company", "status": shop.get("status"), "open": _open(shop), "closes_on": shop.get("closes_on"),
                "shop_url": f"{_site()}/club/{code}", "staff": staff, "items": [v for v in (_item_view(i) for i in shop.get("items") or []) if v],
                "sent": shop.get("sent"), "prices": {"logo": LOGO_PRICE, "name": NAME_PRICE}}
    rows = await _shop_orders(code)
    if format == "csv":
        return _csv(rows)
    return {"name": shop["name"], "status": shop.get("status"), "open": _open(shop), "closes_on": shop.get("closes_on"),
            "shop_url": f"{_site()}/club/{code}", "orders": rows}


@api_router.post("/club-shops/{code}/manage/{token}/close")
async def close_club_shop(code: str, token: str):
    res = await db.club_shops.update_one({"code": code, "manage_token": token}, {"$set": {"status": "closed", "closed_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ------------------------------------------------------------- staff order links (company pays)

class StaffPick(BaseModel):
    product_id: str
    colour: str
    size: str
    qty: int = 1
    name_on_back: str = ""


class StaffIn(BaseModel):
    name: str
    email: str = ""
    picks: List[StaffPick]


async def _staff(code: str) -> List[Dict]:
    return [d async for d in db.club_shop_staff.find({"code": code}, {"_id": 0}).sort("created_at", 1)]


def _staff_csv(staff: List[Dict]) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["staff member", "email", "item", "colour", "size", "qty", "name_on_back"])
    for p in staff:
        for k in p.get("picks") or []:
            w.writerow([p.get("name"), p.get("email"), k.get("item"), k.get("colour"), k.get("size"), k.get("qty"), k.get("name_on_back")])
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=staff-choices.csv"})


@api_router.post("/club-shops/{code}/staff")
async def staff_choose(code: str, payload: StaffIn):
    """A staff member saves their garments + sizes on a company-pays link. Saving again
    under the same name replaces their earlier choices."""
    shop = await db.club_shops.find_one({"code": code})
    if not shop or shop.get("mode") != "company":
        raise HTTPException(404, "Link not found")
    if not _open(shop) or shop.get("sent"):
        raise HTTPException(400, "Sorry - this order has closed. Please speak to whoever sent you the link.")
    name = payload.name.strip()[:60]
    if not name:
        raise HTTPException(400, "Add your name")
    views = {(v["product_id"], v["colour"]): v for v in (_item_view(i) for i in shop.get("items") or []) if v}
    picks, per_item = [], {}
    for k in payload.picks[:40]:
        v = views.get((k.product_id, k.colour))
        if not v:
            raise HTTPException(400, "That item isn't on this list")
        if k.size not in [s["size"] for s in v["sizes"]]:
            raise HTTPException(400, f"Pick a size for {v['name']}")
        q = max(1, min(int(k.qty or 1), 50))
        per_item[k.product_id] = per_item.get(k.product_id, 0) + q
        if v["max_each"] and per_item[k.product_id] > v["max_each"]:
            raise HTTPException(400, f"You can choose up to {v['max_each']} × {v['name']}")
        picks.append({"product_id": k.product_id, "item": v["name"], "colour": k.colour, "size": k.size, "qty": q,
                      "name_on_back": k.name_on_back.strip()[:20] if v["names"] else ""})
    if not picks:
        raise HTTPException(400, "Choose at least one item")
    doc = {"code": code, "name": name, "email": payload.email.strip().lower()[:120], "picks": picks, "updated_at": _now()}
    existing = await db.club_shop_staff.find_one({"code": code, "name_key": name.lower()})
    if existing:
        await db.club_shop_staff.update_one({"_id": existing["_id"]}, {"$set": doc})
    else:
        await db.club_shop_staff.insert_one({**doc, "name_key": name.lower(), "id": secrets.token_hex(6), "created_at": _now()})
    return {"ok": True, "replaced": bool(existing)}


@api_router.delete("/club-shops/{code}/manage/{token}/staff/{sid}")
async def staff_remove(code: str, token: str, sid: str):
    if not await db.club_shops.find_one({"code": code, "manage_token": token}):
        raise HTTPException(404, "Not found")
    await db.club_shop_staff.delete_one({"code": code, "id": sid})
    return {"ok": True}


class SendIn(BaseModel):
    method: str               # "invoice" (card payments go through the normal basket checkout from the page)
    po_number: str = ""
    company: str = ""
    address: str = ""
    notes: str = ""


@api_router.post("/club-shops/{code}/manage/{token}/send")
async def staff_send(code: str, token: str, payload: SendIn):
    """Organiser sends the whole staff order for an invoice (BACS once the proof is approved)."""
    from server import _backend_public_url
    from services.email import send_email, email_wrap, shop_notification_recipient
    import html as _h
    shop = await db.club_shops.find_one({"code": code, "manage_token": token})
    if not shop or shop.get("mode") != "company":
        raise HTTPException(404, "Not found")
    staff = await _staff(code)
    if not staff:
        raise HTTPException(400, "Nobody has chosen anything yet")
    views = {(v["product_id"], v["colour"]): v for v in (_item_view(i) for i in shop.get("items") or []) if v}
    total, roster, qty = 0.0, [], 0
    for p in staff:
        for k in p["picks"]:
            v = views.get((k["product_id"], k["colour"]))
            unit = next((s["price"] for s in (v or {}).get("sizes", []) if s["size"] == k["size"]), 0) + (NAME_PRICE if k.get("name_on_back") else 0)
            total += unit * k["qty"]; qty += k["qty"]
            roster.append({"name": p["name"], "number": f"{k['item']} ({k['colour']})", "size": k["size"], "tracksuit": f"x{k['qty']}" + (f" · back: {k['name_on_back']}" if k.get("name_on_back") else "")})
    msg = (f"Staff order link: {shop['name']} - {len(staff)} people, {qty} garments, about £{total:.2f} at website prices (inc VAT).\n"
           f"Invoice requested (BACS once the proof is approved). PO: {payload.po_number or '-'}\n"
           f"Company: {payload.company or shop['name']}\nDelivery address(es): {payload.address or '-'}\nNotes: {payload.notes or '-'}\n"
           f"Organiser page: {_site()}/club/{code}/manage/{token}")
    await db.quote_requests.insert_one({"id": secrets.token_hex(8), "kind": "staff_order", "name": shop.get("organiser") or shop["name"],
                                        "email": shop["email"], "phone": shop.get("phone") or "", "company": payload.company or shop["name"],
                                        "quantity": qty, "message": msg, "artwork": [shop.get("logo")] if shop.get("logo") else [],
                                        "attachments": [], "roster": roster[:300], "status": "new", "created_at": _now()})
    await db.club_shops.update_one({"_id": shop["_id"]}, {"$set": {"sent": {"method": "invoice", "at": _now(), "total": round(total, 2), "garments": qty,
                                                                            "po_number": payload.po_number[:60]}, "status": "closed"}})
    esc = lambda v: _h.escape(str(v or ""))  # noqa: E731
    table = "".join(f"<tr><td>{esc(r['name'])}</td><td>{esc(r['number'])}</td><td>{esc(r['size'])}</td><td>{esc(r['tracksuit'])}</td></tr>" for r in roster)
    shop_to = await shop_notification_recipient()
    if shop_to:
        await send_email(to=[shop_to], subject=f"[Staff order - invoice] {shop['name']} - {qty} garments", reply_to=shop["email"], html=email_wrap(
            f"Staff order: {shop['name']}", f"<p style='white-space:pre-wrap'>{esc(msg)}</p>"
            f"<p>Logo: <a href='{_backend_public_url()}{shop.get('logo')}'>file</a></p>"
            f"<table cellpadding='4' style='border-collapse:collapse;font-size:13px'><tr><th align='left'>Staff</th><th align='left'>Item</th><th align='left'>Size</th><th align='left'>Qty / name</th></tr>{table}</table>"))
    await send_email(to=[shop["email"]], subject=f"We've got your {shop['name']} staff order", html=email_wrap(
        "Thanks - we've got your staff order",
        f"<p>{len(staff)} people, {qty} garments. We'll send you a proof and an invoice - pay by BACS once you've approved the proof, and we'll print.</p>"))
    return {"ok": True, "total": round(total, 2), "garments": qty}


@api_router.post("/club-shops/{code}/manage/{token}/paid-by-card")
async def staff_mark_card(code: str, token: str):
    """Called by the organiser page just before redirecting to card checkout."""
    await db.club_shops.update_one({"code": code, "manage_token": token, "mode": "company"},
                                   {"$set": {"sent": {"method": "card", "at": _now()}}})
    return {"ok": True}


# ------------------------------------------------------------- admin

@api_router.get("/admin/club-shops", dependencies=[Depends(require_admin)])
async def admin_club_shops():
    out = []
    async for s in db.club_shops.find({}, {"_id": 0}).sort("created_at", -1):
        rows = await _shop_orders(s["code"])
        out.append({**{k: s.get(k) for k in ("code", "name", "organiser", "email", "phone", "closes_on", "status", "created_at", "logo")},
                    "open": _open(s), "items": len(s.get("items") or []), "orders": len({r["email"] + r["date"] for r in rows}),
                    "garments": sum(int(r["qty"]) for r in rows), "manage_token": s.get("manage_token"),
                    "mode": s.get("mode") or "pay_each", "staff": await db.club_shop_staff.count_documents({"code": s["code"]}),
                    "sent": s.get("sent")})
    return {"shops": out}


@api_router.get("/admin/club-shops/{code}/orders", dependencies=[Depends(require_admin)])
async def admin_club_shop_orders(code: str, format: str = "json"):
    rows = await _shop_orders(code)
    return _csv(rows) if format == "csv" else {"orders": rows}


@api_router.post("/admin/club-shops/{code}/status", dependencies=[Depends(require_admin)])
async def admin_club_shop_status(code: str, payload: Dict):
    status = "open" if payload.get("status") == "open" else "closed"
    await db.club_shops.update_one({"code": code}, {"$set": {"status": status}})
    return {"ok": True}
