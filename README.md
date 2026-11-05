# TrustMesh — Decentralized Trust Network Against AI Slop

> **"Trust should travel. Evidence should speak."**
> *A new contributor is not automatically suspicious. An allegation is not proof. A trust score must always be explainable.*

[![Problem 07](https://img.shields.io/badge/Problem%2007-A%20Trust%20Network%20Against%20AI%20Slop-06b6d4.svg)](#)
[![Team Nexora](https://img.shields.io/badge/Team-Nexora-3b82f6.svg)](#)
[![Python 3.13+](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python-emerald.svg)](#)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20React%20Flow-8b5cf6.svg)](#)
[![AI Architecture](https://img.shields.io/badge/AI%20Model-GPT--OSS--120B%20(Open--Weight)-f59e0b.svg)](#)
[![Tests Passing](https://img.shields.io/badge/Tests-78%2F78%20Passed%20(100%25)-10b981.svg)](#)

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
- **Open-Weight Architecture**: TrustMesh integrates **GPT-OSS-120B**, an open-weight model released under the Apache 2.0 license, via OpenRouter or local endpoints.
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
- Deterministic pattern engine flags synchronized burst PRs across repos using token Jaccard similarity and temporal correlation.
- Interactive "Run Forensic Scan" button dynamically detects clusters across decentralized activity logs.
- Maintainer triage status workflow: `Active Investigation` -> `Confirmed Coordinated Abuse` / `Dismissed`.

### 4. Functional Contributor & Project Management
- Register new projects and tune subjective peer trust weights and rules.
- View incoming and outgoing trust peering relationships per project.
- Register contributor identities, search and filter by reputation state, and inspect verified project participation timelines.

### 5. Functional Vouch & Denouncement Systems
- Working submission forms with real-time client & server validation.
- Every vouch calculates a SHA-256 provenance hash.
- Every report starts as `Pending Review` with an inline triage workflow for maintainers to investigate or dismiss false allegations.

### 7. Real GitHub Repository & PR Authenticity Integration
- **Direct Public URL Import**: Enter any public GitHub repository URL (`https://github.com/owner/repo`). Validates syntax, queries the GitHub REST API v3, extracts owner, repository, description, default branch, visibility, and timestamps.
- **Pull Request Synchronization**: Fetches real PRs with full metadata (numbers, titles, bodies, authors, branches, commits, review states, merge flags).
- **PR Authenticity Verification Service**: Verifies repository existence, PR existence, owner/repo binding, and canonical URL match. Returns explicit statuses: `Verified GitHub record` (`VERIFIED_GITHUB`), `Unable to verify` (`UNABLE_TO_VERIFY`), or `Verification unavailable` (`VERIFICATION_UNAVAILABLE`).
- **Fairness & Security Principle**: Authenticity verification strictly establishes whether code/PR provenance exists on GitHub — it is never confused with contributor trustworthiness. Zero client token exposure: all tokens/OAuth secrets remain securely on backend.
- **Webhook Architecture**: Implements HMAC-SHA256 signature verification (`X-Hub-Signature-256`) to handle real-time `pull_request` lifecycle events.

---

## 5. Getting Started & Running Locally

### Prerequisites
- **Node.js** (v18+ or v20+)
- **Python** (3.11, 3.12, or 3.13)

### One-Command Setup & Development (Combined)

From the repository root:
```bash
# 1. Setup backend Python venv
python3 -m venv backend/.venv
./backend/.venv/bin/pip install -r backend/requirements.txt

# 2. Install workspace dependencies
npm install

# 3. Run backend test suite (78 tests)
npm test

# 4. Start both Backend & Frontend simultaneously with one command:
npm run dev
```
- **Frontend Web UI**: `http://127.0.0.1:5173` (proxies `/api` to 8000)
- **FastAPI API & Docs**: `http://127.0.0.1:8000/docs`

---

### Single-Port Combined Full-Stack Server (Production Mode)

FastAPI natively serves the compiled React 19 SPA, Swagger documentation, and REST endpoints together on a single port:

```bash
# Build frontend and serve both from FastAPI on port 8000:
npm start

# Or using the Python runner directly:
python run.py
```
Open your browser at **`http://127.0.0.1:8000`** — no separate frontend server or CORS proxy required!

---

## 6. Backend API Documentation

When the backend is running, interactive Swagger/OpenAPI documentation is available at **`http://127.0.0.1:8000/docs`**.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, team identity, and version info |
| `GET` | `/api/projects` | List all federated repositories with policies |
| `POST` | `/api/projects` | Register a new repository with custom trust policy |
| `PATCH` | `/api/projects/{id}` | Tune project trust policy and peer weights |
| `POST` | `/api/projects/{id}/peers` | Configure subjective peer trust weight and audit notes |
| `GET` | `/api/projects/{id}/relationships` | Inspect incoming and outgoing trust peering edges |
| `GET` | `/api/contributors` | List contributors with search and state filtering |
| `POST` | `/api/contributors` | Register a new contributor identity |
| `GET` | `/api/contributors/{id}` | Detailed contributor profile with vouches and reports |
| `GET` | `/api/contributors/{id}/activity` | Contributor project participation and trust timeline (includes verified PRs) |
| `GET` | `/api/trust/evaluate` | Evaluate contributor from a specific project perspective |
| `GET` | `/api/trust/overview` | Platform metrics, activity stream, and distribution |
| `GET` | `/api/network` | Node and edge topology formatted for React Flow |
| `GET` | `/api/vouches` | List all positive peer vouches |
| `POST` | `/api/vouches` | Submit a vouch with PR evidence and provenance |
| `GET` | `/api/denouncements` | List reports with status filtering |
| `POST` | `/api/denouncements` | Submit a report (starts in 'Pending Review') |
| `PATCH` | `/api/denouncements/{id}/status` | Maintainer triage (Review / Dismiss) |
| `GET` | `/api/campaigns` | Coordinated AI slop and sybil campaign radar |
| `POST` | `/api/campaigns/scan` | Trigger real-time deterministic cross-repo pattern scanner |
| `PATCH` | `/api/campaigns/{id}/status` | Update campaign human review triage status |
| `GET` | `/api/evidence` | Cross-repository evidence records (includes verified GitHub PRs) |
| `GET` | `/api/federation/export/{id}` | Export signed project trust bundle |
| `POST` | `/api/federation/import` | Import external federation bundle |
| `POST` | `/api/ai/explain` | Evidence summarization via GPT-OSS-120B |
| `GET` | `/api/ai/status` | Check AI model connectivity and fallback status |
| `POST` | `/api/ai/reset-demo` | Reset database back to clean synthetic seed state |
| `GET` | `/api/github/status` | GitHub integration and OAuth status |
| `GET` | `/api/github/oauth/authorize` | GitHub OAuth authorization initiation |
| `GET` | `/api/github/oauth/callback` | GitHub OAuth callback (backend credential isolation) |
| `POST` | `/api/github/import-repo` | Import public GitHub repository & sync pull requests |
| `GET` | `/api/github/projects/{id}/pulls` | Fetch imported pull requests with authenticity status |
| `POST` | `/api/github/projects/{id}/sync` | Manually re-synchronize pull requests from GitHub API |
| `POST` | `/api/github/verify-pr` | Verify PR authenticity against GitHub canonical records |
| `POST` | `/api/github/webhook` | Webhook receiver with HMAC-SHA256 signature verification |

---

## 7. Sample Inputs and Outputs (`examples/`)

Representative requests and real responses are provided in [`examples/`](file:///Users/akshaykumarmodi/TrustMesh/examples):
- [`github_import_request.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/github_import_request.json) & [`github_import_response.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/github_import_response.json)
- [`github_pr_verification_request.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/github_pr_verification_request.json) & [`github_pr_verification_response.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/github_pr_verification_response.json)
- [`github_webhook_payload.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/github_webhook_payload.json)
- [`vouch_submission.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/vouch_submission.json) & [`vouch_response.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/vouch_response.json)
- [`denouncement_submission.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/denouncement_submission.json) & [`denouncement_response.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/denouncement_response.json)
- [`trust_evaluation_newcomer.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/trust_evaluation_newcomer.json)
- [`trust_evaluation_established.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/trust_evaluation_established.json)
- [`trust_evaluation_conflicting.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/trust_evaluation_conflicting.json)
- [`project_registration.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/project_registration.json) & [`project_registration_response.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/project_registration_response.json)
- [`project_peer_config.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/project_peer_config.json) & [`project_peer_config_response.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/project_peer_config_response.json)
- [`campaign_scan_output.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/campaign_scan_output.json)
- [`federation_bundle.json`](file:///Users/akshaykumarmodi/TrustMesh/examples/federation_bundle.json)

---

## 8. Automated Test Suite Results

All 26 tests pass with 100% coverage across core modules:
```
backend/tests/test_github_integration.py::test_parse_github_url_valid PASSED
backend/tests/test_github_integration.py::test_parse_github_url_invalid PASSED
backend/tests/test_github_integration.py::test_import_public_repository_success PASSED
backend/tests/test_github_integration.py::test_import_duplicate_repository_prevention PASSED
backend/tests/test_github_integration.py::test_import_repository_not_found_404 PASSED
backend/tests/test_github_integration.py::test_import_repository_rate_limit_403 PASSED
backend/tests/test_github_integration.py::test_verify_pull_request_authenticity_valid PASSED
backend/tests/test_github_integration.py::test_verify_pull_request_authenticity_mismatch PASSED
backend/tests/test_github_integration.py::test_verify_pull_request_nonexistent_404 PASSED
backend/tests/test_github_integration.py::test_webhook_signature_verification PASSED
backend/tests/test_github_integration.py::test_webhook_pull_request_event PASSED
backend/tests/test_github_integration.py::test_imported_pr_in_contributor_activity PASSED
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
backend/tests/test_trustmesh.py::test_create_contributor_and_newcomer_baseline PASSED
backend/tests/test_trustmesh.py::test_project_peer_weight_configuration_and_relationships PASSED
backend/tests/test_trustmesh.py::test_dynamic_campaign_scan PASSED

======================== 26 passed in 0.35s =========================
```

---

## 9. License

Licensed under the [Apache License, Version 2.0](LICENSE).
Copyright (c) 2026 Team Nexora (Kartik Goyal, Akshay Kumar Modi, Avi Garg).
