#!/usr/bin/env python3
"""
TrustMesh - Simple All-in-One Runner
Runs both the backend and frontend together with a single command.
"""
import os
import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"

def check_and_build_frontend():
    """Builds the frontend website if not already built."""
    index_html = FRONTEND_DIST / "index.html"
    if not index_html.is_file():
        print("👉 Building the website first (one-time setup)...")
        if not (FRONTEND_DIR / "node_modules").is_dir():
            subprocess.run(["npm", "--prefix", str(FRONTEND_DIR), "install"], check=True)
        subprocess.run(["npm", "--prefix", str(FRONTEND_DIR), "run", "build"], check=True)
        print("✅ Website built successfully!")

def main():
    check_and_build_frontend()

    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    os.environ["PYTHONPATH"] = str(BACKEND_DIR)

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    print("")
    print("=" * 50)
    print("  TrustMesh is LIVE!")
    print(f"  Open in your browser: http://127.0.0.1:{port}")
    print("=" * 50)
    print("  (Press Ctrl + C to stop)")
    print("")

    import uvicorn
    uvicorn.run("app.main:app", host=host, port=port, reload=False)

if __name__ == "__main__":
    main()
