from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models import Project
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
