"""
Iteration 20 backend tests:
- /api/leavers/config
- /api/leavers/products (allows_full_front)
- /api/leavers/checkout (position, upcharge, varsity restriction, design validation, names mode)
- Portfolio create/list for fight-night-action + new leavers categories
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"
TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

# frontend env for backend url
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                API = f"{BASE_URL}/api"
except Exception:
    pass

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
try:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("MONGO_URL="):
                MONGO_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("DB_NAME="):
                DB_NAME = line.split("=", 1)[1].strip().strip('"').strip("'")
except Exception:
    pass

mongo = MongoClient(MONGO_URL) if MONGO_URL else None
db = mongo[DB_NAME] if mongo and DB_NAME else None


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Leavers config ----------
def test_leavers_config():
    r = requests.get(f"{API}/leavers/config", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["full_front_upcharge"] == 2.5
    assert "bag_price" in d
    assert set(d["no_full_front_product_ids"]) == {"leavers-varsity", "varsity-jacket"}
    libs = d["design_libraries"]
    assert libs["front_breast"] == "leavers-front-designs"
    assert libs["back"] == "leavers-back-designs"
    assert libs["full_front"] == "leavers-full-front-designs"
    assert "proof_days" in d
    assert "names_deadline_days" in d


# ---------- Leavers products with allows_full_front ----------
def test_leavers_products_allows_full_front():
    r = requests.get(f"{API}/leavers/products", timeout=10)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0
    by_id = {p["id"]: p for p in items}
    assert "allows_full_front" in items[0]
    assert by_id["varsity-jacket"]["allows_full_front"] is False
    assert by_id["leavers-pullover-hoodie"]["allows_full_front"] is True


# ---------- Leavers checkout: breast, we-will-contact ----------
def _base_payload(**over):
    p = {
        "product_id": "leavers-pullover-hoodie",
        "print_position": "breast",
        "school": "Test School",
        "year_group": "Y11",
        "contact_name": "Test",
        "contact_email": "test@example.com",
        "sizes": [{"size": "M", "qty": 20}],
        "template_id": "year-nicknames",
        "names_collection_mode": "we-will-contact",
        "origin_url": "https://example.com",
    }
    p.update(over)
    return p


def test_leavers_checkout_breast_success():
    r = requests.post(f"{API}/leavers/checkout", json=_base_payload(), timeout=25)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "url" in d and d["url"].startswith("http")
    assert "session_id" in d
    if db is not None:
        row = db.payment_transactions.find_one({"session_id": d["session_id"]})
        assert row is not None
        assert row["print_position"] == "breast"
        assert row["names_collection_mode"] == "we-will-contact"
        assert row["full_front_upcharge"] == 0.0


def test_leavers_checkout_full_front_upcharge():
    payload = _base_payload(print_position="full_front")
    r = requests.post(f"{API}/leavers/checkout", json=payload, timeout=25)
    assert r.status_code == 200, r.text
    d = r.json()
    if db is not None:
        row = db.payment_transactions.find_one({"session_id": d["session_id"]})
        assert row["print_position"] == "full_front"
        assert row["full_front_upcharge"] == 2.5
        # verify unit_price is 2.50 higher than breast baseline
        breast_row = db.payment_transactions.find_one(
            {"product_id": "leavers-pullover-hoodie", "print_position": "breast", "total_quantity": 20},
            sort=[("created_at", -1)],
        )
        if breast_row:
            assert round(row["unit_price"] - breast_row["unit_price"], 2) == 2.5


def test_leavers_checkout_full_front_varsity_rejected():
    payload = _base_payload(product_id="varsity-jacket", print_position="full_front")
    r = requests.post(f"{API}/leavers/checkout", json=payload, timeout=15)
    assert r.status_code == 400
    assert "does not support a full-front print" in r.text


def test_leavers_checkout_invalid_position():
    payload = _base_payload(print_position="invalid")
    r = requests.post(f"{API}/leavers/checkout", json=payload, timeout=15)
    assert r.status_code == 400
    assert "must be 'breast' or 'full_front'" in r.text or "must be breast or full_front" in r.text


def test_leavers_checkout_invalid_names_mode():
    payload = _base_payload(names_collection_mode="invalid")
    r = requests.post(f"{API}/leavers/checkout", json=payload, timeout=15)
    assert r.status_code == 400


def test_leavers_checkout_no_design_fails():
    payload = _base_payload()
    payload.pop("template_id")
    r = requests.post(f"{API}/leavers/checkout", json=payload, timeout=15)
    assert r.status_code == 400
    assert "Pick a design" in r.text


def test_leavers_checkout_back_only_design_ok():
    payload = _base_payload(back_design_id="some-back-id")
    payload.pop("template_id")
    r = requests.post(f"{API}/leavers/checkout", json=payload, timeout=25)
    assert r.status_code == 200, r.text


def test_leavers_checkout_names_file_persisted():
    payload = _base_payload(
        names_collection_mode="upload",
        names_file_data_url=TINY_PNG,
    )
    r = requests.post(f"{API}/leavers/checkout", json=payload, timeout=25)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    if db is not None:
        art = db.leavers_artwork.find_one({"session_id": sid})
        assert art is not None
        assert art.get("names_file") == TINY_PNG


# ---------- Portfolio regression ----------
def test_portfolio_categories_include_new_ones():
    r = requests.get(f"{API}/portfolio/categories", timeout=10)
    assert r.status_code == 200
    cats = r.json()
    slugs = [c["slug"] if isinstance(c, dict) else c for c in cats]
    for needed in ("fight-night-action", "leavers-front-designs", "leavers-back-designs", "leavers-full-front-designs"):
        assert needed in slugs, f"Missing category {needed}. Got {slugs}"


def test_portfolio_admin_create_and_list_fight_night(admin_headers):
    payload = {
        "title": "TEST_fight_night_action",
        "category": "fight-night-action",
        "image_data_url": TINY_PNG,
        "featured": False,
    }
    r = requests.post(f"{API}/admin/portfolio", json=payload, headers=admin_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    item = r.json()
    item_id = item.get("id")
    assert item_id
    try:
        # verify visible in public listing
        r2 = requests.get(f"{API}/portfolio", params={"category": "fight-night-action"}, timeout=10)
        assert r2.status_code == 200
        data = r2.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        assert any(x.get("id") == item_id for x in items)
    finally:
        # soft-delete cleanup
        requests.delete(f"{API}/admin/portfolio/{item_id}", headers=admin_headers, timeout=10)


def test_portfolio_admin_accepts_new_leavers_categories(admin_headers):
    created = []
    try:
        for cat in ("leavers-front-designs", "leavers-back-designs", "leavers-full-front-designs"):
            payload = {
                "title": f"TEST_{cat}",
                "category": cat,
                "image_data_url": TINY_PNG,
            }
            r = requests.post(f"{API}/admin/portfolio", json=payload, headers=admin_headers, timeout=20)
            assert r.status_code in (200, 201), f"{cat} -> {r.status_code} {r.text}"
            created.append(r.json().get("id"))
    finally:
        for iid in created:
            if iid:
                requests.delete(f"{API}/admin/portfolio/{iid}", headers=admin_headers, timeout=10)
