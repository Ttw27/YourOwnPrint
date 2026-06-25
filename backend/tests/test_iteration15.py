"""Iteration 15 — Kit Your Workforce + Also Bought cross-sells."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # frontend env file
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"

WORKFORCE_IDS = ["workwear-tshirt", "workwear-sweatshirt", "workwear-jacket", "hi-vis-vest"]
ORIGIN = "https://example.com"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ----- workforce/products -----
class TestWorkforceProducts:
    def test_list_returns_only_eligible(self, auth_headers):
        # ensure 4 workwear ids are marked eligible (re-PATCH for idempotency)
        for pid in WORKFORCE_IDS:
            requests.patch(f"{API}/admin/products/{pid}/meta",
                           headers=auth_headers,
                           json={"workforce_eligible": True})
        r = requests.get(f"{API}/workforce/products")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = {x["id"] for x in items}
        for pid in WORKFORCE_IDS:
            assert pid in ids, f"{pid} missing from workforce list (got {ids})"
        # No non-eligible products
        assert "personalised-tee" not in ids
        # Required fields
        for it in items:
            for key in ("id", "name", "price", "image", "sizes", "size_upcharges", "category", "allowed_placements"):
                assert key in it, f"missing {key} in {it.get('id')}"


# ----- workforce/tiers -----
class TestWorkforceTiers:
    def test_defaults(self):
        r = requests.get(f"{API}/workforce/tiers")
        assert r.status_code == 200
        d = r.json()
        assert "tiers" in d and isinstance(d["tiers"], list) and len(d["tiers"]) >= 1
        assert d.get("back_print_price") == 3.5
        assert d.get("quote_threshold") is not None
        for t in d["tiers"]:
            assert "min_qty" in t and "pct" in t

    def test_update_requires_auth(self):
        r = requests.patch(f"{API}/admin/workforce-tiers",
                           json={"tiers": [{"min_qty": 10, "pct": 10}], "quote_threshold": 100})
        assert r.status_code in (401, 403)

    def test_update_valid(self, auth_headers):
        body = {"tiers": [{"min_qty": 10, "pct": 10}, {"min_qty": 25, "pct": 18},
                          {"min_qty": 100, "pct": 28}, {"min_qty": 200, "pct": 35}],
                "quote_threshold": 100}
        r = requests.patch(f"{API}/admin/workforce-tiers", headers=auth_headers, json=body)
        assert r.status_code == 200, r.text
        # verify by GET
        d = requests.get(f"{API}/workforce/tiers").json()
        assert d["quote_threshold"] == 100

    def test_update_invalid_pct(self, auth_headers):
        r = requests.patch(f"{API}/admin/workforce-tiers", headers=auth_headers,
                           json={"tiers": [{"min_qty": 10, "pct": 95}]})
        assert r.status_code == 400

    def test_update_invalid_min_qty(self, auth_headers):
        r = requests.patch(f"{API}/admin/workforce-tiers", headers=auth_headers,
                           json={"tiers": [{"min_qty": 0, "pct": 10}]})
        assert r.status_code == 400


# ----- workforce/checkout pricing & validation -----
class TestWorkforceCheckout:
    def test_checkout_pricing_12_tees(self, auth_headers):
        # ensure tiers default
        requests.patch(f"{API}/admin/workforce-tiers", headers=auth_headers,
                       json={"tiers": [{"min_qty": 10, "pct": 10}, {"min_qty": 25, "pct": 18},
                                       {"min_qty": 100, "pct": 28}, {"min_qty": 200, "pct": 35}],
                             "quote_threshold": 100})
        # 12 workwear-tshirts: 6 with back_print, 6 without; size with 0 upcharge
        # Need to pick a size and check size_upcharges
        prods = requests.get(f"{API}/workforce/products").json()
        tshirt = next(p for p in prods if p["id"] == "workwear-tshirt")
        sizes = tshirt.get("sizes") or []
        upcharges = tshirt.get("size_upcharges") or {}
        # find a zero-upcharge size
        size = None
        for s in sizes:
            if float(upcharges.get(s, 0)) == 0:
                size = s
                break
        assert size, f"no zero-upcharge size found, upcharges={upcharges}"
        lines = []
        for i in range(6):
            lines.append({"product_id": "workwear-tshirt", "size": size, "qty": 1, "back_print": False})
        for i in range(6):
            lines.append({"product_id": "workwear-tshirt", "size": size, "qty": 1, "back_print": True})
        r = requests.post(f"{API}/workforce/checkout",
                          json={"lines": lines, "contact_name": "T", "contact_email": "t@example.com", "origin_url": ORIGIN})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and "session_id" in d
        assert d["url"].startswith("https://checkout.stripe.com"), d["url"]

    def test_checkout_rejects_non_eligible(self):
        r = requests.post(f"{API}/workforce/checkout", json={
            "lines": [{"product_id": "personalised-tee", "size": "M", "qty": 5, "back_print": False}],
            "contact_name": "T", "contact_email": "t@example.com", "origin_url": ORIGIN})
        assert r.status_code == 400

    def test_checkout_rejects_back_print_when_not_allowed(self, auth_headers):
        # hi-vis-vest typically doesn't have back-print. Force placements to exclude back-print.
        requests.patch(f"{API}/admin/products/hi-vis-vest/meta", headers=auth_headers,
                       json={"workforce_eligible": True, "allowed_placements": ["left-breast", "right-breast"]})
        prods = requests.get(f"{API}/workforce/products").json()
        hv = next((p for p in prods if p["id"] == "hi-vis-vest"), None)
        assert hv, "hi-vis-vest missing"
        size = (hv.get("sizes") or ["M"])[0]
        r = requests.post(f"{API}/workforce/checkout", json={
            "lines": [{"product_id": "hi-vis-vest", "size": size, "qty": 5, "back_print": True}],
            "contact_name": "T", "contact_email": "t@example.com", "origin_url": ORIGIN})
        assert r.status_code == 400, r.text

    def test_checkout_over_threshold(self, auth_headers):
        # tshirt
        prods = requests.get(f"{API}/workforce/products").json()
        tshirt = next(p for p in prods if p["id"] == "workwear-tshirt")
        size = (tshirt.get("sizes") or ["M"])[0]
        r = requests.post(f"{API}/workforce/checkout", json={
            "lines": [{"product_id": "workwear-tshirt", "size": size, "qty": 150, "back_print": False}],
            "contact_name": "T", "contact_email": "t@example.com", "origin_url": ORIGIN})
        assert r.status_code == 422, r.text


# ----- workforce/quote -----
class TestWorkforceQuote:
    def test_quote_success(self):
        prods = requests.get(f"{API}/workforce/products").json()
        tshirt = next(p for p in prods if p["id"] == "workwear-tshirt")
        size = (tshirt.get("sizes") or ["M"])[0]
        r = requests.post(f"{API}/workforce/quote", json={
            "lines": [{"product_id": "workwear-tshirt", "size": size, "qty": 150, "back_print": False}],
            "contact_name": "Acme Ltd", "contact_email": "ops@acme.example", "origin_url": ORIGIN})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "id" in d
        assert d.get("total_qty") == 150

    def test_quote_missing_contact(self):
        r = requests.post(f"{API}/workforce/quote", json={
            "lines": [{"product_id": "workwear-tshirt", "size": "M", "qty": 150, "back_print": False}],
            "contact_name": "", "contact_email": "", "origin_url": ORIGIN})
        # pydantic EmailStr rejects empty → 422; server own check returns 400
        assert r.status_code in (400, 422)

    def test_quote_below_threshold_rejected(self):
        r = requests.post(f"{API}/workforce/quote", json={
            "lines": [{"product_id": "workwear-tshirt", "size": "M", "qty": 10, "back_print": False}],
            "contact_name": "X", "contact_email": "x@example.com", "origin_url": ORIGIN})
        assert r.status_code == 400


# ----- Also Bought -----
class TestAlsoBought:
    def test_admin_set_and_get(self, auth_headers):
        r = requests.patch(f"{API}/admin/products/workwear-tshirt/meta", headers=auth_headers,
                           json={"also_bought": ["workwear-jacket", "hi-vis-vest"]})
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/products/workwear-tshirt/also-bought")
        assert r2.status_code == 200
        items = r2.json()
        # Could be list or dict
        if isinstance(items, dict):
            items = items.get("items") or items.get("products") or []
        ids = [i.get("id") for i in items]
        assert ids[:2] == ["workwear-jacket", "hi-vis-vest"], f"order wrong: {ids}"

    def test_self_reference_rejected(self, auth_headers):
        r = requests.patch(f"{API}/admin/products/workwear-tshirt/meta", headers=auth_headers,
                           json={"also_bought": ["workwear-tshirt"]})
        assert r.status_code == 400

    def test_over_six_rejected(self, auth_headers):
        # pick 7 random product ids
        all_prods = requests.get(f"{API}/admin/products", headers=auth_headers).json()
        ids = [p["id"] for p in all_prods if p["id"] != "workwear-tshirt"][:7]
        assert len(ids) == 7
        r = requests.patch(f"{API}/admin/products/workwear-tshirt/meta", headers=auth_headers,
                           json={"also_bought": ids})
        assert r.status_code == 400

    def test_unknown_id_rejected(self, auth_headers):
        r = requests.patch(f"{API}/admin/products/workwear-tshirt/meta", headers=auth_headers,
                           json={"also_bought": ["definitely-not-a-product"]})
        assert r.status_code == 400

    def test_auto_fallback_when_empty(self, auth_headers):
        # clear list
        r = requests.patch(f"{API}/admin/products/workwear-jacket/meta", headers=auth_headers,
                           json={"also_bought": []})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/products/workwear-jacket/also-bought")
        assert r2.status_code == 200
        items = r2.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("products") or []
        assert isinstance(items, list)
        # max 4, not include itself
        assert len(items) <= 4
        for it in items:
            assert it.get("id") != "workwear-jacket"


# ----- Admin meta regression -----
class TestAdminMetaRegression:
    def test_meta_persists_workforce_and_also(self, auth_headers):
        body = {"workforce_eligible": True, "also_bought": ["hi-vis-vest"],
                "brand": "Test Brand", "sku": "WW-TEE-001",
                "allowed_placements": ["left-breast", "right-breast", "back-print", "full-front"]}
        r = requests.patch(f"{API}/admin/products/workwear-tshirt/meta", headers=auth_headers, json=body)
        assert r.status_code == 200
        all_p = requests.get(f"{API}/admin/products", headers=auth_headers).json()
        item = next((p for p in all_p if p["id"] == "workwear-tshirt"), None)
        assert item is not None
        assert item.get("workforce_eligible") is True
        assert "hi-vis-vest" in (item.get("also_bought") or [])
        assert item.get("brand") == "Test Brand"
        assert item.get("sku") == "WW-TEE-001"
        for pl in ["left-breast", "back-print"]:
            assert pl in (item.get("allowed_placements") or [])
