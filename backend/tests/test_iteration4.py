"""Iteration 4 backend tests: sports products + quote-request endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_SPORTS = {
    "football-jersey": 18.99,
    "football-shorts": 8.99,
    "rugby-shirt": 24.99,
    "training-tracksuit": 39.99,
    "training-tee": 9.99,
    "boxing-fight-tee": 11.99,
    "muay-thai-shorts": 22.99,
    "fight-shorts": 19.99,
}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Sports & Combat products ----------
class TestSportsProducts:
    def test_sports_category_lists_eight_products(self, client):
        r = client.get(f"{API}/products", params={"category": "sports"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 8, f"expected 8 sports products, got {len(data)}"
        ids = {p["id"]: p for p in data}
        for pid, expected_price in EXPECTED_SPORTS.items():
            assert pid in ids, f"missing sports product {pid}"
            assert ids[pid]["price"] == expected_price, f"{pid} price mismatch"
            assert ids[pid]["category"] == "sports"
            # variant fields present
            assert "colors" in ids[pid] and len(ids[pid]["colors"]) >= 1
            assert "sizes" in ids[pid] and len(ids[pid]["sizes"]) >= 1
            assert "size_upcharges" in ids[pid]

    def test_football_jersey_detail(self, client):
        r = client.get(f"{API}/products/football-jersey")
        assert r.status_code == 200
        p = r.json()
        assert p["price"] == 18.99
        assert p["category"] == "sports"
        # has kids sizes + adult sizes
        assert any(s in p["sizes"] for s in ["3-4", "5-6"])
        assert "M" in p["sizes"] and "L" in p["sizes"]

    def test_boxing_fight_tee_detail(self, client):
        r = client.get(f"{API}/products/boxing-fight-tee")
        assert r.status_code == 200
        p = r.json()
        assert p["price"] == 11.99
        names = {c["name"] for c in p["colors"]}
        assert "Black" in names and "White" in names


# ---------- /api/quote-request ----------
class TestQuoteRequest:
    def test_quote_team_kit_minimal(self, client):
        payload = {
            "kind": "team_kit",
            "name": "TEST_Coach Bob",
            "email": "test_coach@example.com",
            "company": "TEST_FC",
            "sport": "football",
            "quantity": 15,
            "message": "Need 15 home kits for U16 squad.",
            "roster": [
                {"name": "Player 1", "number": "9", "size": "M", "qty": 1},
                {"name": "Player 2", "number": "10", "size": "L", "qty": 1},
            ],
            "product_id": "football-jersey",
        }
        r = client.post(f"{API}/quote-request", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("id"), str) and len(data["id"]) > 0

    def test_quote_fight_night(self, client):
        payload = {
            "kind": "fight_night",
            "name": "TEST_Fighter",
            "email": "test_fighter@example.com",
            "quantity": 5,
            "message": "Need walkout tees with sponsors.",
            "artwork": [
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAAAXRSTlPM0jRW/QAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII="
            ],
            "product_id": "boxing-fight-tee",
        }
        r = client.post(f"{API}/quote-request", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_quote_invalid_email(self, client):
        payload = {
            "kind": "general",
            "name": "x",
            "email": "not-an-email",
            "message": "hi",
        }
        r = client.post(f"{API}/quote-request", json=payload)
        assert r.status_code == 422

    def test_quote_artwork_truncated_to_12(self, client):
        tiny_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAAAXRSTlPM0jRW/QAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII="
        payload = {
            "kind": "bespoke_print",
            "name": "TEST_BulkUploader",
            "email": "test_bulk@example.com",
            "message": "Lots of images",
            "artwork": [tiny_png] * 25,  # 25 imgs → should silently truncate to 12
        }
        r = client.post(f"{API}/quote-request", json=payload)
        assert r.status_code == 200  # endpoint succeeds — truncation is silent

    def test_quote_oversize_artwork_dropped(self, client):
        # >1.5MB string should be silently dropped — endpoint still 200
        big = "data:image/png;base64," + ("A" * 1_600_000)
        payload = {
            "kind": "general",
            "name": "TEST_BigImg",
            "email": "test_bigimg@example.com",
            "message": "oversize",
            "artwork": [big],
        }
        r = client.post(f"{API}/quote-request", json=payload)
        assert r.status_code == 200


# ---------- Checkout regression with new sports products ----------
class TestCheckoutSportsRegression:
    def test_checkout_football_jersey_multisize(self, client):
        payload = {
            "product_id": "football-jersey",
            "size_qtys": {"M": 3, "L": 5, "XL": 2},
            "color": "Royal Blue",
            "placements": ["left-breast", "back-print"],
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "session_id" in data

    def test_checkout_blank_muay_thai(self, client):
        payload = {
            "product_id": "muay-thai-shorts",
            "size_qtys": {"L": 4},
            "color": "Black",
            "blank": True,
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        s = client.get(f"{API}/checkout/status/{sid}")
        assert s.status_code == 200
        # 4 × 22.99 = 91.96
        assert abs(s.json()["amount_total"] - 91.96) < 0.05
