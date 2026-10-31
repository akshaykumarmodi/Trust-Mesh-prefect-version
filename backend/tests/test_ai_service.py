import pytest
import json
import httpx
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.ai_config import AISettings, SUPPORTED_GROQ_MODELS
from app.schemas.ai import (
    ExecutionMode,
    VouchAnalysisRequest,
    DenouncementAnalysisRequest,
    CampaignAnalysisRequest,
    ContributorSummaryRequest,
    ExplainDecisionRequest
)
from app.services.ai_provider import (
    GroqProvider,
    DeterministicFallbackProvider,
    AIAuthenticationError,
    AIRateLimitError,
    AITimeoutError,
    AIInvalidResponseError
)
from app.services.ai_service import TrustMeshAIService

client = TestClient(app)

# ==============================================================
# 1. Health Endpoint & Basic Metadata Tests
# ==============================================================

def test_root_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "online"
    assert data["service"] == "trustmesh-ai"

def test_ai_health_endpoint():
    resp = client.get("/api/ai/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "provider" in data
    assert "model" in data
    assert "masked_key" in data
    # Ensure raw API key is never exposed
    assert data["masked_key"] in {"[NOT_CONFIGURED]", "gsk_****"} or "..." in data["masked_key"]

def test_model_catalog_verification():
    settings = AISettings(AI_MODEL_NAME="llama-3.3-70b-versatile", AI_PROVIDER="groq")
    assert settings.verify_model() is True

    # Test unrecognized model logs warning and does not silently substitute
    unrecognized = AISettings(AI_MODEL_NAME="custom-experimental-model", AI_PROVIDER="groq")
    assert unrecognized.verify_model() is False
    assert unrecognized.AI_MODEL_NAME == "custom-experimental-model"

# ==============================================================
# 2. Deterministic Fallback Tests (AI Disabled / Empty Key)
# ==============================================================

def test_empty_api_key_uses_deterministic_fallback():
    settings = AISettings(AI_ENABLED=True, GROQ_API_KEY="", AI_PROVIDER="groq")
    service = TrustMeshAIService(settings=settings)

    req = VouchAnalysisRequest(
        submitter_id="user_alice",
        recipient_id="user_bob",
        project_id="hyperflow",
        context_notes="Consistently delivers high quality PRs and tests.",
        cryptographic_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
    res = service.analyze_vouch(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
    assert "deterministic" in res.metadata.provider.lower()
    assert len(res.verified_evidence) > 0
    assert len(res.investigation_checklist) > 0

def test_ai_disabled_uses_fallback():
    settings = AISettings(AI_ENABLED=False, GROQ_API_KEY="gsk_mock_test_key", AI_PROVIDER="groq")
    service = TrustMeshAIService(settings=settings)

    req = DenouncementAnalysisRequest(
        reporter_id="maintainer_carol",
        accused_id="spammer_dave",
        project_id="hyperflow",
        allegation_type="AI_SLOP_SPAM",
        allegation_details="Submitted 12 empty PRs modifying whitespace within 3 minutes.",
        evidence_urls=["https://github.com/hyperflow/pull/101"]
    )
    res = service.analyze_denouncement(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
    assert "disabled" in res.metadata.fallback_reason.lower()
    assert res.severity_assessment in {"MEDIUM_RISK", "HIGH_RISK_REQUIRES_AUDIT"}

# ==============================================================
# 3. Newcomer Neutrality & Allegation Separation Tests
# ==============================================================

def test_newcomer_neutrality_guarantee():
    """Verify that contributors with zero vouches/denouncements are treated as neutral, never guilty."""
    settings = AISettings(AI_ENABLED=False)
    service = TrustMeshAIService(settings=settings)

    req = ContributorSummaryRequest(
        contributor_id="newbie_dev",
        vouch_count=0,
        denouncement_count=0,
        verified_pr_count=0,
        active_projects=["hyperflow"]
    )
    res = service.summarize_contributor(req)
    assert res.is_newcomer is True
    assert res.reputation_status == "NEUTRAL_NEWCOMER"
    assert res.newcomer_neutrality_statement is not None
    assert "neutral baseline" in res.newcomer_neutrality_statement.lower()
    assert res.advisory_only is True

def test_separation_of_allegation_vs_verified_evidence():
    """Verify that unverified allegations are strictly segregated from cryptographic/linked evidence."""
    fallback = DeterministicFallbackProvider()
    req = DenouncementAnalysisRequest(
        reporter_id="alice",
        accused_id="bob",
        project_id="repo1",
        allegation_details="I suspect this user is using an LLM to generate comments.",
        evidence_urls=["https://github.com/repo1/pull/99"]
    )
    res = fallback.analyze_denouncement(req)
    # Check that allegation details are categorized as unverified
    assert any("alice" in item for item in res.unverified_allegations)
    # Check that PR URL is categorized as verified evidence link
    assert any("https://github.com/repo1/pull/99" in item for item in res.verified_evidence)
    # Confirm notice is present
    assert "advisory" in res.no_automatic_punishment_notice.lower()

# ==============================================================
# 4. Mocked Groq Inference & Success Tests
# ==============================================================

def test_successful_groq_vouch_inference():
    mock_response_data = {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "endorsement_quality": "HIGH_MERIT",
                    "verified_evidence": ["Cryptographic SHA-256 signature confirmed."],
                    "allegations_or_claims": ["Submitter states contributor has strong domain expertise."],
                    "confidence_assessment": "High-confidence vouch backed by verifiable history.",
                    "investigation_checklist": ["Confirm maintainer signing key.", "Inspect merged commit tree."],
                    "explanation": "High-quality peer vouch with valid provenance."
                })
            }
        }]
    }

    mock_client = MagicMock()
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_resp.json.return_value = mock_response_data
    mock_client.post.return_value = mock_resp

    settings = AISettings(AI_ENABLED=True, GROQ_API_KEY="gsk_test_mock_key", AI_PROVIDER="groq")
    provider = GroqProvider(settings=settings, client=mock_client)
    service = TrustMeshAIService(settings=settings, provider=provider)

    req = VouchAnalysisRequest(
        submitter_id="lead_alice",
        recipient_id="contributor_bob",
        project_id="trustmesh-core",
        context_notes="Long time contributor with excellent track record in cryptographic primitives.",
        cryptographic_hash="a1b2c3d4e5f67890"
    )
    res = service.analyze_vouch(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.AI_INFERENCE
    assert res.endorsement_quality == "HIGH_MERIT"
    assert len(res.verified_evidence) == 1
    assert "signature" in res.verified_evidence[0].lower()

def test_successful_groq_campaign_inference():
    mock_response_data = {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "coordination_signal_strength": "STRONG_CORRELATION",
                    "cross_repo_pattern_breakdown": ["Identical typo fix diff submitted to 8 repositories in 45 seconds."],
                    "shared_template_indicators": ["Commit message template: 'fix docstring formatting'."],
                    "investigation_checklist": ["Check user IP registration range.", "Compare author PGP keys."],
                    "explanation": "High correlation of automated cross-repo activity."
                })
            }
        }]
    }

    mock_client = MagicMock()
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_resp.json.return_value = mock_response_data
    mock_client.post.return_value = mock_resp

    settings = AISettings(AI_ENABLED=True, GROQ_API_KEY="gsk_test_mock_key", AI_PROVIDER="groq")
    provider = GroqProvider(settings=settings, client=mock_client)
    service = TrustMeshAIService(settings=settings, provider=provider)

    req = CampaignAnalysisRequest(
        suspected_contributor_ids=["bot1", "bot2", "bot3"],
        affected_project_ids=["projA", "projB"],
        activity_timestamps=["2026-11-01T01:00:00Z", "2026-11-01T01:00:15Z"],
        sample_pr_titles=["fix docstring formatting"]
    )
    res = service.analyze_campaign(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.AI_INFERENCE
    assert res.coordination_signal_strength == "STRONG_CORRELATION"
    assert len(res.cross_repo_pattern_breakdown) == 1

# ==============================================================
# 5. Upstream HTTP Error & Degradation Tests
# ==============================================================

def test_groq_http_401_unauthorized_degrades_gracefully():
    mock_client = MagicMock()
    mock_resp = MagicMock(status_code=401, is_success=False)
    mock_client.post.return_value = mock_resp

    settings = AISettings(AI_ENABLED=True, GROQ_API_KEY="gsk_expired_key", AI_PROVIDER="groq")
    provider = GroqProvider(settings=settings, client=mock_client)
    service = TrustMeshAIService(settings=settings, provider=provider)

    req = ExplainDecisionRequest(
        contributor_id="alice",
        project_id="hyperflow",
        deterministic_score=0.85,
        assigned_tier="TRUSTED",
        newcomer_baseline_applied=False
    )
    # Must NOT raise exception; must gracefully degrade to deterministic rules
    res = service.explain_decision(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
    assert "AIAuthenticationError" in res.metadata.fallback_reason

def test_groq_http_429_rate_limit_degrades_gracefully():
    mock_client = MagicMock()
    mock_resp = MagicMock(status_code=429, is_success=False)
    mock_client.post.return_value = mock_resp

    settings = AISettings(AI_ENABLED=True, GROQ_API_KEY="gsk_test_key", AI_PROVIDER="groq")
    provider = GroqProvider(settings=settings, client=mock_client)
    service = TrustMeshAIService(settings=settings, provider=provider)

    req = ContributorSummaryRequest(contributor_id="bob", vouch_count=3, denouncement_count=0)
    res = service.summarize_contributor(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
    assert "AIRateLimitError" in res.metadata.fallback_reason

def test_groq_network_timeout_degrades_gracefully():
    mock_client = MagicMock()
    mock_client.post.side_effect = httpx.TimeoutException("Read timed out")

    settings = AISettings(AI_ENABLED=True, GROQ_API_KEY="gsk_test_key", AI_PROVIDER="groq")
    provider = GroqProvider(settings=settings, client=mock_client)
    service = TrustMeshAIService(settings=settings, provider=provider)

    req = VouchAnalysisRequest(
        submitter_id="u1",
        recipient_id="u2",
        project_id="p1",
        context_notes="Great reviewer"
    )
    res = service.analyze_vouch(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
    assert "AITimeoutError" in res.metadata.fallback_reason

def test_groq_invalid_model_response_degrades_gracefully():
    mock_client = MagicMock()
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "This is non-JSON garbage text."}}]
    }
    mock_client.post.return_value = mock_resp

    settings = AISettings(AI_ENABLED=True, GROQ_API_KEY="gsk_test_key", AI_PROVIDER="groq")
    provider = GroqProvider(settings=settings, client=mock_client)
    service = TrustMeshAIService(settings=settings, provider=provider)

    req = DenouncementAnalysisRequest(
        reporter_id="r1",
        accused_id="a1",
        project_id="p1",
        allegation_details="Spamming pull requests"
    )
    res = service.analyze_denouncement(req)
    assert res.advisory_only is True
    assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
    assert "AIInvalidResponseError" in res.metadata.fallback_reason

# ==============================================================
# 6. FastAPI Router HTTP Endpoints Integration Tests
# ==============================================================

def test_api_analyze_vouch_endpoint():
    payload = {
        "submitter_id": "alice",
        "recipient_id": "bob",
        "project_id": "hyperflow",
        "context_notes": "Consistent, verifiable open source work on performance optimization.",
        "evidence_links": ["https://github.com/hyperflow/pull/1"],
        "cryptographic_hash": "deadbeef12345678"
    }
    resp = client.post("/api/ai/analyze-vouch", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["advisory_only"] is True
    assert "endorsement_quality" in data
    assert "metadata" in data

def test_api_analyze_denouncement_endpoint():
    payload = {
        "reporter_id": "carol",
        "accused_id": "dave",
        "project_id": "hyperflow",
        "allegation_type": "AI_SLOP_SPAM",
        "allegation_details": "Suspicious rapid PR burst with zero human review responses.",
        "evidence_urls": ["https://github.com/hyperflow/pull/42"]
    }
    resp = client.post("/api/ai/analyze-denouncement", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["advisory_only"] is True
    assert "no_automatic_punishment_notice" in data

def test_api_analyze_campaign_endpoint():
    payload = {
        "suspected_contributor_ids": ["dev1", "dev2"],
        "affected_project_ids": ["p1", "p2"],
        "activity_timestamps": ["2026-11-01T00:00:00Z"]
    }
    resp = client.post("/api/ai/analyze-campaign", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["advisory_only"] is True
    assert "coordination_signal_strength" in data

def test_api_contributor_summary_endpoint():
    payload = {
        "contributor_id": "fresh_user",
        "vouch_count": 0,
        "denouncement_count": 0
    }
    resp = client.post("/api/ai/contributor-summary", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_newcomer"] is True
    assert data["reputation_status"] == "NEUTRAL_NEWCOMER"

def test_api_explain_decision_endpoint():
    payload = {
        "contributor_id": "veteran_dev",
        "project_id": "hyperflow",
        "deterministic_score": 0.92,
        "assigned_tier": "TRUSTED",
        "newcomer_baseline_applied": False,
        "effective_vouches_weight": 2.0,
        "effective_denouncements_weight": 1.5
    }
    resp = client.post("/api/ai/explain-decision", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["advisory_only"] is True
    assert "plain_english_rationale" in data
    assert len(data["policy_factor_breakdown"]) > 0

def test_api_input_validation_empty_fields_rejected():
    # Empty submitter_id should fail Pydantic validation (HTTP 422)
    payload = {
        "submitter_id": "",
        "recipient_id": "bob",
        "project_id": "hyperflow",
        "context_notes": "Test"
    }
    resp = client.post("/api/ai/analyze-vouch", json=payload)
    assert resp.status_code == 422
