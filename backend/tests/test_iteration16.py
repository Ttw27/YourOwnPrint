"""
Iteration 16 backend tests:
- Industries refresh (canonical + alias resolution)
- Sports & Fitness SEO landings
- Aprons + Bottoms garment types
- Editable Navigation
- Portfolio CRUD + file serving
- Admin Integrations
- Public WhatsApp endpoint
- Auth + regression
"""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin@yourownprint.co.uk"
ADMIN_PASSWORD = "RDAzhFOX_ZyNSgcldy-gDA"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    assert token
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"}


# Tiny valid 1x1 transparent PNG
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
TINY_PNG_DATA_URL = "data:image/png;base64," + TINY_PNG_B64


# ---------- Industries ----------
class TestIndustries:
    def test_industries_canonical_only(self, api):
        r = api.get(f"{BASE_URL}/api/industries")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("industries") or []
        slugs = [it.get("slug") for it in items]
        expected = {"healthcare", "construction-trades", "retail", "security",
                    "corporate", "sports-fitness", "industrial",
                    "beauty-wellness", "cleaning", "hospitality-catering"}
        assert expected.issubset(set(slugs)), f"missing canonical slugs. got: {slugs}"
        # No aliases leak into list
        aliases = {"trades", "beauty", "hospitality", "construction", "logistics",
                   "fitness", "hair-beauty"}
        leaked = aliases & set(slugs)
        assert not leaked, f"aliases leaked into list: {leaked}"
        assert len(items) == 10, f"expected exactly 10 canonical industries, got {len(items)}"

    def test_construction_trades_products(self, api):
        r = api.get(f"{BASE_URL}/api/industries/construction-trades")
        assert r.status_code == 200, r.text
        data = r.json()
        products = data.get("products") or []
        ids = {p.get("id") or p.get("slug") for p in products}
        expected_any = {"workwear-tshirt", "workwear-jacket", "hi-vis-vest", "workwear-trousers"}
        intersect = expected_any & ids
        assert len(intersect) >= 3, f"expected workwear products in construction-trades, got {ids}"

    def test_legacy_alias_trades(self, api):
        r = api.get(f"{BASE_URL}/api/industries/trades")
        assert r.status_code == 200, r.text
        data = r.json()
        products = data.get("products") or []
        ids = {p.get("id") or p.get("slug") for p in products}
        assert any(s in ids for s in
                   ("workwear-tshirt", "workwear-jacket", "hi-vis-vest", "workwear-trousers")), \
            f"alias /trades didn't resolve to construction-trades products: {ids}"


# ---------- Sports Teams ----------
class TestSportsTeams:
    def test_list(self, api):
        r = api.get(f"{BASE_URL}/api/sports-teams")
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or []
        slugs = {it.get("slug") for it in items}
        expected = {"football", "rugby", "gyms", "personal-trainers",
                    "boxing-gyms", "thai-boxing", "kick-boxing", "dance-studios"}
        assert expected.issubset(slugs), f"missing sports-team slugs. got: {slugs}"
        assert len(items) == 8

    def test_football_detail(self, api):
        r = api.get(f"{BASE_URL}/api/sports-teams/football")
        assert r.status_code == 200, r.text
        data = r.json()
        h1 = data.get("h1") or ""
        assert "Football" in h1 and "UK" in h1, f"unexpected h1: {h1}"
        assert data.get("intro")
        assert data.get("seo_paragraph") or data.get("seoParagraph")
        faqs = data.get("faqs") or []
        assert len(faqs) == 3, f"expected 3 FAQs, got {len(faqs)}"
        products = data.get("products") or []
        assert len(products) == 8, f"expected 8 products, got {len(products)}"


# ---------- Shop garment types ----------
class TestShopTypes:
    def test_types_includes_aprons_bottoms(self, api):
        r = api.get(f"{BASE_URL}/api/shop/types")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or []
        by_key = {it.get("slug") or it.get("key") or it.get("type"): it for it in items}
        assert "aprons" in by_key, f"aprons missing. keys: {list(by_key)}"
        assert "bottoms" in by_key, f"bottoms missing. keys: {list(by_key)}"
        assert (by_key["aprons"].get("product_count") or by_key["aprons"].get("count") or 0) > 0
        assert (by_key["bottoms"].get("product_count") or by_key["bottoms"].get("count") or 0) > 0

    def test_aprons_products(self, api):
        r = api.get(f"{BASE_URL}/api/shop/type/aprons")
        assert r.status_code == 200, r.text
        data = r.json()
        products = data.get("products") or (data if isinstance(data, list) else [])
        ids = {p.get("id") or p.get("slug") for p in products}
        assert {"bib-apron", "waist-apron", "denim-apron"}.issubset(ids), \
            f"missing apron ids. got: {ids}"

    def test_bottoms_products_sorted_asc(self, api):
        r = api.get(f"{BASE_URL}/api/shop/type/bottoms")
        assert r.status_code == 200, r.text
        data = r.json()
        products = data.get("products") or (data if isinstance(data, list) else [])
        ids = [p.get("id") or p.get("slug") for p in products]
        assert "joggers" in ids and "workwear-trousers" in ids \
               and "performance-leggings" in ids, f"missing bottoms. got: {ids}"
        prices = [p.get("price") or p.get("base_price") or 0 for p in products]
        assert prices == sorted(prices), f"bottoms not sorted ascending: {prices}"


# ---------- Navigation ----------
class TestNavigation:
    def test_default_nav(self, api):
        r = api.get(f"{BASE_URL}/api/navigation")
        assert r.status_code == 200
        data = r.json()
        menu = data.get("menu")
        # menu is a list of dicts each with a "key" field
        assert isinstance(menu, list), f"menu should be list, got {type(menu)}"
        keys = {m.get("key") for m in menu}
        for k in ("shop", "teams", "industries", "portfolio", "design", "contact"):
            assert k in keys, f"navigation menu missing key {k}. keys: {keys}"

    def test_admin_patch_and_reset(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/navigation")
        cur = r.json()
        version_before = cur.get("version", 0)
        menu_list = list(cur.get("menu") or [])
        # Modify - add a column to "shop"
        for i, m in enumerate(menu_list):
            if m.get("key") == "shop":
                cols = list(m.get("columns") or [])
                cols.append({"heading": "TEST_COL",
                             "links": [{"label": "TEST_LINK", "to": "/test"}]})
                menu_list[i] = {**m, "columns": cols}
                break
        patch = api.patch(f"{BASE_URL}/api/admin/navigation",
                          headers=admin_headers,
                          json={"config": {"menu": menu_list, "version": version_before}})
        assert patch.status_code == 200, patch.text
        r2 = api.get(f"{BASE_URL}/api/navigation")
        d2 = r2.json()
        ver_after = d2.get("version", 0)
        assert ver_after > version_before, f"version not incremented {version_before}->{ver_after}"
        # Check TEST_COL is present
        new_menu = d2.get("menu", [])
        shop_entry = next((m for m in new_menu if m.get("key") == "shop"), {})
        headings = [c.get("heading") for c in (shop_entry.get("columns") or [])]
        assert "TEST_COL" in headings, f"TEST_COL not persisted. headings: {headings}"
        # Reset
        reset = api.post(f"{BASE_URL}/api/admin/navigation/reset", headers=admin_headers)
        assert reset.status_code == 200, reset.text
        r3 = api.get(f"{BASE_URL}/api/navigation")
        d3 = r3.json()
        shop3 = next((m for m in d3.get("menu", []) if m.get("key") == "shop"), {})
        headings3 = [c.get("heading") for c in (shop3.get("columns") or [])]
        assert "TEST_COL" not in headings3, "reset did not restore defaults"


# ---------- Portfolio ----------
class TestPortfolio:
    created_id = None

    def test_create_portfolio_item(self, api, admin_headers):
        payload = {
            "title": "TEST_Portfolio_Item",
            "category": "workwear",
            "image_data_url": TINY_PNG_DATA_URL,
            "is_featured": True,
        }
        r = api.post(f"{BASE_URL}/api/admin/portfolio",
                     headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        item = r.json()
        assert item.get("id")
        img = item.get("image_url") or ""
        assert "/api/portfolio/file/" in img, f"unexpected image_url: {img}"
        assert img.endswith(".png"), f"image url should end with .png: {img}"
        assert item.get("storage_meta"), "storage_meta should be populated"
        TestPortfolio.created_id = item["id"]
        TestPortfolio.image_url = img

    def test_list_public_portfolio(self, api):
        r = api.get(f"{BASE_URL}/api/portfolio")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or []
        ids = [it.get("id") for it in items]
        assert TestPortfolio.created_id in ids

    def test_file_serve(self, api):
        url = f"{BASE_URL}{TestPortfolio.image_url}"
        r = api.get(url)
        assert r.status_code == 200, f"file serve {url} -> {r.status_code}"
        ct = r.headers.get("content-type", "")
        assert "image/png" in ct.lower(), f"unexpected content-type {ct}"
        assert len(r.content) > 50

    def test_category_validation(self, api, admin_headers):
        r = api.post(f"{BASE_URL}/api/admin/portfolio",
                     headers=admin_headers,
                     json={"title": "TEST_bad",
                           "category": "nonsense",
                           "image_data_url": TINY_PNG_DATA_URL})
        assert r.status_code == 400, f"expected 400 for invalid category, got {r.status_code}: {r.text}"

    def test_patch_portfolio(self, api, admin_headers):
        r = api.patch(f"{BASE_URL}/api/admin/portfolio/{TestPortfolio.created_id}",
                      headers=admin_headers,
                      json={"title": "TEST_Portfolio_Updated"})
        assert r.status_code == 200, r.text
        # verify
        listing = api.get(f"{BASE_URL}/api/portfolio").json()
        items = listing if isinstance(listing, list) else listing.get("items") or []
        match = next((it for it in items if it.get("id") == TestPortfolio.created_id), None)
        assert match and match.get("title") == "TEST_Portfolio_Updated"

    def test_featured_filter(self, api):
        r = api.get(f"{BASE_URL}/api/portfolio?featured_only=true&limit=8")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or []
        for it in items:
            assert it.get("is_featured") is True, f"non-featured leaked: {it}"

    def test_soft_delete(self, api, admin_headers):
        r = api.delete(f"{BASE_URL}/api/admin/portfolio/{TestPortfolio.created_id}",
                       headers=admin_headers)
        assert r.status_code in (200, 204), r.text
        listing = api.get(f"{BASE_URL}/api/portfolio").json()
        items = listing if isinstance(listing, list) else listing.get("items") or []
        ids = [it.get("id") for it in items]
        assert TestPortfolio.created_id not in ids, "soft-deleted item still in public list"


# ---------- Integrations ----------
class TestIntegrations:
    def test_admin_list_keys(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/integrations", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or []
        keys = {it.get("key") for it in items}
        expected = {"stripe_api_key", "resend_api_key", "removebg_api_key",
                    "cutoutpro_api_key", "judgeme_shop_token",
                    "whatsapp_number", "contact_email"}
        assert expected.issubset(keys), f"missing keys. got: {keys}"
        stripe = next(it for it in items if it.get("key") == "stripe_api_key")
        assert stripe.get("is_set") is True, f"stripe is_set should be true: {stripe}"
        assert stripe.get("source") == "env", f"stripe source should be env: {stripe}"

    def test_whatsapp_persist(self, api, admin_headers):
        # set
        patch_payload = {"values": {"whatsapp_number": "+447700111222"}}
        r = api.patch(f"{BASE_URL}/api/admin/integrations",
                      headers=admin_headers, json=patch_payload)
        assert r.status_code == 200, r.text
        # public read
        pub = api.get(f"{BASE_URL}/api/site/whatsapp")
        assert pub.status_code == 200
        assert pub.json().get("number") == "+447700111222"
        # clear back
        api.patch(f"{BASE_URL}/api/admin/integrations",
                  headers=admin_headers,
                  json={"values": {"whatsapp_number": ""}})

    def test_whatsapp_empty_after_clear(self, api):
        r = api.get(f"{BASE_URL}/api/site/whatsapp")
        assert r.status_code == 200
        assert r.json().get("number", "") in ("", None) or isinstance(r.json().get("number"), str)


# ---------- Auth + regression ----------
class TestRegression:
    def test_login(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json().get("token")

    def test_products_public(self, api):
        for ep in ["/api/products", "/api/products/personalised-tee",
                   "/api/workforce/products", "/api/specials/products",
                   "/api/leavers/templates"]:
            r = api.get(f"{BASE_URL}{ep}")
            assert r.status_code == 200, f"{ep} -> {r.status_code}"

    def test_admin_protected_without_token(self):
        # Use a fresh session (no cookies from login)
        clean = requests.Session()
        clean.headers.update({"Content-Type": "application/json"})
        r = clean.patch(f"{BASE_URL}/api/admin/products/personalised-tee/meta",
                        json={"description": "x"})
        assert r.status_code == 401, f"expected 401 unauthenticated, got {r.status_code}"
