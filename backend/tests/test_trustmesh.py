import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database.session import Base, get_db
from app.main import app
from app.services.seed_data import seed_database
from app.services.trust_engine import TrustEvaluationEngine

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["author"] == "Akshay Kumar Modi"

def test_list_projects():
    response = client.get("/api/projects")
    assert response.status_code == 200
    projects = response.json()
    assert len(projects) >= 4
    slugs = [p["slug"] for p in projects]
    assert "hyperflow-engine" in slugs
    assert "cryptomesh-core" in slugs

def test_newcomer_fairness():
    """
    CRITICAL FAIRNESS RULE:
    A new contributor without prior history must be assigned NEWCOMER state
    and neutral confidence (0.50), not penalized as suspicious.
    """
    response = client.get("/api/trust/evaluate?contributor_id=marcus-dev")
    assert response.status_code == 200
    data = response.json()
    assert data["reputation_state"] == "NEWCOMER"
    assert data["trust_confidence"] == 0.50
    assert data["newcomer_fairness_applied"] is True
    assert "never treated as suspicious" in data["summary_explanation"]

def test_established_contributor_evaluation():
    """
    Elena has multiple vouches across independent projects and no denouncements.
    Should be ESTABLISHED with high confidence (> 0.80).
    """
    response = client.get("/api/trust/evaluate?contributor_id=elena-rustacean&viewing_project_id=proj-hyperflow")
    assert response.status_code == 200
    data = response.json()
    assert data["reputation_state"] == "ESTABLISHED"
    assert data["trust_confidence"] >= 0.80
    assert len(data["signals_considered"]) >= 1

def test_conflicting_signals_evaluation():
    """
    Alex Chen has a vouch from DevPulse but a pending report from CryptoMesh.
    Engine must flag CONFLICTING SIGNALS and display both side-by-side.
    """
    response = client.get("/api/trust/evaluate?contributor_id=alex-polyglot&viewing_project_id=proj-devpulse")
    assert response.status_code == 200
    data = response.json()
    assert data["conflicting_signals_detected"] is True
    assert data["reputation_state"] == "UNDER REVIEW"
    assert data["effective_vouch_weight"] > 0
    assert data["effective_denounce_weight"] > 0

def test_project_specific_policy_weighting():
    """
    If viewing project (e.g. TensorServe) has zero or low weight for a peer,
    signals from that peer should be weighted accordingly or discounted.
    """
    response = client.get("/api/trust/evaluate?contributor_id=elena-rustacean&viewing_project_id=proj-tensorserve")
    assert response.status_code == 200
    data = response.json()
    assert data["viewing_project_name"] == "TensorServe ML"

def test_submit_vouch():
    payload = {
        "contributor_username": "test-contributor-99",
        "source_project_id": "proj-hyperflow",
        "reason": "Exceptional fuzz testing PR with 99% branch coverage.",
        "evidence_url": "https://github.com/hyperflow-org/hyperflow/pull/999",
        "context": "Passed all deterministic concurrency tests.",
        "confidence": 1.0
    }
    response = client.post("/api/vouches", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["contributor_username"] == "test-contributor-99"
    assert data["provenance_hash"] != ""
    assert data["source_project_name"] == "HyperFlow Engine"

def test_submit_denouncement_fairness():
    """
    Denouncements must start as 'Pending Review' - allegations are not proof.
    """
    payload = {
        "contributor_username": "alleged-spammer-1",
        "reporting_project_id": "proj-hyperflow",
        "reason": "Mass-generated markdown comments",
        "evidence_url": "https://github.com/hyperflow-org/hyperflow/pull/888",
        "details": "Automated script activity suspected."
    }
    response = client.post("/api/denouncements", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Pending Review"

    # Test triage status update
    update_res = client.patch(
        f"/api/denouncements/{data['id']}/status",
        json={"status": "Under Investigation", "review_notes": "Triaged by security team", "reviewed_by": "sec-lead"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "Under Investigation"

def test_network_graph():
    response = client.get("/api/network")
    assert response.status_code == 200
    data = response.json()
    assert len(data["nodes"]) > 0
    assert len(data["edges"]) > 0
    assert "projects_count" in data["stats"]
    assert "contributors_count" in data["stats"]

def test_coordinated_campaigns():
    response = client.get("/api/campaigns")
    assert response.status_code == 200
    campaigns = response.json()
    assert len(campaigns) >= 1
    codes = [c["campaign_code"] for c in campaigns]
    assert "CMP-2026-AI-SLOP-CLUSTER-A" in codes

def test_federation_export_and_import():
    export_res = client.get("/api/federation/export/proj-hyperflow")
    assert export_res.status_code == 200
    bundle = export_res.json()
    assert bundle["source_project"]["name"] == "HyperFlow Engine"
    assert "signature_envelope" in bundle

    import_res = client.post("/api/federation/import", json=bundle)
    assert import_res.status_code == 200
    assert import_res.json()["status"] == "success"

def test_create_contributor_and_newcomer_baseline():
    """
    Test manual contributor registration.
    Must start in NEWCOMER state with neutral trust confidence (0.50).
    """
    from app.models import Contributor
    from tests.conftest import TestSession
    with TestSession() as s:
        existing = s.query(Contributor).filter(Contributor.username == "janedoe-dev").first()
        if existing:
            s.delete(existing)
            s.commit()

    payload = {
        "username": "janedoe-dev",
        "display_name": "Jane Doe",
        "bio": "Systems programmer interested in eBPF drivers.",
        "skills": ["Rust", "eBPF", "C"],
        "avatar_url": "https://github.com/janedoe-dev.png"
    }
    res = client.post("/api/contributors", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "janedoe-dev"
    assert data["reputation_state"] == "NEWCOMER"

    # Evaluate new contributor
    eval_res = client.get(f"/api/trust/evaluate?contributor_id={data['id']}")
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["reputation_state"] == "NEWCOMER"
    assert eval_data["trust_confidence"] == 0.50
    assert eval_data["newcomer_fairness_applied"] is True

def test_project_peer_weight_configuration_and_relationships():
    """
    Test setting custom peer weight on a project and retrieving incoming/outgoing relationships.
    """
    peer_payload = {
        "target_project_id": "proj-devpulse",
        "trust_weight": 0.95,
        "notes": "Verified high-quality peer review practices"
    }
    res = client.post("/api/projects/proj-hyperflow/peers", json=peer_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Verify relationships endpoint reflects the update
    rel_res = client.get("/api/projects/proj-hyperflow/relationships")
    assert rel_res.status_code == 200
    rel_data = rel_res.json()
    assert rel_data["project_name"] == "HyperFlow Engine"
    peer_ids = [p["project_id"] for p in rel_data["outgoing_peers"]]
    assert "proj-devpulse" in peer_ids

def test_dynamic_campaign_scan():
    """
    Test running the deterministic campaign detection scan on current signals.
    """
    res = client.post("/api/campaigns/scan")
    assert res.status_code == 200
    scan_data = res.json()
    assert scan_data["status"] == "success"
    assert "reports_analyzed" in scan_data
    assert "algorithm" in scan_data
