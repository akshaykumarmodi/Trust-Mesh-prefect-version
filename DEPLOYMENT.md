# TrustMesh Deployment Guide

This guide describes how to deploy TrustMesh to **Vercel** (Frontend) and a Python runtime (Backend).

---

## 1. Architecture Overview

TrustMesh is structured as a decoupled full-stack platform:
- **Frontend**: React 19 + Vite SPA (located in `frontend/`)
  - Target: **Vercel**
  - Features: Automatic CDN distribution, SPA fallback routing, and dynamic API base configuration.
- **Backend**: FastAPI + SQLite + Groq Live AI Inference (located in `backend/`)
  - Target: **Render / Railway / Fly.io** or local tunnel via **Cloudflare Tunnel / ngrok**.
  - Note: Vercel frontend hosting serves static client assets and proxies API calls. The Python backend requires a persistent environment to maintain SQLite state, database connection pools, and live Groq inference sessions.

---

## 2. Frontend Deployment on Vercel

### Option A: Via Vercel Web Dashboard (Recommended)

1. Navigate to [vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and import the repository: `akshaykumarmodi/TrustMesh`.
3. In the **Configure Project** screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select `frontend` (or leave as root; both root and frontend `vercel.json` are pre-configured).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables**:
   - `VITE_API_BASE_URL`: Live URL of the backend (e.g. `https://trustmesh-backend.onrender.com` or your tunnel URL). If omitted, requests default to `/api`.
5. Click **Deploy**.

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from repository root
vercel

# Deploy to production
vercel --prod
```

---

## 3. SPA Routing & Fallbacks

To ensure client-side routes (e.g. `/projects`, `/contributors`, `/admin`, `/graph`) do not return 404 when refreshed or accessed directly:
- `frontend/vercel.json` and `vercel.json` define rewrite rules routing all non-asset requests to `/index.html`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 4. Backend Deployment Options

### Option A: Render.com (Free Python Web Service)

1. Go to [render.com](https://render.com) and create a **New Web Service**.
2. Connect the `TrustMesh` repository.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
4. Add backend environment variables (see below).
5. Copy the assigned URL (e.g. `https://trustmesh-api.onrender.com`) and paste it as `VITE_API_BASE_URL` in Vercel.

### Option B: Instant Hackathon Demo via Tunnel

For immediate live demonstration while running the backend locally:

```bash
# Run backend on port 8000
PYTHONPATH=backend ./backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# In a separate terminal, expose via Cloudflare Tunnel
npx cloudflared tunnel --url http://127.0.0.1:8000
```

Add the generated tunnel URL as `VITE_API_BASE_URL` in Vercel.

---

## 5. Environment Variables & Security Isolation

### Frontend Environment Variables (Vercel)
Only public configuration is exposed to client bundles:
| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Live FastAPI backend base URL | `https://trustmesh-api.onrender.com` |

> [!CAUTION]
> **Security Rule**: Never configure private API keys, database credentials, or secret tokens as `VITE_` variables. All secret tokens reside exclusively on the backend.

### Backend Environment Variables (Render / Railway / Server)
| Variable | Required | Description |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | Optional | Groq API key for live GPT-OSS-120B inference |
| `AI_PROVIDER` | Optional | Set to `groq` |
| `AI_MODEL_NAME` | Optional | Defaults to `openai/gpt-oss-120b` |
| `GITHUB_TOKEN` | Optional | GitHub personal access token for higher rate limits |
| `RESEND_API_KEY` | Optional | Resend API key for transactional email notifications |
| `JWT_SECRET` | Required | Secret string for auth token signing |
| `ADMIN_SECRET_KEY` | Optional | Secret key for administrative audit access |

---

## 6. Verification Checklist

- [x] `frontend/vercel.json` SPA fallback verified.
- [x] `vercel.json` root monorepo build verified.
- [x] Dynamic `VITE_API_BASE_URL` resolution verified in `frontend/src/services/api.js`.
- [x] Backend CORS policy allows requests from Vercel preview and production domains (`allow_origins=["*"]`).
- [x] Zero private secrets or `.env` files committed.
