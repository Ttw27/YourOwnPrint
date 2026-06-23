"""Iteration 6 tests: team-kit-brands CRUD, fight-night addons, fight-night checkout math."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ----- Fight-night addons -----
def test_fight_night_addons_list(s):
    r = s.get(f"{API}/fight-night/addons", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    by_id = {a["id"]: a for a in data}
    assert "back-print" in by_id and by_id["back-print"]["price"] == 3.5
    assert "left-sleeve" in by_id and by_id["left-sleeve"]["price"] == 3.0
    assert "right-sleeve" in by_id and by_id["right-sleeve"]["price"] == 3.0


# ----- Products list -----
def test_products_list_contains_required(s):
    r = s.get(f"{API}/products", timeout=20)
    assert r.status_code == 200
    products = r.json()
    assert len(products) >= 20, f"expected >=20 products, got {len(products)}"
    ids = {p["id"] for p in products}
    assert "boxing-fight-tee" in ids
    assert "fight-shorts" in ids
    assert "football-kit-bundle" in ids


# ----- Quote request -----
def test_quote_request_team_kit(s):
    payload = {
        "kind": "team_kit",
        "name": "TEST_Captain",
        "email": "test@example.com",
        "phone": "07000000000",
        "sport": "Football",
        "kit_type": "football-kit-bundle",
        "quantity": 20,
        "message": "TEST iteration 6 quote",
        "artwork": [],
        "roster": [{"team": "First Team", "name": "P1", "size": "M", "qty": 1}],
        "product_id": "football-kit-bundle",
    }
    r = s.post(f"{API}/quote-request", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert "id" in body


# ----- Team-kit brands CRUD -----
def test_brand_crud_flow(s):
    # CREATE
    payload = {
        "product_id": "football-kit-bundle",
        "brand": "TEST_Brand",
        "name": "TEST_Model_A",
        "price": 39.99,
        "image": "",
        "description": "TEST iteration6 brand",
        "active": True,
    }
    r = s.post(f"{API}/team-kit-brands", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    brand = r.json()
    bid = brand["id"]
    assert brand["brand"] == "TEST_Brand"
    assert brand["price"] == 39.99
    assert brand["product_id"] == "football-kit-bundle"

    # LIST + filter by product_id includes our brand
    r = s.get(f"{API}/team-kit-brands?product_id=football-kit-bundle", timeout=20)
    assert r.status_code == 200
    ids = [b["id"] for b in r.json()]
    assert bid in ids

    # LIST without filter still works
    r = s.get(f"{API}/team-kit-brands", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # UPDATE
    upd = dict(payload, name="TEST_Model_B", price=44.99)
    r = s.put(f"{API}/team-kit-brands/{bid}", json=upd, timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    # GET reflects update
    r = s.get(f"{API}/team-kit-brands?product_id=football-kit-bundle", timeout=20)
    found = next((b for b in r.json() if b["id"] == bid), None)
    assert found is not None
    assert found["name"] == "TEST_Model_B"
    assert found["price"] == 44.99

    # DELETE
    r = s.delete(f"{API}/team-kit-brands/{bid}", timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    # GET no longer includes id
    r = s.get(f"{API}/team-kit-brands?product_id=football-kit-bundle", timeout=20)
    assert bid not in [b["id"] for b in r.json()]


def test_brand_invalid_product(s):
    r = s.post(
        f"{API}/team-kit-brands",
        json={"product_id": "not-a-product", "brand": "X", "name": "Y", "price": 1.0},
        timeout=20,
    )
    assert r.status_code == 400


def test_brand_update_missing_404(s):
    r = s.put(
        f"{API}/team-kit-brands/nonexistent-id-xyz",
        json={"product_id": "football-kit-bundle", "brand": "x", "name": "y", "price": 1.0},
        timeout=20,
    )
    assert r.status_code == 404


# ----- Fight-night checkout math -----
def test_fight_night_checkout_addons_math(s):
    # Get base price for boxing-fight-tee
    r = s.get(f"{API}/products/boxing-fight-tee", timeout=20)
    assert r.status_code == 200
    base = float(r.json()["price"])

    payload = {
        "product_id": "boxing-fight-tee",
        "size_qtys": {"M": 1},
        "color": "Black",
        "placements": ["left-sleeve", "right-sleeve", "back-print"],
        "blank": False,
        "origin_url": "https://example.com",
    }
    r = s.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "url" in body and body["url"].startswith("http")
    assert "session_id" in body

    # Verify math via DB-side log: status endpoint returns amount in £
    sid = body["session_id"]
    # Compute expected unit (M has size_upcharges from DEFAULT_SIZE_UPCHARGES — check via products endpoint)
    upcharge_m = float(r.json().get("size_upcharges", {}).get("M", 0)) if False else 0.0
    # Better: fetch via /products list to compute exact
    plist = s.get(f"{API}/products", timeout=20).json()
    bft = next(p for p in plist if p["id"] == "boxing-fight-tee")
    upcharge_m = float(bft.get("size_upcharges", {}).get("M", 0))
    expected_unit = round(base + upcharge_m + 3.5 + 3.0 + 3.0, 2)
    expected_total = round(expected_unit * 1, 2)

    st = s.get(f"{API}/checkout/status/{sid}", timeout=30)
    assert st.status_code == 200, st.text
    assert round(float(st.json()["amount_total"]), 2) == expected_total, (
        f"expected £{expected_total}, got {st.json()['amount_total']}"
    )


def test_fight_night_checkout_blank(s):
    # No placements + blank=True → no addon cost
    payload = {
        "product_id": "boxing-fight-tee",
        "size_qtys": {"M": 2},
        "color": "Black",
        "placements": [],
        "blank": True,
        "origin_url": "https://example.com",
    }
    r = s.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    assert "url" in r.json()
