from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Contributor, Vouch, Denouncement, Project
from app.schemas import ContributorOut, ContributorCreate, VouchOut, DenouncementOut

router = APIRouter(prefix="/contributors", tags=["contributors"])

def serialize_contributor(c: Contributor, db: Session) -> ContributorOut:
    vouches_out = []
    for v in c.vouches:
        proj = db.query(Project).filter(Project.id == v.source_project_id).first()
        vouches_out.append(VouchOut(
            id=v.id,
            contributor_id=v.contributor_id,
            contributor_username=c.username,
            source_project_id=v.source_project_id,
            source_project_name=proj.name if proj else v.source_project_id,
            reason=v.reason,
            evidence_url=v.evidence_url,
            context=v.context or "",
            confidence=v.confidence,
            provenance_hash=v.provenance_hash or "",
            created_at=v.created_at
        ))

    denounce_out = []
    for d in c.denouncements:
        proj = db.query(Project).filter(Project.id == d.reporting_project_id).first()
        denounce_out.append(DenouncementOut(
            id=d.id,
            contributor_id=d.contributor_id,
            contributor_username=c.username,
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

    return ContributorOut(
        id=c.id,
        username=c.username,
        display_name=c.display_name or c.username,
        avatar_url=c.avatar_url or "",
        github_url=c.github_url or f"https://github.com/{c.username}",
        bio=c.bio or "",
        skills=c.skills,
        reputation_state=c.reputation_state or "NEWCOMER",
        total_contributions=c.total_contributions or 0,
        first_seen_at=c.first_seen_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
        vouches=vouches_out,
        denouncements=denounce_out
    )

@router.get("", response_model=List[ContributorOut])
def list_contributors(
    search: Optional[str] = Query(None, description="Search by username or display name"),
    reputation_state: Optional[str] = Query(None, description="Filter by state (NEWCOMER, INSUFFICIENT EVIDENCE, ESTABLISHED, UNDER REVIEW)"),
    db: Session = Depends(get_db)
):
    query = db.query(Contributor)
    if search:
        s = f"%{search.lower()}%"
        query = query.filter((Contributor.username.ilike(s)) | (Contributor.display_name.ilike(s)))
    if reputation_state:
        query = query.filter(Contributor.reputation_state == reputation_state)

    contributors = query.all()
    return [serialize_contributor(c, db) for c in contributors]

@router.get("/{contributor_id}", response_model=ContributorOut)
def get_contributor(contributor_id: str, db: Session = Depends(get_db)):
    c = db.query(Contributor).filter(
        (Contributor.id == contributor_id) | (Contributor.username == contributor_id)
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail=f"Contributor {contributor_id} not found")
    return serialize_contributor(c, db)
