from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Vouch, Denouncement, CoordinatedCampaign, Contributor, Project

router = APIRouter(prefix="/evidence", tags=["evidence"])

@router.get("")
def list_evidence(
    type_filter: Optional[str] = Query(None, alias="type"), # vouch, denouncement, campaign
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    records = []

    # 1. From Vouches
    if not type_filter or type_filter.lower() == "vouch":
        vouches = db.query(Vouch).all()
        for v in vouches:
            c = db.query(Contributor).filter(Contributor.id == v.contributor_id).first()
            p = db.query(Project).filter(Project.id == v.source_project_id).first()
            records.append({
                "id": f"ev-{v.id}",
                "type": "VOUCH",
                "title": f"Peer Vouch: {v.reason}",
                "contributor_id": v.contributor_id,
                "contributor_username": c.username if c else "unknown",
                "source_project": p.name if p else v.source_project_id,
                "evidence_url": v.evidence_url,
                "details": v.context or "Verifiable pull request contribution",
                "status": "Verified Endorsement",
                "confidence": v.confidence,
                "provenance_hash": v.provenance_hash,
                "timestamp": v.created_at.isoformat()
            })

    # 2. From Denouncements
    if not type_filter or type_filter.lower() == "denouncement":
        denouncements = db.query(Denouncement).all()
        for d in denouncements:
            c = db.query(Contributor).filter(Contributor.id == d.contributor_id).first()
            p = db.query(Project).filter(Project.id == d.reporting_project_id).first()
            records.append({
                "id": f"ev-{d.id}",
                "type": "DENOUNCEMENT",
                "title": f"Reported Anomaly: {d.reason}",
                "contributor_id": d.contributor_id,
                "contributor_username": c.username if c else "unknown",
                "source_project": p.name if p else d.reporting_project_id,
                "evidence_url": d.evidence_url,
                "details": d.details or "Pending investigation",
                "status": d.status,
                "confidence": 0.85 if d.status == "Reviewed" else 0.40,
                "provenance_hash": f"prov-rep-{d.id[:8]}",
                "timestamp": d.created_at.isoformat()
            })

    # 3. From Campaigns
    if not type_filter or type_filter.lower() == "campaign":
        campaigns = db.query(CoordinatedCampaign).all()
        for cmp in campaigns:
            for idx, ev in enumerate(cmp.evidence_records):
                records.append({
                    "id": f"ev-{cmp.id}-{idx}",
                    "type": "CAMPAIGN_CORRELATION",
                    "title": f"Campaign Signal: {cmp.name}",
                    "contributor_id": "cluster",
                    "contributor_username": "multiple accounts",
                    "source_project": ev.get("repo", "cross-repo cluster"),
                    "evidence_url": ev.get("pr_url", f"/campaigns/{cmp.id}"),
                    "details": f"Pattern: {ev.get('pattern', cmp.pattern_type)}. Sample: {ev.get('diff_sample', '')}",
                    "status": cmp.status,
                    "confidence": cmp.signal_strength,
                    "provenance_hash": f"prov-cmp-{cmp.campaign_code[:10]}",
                    "timestamp": cmp.detected_at.isoformat()
                })

    if search:
        s = search.lower()
        records = [
            r for r in records
            if s in r["title"].lower() 
            or s in r["contributor_username"].lower() 
            or s in r["source_project"].lower()
            or s in r["evidence_url"].lower()
        ]

    records.sort(key=lambda x: x["timestamp"], reverse=True)
    return records
