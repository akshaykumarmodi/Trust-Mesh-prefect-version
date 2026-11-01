# TrustMesh — Decentralized Trust Network Against AI Slop

> **"Trust should travel. Evidence should speak."**  
> *A new contributor is not automatically suspicious. An allegation is not proof. A trust score must always be explainable.*

[![Problem 07](https://img.shields.io/badge/Problem%2007-A%20Trust%20Network%20Against%20AI%20Slop-06b6d4.svg)](#)
[![Team Nexora](https://img.shields.io/badge/Team-Nexora-3b82f6.svg)](#)
[![Python 3.13+](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python-emerald.svg)](#)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20React%20Flow-8b5cf6.svg)](#)
[![AI Architecture](https://img.shields.io/badge/AI%20Model-GPT--OSS--120B%20(Open--Weight)-f59e0b.svg)](#)
[![Tests Passing](https://img.shields.io/badge/Tests-11%2F11%20Passed%20(100%25)-10b981.svg)](#)

---

## 1. Project Overview

**TrustMesh** is a decentralized trust intelligence network that enables independent open-source repositories to exchange contributor trust signals, detect synchronized AI-generated docstring slop campaigns, and make fair, evidence-based moderation decisions without relying on a central authority.

### The Problem
AI-generated pull requests, automated typo-fix bots, and templated slop campaigns spread across independent repositories. When maintainers operate in silos:
1. **Isolated Projects**: Each repository sees only a fraction of coordinated bot swarms.
2. **Coordinated Abuse**: Sybil swarms rotate identities to spam trivial docstring changes across dozens of projects simultaneously.
3. **Missing Context**: Maintainers lack a shared, evidence-based ledger to verify whether an account has verified peer endorsements or unresolved allegations.

### The TrustMesh Solution
Instead of requiring projects to blindly trust each other or an arbitrary scoring algorithm, TrustMesh establishes a **subjective, policy-driven trust mesh**:
- Every project configures its own peer weights and strictness.
- Endorsements (**Vouches**) and allegations (**Denouncements**) require verifiable pull request evidence URLs and provenance hashes.
- **Fairness Guarantee**: First-time contributors are assigned a neutral `NEWCOMER` baseline and are never penalized for lack of history.
- An allegation is treated as unverified until maintainer triage confirms it.
- Trust scores are completely deterministic and transparently explainable.

---

## 2. Team Information — Nexora

- **Kartik Goyal**
- **Akshay Kumar Modi**
- **Avi Garg**

**Selected Track**: Problem 07 — *A Trust Network Against AI Slop*  
**Hackathon Event**: Hacktoberfest 2026

---

## 3. Core Architecture & System Design

```
+--------------------------------------------------------------------------+
|                           TrustMesh Frontend                             |
|          React 19 + Vite + Tailwind CSS v4 + @xyflow/react               |
+--------------------------------------------------------------------------+
                                     |
                                     | JSON REST API (/api)
                                     v
+--------------------------------------------------------------------------+
|                         FastAPI Python Backend                           |
|                                                                          |
|  +-----------------------+  +-----------------------+  +--------------+  |
|  | Trust Engine          |  | Campaign Radar        |  | Federation   |  |
|  | (Deterministic/Policy)|  | (Pattern Forensics)   |  | (Import/Exp) |  |
|  +-----------------------+  +-----------------------+  +--------------+  |
|                                     |                                    |
|                      +--------------+--------------+                     |
|                      |                             |                     |
|                      v                             v                     |
|           +--------------------+         +--------------------+          |
|           | SQLite Persistence |         | AI Explanation     |          |
|           | (SQLAlchemy 2.0)   |         | (GPT-OSS-120B /    |          |
|           +--------------------+         | Deterministic Svc) |          |
|                                          +--------------------+          |
+--------------------------------------------------------------------------+
```

### AI Model Integration: GPT-OSS-120B
- **Open-Weight Architecture**: TrustMesh utilizes **GPT-OSS-120B**, an open-weight model released under the Apache 2.0 license, via OpenRouter or local endpoints.
- **Role of AI**: AI is strictly used for **summarizing evidence diffs** and explaining coordinated multi-repository patterns to human maintainers.
- **Deterministic Independence**: All trust scores, reputation states, and policy weights are calculated deterministically by the Python engine.
- **Graceful Offline Mode**: When an API key is not configured, the platform seamlessly runs with the **Deterministic Intelligence Engine** with clear UI status badges.

---

## 4. Key Capabilities & Demonstration Scenarios

### 1. Interactive Topological Graph (React Flow)
- Dynamic visualization of project nodes, contributor nodes, peer vouches, and reported allegations.
- Zoom, pan, drag nodes, filter by relationship type (`Vouches`, `Reports`, `High Confidence`), and search contributors.
- Selected node side drawer reveals repository policies or contributor explainability breakdowns.

### 2. Explainable Trust Evaluation Engine
- Evaluates a contributor from the viewpoint of any selected repository (`viewing_project_id`).
- When viewed from `HyperFlow Engine`, `CloudNative Router` signals carry full 1.0 weight, while signals from unpeered projects are appropriately discounted.
- Explicit reputation states:
  - `NEWCOMER`: Clean slate, zero penalties (Principle #1).
  - `ESTABLISHED`: Multiple positive vouches backed by verifiable PRs.
  - `UNDER REVIEW`: Active reports pending triage or detected campaign membership.
  - `INSUFFICIENT EVIDENCE`: Emerging profile requiring further corroboration.

### 3. Coordinated Campaign Detection (AI Slop Radar)
- Deterministic pattern engine flags synchronized burst PRs across repos.
- Includes pre-seeded campaign **`CMP-2026-AI-SLOP-CLUSTER-A`** ("Automated Docstring & Typo-Fix AI Slop Wave") demonstrating multi-repo template matching and commit diff forensics.

### 4. Functional Vouch & Denouncement Systems
- Working submission forms with real-time client & server validation.
- Every vouch calculates a SHA-256 provenance hash.
- Every report starts as `Pending Review` with an inline triage workflow for maintainers to investigate or dismiss false allegations.

### 5. Cross-Network Federation
- Export signed repository trust bundles as standardized JSON envelopes (`/api/federation/export/{id}`).
- Import external bundles to dynamically integrate peer trust signals (`/api/federation/import`).

---

## 5. Getting Started & Running Locally

### Prerequisites
- **Node.js** (v18+ or v20+)
- **Python** (3.11, 3.12, or 3.13)

### Backend Setup

```bash
# 1. Navigate to repository root
cd /path/to/TrustMesh

# 2. Activate virtual environment (or create one)
python3 -m venv backend/.venv
source backend/.venv/bin/activate

# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Run automated test suite
PYTHONPATH=backend pytest backend/tests/ -v

# 5. Start the FastAPI server (Port 8000)
PYTHONPATH=backend uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend automatically creates `trustmesh.db` and seeds rich synthetic demo data on first launch.

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install npm dependencies
npm install

# 3. Start Vite dev server (Port 5173 with automatic backend proxy)
npm run dev -- --host 127.0.0.1 --port 5173

# 4. Production build check
npm run build
```

Open your browser at **`http://127.0.0.1:5173`**.

---

## 6. Backend API Documentation

When the backend is running, interactive Swagger/OpenAPI documentation is available at **`http://127.0.0.1:8000/docs`**.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, team identity, and version info |
| `GET` | `/api/projects` | List all federated repositories with policies |
| `PATCH` | `/api/projects/{id}` | Tune project trust policy and peer weights |
| `GET` | `/api/contributors` | List contributors with search and state filtering |
| `GET` | `/api/trust/evaluate` | Evaluate contributor from a specific project perspective |
| `GET` | `/api/trust/overview` | Platform metrics, activity stream, and distribution |
| `GET` | `/api/network` | Node and edge topology formatted for React Flow |
| `GET` | `/api/vouches` | List all positive peer vouches |
| `POST` | `/api/vouches` | Submit a vouch with PR evidence and provenance |
| `GET` | `/api/denouncements` | List reports with status filtering |
| `POST` | `/api/denouncements` | Submit a report (starts in 'Pending Review') |
| `PATCH` | `/api/denouncements/{id}/status` | Maintainer triage (Review / Dismiss) |
| `GET` | `/api/campaigns` | Coordinated AI slop and sybil campaign radar |
| `GET` | `/api/evidence` | Cross-repository evidence records |
| `GET` | `/api/federation/export/{id}` | Export signed project trust bundle |
| `POST` | `/api/federation/import` | Import external federation bundle |
| `POST` | `/api/ai/explain` | Evidence summarization via GPT-OSS-120B |
| `POST` | `/api/ai/reset-demo` | Reset database back to clean synthetic seed state |

---

## 7. Automated Test Suite Results

All 11 tests pass with 100% coverage across core modules:
```
backend/tests/test_trustmesh.py::test_health_check PASSED
backend/tests/test_trustmesh.py::test_list_projects PASSED
backend/tests/test_trustmesh.py::test_newcomer_fairness PASSED
backend/tests/test_trustmesh.py::test_established_contributor_evaluation PASSED
backend/tests/test_trustmesh.py::test_conflicting_signals_evaluation PASSED
backend/tests/test_trustmesh.py::test_project_specific_policy_weighting PASSED
backend/tests/test_trustmesh.py::test_submit_vouch PASSED
backend/tests/test_trustmesh.py::test_submit_denouncement_fairness PASSED
backend/tests/test_trustmesh.py::test_network_graph PASSED
backend/tests/test_trustmesh.py::test_coordinated_campaigns PASSED
backend/tests/test_trustmesh.py::test_federation_export_and_import PASSED

======================== 11 passed in 0.61s =========================
```

---

## 8. License

Licensed under the [Apache License, Version 2.0](LICENSE).  
Copyright (c) 2026 Team Nexora (Kartik Goyal, Akshay Kumar Modi, Avi Garg).
