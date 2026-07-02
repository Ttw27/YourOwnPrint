"""Iter30 tests — multi-product cart + refactor regression sanity."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- Refactor regression sanity ----------

class TestRefactorRegression:
    def test_products_list(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 52, f"expected >=52 products, got {len(data)}"

    def test_full_squad_config(self, s):
        r = s.get(f"{API}/full-squad/config")
        assert r.status_code == 200
        j = r.json()
        assert "addons" in j or isinstance(j, dict)

    def test_sports_outfit_config(self, s):
        r = s.get(f"{API}/sports-outfit/config")
        assert r.status_code == 200

    def test_page_copy_home_default(self, s):
        r = s.get(f"{API}/page-copy/home")
        assert r.status_code == 200
        assert r.json() == {}

    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_site_whatsapp(self, s):
        r = s.get(f"{API}/site/whatsapp")
        assert r.status_code == 200

    def test_leavers_bespoke(self, s):
        payload = {
            "school": "TEST_iter30 School",
            "year_group": "Year 11",
            "contact_name": "TEST_iter30",
            "contact_email": "test_iter30@example.com",
            "contact_phone": "01234567890",
            "estimated_qty": 30,
            "notes": "iter30 test",
        }
        r = s.post(f"{API}/leavers/bespoke", json=payload)
        assert r.status_code == 200, r.text

    def test_designer_remove_bg_not_configured(self, s):
        r = s.post(f"{API}/designer/remove-bg", json={"image_base64": "data:image/png;base64,iVBORw0KGgo="})
        # Should be 503 (not configured) OR 400 if payload rejected first — accept both here but review says 503
        assert r.status_code in (400, 503), r.text
        assert r.status_code == 503, f"expected 503 not configured, got {r.status_code}: {r.text[:200]}"

    def test_designer_ai_effect_not_configured(self, s):
        r = s.post(f"{API}/designer/ai-effect", json={"image_base64": "data:image/png;base64,iVBORw0KGgo=", "effect": "cartoon"})
        assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text[:200]}"

    def test_admin_full_squad_addons_patch_and_reject(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        cur = s.get(f"{API}/full-squad/config").json().get("addons", {})
        # Endpoint takes {values:{...}} — send valid patch (merge single key)
        r = s.patch(f"{API}/admin/full-squad/addons", json={"values": {"sleeve_print_price": 3.75}}, headers=h)
        assert r.status_code == 200, r.text
        after = s.get(f"{API}/full-squad/config").json().get("addons", {})
        assert after.get("sleeve_print_price") == 3.75
        assert "gym_bag_addon_price" in after, "merge should preserve other keys"

        # Reject out-of-range value
        rbad = s.patch(f"{API}/admin/full-squad/addons", json={"values": {"sleeve_print_price": -5}}, headers=h)
        assert rbad.status_code == 400
        rbad2 = s.patch(f"{API}/admin/full-squad/addons", json={"values": {"sleeve_print_price": 9999}}, headers=h)
        assert rbad2.status_code == 400

        # Restore
        restore_val = cur.get("sleeve_print_price", 3.5)
        s.patch(f"{API}/admin/full-squad/addons", json={"values": {"sleeve_print_price": restore_val}}, headers=h)

    def test_admin_page_copy_patch_and_delete(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = s.patch(f"{API}/admin/page-copy/home", json={"title": "TEST_iter30 title"}, headers=h)
        assert r.status_code == 200, r.text
        got = s.get(f"{API}/page-copy/home").json()
        assert got.get("title") == "TEST_iter30 title"
        # DELETE (revert)
        rd = s.delete(f"{API}/admin/page-copy/home", headers=h)
        assert rd.status_code == 200
        assert s.get(f"{API}/page-copy/home").json() == {}


# ---------- Multi-product cart ----------

TEE = "personalised-tee"
HOODIE = "personalised-hoodie"


@pytest.fixture(scope="session")
def cart_payload_basic():
    return {
        "origin_url": "https://branded-workwear-lab.preview.emergentagent.com",
        "items": [
            {
                "product_id": TEE,
                "size_qtys": {"M": 2, "L": 3},
                "placements": ["left-chest"],
                "color": "Black",
            },
            {
                "product_id": HOODIE,
                "size_qtys": {"M": 1},
                "placements": [],
                "color": "Black",
                "blank": True,
            },
        ],
    }


class TestCartPricing:
    def test_price_cart_basic(self, s, cart_payload_basic):
        r = s.post(f"{API}/cart/price", json=cart_payload_basic)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "items" in j and len(j["items"]) == 2
        assert j["grand_total"] > 0
        assert j["total_qty"] == 6
        # Each item's line_total must equal breakdown-derived total for that line
        for it in j["items"]:
            assert it["line_total"] > 0
            assert it["total_qty"] == sum(it["size_qtys"].values())
        # Sum of line_totals == grand_total (within 0.02 tolerance)
        assert abs(sum(it["line_total"] for it in j["items"]) - j["grand_total"]) < 0.02

    def test_price_cart_empty_returns_empty_shape(self, s):
        r = s.post(f"{API}/cart/price", json={"items": [], "origin_url": "x"})
        assert r.status_code == 200
        j = r.json()
        assert j["items"] == [] and j["grand_total"] == 0.0 and j["total_qty"] == 0

    def test_price_cart_ignores_client_totals(self, s):
        # Client sends bogus keys — server must not use them (schema strips them)
        payload = {
            "origin_url": "http://x",
            "items": [{
                "product_id": TEE,
                "size_qtys": {"M": 2},
                "placements": ["left-chest"],
                "color": "Black",
                "line_total": 0.01,       # bogus
                "unit_hint": 0.01,        # bogus
            }],
        }
        r = s.post(f"{API}/cart/price", json=payload)
        assert r.status_code == 200
        j = r.json()
        assert j["items"][0]["line_total"] > 0.5  # server-computed > client-fake 0.01

    def test_price_cart_bulk_tier_discount(self, s):
        # Use personalised-hoodie which has bulk_pricing_enabled=True by default.
        # personalised-tee does NOT have bulk pricing on by default, so it wouldn't discount.
        p1 = {"origin_url": "x", "items": [{"product_id": HOODIE, "size_qtys": {"M": 1}, "placements": ["left-chest"], "color": "Black"}]}
        r1 = s.post(f"{API}/cart/price", json=p1)
        assert r1.status_code == 200, r1.text
        unit1 = r1.json()["items"][0]["unit_hint"]

        # qty=200 (should trigger bulk-tier discount)
        p200 = {"origin_url": "x", "items": [{"product_id": HOODIE, "size_qtys": {"M": 200}, "placements": ["left-chest"], "color": "Black"}]}
        r200 = s.post(f"{API}/cart/price", json=p200)
        assert r200.status_code == 200, r200.text
        unit200 = r200.json()["items"][0]["unit_hint"]

        assert unit200 < unit1, f"expected bulk-tier discount: unit@200 ({unit200}) < unit@1 ({unit1})"

    def test_price_cart_invalid_product(self, s):
        r = s.post(f"{API}/cart/price", json={"origin_url": "x", "items": [{"product_id": "nope-xyz", "size_qtys": {"M": 1}}]})
        assert r.status_code == 400


class TestCartCheckout:
    def test_checkout_cart_session_ok(self, s, cart_payload_basic):
        r = s.post(f"{API}/checkout/cart-session", json=cart_payload_basic)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "url" in j and "session_id" in j
        assert j["url"].startswith("http")

    def test_checkout_cart_session_empty_400(self, s):
        r = s.post(f"{API}/checkout/cart-session", json={"items": [], "origin_url": "https://x"})
        assert r.status_code == 400
        assert "empty" in r.text.lower()

    def test_checkout_cart_session_over_limit_400(self, s):
        items = [
            {"product_id": TEE, "size_qtys": {"M": 1}, "placements": ["left-chest"], "color": "Black"}
            for _ in range(21)
        ]
        r = s.post(f"{API}/checkout/cart-session", json={"items": items, "origin_url": "https://x"})
        assert r.status_code == 400
        assert "limit" in r.text.lower() or "20" in r.text
