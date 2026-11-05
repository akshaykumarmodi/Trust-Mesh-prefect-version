import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.core.config import is_filesystem_readonly, get_database_url, settings
from app.main import app
import main as backend_main
import index as backend_index


def test_entrypoints_export_same_app():
    """Verify backend entrypoints (main:app, index:app, app.main:app) point to the exact same FastAPI instance."""
    assert backend_main.app is app
    assert backend_main.handler is app
    assert backend_index.app is app
    assert backend_index.handler is app


def test_database_url_normalization_postgres():
    """Verify postgres:// is rewritten to postgresql:// for SQLAlchemy 2 compatibility."""
    orig_env = os.environ.get("DATABASE_URL")
    try:
        os.environ["DATABASE_URL"] = "postgres://user:password@localhost:5432/trustmesh_db"
        assert get_database_url() == "postgresql://user:password@localhost:5432/trustmesh_db"
    finally:
        if orig_env is not None:
            os.environ["DATABASE_URL"] = orig_env
        else:
            os.environ.pop("DATABASE_URL", None)


def test_database_url_serverless_readonly():
    """Verify serverless environment forces SQLite to /tmp/trustmesh.db and ensures write safety."""
    orig_vercel = os.environ.get("VERCEL")
    orig_db = os.environ.get("DATABASE_URL")
    try:
        os.environ["VERCEL"] = "1"
        os.environ["DATABASE_URL"] = "sqlite:///./trustmesh.db"
        resolved = get_database_url()
        assert resolved == "sqlite:////tmp/trustmesh.db"
    finally:
        if orig_vercel is not None:
            os.environ["VERCEL"] = orig_vercel
        else:
            os.environ.pop("VERCEL", None)

        if orig_db is not None:
            os.environ["DATABASE_URL"] = orig_db
        else:
            os.environ.pop("DATABASE_URL", None)


def test_health_endpoints_and_lifespan():
    """Verify lifespan startup executes cleanly and both /health and /api/health return 200 OK."""
    with TestClient(app) as client:
        # 1. Root /health
        res_root = client.get("/health")
        assert res_root.status_code == 200
        data_root = res_root.json()
        assert data_root["status"] == "online"

        # 2. Vercel rewritten /api/health
        res_api = client.get("/api/health")
        assert res_api.status_code == 200
        data_api = res_api.json()
        assert data_api["status"] == "healthy"
        assert "service" in data_api
        assert "TrustMesh" in data_api["service"]

        # 3. Core API endpoint /api/projects
        res_projects = client.get("/api/projects")
        assert res_projects.status_code == 200
        assert isinstance(res_projects.json(), list)

