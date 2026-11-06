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

    # Position layout calculation (Generous non-overlapping orbital & cluster topology)
    center_x = 900
    center_y = 700
    proj_radius = 540

    proj_positions = {}
    for i, p in enumerate(projects):
        angle = (2 * math.pi / max(len(projects), 1)) * i - (math.pi / 2)
        px = center_x + proj_radius * math.cos(angle)
        py = center_y + proj_radius * math.sin(angle)
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

    # Contributors positions (Spacious multi-tier layout guaranteeing zero node overlap)
    # 1. Identify which contributors are directly connected via vouches or denouncements
    connected_contrib_map = {}
    for v in vouches:
        connected_contrib_map.setdefault(v.contributor_id, []).append(v.source_project_id)
    for d in denouncements:
        connected_contrib_map.setdefault(d.contributor_id, []).append(d.reporting_project_id)

    # Position connected contributors clustered near their respective projects
    placed_contributors = set()
    project_contrib_counts = {}
    
    for c in contributors:
        c_vouches = [v for v in vouches if v.contributor_id == c.id]
        c_denounce = [d for d in denouncements if d.contributor_id == c.id]
        
        if c.id in connected_contrib_map:
            prime_proj_id = connected_contrib_map[c.id][0]
            if prime_proj_id in proj_positions:
                ppx, ppy = proj_positions[prime_proj_id]
                idx = project_contrib_counts.get(prime_proj_id, 0)
                project_contrib_counts[prime_proj_id] = idx + 1
                
                # Offset radially inward/outward with ample clearance
                orbit_dist = 280 + (idx // 4) * 160
                sub_angle = (math.pi / 2) * (idx % 4) - (math.pi / 4)
                cx = ppx + orbit_dist * math.cos(sub_angle)
                cy = ppy + orbit_dist * math.sin(sub_angle)
                
                placed_contributors.add(c.id)
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

    # 2. Position remaining contributors in expansive multi-tier outer orbits (with minimum 280px spacing)
    unplaced = [c for c in contributors if c.id not in placed_contributors]
    tier_radii = [880, 1200, 1520, 1840]
    unplaced_idx = 0
    
    for tier_r in tier_radii:
        circumference = 2 * math.pi * tier_r
        nodes_in_tier = max(1, int(circumference / 320))  # Ensure ~320px arc distance between nodes
        tier_items = unplaced[unplaced_idx : unplaced_idx + nodes_in_tier]
        unplaced_idx += len(tier_items)
        
        for k, c in enumerate(tier_items):
            angle = (2 * math.pi / max(len(tier_items), 1)) * k + (tier_r * 0.001)
            cx = center_x + tier_r * math.cos(angle)
            cy = center_y + tier_r * math.sin(angle)
            
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
            
        if unplaced_idx >= len(unplaced):
            break

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
