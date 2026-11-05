from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any

from app.schemas.ai import (
    VouchAnalysisRequest,
    VouchAnalysisResponse,
    DenouncementAnalysisRequest,
    DenouncementAnalysisResponse,
    CampaignAnalysisRequest,
    CampaignAnalysisResponse,
    ContributorSummaryRequest,
    ContributorSummaryResponse,
    ExplainDecisionRequest,
    ExplainDecisionResponse
)
from app.services.ai_service import ai_service, TrustMeshAIService

router = APIRouter(prefix="/api/ai", tags=["AI Analysis Engine"])

def get_ai_service() -> TrustMeshAIService:
    return ai_service

@router.get("/status", summary="AI Engine Status")
@router.get("/health", summary="AI Engine Health & Active Provider Status")
def ai_health(service: TrustMeshAIService = Depends(get_ai_service)) -> Dict[str, Any]:
    """
    Returns AI service health, configured provider, active model, and fallback status.
    Credentials and API keys are strictly masked to ensure security.
    """
    return service.get_health_status()

@router.post("/analyze-vouch", response_model=VouchAnalysisResponse, summary="Analyze Vouch Evidence")
def analyze_vouch(
    req: VouchAnalysisRequest,
    service: TrustMeshAIService = Depends(get_ai_service)
) -> VouchAnalysisResponse:
    """
    Evaluates peer vouch notes and cryptographic evidence.
    Returns structured endorsement quality, verified items, and an investigation checklist.
    Strictly advisory.
    """
    return service.analyze_vouch(req)

@router.post("/analyze-denouncement", response_model=DenouncementAnalysisResponse, summary="Analyze Denouncement Evidence")
def analyze_denouncement(
    req: DenouncementAnalysisRequest,
    service: TrustMeshAIService = Depends(get_ai_service)
) -> DenouncementAnalysisResponse:
    """
    Evaluates abuse allegations and submitted diff/incident evidence.
    Strictly separates verified evidence from unverified claims.
    Never declares automated bans or guilt.
    """
    return service.analyze_denouncement(req)

@router.post("/analyze-campaign", response_model=CampaignAnalysisResponse, summary="Analyze Coordinated Activity Cluster")
def analyze_campaign(
    req: CampaignAnalysisRequest,
    service: TrustMeshAIService = Depends(get_ai_service)
) -> CampaignAnalysisResponse:
    """
    Analyzes cross-repository bursts and template similarity indicators.
    Clarifies correlation vs conclusive human/AI proof.
    """
    return service.analyze_campaign(req)

@router.post("/contributor-summary", response_model=ContributorSummaryResponse, summary="Summarize Contributor Trust History")
def summarize_contributor(
    req: ContributorSummaryRequest,
    service: TrustMeshAIService = Depends(get_ai_service)
) -> ContributorSummaryResponse:
    """
    Generates a concise reputation digest.
    Guarantees newcomer neutrality for contributors without prior history.
    """
    return service.summarize_contributor(req)

@router.post("/explain-decision", response_model=ExplainDecisionResponse, summary="Explain Deterministic Trust Decision")
def explain_decision(
    req: ExplainDecisionRequest,
    service: TrustMeshAIService = Depends(get_ai_service)
) -> ExplainDecisionResponse:
    """
    Explains the mathematical scoring and repository trust tier in plain English.
    Confirms newcomer fairness application and active policy weights.
    """
    return service.explain_decision(req)
