"""
Iteration 28 — Foundational CMS backend tests.

Covers:
  * Page copy CMS (GET public, PATCH admin, slug allowlist)
  * Product overrides (PATCH/DELETE/GET on /api/admin/products/{pid}/override)
  * GET /api/admin/configurator-settings + PATCH /admin/full-squad/addons round-trip
  * Auth gating on all new admin endpoints
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ============================================================================
# Page copy CMS
# ============================================================================
class TestPageCopy:
    def test_get_page_copy_home_empty_returns_object(self, api):
        # Clear first via admin (fixture order requires admin_headers) — just check shape here
        r = api.get(f"{BASE_URL}/api/page-copy/home")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)

    def test_get_page_copy_unknown_slug_returns_404(self, api):
        r = api.get(f"{BASE_URL}/api/page-copy/not-a-real-page")
        assert r.status_code == 404

    def test_patch_page_copy_home_and_verify_persistence(self, api, admin_headers):
        payload = {
            "title": "TEST_iter28_home_title",
            "subtitle": "TEST_iter28_home_subtitle",
            "bullets": ["a", "b"],
            "faq": [{"q": "Q?", "a": "A."}],
        }
        r = requests.patch(f"{BASE_URL}/api/admin/page-copy/home",
                           headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        # Verify GET returns the same fields
        g = api.get(f"{BASE_URL}/api/page-copy/home")
        assert g.status_code == 200
        data = g.json()
        assert data.get("title") == "TEST_iter28_home_title"
        assert data.get("subtitle") == "TEST_iter28_home_subtitle"
        assert data.get("bullets") == ["a", "b"]
        assert data.get("faq") == [{"q": "Q?", "a": "A."}]

    def test_patch_page_copy_unknown_slug_returns_400(self, admin_headers):
        r = requests.patch(f"{BASE_URL}/api/admin/page-copy/not-a-real-page",
                           headers=admin_headers, json={"title": "x"})
        assert r.status_code == 400, r.text

    def test_patch_page_copy_requires_admin(self):
        # Use bare requests (no shared session/cookie) to prove auth gating.
        r = requests.patch(f"{BASE_URL}/api/admin/page-copy/home", json={"title": "nope"})
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_get_admin_page_copy_slugs_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/page-copy-slugs")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


# ============================================================================
# Product overrides
# ============================================================================
class TestProductOverrides:
    PID = "personalised-hoodie"

    def test_override_requires_admin(self):
        r = requests.patch(f"{BASE_URL}/api/admin/products/{self.PID}/override",
                           json={"name": "x"})
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_patch_product_override_and_verify_on_public_product(self, api, admin_headers):
        payload = {"name": "TEST_iter28_CustomName", "price": 19.99}
        r = requests.patch(f"{BASE_URL}/api/admin/products/{self.PID}/override",
                           headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text

        g = api.get(f"{BASE_URL}/api/products/{self.PID}")
        assert g.status_code == 200
        pd = g.json()
        assert pd.get("name") == "TEST_iter28_CustomName"
        assert float(pd.get("price")) == 19.99

    def test_delete_product_override_clears_it(self, api, admin_headers):
        d = requests.delete(f"{BASE_URL}/api/admin/products/{self.PID}/override",
                            headers=admin_headers)
        assert d.status_code == 200, d.text
        body = d.json()
        assert body.get("deleted") == 1 or body.get("deleted") is True

        # After delete + rehydrate the product should not have TEST_ name any more.
        # NOTE: server hydrates overrides on startup — delete removes DB row, but
        # may keep in-memory override until reload. We just verify the DB row is gone
        # via a follow-up GET on the admin override endpoint.
        g = requests.get(f"{BASE_URL}/api/admin/products/{self.PID}/override",
                         headers=admin_headers)
        assert g.status_code == 200
        assert g.json().get("override") in (None, {})

    def test_override_nonexistent_product_returns_404(self, admin_headers):
        r = requests.patch(f"{BASE_URL}/api/admin/products/definitely-not-a-real-product/override",
                           headers=admin_headers, json={"name": "x"})
        assert r.status_code == 404, r.text


# ============================================================================
# Configurator settings admin endpoint + full-squad addon round-trip
# ============================================================================
class TestConfiguratorSettings:
    def test_admin_get_configurator_settings_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/configurator-settings")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_admin_get_configurator_settings_returns_defaults(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/configurator-settings", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "full_squad" in data and "sports_outfit" in data
        fs = data["full_squad"]
        so = data["sports_outfit"]
        for k in ("sleeve_print_price", "back_upload_print_price",
                  "back_name_and_number_price", "gym_bag_addon_price"):
            assert k in fs, f"missing full_squad.{k}"
        for k in ("unbranded_price", "breast_print_price",
                  "back_print_price", "full_front_print_price"):
            assert k in so, f"missing sports_outfit.{k}"

    def test_patch_full_squad_addons_persists_to_config(self, api, admin_headers):
        # Snapshot original
        r0 = requests.get(f"{BASE_URL}/api/admin/configurator-settings", headers=admin_headers)
        original = r0.json()["full_squad"]["gym_bag_addon_price"]

        # Patch gym_bag_addon_price to 5.5 (per review requirements)
        r = requests.patch(f"{BASE_URL}/api/admin/full-squad/addons",
                           headers=admin_headers,
                           json={"values": {"gym_bag_addon_price": 5.5}})
        assert r.status_code == 200, r.text

        # Verify via public config — BUG: PATCH endpoint whitelist at server.py:3851
        # excludes 'gym_bag_addon_price'. Documented failure.
        g = api.get(f"{BASE_URL}/api/full-squad/config")
        assert g.status_code == 200
        addons = g.json().get("addons") or {}
        assert float(addons.get("gym_bag_addon_price")) == 5.5, (
            f"BUG: PATCH /admin/full-squad/addons whitelist at server.py:3851 does NOT "
            f"include 'gym_bag_addon_price' — got {addons.get('gym_bag_addon_price')}"
        )

        # Restore
        r2 = requests.patch(f"{BASE_URL}/api/admin/full-squad/addons",
                            headers=admin_headers,
                            json={"values": {"gym_bag_addon_price": float(original)}})
        assert r2.status_code == 200

    def test_patch_full_squad_addons_whitelisted_key_works(self, api, admin_headers):
        """Sanity check: a key in the PATCH whitelist DOES persist."""
        r0 = requests.get(f"{BASE_URL}/api/admin/configurator-settings", headers=admin_headers)
        original = r0.json()["full_squad"]["sleeve_print_price"]

        r = requests.patch(f"{BASE_URL}/api/admin/full-squad/addons",
                           headers=admin_headers,
                           json={"values": {"sleeve_print_price": 3.33}})
        assert r.status_code == 200

        g = api.get(f"{BASE_URL}/api/full-squad/config")
        addons = g.json().get("addons") or {}
        assert float(addons.get("sleeve_print_price")) == 3.33

        # Restore
        requests.patch(f"{BASE_URL}/api/admin/full-squad/addons",
                       headers=admin_headers,
                       json={"values": {"sleeve_print_price": float(original)}})


# ============================================================================
# Cleanup — remove any TEST_ overrides so we don't pollute Mongo
# ============================================================================
class TestZzzCleanup:
    """Cleans up page-copy overrides created during test run."""

    def test_cleanup_home_page_copy(self, admin_headers):
        r = requests.patch(f"{BASE_URL}/api/admin/page-copy/home",
                           headers=admin_headers,
                           json={"title": "", "subtitle": "", "body": "",
                                 "bullets": [], "faq": [], "cta_label": "", "cta_link": ""})
        assert r.status_code == 200

    def test_cleanup_teams_schools_page_copy(self, admin_headers):
        # Also clear teams-schools since the frontend tests will set it.
        r = requests.patch(f"{BASE_URL}/api/admin/page-copy/teams-schools",
                           headers=admin_headers,
                           json={"title": "", "subtitle": "", "body": "",
                                 "bullets": [], "faq": [], "cta_label": "", "cta_link": ""})
        assert r.status_code == 200
