# TrustMesh Deployment & Full-Stack Integration Guide

This guide describes how to run and deploy TrustMesh either as a **Unified Full-Stack Application** (FastAPI serving React SPA) or as a **Decoupled Deployment** (Vercel Frontend + Python Backend).

---

## 1. Architecture Overview

TrustMesh can run in two supported configurations:

### Mode A: Combined Single-Server / Full-Stack (Recommended for Docker, Render, Railway, Fly.io, Self-Hosted)
- **FastAPI** serves both:
  - JSON REST API endpoints at `/api/*`
  - Interactive OpenAPI / Swagger UI at `/docs`
  - Compiled React 19 SPA static assets from `frontend/dist` with client-side SPA fallback routing (`/projects`, `/contributors`, `/admin`, `/graph`, `/evidence`, `/campaigns`, `/vouches`, `/denouncements`, `/settings`)
- **Benefits**:
  - Single port (e.g. `8000`)
  - No CORS setup needed
  - Unified deployment and monitoring

### Mode B: Decoupled / Serverless (Vercel + Managed Backend)
- **Frontend**: React 19 + Vite deployed to **Vercel** CDN.
- **Backend**: FastAPI running on **Render / Railway / Fly.io** or serverless via Vercel's Python runtime (`api/index.py`).
- **Dynamic Configuration**: `frontend/src/services/api.js` automatically uses `VITE_API_BASE_URL` or defaults to `/api`.

---

## 2. Quick Local Start (Combined Full-Stack)

### Option 1: One-Click Development (Concurrent Backend + Frontend)
```bash
# Starts FastAPI on 8000 and Vite dev server on 5173 with proxy
npm run dev
```

### Option 2: Combined Production Server
```bash
# Builds React frontend and serves both API and UI from FastAPI on port 8000
npm start

# Or using the Python runner directly:
python run.py
```
Open **`http://127.0.0.1:8000`** in your browser.

---

## 3. Docker Deployment (Single Container Full-Stack)

A production-ready multi-stage Dockerfile is provided:

```bash
# Build and run with Docker Compose
docker compose up --build -d

# Check logs
docker compose logs -f
```
The entire application (FastAPI backend + compiled React frontend) is available at `http://localhost:8000`.

---

## 4. Vercel Combined Serverless Deployment

TrustMesh includes a root `vercel.json` and `api/index.py` serverless entrypoint:

```json
{
  "buildCommand": "npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.py"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Deploying from root:
```bash
vercel
vercel --prod
```

---

## 5. Environment Variables & Security Isolation

### Public Client Variables (Vercel / Vite)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Optional external API URL (omit for same-origin `/api`) | `""` |

### Backend / Server Environment Variables
| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Server port (default: `8000`) |
| `GROQ_API_KEY` | Optional | Groq API key for live GPT-OSS-120B inference |
| `AI_PROVIDER` | Optional | Set to `groq` |
| `AI_MODEL_NAME` | Optional | Defaults to `openai/gpt-oss-120b` |
| `GITHUB_TOKEN` | Optional | GitHub personal access token for higher rate limits |
| `RESEND_API_KEY` | Optional | Resend API key for transactional email notifications |
| `JWT_SECRET` | Required | Secret string for auth token signing |
| `ADMIN_SECRET_KEY` | Optional | Secret key for administrative audit access |

---

## 6. Verification Checklist

- [x] Combined single-server serving verified: `GET /` serves React SPA.
- [x] Client-side SPA routing verified: direct access/refresh on `/projects`, `/contributors`, `/admin`, `/graph` returns `index.html`.
- [x] Static assets served correctly from `/assets/*` and `/favicon.svg`.
- [x] Non-existent `/api/*` endpoints return 404 JSON, not HTML.
- [x] Concurrent development command `npm run dev` launches both servers.
- [x] Automated test suite verified (all 76 tests passing).
