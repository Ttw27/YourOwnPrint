"""Iteration 11 backend tests — neck-label upcharge, composition/description/use_cases, neck-label PNGs."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

USE_CASE_OPTIONS = ["workwear", "branded-to-sell", "daily-use", "sports", "kids", "eco"]


# ---- 1. /designer/products carries new fields ----
def test_designer_products_new_fields():
    r = requests.get(f"{API}/designer/products", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 8
    for p in data:
        assert "neck_label_price" in p
        assert abs(p["neck_label_price"] - 1.50) < 0.001, p
        assert "composition" in p
        assert "description_long" in p
        assert "use_cases" in p
        assert isinstance(p["use_cases"], list)


def test_designer_products_personalised_tee_defaults():
    r = requests.get(f"{API}/designer/products", timeout=15)
    data = r.json()
    tee = next(p for p in data if p["id"] == "personalised-tee")
    assert tee["composition"] == "180 GSM · 100% ring-spun cotton", tee
    assert "branded-to-sell" in tee["use_cases"]
    assert "daily-use" in tee["use_cases"]


# ---- 2. /designer/use-cases ----
def test_designer_use_cases_endpoint():
    r = requests.get(f"{API}/designer/use-cases", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert sorted(data) == sorted(USE_CASE_OPTIONS)


# ---- 3. Checkout neck-label only ----
def test_checkout_designer_neck_only():
    payload = {
        "product_id": "personalised-tee",
        "size_qtys": {"M": 2},
        "placements": ["neck-label"],
        "blank": False,
        "design_meta": {"flow": "designer"},
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20).json()
    # 2 * (6.99 + 1.50) = 16.98
    assert abs(s["amount_total"] - 16.98) < 0.01, s


# ---- 4. Checkout back-print + neck-label additively ----
def test_checkout_designer_back_plus_neck():
    payload = {
        "product_id": "personalised-tee",
        "size_qtys": {"M": 2},
        "placements": ["back-print", "neck-label"],
        "blank": False,
        "design_meta": {"flow": "designer"},
        "origin_url": "https://example.com",
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    s = requests.get(f"{API}/checkout/status/{sid}", timeout=20).json()
    # 2 * (6.99 + 3.99 + 1.50) = 24.96
    assert abs(s["amount_total"] - 24.96) < 0.01, s


def _admin_tee_current():
    """Return the current admin record for personalised-tee (incl. image/print_area)."""
    r = requests.get(f"{API}/admin/designer-products", timeout=15)
    r.raise_for_status()
    return next(p for p in r.json() if p["id"] == "personalised-tee")


# ---- 5. PATCH /admin/designer-products/personalised-tee with new fields ----
def test_admin_patch_composition_and_use_cases():
    base = _admin_tee_current()
    payload = {
        "designer_enabled": base.get("designer_enabled", True),
        "designer_image": base["designer_image"],
        "designer_print_area": base["designer_print_area"],
        "composition": "TEST COMP",
        "description_long": "TEST DESC",
        "use_cases": ["workwear", "eco"],
    }
    r = requests.patch(f"{API}/admin/designer-products/personalised-tee", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # Verify changes reflected in GET
    g = requests.get(f"{API}/designer/products", timeout=15).json()
    tee = next(p for p in g if p["id"] == "personalised-tee")
    assert tee["composition"] == "TEST COMP", tee
    assert tee["description_long"] == "TEST DESC", tee
    assert sorted(tee["use_cases"]) == sorted(["workwear", "eco"]), tee

    # Restore defaults
    restore = {
        "designer_enabled": base.get("designer_enabled", True),
        "designer_image": base["designer_image"],
        "designer_print_area": base["designer_print_area"],
        "composition": "180 GSM · 100% ring-spun cotton",
        "description_long": "Mid-weight everyday tee. Soft hand, durable wash, slight stretch in the collar. Our most versatile blank.",
        "use_cases": ["branded-to-sell", "daily-use"],
    }
    rr = requests.patch(f"{API}/admin/designer-products/personalised-tee", json=restore, timeout=15)
    assert rr.status_code == 200


def test_admin_patch_unknown_use_case_rejected():
    base = _admin_tee_current()
    payload = {
        "designer_enabled": base.get("designer_enabled", True),
        "designer_image": base["designer_image"],
        "designer_print_area": base["designer_print_area"],
        "use_cases": ["bogus"],
    }
    r = requests.patch(f"{API}/admin/designer-products/personalised-tee", json=payload, timeout=15)
    assert r.status_code == 400, r.text


# ---- 6. POST /designer/artwork with neck_label_pngs ----
def test_designer_artwork_with_neck_labels():
    payload = {
        "product_id": "personalised-tee",
        "artwork_png": TINY_PNG,
        "preview_png": TINY_PNG,
        "neck_label_pngs": {"M": TINY_PNG, "L": TINY_PNG},
        "neck_label_preview_pngs": {"M": TINY_PNG, "L": TINY_PNG},
        "items_count": 1,
        "neck_label_items_count": 2,
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
    assert doc["neck_label_pngs"] == {"M": TINY_PNG, "L": TINY_PNG}
    assert doc["neck_label_preview_pngs"] == {"M": TINY_PNG, "L": TINY_PNG}
    assert doc["neck_label_items_count"] == 2


def test_designer_artwork_neck_label_too_large():
    big = "data:image/png;base64," + ("A" * 2_100_000)
    payload = {
        "product_id": "personalised-tee",
        "artwork_png": TINY_PNG,
        "neck_label_pngs": {"M": big},
        "items_count": 1,
        "neck_label_items_count": 1,
    }
    r = requests.post(f"{API}/designer/artwork", json=payload, timeout=20)
    assert r.status_code == 400, r.text
    assert "neck_label" in r.text.lower()
