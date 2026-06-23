"""Iteration 7 backend tests — team-kit addons, front-only variants, fight-night regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Team-kit addons endpoint ----------
def test_team_kit_addons_endpoint():
    r = requests.get(f"{API}/team-kits/addons", timeout=20)
    assert r.status_code == 200
    data = r.json()
    by_id = {a["id"]: a for a in data}
    assert "left-sleeve" in by_id and by_id["left-sleeve"]["price"] == 3.00
    assert "right-sleeve" in by_id and by_id["right-sleeve"]["price"] == 3.00
    assert "back-print" in by_id and by_id["back-print"]["price"] == 3.50
    assert len(data) == 3


# ---------- Team-kits products catalogue (9 items incl. 4 new front-only) ----------
def test_team_kits_category_has_nine_products():
    r = requests.get(f"{API}/products", params={"category": "team-kits"}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    ids = {p["id"] for p in items}
    assert len(items) == 9, f"Expected 9 team-kits, got {len(items)}: {ids}"
    for new_id in ["football-kit-front-only", "football-premium-front-only",
                   "rugby-kit-front-only", "training-pack-front-only"]:
        assert new_id in ids, f"Missing front-only variant {new_id}"


@pytest.mark.parametrize("pid,expected_price", [
    ("football-kit-front-only", 18.99),
    ("football-premium-front-only", 22.99),
    ("rugby-kit-front-only", 25.99),
    ("training-pack-front-only", 12.99),
])
def test_front_only_variant_pricing_and_sizes(pid, expected_price):
    r = requests.get(f"{API}/products/{pid}", timeout=20)
    assert r.status_code == 200
    p = r.json()
    assert p["price"] == expected_price
    assert isinstance(p.get("sizes"), list) and len(p["sizes"]) > 0
    assert p["category"] == "team-kits"


# ---------- Checkout: team-kit-bundle with all 3 addons ----------
def test_checkout_football_kit_bundle_with_all_addons():
    payload = {
        "product_id": "football-kit-bundle",
        "size_qtys": {"M": 5},
        "color": "Test",
        "placements": ["left-sleeve", "right-sleeve", "back-print"],
        "blank": False,
        "origin_url": BASE_URL,
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "url" in data and data["url"].startswith("http")
    assert "session_id" in data
    # Verify via status endpoint that amount = 5 × (24.99+3+3+3.5) = 172.45
    s = requests.get(f"{API}/checkout/status/{data['session_id']}", timeout=30)
    assert s.status_code == 200
    assert s.json()["amount_total"] == pytest.approx(172.45, abs=0.01)


# ---------- Checkout: football-kit-front-only with left-sleeve addon ----------
def test_checkout_front_only_with_one_addon():
    payload = {
        "product_id": "football-kit-front-only",
        "size_qtys": {"L": 10},
        "color": "Test",
        "placements": ["left-sleeve"],
        "blank": False,
        "origin_url": BASE_URL,
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=30)
    assert s.status_code == 200
    # 10 × (18.99 + 3.00) = 219.90
    assert s.json()["amount_total"] == pytest.approx(219.90, abs=0.01)


# ---------- Regression: boxing-fight-tee retains FIGHT_NIGHT_ADDONS pricing ----------
def test_checkout_boxing_fight_tee_regression():
    payload = {
        "product_id": "boxing-fight-tee",
        "size_qtys": {"M": 1},
        "color": "Black",
        "placements": ["back-print", "left-sleeve", "right-sleeve"],
        "blank": False,
        "origin_url": BASE_URL,
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=30)
    assert s.status_code == 200
    # 1 × (11.99 + 3.5 + 3 + 3) = 21.49
    assert s.json()["amount_total"] == pytest.approx(21.49, abs=0.01)
