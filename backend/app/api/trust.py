from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Contributor, Project, Vouch, Denouncement, CoordinatedCampaign
from app.services.trust_engine import TrustEvaluationEngine
from app.schemas import TrustEvaluationOut

router = APIRouter(prefix="/trust", tags=["trust"])

@router.get("/evaluate", response_model=TrustEvaluationOut)
def evaluate_contributor_trust(
    contributor_id: str = Query(..., description="Contributor ID or username"),
    viewing_project_id: Optional[str] = Query(None, description="Project ID viewing the contributor"),
    db: Session = Depends(get_db)
):
    # Lookup contributor by ID or username
    contrib = db.query(Contributor).filter(
        (Contributor.id == contributor_id) | (Contributor.username == contributor_id)
    ).first()
    if not contrib:
        raise HTTPException(status_code=404, detail=f"Contributor '{contributor_id}' not found")

    return TrustEvaluationEngine.evaluate(db, contrib.id, viewing_project_id)

@router.get("/overview")
def get_trust_overview(db: Session = Depends(get_db)) -> Dict[str, Any]:
    project_count = db.query(Project).count()
    contributor_count = db.query(Contributor).count()
    vouch_count = db.query(Vouch).count()
    denouncement_count = db.query(Denouncement).filter(Denouncement.status != "Dismissed").count()
    campaign_count = db.query(CoordinatedCampaign).filter(CoordinatedCampaign.status != "Dismissed").count()

    # Reputation state distribution
    state_counts = {
        "ESTABLISHED": db.query(Contributor).filter(Contributor.reputation_state == "ESTABLISHED").count(),
        "NEWCOMER": db.query(Contributor).filter(Contributor.reputation_state == "NEWCOMER").count(),
        "INSUFFICIENT_EVIDENCE": db.query(Contributor).filter(Contributor.reputation_state == "INSUFFICIENT EVIDENCE").count(),
        "UNDER_REVIEW": db.query(Contributor).filter(Contributor.reputation_state == "UNDER REVIEW").count(),
    }

    # Recent activity items
    recent_vouches = db.query(Vouch).order_by(Vouch.created_at.desc()).limit(5).all()
    recent_denouncements = db.query(Denouncement).order_by(Denouncement.created_at.desc()).limit(5).all()

    activity_stream = []
    for v in recent_vouches:
        c = db.query(Contributor).filter(Contributor.id == v.contributor_id).first()
        p = db.query(Project).filter(Project.id == v.source_project_id).first()
        activity_stream.append({
            "id": v.id,
            "type": "VOUCH",
            "title": f"Vouch issued for @{c.username if c else 'user'}",
            "project_name": p.name if p else v.source_project_id,
            "reason": v.reason,
            "timestamp": v.created_at.isoformat(),
            "confidence": v.confidence
        })

    for d in recent_denouncements:
        c = db.query(Contributor).filter(Contributor.id == d.contributor_id).first()
        p = db.query(Project).filter(Project.id == d.reporting_project_id).first()
        activity_stream.append({
            "id": d.id,
            "type": "DENOUNCEMENT",
            "title": f"Report lodged regarding @{c.username if c else 'user'}",
            "project_name": p.name if p else d.reporting_project_id,
            "reason": d.reason,
            "status": d.status,
            "timestamp": d.created_at.isoformat()
        })

    activity_stream.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "metrics": {
            "connected_projects": project_count,
            "tracked_contributors": contributor_count,
            "active_vouches": vouch_count,
            "open_denouncements": denouncement_count,
            "suspicious_campaigns": campaign_count,
            "data_label": "Synthetic Seed Demonstration Data (v1.0)"
        },
        "reputation_distribution": state_counts,
        "recent_activity": activity_stream[:8]
    }
