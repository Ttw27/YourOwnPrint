"""Iteration 13 backend tests — generic bulk-pricing tiers + product meta (brand/SKU/size guide)."""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ORIGIN = "https://example.com"

ORIG_DEFAULTS = [
    {"min_qty": 200, "pct": 35.0},
    {"min_qty": 100, "pct": 28.0},
    {"min_qty": 25, "pct": 18.0},
    {"min_qty": 10, "pct": 10.0},
]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------------- Bulk defaults GET/PATCH ----------------

def test_bulk_defaults_get_initial(s):
    r = s.get(f"{API}/bulk-tiers/defaults")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "tiers" in data
    # Order desc by min_qty
    qmin = [t["min_qty"] for t in data["tiers"]]
    assert qmin == sorted(qmin, reverse=True)
    # Either still original (no patch yet) or already mutated by an earlier run — both ok;
    # what matters is restored before tests finish.
    # But on a fresh DB we expect exactly the 4 original tiers.


def test_bulk_defaults_patch_and_persist(s):
    # update with 2 valid tiers
    r = s.patch(f"{API}/admin/bulk-tiers/defaults", json={
        "tiers": [{"min_qty": 10, "pct": 8}, {"min_qty": 50, "pct": 20}]
    })
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # GET reflects the change (sorted desc by min_qty)
    r = s.get(f"{API}/bulk-tiers/defaults")
    assert r.status_code == 200
    tiers = r.json()["tiers"]
    pairs = [(t["min_qty"], t["pct"]) for t in tiers]
    assert (50, 20.0) in pairs and (10, 8.0) in pairs
    assert pairs[0][0] == 50  # desc order


@pytest.mark.parametrize("bad_payload", [
    {"tiers": []},                                       # empty list
    {"tiers": [{"min_qty": 10, "pct": 95}]},              # pct > 90
    {"tiers": [{"min_qty": 0, "pct": 10}]},               # min_qty < 1
    {"tiers": [{"min_qty": 10}]},                          # missing pct
    {"tiers": [{"pct": 10}]},                              # missing min_qty
])
def test_bulk_defaults_patch_invalid(s, bad_payload):
    r = s.patch(f"{API}/admin/bulk-tiers/defaults", json=bad_payload)
    assert r.status_code == 400, f"expected 400 for {bad_payload} got {r.status_code}: {r.text}"


def test_bulk_defaults_restore(s):
    """Restore the 4 original tiers."""
    r = s.patch(f"{API}/admin/bulk-tiers/defaults", json={"tiers": ORIG_DEFAULTS})
    assert r.status_code == 200, r.text
    data = s.get(f"{API}/bulk-tiers/defaults").json()
    pairs = [(t["min_qty"], t["pct"]) for t in data["tiers"]]
    assert pairs == [(200, 35.0), (100, 28.0), (25, 18.0), (10, 10.0)]


# ---------------- Product meta PATCH + product GET surface ----------------

def test_product_meta_patch_and_get_persisted(s):
    payload = {
        "brand": "YOP",
        "sku": "YOP-PT-01",
        "description_full": "Long desc for personalised tee — iteration 13 test.",
        "size_guide_image": "https://x",
        "size_guide_table": [{"size": "M", "chest": 52, "length": 71}],
        "bulk_pricing_enabled": True,
    }
    r = s.patch(f"{API}/admin/products/personalised-tee/meta", json=payload)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # GET product surfaces all fields
    r = s.get(f"{API}/products/personalised-tee")
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("brand") == "YOP"
    assert p.get("sku") == "YOP-PT-01"
    assert "Long desc" in (p.get("description_full") or "")
    assert p.get("size_guide_image") == "https://x"
    sgt = p.get("size_guide_table") or []
    assert any(r.get("size") == "M" and r.get("chest") == 52 for r in sgt)
    assert p.get("bulk_pricing_enabled") is True


def test_product_meta_patch_unknown_product_404(s):
    r = s.patch(f"{API}/admin/products/non-existent-pid/meta", json={"brand": "X"})
    assert r.status_code == 404


# ---------------- /bulk-tiers/product/{id} preview ----------------

def test_bulk_tiers_product_percent_mode(s):
    # personalised-tee already enabled via previous test
    r = s.get(f"{API}/bulk-tiers/product/personalised-tee")
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "percent"
    assert len(data["tiers"]) == 4
    base = data["base_price"]
    # Each tier has unit_price snapped to .99 and positive savings
    for t in data["tiers"]:
        assert isinstance(t["unit_price"], (int, float))
        assert round(t["unit_price"] - int(t["unit_price"]), 2) == 0.99 or t["unit_price"] == 0.99
        assert t["savings_per_unit"] > 0
        assert t["unit_price"] < base


def test_bulk_tiers_product_absolute_mode(s):
    r = s.get(f"{API}/bulk-tiers/product/boxing-fight-tee")
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "absolute"
    assert len(data["tiers"]) == 2


def test_bulk_tiers_product_none_when_disabled(s):
    # Disable on personalised-tee
    r = s.patch(f"{API}/admin/products/personalised-tee/meta", json={
        "brand": "YOP", "sku": "YOP-PT-01", "bulk_pricing_enabled": False
    })
    assert r.status_code == 200
    r = s.get(f"{API}/bulk-tiers/product/personalised-tee")
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "none"
    assert data["tiers"] == []
    # Re-enable
    r = s.patch(f"{API}/admin/products/personalised-tee/meta", json={
        "brand": "YOP", "sku": "YOP-PT-01", "bulk_pricing_enabled": True
    })
    assert r.status_code == 200
    assert s.get(f"{API}/bulk-tiers/product/personalised-tee").json()["mode"] == "percent"


# ---------------- Checkout math for generic % tier on workwear-tshirt ----------------

def _checkout(s, product_id, size_qtys, placements=None):
    payload = {
        "product_id": product_id,
        "size_qtys": size_qtys,
        "color": "Black",
        "placements": placements or [],
        "origin_url": ORIGIN,
    }
    return s.post(f"{API}/checkout/session", json=payload)


def _amount(s, session_id):
    r = s.get(f"{API}/checkout/status/{session_id}")
    assert r.status_code == 200, r.text
    return r.json()["amount_total"]


@pytest.fixture(scope="module")
def workwear_bulk_enabled(s):
    """Make sure workwear-tshirt has bulk_pricing_enabled=True for math tests."""
    r = s.patch(f"{API}/admin/products/workwear-tshirt/meta", json={
        "brand": "YOP Workwear",
        "sku": "YOP-WTS-01",
        "bulk_pricing_enabled": True,
    })
    assert r.status_code == 200
    yield
    # Best-effort cleanup left in place: we don't disable to keep test isolation predictable


@pytest.mark.parametrize("qty,expected", [
    (9, round(9 * 7.49, 2)),    # 67.41  no tier
    (10, round(10 * 6.99, 2)),  # 69.90  10% off → snap → 6.99
    (25, round(25 * 5.99, 2)),  # 149.75 18% off → snap → 5.99
    (100, round(100 * 4.99, 2)),# 499.00 28% off → snap → 4.99
    (200, round(200 * 4.99, 2)),# 998.00 35% off → snap → 4.99 (duplicate snap is expected)
])
def test_workwear_generic_bulk_checkout(s, workwear_bulk_enabled, qty, expected):
    r = _checkout(s, "workwear-tshirt", {"M": qty}, placements=[])
    assert r.status_code == 200, r.text
    got = _amount(s, r.json()["session_id"])
    assert got == expected, f"qty={qty} expected {expected} got {got}"


# ---------------- Regression: fight-night & leavers still use absolute ----------------

def test_regression_fight_night_checkout(s):
    r = _checkout(s, "boxing-fight-tee", {"M": 10}, placements=[])
    assert r.status_code == 200, r.text
    assert _amount(s, r.json()["session_id"]) == round(10 * 10.99, 2)


def test_regression_leavers_checkout(s):
    r = _checkout(s, "leavers-pullover-hoodie", {"M": 20}, placements=[])
    assert r.status_code == 200, r.text
    assert _amount(s, r.json()["session_id"]) == round(20 * 19.99, 2)


# ---------------- Admin overview ----------------

def test_admin_products_lists_all_with_meta(s):
    r = s.get(f"{API}/admin/products")
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list) and len(items) > 5
    sample = items[0]
    for k in ("id", "name", "price", "category", "image", "brand", "sku",
              "description_full", "size_guide_image", "size_guide_table",
              "bulk_pricing_enabled", "bulk_pricing_overrides"):
        assert k in sample, f"missing field {k} in /admin/products entry"
    # workwear-tshirt should reflect persisted meta
    wts = next((p for p in items if p["id"] == "workwear-tshirt"), None)
    assert wts is not None
    assert wts["bulk_pricing_enabled"] is True
    assert wts["brand"] == "YOP Workwear"
