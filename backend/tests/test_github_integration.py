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


# --- 6. Robust PR Synchronization & Flexible Project Lookup Tests ---

def test_sync_existing_registered_repository(client, db_session):
    """Test synchronizing PRs for an already registered repository."""
    proj = db_session.query(Project).filter(Project.id == "proj-gh-microsoftdocs-azure-docs").first()
    if not proj:
        proj = Project(
            id="proj-gh-microsoftdocs-azure-docs",
            name="MicrosoftDocs/azure-docs",
            slug="gh-microsoftdocs-azure-docs",
            repo_url="https://github.com/MicrosoftDocs/azure-docs",
            github_owner="MicrosoftDocs",
            github_repo="azure-docs",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    mock_prs = MagicMock()
    mock_prs.status_code = 200
    mock_prs.json.return_value = [
        {
            "number": 501,
            "title": "Update Azure Kubernetes documentation",
            "body": "Clarify cluster autoscaler configuration.",
            "user": {"login": "azure-writer", "avatar_url": "https://github.com/azure-writer.png"},
            "state": "open",
            "merged_at": None,
            "created_at": "2026-10-01T10:00:00Z",
            "updated_at": "2026-10-02T10:00:00Z",
            "base": {"ref": "main"},
            "head": {"ref": "docs/aks"},
            "html_url": "https://github.com/MicrosoftDocs/azure-docs/pull/501",
            "commits": 2,
            "draft": False
        }
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_prs
        res = client.post("/api/github/projects/proj-gh-microsoftdocs-azure-docs/sync")

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["project_id"] == "proj-gh-microsoftdocs-azure-docs"
    assert data["synced_pull_requests"] >= 1

    # Verify pulls endpoint also resolves
    pulls_res = client.get("/api/github/projects/proj-gh-microsoftdocs-azure-docs/pulls")
    assert pulls_res.status_code == 200
    pulls = pulls_res.json()
    assert any(p["pr_number"] == 501 for p in pulls)


def test_sync_flexible_id_variants_lookup(client, db_session):
    """Test that sync and pulls resolve projects by slug, owner/repo, or stripped prefixes."""
    proj = db_session.query(Project).filter(Project.id == "proj-azure-alias-test").first()
    if not proj:
        proj = Project(
            id="proj-azure-alias-test",
            name="Azure/docs-alias",
            slug="azure-docs-alias",
            repo_url="https://github.com/Azure/docs-alias",
            github_owner="Azure",
            github_repo="docs-alias",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    # Find project via GitHubService.find_project with different variants
    assert GitHubService.find_project(db_session, "proj-azure-alias-test") is proj
    assert GitHubService.find_project(db_session, "azure-docs-alias") is proj
    assert GitHubService.find_project(db_session, "proj-gh-azure-docs-alias") is proj
    assert GitHubService.find_project(db_session, "Azure/docs-alias") is proj
    assert GitHubService.find_project(db_session, "https://github.com/Azure/docs-alias") is proj


def test_sync_unregistered_repository_auto_registration(client, db_session):
    """Test that a valid GitHub repo passed as an unregistered identifier is auto-registered."""
    def mock_github_get(url, *args, **kwargs):
        mock_r = MagicMock()
        if "/pulls" in url:
            mock_r.status_code = 200
            mock_r.json.return_value = [
                {
                    "number": 1,
                    "title": "Initial pull request",
                    "body": "First PR in repo",
                    "user": {"login": "dev1", "avatar_url": "https://github.com/dev1.png"},
                    "state": "open",
                    "merged_at": None,
                    "created_at": "2026-10-01T00:00:00Z",
                    "updated_at": "2026-10-01T00:00:00Z",
                    "base": {"ref": "main"},
                    "head": {"ref": "patch-1"},
                    "html_url": "https://github.com/auto-org/auto-repo/pull/1",
                    "commits": 1,
                    "draft": False
                }
            ]
        elif "/repos/auto-org/auto-repo" in url:
            mock_r.status_code = 200
            mock_r.json.return_value = repo_meta_dict
        else:
            mock_r.status_code = 404
            mock_r.json.return_value = {"message": "Not Found"}
        return mock_r

    repo_meta_dict = {
        "owner": {"login": "auto-org"},
        "name": "auto-repo",
        "full_name": "auto-org/auto-repo",
        "description": "Auto registered repo",
        "default_branch": "main",
        "private": False,
        "html_url": "https://github.com/auto-org/auto-repo",
        "stargazers_count": 888,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2026-10-31T00:00:00Z"
    }

    with patch("httpx.Client.get", side_effect=mock_github_get):
        res = client.post("/api/github/projects/proj-gh-auto-org-auto-repo/sync")

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["project_name"] == "auto-org/auto-repo"

    # Verify project now exists in database
    created = db_session.query(Project).filter(Project.id == "proj-gh-auto-org-auto-repo").first()
    assert created is not None
    assert created.is_github_connected is True


def test_sync_unregistered_repository_actionable_error_on_404(client):
    """Test that a nonexistent repository returns 404 with a helpful actionable message."""
    mock_resp = MagicMock()
    mock_resp.status_code = 404

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_resp
        res = client.post("/api/github/projects/proj-gh-nonexistent-user-bogus-repo-99999/sync")

    assert res.status_code == 404
    detail = res.json()["detail"]
    assert "not registered in TrustMesh" in detail
    assert "Import GitHub Repo" in detail


def test_sync_empty_pr_response(client, db_session):
    """Test synchronization when a repository has 0 pull requests on GitHub."""
    proj = db_session.query(Project).filter(Project.id == "proj-gh-empty-prs-repo").first()
    if not proj:
        proj = Project(
            id="proj-gh-empty-prs-repo",
            name="empty-org/zero-prs",
            slug="gh-empty-org-zero-prs",
            repo_url="https://github.com/empty-org/zero-prs",
            github_owner="empty-org",
            github_repo="zero-prs",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    empty_prs = MagicMock()
    empty_prs.status_code = 200
    empty_prs.json.return_value = []

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = empty_prs
        res = client.post("/api/github/projects/proj-gh-empty-prs-repo/sync")

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["synced_pull_requests"] == 0
    assert "0 pull requests" in data["message"]


def test_sync_authentication_failure_401(client, db_session):
    """Test that a 401 Unauthorized from GitHub returns 502 with a clear authentication error."""
    proj = db_session.query(Project).filter(Project.id == "proj-gh-auth-fail-repo").first()
    if not proj:
        proj = Project(
            id="proj-gh-auth-fail-repo",
            name="secret-org/private-repo",
            slug="gh-secret-org-private-repo",
            repo_url="https://github.com/secret-org/private-repo",
            github_owner="secret-org",
            github_repo="private-repo",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    unauth_resp = MagicMock()
    unauth_resp.status_code = 401

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = unauth_resp
        res = client.post("/api/github/projects/proj-gh-auth-fail-repo/sync")

    assert res.status_code == 502
    assert "authentication failed" in res.json()["detail"].lower()


def test_sync_repeated_without_duplicate_records(client, db_session):
    """Test that running sync multiple times on the same repo updates records without duplicating them."""
    proj = db_session.query(Project).filter(Project.id == "proj-gh-dedup-test").first()
    if not proj:
        proj = Project(
            id="proj-gh-dedup-test",
            name="dedup-org/dedup-repo",
            slug="gh-dedup-org-dedup-repo",
            repo_url="https://github.com/dedup-org/dedup-repo",
            github_owner="dedup-org",
            github_repo="dedup-repo",
            is_github_connected=True
        )
        db_session.add(proj)
        db_session.commit()

    mock_prs = MagicMock()
    mock_prs.status_code = 200
    mock_prs.json.return_value = [
        {
            "number": 10,
            "title": "PR number 10",
            "body": "First version",
            "user": {"login": "coder-a", "avatar_url": "https://github.com/coder-a.png"},
            "state": "open",
            "merged_at": None,
            "created_at": "2026-10-01T00:00:00Z",
            "updated_at": "2026-10-01T00:00:00Z",
            "base": {"ref": "main"},
            "head": {"ref": "patch-10"},
            "html_url": "https://github.com/dedup-org/dedup-repo/pull/10",
            "commits": 1,
            "draft": False
        },
        {
            "number": 11,
            "title": "PR number 11",
            "body": "First version",
            "user": {"login": "coder-b", "avatar_url": "https://github.com/coder-b.png"},
            "state": "open",
            "merged_at": None,
            "created_at": "2026-10-02T00:00:00Z",
            "updated_at": "2026-10-02T00:00:00Z",
            "base": {"ref": "main"},
            "head": {"ref": "patch-11"},
            "html_url": "https://github.com/dedup-org/dedup-repo/pull/11",
            "commits": 2,
            "draft": False
        }
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_get.return_value = mock_prs
        # Sync 1
        res1 = client.post("/api/github/projects/proj-gh-dedup-test/sync")
        assert res1.status_code == 200

        count_after_sync1 = db_session.query(GitHubPullRequest).filter(
            GitHubPullRequest.project_id == "proj-gh-dedup-test"
        ).count()
        assert count_after_sync1 == 2

        # Sync 2 with updated PR titles
        mock_prs.json.return_value[0]["title"] = "PR number 10 updated"
        res2 = client.post("/api/github/projects/proj-gh-dedup-test/sync")
        assert res2.status_code == 200

        count_after_sync2 = db_session.query(GitHubPullRequest).filter(
            GitHubPullRequest.project_id == "proj-gh-dedup-test"
        ).count()
        # Exactly 2 records, 0 duplicates!
        assert count_after_sync2 == 2

        # Verify title was updated in-place
        pr10 = db_session.query(GitHubPullRequest).filter(
            GitHubPullRequest.id == "ghpr-proj-gh-dedup-test-10"
        ).first()
        assert pr10 is not None
        assert pr10.title == "PR number 10 updated"

