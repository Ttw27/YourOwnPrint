"""Iteration 8 backend tests — Designer endpoints + regressions."""
import os
import base64
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
EXPECTED_DESIGNER_IDS = {
    "personalised-tee", "personalised-hoodie", "kids-tee", "polo-shirt",
    "workwear-tshirt", "workwear-sweatshirt", "school-hoodie", "sports-tee",
}
# 1x1 transparent PNG
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
TINY_PNG_DATAURL = f"data:image/png;base64,{TINY_PNG_B64}"


# ---------- Designer endpoints ----------
def test_designer_products_returns_eight():
    r = requests.get(f"{BASE_URL}/api/designer/products", timeout=20)
    assert r.status_code == 200
    data = r.json()
    ids = {p["id"] for p in data}
    assert ids == EXPECTED_DESIGNER_IDS, f"Got {ids}"
    for p in data:
        assert "print_area" in p and {"x", "y", "w", "h"} <= set(p["print_area"].keys())
        assert isinstance(p.get("sizes"), list) and len(p["sizes"]) > 0


def test_admin_designer_products_lists_all():
    r = requests.get(f"{BASE_URL}/api/admin/designer-products", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 29
    enabled = [p for p in data if p["designer_enabled"]]
    assert len(enabled) == 8


def test_patch_designer_persists_and_validates():
    pid = "personalised-tee"
    # save original
    orig = next(p for p in requests.get(f"{BASE_URL}/api/admin/designer-products").json() if p["id"] == pid)
    orig_pa = orig["designer_print_area"]
    orig_img = orig["designer_image"]

    new_pa = {"x": 10.0, "y": 12.0, "w": 60.0, "h": 50.0}
    r = requests.patch(
        f"{BASE_URL}/api/admin/designer-products/{pid}",
        json={"designer_enabled": True, "designer_image": orig_img, "designer_print_area": new_pa},
        timeout=20,
    )
    assert r.status_code == 200, r.text

    designer_p = next(p for p in requests.get(f"{BASE_URL}/api/designer/products").json() if p["id"] == pid)
    assert abs(designer_p["print_area"]["x"] - 10.0) < 0.01
    assert abs(designer_p["print_area"]["w"] - 60.0) < 0.01

    # 404 on unknown
    r404 = requests.patch(
        f"{BASE_URL}/api/admin/designer-products/does-not-exist",
        json={"designer_enabled": True, "designer_image": "x", "designer_print_area": new_pa},
    )
    assert r404.status_code == 404

    # 400 on out-of-range
    r400 = requests.patch(
        f"{BASE_URL}/api/admin/designer-products/{pid}",
        json={"designer_enabled": True, "designer_image": orig_img,
              "designer_print_area": {"x": -1, "y": 0, "w": 10, "h": 10}},
    )
    assert r400.status_code == 400

    # restore
    requests.patch(
        f"{BASE_URL}/api/admin/designer-products/{pid}",
        json={"designer_enabled": True, "designer_image": orig_img, "designer_print_area": orig_pa},
    )


def test_designer_artwork_create_and_get():
    r = requests.post(
        f"{BASE_URL}/api/designer/artwork",
        json={"product_id": "personalised-tee", "artwork_png": TINY_PNG_DATAURL,
              "preview_png": TINY_PNG_DATAURL, "items_count": 2, "width": 2000, "height": 2000},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    art_id = r.json()["id"]
    assert isinstance(art_id, str) and len(art_id) > 8

    g = requests.get(f"{BASE_URL}/api/designer/artwork/{art_id}", timeout=20)
    assert g.status_code == 200
    body = g.json()
    assert body["product_id"] == "personalised-tee"
    assert body["artwork_png"] == TINY_PNG_DATAURL
    assert body["items_count"] == 2


def test_designer_artwork_validation():
    # missing artwork_png
    r1 = requests.post(
        f"{BASE_URL}/api/designer/artwork",
        json={"product_id": "personalised-tee", "artwork_png": ""},
    )
    assert r1.status_code == 400

    # oversized (>6MB)
    big = "data:image/png;base64," + ("A" * 6_100_000)
    r2 = requests.post(
        f"{BASE_URL}/api/designer/artwork",
        json={"product_id": "personalised-tee", "artwork_png": big},
    )
    assert r2.status_code == 400

    # unknown product
    r3 = requests.post(
        f"{BASE_URL}/api/designer/artwork",
        json={"product_id": "no-such-product", "artwork_png": TINY_PNG_DATAURL},
    )
    assert r3.status_code == 400


# ---------- Regressions ----------
def test_regression_products():
    r = requests.get(f"{BASE_URL}/api/products", timeout=20)
    assert r.status_code == 200
    assert len(r.json()) >= 29


def test_regression_team_kit_and_fight_night_addons():
    a = requests.get(f"{BASE_URL}/api/team-kits/addons").json()
    assert {x["id"] for x in a} == {"left-sleeve", "right-sleeve", "back-print"}
    f = requests.get(f"{BASE_URL}/api/fight-night/addons").json()
    assert {x["id"] for x in f} == {"left-sleeve", "right-sleeve", "back-print"}


def test_regression_designer_checkout_with_artwork_id():
    # create artwork
    art = requests.post(
        f"{BASE_URL}/api/designer/artwork",
        json={"product_id": "personalised-tee", "artwork_png": TINY_PNG_DATAURL, "items_count": 1},
    ).json()
    artwork_id = art["id"]

    r = requests.post(
        f"{BASE_URL}/api/checkout/session",
        json={
            "product_id": "personalised-tee",
            "size_qtys": {"M": 3},
            "origin_url": "https://example.test",
            "blank": False,
            "design_meta": {"flow": "designer", "artwork_id": artwork_id},
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert "stripe" in r.json()["url"].lower()
