"""
Iteration 14 — Phase 2: JWT admin auth, Allowed Print Placements, Customer Q&A.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://branded-workwear-lab.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"

ALLOWED_7 = {"left-breast", "right-breast", "full-front", "back-print",
             "left-sleeve", "right-sleeve", "neck-label"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "token" in body and body["user"]["role"] == "admin"
    return body["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Auth: login / me ----------
class TestAuth:
    def test_login_valid(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                          timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("token"), str) and len(data["token"]) > 10
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"

    def test_login_invalid_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrongPASS_xx"},
                          timeout=20)
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "nobody@example.com", "password": "whatever"},
                          timeout=20)
        assert r.status_code == 401

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"

    def test_me_with_invalid_token(self):
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": "Bearer not.a.realtoken"}, timeout=20)
        assert r.status_code == 401


# ---------- Auth gates on protected routes ----------
class TestAuthGates:
    @pytest.mark.parametrize("method,path", [
        ("GET", "/admin/products"),
        ("GET", "/admin/designer-products"),
        ("GET", "/admin/qa"),
        ("PATCH", "/admin/products/workwear-jacket/meta"),
        ("PATCH", "/admin/designer-products/personalised-tee"),
        ("PATCH", "/admin/bulk-tiers/defaults"),
        ("POST", "/admin/qa/anyid/answer"),
        ("DELETE", "/admin/qa/anyid"),
        ("POST", "/team-kit-brands"),
        ("PUT", "/team-kit-brands/xyz"),
        ("DELETE", "/team-kit-brands/xyz"),
        ("POST", "/reviews/import-judgeme"),
    ])
    def test_protected_unauth_returns_401(self, method, path):
        r = requests.request(method, f"{API}{path}", json={}, timeout=20)
        # 401 expected; some FastAPI versions may produce 403, but we expect 401 here.
        assert r.status_code == 401, f"{method} {path} → {r.status_code} {r.text[:200]}"

    def test_admin_products_with_token(self, admin_headers):
        r = requests.get(f"{API}/admin/products", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        sample = data[0]
        assert "allowed_placements" in sample
        # default fallback should be 7 placements
        assert set(sample["allowed_placements"]) <= ALLOWED_7 | {"front-print"}  # tolerate legacy if any
        assert len(sample["allowed_placements"]) >= 1

    def test_admin_qa_with_token(self, admin_headers):
        r = requests.get(f"{API}/admin/qa", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Public unaffected endpoints (regression) ----------
class TestPublicRegression:
    def test_products_list_public(self):
        r = requests.get(f"{API}/products", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_placements_public(self):
        r = requests.get(f"{API}/placements", timeout=20)
        assert r.status_code == 200


# ---------- Allowed Print Placements ----------
class TestAllowedPlacements:
    PID = "workwear-jacket"

    def test_default_all_7(self, admin_headers):
        # Reset to None first by setting to all 7
        requests.patch(f"{API}/admin/products/{self.PID}/meta",
                       headers=admin_headers,
                       json={"allowed_placements": list(ALLOWED_7)}, timeout=20)
        r = requests.get(f"{API}/products/{self.PID}/allowed-placements", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert set(data["allowed_placements"]) == ALLOWED_7

    def test_reject_invalid_front_back(self, admin_headers):
        r = requests.patch(f"{API}/admin/products/{self.PID}/meta",
                           headers=admin_headers,
                           json={"allowed_placements": ["front", "back"]}, timeout=20)
        assert r.status_code == 400

    def test_reject_front_print(self, admin_headers):
        # 'front-print' is NOT in the 7 — should be rejected
        r = requests.patch(f"{API}/admin/products/{self.PID}/meta",
                           headers=admin_headers,
                           json={"allowed_placements": ["front-print", "back-print"]}, timeout=20)
        assert r.status_code == 400, r.text

    def test_subset_persists(self, admin_headers):
        subset = ["left-breast", "back-print"]
        r = requests.patch(f"{API}/admin/products/{self.PID}/meta",
                           headers=admin_headers,
                           json={"allowed_placements": subset}, timeout=20)
        assert r.status_code == 200, r.text
        # Verify persists
        r2 = requests.get(f"{API}/products/{self.PID}/allowed-placements", timeout=20)
        assert r2.status_code == 200
        assert set(r2.json()["allowed_placements"]) == set(subset)
        # restore to all 7
        requests.patch(f"{API}/admin/products/{self.PID}/meta",
                       headers=admin_headers,
                       json={"allowed_placements": list(ALLOWED_7)}, timeout=20)

    def test_get_unknown_product(self):
        r = requests.get(f"{API}/products/unknown-xyz/allowed-placements", timeout=20)
        assert r.status_code == 404


# ---------- Customer Q&A ----------
class TestQA:
    PID = "personalised-tee"
    created_ids = []

    def test_create_question(self):
        r = requests.post(f"{API}/qa",
                          json={"product_id": self.PID,
                                "question": "TEST_Q14 Is the print waterproof?",
                                "asker_name": "TEST_User"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert data["question"] == "TEST_Q14 Is the print waterproof?"
        assert data["product_id"] == self.PID
        assert data["answer"] is None
        TestQA.created_ids.append(data["id"])

    def test_list_qa_shows_question(self):
        r = requests.get(f"{API}/qa/{self.PID}", timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert any(q["id"] == TestQA.created_ids[0] for q in items)
        # newest first — first item is most recent
        assert items[0]["asked_at"] >= items[-1]["asked_at"]

    def test_short_question_rejected(self):
        r = requests.post(f"{API}/qa",
                          json={"product_id": self.PID, "question": "Hi", "asker_name": "x"},
                          timeout=20)
        assert r.status_code == 400

    def test_unknown_product_rejected(self):
        r = requests.post(f"{API}/qa",
                          json={"product_id": "ghost-product", "question": "Real question here",
                                "asker_name": "x"}, timeout=20)
        assert r.status_code == 400

    def test_admin_answer_persists(self, admin_headers):
        qa_id = TestQA.created_ids[0]
        r = requests.post(f"{API}/admin/qa/{qa_id}/answer",
                          headers=admin_headers,
                          json={"answer": "TEST_A14 Yes — DTF prints are wash-fast."}, timeout=20)
        assert r.status_code == 200
        # Verify via public GET
        r2 = requests.get(f"{API}/qa/{TestQA.PID}", timeout=20)
        found = next((q for q in r2.json() if q["id"] == qa_id), None)
        assert found and found["answer"] == "TEST_A14 Yes — DTF prints are wash-fast."
        assert found["answered_at"] is not None

    def test_admin_qa_listing_unanswered_first(self, admin_headers):
        # Create one fresh unanswered question
        r = requests.post(f"{API}/qa",
                          json={"product_id": TestQA.PID, "question": "TEST_Q14b Second question?",
                                "asker_name": "TEST_User2"}, timeout=20)
        assert r.status_code == 200
        new_id = r.json()["id"]
        TestQA.created_ids.append(new_id)

        r2 = requests.get(f"{API}/admin/qa", headers=admin_headers, timeout=20)
        assert r2.status_code == 200
        items = r2.json()
        # Find the index of unanswered (new_id) vs answered (created_ids[0])
        idx_unanswered = next((i for i, q in enumerate(items) if q["id"] == new_id), None)
        idx_answered = next((i for i, q in enumerate(items) if q["id"] == TestQA.created_ids[0]), None)
        assert idx_unanswered is not None and idx_answered is not None
        assert idx_unanswered < idx_answered, "unanswered should appear before answered"

    def test_admin_delete(self, admin_headers):
        for qa_id in TestQA.created_ids:
            r = requests.delete(f"{API}/admin/qa/{qa_id}", headers=admin_headers, timeout=20)
            assert r.status_code in (200, 204)
        # Verify gone
        r2 = requests.get(f"{API}/qa/{TestQA.PID}", timeout=20)
        items = r2.json()
        assert not any(q["id"] in TestQA.created_ids for q in items)
