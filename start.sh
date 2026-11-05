#!/usr/bin/env bash
# =============================================================================
# TrustMesh All-In-One Starter Script
# Runs the entire project (backend + frontend) with one simple command.
# =============================================================================

set -e

echo "=================================================="
echo "  Starting TrustMesh (All-in-One)"
echo "=================================================="

# Step 1: Check Python setup
if [ ! -d "backend/.venv" ]; then
    echo "👉 [1/3] Setting up Python environment..."
    python3 -m venv backend/.venv
    ./backend/.venv/bin/pip install --quiet -r backend/requirements.txt
fi

# Step 2: Check Frontend build
if [ ! -f "frontend/dist/index.html" ]; then
    echo "👉 [2/3] Building the website..."
    if [ ! -d "frontend/node_modules" ]; then
        npm --prefix frontend install --quiet
    fi
    npm --prefix frontend run build --silent
fi

# Step 3: Run the combined application on port 8000
echo "👉 [3/3] Starting server..."
echo ""
echo "=================================================="
echo "  TrustMesh is LIVE!"
echo "  Click or open this link in your browser:"
echo "  👉 http://127.0.0.1:8000"
echo "=================================================="
echo "  (Press Ctrl + C in this terminal to stop)"
echo ""

PYTHONPATH=backend ./backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

