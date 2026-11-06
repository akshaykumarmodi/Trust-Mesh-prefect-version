import os
# Ensure test suite runs in isolated test environment without sending real external emails
os.environ["GMAIL_USER"] = ""
os.environ["GMAIL_APP_PASSWORD"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASSWORD"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ["EMAIL_PROVIDER"] = "auto"

from app.core.config import settings
settings.GMAIL_USER = ""
settings.GMAIL_APP_PASSWORD = ""
settings.SMTP_USER = ""
settings.SMTP_PASSWORD = ""
settings.RESEND_API_KEY = ""
settings.EMAIL_PROVIDER = "auto"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base, get_db
from app.main import app
from app.services.seed_data import seed_database

# Shared in-memory test database with StaticPool
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

def _inject_test_fixtures(db):
    from datetime import datetime, timezone, timedelta
    from app.models import (
        Project, Contributor, Vouch, Denouncement, CoordinatedCampaign
    )
    now = datetime.now(timezone.utc)

    # Test Projects
    p1 = Project(
        id="proj-hyperflow",
        name="HyperFlow Engine",
        slug="hyperflow-engine",
        description="High-performance async distributed execution runtime",
        category="Infrastructure",
        stars=14200,
        trust_policy_json='{"strictness":"strict","min_confidence":0.75,"peer_weights":{"proj-cryptomesh":0.9,"proj-cloudnative":0.8}}'
    )
    p2 = Project(
        id="proj-cryptomesh",
        name="CryptoMesh Core",
        slug="cryptomesh-core",
        description="Zero-knowledge verifiable compute and cryptographic state channels",
        category="Cryptography",
        stars=8900,
        trust_policy_json='{"strictness":"paranoid","min_confidence":0.85,"peer_weights":{"proj-hyperflow":0.95}}'
    )
    p3 = Project(
        id="proj-devpulse",
        name="DevPulse CLI",
        slug="devpulse-cli",
        description="Developer workflow observability and git provenance CLI",
        category="Developer Tools",
        stars=4300,
        trust_policy_json='{"strictness":"balanced","min_confidence":0.60,"peer_weights":{"proj-hyperflow":0.8}}'
    )
    p4 = Project(
        id="proj-tensorserve",
        name="TensorServe ML",
        slug="tensorserve-ml",
        description="Lightweight inference runtime for open-weights models",
        category="Machine Learning",
        stars=11200,
        trust_policy_json='{"strictness":"balanced","min_confidence":0.60,"peer_weights":{}}'
    )
    for p in [p1, p2, p3, p4]:
        db.merge(p)

    # Test Contributors
    c1 = Contributor(
        id="contrib-elena",
        username="elena-rustacean",
        display_name="Elena Rostova",
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        bio="Rust kernel contributor, async runtime specialist, and distributed systems researcher.",
        reputation_state="ESTABLISHED",
        total_contributions=42
    )
    c2 = Contributor(
        id="contrib-sarah",
        username="sarah-sec",
        display_name="Dr. Sarah Chen",
        avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
        bio="Cryptography engineer, constant-time algorithms auditor, and formal verification lead.",
        reputation_state="ESTABLISHED",
        total_contributions=28
    )
    c3 = Contributor(
        id="contrib-alex",
        username="alex-polyglot",
        display_name="Alex Rivera",
        avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        bio="Full-stack contributor and CLI tooling enthusiast.",
        reputation_state="UNDER REVIEW",
        total_contributions=15
    )
    c4 = Contributor(
        id="contrib-marcus",
        username="marcus-dev",
        display_name="Marcus Vance",
        avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        bio="New open source contributor exploring distributed systems.",
        reputation_state="NEWCOMER",
        total_contributions=1
    )
    for c in [c1, c2, c3, c4]:
        db.merge(c)

    # Test Vouches
    v1 = Vouch(
        id="vouch-elena-1",
        contributor_id="contrib-elena",
        source_project_id="proj-hyperflow",
        reason="Authored high-throughput zero-copy ring buffer PR that improved async throughput by 42%.",
        evidence_url="https://github.com/hyperflow-org/hyperflow/pull/342",
        confidence=0.95,
        provenance_hash="sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
    )
    v2 = Vouch(
        id="vouch-elena-2",
        contributor_id="contrib-elena",
        source_project_id="proj-cryptomesh",
        reason="Responsible cryptographic timing analysis and hardened connection state machine.",
        evidence_url="https://github.com/cryptomesh/core/pull/101",
        confidence=0.90,
        provenance_hash="sha256:8a83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9070"
    )
    v_alex = Vouch(
        id="vouch-alex-1",
        contributor_id="contrib-alex",
        source_project_id="proj-devpulse",
        reason="Redesigned interactive terminal CLI output with graceful fallbacks.",
        evidence_url="https://github.com/devpulse/cli/pull/50",
        confidence=0.85,
        provenance_hash="sha256:9b83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9071"
    )
    for v in [v1, v2, v_alex]:
        db.merge(v)

    # Test Denouncement
    d1 = Denouncement(
        id="denounce-alex-1",
        contributor_id="contrib-alex",
        reporting_project_id="proj-cryptomesh",
        reason="Unverified Dependency Injection: Attempted to add external untrusted npm package in crypto core.",
        evidence_url="https://github.com/cryptomesh/core/pull/189",
        status="Under Investigation",
        details="Discovered unreviewed binary payload in transitive dependency."
    )
    db.merge(d1)

    # Test Campaign
    cmp1 = CoordinatedCampaign(
        id="cmp-slop-cluster-a",
        campaign_code="CMP-2026-AI-SLOP-CLUSTER-A",
        name="Automated LLM Docstring Slop Swarm",
        pattern_type="SYNCHRONIZED_PR_BURST",
        status="Active Investigation",
        signal_strength=0.94,
        description="Synchronized bursts of AI-generated docstring PRs across multiple repositories.",
        affected_projects_json='["proj-hyperflow", "proj-cryptomesh"]',
        contributor_ids_json='["contrib-slop-bot"]'
    )
    db.merge(cmp1)
    db.commit()

@pytest.fixture(scope="session", autouse=True)
def initialize_database():
    Base.metadata.create_all(bind=test_engine)
    db = TestSession()
    seed_database(db, reset=True)
    _inject_test_fixtures(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
