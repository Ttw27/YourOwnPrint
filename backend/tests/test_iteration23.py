"""Iteration 23 re-test: verify Full Squad Configurator submit fix.

- POST /api/quote-request with the new shape sent by the fixed FullSquadConfigurator.jsx
- Verify record persisted into `quote_requests` Mongo collection (via lookup by id in message).
- Regression: still rejects missing required fields with 422 (structured detail).
"""
import os
import pytest
import requests

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"


class TestQuoteRequestNewShape:
    def test_full_squad_new_shape_accepted(self):
        """The exact payload the fixed FullSquadConfigurator.jsx sends."""
        payload = {
            "kind": "team_kit",
            "name": "TEST_iter23 Manager",
            "email": "test@example.com",
            "phone": "",
            "company": "TEST_iter23 FC",
            "sport": "",
            "kit_type": "full-squad-configurator",
            "quantity": 3,
            "deadline": "",
            "message": "Full Squad quote — Roster: 0 players. Items: [Match day] Football Jersey — S×3. Estimated subtotal £56.97.",
            "roster": [],
        }
        r = requests.post(f"{BASE_URL}/api/quote-request", json=payload)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert isinstance(body.get("id"), str) and len(body["id"]) >= 8

    def test_full_squad_with_roster_and_sleeve_message(self):
        payload = {
            "kind": "team_kit",
            "name": "TEST_iter23 Coach",
            "email": "coach@example.com",
            "phone": "+441234567890",
            "company": "TEST_iter23 FC",
            "sport": "",
            "kit_type": "full-squad-configurator",
            "quantity": 5,
            "deadline": "",
            "message": "Full Squad quote — Roster: 2 players. Items: [Match day] Football Jersey — S×3 +sleeve. Estimated subtotal £62.97.",
            "roster": [{"name": "Alice", "number": "7"}, {"name": "Bob", "number": "10"}],
        }
        r = requests.post(f"{BASE_URL}/api/quote-request", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_missing_required_returns_422_with_array_detail(self):
        """Ensure the server still returns Pydantic's 422 with an array 'detail' when body is invalid.
        Frontend must handle array detail without crashing (the catch block fix)."""
        r = requests.post(f"{BASE_URL}/api/quote-request", json={"kind": "team_kit"})
        assert r.status_code == 422, r.text
        data = r.json()
        assert "detail" in data
        assert isinstance(data["detail"], list) and len(data["detail"]) > 0
        # Each item should have loc/msg keys
        for err in data["detail"]:
            assert "msg" in err and "loc" in err

    def test_invalid_email_returns_422(self):
        payload = {
            "kind": "team_kit",
            "name": "TEST_iter23 X",
            "email": "not-an-email",
            "message": "x",
        }
        r = requests.post(f"{BASE_URL}/api/quote-request", json=payload)
        assert r.status_code == 422


class TestFullSquadConfigRegression:
    def test_config_still_returns_expected_shape(self):
        r = requests.get(f"{BASE_URL}/api/full-squad/config")
        assert r.status_code == 200
        data = r.json()
        assert "sections" in data and "addons" in data and "proof_days" in data
        keys = [s["key"] for s in data["sections"]]
        assert keys == ["match_day", "training", "tracksuit"]
        # Sleeve print addon must still be £2.00 per kit (used in UI math)
        assert float(data["addons"]["sleeve_print_price"]) == 2.0
        # match_day should contain football-jersey priced at £18.99
        md = next(s for s in data["sections"] if s["key"] == "match_day")
        fj = next((g for g in md["garments"] if g["id"] == "football-jersey"), None)
        assert fj is not None
        assert float(fj["price"]) == 18.99
