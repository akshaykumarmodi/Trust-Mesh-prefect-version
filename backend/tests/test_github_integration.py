import hmac
import hashlib
import pytest
from unittest.mock import patch, MagicMock
from app.models import Project, Contributor, GitHubPullRequest
from app.services.github_service import GitHubService

# --- 1. URL Parsing Tests ---
def test_parse_github_url_valid():
    owner, repo = GitHubService.parse_github_url("https://github.com/fastapi/fastapi")
    assert owner == "fastapi"
    assert repo == "fastapi"

    owner, repo = GitHubService.parse_github_url("https://github.com/facebook/react.git")
    assert owner == "facebook"
    assert repo == "react"

    owner, repo = GitHubService.parse_github_url("http://www.github.com/rust-lang/rust/")
    assert owner == "rust-lang"
    assert repo == "rust"

def test_parse_github_url_invalid():
    with pytest.raises(ValueError, match="Expected format"):
        GitHubService.parse_github_url("https://gitlab.com/owner/repo")

    with pytest.raises(ValueError, match="Expected format"):
        GitHubService.parse_github_url("https://github.com/only-owner")

    with pytest.raises(ValueError, match="reserved GitHub namespace"):
        GitHubService.parse_github_url("https://github.com/marketplace/actions")

    with pytest.raises(ValueError, match="non-empty string"):
        GitHubService.parse_github_url("")

# --- 2. Public Repository Import & Duplicate Prevention ---
def test_import_public_repository_success(client):
    repo_meta_response = MagicMock()
    repo_meta_response.status_code = 200
    repo_meta_response.json.return_value = {
        "owner": {"login": "hyperflow-runtime"},
        "name": "distributed-core",
        "full_name": "hyperflow-runtime/distributed-core",
        "description": "Distributed async workflow runtime",
        "default_branch": "main",
        "private": False,
        "html_url": "https://github.com/hyperflow-runtime/distributed-core",
        "stargazers_count": 14200,
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2026-10-30T12:00:00Z"
    }

    prs_response = MagicMock()
    prs_response.status_code = 200
    prs_response.json.return_value = [
        {
            "number": 101,
            "title": "Optimize async queue ring buffer",
            "body": "Zero-copy memory optimization for task dispatch.",
            "user": {"login": "elena-rustacean", "avatar_url": "https://github.com/elena.png"},
            "state": "closed",
            "merged_at": "2026-09-12T15:00:00Z",
            "created_at": "2026-09-10T12:00:00Z",
            "updated_at": "2026-09-12T15:00:00Z",
            "base": {"ref": "main"},
            "head": {"ref": "perf/ring-buffer"},
            "html_url": "https://github.com/hyperflow-runtime/distributed-core/pull/101",
            "commits": 3,
            "draft": False
        }
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_get.side_effect = [repo_meta_response, prs_response]
        res = client.post("/api/github/import-repo", json={
            "repo_url": "https://github.com/hyperflow-runtime/distributed-core",
            "category": "Distributed Systems"
        })

    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "hyperflow-runtime/distributed-core"
    assert data["is_github_connected"] is True
    assert data["github_owner"] == "hyperflow-runtime"
    assert data["github_repo"] == "distributed-core"
    assert data["stars"] == 14200

    pulls_res = client.get(f"/api/github/projects/{data['id']}/pulls")
    assert pulls_res.status_code == 200
    pulls = pulls_res.json()
    assert len(pulls) >= 1
    assert any(p["pr_number"] == 101 and p["state"] == "merged" for p in pulls)

def test_import_duplicate_repository_prevention(client):
    repo_meta = MagicMock()
    repo_meta.status_code = 200
    repo_meta.json.return_value = {
        "owner": {"login": "cloudnative"},
        "name": "router",
        "full_name": "cloudnative/router",
        "description": "eBPF router",
        "default_branch": "main",
        "private": False,
        "html_url": "https://github.com/cloudnative/router",
        "stargazers_count": 5000,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2026-10-31T00:00:00Z"
    }

    prs_empty = MagicMock()
    prs_empty.status_code = 200
    prs_empty.json.return_value = []

    with patch("httpx.Client.get") as mock_get:
        mock_get.side_effect = [repo_meta, prs_empty]
        res1 = client.post("/api/github/import-repo", json={"repo_url": "https://github.com/cloudnative/router"})

    assert res1.status_code == 200
    p1 = res1.json()

    with patch("httpx.Client.get") as mock_get:
        mock_get.side_effect = [repo_meta, prs_empty]
        res2 = client.post("/api/github/import-repo", json={"repo_url": "https://github.com/cloudnative/router"})

    assert res2.status_code == 200
    p2 = res2.json()

    assert p1["id"] == p2["id"]

def test_import_repository_not_found_404(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 404

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_resp
        res = client.post("/api/github/import-repo", json={
            "repo_url": "https://github.com/nonexistent-org/missing-repo"
        })

    assert res.status_code == 400
    assert "not found" in res.json()["detail"].lower()

def test_import_repository_rate_limit_403(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.headers = {"x-ratelimit-remaining": "0"}

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_resp
        res = client.post("/api/github/import-repo", json={
            "repo_url": "https://github.com/busy-org/heavy-repo"
        })

    assert res.status_code == 502
    assert "rate limit" in res.json()["detail"].lower()

# --- 3. PR Authenticity Verification Service ---
def test_verify_pull_request_authenticity_valid(client, db_session):
    proj = db_session.query(Project).filter(Project.id == "proj-gh-test-auth").first()
    if not proj:
        proj = Project(
            id="proj-gh-test-auth",
            name="test-org/repo",
            slug="gh-test-org-repo-auth",
            repo_url="https://github.com/test-org/repo",
            github_owner="test-org",
            github_repo="repo",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "number": 42,
        "state": "open",
        "html_url": "https://github.com/test-org/repo/pull/42",
        "base": {"repo": {"owner": {"login": "test-org"}, "name": "repo"}}
    }

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_resp
        res = client.post("/api/github/verify-pr", json={
            "project_id": "proj-gh-test-auth",
            "pr_number": 42,
            "canonical_url": "https://github.com/test-org/repo/pull/42"
        })

    assert res.status_code == 200
    data = res.json()
    assert data["verification_status"] == "Verified GitHub record"
    assert data["repository_match"] is True

def test_verify_pull_request_authenticity_mismatch(client, db_session):
    proj = db_session.query(Project).filter(Project.id == "proj-gh-test2").first()
    if not proj:
        proj = Project(
            id="proj-gh-test2",
            name="legit-org/core",
            slug="gh-legit-org-core",
            repo_url="https://github.com/legit-org/core",
            github_owner="legit-org",
            github_repo="core",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "number": 42,
        "state": "open",
        "html_url": "https://github.com/imposter-org/core/pull/42",
        "base": {"repo": {"owner": {"login": "imposter-org"}, "name": "core"}}
    }

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_resp
        res = client.post("/api/github/verify-pr", json={
            "project_id": "proj-gh-test2",
            "pr_number": 42,
            "canonical_url": "https://github.com/legit-org/core/pull/42"
        })

    assert res.status_code == 200
    data = res.json()
    assert data["verification_status"] == "Unable to verify"
    assert data["repository_match"] is False

def test_verify_pull_request_nonexistent_404(client, db_session):
    proj = db_session.query(Project).filter(Project.id == "proj-gh-test3").first()
    if not proj:
        proj = Project(
            id="proj-gh-test3",
            name="my-org/my-repo",
            slug="gh-my-org-my-repo",
            repo_url="https://github.com/my-org/my-repo",
            github_owner="my-org",
            github_repo="my-repo",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    mock_resp = MagicMock()
    mock_resp.status_code = 404

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_resp
        res = client.post("/api/github/verify-pr", json={
            "project_id": "proj-gh-test3",
            "pr_number": 99999
        })

    assert res.status_code == 200
    data = res.json()
    assert data["verification_status"] == "Unable to verify"
    assert "not found" in data["verification_details"]

# --- 4. Webhook Signature and Processing ---
def test_webhook_signature_verification():
    secret = "test-webhook-secret-2026"
    payload = b'{"action":"opened","number":1}'
    valid_sig = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    assert GitHubService.verify_webhook_signature(payload, valid_sig, secret) is True
    assert GitHubService.verify_webhook_signature(payload, "sha256=invalid-signature", secret) is False
    assert GitHubService.verify_webhook_signature(payload, None, secret) is False

def test_webhook_pull_request_event(client, db_session):
    proj = db_session.query(Project).filter(Project.id == "proj-webhook-target").first()
    if not proj:
        proj = Project(
            id="proj-webhook-target",
            name="web-org/target-repo",
            slug="gh-web-org-target-repo",
            repo_url="https://github.com/web-org/target-repo",
            github_owner="web-org",
            github_repo="target-repo",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    webhook_payload = {
        "action": "opened",
        "repository": {
            "name": "target-repo",
            "owner": {"login": "web-org"}
        },
        "pull_request": {
            "number": 77,
            "title": "Add eBPF ingress filter",
            "body": "Kernel packet filtering implementation.",
            "state": "open",
            "html_url": "https://github.com/web-org/target-repo/pull/77",
            "user": {"login": "kernel-dev", "avatar_url": "https://github.com/kernel-dev.png"}
        }
    }

    res = client.post(
        "/api/github/webhook",
        json=webhook_payload,
        headers={"X-GitHub-Event": "pull_request"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "processed"

    pulls_res = client.get("/api/github/projects/proj-webhook-target/pulls")
    assert pulls_res.status_code == 200
    pulls = pulls_res.json()
    assert len(pulls) >= 1
    assert any(p["pr_number"] == 77 and p["author_username"] == "kernel-dev" for p in pulls)

# --- 5. Contributor Activity Integration ---
def test_imported_pr_in_contributor_activity(client, db_session):
    proj = db_session.query(Project).filter(Project.id == "proj-act-1").first()
    if not proj:
        proj = Project(
            id="proj-act-1",
            name="mesh/core",
            slug="gh-mesh-core",
            repo_url="https://github.com/mesh/core",
            github_owner="mesh",
            github_repo="core",
            is_github_connected=True
        )
        db_session.add(proj)

    contrib = db_session.query(Contributor).filter(Contributor.id == "contrib-gh-active-dev").first()
    if not contrib:
        contrib = Contributor(
            id="contrib-gh-active-dev",
            username="active-dev",
            display_name="Active Developer",
            reputation_state="NEWCOMER",
            total_contributions=1
        )
        db_session.add(contrib)

    pr = db_session.query(GitHubPullRequest).filter(GitHubPullRequest.id == "ghpr-proj-act-1-10").first()
    if not pr:
        pr = GitHubPullRequest(
            id="ghpr-proj-act-1-10",
            project_id="proj-act-1",
            pr_number=10,
            title="Refactor concurrency model",
            description="Async runtime concurrency cleanup",
            author_username="active-dev",
            state="merged",
            is_merged=True,
            html_url="https://github.com/mesh/core/pull/10",
            verification_status="Verified GitHub record"
        )
        db_session.add(pr)

    db_session.commit()

    res = client.get("/api/contributors/contrib-gh-active-dev/activity")
    assert res.status_code == 200
    timeline = res.json()["timeline"]
    assert len(timeline) >= 1
    assert any(item["type"] == "GITHUB_PR" and "Refactor concurrency model" in item["title"] for item in timeline)
