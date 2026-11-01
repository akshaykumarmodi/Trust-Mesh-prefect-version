import math
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Project, Contributor, Vouch, Denouncement, ProjectTrustEdge
from app.schemas import NetworkGraphOut, GraphNode, GraphEdge

router = APIRouter(prefix="/network", tags=["network"])

@router.get("", response_model=NetworkGraphOut)
def get_network_graph(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    contributors = db.query(Contributor).all()
    vouches = db.query(Vouch).all()
    denouncements = db.query(Denouncement).all()
    edges_raw = db.query(ProjectTrustEdge).all()

    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []

    # Position layout calculation (circular orbit layout for projects, clustered contributors)
    proj_radius = 340
    proj_center_x = 550
    proj_center_y = 380

    proj_positions = {}
    for i, p in enumerate(projects):
        angle = (2 * math.pi / max(len(projects), 1)) * i - (math.pi / 2)
        px = proj_center_x + proj_radius * math.cos(angle)
        py = proj_center_y + proj_radius * math.sin(angle)
        proj_positions[p.id] = (px, py)

        # Count project stats
        v_count = sum(1 for v in vouches if v.source_project_id == p.id)
        d_count = sum(1 for d in denouncements if d.reporting_project_id == p.id)

        nodes.append(GraphNode(
            id=p.id,
            type="projectNode",
            data={
                "id": p.id,
                "name": p.name,
                "slug": p.slug,
                "category": p.category,
                "stars": p.stars,
                "repo_url": p.repo_url,
                "trust_policy": p.trust_policy,
                "vouches_given": v_count,
                "reports_made": d_count
            },
            position={"x": round(px, 1), "y": round(py, 1)}
        ))

    # Contributors positions
    contrib_radius = 180
    for j, c in enumerate(contributors):
        # Position contributors in an inner orbit with offset
        angle = (2 * math.pi / max(len(contributors), 1)) * j - (math.pi / 4)
        cx = proj_center_x + (contrib_radius * 1.1) * math.cos(angle)
        cy = proj_center_y + (contrib_radius * 1.1) * math.sin(angle)

        c_vouches = [v for v in vouches if v.contributor_id == c.id]
        c_denounce = [d for d in denouncements if d.contributor_id == c.id]

        nodes.append(GraphNode(
            id=c.id,
            type="contributorNode",
            data={
                "id": c.id,
                "username": c.username,
                "display_name": c.display_name or c.username,
                "avatar_url": c.avatar_url,
                "github_url": c.github_url,
                "reputation_state": c.reputation_state,
                "skills": c.skills,
                "vouches_count": len(c_vouches),
                "denouncements_count": len(c_denounce)
            },
            position={"x": round(cx, 1), "y": round(cy, 1)}
        ))

    # Add Project Peer Edges (Federation)
    for pe in edges_raw:
        edges.append(GraphEdge(
            id=f"peer-{pe.source_project_id}-{pe.target_project_id}",
            source=pe.source_project_id,
            target=pe.target_project_id,
            type="straight",
            animated=False,
            label=f"Trust {int(pe.trust_weight * 100)}%",
            data={
                "edge_type": "FEDERATION",
                "weight": pe.trust_weight,
                "notes": pe.notes
            }
        ))

    # Add Vouch Edges
    for v in vouches:
        edges.append(GraphEdge(
            id=f"vouch-edge-{v.id}",
            source=v.source_project_id,
            target=v.contributor_id,
            type="smoothstep",
            animated=True,
            label="Vouch",
            data={
                "edge_type": "VOUCH",
                "reason": v.reason,
                "confidence": v.confidence,
                "evidence_url": v.evidence_url
            }
        ))

    # Add Denouncement Edges
    for d in denouncements:
        edges.append(GraphEdge(
            id=f"denounce-edge-{d.id}",
            source=d.reporting_project_id,
            target=d.contributor_id,
            type="smoothstep",
            animated=d.status in ["Pending Review", "Under Investigation"],
            label=f"Report ({d.status})",
            data={
                "edge_type": "DENOUNCEMENT",
                "reason": d.reason,
                "status": d.status,
                "evidence_url": d.evidence_url
            }
        ))

    stats = {
        "projects_count": len(projects),
        "contributors_count": len(contributors),
        "vouches_count": len(vouches),
        "denouncements_count": len(denouncements),
        "total_nodes": len(nodes),
        "total_edges": len(edges)
    }

    return NetworkGraphOut(nodes=nodes, edges=edges, stats=stats)
