import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_combined_root_serves_frontend_spa():
    """Verify that root / serves the React frontend index.html."""
    resp = client.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")
    assert "<div id=\"root\">" in resp.text or "<html" in resp.text.lower()

def test_combined_spa_routing_fallback():
    """Verify that client-side SPA routes fallback to index.html instead of 404."""
    routes = ["/projects", "/contributors", "/admin", "/graph", "/evidence", "/campaigns", "/vouches", "/settings"]
    for route in routes:
        resp = client.get(route)
        assert resp.status_code == 200, f"Route {route} failed with status {resp.status_code}"
        assert "text/html" in resp.headers.get("content-type", "")
        assert "<div id=\"root\">" in resp.text or "<html" in resp.text.lower()

def test_combined_static_asset_serving():
    """Verify that static files (svg icons, assets) are served directly."""
    resp = client.get("/favicon.svg")
    assert resp.status_code == 200
    assert "image/svg+xml" in resp.headers.get("content-type", "")
    assert "<svg" in resp.text

def test_combined_api_routes_preserved():
    """Verify that API routes are preserved and take precedence over frontend routes."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    resp_system = client.get("/health")
    assert resp_system.status_code == 200
    assert resp_system.json()["status"] == "online"

def test_combined_nonexistent_api_routes_return_404_json():
    """Verify that nonexistent /api routes return 404 JSON, NOT index.html."""
    resp = client.get("/api/nonexistent_endpoint_12345")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Not Found"

