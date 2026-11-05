from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Project, ProjectTrustEdge, Vouch, Denouncement, Contributor, User
from app.schemas import (
    ProjectOut,
    ProjectCreate,
    ProjectUpdate,
    ProjectPeerWeightUpdate,
    ProjectRelationshipOut
)
from app.services.activity_logger import ActivityLogger
from app.services.auth_service import optional_current_user
from app.services.github_service import GitHubService

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.stars.desc()).all()

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    proj = GitHubService.find_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return proj

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    pid = data.id or f"proj-{data.slug}"
    existing = db.query(Project).filter((Project.id == pid) | (Project.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project with this ID or slug already exists")

    proj = Project(
        id=pid,
        name=data.name,
        slug=data.slug,
        description=data.description or "",
        repo_url=data.repo_url or "",
        category=data.category or "Infrastructure",
        stars=data.stars or 0,
        trust_policy_json="{}"
    )
    if data.trust_policy:
        proj.trust_policy = data.trust_policy

    # Automatically establish GitHub repository identity if repo_url is a GitHub repository
    if proj.repo_url and "github.com" in proj.repo_url:
        try:
            owner, repo = GitHubService.parse_github_url(proj.repo_url)
            proj.github_owner = owner
            proj.github_repo = repo
            proj.is_github_connected = True
        except Exception:
            pass

    db.add(proj)
    db.commit()
    db.refresh(proj)

    ActivityLogger.log(
        db=db,
        event_type="PROJECT_CREATED",
        event_description=f"Project {proj.name} ({proj.slug}) created in TrustMesh",
        user=user,
        resource_type="project",
        resource_id=proj.id,
        project_name=proj.name,
        status="SUCCESS",
        metadata={"category": proj.category, "repo_url": proj.repo_url}
    )

    return proj


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    data: ProjectUpdate,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    proj = GitHubService.find_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    is_policy_change = data.trust_policy is not None

    if data.name is not None:
        proj.name = data.name
    if data.description is not None:
        proj.description = data.description
    if data.repo_url is not None:
        proj.repo_url = data.repo_url
        if proj.repo_url and "github.com" in proj.repo_url:
            try:
                owner, repo = GitHubService.parse_github_url(proj.repo_url)
                proj.github_owner = owner
                proj.github_repo = repo
                proj.is_github_connected = True
            except Exception:
                pass
    if data.category is not None:
        proj.category = data.category
    if data.stars is not None:
        proj.stars = data.stars
    if data.trust_policy is not None:
        proj.trust_policy = data.trust_policy

    db.commit()
    db.refresh(proj)

    event_type = "PROJECT_POLICY_CHANGED" if is_policy_change else "PROJECT_UPDATED"
    event_desc = (
        f"Autonomous trust policy tuned for {proj.name}"
        if is_policy_change
        else f"Project details updated for {proj.name}"
    )

    ActivityLogger.log(
        db=db,
        event_type=event_type,
        event_description=event_desc,
        user=user,
        resource_type="project",
        resource_id=proj.id,
        project_name=proj.name,
        status="SUCCESS",
        metadata={"strictness": proj.trust_policy.get("strictness") if is_policy_change else None}
    )

    return proj

@router.post("/{project_id}/peers")
def set_project_peer_weight(
    project_id: str,
    peer_data: ProjectPeerWeightUpdate,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    source_proj = GitHubService.find_project(db, project_id)
    if not source_proj:
        raise HTTPException(status_code=404, detail="Source project not found")

    target_proj = GitHubService.find_project(db, peer_data.target_project_id)
    if not target_proj:
        raise HTTPException(status_code=404, detail=f"Target peer project '{peer_data.target_project_id}' not found")

    if project_id == peer_data.target_project_id:
        raise HTTPException(status_code=400, detail="A project cannot set an external peer weight for itself")

    # Find or create ProjectTrustEdge
    edge = db.query(ProjectTrustEdge).filter(
        ProjectTrustEdge.source_project_id == project_id,
        ProjectTrustEdge.target_project_id == peer_data.target_project_id
    ).first()

    if not edge:
        edge = ProjectTrustEdge(
            id=f"edge-{project_id[:12]}-{peer_data.target_project_id[:12]}",
            source_project_id=project_id,
            target_project_id=peer_data.target_project_id,
            trust_weight=peer_data.trust_weight,
            notes=peer_data.notes or f"Peering configured by {source_proj.name}"
        )
        db.add(edge)
    else:
        edge.trust_weight = peer_data.trust_weight
        if peer_data.notes:
            edge.notes = peer_data.notes

    # Update in project.trust_policy_json as well for consistency
    cur_policy = source_proj.trust_policy
    if "peer_weights" not in cur_policy or not isinstance(cur_policy["peer_weights"], dict):
        cur_policy["peer_weights"] = {}
    cur_policy["peer_weights"][peer_data.target_project_id] = peer_data.trust_weight
    source_proj.trust_policy = cur_policy

    db.commit()

    ActivityLogger.log(
        db=db,
        event_type="PROJECT_PEER_CONFIG_CHANGED",
        event_description=f"Autonomous trust weight from {source_proj.name} to {target_proj.name} updated to {peer_data.trust_weight}",
        user=user,
        resource_type="project",
        resource_id=source_proj.id,
        project_name=source_proj.name,
        status="SUCCESS",
        metadata={
            "source_project": source_proj.name,
            "target_project": target_proj.name,
            "trust_weight": peer_data.trust_weight
        }
    )

    return {
        "status": "success",
        "source_project": source_proj.name,
        "target_project": target_proj.name,
        "trust_weight": peer_data.trust_weight,
        "notes": edge.notes
    }

@router.get("/{project_id}/relationships", response_model=ProjectRelationshipOut)
def get_project_relationships(project_id: str, db: Session = Depends(get_db)):
    proj = GitHubService.find_project(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Outgoing peers (projects trusted by this project)
    out_edges = db.query(ProjectTrustEdge).filter(ProjectTrustEdge.source_project_id == proj.id).all()
    outgoing_peers = []
    for e in out_edges:
        target = db.query(Project).filter(Project.id == e.target_project_id).first()
        outgoing_peers.append({
            "project_id": e.target_project_id,
            "project_name": target.name if target else e.target_project_id,
            "trust_weight": e.trust_weight,
            "notes": e.notes
        })

    # Incoming peers (projects that trust this project)
    in_edges = db.query(ProjectTrustEdge).filter(ProjectTrustEdge.target_project_id == proj.id).all()
    incoming_peers = []
    for e in in_edges:
        source = db.query(Project).filter(Project.id == e.source_project_id).first()
        incoming_peers.append({
            "project_id": e.source_project_id,
            "project_name": source.name if source else e.source_project_id,
            "trust_weight": e.trust_weight,
            "notes": e.notes
        })

    # Vouches given
    vouches_count = db.query(Vouch).filter(Vouch.source_project_id == project_id).count()
    # Reports lodged
    reports_count = db.query(Denouncement).filter(Denouncement.reporting_project_id == project_id).count()

    # Associated contributors (endorsed or reported by this project)
    v_contrib_ids = [v.contributor_id for v in db.query(Vouch).filter(Vouch.source_project_id == project_id).all()]
    d_contrib_ids = [d.contributor_id for d in db.query(Denouncement).filter(Denouncement.reporting_project_id == project_id).all()]
    all_associated_cids = list(set(v_contrib_ids + d_contrib_ids))

    associated_contributors = []
    for cid in all_associated_cids:
        c = db.query(Contributor).filter(Contributor.id == cid).first()
        if c:
            associated_contributors.append({
                "id": c.id,
                "username": c.username,
                "display_name": c.display_name,
                "reputation_state": c.reputation_state,
                "avatar_url": c.avatar_url
            })

    return ProjectRelationshipOut(
        project_id=proj.id,
        project_name=proj.name,
        incoming_peers=incoming_peers,
        outgoing_peers=outgoing_peers,
        vouches_given_count=vouches_count,
        reports_lodged_count=reports_count,
        associated_contributors=associated_contributors
    )
