"""Backend API tests for Your Own Print e-commerce site."""
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


# ---------- Root / Products ----------
class TestRootAndProducts:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert "Your Own Print" in data.get("message", "")

    def test_products_all(self, client):
        r = client.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        # 12 original + 8 sports & combat (iter 4)
        assert len(products) == 20
        ids = {p["id"]: p for p in products}
        # best sellers w/ specific prices
        assert ids["personalised-tee"]["price"] == 6.99
        assert ids["personalised-hoodie"]["price"] == 14.99
        assert ids["kids-tee"]["price"] == 7.99
        assert ids["polo-shirt"]["price"] == 8.99

    def test_products_workwear(self, client):
        r = client.get(f"{API}/products", params={"category": "workwear"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4
        assert all(p["category"] == "workwear" for p in data)

    def test_products_teams_schools(self, client):
        r = client.get(f"{API}/products", params={"category": "teams-schools"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4
        assert all(p["category"] == "teams-schools" for p in data)

    def test_single_product_ok(self, client):
        r = client.get(f"{API}/products/personalised-tee")
        assert r.status_code == 200
        p = r.json()
        assert p["id"] == "personalised-tee"
        assert p["price"] == 6.99
        assert p["name"] == "Personalised T-Shirt"

    def test_single_product_404(self, client):
        r = client.get(f"{API}/products/does-not-exist")
        assert r.status_code == 404


# ---------- Contact ----------
class TestContact:
    def test_contact_submit(self, client):
        payload = {
            "name": "TEST_John Smith",
            "email": "test_john@example.com",
            "phone": "07123456789",
            "company": "Acme Ltd",
            "message": "I'd like a quote for 50 hoodies.",
            "quantity": "50",
            "sector": "construction",
        }
        r = client.post(f"{API}/contact", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("id"), str) and len(data["id"]) > 0

    def test_contact_minimal(self, client):
        payload = {
            "name": "TEST_Jane",
            "email": "test_jane@example.com",
            "message": "Hi there",
        }
        r = client.post(f"{API}/contact", json=payload)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_contact_invalid_email(self, client):
        payload = {"name": "x", "email": "not-an-email", "message": "hi"}
        r = client.post(f"{API}/contact", json=payload)
        assert r.status_code == 422


# ---------- Theme selection ----------
class TestTheme:
    def test_theme_select(self, client):
        r = client.post(f"{API}/theme-selection", json={"theme_id": "theme-1", "note": "TEST"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("id"), str)


# ---------- Checkout ----------
class TestCheckout:
    def test_checkout_invalid_product(self, client):
        r = client.post(
            f"{API}/checkout/session",
            json={
                "product_id": "nonexistent-xyz",
                "quantity": 1,
                "size": "M",
                "origin_url": BASE_URL,
            },
        )
        assert r.status_code == 400

    def test_checkout_invalid_quantity(self, client):
        r = client.post(
            f"{API}/checkout/session",
            json={
                "product_id": "personalised-tee",
                "quantity": 0,
                "size": "M",
                "origin_url": BASE_URL,
            },
        )
        assert r.status_code == 400

    def test_checkout_valid(self, client):
        payload = {
            "product_id": "personalised-hoodie",
            "quantity": 2,
            "size": "L",
            "origin_url": BASE_URL,
            "design_meta": {"text": "TEST_text", "filter": "none"},
        }
        r = client.post(f"{API}/checkout/session", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("http")
        assert "session_id" in data and len(data["session_id"]) > 0

        # checkout status using same session id
        sid = data["session_id"]
        s = client.get(f"{API}/checkout/status/{sid}")
        assert s.status_code == 200, s.text
        sd = s.json()
        assert sd["session_id"] == sid
        assert "status" in sd
        assert "payment_status" in sd
        assert "currency" in sd
        assert isinstance(sd["amount_total"], (int, float))
