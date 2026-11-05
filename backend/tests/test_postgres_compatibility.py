import os
import json
import pytest
from unittest.mock import patch
from datetime import datetime
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.core.config import get_database_url, Settings
from app.database.session import Base
from app.main import run_migrations
from app.services.seed_data import seed_database
from app.models import (
    User, Project, Contributor, GitHubCredential,
    ProjectTrustEdge, Vouch, Denouncement, CoordinatedCampaign,
    GitHubPullRequest, ActivityLog, EmailNotification
)
from scripts.migrate_sqlite_to_postgres import normalize_pg_url, migrate

def test_database_url_normalization_and_priority():
    # 1. postgres:// must normalize to postgresql:// for SQLAlchemy 2.0
    with patch.dict(os.environ, {"DATABASE_URL": "postgres://user:pass@db.example.com:5432/trustmesh"}, clear=False):
        url = get_database_url()
        assert url == "postgresql://user:pass@db.example.com:5432/trustmesh"

    # 2. POSTGRES_URL fallback
    env_clean = {k: v for k, v in os.environ.items() if k not in ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"]}
    env_clean["POSTGRES_URL"] = "postgres://pg_user:pg_pass@pg.example.com/mydb"
    with patch.dict(os.environ, env_clean, clear=True):
        url = get_database_url()
        assert url == "postgresql://pg_user:pg_pass@pg.example.com/mydb"

    # 3. Serverless fallback when no DB env vars are configured
    with patch.dict(os.environ, {"VERCEL": "1"}, clear=True):
        url = get_database_url()
        assert url == "sqlite:////tmp/trustmesh.db"

def test_normalize_pg_url_helper():
    assert normalize_pg_url("postgres://user:pass@host/db") == "postgresql://user:pass@host/db"
    assert normalize_pg_url("postgresql://user:pass@host/db") == "postgresql://user:pass@host/db"
    assert normalize_pg_url("  postgres://user:pass@host/db  ") == "postgresql://user:pass@host/db"

def test_database_agnostic_run_migrations():
    # Test on a temporary database
    engine = create_engine("sqlite:///:memory:")
    # Run migrations before tables exist (should cleanly no-op without error)
    run_migrations(engine)

    # Now create Base metadata
    Base.metadata.create_all(bind=engine)

    # Run migrations after tables exist (should inspect and ensure all columns without error)
    run_migrations(engine)

    # Verify columns exist via inspector
    inspector = inspect(engine)
    cols = {col["name"] for col in inspector.get_columns("projects")}
    expected_cols = {
        "is_github_connected", "github_owner", "github_repo",
        "default_branch", "visibility", "github_created_at",
        "github_updated_at", "last_synced_at", "sync_status", "sync_error"
    }
    assert expected_cols.issubset(cols)

def test_authoritative_seed_bootstrap_on_empty_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Verify empty DB
    assert db.query(Project).count() == 0

    # Run seed_database - should automatically bootstrap from authoritative_seed.json
    seed_database(db, reset=False)

    # Verify canonical records were imported
    project_count = db.query(Project).count()
    contributor_count = db.query(Contributor).count()
    pr_count = db.query(GitHubPullRequest).count()

    assert project_count >= 12
    assert contributor_count >= 134
    assert pr_count >= 152

    # Verify admin identity is intact
    admin = db.query(User).filter(User.email == "akshay123modi@gmail.com").first()
    assert admin is not None
    assert admin.is_admin is True

    # Verify that running seed_database again is completely idempotent and does not wipe or double-insert
    seed_database(db, reset=False)
    assert db.query(Project).count() == project_count
    assert db.query(Contributor).count() == contributor_count
    assert db.query(GitHubPullRequest).count() == pr_count

def test_migration_tool_idempotency(tmp_path):
    target_db_path = tmp_path / "migrated_test.db"
    target_url = f"sqlite:///{target_db_path}"

    # First migration run
    migrate(sqlite_path="trustmesh.db", postgres_url=target_url, dry_run=False)

    target_engine = create_engine(target_url)
    Session = sessionmaker(bind=target_engine)
    target_db = Session()

    first_projects = target_db.query(Project).count()
    first_contributors = target_db.query(Contributor).count()
    first_vouches = target_db.query(Vouch).count()
    first_prs = target_db.query(GitHubPullRequest).count()

    assert first_projects == 12
    assert first_contributors == 134
    assert first_vouches == 12
    assert first_prs == 152

    # Second migration run (idempotency verification)
    migrate(sqlite_path="trustmesh.db", postgres_url=target_url, dry_run=False)

    second_projects = target_db.query(Project).count()
    second_contributors = target_db.query(Contributor).count()
    second_vouches = target_db.query(Vouch).count()
    second_prs = target_db.query(GitHubPullRequest).count()

    assert second_projects == first_projects
    assert second_contributors == first_contributors
    assert second_vouches == first_vouches
    assert second_prs == first_prs

