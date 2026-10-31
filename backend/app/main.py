from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.ai import router as ai_router

app = FastAPI(
    title="TrustMesh AI Service",
    description="TrustMesh — Decentralized Trust Network Against AI Slop (Evidence Analysis & Explainability Engine)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount AI Router
app.include_router(ai_router)

@app.get("/health", tags=["System"])
def root_health():
    return {
        "status": "online",
        "service": "trustmesh-ai",
        "version": "1.0.0",
        "tagline": "Trust should travel. Evidence should speak."
    }
