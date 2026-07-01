"""Iteration 21 backend tests
1. Front-only bundle allowed_placements seeded (5 front placements, no back-print).
2. Regular bundles keep allowed_placements=None (unrestricted).
3. Team-kit configurator quote submission still works for both variants.
"""
import os
import io
import base64
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")

FRONT_ONLY_IDS = [
    "football-kit-front-only",
    "football-premium-front-only",
    "rugby-kit-front-only",
    "training-pack-front-only",
]
REGULAR_BUNDLE_IDS = ["football-kit-bundle", "rugby-kit-bundle"]

EXPECTED_FRONT_PLACEMENTS = {"left-breast", "right-breast", "full-front", "left-sleeve", "right-sleeve"}


@pytest.mark.parametrize("pid", FRONT_ONLY_IDS)
def test_front_only_bundle_has_restricted_placements(pid):
    r = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
    assert r.status_code == 200, f"{pid} returned {r.status_code}"
    data = r.json()
    ap = data.get("allowed_placements")
    assert ap is not None, f"{pid} allowed_placements is None (seed did not run?)"
    assert set(ap) == EXPECTED_FRONT_PLACEMENTS, f"{pid} got {ap}"
    # No back-print / neck-label
    assert "back-print" not in ap
    assert "neck-label" not in ap


@pytest.mark.parametrize("pid", REGULAR_BUNDLE_IDS)
def test_regular_bundle_has_null_placements(pid):
    """Regular bundles should be unrestricted → field absent or None."""
    r = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
    assert r.status_code == 200
    data = r.json()
    ap = data.get("allowed_placements")
    assert ap is None, f"{pid} allowed_placements should be null/None; got {ap}"


@pytest.mark.parametrize("pid", FRONT_ONLY_IDS)
def test_front_only_allowed_placements_endpoint(pid):
    """/allowed-placements endpoint mirrors the same restricted list."""
    r = requests.get(f"{BASE_URL}/api/products/{pid}/allowed-placements", timeout=15)
    assert r.status_code == 200
    ap = r.json().get("allowed_placements")
    assert set(ap) == EXPECTED_FRONT_PLACEMENTS


def _tiny_png_data_url():
    # 1x1 transparent PNG
    b = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lPAAAAABJRU5ErkJggg=="
    )
    return "data:image/png;base64," + base64.b64encode(b).decode()


@pytest.mark.parametrize("pid", ["football-kit-front-only", "football-kit-bundle"])
def test_team_kit_quote_submission(pid):
    """Quote submission works for both front-only and regular bundle variants
    via the same /api/quote-request endpoint the configurator uses."""
    is_front_only = pid.endswith("-front-only")
    badge = _tiny_png_data_url()
    payload = {
        "kind": "team_kit",
        "name": "TEST iter21 Contact",
        "email": "iter21@example.com",
        "phone": "07000000000",
        "company": f"TEST_iter21_{pid}",
        "sport": "rugby" if "rugby" in pid else "football",
        "kit_type": pid,
        "quantity": 1,
        "message": f"iter21 automated {'front-only' if is_front_only else 'regular'} test",
        "artwork": [badge],
        "roster": [
            {"name": "" if is_front_only else "Smith",
             "number": "" if is_front_only else "10",
             "size": "M", "qty": 1}
        ],
        "product_id": pid,
    }
    r = requests.post(f"{BASE_URL}/api/quote-request", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"{pid}: {r.status_code} {r.text[:400]}"
    data = r.json()
    assert data.get("ok") is True or "id" in data
