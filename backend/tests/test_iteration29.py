"""
Iteration 29 backend tests.

Covers the fixes flagged in iteration 28 plus the new endpoints:
- CMS merge for /admin/full-squad/addons and /admin/sports-outfit/addons
- Page-copy DELETE revert
- Product override pristine restore (no restart)
- Resend integration on POST /leavers/bespoke (must succeed with no key)
- /designer/remove-bg and /designer/ai-effect not-configured / bad input paths
- /admin/test-email admin gate + not-configured body
- Wired CMS on 8 public pages (H1 override + revert)
"""
import base64
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"

PAGE_SLUGS = [
    "home", "workwear", "specials", "contact",
    "leavers-hoodies", "fight-night", "kit-your-workforce", "design-your-own",
]


# ---- fixtures --------------------------------------------------------------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("token")
    assert tok, "no token in login response"
    return tok


@pytest.fixture(scope="module")
def admin(api, admin_token):
    api.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api


# ---- CMS: full-squad addons merge -----------------------------------------

class TestFullSquadAddonsMerge:
    def test_gym_bag_persists_and_retains_sleeve(self, admin):
        # seed a sleeve override first so we can prove merge preserves it
        r0 = admin.patch(f"{BASE_URL}/api/admin/full-squad/addons",
                         json={"values": {"sleeve_print_price": 7.5}})
        assert r0.status_code == 200, r0.text
        # now save only gym_bag_addon_price
        r1 = admin.patch(f"{BASE_URL}/api/admin/full-squad/addons",
                         json={"values": {"gym_bag_addon_price": 6.5}})
        assert r1.status_code == 200, r1.text
        merged = r1.json().get("values") or {}
        assert merged.get("gym_bag_addon_price") == 6.5, f"gym_bag not persisted: {merged}"
        assert merged.get("sleeve_print_price") == 7.5, f"sleeve wiped by merge: {merged}"

        # Public GET should include the merged addons
        r2 = admin.get(f"{BASE_URL}/api/full-squad/config")
        assert r2.status_code == 200
        addons = r2.json().get("addons") or {}
        assert addons.get("gym_bag_addon_price") == 6.5
        assert addons.get("sleeve_print_price") == 7.5

    def test_reset_defaults(self, admin):
        r = admin.patch(f"{BASE_URL}/api/admin/full-squad/addons",
                        json={"values": {"gym_bag_addon_price": 4.0,
                                          "sleeve_print_price": 3.5,
                                          "back_upload_print_price": 3.5,
                                          "back_name_and_number_price": 4.5}})
        assert r.status_code == 200


# ---- CMS: sports-outfit addons merge --------------------------------------

class TestSportsOutfitAddonsMerge:
    def test_two_sequential_saves_coexist(self, admin):
        admin.patch(f"{BASE_URL}/api/admin/sports-outfit/addons",
                    json={"values": {"breast_print_price": 3.5}})
        r = admin.patch(f"{BASE_URL}/api/admin/sports-outfit/addons",
                        json={"values": {"back_print_price": 5.5}})
        assert r.status_code == 200
        merged = r.json().get("values") or {}
        assert merged.get("breast_print_price") == 3.5, f"breast wiped: {merged}"
        assert merged.get("back_print_price") == 5.5, f"back not saved: {merged}"

    def test_reset_defaults(self, admin):
        # SPORTS_OUTFIT_ADDON_DEFAULTS: unbranded=1, breast=3, back=5, full_front=6 (best-effort defaults)
        r = admin.patch(f"{BASE_URL}/api/admin/sports-outfit/addons",
                        json={"values": {"breast_print_price": 3.0,
                                          "back_print_price": 5.0,
                                          "full_front_print_price": 6.0,
                                          "unbranded_price": 1.0}})
        assert r.status_code == 200


# ---- CMS: page-copy DELETE revert -----------------------------------------

class TestPageCopyDelete:
    def test_patch_then_delete_reverts_to_empty(self, admin):
        # PATCH title
        r = admin.patch(f"{BASE_URL}/api/admin/page-copy/home",
                        json={"title": "TEST_H1_iter29"})
        assert r.status_code == 200
        # GET should return the override
        r2 = admin.get(f"{BASE_URL}/api/page-copy/home")
        assert r2.status_code == 200
        assert r2.json().get("title") == "TEST_H1_iter29"
        # DELETE
        r3 = admin.delete(f"{BASE_URL}/api/admin/page-copy/home")
        assert r3.status_code == 200
        # GET should be empty
        r4 = admin.get(f"{BASE_URL}/api/page-copy/home")
        assert r4.status_code == 200
        assert r4.json() == {}, f"page-copy not fully removed: {r4.json()}"


# ---- CMS: product override pristine restore without restart ---------------

class TestProductOverridePristineRestore:
    PID = "personalised-hoodie"

    def test_override_and_revert_without_restart(self, admin):
        # override
        r = admin.patch(f"{BASE_URL}/api/admin/products/{self.PID}/override",
                        json={"price": 99.99})
        assert r.status_code == 200, r.text
        # public GET should reflect
        r2 = admin.get(f"{BASE_URL}/api/products/{self.PID}")
        assert r2.status_code == 200
        assert float(r2.json().get("price")) == 99.99, f"override not applied: {r2.json().get('price')}"
        # DELETE
        r3 = admin.delete(f"{BASE_URL}/api/admin/products/{self.PID}/override")
        assert r3.status_code == 200
        # immediate GET should be default 14.99 without restart
        r4 = admin.get(f"{BASE_URL}/api/products/{self.PID}")
        assert r4.status_code == 200
        price = float(r4.json().get("price"))
        assert price == 14.99, f"pristine restore failed — still {price}"


# ---- Resend integration on leavers/bespoke --------------------------------

class TestLeaversBespokeResend:
    def test_post_succeeds_even_without_key(self, api):
        # Public endpoint, no auth required
        payload = {
            "school": "TEST_School_iter29",
            "year_group": "Year 11",
            "contact_name": "T. Tester",
            "contact_email": "test-iter29@example.com",
            "contact_phone": "01234 567890",
            "estimated_qty": 20,
            "notes": "iter29 automated test — please ignore",
        }
        r = api.post(f"{BASE_URL}/api/leavers/bespoke", json=payload)
        assert r.status_code == 200, f"leavers/bespoke failed: {r.status_code} {r.text[:300]}"


# ---- Designer: remove-bg not-configured / bad input -----------------------

class TestRemoveBg:
    _TINY_PNG_B64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
                     "+A8AAQUBAScY42YAAAAASUVORK5CYII=")

    def test_missing_image_returns_400(self, api):
        r = api.post(f"{BASE_URL}/api/designer/remove-bg", json={})
        assert r.status_code == 400

    def test_invalid_base64_returns_400(self, api):
        r = api.post(f"{BASE_URL}/api/designer/remove-bg",
                     json={"image_base64": "!!!not-base64!!!"})
        assert r.status_code == 400

    def test_valid_image_returns_503_when_not_configured(self, api):
        r = api.post(f"{BASE_URL}/api/designer/remove-bg",
                     json={"image_base64": self._TINY_PNG_B64})
        assert r.status_code == 503, f"expected 503 not-configured, got {r.status_code} {r.text[:200]}"
        assert "not configured" in r.text.lower()


# ---- Designer: ai-effect not-configured / bad effect ----------------------

class TestAiEffect:
    _TINY_PNG_B64 = TestRemoveBg._TINY_PNG_B64

    def test_invalid_effect_returns_400(self, api):
        r = api.post(f"{BASE_URL}/api/designer/ai-effect",
                     json={"image_base64": self._TINY_PNG_B64, "effect": "banana"})
        assert r.status_code == 400

    def test_missing_image_returns_400(self, api):
        r = api.post(f"{BASE_URL}/api/designer/ai-effect", json={"effect": "cartoon"})
        assert r.status_code == 400

    def test_valid_returns_503_when_not_configured(self, api):
        r = api.post(f"{BASE_URL}/api/designer/ai-effect",
                     json={"image_base64": self._TINY_PNG_B64, "effect": "cartoon"})
        assert r.status_code == 503
        assert "not configured" in r.text.lower()


# ---- Admin: test-email --------------------------------------------------

class TestAdminTestEmail:
    def test_requires_admin_token(self, api):
        # unauth call — expect 401 or 403
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/admin/test-email", json={"to": "test-iter29@example.com"})
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_returns_ok_false_when_not_configured(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/test-email",
                       json={"to": "test-iter29@example.com"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is False
        assert "not configured" in (body.get("error") or "").lower()


# ---- Wired CMS on public pages: PATCH + revert ---------------------------

class TestPageCopyPatchRevertAllSlugs:
    @pytest.mark.parametrize("slug", PAGE_SLUGS)
    def test_patch_then_delete_each_slug(self, admin, slug):
        marker = f"TEST_TITLE_{slug}_iter29"
        r = admin.patch(f"{BASE_URL}/api/admin/page-copy/{slug}",
                        json={"title": marker})
        assert r.status_code == 200, f"patch {slug}: {r.text[:200]}"
        # public GET
        g = admin.get(f"{BASE_URL}/api/page-copy/{slug}")
        assert g.status_code == 200
        assert g.json().get("title") == marker
        # revert
        d = admin.delete(f"{BASE_URL}/api/admin/page-copy/{slug}")
        assert d.status_code == 200
        # verify empty
        g2 = admin.get(f"{BASE_URL}/api/page-copy/{slug}")
        assert g2.status_code == 200
        assert g2.json() == {}, f"{slug} not reverted: {g2.json()}"


# ---- Regression: configurator + team-schools pages render -----------------

class TestRegressionPublicPages:
    def test_full_squad_config(self, api):
        r = api.get(f"{BASE_URL}/api/full-squad/config")
        assert r.status_code == 200
        j = r.json()
        assert "sections" in j and "addons" in j

    def test_sports_outfit_config(self, api):
        r = api.get(f"{BASE_URL}/api/sports-outfit/config")
        assert r.status_code == 200

    def test_teams_schools_products(self, api):
        # /teams-schools uses /api/products or a dedicated endpoint;
        # verify the primary product listing still works
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
