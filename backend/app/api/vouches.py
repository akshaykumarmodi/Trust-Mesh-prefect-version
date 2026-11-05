import hashlib
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Vouch, Contributor, Project, User
from app.schemas import VouchOut, VouchCreate
from app.services.activity_logger import ActivityLogger
from app.services.auth_service import optional_current_user
from app.services.github_service import GitHubService

router = APIRouter(prefix="/vouches", tags=["vouches"])

@router.get("", response_model=List[VouchOut])
def list_vouches(db: Session = Depends(get_db)):
    vouches = db.query(Vouch).order_by(Vouch.created_at.desc()).all()
    results = []
    for v in vouches:
        contrib = db.query(Contributor).filter(Contributor.id == v.contributor_id).first()
        proj = db.query(Project).filter(Project.id == v.source_project_id).first()
        results.append(VouchOut(
            id=v.id,
            contributor_id=v.contributor_id,
            contributor_username=contrib.username if contrib else "unknown",
            source_project_id=v.source_project_id,
            source_project_name=proj.name if proj else v.source_project_id,
            reason=v.reason,
            evidence_url=v.evidence_url,
            context=v.context or "",
            confidence=v.confidence,
            provenance_hash=v.provenance_hash or "",
            created_at=v.created_at
        ))
    return results

@router.post("", response_model=VouchOut, status_code=status.HTTP_201_CREATED)
def submit_vouch(
    data: VouchCreate,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify source project exists (support flexible lookup by ID, slug, or name)
    project = GitHubService.find_project(db, data.source_project_id)
    if not project:
        raise HTTPException(status_code=400, detail=f"Source project '{data.source_project_id}' does not exist")

    # 2. Find or register contributor
    uname = data.contributor_username.strip().lstrip("@").lower()
    if not uname:
        raise HTTPException(status_code=400, detail="Contributor username is required")

    contrib = db.query(Contributor).filter(Contributor.username == uname).first()
    if not contrib:
        # Create newcomer profile
        contrib = Contributor(
            id=f"contrib-{uname}",
            username=uname,
            display_name=uname,
            avatar_url=f"https://github.com/{uname}.png",
            github_url=f"https://github.com/{uname}",
            reputation_state="NEWCOMER",
            total_contributions=1
        )
        db.add(contrib)
        db.commit()
        db.refresh(contrib)

    # 3. Compute deterministic provenance hash
    raw_prov = f"{contrib.username}:{project.id}:{data.reason.strip()}:{data.evidence_url.strip()}"
    prov_hash = hashlib.sha256(raw_prov.encode()).hexdigest()[:16]

    # Check for existing duplicate vouch (exact duplicate submission by provenance hash)
    existing_vouch = (
        db.query(Vouch)
        .filter(
            Vouch.contributor_id == contrib.id,
            Vouch.source_project_id == project.id,
            Vouch.provenance_hash == prov_hash
        )
        .first()
    )
    if existing_vouch:
        # Return existing vouch idempotently without creating duplicate database records
        return VouchOut(
            id=existing_vouch.id,
            contributor_id=contrib.id,
            contributor_username=contrib.username,
            source_project_id=project.id,
            source_project_name=project.name,
            reason=existing_vouch.reason,
            evidence_url=existing_vouch.evidence_url,
            context=existing_vouch.context or "",
            confidence=existing_vouch.confidence,
            provenance_hash=existing_vouch.provenance_hash,
            created_at=existing_vouch.created_at
        )

    # 4. Create vouch record
    vouch_id = f"vouch-{uuid.uuid4().hex[:8]}"
    vouch = Vouch(
        id=vouch_id,
        contributor_id=contrib.id,
        source_project_id=project.id,
        reason=data.reason.strip(),
        evidence_url=data.evidence_url.strip(),
        context=data.context.strip() if data.context else "",
        confidence=data.confidence if data.confidence is not None else 1.0,
        provenance_hash=prov_hash
    )
    db.add(vouch)

    # 4. Check if contributor can transition from NEWCOMER to ESTABLISHED
    existing_vouches_count = db.query(Vouch).filter(Vouch.contributor_id == contrib.id).count() + 1
    existing_denounce_count = contrib.denouncements
    
    if contrib.reputation_state == "NEWCOMER" and existing_vouches_count >= 1 and len(existing_denounce_count) == 0:
        contrib.reputation_state = "ESTABLISHED" if existing_vouches_count >= 2 else "INSUFFICIENT EVIDENCE"
    
    contrib.total_contributions = (contrib.total_contributions or 0) + 1
    db.commit()
    db.refresh(vouch)

    submitter_name = user.name if user and user.name else "Not provided"
    submitter_email = user.email if user else "Not provided"

    ActivityLogger.log(
        db=db,
        event_type="VOUCH_SUBMITTED",
        event_description=f"Peer vouch submitted for @{contrib.username} from {project.name}: {vouch.reason}",
        user=user,
        resource_type="vouch",
        resource_id=vouch.id,
        project_name=project.name,
        status="SUCCESS",
        metadata={
            "recipient_contributor": contrib.username,
            "recipient_contributor_id": contrib.id,
            "source_project_id": project.id,
            "source_project_name": project.name,
            "vouch_reason": vouch.reason,
            "evidence_url": vouch.evidence_url,
            "confidence": vouch.confidence,
            "provenance_hash": vouch.provenance_hash,
            "submitter_name": submitter_name,
            "submitter_email": submitter_email
        }
    )

    return VouchOut(
        id=vouch.id,
        contributor_id=contrib.id,
        contributor_username=contrib.username,
        source_project_id=project.id,
        source_project_name=project.name,
        reason=vouch.reason,
        evidence_url=vouch.evidence_url,
        context=vouch.context or "",
        confidence=vouch.confidence,
        provenance_hash=vouch.provenance_hash,
        created_at=vouch.created_at
    )
