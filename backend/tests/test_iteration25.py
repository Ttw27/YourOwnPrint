"""Iteration 25 backend tests.

Focus:
1. GET /api/full-squad/config
   - All 3 sections have requires_per_player_roster == True
   - Only match_day has supports_names_numbers == True
   - addons.gym_bag_addon_price == 4.00
2. POST /api/quote-request for kit_type='full-squad-configurator' with gym-bag rider
3. POST /api/quote-request for kit_type='sports-outfit-configurator' with split top/bottom sizes structure
4. Cleanup TEST_iter25 rows
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Full Squad config ----
class TestFullSquadConfig:
    def test_get_config_shape(self, api):
        r = api.get(f"{BASE_URL}/api/full-squad/config", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "sections" in data
        assert "addons" in data
        sections = {s["key"]: s for s in data["sections"]}
        for key in ("match_day", "training", "tracksuit"):
            assert key in sections, f"missing section {key}"
            assert sections[key].get("requires_per_player_roster") is True, f"{key} should be roster"

    def test_supports_names_numbers_only_on_match_day(self, api):
        r = api.get(f"{BASE_URL}/api/full-squad/config", timeout=15)
        sections = {s["key"]: s for s in r.json()["sections"]}
        assert sections["match_day"].get("supports_names_numbers") is True
        assert sections["training"].get("supports_names_numbers") is False
        assert sections["tracksuit"].get("supports_names_numbers") is False

    def test_gym_bag_addon_price_present(self, api):
        r = api.get(f"{BASE_URL}/api/full-squad/config", timeout=15)
        addons = r.json().get("addons", {})
        assert "gym_bag_addon_price" in addons
        assert float(addons["gym_bag_addon_price"]) == 4.00

    def test_included_items(self, api):
        r = api.get(f"{BASE_URL}/api/full-squad/config", timeout=15)
        sections = {s["key"]: s for s in r.json()["sections"]}
        md_items = [i.lower() for i in sections["match_day"].get("included_items", [])]
        tr_items = [i.lower() for i in sections["training"].get("included_items", [])]
        ts_items = [i.lower() for i in sections["tracksuit"].get("included_items", [])]
        assert any("sock" in i for i in md_items), "match_day should include socks"
        assert any("sock" in i for i in tr_items), "training should include socks"
        assert not any("sock" in i for i in ts_items), "tracksuit should NOT include socks"


# ---- Quote submission for iter25 flows ----
class TestQuoteRequestIter25:
    def test_full_squad_submit_with_gym_bag(self, api):
        payload = {
            "kind": "team_kit",
            "name": "TEST_iter25 Tester",
            "email": "TEST_iter25_fsc@example.com",
            "phone": "07000000000",
            "company": "TEST_iter25_FSC",
            "kit_type": "full-squad-configurator",
            "quantity": 2,
            "message": (
                "TEST_iter25 Full Squad Configurator quote — estimated subtotal £77.98.\n"
                "[Match Day set] Standard Match Day Set — colour: Navy — 2 kits @ £34.99\n"
                "  · +Printed gym bag with badge & player name: 2 × £4.00"
            ),
            "roster": [
                {"set": "Match Day set", "name": "TEST_iter25 P1", "number": "7", "top": "M", "bottom": "M", "sock": "6\u20138"},
                {"set": "Match Day set", "name": "TEST_iter25 P2", "number": "8", "top": "L", "bottom": "L", "sock": "9\u201311"},
            ],
        }
        r = api.post(f"{BASE_URL}/api/quote-request", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("id") or body.get("_id") or body.get("ok") or body.get("success"), body

    def test_sports_outfit_submit_split_sizes(self, api):
        payload = {
            "kind": "team_kit",
            "name": "TEST_iter25 SOC Tester",
            "email": "TEST_iter25_soc@example.com",
            "phone": "07000000001",
            "company": "TEST_iter25_SOC",
            "kit_type": "sports-outfit-configurator",
            "quantity": 2,
            "message": (
                "TEST_iter25 Sports Outfit Configurator quote — estimated subtotal £49.98.\n"
                "[Training] Standard — colour: Black — top S×2 / bottom L×1"
            ),
            "roster": [
                {"set": "Training", "top_size": "S", "top_qty": 2, "bottom_size": "L", "bottom_qty": 1},
            ],
        }
        r = api.post(f"{BASE_URL}/api/quote-request", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text


# ---- Cleanup ----
@pytest.fixture(scope="session", autouse=True)
def cleanup_iter25():
    yield
    try:
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if mongo_url and db_name:
            client = MongoClient(mongo_url)
            db = client[db_name]
            res = db.quote_requests.delete_many({
                "$or": [
                    {"company": {"$regex": "TEST_iter25"}},
                    {"name": {"$regex": "TEST_iter25"}},
                    {"email": {"$regex": "TEST_iter25"}},
                    {"message": {"$regex": "TEST_iter25"}},
                ]
            })
            print(f"[cleanup] Deleted {res.deleted_count} TEST_iter25 quote_requests")
            client.close()
    except Exception as e:
        print(f"[cleanup] error: {e}")
