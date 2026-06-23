"""Iteration 9 backend tests — designer back-print upcharge + back PNG persistence."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_BACK_PRICES = {
    "personalised-tee": 3.99,
    "personalised-hoodie": 8.99,
    "kids-tee": 4.99,
    "polo-shirt": 4.99,
    "workwear-tshirt": 3.99,
    "workwear-sweatshirt": 7.99,
    "school-hoodie": 9.99,
    "sports-tee": 4.99,
}

TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


# ---- 1. /designer/products carries back_print_price ----
def test_designer_products_back_print_price():
    r = requests.get(f"{API}/designer/products", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) == 8
    got = {p["id"]: p.get("back_print_price") for p in data}
    for pid, expected in EXPECTED_BACK_PRICES.items():
        assert pid in got, f"missing {pid}"
        assert got[pid] == expected, f"{pid}: got {got[pid]} expected {expected}"


# ---- 2. Designer-flow checkout with back-print: personalised-tee ----
def test_checkout_designer_tee_back_print():
    payload = {
        "product_id": "personalised-tee",
        "size_qtys": {"M": 2},
        "placements": ["back-print"],
        "blank": False,
        "design_meta": {"flow": "designer"},
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20)
    assert s.status_code == 200
    assert abs(s.json()["amount_total"] - 21.96) < 0.01, s.json()


# ---- 3. Designer-flow checkout with back-print: personalised-hoodie ----
def test_checkout_designer_hoodie_back_print():
    payload = {
        "product_id": "personalised-hoodie",
        "size_qtys": {"M": 1},
        "placements": ["back-print"],
        "blank": False,
        "design_meta": {"flow": "designer"},
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20)
    assert s.status_code == 200
    assert abs(s.json()["amount_total"] - 23.98) < 0.01, s.json()


# ---- 4a. Regression: boxing-fight-tee still uses FIGHT_NIGHT_ADDONS ----
def test_checkout_boxing_fight_regression():
    payload = {
        "product_id": "boxing-fight-tee",
        "size_qtys": {"M": 1},
        "placements": ["back-print", "left-sleeve", "right-sleeve"],
        "blank": False,
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20).json()
    # 11.99 + 3.50 + 3.00 + 3.00 = 21.49
    assert abs(s["amount_total"] - 21.49) < 0.01, s


# ---- 4b. Regression: team-kit uses TEAM_KIT_ADDONS ----
def test_checkout_team_kit_regression():
    payload = {
        "product_id": "football-kit-bundle",
        "size_qtys": {"M": 1},
        "placements": ["back-print"],
        "blank": False,
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20).json()
    # 24.99 + 3.50 = 28.49
    assert abs(s["amount_total"] - 28.49) < 0.01, s


# ---- 4c. Regression: plain personalised-tee (no designer flow) still uses PLACEMENT_BY_ID ----
def test_checkout_plain_tee_regression():
    payload = {
        "product_id": "personalised-tee",
        "size_qtys": {"M": 1},
        "placements": ["front-large"],  # unknown placement → ignored
        "blank": False,
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20).json()
    # 'front-large' is not a known placement → cleaned to [] → base 6.99
    assert abs(s["amount_total"] - 6.99) < 0.01, s


# ---- 4d. Regression: plain personalised-tee with full-front uses PLACEMENT_BY_ID (3.50) ----
def test_checkout_plain_tee_fullfront():
    payload = {
        "product_id": "personalised-tee",
        "size_qtys": {"M": 1},
        "placements": ["full-front"],
        "blank": False,
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20).json()
    # 6.99 + 3.50 = 10.49
    assert abs(s["amount_total"] - 10.49) < 0.01, s


# ---- 5. POST /designer/artwork with back PNG fields ----
def test_designer_artwork_with_back():
    payload = {
        "product_id": "personalised-tee",
        "artwork_png": TINY_PNG,
        "preview_png": TINY_PNG,
        "back_png": TINY_PNG,
        "back_preview_png": TINY_PNG,
        "items_count": 2,
        "back_items_count": 3,
        "width": 2000,
        "height": 2000,
    }
    r = requests.post(f"{API}/designer/artwork", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    g = requests.get(f"{API}/designer/artwork/{aid}", timeout=15)
    assert g.status_code == 200
    doc = g.json()
    assert doc["product_id"] == "personalised-tee"
    assert doc["artwork_png"] == TINY_PNG
    assert doc["back_png"] == TINY_PNG
    assert doc["back_preview_png"] == TINY_PNG
    assert doc["items_count"] == 2
    assert doc["back_items_count"] == 3


# ---- 5b. Oversized back_png returns 400 ----
def test_designer_artwork_back_too_large():
    big = "data:image/png;base64," + ("A" * 6_100_000)
    payload = {
        "product_id": "personalised-tee",
        "artwork_png": TINY_PNG,
        "back_png": big,
        "items_count": 1,
        "back_items_count": 1,
    }
    r = requests.post(f"{API}/designer/artwork", json=payload, timeout=20)
    assert r.status_code == 400, r.text
    assert "back" in r.text.lower()


# ---- 5c. Designer artwork without back fields still works ----
def test_designer_artwork_no_back():
    payload = {
        "product_id": "kids-tee",
        "artwork_png": TINY_PNG,
        "preview_png": TINY_PNG,
        "items_count": 1,
    }
    r = requests.post(f"{API}/designer/artwork", json=payload, timeout=20)
    assert r.status_code == 200
    aid = r.json()["id"]
    g = requests.get(f"{API}/designer/artwork/{aid}", timeout=15).json()
    assert g["back_png"] is None
    assert g["back_items_count"] == 0
