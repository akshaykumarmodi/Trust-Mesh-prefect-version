from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import CoordinatedCampaign, Contributor, User
from app.schemas import CampaignOut
from app.services.campaign_engine import CampaignDetectionEngine
from app.services.activity_logger import ActivityLogger
from app.services.auth_service import optional_current_user

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

@router.post("/scan")
def trigger_campaign_scan(
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Triggers deterministic pattern analysis across all reports and signals.
    """
    res = CampaignDetectionEngine.run_deterministic_scan(db)
    new_found = res.get("new_campaigns_created", res.get("new_campaigns_detected", 0))
    if new_found > 0:
        recent_campaigns = db.query(CoordinatedCampaign).order_by(CoordinatedCampaign.detected_at.desc()).limit(new_found).all()
        c_names = [c.name for c in recent_campaigns]
        c_codes = [c.campaign_code for c in recent_campaigns]
        c_patterns = [c.pattern_type for c in recent_campaigns]
        all_aff_projects = list(set(sum([c.affected_projects for c in recent_campaigns], [])))
        all_contributors = []
        for c in recent_campaigns:
            for cid in c.contributor_ids:
                contrib = db.query(Contributor).filter((Contributor.id == cid) | (Contributor.username == cid)).first()
                all_contributors.append(contrib.username if contrib else cid)
        all_contributors = list(set(all_contributors))
        total_evidence = sum([len(c.evidence_records) for c in recent_campaigns])

        ActivityLogger.log(
            db=db,
            event_type="CAMPAIGN_DETECTED",
            event_description=f"Deterministic forensic radar flagged {new_found} coordinated abuse cluster(s): {', '.join(c_names)}",
            user=user,
            resource_type="campaign",
            resource_id=recent_campaigns[0].id if recent_campaigns else "radar",
            status="SUSPICIOUS",
            metadata={
                "new_campaigns": new_found,
                "campaign_name": ", ".join(c_names),
                "campaign_code": ", ".join(c_codes),
                "pattern_type": ", ".join(set(c_patterns)),
                "signal_strength": f"{recent_campaigns[0].signal_strength:.2f}" if recent_campaigns else "0.85+",
                "affected_projects": all_aff_projects,
                "contributor_usernames": all_contributors,
                "evidence_count": f"{total_evidence} correlated records across {len(all_aff_projects)} repositories"
            }
        )
    return res


@router.patch("/{campaign_id}/status", response_model=CampaignOut)
def update_campaign_status(
    campaign_id: str,
    status_update: Dict[str, str],
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    c = CampaignDetectionEngine.get_campaign_by_id(db, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    new_status = status_update.get("status")
    valid = ["Active Investigation", "Confirmed Coordinated Abuse", "Dismissed"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid)}")

    c.status = new_status
    db.commit()
    db.refresh(c)

    ActivityLogger.log(
        db=db,
        event_type="TRUST_POLICY_DECISION_RECORDED",
        event_description=f"Campaign {c.campaign_code} status updated to '{new_status}'",
        user=user,
        resource_type="campaign",
        resource_id=c.id,
        status="SUCCESS",
        metadata={
            "campaign_code": c.campaign_code,
            "new_status": new_status,
            "reviewed_by": user.name if user and user.name else "Maintainer"
        }
    )

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
