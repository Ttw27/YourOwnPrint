"""Iteration 3 backend tests: placements, product variants, multi-size checkout."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /api/placements ----------
class TestPlacements:
    def test_placements_list(self, client):
        r = client.get(f"{API}/placements")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6
        by_id = {p["id"]: p for p in data}
        # exact expected values
        assert by_id["left-breast"]["price"] == 2.50
        assert by_id["left-breast"]["excludes"] == ["full-front"]
        assert by_id["right-breast"]["price"] == 2.50
        assert by_id["right-breast"]["excludes"] == ["full-front"]
        assert by_id["full-front"]["price"] == 3.50
        assert set(by_id["full-front"]["excludes"]) == {"left-breast", "right-breast"}
        assert by_id["back-print"]["price"] == 3.50
        assert by_id["back-print"]["excludes"] == []
        assert by_id["left-sleeve"]["price"] == 1.50
        assert by_id["left-sleeve"]["excludes"] == []
        assert by_id["right-sleeve"]["price"] == 1.50
        assert by_id["right-sleeve"]["excludes"] == []


# ---------- Product variants (colors / sizes / size_upcharges) ----------
class TestProductVariants:
    def test_polo_variants(self, client):
        r = client.get(f"{API}/products/polo-shirt")
        assert r.status_code == 200
        p = r.json()
        assert "colors" in p and len(p["colors"]) == 8
        assert "sizes" in p and len(p["sizes"]) == 8
        assert "3XL" in p["sizes"] and "4XL" in p["sizes"]
        assert p["size_upcharges"]["3XL"] == 1.50
        assert p["size_upcharges"]["4XL"] == 3.00

    def test_kids_tee_variants(self, client):
        r = client.get(f"{API}/products/kids-tee")
        assert r.status_code == 200
        p = r.json()
        assert "3-4" in p["sizes"]
        assert "5-6" in p["sizes"]
        assert "12-13" in p["sizes"]
        assert p["size_upcharges"] == {}

    def test_hivis_vest_variants(self, client):
        r = client.get(f"{API}/products/hi-vis-vest")
        assert r.status_code == 200
        p = r.json()
        assert len(p["colors"]) == 2
        names = {c["name"] for c in p["colors"]}
        assert "Hi-Vis Yellow" in names
        assert "Hi-Vis Orange" in names
        assert p["sizes"] == ["S/M", "L/XL", "XXL"]


# ---------- Checkout (new path) ----------
class TestCheckoutNewPath:
    def test_polo_multi_size_with_placements(self, client):
        payload = {
            "product_id": "polo-shirt",
            "size_qtys": {"M": 5, "L": 10, "3XL": 2},
            "color": "Navy",
            "placements": ["left-breast", "back-print"],
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("http")
        sid = data["session_id"]

        # Verify persistence via status endpoint (Stripe will reflect amount)
        s = client.get(f"{API}/checkout/status/{sid}")
        assert s.status_code == 200
        sd = s.json()
        assert sd["currency"] == "gbp"
        # Stripe returns total in same units (amount_total / 100 done by API)
        assert abs(sd["amount_total"] - 257.83) < 0.05, f"got amount={sd['amount_total']}"

    def test_exclusivity_rejected(self, client):
        payload = {
            "product_id": "polo-shirt",
            "size_qtys": {"M": 2},
            "placements": ["left-breast", "full-front"],
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "left-breast" in detail and "full-front" in detail

    def test_blank_ignores_placements(self, client):
        payload = {
            "product_id": "personalised-tee",
            "size_qtys": {"M": 10},
            "blank": True,
            "placements": ["back-print"],  # should be ignored
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        s = client.get(f"{API}/checkout/status/{sid}")
        assert s.status_code == 200
        # 10 × 6.99 = 69.90
        assert abs(s.json()["amount_total"] - 69.90) < 0.05

    def test_legacy_path_kids_tee(self, client):
        payload = {
            "product_id": "kids-tee",
            "size": "5-6",
            "quantity": 5,
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 200, r.text
        assert "url" in r.json()

    def test_unknown_size_rejected(self, client):
        payload = {
            "product_id": "polo-shirt",
            "size_qtys": {"10XL": 5},
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 400

    def test_zero_qty_rejected(self, client):
        payload = {
            "product_id": "polo-shirt",
            "size_qtys": {"M": 0},
            "origin_url": BASE_URL,
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 400
