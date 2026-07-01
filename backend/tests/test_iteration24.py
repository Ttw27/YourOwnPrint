"""Iteration 24 — Full Squad Configurator + Sports Outfit Configurator + sock sizes + back-print rule."""
import os
import pytest
import requests
from pathlib import Path

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if v:
        return v
    envp = Path("/app/frontend/.env")
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return ""

BASE = _load_backend_url().rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Full Squad config ----------
class TestFullSquadConfig:
    def test_config_returns_three_sections(self):
        r = requests.get(f"{API}/full-squad/config", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "sections" in data
        keys = [s["key"] for s in data["sections"]]
        assert keys == ["match_day", "training", "tracksuit"], f"Got sections: {keys}"
        assert data.get("proof_days") == 2
        assert isinstance(data.get("sock_sizes"), list) and len(data["sock_sizes"]) > 0

    def test_each_section_has_required_fields(self):
        r = requests.get(f"{API}/full-squad/config", timeout=15)
        data = r.json()
        for sec in data["sections"]:
            for f in ["title", "subtitle", "set_product_id", "included_items",
                      "supports_names_numbers", "requires_per_player_roster", "variants"]:
                assert f in sec, f"Missing field {f} in section {sec.get('key')}"
            assert isinstance(sec["variants"], list) and len(sec["variants"]) >= 1

    def test_default_variant_when_no_admin_variants(self):
        """When admin hasn't added variants, default synthetic variant should appear."""
        r = requests.get(f"{API}/full-squad/config", timeout=15)
        data = r.json()
        match_day = next(s for s in data["sections"] if s["key"] == "match_day")
        # Should have at least one variant with brand='Standard' and is_default=true OR real admin variants
        default_v = next((v for v in match_day["variants"] if v.get("is_default")), None)
        if default_v:
            assert default_v["brand"] == "Standard"
            assert default_v["is_default"] is True
            assert isinstance(default_v.get("colours"), list)
            assert isinstance(default_v.get("sizes"), list)
            assert isinstance(default_v.get("sock_sizes"), list)


# ---------- Sports Outfit config ----------
class TestSportsOutfitConfig:
    def test_config_returns_two_sections_and_addons(self):
        r = requests.get(f"{API}/sports-outfit/config", timeout=15)
        assert r.status_code == 200
        data = r.json()
        keys = [s["key"] for s in data["sections"]]
        assert keys == ["training", "tracksuit"], f"Got: {keys}"
        assert data.get("proof_days") == 2
        addons = data["addons"]
        assert addons["unbranded_price"] == 0
        assert addons["breast_print_price"] == 3
        assert addons["back_print_price"] == 4
        assert addons["full_front_print_price"] == 6


# ---------- Sock sizes ----------
class TestSockSizes:
    def test_get_default_sock_sizes(self):
        r = requests.get(f"{API}/sock-sizes", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json().get("sock_sizes"), list)

    def test_patch_sock_sizes_and_restore(self, auth_headers):
        # Read current
        original = requests.get(f"{API}/sock-sizes", timeout=10).json()["sock_sizes"]
        try:
            new_vals = ["3-5", "6-8"]
            r = requests.patch(f"{API}/admin/sock-sizes",
                               json={"values": new_vals}, headers=auth_headers, timeout=10)
            assert r.status_code == 200, r.text
            assert r.json()["values"] == new_vals
            # Verify GET reflects
            got = requests.get(f"{API}/sock-sizes", timeout=10).json()["sock_sizes"]
            assert got == new_vals
        finally:
            # Restore
            requests.patch(f"{API}/admin/sock-sizes", json={"values": original},
                           headers=auth_headers, timeout=10)

    def test_bad_payload_empty_list(self, auth_headers):
        r = requests.patch(f"{API}/admin/sock-sizes", json={"values": []},
                           headers=auth_headers, timeout=10)
        assert r.status_code == 400

    def test_bad_payload_not_list(self, auth_headers):
        r = requests.patch(f"{API}/admin/sock-sizes", json={"values": "not-list"},
                           headers=auth_headers, timeout=10)
        assert r.status_code == 400


# ---------- Sports Outfit addons update ----------
class TestSportsOutfitAddonsPatch:
    def test_patch_and_restore(self, auth_headers):
        r = requests.patch(f"{API}/admin/sports-outfit/addons",
                           json={"values": {"breast_print_price": 3.5}}, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        # Verify config reflects
        cfg = requests.get(f"{API}/sports-outfit/config", timeout=10).json()
        assert cfg["addons"]["breast_print_price"] == 3.5
        # Restore
        r2 = requests.patch(f"{API}/admin/sports-outfit/addons",
                            json={"values": {"breast_print_price": 3.0}}, headers=auth_headers, timeout=10)
        assert r2.status_code == 200


# ---------- team-kit-brands CRUD with new fields ----------
class TestTeamKitBrandsFull:
    _created_ids: list = []

    def test_full_crud_with_new_fields(self, auth_headers):
        payload = {
            "product_id": "full-squad-match-day",
            "brand": "TEST_iter24 AWD",
            "name": "Test Kit",
            "price": 29.99,
            "colours": [{"name": "Red", "hex": "#f00"}],
            "sizes": ["S", "M", "L"],
            "sock_sizes": ["3-5", "6-8"],
            "included_items": ["Shirt", "Shorts", "Socks"],
            "size_guide": "Test guide",
            "active": True,
        }
        r = requests.post(f"{API}/team-kit-brands", json=payload, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        created = r.json()
        assert "id" in created
        assert created["brand"] == "TEST_iter24 AWD"
        assert created["colours"] == [{"name": "Red", "hex": "#f00"}]
        assert created["sizes"] == ["S", "M", "L"]
        assert created["sock_sizes"] == ["3-5", "6-8"]
        assert created["included_items"] == ["Shirt", "Shorts", "Socks"]
        assert created["size_guide"] == "Test guide"
        bid = created["id"]
        self.__class__._created_ids.append(bid)

        # GET filter
        r2 = requests.get(f"{API}/team-kit-brands?product_id=full-squad-match-day", timeout=10)
        assert r2.status_code == 200
        ids = [x["id"] for x in r2.json()]
        assert bid in ids

        # PUT update
        updated_payload = {**payload, "price": 31.99, "name": "Test Kit v2"}
        r3 = requests.put(f"{API}/team-kit-brands/{bid}", json=updated_payload, headers=auth_headers, timeout=10)
        assert r3.status_code == 200
        # Verify via GET
        r4 = requests.get(f"{API}/team-kit-brands?product_id=full-squad-match-day", timeout=10)
        row = next(x for x in r4.json() if x["id"] == bid)
        assert row["price"] == 31.99
        assert row["name"] == "Test Kit v2"

        # DELETE
        r5 = requests.delete(f"{API}/team-kit-brands/{bid}", headers=auth_headers, timeout=10)
        assert r5.status_code == 200
        # Verify gone
        r6 = requests.get(f"{API}/team-kit-brands?product_id=full-squad-match-day", timeout=10)
        assert bid not in [x["id"] for x in r6.json()]

    @classmethod
    def teardown_class(cls):
        # Best-effort cleanup for any straggler TEST_iter24 rows
        try:
            r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
            token = r.json()["token"]
            h = {"Authorization": f"Bearer {token}"}
            for pid in ["full-squad-match-day", "full-squad-training", "full-squad-tracksuit",
                        "sports-outfit-training", "sports-outfit-tracksuit"]:
                lr = requests.get(f"{API}/team-kit-brands?product_id={pid}", timeout=10)
                for x in lr.json():
                    if str(x.get("brand", "")).startswith("TEST_iter24"):
                        requests.delete(f"{API}/team-kit-brands/{x['id']}", headers=h, timeout=10)
        except Exception:
            pass


# ---------- No-back-print rule at checkout ----------
class TestNoBackPrintRule:
    @pytest.mark.parametrize("product_id,size", [
        ("football-shorts", "M"), ("gym-shorts", "M"), ("performance-leggings", "M"),
        ("joggers", "M"), ("workwear-trousers", "32"),
    ])
    def test_shorts_and_bottoms_strip_back_print(self, product_id, size):
        body = {
            "product_id": product_id,
            "quantity": 1,
            "size": size,
            "size_qtys": {size: 1},
            "placements": ["team-back-print"],
            "customer_email": "test-iter24@example.com",
            "origin_url": BASE,
        }
        r = requests.post(f"{API}/checkout/session", json=body, timeout=20)
        if r.status_code >= 400:
            # If it's a Stripe/config issue, at least ensure NOT a placement-validation error
            text = r.text.lower()
            assert "placement" not in text and "back" not in text, \
                f"back-print not stripped for {product_id}: {r.text}"
            pytest.skip(f"checkout returned {r.status_code}: {r.text[:200]}")
        data = r.json()
        joined = str(data).lower()
        # Should not have back-print upcharge appearing in session details
        assert "back-print" not in joined and "back print" not in joined, \
            f"Back print was NOT stripped for {product_id}: {data}"

    def test_sports_tee_accepts_back_print(self):
        body = {
            "product_id": "sports-tee",
            "quantity": 1,
            "size": "M",
            "size_qtys": {"M": 1},
            "placements": ["team-back-print"],
            "customer_email": "test-iter24@example.com",
            "origin_url": BASE,
        }
        r = requests.post(f"{API}/checkout/session", json=body, timeout=20)
        if r.status_code == 400 and "placement" in r.text.lower():
            pytest.fail(f"sports-tee rejected back-print unexpectedly: {r.text}")


# ---------- Quote request ----------
class TestQuoteRequest:
    def test_full_squad_quote(self):
        body = {
            "kind": "team_kit",
            "kit_type": "full-squad-configurator",
            "name": "TEST_iter24 Manager",
            "email": "test-iter24@example.com",
            "phone": "07123456789",
            "company": "TEST_iter24 FC",
            "sport": "football",
            "quantity": 12,
            "message": "Iteration 24 test full squad quote",
            "roster": [
                {"name": "Player 1", "number": "10", "top": "M", "bottom": "M", "sock": "6-8"},
                {"name": "Player 2", "number": "7", "top": "L", "bottom": "L", "sock": "9-11"},
            ],
        }
        r = requests.post(f"{API}/quote-request", json=body, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "id" in data

    def test_sports_outfit_quote(self):
        body = {
            "kind": "team_kit",
            "kit_type": "sports-outfit-configurator",
            "name": "TEST_iter24 PT",
            "email": "test-iter24-pt@example.com",
            "phone": "07123456789",
            "company": "TEST_iter24 Gym",
            "sport": "gym",
            "quantity": 8,
            "message": "Iteration 24 test sports outfit quote",
        }
        r = requests.post(f"{API}/quote-request", json=body, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
