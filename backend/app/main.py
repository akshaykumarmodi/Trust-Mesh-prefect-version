import sys
from pathlib import Path

# Ensure backend directory is in sys.path so app can be run from anywhere without ModuleNotFoundError
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings, _ROOT_DIR
from app.database.session import engine, Base, SessionLocal
from app.services.seed_data import seed_database

# Routers
from app.api.projects import router as projects_router
from app.api.contributors import router as contributors_router
from app.api.vouches import router as vouches_router
from app.api.denouncements import router as denouncements_router
from app.api.trust import router as trust_router
from app.api.network import router as network_router
from app.api.campaigns import router as campaigns_router
from app.api.evidence import router as evidence_router
from app.api.federation import router as federation_router
from app.api.ai import router as ai_router
from app.api.github import router as github_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router

def run_migrations(bind_engine):
    with bind_engine.connect() as conn:
        try:
            result = conn.exec_driver_sql("PRAGMA table_info(projects);")
            existing_cols = {row[1] for row in result.fetchall()}
            if existing_cols:
                col_defs = [
                    ("is_github_connected", "BOOLEAN DEFAULT 0"),
                    ("github_owner", "VARCHAR(128) DEFAULT ''"),
                    ("github_repo", "VARCHAR(128) DEFAULT ''"),
                    ("default_branch", "VARCHAR(64) DEFAULT 'main'"),
                    ("visibility", "VARCHAR(32) DEFAULT 'public'"),
                    ("github_created_at", "DATETIME"),
                    ("github_updated_at", "DATETIME"),
                    ("last_synced_at", "DATETIME"),
                    ("sync_status", "VARCHAR(32) DEFAULT 'IDLE'"),
                    ("sync_error", "TEXT DEFAULT ''"),
                ]
                for col_name, col_type in col_defs:
                    if col_name not in existing_cols:
                        conn.exec_driver_sql(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type};")
                conn.commit()
        except Exception:
            pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Defensive startup ensuring Vercel serverless functions boot cleanly without exit status 1
    try:
        run_migrations(engine)
    except Exception as exc:
        print(f"[Lifespan Warning] run_migrations: {exc}")

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        print(f"[Lifespan Warning] Base.metadata.create_all: {exc}")

    try:
        db = SessionLocal()
        try:
            seed_database(db, reset=False)
        finally:
            db.close()
    except Exception as exc:
        print(f"[Lifespan Warning] seed_database: {exc}")

    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="TrustMesh — Decentralized Trust Network Against AI Slop and Coordinated Abuse",
    lifespan=lifespan
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(projects_router, prefix=settings.API_V1_STR)
app.include_router(contributors_router, prefix=settings.API_V1_STR)
app.include_router(vouches_router, prefix=settings.API_V1_STR)
app.include_router(denouncements_router, prefix=settings.API_V1_STR)
app.include_router(trust_router, prefix=settings.API_V1_STR)
app.include_router(network_router, prefix=settings.API_V1_STR)
app.include_router(campaigns_router, prefix=settings.API_V1_STR)
app.include_router(evidence_router, prefix=settings.API_V1_STR)
app.include_router(federation_router, prefix=settings.API_V1_STR)
app.include_router(ai_router) # already has prefix="/api/ai"
app.include_router(github_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
def root_health():
    return {
        "status": "online",
        "service": "trustmesh-ai",
        "version": "1.0.0",
        "tagline": "Trust should travel. Evidence should speak."
    }

@app.get("/api/health", tags=["system"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "author": "Akshay Kumar Modi",
        "tagline": "Trust should travel. Evidence should speak.",
        "model_integration": settings.AI_MODEL_NAME
    }

# ---------------------------------------------------------------------------
# Combined Full-Stack Serving (FastAPI Backend + React Frontend SPA)
# ---------------------------------------------------------------------------
_FRONTEND_DIST = _ROOT_DIR / "frontend" / "dist"
if not _FRONTEND_DIST.is_dir():
    _alt1 = Path("frontend/dist").resolve()
    _alt2 = Path("dist").resolve()
    if _alt1.is_dir():
        _FRONTEND_DIST = _alt1
    elif _alt2.is_dir():
        _FRONTEND_DIST = _alt2

if _FRONTEND_DIST.is_dir():
    _assets_dir = _FRONTEND_DIST / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_root_spa():
        index_file = _FRONTEND_DIST / "index.html"
        if index_file.is_file():
            return FileResponse(str(index_file))
        return {
            "status": "online",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "notice": "Frontend build index.html not found. Run 'npm run build'."
        }

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_frontend(full_path: str):
        # Guard API, health, docs, and schema routes against SPA fallback
        if (
            full_path == "api"
            or full_path.startswith("api/")
            or full_path == "health"
            or full_path.startswith("health/")
            or full_path == "docs"
            or full_path.startswith("docs/")
            or full_path == "redoc"
            or full_path.startswith("redoc/")
            or full_path == "openapi.json"
        ):
            raise HTTPException(status_code=404, detail="Not Found")

        # Serve static file if it exists in frontend/dist (e.g. favicon.svg, icons.svg)
        file_path = _FRONTEND_DIST / full_path
        if full_path and file_path.is_file():
            return FileResponse(str(file_path))

        # Client-side SPA routing fallback (e.g. /projects, /contributors, /admin, /graph)
        index_file = _FRONTEND_DIST / "index.html"
        if index_file.is_file():
            return FileResponse(str(index_file))

        raise HTTPException(status_code=404, detail="Frontend file not found")
else:
    @app.get("/", include_in_schema=False)
    def root_no_frontend():
        return {
            "status": "online",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "notice": "The website is not built yet. Run './start.sh' or 'npm run build' to build it."
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
