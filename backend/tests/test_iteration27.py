"""Iteration 27 — Bulk product import API tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for backend tests when frontend env var not set — read from frontend/.env
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"

TEST_PREFIX = "TEST_iter27"

CREATED_IDS: list = []


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_token):
    yield
    # Delete every product we created
    hdr = {"Authorization": f"Bearer {admin_token}"}
    for pid in CREATED_IDS:
        try:
            requests.delete(f"{BASE_URL}/api/admin/products/imported/{pid}", headers=hdr, timeout=10)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# AUTH GATING
# ---------------------------------------------------------------------------
def test_bulk_import_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/products/bulk-import", json={"items": []}, timeout=10)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


def test_list_imported_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/products/imported", timeout=10)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


# ---------------------------------------------------------------------------
# AUTO-CATEGORISATION + MARKUP
# ---------------------------------------------------------------------------
def test_bulk_import_auto_category_and_markup(admin_headers):
    payload = {
        "default_source": "TEST_iter27",
        "default_brand": "TEST_iter27_Brand",
        "default_markup_pct": 40,
        "items": [
            {"name": f"{TEST_PREFIX} AWDis College Hoodie", "source_sku": f"{TEST_PREFIX}-HDA",
             "source_price": 8.99, "image": "https://images.pexels.com/photos/8532614/pexels-photo-8532614.jpeg",
             "colors": [{"name": "Coral", "hex": "#ff7f50"}], "sizes": ["S", "M", "L"]},
            {"name": f"{TEST_PREFIX} AWDis Polo Shirt", "source_sku": f"{TEST_PREFIX}-POL",
             "source_price": 6.50, "image": "https://images.pexels.com/photos/8532614/pexels-photo-8532614.jpeg",
             "colors": ["White", "Navy"], "sizes": ["S", "M", "L"]},
            {"name": f"{TEST_PREFIX} Running Vest", "source_sku": f"{TEST_PREFIX}-VST",
             "source_price": 4.00, "image": "https://images.pexels.com/photos/8532614/pexels-photo-8532614.jpeg",
             "colors": ["Black"], "sizes": ["S", "M"]},
            {"source_sku": f"{TEST_PREFIX}-NONAME", "source_price": 5.0},  # missing name
        ],
    }
    r = requests.post(f"{BASE_URL}/api/admin/products/bulk-import",
                      json=payload, headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    assert data["ok"] is True
    created = {c["name"]: c for c in data["created"]}
    assert len(created) == 3
    # Skipped nameless row
    assert len(data["skipped"]) == 1
    assert "missing name" in data["skipped"][0]["reason"].lower()

    # Auto-category
    assert created[f"{TEST_PREFIX} AWDis College Hoodie"]["category"] == "hoodies"
    assert created[f"{TEST_PREFIX} AWDis Polo Shirt"]["category"] == "polos"
    # 'Running Vest' has no match → falls back to t-shirts
    assert created[f"{TEST_PREFIX} Running Vest"]["category"] == "t-shirts"

    # Markup: 8.99 * 1.40 = 12.586 → 12.59
    assert created[f"{TEST_PREFIX} AWDis College Hoodie"]["price"] == pytest.approx(12.59, abs=0.01)
    # 6.50 * 1.40 = 9.10
    assert created[f"{TEST_PREFIX} AWDis Polo Shirt"]["price"] == pytest.approx(9.10, abs=0.01)

    for c in data["created"]:
        CREATED_IDS.append(c["id"])


# ---------------------------------------------------------------------------
# IN-MEMORY MERGE — imported product shows on /api/shop/type/{slug}
# ---------------------------------------------------------------------------
def test_imported_product_visible_in_shop_hoodies():
    r = requests.get(f"{BASE_URL}/api/shop/type/hoodies", timeout=15)
    assert r.status_code == 200
    names = [p.get("name") for p in r.json().get("products", [])]
    assert f"{TEST_PREFIX} AWDis College Hoodie" in names, f"not in hoodies: {names[:6]}"


def test_imported_product_visible_in_shop_polos():
    r = requests.get(f"{BASE_URL}/api/shop/type/polos", timeout=15)
    assert r.status_code == 200
    names = [p.get("name") for p in r.json().get("products", [])]
    assert f"{TEST_PREFIX} AWDis Polo Shirt" in names


def test_imported_product_fallback_in_tshirts():
    """Review spec requires 'Running Vest' fallback to t-shirts. Actual behaviour:
    _garment_type_of reclassifies by name → 'vest' → 'hi-vis' (BUG). Documented here so
    the failure surfaces clearly in the report."""
    r = requests.get(f"{BASE_URL}/api/shop/type/t-shirts", timeout=15)
    assert r.status_code == 200
    names = [p.get("name") for p in r.json().get("products", [])]
    assert f"{TEST_PREFIX} Running Vest" in names, (
        "BUG: imported product stored with category='t-shirts' does not appear "
        "under /api/shop/type/t-shirts because _garment_type_of ignores the stored "
        "category and matches 'vest' → hi-vis first."
    )


def test_imported_running_vest_shows_up_somewhere():
    """Confirms the product IS visible somewhere (hi-vis, per current _garment_type_of)."""
    r = requests.get(f"{BASE_URL}/api/shop/type/hi-vis", timeout=15)
    assert r.status_code == 200
    names = [p.get("name") for p in r.json().get("products", [])]
    assert f"{TEST_PREFIX} Running Vest" in names


def test_facet_colour_coral_present_after_import():
    """Coral colour should appear in facets for hoodies now that the imported hoodie has it."""
    r = requests.get(f"{BASE_URL}/api/shop/type/hoodies", timeout=15)
    assert r.status_code == 200
    facets = r.json().get("facets") or r.json().get("filters") or {}
    # Facets shape: try both dict-of-lists and list of {key, values}
    colours = []
    if isinstance(facets, dict):
        raw = facets.get("colours") or facets.get("colour") or facets.get("colors") or []
        if isinstance(raw, list):
            for c in raw:
                if isinstance(c, dict):
                    colours.append((c.get("name") or c.get("value") or "").lower())
                else:
                    colours.append(str(c).lower())
    assert any("coral" in c for c in colours), f"coral not in facets: {colours[:12]}"


def test_get_product_detail_by_slug():
    """GET /api/products/{id} (plural) — route in server.py at /products/{product_id}."""
    assert CREATED_IDS, "no product ids captured"
    pid = CREATED_IDS[0]
    r = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=10)
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    assert body["id"] == pid
    assert body["name"].startswith(TEST_PREFIX)


# ---------------------------------------------------------------------------
# LIST + PATCH (active toggle) + DELETE
# ---------------------------------------------------------------------------
def test_list_imported_returns_created(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/products/imported", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    items = r.json()["items"]
    ids = {i["id"] for i in items}
    for cid in CREATED_IDS:
        assert cid in ids, f"{cid} missing from admin list"


def test_patch_active_false_removes_from_shop(admin_headers):
    # Toggle the hoodie off
    hoodie_id = next((cid for cid in CREATED_IDS if "hoodie" in cid.lower() or "hda" in cid.lower()), None)
    # Fall back to iterating names via list
    if not hoodie_id:
        r = requests.get(f"{BASE_URL}/api/admin/products/imported", headers=admin_headers, timeout=10)
        for i in r.json()["items"]:
            if "hoodie" in i["name"].lower() and TEST_PREFIX in i["name"]:
                hoodie_id = i["id"]
                break
    assert hoodie_id, "no hoodie id found"
    p = requests.patch(f"{BASE_URL}/api/admin/products/imported/{hoodie_id}",
                       json={"active": False}, headers=admin_headers, timeout=10)
    assert p.status_code == 200, p.text[:200]

    # Should be gone from /shop/type/hoodies
    r = requests.get(f"{BASE_URL}/api/shop/type/hoodies", timeout=15)
    ids = [pr.get("id") for pr in r.json().get("products", [])]
    assert hoodie_id not in ids

    # But still in admin listing
    r2 = requests.get(f"{BASE_URL}/api/admin/products/imported", headers=admin_headers, timeout=10)
    admin_ids = [i["id"] for i in r2.json()["items"]]
    assert hoodie_id in admin_ids

    # Re-activate for the delete test
    requests.patch(f"{BASE_URL}/api/admin/products/imported/{hoodie_id}",
                   json={"active": True}, headers=admin_headers, timeout=10)


def test_delete_removes_from_both(admin_headers):
    # Pick one to delete now (the polo) and remove it entirely
    polo_id = None
    r = requests.get(f"{BASE_URL}/api/admin/products/imported", headers=admin_headers, timeout=10)
    for i in r.json()["items"]:
        if "polo" in i["name"].lower() and TEST_PREFIX in i["name"]:
            polo_id = i["id"]
            break
    assert polo_id, "no polo id found"

    d = requests.delete(f"{BASE_URL}/api/admin/products/imported/{polo_id}",
                        headers=admin_headers, timeout=10)
    assert d.status_code == 200
    assert d.json().get("deleted", 0) >= 1

    # Not in admin list
    r2 = requests.get(f"{BASE_URL}/api/admin/products/imported", headers=admin_headers, timeout=10)
    assert polo_id not in [i["id"] for i in r2.json()["items"]]

    # Not in shop
    r3 = requests.get(f"{BASE_URL}/api/shop/type/polos", timeout=15)
    assert polo_id not in [p.get("id") for p in r3.json().get("products", [])]

    # Not fetchable directly
    r4 = requests.get(f"{BASE_URL}/api/products/{polo_id}", timeout=10)
    assert r4.status_code == 404

    # Remove from cleanup list since already gone
    if polo_id in CREATED_IDS:
        CREATED_IDS.remove(polo_id)


# ---------------------------------------------------------------------------
# REGRESSION
# ---------------------------------------------------------------------------
def test_regression_shop_hoodies_still_works():
    r = requests.get(f"{BASE_URL}/api/shop/type/hoodies", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "products" in body
    assert isinstance(body["products"], list)
