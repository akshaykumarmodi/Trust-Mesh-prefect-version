from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Project
from app.schemas import ProjectOut, ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.stars.desc()).all()

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return proj

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
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
    
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj

@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, data: ProjectUpdate, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.name is not None:
        proj.name = data.name
    if data.description is not None:
        proj.description = data.description
    if data.repo_url is not None:
        proj.repo_url = data.repo_url
    if data.category is not None:
        proj.category = data.category
    if data.stars is not None:
        proj.stars = data.stars
    if data.trust_policy is not None:
        proj.trust_policy = data.trust_policy

    db.commit()
    db.refresh(proj)
    return proj
