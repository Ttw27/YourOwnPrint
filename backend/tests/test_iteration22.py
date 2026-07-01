"""Iteration 22 tests: Full Squad Configurator + Bundle variants + team-kit-brands CRUD."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Full Squad config endpoint ---
class TestFullSquadConfig:
    def test_full_squad_config_shape(self):
        r = requests.get(f"{BASE_URL}/api/full-squad/config")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "sections" in data and "addons" in data and "proof_days" in data
        assert data["proof_days"] == 2
        keys = [s["key"] for s in data["sections"]]
        assert keys == ["match_day", "training", "tracksuit"]
        for s in data["sections"]:
            assert "garments" in s and isinstance(s["garments"], list)
            assert "supports_names_numbers" in s
            for g in s["garments"]:
                assert "id" in g and "name" in g and "price" in g and "image" in g
                assert "sizes" in g
        addons = data["addons"]
        assert "sleeve_print_price" in addons
        assert "back_upload_print_price" in addons
        assert "back_name_and_number_price" in addons

    def test_match_day_supports_names_numbers_flag(self):
        r = requests.get(f"{BASE_URL}/api/full-squad/config")
        secs = {s["key"]: s for s in r.json()["sections"]}
        assert secs["match_day"]["supports_names_numbers"] is True
        assert secs["training"]["supports_names_numbers"] is False
        assert secs["tracksuit"]["supports_names_numbers"] is False

    def test_match_day_has_football_jersey(self):
        r = requests.get(f"{BASE_URL}/api/full-squad/config")
        secs = {s["key"]: s for s in r.json()["sections"]}
        ids = [g["id"] for g in secs["match_day"]["garments"]]
        assert "football-jersey" in ids


# --- team-kit-brands (public list + admin CRUD) ---
class TestTeamKitBrands:
    def test_list_without_filter(self):
        r = requests.get(f"{BASE_URL}/api/team-kit-brands")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_with_product_id_filter(self):
        r = requests.get(f"{BASE_URL}/api/team-kit-brands", params={"product_id": "football-kit-bundle"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_crud(self, auth_headers):
        payload = {
            "product_id": "sports-team-bundle",
            "brand": "AWD",
            "name": "TEST_iter22 Just Cool Kit",
            "price": 24.99,
            "image": "",
            "description": "TEST iter22",
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/team-kit-brands", json=payload, headers=auth_headers)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        vid = created["id"]
        assert created["product_id"] == "sports-team-bundle"
        assert created["name"] == "TEST_iter22 Just Cool Kit"

        # Update
        payload_upd = {**payload, "name": "TEST_iter22 Just Cool Kit UPDATED", "price": 29.99}
        r2 = requests.put(f"{BASE_URL}/api/team-kit-brands/{vid}", json=payload_upd, headers=auth_headers)
        assert r2.status_code == 200, r2.text

        # Verify via GET list
        r3 = requests.get(f"{BASE_URL}/api/team-kit-brands", params={"product_id": "sports-team-bundle"})
        assert r3.status_code == 200
        matches = [b for b in r3.json() if b["id"] == vid]
        assert len(matches) == 1
        assert matches[0]["name"] == "TEST_iter22 Just Cool Kit UPDATED"
        assert float(matches[0]["price"]) == 29.99

        # Delete
        r4 = requests.delete(f"{BASE_URL}/api/team-kit-brands/{vid}", headers=auth_headers)
        assert r4.status_code == 200, r4.text

        # Verify deletion
        r5 = requests.get(f"{BASE_URL}/api/team-kit-brands", params={"product_id": "sports-team-bundle"})
        matches = [b for b in r5.json() if b["id"] == vid]
        assert len(matches) == 0

    def test_admin_rejects_invalid_product_id(self, auth_headers):
        payload = {
            "product_id": "not-a-real-product",
            "brand": "AWD", "name": "TEST_iter22 bad", "price": 10.0, "image": "", "description": "", "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/team-kit-brands", json=payload, headers=auth_headers)
        assert r.status_code in (400, 422), f"Expected 400/422, got {r.status_code} {r.text}"

    def test_admin_unauthenticated_rejected(self):
        payload = {"product_id": "sports-team-bundle", "brand": "X", "name": "X", "price": 10.0, "image": "", "description": "", "active": True}
        r = requests.post(f"{BASE_URL}/api/team-kit-brands", json=payload)
        assert r.status_code in (401, 403)


# --- Quote request (used by Full Squad submit) ---
class TestQuoteRequest:
    def test_submit_quote_frontend_shape(self):
        """FullSquadConfigurator.jsx submits with team_name/contact_email/flow/message. Confirm backend accepts."""
        payload = {
            "flow": "full-squad-configurator",
            "team_name": "TEST_iter22 FC",
            "contact_name": "Test Manager",
            "contact_email": "test@example.com",
            "contact_phone": "+441234567890",
            "message": "Full Squad quote — Roster: 3 players. Items: [Match Day set] Jersey — S×3. Estimated £56.97.",
        }
        r = requests.post(f"{BASE_URL}/api/quote-request", json=payload)
        # This will fail with 422 because backend requires 'kind' and 'name' + 'email'
        assert r.status_code == 200, f"Frontend-shape submit failed with {r.status_code}: {r.text}"

    def test_submit_quote_backend_shape(self):
        """Test backend accepts the required-shape payload."""
        payload = {
            "kind": "team_kit",
            "name": "TEST_iter22 Manager",
            "email": "test@example.com",
            "message": "Full squad quote test",
        }
        r = requests.post(f"{BASE_URL}/api/quote-request", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True


# --- Admin bundle-variants (new endpoints) ---
class TestBundleVariants:
    def test_admin_list_returns_shape(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/bundle-variants", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "eligible_bundles" in data and "variants" in data
        assert isinstance(data["eligible_bundles"], list)

    def test_admin_create_rejects_invalid_bundle_id(self, auth_headers):
        payload = {"bundle_product_id": "not-a-bundle", "brand": "X", "name": "X", "price": 10.0}
        r = requests.post(f"{BASE_URL}/api/admin/bundle-variants", json=payload, headers=auth_headers)
        assert r.status_code in (400, 422), r.text
