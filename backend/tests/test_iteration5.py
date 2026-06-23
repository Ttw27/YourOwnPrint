"""Iteration 5 backend tests — team-kit bundles, checkout, and quote-request from new configurator."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

EXPECTED_BUNDLES = {
    "football-kit-bundle": 24.99,
    "football-premium-bundle": 29.99,
    "rugby-kit-bundle": 32.99,
    "training-pack-bundle": 17.99,
    "full-squad-pack": 54.99,
}

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAAAXRSTlPM0jRW/QAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII="


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Products ----
class TestTeamKitBundles:
    def test_category_returns_five_bundles(self, session):
        r = session.get(f"{BASE_URL}/api/products", params={"category": "team-kits"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5
        ids = {p["id"]: p for p in data}
        for pid, price in EXPECTED_BUNDLES.items():
            assert pid in ids, f"missing {pid}"
            assert ids[pid]["price"] == price

    def test_each_bundle_has_colors_sizes_upcharges(self, session):
        r = session.get(f"{BASE_URL}/api/products", params={"category": "team-kits"})
        kids_count = 0
        for p in r.json():
            assert isinstance(p.get("colors"), list) and len(p["colors"]) > 0
            assert isinstance(p.get("sizes"), list) and len(p["sizes"]) > 0
            assert isinstance(p.get("size_upcharges"), dict)
            if any(s.startswith("Y") or "-" in s for s in p["sizes"]):
                kids_count += 1
        # Player bundles include kids sizes (4/5). full-squad-pack is adult-only.
        assert kids_count >= 4, f"only {kids_count}/5 bundles have kids sizes"


# ---- Checkout regression ----
class TestTeamKitCheckout:
    def test_football_kit_bundle_checkout_total(self, session):
        payload = {
            "product_id": "football-kit-bundle",
            "size_qtys": {"M": 5, "L": 3},
            "color": "Custom (per team)",
            "placements": [],
            "blank": False,
            "origin_url": "https://example.com",
        }
        r = session.post(f"{BASE_URL}/api/checkout/session", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and "session_id" in body
        # Verify amount via transactions endpoint
        sid = body["session_id"]
        # 24.99 * 8 = 199.92
        # We don't have a public transactions endpoint typically; verify via status if available
        status = session.get(f"{BASE_URL}/api/checkout/status/{sid}")
        if status.status_code == 200:
            sdata = status.json()
            amt = sdata.get("amount_total") or sdata.get("amount")
            if amt is not None:
                # Stripe gives pence
                assert abs(amt / 100 - 199.92) < 0.01 or abs(amt - 199.92) < 0.01

    def test_premium_bundle_checkout_smoke(self, session):
        r = session.post(f"{BASE_URL}/api/checkout/session", json={
            "product_id": "football-premium-bundle",
            "size_qtys": {"M": 2},
            "color": "Custom (per team)",
            "placements": [],
            "blank": False,
            "origin_url": "https://example.com",
        })
        assert r.status_code == 200


# ---- Quote request from new configurator ----
class TestQuoteRequestFromConfigurator:
    def test_team_kit_quote_with_artwork_and_roster(self, session):
        payload = {
            "kind": "team_kit",
            "name": "TEST_Coach Smith",
            "email": "TEST_coach@example.com",
            "phone": "07000000000",
            "company": "TEST_FC",
            "sport": "football",
            "kit_type": "football-kit-bundle",
            "quantity": 18,
            "message": "Iteration 5 configurator test",
            "artwork": [TINY_PNG, TINY_PNG],  # badge + sponsor
            "roster": [
                {"team": "TEST_FC", "name": "Alice", "number": "9", "size": "M", "qty": 1},
                {"team": "TEST_FC", "name": "Bob", "number": "10", "size": "L", "qty": 1},
            ],
            "product_id": "football-kit-bundle",
        }
        r = session.post(f"{BASE_URL}/api/quote-request", json=payload)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("ok") is True or "id" in body or body.get("success")

    def test_team_kit_quote_multi_team_flat_roster(self, session):
        payload = {
            "kind": "team_kit",
            "name": "TEST_Coach Multi",
            "email": "TEST_multi@example.com",
            "company": "TEST_Club",
            "sport": "rugby",
            "kit_type": "rugby-kit-bundle",
            "quantity": 30,
            "message": "Multi team",
            "artwork": [TINY_PNG],
            "roster": [
                {"team": "1st XV", "name": "P1", "number": "1", "size": "L", "qty": 1},
                {"team": "2nd XV", "name": "P2", "number": "2", "size": "XL", "qty": 1},
            ],
            "product_id": "rugby-kit-bundle",
        }
        r = session.post(f"{BASE_URL}/api/quote-request", json=payload)
        assert r.status_code in (200, 201), r.text
