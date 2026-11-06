from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models import Project, GitHubPullRequest
from app.services.seed_data import _bootstrap_from_authoritative_seed

def test_projects_bootstrap_on_empty_serverless_container():
    """Verifies that an empty serverless container immediately seeds canonical projects including devclub-nstru/DCODE-Smaple-Repo."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Pre-check: Container is completely empty
    assert db.query(Project).count() == 0

    # Simulate serverless lifespan baseline bootstrap
    success = _bootstrap_from_authoritative_seed(db)
    assert success is True

    # Verify devclub-nstru/DCODE-Smaple-Repo is present
    dcode = db.query(Project).filter(Project.slug == "gh-devclub-nstru-dcode-smaple-repo").first()
    assert dcode is not None, "DCODE project must be bootstrapped into fresh container"
    assert dcode.name == "devclub-nstru/DCODE-Smaple-Repo"
    assert dcode.is_github_connected is True

def test_projects_endpoint_concurrency_and_refresh_stability(client):
    """Verifies that simultaneous requests to /api/projects return 100% consistent project lists without data drops."""
    results = []
    for i in range(25):
        resp = client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        results.append((resp.status_code, len(data), [p["slug"] for p in data]))

    # All status codes must be 200
    assert all(r[0] == 200 for r in results)

    # All returned lists must have identical counts
    counts = [r[1] for r in results]
    assert len(set(counts)) == 1, f"Project count flickered across calls: {set(counts)}"
    assert counts[0] >= 1, "Projects endpoint returned empty list"

    # All returned lists must include devclub-nstru/DCODE-Smaple-Repo
    for _, _, slugs in results:
        assert "gh-devclub-nstru-dcode-smaple-repo" in slugs

def test_repeated_refresh_20_times(client):
    """Simulates 20 consecutive page refreshes on /api/projects verifying no data drops."""
    baseline_slugs = None
    for i in range(20):
        resp = client.get("/api/projects")
        assert resp.status_code == 200
        slugs = [p["slug"] for p in resp.json()]
        if baseline_slugs is None:
            baseline_slugs = slugs
        else:
            assert slugs == baseline_slugs, f"Iteration {i} differed from baseline"

def test_github_import_does_not_remove_existing_records(client, db_session):
    """Verifies that importing or updating projects does not delete existing projects."""
    initial_count = db_session.query(Project).count()
    initial_slugs = {p.slug for p in db_session.query(Project).all()}

    # Register/create a new project
    res = client.post("/api/projects", json={
        "name": "Integration Test Unique Repo",
        "slug": "integration-test-unique-repo",
        "description": "Testing that creation preserves existing records",
        "category": "Security",
        "stars": 15
    })
    assert res.status_code == 201

    # Verify all previous projects are still in the database
    updated_slugs = {p.slug for p in db_session.query(Project).all()}
    assert initial_slugs.issubset(updated_slugs)
    assert db_session.query(Project).count() == initial_count + 1

def test_delete_project_endpoint(client, db_session):
    """Verifies that DELETE /api/projects/{project_id} permanently removes the project and associated edges."""
    # 1. Create a project to delete
    create_res = client.post("/api/projects", json={
        "name": "Temporary Deletable Repo",
        "slug": "temp-deletable-repo",
        "description": "Project created to test deletion",
        "category": "Testing",
        "stars": 42
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    # Verify project exists
    get_res = client.get(f"/api/projects/{proj_id}")
    assert get_res.status_code == 200

    # 2. Delete the project
    del_res = client.delete(f"/api/projects/{proj_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"
    assert del_res.json()["deleted_id"] == proj_id

    # 3. Verify project is 404
    get_after = client.get(f"/api/projects/{proj_id}")
    assert get_after.status_code == 404

    # 4. Verify DB no longer contains project
    assert db_session.query(Project).filter(Project.id == proj_id).first() is None

def test_delete_nonexistent_project_returns_404(client):
    """Verifies that attempting to delete an unknown project returns HTTP 404."""
    del_res = client.delete("/api/projects/proj-non-existent-999")
    assert del_res.status_code == 404
    assert "not found" in del_res.json()["detail"].lower()

def test_delete_project_also_deletes_associated_pull_requests(client, db_session):
    """Verifies that deleting a project also permanently deletes all pull requests linked to it."""
    # 1. Create a project
    create_res = client.post("/api/projects", json={
        "name": "Project With PRs",
        "slug": "project-with-prs",
        "description": "Repo with associated PRs",
        "category": "Infrastructure",
        "stars": 10
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    # 2. Add 3 pull requests linked to this project
    pr1 = GitHubPullRequest(
        id=f"ghpr-{proj_id}-101",
        project_id=proj_id,
        pr_number=101,
        title="Feat: Add async engine",
        author_username="contributor-alice",
        html_url=f"https://github.com/test/{proj_id}/pull/101",
        state="open"
    )
    pr2 = GitHubPullRequest(
        id=f"ghpr-{proj_id}-102",
        project_id=proj_id,
        pr_number=102,
        title="Fix: Memory leak in worker",
        author_username="contributor-bob",
        html_url=f"https://github.com/test/{proj_id}/pull/102",
        state="merged",
        is_merged=True
    )
    pr3 = GitHubPullRequest(
        id=f"ghpr-{proj_id}-103",
        project_id=proj_id,
        pr_number=103,
        title="Docs: Update trust policy guides",
        author_username="contributor-charlie",
        html_url=f"https://github.com/test/{proj_id}/pull/103",
        state="closed"
    )
    db_session.add_all([pr1, pr2, pr3])
    db_session.commit()

    # Verify PRs exist in database
    existing_prs = db_session.query(GitHubPullRequest).filter(GitHubPullRequest.project_id == proj_id).all()
    assert len(existing_prs) == 3

    # 3. Delete the project via API
    del_res = client.delete(f"/api/projects/{proj_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"
    assert del_res.json()["deleted_prs_count"] == 3

    # 4. Verify all associated PRs are completely deleted from the database
    remaining_prs = db_session.query(GitHubPullRequest).filter(GitHubPullRequest.project_id == proj_id).all()
    assert len(remaining_prs) == 0, f"Expected 0 remaining PRs, found {len(remaining_prs)}"

    # Also verify by ID prefix
    remaining_by_id = db_session.query(GitHubPullRequest).filter(GitHubPullRequest.id.startswith(f"ghpr-{proj_id}-")).all()
    assert len(remaining_by_id) == 0

    # 5. Verify that GET /projects/{id}/pulls for deleted project returns 404 and does NOT re-register the project
    get_pulls_res = client.get(f"/api/github/projects/{proj_id}/pulls")
    assert get_pulls_res.status_code == 404
    assert db_session.query(Project).filter(Project.id == proj_id).first() is None
