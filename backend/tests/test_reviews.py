"""Backend tests for the reviews + Judge.me import endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://branded-workwear-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SMALL_B64 = "data:image/png;base64,iVBORw0KGgo="
BAD_B64 = "not-a-data-url"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestCreateReview:
    def test_invalid_product(self, client):
        r = client.post(f"{API}/reviews", json={
            "product_id": "nope-xyz",
            "reviewer_name": "TEST",
            "rating": 5, "title": "t", "body": "b",
        })
        assert r.status_code == 400

    def test_invalid_rating_low(self, client):
        r = client.post(f"{API}/reviews", json={
            "product_id": "personalised-tee",
            "reviewer_name": "TEST", "rating": 0,
            "title": "t", "body": "b",
        })
        assert r.status_code == 400

    def test_invalid_rating_high(self, client):
        r = client.post(f"{API}/reviews", json={
            "product_id": "personalised-tee",
            "reviewer_name": "TEST", "rating": 6,
            "title": "t", "body": "b",
        })
        assert r.status_code == 400

    def test_create_and_filter_photos(self, client):
        payload = {
            "product_id": "personalised-tee",
            "reviewer_name": "TEST_Reviewer",
            "reviewer_email": "test_rev@example.com",
            "rating": 4,
            "title": "TEST_Nice tee",
            "body": "Great print quality",
            "photos": [SMALL_B64, BAD_B64, SMALL_B64],
        }
        r = client.post(f"{API}/reviews", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["product_id"] == "personalised-tee"
        assert data["rating"] == 4
        assert data["title"] == "TEST_Nice tee"
        assert data["source"] == "native"
        # bad photo filtered out, only 2 valid ones kept
        assert len(data["photos"]) == 2
        assert all(p.startswith("data:image/") for p in data["photos"])
        assert "id" in data


class TestProductReviewsAggregate:
    @pytest.fixture(scope="class", autouse=True)
    def seed(self, client):
        # Seed 2 reviews for kids-tee
        for rating, title in [(5, "TEST_Loved"), (3, "TEST_Okay")]:
            client.post(f"{API}/reviews", json={
                "product_id": "kids-tee",
                "reviewer_name": "TEST_Seed",
                "rating": rating,
                "title": title,
                "body": "seed body",
            })

    def test_product_reviews_listing(self, client):
        r = client.get(f"{API}/reviews/product/kids-tee")
        assert r.status_code == 200
        data = r.json()
        assert data["product_id"] == "kids-tee"
        assert data["count"] >= 2
        assert data["average"] >= 1.0 and data["average"] <= 5.0
        # sorted by created_at desc - latest first
        dates = [r["created_at"] for r in data["reviews"]]
        assert dates == sorted(dates, reverse=True)

    def test_product_reviews_unknown_404(self, client):
        r = client.get(f"{API}/reviews/product/nope-xyz")
        assert r.status_code == 404

    def test_aggregate_map(self, client):
        r = client.get(f"{API}/reviews/aggregate")
        assert r.status_code == 200
        agg = r.json()
        assert isinstance(agg, dict)
        # kids-tee should now appear
        if "kids-tee" in agg:
            assert "average" in agg["kids-tee"]
            assert "count" in agg["kids-tee"]
            assert agg["kids-tee"]["count"] >= 2

    def test_recent_reviews(self, client):
        r = client.get(f"{API}/reviews/recent", params={"limit": 5})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 5
        if data:
            assert "rating" in data[0]
            assert "product_id" in data[0]


class TestJudgeMeImport:
    def test_import_mixed(self, client):
        payload = {
            "reviews": [
                {
                    "id": "jm-1", "rating": 5, "title": "Great", "body": "Loved",
                    "reviewer_name": "TEST_JM1",
                    "product_title": "Personalised Hoodie",
                    "created_at": "2025-12-16T00:00:00Z",
                },
                {
                    "id": "jm-2", "rating": 4, "title": "Decent", "body": "Good",
                    "reviewer_name": "TEST_JM2",
                    "product_title": "Mystery Unknown Product",
                    "created_at": "2025-12-16T00:00:00Z",
                },
            ],
            "default_product_id": "polo-shirt",
            "product_id_map": {"Personalised Hoodie": "personalised-hoodie"},
        }
        r = client.post(f"{API}/reviews/import-judgeme", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        # 1 mapped, 1 falls back to polo-shirt (valid) → both imported
        assert data["imported"] == 2
        assert data["skipped"] == 0

    def test_import_skipped_when_no_default_no_map(self, client):
        payload = {
            "reviews": [
                {"id": "jm-99", "rating": 5, "title": "X", "body": "Y",
                 "reviewer_name": "TEST_JM99",
                 "product_title": "Totally Unknown"},
            ],
            "default_product_id": "garbage-not-a-real-id",
            "product_id_map": {},
        }
        r = client.post(f"{API}/reviews/import-judgeme", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["imported"] == 0
        assert data["skipped"] == 1

    def test_import_marks_verified_and_judgeme(self, client):
        payload = {
            "reviews": [{
                "id": "jm-verify-1", "rating": 5,
                "title": "TEST_JM_Verified", "body": "Imported one",
                "reviewer_name": "TEST_JM_Verify",
                "product_title": "Whatever",
            }],
            "default_product_id": "personalised-tee",
        }
        r = client.post(f"{API}/reviews/import-judgeme", json=payload)
        assert r.status_code == 200
        assert r.json()["imported"] == 1

        # Pull the product reviews and verify there's at least one verified judgeme review
        rr = client.get(f"{API}/reviews/product/personalised-tee")
        assert rr.status_code == 200
        reviews = rr.json()["reviews"]
        jm = [x for x in reviews if x.get("source") == "judgeme"]
        assert len(jm) >= 1
        assert any(x.get("verified") is True for x in jm)
