"""Test the API endpoints."""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    print(f"✓ Health check: {data}")


def test_scrape():
    """Test scrape endpoint."""
    response = client.post("/scrape", json={"url": "https://example.com"})
    assert response.status_code == 200
    data = response.json()
    assert "title" in data
    print(f"✓ Scrape test: Got title '{data['title']}'")


def test_generate():
    """Test generate endpoint."""
    response = client.post("/generate", json={
        "mode": "stock",
        "product_url": "https://example.com/product",
        "iteration": False
    })
    assert response.status_code == 200
    data = response.json()
    assert "ads" in data
    assert len(data["ads"]) > 0
    print(f"✓ Generate test: Created {len(data['ads'])} variations")
    
    # Check ad structure
    ad = data["ads"][0]
    assert "id" in ad
    assert "headline" in ad
    assert "image_url" in ad
    assert "mock_metrics" in ad
    print(f"  - First ad headline: {ad['headline']}")
    print(f"  - Metrics: {ad['mock_metrics']}")


def test_generate_with_project():
    """Test generate endpoint with project data."""
    response = client.post("/generate", json={
        "mode": "ai",
        "product_url": "https://selurewear.com/product",
        "iteration": False,
        "batch_config": {
            "count": 3,
            "focus": "test angle",
            "angles": ["transformation", "social proof"],
            "dryRun": True,
            "modeRatio": {"A": 50, "B": 30, "C": 20}
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["ads"]) == 3
    print(f"✓ Generate with project: Created {len(data['ads'])} variations")


if __name__ == "__main__":
    print("Testing API endpoints...\n")
    
    try:
        test_health()
    except Exception as e:
        print(f"✗ Health check failed: {e}")
    
    try:
        test_scrape()
    except Exception as e:
        print(f"✗ Scrape test failed: {e}")
    
    try:
        test_generate()
    except Exception as e:
        print(f"✗ Generate test failed: {e}")
    
    try:
        test_generate_with_project()
    except Exception as e:
        print(f"✗ Generate with project test failed: {e}")
    
    print("\nAll tests completed!")
