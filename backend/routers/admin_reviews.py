"""Reviews management for the admin — list, edit, delete.

Reviews arrive from three places: the native review form on a product page, a
one-off Judge.me migration, and anything typed in by hand here. Once they were
in the database there was no way to correct a typo or remove a bad import, so
this router adds that.

Self-contained (only needs db + auth), so it lives in a router of its own —
same pattern as cms_page_copy.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field

from deps import api_router, db, require_admin


# Fields the admin is allowed to change. Deliberately excludes `source` and
# `judgeme_id` — those record where a review came from, and rewriting them
# would make an import impossible to audit or undo later.
class ReviewPatch(BaseModel):
    reviewer_name: Optional[str] = Field(default=None, max_length=80)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    title: Optional[str] = Field(default=None, max_length=120)
    body: Optional[str] = Field(default=None, max_length=2000)
    photos: Optional[List[str]] = None
    verified: Optional[bool] = None
    approved: Optional[bool] = None
    product_id: Optional[str] = Field(default=None, max_length=120)
    created_at: Optional[str] = Field(default=None, max_length=40)


class BulkDeleteRequest(BaseModel):
    ids: List[str] = Field(default_factory=list)


class BulkApproveRequest(BaseModel):
    ids: List[str] = Field(default_factory=list)
    approved: bool = True


def _clean(doc: Dict) -> Dict:
    """Mongo's _id is an ObjectId and won't serialise to JSON."""
    doc.pop("_id", None)
    return doc


@api_router.get("/admin/reviews", dependencies=[Depends(require_admin)])
async def admin_list_reviews(
    product_id: Optional[str] = None,
    source: Optional[str] = None,
    rating: Optional[int] = Query(default=None, ge=1, le=5),
    search: Optional[str] = None,
    has_photos: Optional[bool] = None,
    approved: Optional[bool] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Paginated review list with filters. `total` is the count matching the
    filters, so the UI can page without guessing."""
    q: Dict = {}
    if product_id:
        q["product_id"] = product_id
    if source:
        q["source"] = source
    if rating:
        q["rating"] = int(rating)
    if approved is True:
        # Pre-moderation records have no `approved` field; treat them as live.
        q["approved"] = {"$ne": False}
    elif approved is False:
        q["approved"] = False
    if has_photos is True:
        q["photos"] = {"$exists": True, "$ne": []}
    elif has_photos is False:
        q["$or"] = [{"photos": {"$exists": False}}, {"photos": []}]
    if search and search.strip():
        # Escaped so a stray "(" in the search box can't throw a regex error.
        import re as _re
        rx = {"$regex": _re.escape(search.strip()), "$options": "i"}
        clauses = [{"reviewer_name": rx}, {"title": rx}, {"body": rx}]
        if "$or" in q:
            q = {"$and": [{"$or": q.pop("$or")}, {"$or": clauses}], **q}
        else:
            q["$or"] = clauses

    total = await db.reviews.count_documents(q)
    cursor = db.reviews.find(q).sort("created_at", -1).skip(offset).limit(limit)
    items = [_clean(r) async for r in cursor]
    return {"items": items, "total": total, "offset": offset, "returned": len(items)}


@api_router.get("/admin/reviews/stats", dependencies=[Depends(require_admin)])
async def admin_review_stats():
    """Totals for the filter chips — how many reviews, and where they came from."""
    total = await db.reviews.count_documents({})
    by_source: Dict[str, int] = {}
    async for doc in db.reviews.aggregate([{"$group": {"_id": "$source", "n": {"$sum": 1}}}]):
        by_source[doc["_id"] or "native"] = doc["n"]
    by_rating: Dict[str, int] = {}
    async for doc in db.reviews.aggregate([{"$group": {"_id": "$rating", "n": {"$sum": 1}}}]):
        by_rating[str(doc["_id"])] = doc["n"]
    with_photos = await db.reviews.count_documents({"photos": {"$exists": True, "$ne": []}})
    pending = await db.reviews.count_documents({"approved": False})
    return {
        "total": total, "by_source": by_source, "by_rating": by_rating,
        "with_photos": with_photos, "pending": pending,
    }


@api_router.patch("/admin/reviews/{review_id}", dependencies=[Depends(require_admin)])
async def admin_update_review(review_id: str, payload: ReviewPatch):
    existing = await db.reviews.find_one({"id": review_id})
    if not existing:
        raise HTTPException(404, "Review not found")

    # exclude_unset keeps fields the caller didn't send out of the update, and the
    # None check drops explicit nulls. False is preserved — un-approving a review
    # must actually write False rather than be treated as "no change".
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")

    if "photos" in updates:
        # Only real URLs — a blank row left in the editor shouldn't become a broken image.
        updates["photos"] = [p.strip() for p in updates["photos"] if isinstance(p, str) and p.strip()][:8]
    if "reviewer_name" in updates:
        updates["reviewer_name"] = updates["reviewer_name"].strip() or "Anonymous"

    # Moving a review to another product silently drops it out of both products'
    # averages if the target doesn't exist, so check before allowing it.
    if "product_id" in updates:
        try:
            # Imported here, not at module scope: server.py imports this router,
            # so a top-level import would be circular. By request time server is
            # fully loaded and PRODUCTS is the same dict object it seeds at startup.
            from server import PRODUCTS
        except ImportError:
            PRODUCTS = None
        if PRODUCTS is not None and updates["product_id"] not in PRODUCTS:
            raise HTTPException(400, f"Unknown product_id: {updates['product_id']}")

    updates["edited_at"] = datetime.now(timezone.utc).isoformat()
    await db.reviews.update_one({"id": review_id}, {"$set": updates})
    return _clean(await db.reviews.find_one({"id": review_id}))


@api_router.delete("/admin/reviews/{review_id}", dependencies=[Depends(require_admin)])
async def admin_delete_review(review_id: str):
    res = await db.reviews.delete_one({"id": review_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Review not found")
    return {"deleted": 1, "id": review_id}


@api_router.post("/admin/reviews/bulk-delete", dependencies=[Depends(require_admin)])
async def admin_bulk_delete_reviews(payload: BulkDeleteRequest):
    ids = [i for i in (payload.ids or []) if isinstance(i, str) and i.strip()]
    if not ids:
        raise HTTPException(400, "No review ids supplied")
    if len(ids) > 500:
        raise HTTPException(400, "Too many at once — 500 max per request")
    res = await db.reviews.delete_many({"id": {"$in": ids}})
    return {"deleted": res.deleted_count, "requested": len(ids)}


@api_router.post("/admin/reviews/bulk-approve", dependencies=[Depends(require_admin)])
async def admin_bulk_approve_reviews(payload: BulkApproveRequest):
    """Approve or hide several reviews at once. Approving is the common case —
    a batch of genuine reviews shouldn't need one click each."""
    ids = [i for i in (payload.ids or []) if isinstance(i, str) and i.strip()]
    if not ids:
        raise HTTPException(400, "No review ids supplied")
    if len(ids) > 500:
        raise HTTPException(400, "Too many at once — 500 max per request")
    res = await db.reviews.update_many(
        {"id": {"$in": ids}},
        {"$set": {"approved": bool(payload.approved), "edited_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"updated": res.modified_count, "requested": len(ids), "approved": bool(payload.approved)}


@api_router.post("/admin/reviews/delete-import", dependencies=[Depends(require_admin)])
async def admin_delete_import(source: str = Query(..., max_length=40)):
    """Undo a whole import in one go. A Judge.me import that mapped everything to
    the wrong product would otherwise have to be unpicked row by row."""
    if source not in ("judgeme", "native"):
        raise HTTPException(400, "source must be 'judgeme' or 'native'")
    res = await db.reviews.delete_many({"source": source})
    return {"deleted": res.deleted_count, "source": source}
