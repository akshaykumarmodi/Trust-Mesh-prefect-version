from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Contributor, CoordinatedCampaign
from app.schemas import AIExplainRequest, AIExplainResponse
from app.services.ai_service import AIService
from app.services.seed_data import seed_database
from app.core.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])

@router.get("/status")
def get_ai_status():
    return {
        "model_name": settings.AI_MODEL_NAME,
        "is_live_configured": AIService.is_live_configured(),
        "provider": "OpenRouter (GPT-OSS-120B Open-Weight)" if AIService.is_live_configured() else "Deterministic Intelligence Engine (Offline / Local)",
        "mode": "Live Model Active" if AIService.is_live_configured() else "Deterministic Fallback Engine",
        "description": "Evidence analysis and cross-repository pattern summarizer."
    }

@router.post("/explain", response_model=AIExplainResponse)
async def explain_target(request: AIExplainRequest, db: Session = Depends(get_db)):
    target_data: Dict[str, Any] = {}

    if request.target_type == "campaign":
        campaign = db.query(CoordinatedCampaign).filter(
            (CoordinatedCampaign.id == request.target_id) | (CoordinatedCampaign.campaign_code == request.target_id)
        ).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        target_data = {
            "id": campaign.id,
            "campaign_code": campaign.campaign_code,
            "name": campaign.name,
            "pattern_type": campaign.pattern_type,
            "signal_strength": campaign.signal_strength,
            "affected_projects": campaign.affected_projects,
            "contributor_ids": campaign.contributor_ids,
            "evidence_records": campaign.evidence_records
        }
    elif request.target_type == "contributor":
        contrib = db.query(Contributor).filter(
            (Contributor.id == request.target_id) | (Contributor.username == request.target_id)
        ).first()
        if not contrib:
            raise HTTPException(status_code=404, detail="Contributor not found")
        
        target_data = {
            "id": contrib.id,
            "username": contrib.username,
            "reputation_state": contrib.reputation_state,
            "total_contributions": contrib.total_contributions,
            "vouches": [{"reason": v.reason, "evidence": v.evidence_url} for v in contrib.vouches],
            "denouncements": [{"reason": d.reason, "evidence": d.evidence_url, "status": d.status} for d in contrib.denouncements]
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid target_type. Must be 'contributor' or 'campaign'")

    result = await AIService.explain_evidence(request.target_type, target_data)
    return AIExplainResponse(**result)

@router.post("/reset-demo")
def reset_demo_database(db: Session = Depends(get_db)):
    seed_database(db, reset=True)
    return {"status": "success", "message": "TrustMesh database successfully reset to clean synthetic demo state."}
