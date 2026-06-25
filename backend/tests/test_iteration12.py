"""Iteration 12 backend tests — bulk tiers, sports/leavers products, group orders."""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ORIGIN = "https://example.com"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------------- Bulk tier endpoints ----------------

def test_bulk_tiers_fight_night(s):
    r = s.get(f"{API}/bulk-tiers/fight-night")
    assert r.status_code == 200
    data = r.json()
    assert data["base_price"] == 11.99
    assert data["tiers"] == [
        {"min_qty": 25, "unit_price": 9.99},
        {"min_qty": 10, "unit_price": 10.99},
    ]


def test_bulk_tiers_leavers(s):
    r = s.get(f"{API}/bulk-tiers/leavers")
    assert r.status_code == 200
    data = r.json()
    assert data["bag_price"] == 3.99
    # 4 tiers, descending threshold
    assert len(data["tiers"]) == 4
    thresholds = [t["min_qty"] for t in data["tiers"]]
    assert thresholds == [100, 60, 30, 20]
    prices = [t["unit_price"] for t in data["tiers"]]
    assert prices == [15.99, 16.99, 17.99, 19.99]


def test_leavers_products_list(s):
    r = s.get(f"{API}/leavers/products")
    assert r.status_code == 200
    items = r.json()
    ids = sorted(p["id"] for p in items)
    assert ids == sorted([
        "leavers-pullover-hoodie",
        "leavers-zip-hoodie",
        "varsity-jacket",
        "leavers-sweatshirt",
        "leavers-drawstring-bag",
    ])
    assert len(items) == 5


# ---------------- Checkout bulk pricing helpers ----------------

def _checkout(s, product_id, size_qtys, placements=None):
    payload = {
        "product_id": product_id,
        "size_qtys": size_qtys,
        "color": "Black",
        "placements": placements or [],
        "origin_url": ORIGIN,
    }
    r = s.post(f"{API}/checkout/session", json=payload)
    return r


def _amount(s, session_id):
    r = s.get(f"{API}/checkout/status/{session_id}")
    assert r.status_code == 200, r.text
    return r.json()["amount_total"]


# ---------------- Fight Night bulk pricing ----------------

@pytest.mark.parametrize("qty,expected", [
    (9, round(9 * 11.99, 2)),       # 107.91
    (10, round(10 * 10.99, 2)),     # 109.90
    (25, round(25 * 9.99, 2)),      # 249.75
    (50, round(50 * 9.99, 2)),      # 499.50
])
def test_fight_night_bulk_tiers(s, qty, expected):
    r = _checkout(s, "boxing-fight-tee", {"M": qty}, placements=[])
    assert r.status_code == 200, r.text
    got = _amount(s, r.json()["session_id"])
    assert got == expected, f"qty={qty} expected {expected} got {got}"


# ---------------- Leavers bulk pricing ----------------

@pytest.mark.parametrize("qty,expected", [
    (19, round(19 * 24.99, 2)),    # 474.81 — no tier
    (20, round(20 * 19.99, 2)),    # 399.80
    (30, round(30 * 17.99, 2)),    # 539.70
    (60, round(60 * 16.99, 2)),    # 1019.40
    (100, round(100 * 15.99, 2)),  # 1599.00
])
def test_leavers_bulk_tiers(s, qty, expected):
    r = _checkout(s, "leavers-pullover-hoodie", {"M": qty}, placements=[])
    assert r.status_code == 200, r.text
    got = _amount(s, r.json()["session_id"])
    assert got == expected, f"qty={qty} expected {expected} got {got}"


def test_leavers_with_drawstring_bag_addon(s):
    # 30 * (17.99 + 3.99) = 659.40
    r = _checkout(s, "leavers-pullover-hoodie", {"M": 30}, placements=["drawstring-bag"])
    assert r.status_code == 200, r.text
    got = _amount(s, r.json()["session_id"])
    assert got == round(30 * (17.99 + 3.99), 2) == 659.40


def test_drawstring_bag_product_not_bulk_priced(s):
    # leavers-drawstring-bag price is £3.99 and should NOT use tier pricing
    r = _checkout(s, "leavers-drawstring-bag", {"One Size": 30}, placements=[])
    assert r.status_code == 200, r.text
    got = _amount(s, r.json()["session_id"])
    assert got == round(30 * 3.99, 2) == 119.70


# ---------------- Group orders ----------------

@pytest.fixture(scope="module")
def group_order(s):
    payload = {
        "school": "TEST_St Mary's",
        "year_group": "Year 11",
        "deadline": "2026-07-15",
        "contact_name": "TEST_Alex Rep",
        "contact_email": "test_rep@example.com",
        "product_id": "leavers-pullover-hoodie",
        "include_bag": True,
    }
    r = s.post(f"{API}/group-orders", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "manage_token" in data
    assert len(data["token"]) == 10
    assert len(data["manage_token"]) == 32
    return data


def test_group_order_create_non_leavers_rejected(s):
    payload = {
        "school": "TEST_X",
        "year_group": "Y11",
        "deadline": "2026-07-15",
        "contact_name": "TEST_Rep",
        "contact_email": "test@example.com",
        "product_id": "personalised-tee",
        "include_bag": False,
    }
    r = s.post(f"{API}/group-orders", json=payload)
    assert r.status_code == 400
    assert "Unknown leavers product" in r.text


def test_group_order_public_get(s, group_order):
    r = s.get(f"{API}/group-orders/{group_order['token']}")
    assert r.status_code == 200
    data = r.json()
    assert data["token"] == group_order["token"]
    assert data["school"] == "TEST_St Mary's"
    assert data["status"] == "open"
    assert data["roster_count"] == 0
    assert "manage_token" not in data  # public payload must NOT leak manage token
    assert "contact_email" not in data


def test_group_order_unknown_token_404(s):
    r = s.get(f"{API}/group-orders/zzzzzzzz99")
    assert r.status_code == 404


def test_group_order_join_three_members(s, group_order):
    token = group_order["token"]
    for name, sz in [("TEST_Anna", "M"), ("TEST_Ben", "L"), ("TEST_Cara", "S")]:
        r = s.post(f"{API}/group-orders/{token}/join", json={
            "name": name, "nickname": name.split("_")[-1][:3], "size": sz, "qty": 1,
        })
        assert r.status_code == 200, r.text
    r = s.get(f"{API}/group-orders/{token}")
    assert r.json()["roster_count"] == 3


def test_group_order_manage_with_correct_token(s, group_order):
    token = group_order["token"]
    mt = group_order["manage_token"]
    r = s.get(f"{API}/group-orders/{token}/manage/{mt}")
    assert r.status_code == 200
    data = r.json()
    assert len(data["roster"]) == 3
    assert data["contact_email"] == "test_rep@example.com"
    assert data["manage_token"] == mt


def test_group_order_manage_wrong_token_404(s, group_order):
    token = group_order["token"]
    r = s.get(f"{API}/group-orders/{token}/manage/{'0' * 32}")
    assert r.status_code == 404


def test_group_order_delete_member(s, group_order):
    token = group_order["token"]
    mt = group_order["manage_token"]
    r = s.get(f"{API}/group-orders/{token}/manage/{mt}")
    members = r.json()["roster"]
    member_id = members[0]["id"]
    r = s.delete(f"{API}/group-orders/{token}/manage/{mt}/members/{member_id}")
    assert r.status_code == 200
    r2 = s.get(f"{API}/group-orders/{token}/manage/{mt}")
    assert len(r2.json()["roster"]) == 2


def test_group_order_close_then_join_blocked(s, group_order):
    token = group_order["token"]
    mt = group_order["manage_token"]
    r = s.post(f"{API}/group-orders/{token}/manage/{mt}/close")
    assert r.status_code == 200

    pub = s.get(f"{API}/group-orders/{token}").json()
    assert pub["status"] == "closed"

    r = s.post(f"{API}/group-orders/{token}/join", json={
        "name": "TEST_Late", "size": "M", "qty": 1,
    })
    assert r.status_code == 400
    assert "closed" in r.text.lower()


# ---------------- Sports expansion ----------------

@pytest.mark.parametrize("pid,price", [
    ("basketball-vest", 19.99),
    ("cricket-polo", 21.99),
    ("hockey-shirt", 22.99),
    ("athletics-vest", 14.99),
    ("cycling-jersey", 32.99),
])
def test_new_sports_products_exist(s, pid, price):
    r = s.get(f"{API}/products/{pid}")
    assert r.status_code == 200
    data = r.json()
    assert data["price"] == price
    assert data["category"] == "team-kits"
