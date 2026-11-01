from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import CoordinatedCampaign, Contributor
from app.schemas import CampaignOut
from app.services.campaign_engine import CampaignDetectionEngine

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.get("", response_model=List[CampaignOut])
def list_campaigns(db: Session = Depends(get_db)):
    campaigns = CampaignDetectionEngine.get_all_campaigns(db)
    results = []
    for c in campaigns:
        # Resolve contributor usernames
        usernames = []
        for cid in c.contributor_ids:
            contrib = db.query(Contributor).filter((Contributor.id == cid) | (Contributor.username == cid)).first()
            usernames.append(contrib.username if contrib else cid)
        
        results.append(CampaignOut(
            id=c.id,
            campaign_code=c.campaign_code,
            name=c.name,
            pattern_type=c.pattern_type,
            description=c.description or "",
            signal_strength=c.signal_strength,
            affected_projects=c.affected_projects,
            contributor_ids=c.contributor_ids,
            contributor_usernames=usernames,
            evidence_records=c.evidence_records,
            status=c.status,
            detected_at=c.detected_at,
            updated_at=c.updated_at
        ))
    return results

@router.get("/analytics")
def get_campaign_analytics(db: Session = Depends(get_db)) -> Dict[str, Any]:
    return CampaignDetectionEngine.analyze_patterns(db)

@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = CampaignDetectionEngine.get_campaign_by_id(db, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    usernames = []
    for cid in c.contributor_ids:
        contrib = db.query(Contributor).filter((Contributor.id == cid) | (Contributor.username == cid)).first()
        usernames.append(contrib.username if contrib else cid)

    return CampaignOut(
        id=c.id,
        campaign_code=c.campaign_code,
        name=c.name,
        pattern_type=c.pattern_type,
        description=c.description or "",
        signal_strength=c.signal_strength,
        affected_projects=c.affected_projects,
        contributor_ids=c.contributor_ids,
        contributor_usernames=usernames,
        evidence_records=c.evidence_records,
        status=c.status,
        detected_at=c.detected_at,
        updated_at=c.updated_at
    )
