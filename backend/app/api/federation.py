import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Project, Vouch, Denouncement, ProjectTrustEdge, Contributor
from app.schemas import FederationBundle, ProjectOut, VouchOut, DenouncementOut

router = APIRouter(prefix="/federation", tags=["federation"])

@router.get("/export/{project_id}", response_model=FederationBundle)
def export_project_bundle(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    vouches = db.query(Vouch).filter(Vouch.source_project_id == project_id).all()
    denouncements = db.query(Denouncement).filter(Denouncement.reporting_project_id == project_id).all()
    edges = db.query(ProjectTrustEdge).filter(ProjectTrustEdge.source_project_id == project_id).all()

    v_out = []
    for v in vouches:
        c = db.query(Contributor).filter(Contributor.id == v.contributor_id).first()
        v_out.append(VouchOut(
            id=v.id,
            contributor_id=v.contributor_id,
            contributor_username=c.username if c else "unknown",
            source_project_id=v.source_project_id,
            source_project_name=proj.name,
            reason=v.reason,
            evidence_url=v.evidence_url,
            context=v.context or "",
            confidence=v.confidence,
            provenance_hash=v.provenance_hash,
            created_at=v.created_at
        ))

    d_out = []
    for d in denouncements:
        c = db.query(Contributor).filter(Contributor.id == d.contributor_id).first()
        d_out.append(DenouncementOut(
            id=d.id,
            contributor_id=d.contributor_id,
            contributor_username=c.username if c else "unknown",
            reporting_project_id=d.reporting_project_id,
            reporting_project_name=proj.name,
            reason=d.reason,
            evidence_url=d.evidence_url,
            details=d.details or "",
            status=d.status,
            review_notes=d.review_notes or "",
            reviewed_by=d.reviewed_by or "",
            created_at=d.created_at,
            updated_at=d.updated_at
        ))

    e_out = [
        {"target_project_id": e.target_project_id, "weight": e.trust_weight, "notes": e.notes}
        for e in edges
    ]

    bundle_raw = f"{proj.id}:{len(v_out)}:{len(d_out)}:{datetime.now(timezone.utc).isoformat()}"
    signature = hashlib.sha256(bundle_raw.encode()).hexdigest()

    return FederationBundle(
        version="1.0.0",
        exported_at=datetime.now(timezone.utc),
        source_project=ProjectOut.model_validate(proj),
        vouches=v_out,
        denouncements=d_out,
        peer_edges=e_out,
        signature_envelope={
            "algorithm": "SHA256-ED25519-SIM",
            "signer_pubkey": f"tm_pk_{proj.slug}",
            "signature": signature
        }
    )

@router.post("/import")
def import_federation_bundle(bundle: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Imports a signed federation bundle from an external TrustMesh node.
    """
    if "source_project" not in bundle:
        raise HTTPException(status_code=400, detail="Invalid bundle structure: missing source_project")

    sp_data = bundle["source_project"]
    proj_id = sp_data.get("id")
    
    # Check if project exists or create it
    project = db.query(Project).filter(Project.id == proj_id).first()
    if not project:
        project = Project(
            id=proj_id,
            name=sp_data.get("name", "Imported Project"),
            slug=sp_data.get("slug", f"imported-{proj_id}"),
            description=sp_data.get("description", "Imported via TrustMesh Federation"),
            repo_url=sp_data.get("repo_url", ""),
            category=sp_data.get("category", "Federated"),
            stars=sp_data.get("stars", 100),
            trust_policy_json=json.dumps(sp_data.get("trust_policy", {}))
        )
        db.add(project)
        db.commit()

    imported_vouches = 0
    for v_item in bundle.get("vouches", []):
        v_id = v_item.get("id")
        existing_v = db.query(Vouch).filter(Vouch.id == v_id).first()
        if not existing_v:
            # Ensure contributor exists
            cid = v_item.get("contributor_id")
            cname = v_item.get("contributor_username", cid)
            contrib = db.query(Contributor).filter(Contributor.id == cid).first()
            if not contrib:
                contrib = Contributor(
                    id=cid,
                    username=cname,
                    display_name=cname,
                    avatar_url=f"https://github.com/{cname}.png",
                    github_url=f"https://github.com/{cname}",
                    reputation_state="ESTABLISHED",
                    total_contributions=1
                )
                db.add(contrib)
                db.commit()

            new_vouch = Vouch(
                id=v_id,
                contributor_id=cid,
                source_project_id=proj_id,
                reason=v_item.get("reason", "Imported vouch"),
                evidence_url=v_item.get("evidence_url", ""),
                context=v_item.get("context", ""),
                confidence=float(v_item.get("confidence", 1.0)),
                provenance_hash=v_item.get("provenance_hash", "imported-hash")
            )
            db.add(new_vouch)
            imported_vouches += 1

    db.commit()
    return {
        "status": "success",
        "imported_from_project": project.name,
        "vouches_imported": imported_vouches,
        "message": f"Federation bundle processed successfully from {project.name}."
    }
