"""Iteration 18 backend regression tests"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASS = "RDAzhFOX_ZyNSgcldy-gDA"


# -------- workforce products description regression --------
def test_workforce_products_have_description():
    r = requests.get(f"{BASE_URL}/api/workforce/products", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    products = data.get("products", data) if isinstance(data, dict) else data
    assert isinstance(products, list) and len(products) > 0
    for p in products:
        assert "description" in p, f"missing description on {p.get('id')}"
    # workwear-tshirt must have non-empty description
    tshirt = next((p for p in products if p.get("id") == "workwear-tshirt"), None)
    assert tshirt is not None, "workwear-tshirt not found"
    assert tshirt["description"] and len(tshirt["description"]) > 5


# -------- specials products regression --------
def test_specials_products_have_description():
    r = requests.get(f"{BASE_URL}/api/specials/products", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    products = data.get("products", data) if isinstance(data, dict) else data
    assert isinstance(products, list) and len(products) > 0
    for p in products:
        assert "description" in p


# -------- personalised-tee product marked specials_eligible --------
def test_personalised_tee_is_specials_eligible():
    r = requests.get(f"{BASE_URL}/api/products/personalised-tee", timeout=30)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("specials_eligible") is True, f"specials_eligible not true: {p.get('specials_eligible')}"


def test_non_specials_hoodie_exists():
    # school-hoodie / leavers-* are not specials-eligible
    r = requests.get(f"{BASE_URL}/api/products/school-hoodie", timeout=30)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("specials_eligible") is not True, "school-hoodie unexpectedly marked specials_eligible"


# -------- admin login regression --------
def test_admin_login():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok
    me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert me.status_code == 200
    assert me.json().get("role") == "admin"


# -------- admin integrations endpoint --------
def test_admin_integrations_get():
    tok = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30).json()["token"]
    r = requests.get(f"{BASE_URL}/api/admin/integrations", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert r.status_code == 200, r.text


# -------- public smoke pages via nav data --------
def test_navigation_endpoint():
    r = requests.get(f"{BASE_URL}/api/navigation", timeout=30)
    assert r.status_code == 200
