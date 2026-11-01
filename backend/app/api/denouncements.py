import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Denouncement, Contributor, Project, User, Vouch
from app.schemas import DenouncementOut, DenouncementCreate, DenouncementStatusUpdate
from app.services.activity_logger import ActivityLogger
from app.services.auth_service import optional_current_user

router = APIRouter(prefix="/denouncements", tags=["denouncements"])

@router.get("", response_model=List[DenouncementOut])
def list_denouncements(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(Denouncement)
    if status_filter:
        query = query.filter(Denouncement.status == status_filter)
    
    denouncements = query.order_by(Denouncement.created_at.desc()).all()
    results = []
    for d in denouncements:
        contrib = db.query(Contributor).filter(Contributor.id == d.contributor_id).first()
        proj = db.query(Project).filter(Project.id == d.reporting_project_id).first()
        results.append(DenouncementOut(
            id=d.id,
            contributor_id=d.contributor_id,
            contributor_username=contrib.username if contrib else "unknown",
            reporting_project_id=d.reporting_project_id,
            reporting_project_name=proj.name if proj else d.reporting_project_id,
            reason=d.reason,
            evidence_url=d.evidence_url,
            details=d.details or "",
            status=d.status,
            review_notes=d.review_notes or "",
            reviewed_by=d.reviewed_by or "",
            created_at=d.created_at,
            updated_at=d.updated_at
        ))
    return results

@router.post("", response_model=DenouncementOut, status_code=status.HTTP_201_CREATED)
def submit_denouncement(
    data: DenouncementCreate,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == data.reporting_project_id).first()
    if not project:
        raise HTTPException(status_code=400, detail=f"Reporting project '{data.reporting_project_id}' does not exist")

    uname = data.contributor_username.strip().lstrip("@").lower()
    if not uname:
        raise HTTPException(status_code=400, detail="Contributor username is required")

    contrib = db.query(Contributor).filter(Contributor.username == uname).first()
    if not contrib:
        # Create profile so report is preserved with fairness
        contrib = Contributor(
            id=f"contrib-{uname}",
            username=uname,
            display_name=uname,
            avatar_url=f"https://github.com/{uname}.png",
            github_url=f"https://github.com/{uname}",
            reputation_state="UNDER REVIEW",
            total_contributions=1
        )
        db.add(contrib)
        db.commit()
        db.refresh(contrib)
    else:
        # Set state to UNDER REVIEW (does not delete previous positive vouches)
        contrib.reputation_state = "UNDER REVIEW"

    denounce_id = f"denounce-{uuid.uuid4().hex[:8]}"
    denouncement = Denouncement(
        id=denounce_id,
        contributor_id=contrib.id,
        reporting_project_id=data.reporting_project_id,
        reason=data.reason.strip(),
        evidence_url=data.evidence_url.strip(),
        details=data.details.strip() if data.details else "",
        status="Pending Review", # Fairness: starts as unverified allegation
        review_notes="Initial report submitted. Pending maintainer triage."
    )
    db.add(denouncement)
    db.commit()
    db.refresh(denouncement)

    submitter_name = user.name if user and user.name else "Not provided"
    submitter_email = user.email if user else "Not provided"

    ActivityLogger.log(
        db=db,
        event_type="DENOUNCEMENT_SUBMITTED",
        event_description=f"Denouncement submitted for @{contrib.username} by {project.name}: {denouncement.reason}",
        user=user,
        resource_type="denouncement",
        resource_id=denouncement.id,
        project_name=project.name,
        status="WARNING",
        metadata={
            "reported_contributor": contrib.username,
            "reported_contributor_id": contrib.id,
            "reporting_project_id": project.id,
            "reporting_project_name": project.name,
            "denouncement_reason": denouncement.reason,
            "evidence_url": denouncement.evidence_url,
            "details": denouncement.details,
            "initial_status": denouncement.status,
            "submitter_name": submitter_name,
            "submitter_email": submitter_email
        }
    )

    return DenouncementOut(
        id=denouncement.id,
        contributor_id=contrib.id,
        contributor_username=contrib.username,
        reporting_project_id=project.id,
        reporting_project_name=project.name,
        reason=denouncement.reason,
        evidence_url=denouncement.evidence_url,
        details=denouncement.details or "",
        status=denouncement.status,
        review_notes=denouncement.review_notes or "",
        reviewed_by="",
        created_at=denouncement.created_at,
        updated_at=denouncement.updated_at
    )

@router.patch("/{denouncement_id}/status", response_model=DenouncementOut)
def update_denouncement_status(
    denouncement_id: str,
    update_data: DenouncementStatusUpdate,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Denouncement).filter(Denouncement.id == denouncement_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Denouncement not found")

    valid_statuses = ["Pending Review", "Under Investigation", "Reviewed", "Dismissed"]
    if update_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    d.status = update_data.status
    if update_data.review_notes is not None:
        d.review_notes = update_data.review_notes
    if update_data.reviewed_by is not None:
        d.reviewed_by = update_data.reviewed_by

    # If dismissed, recalculate contributor reputation state
    if update_data.status == "Dismissed":
        contrib = db.query(Contributor).filter(Contributor.id == d.contributor_id).first()
        if contrib:
            other_active_denouncements = db.query(Denouncement).filter(
                Denouncement.contributor_id == contrib.id,
                Denouncement.id != d.id,
                Denouncement.status.in_(["Pending Review", "Under Investigation", "Reviewed"])
            ).count()
            if other_active_denouncements == 0:
                vouch_count = db.query(Vouch).filter(Vouch.contributor_id == contrib.id).count()
                if vouch_count >= 2:
                    contrib.reputation_state = "ESTABLISHED"
                elif vouch_count == 1:
                    contrib.reputation_state = "INSUFFICIENT EVIDENCE"
                else:
                    contrib.reputation_state = "NEWCOMER"

    db.commit()
    db.refresh(d)

    ActivityLogger.log(
        db=db,
        event_type="TRUST_POLICY_DECISION_RECORDED",
        event_description=f"Maintainer triage status for denouncement {d.id} updated to '{update_data.status}'",
        user=user,
        resource_type="denouncement",
        resource_id=d.id,
        status="SUCCESS",
        metadata={
            "new_status": update_data.status,
            "reviewed_by": update_data.reviewed_by or (user.name if user and user.name else "Maintainer"),
            "review_notes": update_data.review_notes
        }
    )

    contrib = db.query(Contributor).filter(Contributor.id == d.contributor_id).first()
    proj = db.query(Project).filter(Project.id == d.reporting_project_id).first()

    return DenouncementOut(
        id=d.id,
        contributor_id=d.contributor_id,
        contributor_username=contrib.username if contrib else "unknown",
        reporting_project_id=d.reporting_project_id,
        reporting_project_name=proj.name if proj else d.reporting_project_id,
        reason=d.reason,
        evidence_url=d.evidence_url,
        details=d.details or "",
        status=d.status,
        review_notes=d.review_notes or "",
        reviewed_by=d.reviewed_by or "",
        created_at=d.created_at,
        updated_at=d.updated_at
    )
