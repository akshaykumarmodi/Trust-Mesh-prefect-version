from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
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
    # Startup: run auto-migrations, create tables and seed demo data
    run_migrations(engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db, reset=False)
    finally:
        db.close()
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
    allow_origins=["*"],
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
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(github_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)

@app.get("/api/health", tags=["system"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "team": "Nexora",
        "tagline": "Trust should travel. Evidence should speak.",
        "model_integration": settings.AI_MODEL_NAME
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
