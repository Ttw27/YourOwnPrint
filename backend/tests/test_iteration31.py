"""Iteration 31 backend regression + new customer accounts tests.

Covers:
- REFACTOR REGRESSION — key endpoints still 200 after router extraction.
- SHARED PRICING HELPER — /checkout/session amount == /cart/price line_total.
- CUSTOMER AUTH — register, login, me, forgot-password, reset-password.
- CUSTOMER CART persistence + merge semantics.
- CUSTOMER ADDRESSES + DESIGNS CRUD + is_default swap.
- CUSTOMER ORDERS — reads payment_transactions via customer_email.
- SECURITY — cross-role token isolation.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"

# Fresh email each run to avoid cross-run pollution
_CUST_EMAIL = f"testauth1+{uuid.uuid4().hex[:6]}@example.com"
_CUST_PASSWORD = "strongpass1"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    yield client[os.environ.get("DB_NAME", "test_database")]
    # Cleanup at end
    db = client[os.environ.get("DB_NAME", "test_database")]
    db.customers.delete_many({"email": {"$regex": r"^testauth1\+"}})
    db.customer_carts.delete_many({})
    db.customer_addresses.delete_many({})
    db.customer_designs.delete_many({})
    db.customer_login_attempts.delete_many({"email": {"$regex": r"^testauth1\+"}})
    db.password_reset_tokens.delete_many({"email": {"$regex": r"^testauth1\+"}})
    client.close()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def customer_context(s, mongo):
    """Register a fresh customer and return {email, password, token, id}."""
    r = s.post(f"{API}/customer/register", json={
        "email": _CUST_EMAIL, "password": _CUST_PASSWORD, "name": "Test One"
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": _CUST_EMAIL, "password": _CUST_PASSWORD,
            "token": data["token"], "id": data["id"]}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _fresh(token=None):
    """Return a fresh Session with no persistent cookies.

    Cookie-based auth conflicts across tests when multiple customers register
    in the same shared requests.Session, so critical customer flows must use
    a fresh session with Bearer auth only.
    """
    sess = requests.Session()
    if token:
        sess.headers.update({"Authorization": f"Bearer {token}"})
    return sess


# ---------------------------------------------------------------------------
# 1) REFACTOR REGRESSION
# ---------------------------------------------------------------------------
class TestRefactorRegression:
    def test_products_list(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 40

    def test_full_squad_config(self, s):
        r = s.get(f"{API}/full-squad/config")
        assert r.status_code == 200
        data = r.json()
        assert "addons" in data

    def test_sports_outfit_config(self, s):
        r = s.get(f"{API}/sports-outfit/config")
        assert r.status_code == 200

    def test_page_copy_home(self, s):
        r = s.get(f"{API}/page-copy/home")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_admin_configurator_settings(self, s, admin_token):
        r = s.get(f"{API}/admin/configurator-settings", headers=_auth(admin_token))
        assert r.status_code == 200

    def test_admin_page_copy_patch_delete(self, s, admin_token):
        r = s.patch(f"{API}/admin/page-copy/home",
                    headers=_auth(admin_token), json={"hero_title": "TEST_hello"})
        assert r.status_code == 200
        # Re-fetch admin view (which returns the raw doc) — public /page-copy/home
        # may filter empty defaults. Just verify PATCH+DELETE cycle works.
        r_del = s.delete(f"{API}/admin/page-copy/home", headers=_auth(admin_token))
        assert r_del.status_code == 200

    def test_admin_full_squad_addons_merge(self, s, admin_token):
        r = s.patch(f"{API}/admin/full-squad/addons",
                    headers=_auth(admin_token), json={"sleeve_print_price": 3.5})
        assert r.status_code == 200

    def test_admin_sports_outfit_addons_merge(self, s, admin_token):
        r = s.patch(f"{API}/admin/sports-outfit/addons",
                    headers=_auth(admin_token), json={})
        assert r.status_code == 200

    def test_site_whatsapp(self, s):
        r = s.get(f"{API}/site/whatsapp")
        assert r.status_code == 200

    def test_leavers_bespoke(self, s):
        r = s.post(f"{API}/leavers/bespoke", json={
            "school": "TS", "year_group": "Year 11",
            "contact_name": "TEST_iter31", "contact_email": "iter31@example.com",
            "contact_phone": "07000000000", "estimated_qty": 30, "notes": "test"
        })
        assert r.status_code in (200, 201), r.text


# ---------------------------------------------------------------------------
# 2) SHARED PRICING HELPER
# ---------------------------------------------------------------------------
class TestSharedPricing:
    def test_single_vs_cart_price_identical(self, s):
        # single via /checkout/session
        r1 = s.post(f"{API}/checkout/session", json={
            "product_id": "personalised-tee",
            "size_qtys": {"M": 5},
            "blank": True,
            "origin_url": BASE_URL,
        })
        assert r1.status_code == 200, r1.text
        session_id = r1.json()["session_id"]
        # Get amount via checkout status
        r_status = s.get(f"{API}/checkout/status/{session_id}")
        assert r_status.status_code == 200
        # Poll a couple of times if amount not yet set
        amount = None
        for _ in range(3):
            body = r_status.json()
            amount = body.get("amount_total") or body.get("amount")
            if amount:
                break
            time.sleep(1)
            r_status = s.get(f"{API}/checkout/status/{session_id}")
        assert amount is not None, f"No amount in status: {r_status.json()}"

        # cart price
        r2 = s.post(f"{API}/cart/price", json={"items": [{
            "product_id": "personalised-tee",
            "size_qtys": {"M": 5},
            "blank": True,
        }], "origin_url": BASE_URL})
        assert r2.status_code == 200
        cart_line = r2.json()["items"][0]
        # amount_total is already in £ (see /checkout/status response builder)
        cart_line_total = round(cart_line["line_total"], 2)
        assert cart_line_total == round(float(amount), 2), (
            f"Mismatch: single={amount} vs cart={cart_line_total}")

    def test_bulk_tier_kicks_in(self, s):
        # personalised-hoodie has bulk tiers (verified iter30 at qty=200)
        r1 = s.post(f"{API}/cart/price", json={"items": [{
            "product_id": "personalised-hoodie", "size_qtys": {"M": 1}, "blank": True,
        }], "origin_url": BASE_URL})
        r2 = s.post(f"{API}/cart/price", json={"items": [{
            "product_id": "personalised-hoodie", "size_qtys": {"M": 200}, "blank": True,
        }], "origin_url": BASE_URL})
        assert r1.status_code == 200 and r2.status_code == 200
        unit1 = r1.json()["items"][0]["line_total"] / 1
        unit200 = r2.json()["items"][0]["line_total"] / 200
        assert unit200 < unit1, f"Bulk tier not applied: unit@1={unit1}, unit@200={unit200}"


# ---------------------------------------------------------------------------
# 3) CUSTOMER AUTH
# ---------------------------------------------------------------------------
class TestCustomerRegister:
    def test_register_success(self, customer_context):
        assert customer_context["token"]
        assert customer_context["email"] == _CUST_EMAIL

    def test_duplicate_register_409(self, s, customer_context):
        r = s.post(f"{API}/customer/register", json={
            "email": _CUST_EMAIL, "password": _CUST_PASSWORD, "name": "Dup"
        })
        assert r.status_code == 409

    def test_weak_password_rejected(self, s):
        r = s.post(f"{API}/customer/register", json={
            "email": f"weak+{uuid.uuid4().hex[:6]}@example.com",
            "password": "short", "name": "W"
        })
        assert r.status_code in (400, 422)

    def test_missing_email(self, s):
        r = s.post(f"{API}/customer/register", json={
            "password": _CUST_PASSWORD, "name": "M"
        })
        assert r.status_code == 422


class TestCustomerLogin:
    def test_login_ok(self, s, customer_context):
        r = s.post(f"{API}/customer/login", json={
            "email": _CUST_EMAIL, "password": _CUST_PASSWORD
        })
        assert r.status_code == 200
        assert "token" in r.json()

    def test_me_returns_customer(self, s, customer_context):
        r = s.get(f"{API}/customer/me", headers=_auth(customer_context["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == _CUST_EMAIL
        assert r.json()["role"] == "customer"

    def test_lockout_after_5_fails(self, s, mongo):
        # Fresh account to lock, so we don't mess with customer_context
        lock_email = f"lock+{uuid.uuid4().hex[:6]}@example.com"
        r = s.post(f"{API}/customer/register", json={
            "email": lock_email, "password": _CUST_PASSWORD, "name": "L"
        })
        assert r.status_code == 200
        # 5 wrong attempts — the 5th should still be 401 but sets lockout
        codes = []
        for _ in range(5):
            r = s.post(f"{API}/customer/login", json={
                "email": lock_email, "password": "wrongpass1"
            })
            codes.append(r.status_code)
        # The 6th attempt hits lockout
        r6 = s.post(f"{API}/customer/login", json={
            "email": lock_email, "password": "wrongpass1"
        })
        assert codes[:5] == [401, 401, 401, 401, 401], f"expected 5×401 got {codes}"
        assert r6.status_code == 423, f"expected 423 on 6th, got {r6.status_code} {r6.text}"
        # Cleanup
        mongo.customer_login_attempts.delete_one({"email": lock_email})
        mongo.customers.delete_one({"email": lock_email})


class TestPasswordReset:
    def test_forgot_password_always_200(self, s):
        r = s.post(f"{API}/customer/forgot-password", json={"email": _CUST_EMAIL})
        assert r.status_code == 200
        # And for unknown email, also 200
        r2 = s.post(f"{API}/customer/forgot-password", json={"email": "nobody@example.com"})
        assert r2.status_code == 200

    def test_reset_password_full_flow(self, s, mongo):
        # Register a dedicated account
        email = f"reset+{uuid.uuid4().hex[:6]}@example.com"
        r = s.post(f"{API}/customer/register", json={
            "email": email, "password": _CUST_PASSWORD, "name": "R"
        })
        assert r.status_code == 200
        s.post(f"{API}/customer/forgot-password", json={"email": email})
        tok_doc = mongo.password_reset_tokens.find_one({"email": email})
        assert tok_doc, "reset token was not created"
        new_pw = "newpass1234"
        r2 = s.post(f"{API}/customer/reset-password", json={
            "token": tok_doc["token"], "new_password": new_pw
        })
        assert r2.status_code == 200
        # Login with new password
        r3 = s.post(f"{API}/customer/login", json={
            "email": email, "password": new_pw
        })
        assert r3.status_code == 200
        # Reuse of token now fails
        r4 = s.post(f"{API}/customer/reset-password", json={
            "token": tok_doc["token"], "new_password": "another1234"
        })
        assert r4.status_code == 400
        # cleanup
        mongo.customers.delete_one({"email": email})
        mongo.password_reset_tokens.delete_many({"email": email})


# ---------------------------------------------------------------------------
# 4) CART persistence + merge
# ---------------------------------------------------------------------------
class TestCustomerCart:
    def test_put_and_get_cart(self, customer_context):
        s = _fresh(customer_context["token"])
        r = s.put(f"{API}/customer/cart", json={"items": [{
            "product_id": "personalised-tee", "size_qtys": {"M": 2}
        }]})
        assert r.status_code == 200
        r2 = s.get(f"{API}/customer/cart")
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert len(items) == 1
        assert items[0]["size_qtys"] == {"M": 2}

    def test_merge_sums_sizes(self, customer_context):
        s = _fresh(customer_context["token"])
        r = s.post(f"{API}/customer/cart/merge", json={"items": [{
            "product_id": "personalised-tee", "size_qtys": {"M": 3, "L": 1}
        }]})
        assert r.status_code == 200
        merged = r.json()["items"]
        # Find the tee line
        tee = next((m for m in merged if m["product_id"] == "personalised-tee"), None)
        assert tee is not None
        assert tee["size_qtys"].get("M") == 5, f"M should be 2+3=5, got {tee['size_qtys']}"
        assert tee["size_qtys"].get("L") == 1


# ---------------------------------------------------------------------------
# 5) Addresses
# ---------------------------------------------------------------------------
class TestAddresses:
    def test_address_crud_and_default_swap(self, customer_context):
        s = _fresh(customer_context["token"])
        r = s.post(f"{API}/customer/addresses", json={
            "label": "Home", "line1": "1 High St", "city": "London",
            "postcode": "E1 6AA", "is_default": True
        })
        assert r.status_code == 200
        first_id = r.json()["id"]

        r2 = s.post(f"{API}/customer/addresses", json={
            "label": "Work", "line1": "2 Low St", "city": "London",
            "postcode": "E1 6BB", "is_default": True
        })
        assert r2.status_code == 200
        second_id = r2.json()["id"]

        r3 = s.get(f"{API}/customer/addresses")
        assert r3.status_code == 200
        addrs = r3.json()["addresses"]
        assert len(addrs) == 2
        defaults = [a for a in addrs if a["is_default"]]
        assert len(defaults) == 1, f"only one address should be default, got {defaults}"
        assert defaults[0]["id"] == second_id

        assert s.delete(f"{API}/customer/addresses/{first_id}").status_code == 200
        assert s.delete(f"{API}/customer/addresses/{second_id}").status_code == 200
        assert s.get(f"{API}/customer/addresses").json()["addresses"] == []


# ---------------------------------------------------------------------------
# 6) Designs
# ---------------------------------------------------------------------------
class TestDesigns:
    def test_design_crud(self, customer_context):
        s = _fresh(customer_context["token"])
        r = s.post(f"{API}/customer/designs", json={
            "name": "Test", "product_id": "personalised-tee",
            "canvas_json": {"shapes": []}
        })
        assert r.status_code == 200
        did = r.json()["id"]
        r2 = s.get(f"{API}/customer/designs")
        assert r2.status_code == 200
        assert any(d["id"] == did for d in r2.json()["designs"])
        assert s.delete(f"{API}/customer/designs/{did}").status_code == 200


# ---------------------------------------------------------------------------
# 7) Orders — first empty, then non-empty after cart-session with customer_email
# ---------------------------------------------------------------------------
class TestOrders:
    def test_orders_empty_initially(self, customer_context):
        s = _fresh(customer_context["token"])
        r = s.get(f"{API}/customer/orders")
        assert r.status_code == 200
        assert r.json()["orders"] == []

    def test_orders_populated_after_checkout(self, customer_context):
        anon = requests.Session()
        r = anon.post(f"{API}/checkout/cart-session", json={
            "items": [{"product_id": "personalised-tee", "size_qtys": {"M": 2}, "blank": True}],
            "origin_url": BASE_URL,
            "customer_email": customer_context["email"],
        })
        assert r.status_code == 200, r.text
        time.sleep(0.8)
        s = _fresh(customer_context["token"])
        r2 = s.get(f"{API}/customer/orders")
        assert r2.status_code == 200
        orders = r2.json()["orders"]
        assert len(orders) >= 1, f"expected ≥1 order, got {orders}"


# ---------------------------------------------------------------------------
# 8) Security — role isolation
# ---------------------------------------------------------------------------
class TestSecurityIsolation:
    def test_admin_token_rejected_by_customer_me(self, admin_token):
        s = _fresh(admin_token)
        r = s.get(f"{API}/customer/me")
        assert r.status_code == 401
        assert "customer" in r.text.lower()

    def test_customer_token_rejected_by_admin_products(self, customer_context):
        s = _fresh(customer_context["token"])
        r = s.get(f"{API}/admin/products")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_customer_cannot_read_others_cart(self, customer_context):
        # Create second customer via anonymous session so cookies don't collide
        anon = requests.Session()
        email2 = f"testauth1+{uuid.uuid4().hex[:6]}@example.com"
        r = anon.post(f"{API}/customer/register", json={
            "email": email2, "password": _CUST_PASSWORD, "name": "Two"
        })
        assert r.status_code == 200
        tok2 = r.json()["token"]
        # Customer2 puts a distinctive cart
        s2 = _fresh(tok2)
        s2.put(f"{API}/customer/cart",
               json={"items": [{"product_id": "personalised-hoodie", "size_qtys": {"L": 4}}]})
        # Customer1 reads their own cart — must NOT see customer 2's hoodie
        s1 = _fresh(customer_context["token"])
        r2 = s1.get(f"{API}/customer/cart")
        items = r2.json()["items"]
        assert not any(i.get("product_id") == "personalised-hoodie" and i.get("size_qtys", {}).get("L") == 4
                       for i in items), "cross-customer cart leak detected"
