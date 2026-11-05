"""
TrustMesh Unified Full-Stack Application Entry Point.
Connects the FastAPI backend with the React frontend into a single server.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
_ROOT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _ROOT_DIR / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Import the unified FastAPI application (serves both React SPA and REST API)
from app.main import app

if __name__ == "__main__":
    import os
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print("")
    print("=" * 60)
    print("  🚀 TrustMesh Full-Stack Server Running")
    print(f"  👉 Website & App: http://127.0.0.1:{port}")
    print(f"  👉 API Documentation: http://127.0.0.1:{port}/docs")
    print("=" * 60)
    print("")
    uvicorn.run("main:app", host=host, port=port, reload=True)

