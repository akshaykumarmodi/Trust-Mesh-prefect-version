from typing import List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import CoordinatedCampaign, Contributor, Denouncement, Project

class CampaignDetectionEngine:
    """
    Deterministic campaign intelligence service.
    Analyzes cross-repository activity patterns to identify coordinated spam,
    AI-generated docstring slop waves, and sybil contributor swarms.
    """

    @staticmethod
    def get_all_campaigns(db: Session) -> List[CoordinatedCampaign]:
        return db.query(CoordinatedCampaign).order_by(CoordinatedCampaign.detected_at.desc()).all()

    @staticmethod
    def get_campaign_by_id(db: Session, campaign_id: str) -> CoordinatedCampaign:
        return db.query(CoordinatedCampaign).filter(CoordinatedCampaign.id == campaign_id).first()

    @staticmethod
    def analyze_patterns(db: Session) -> Dict[str, Any]:
        """
        Runs deterministic pattern analysis across all reports and contributor signals.
        Returns summary metrics and newly detected correlation clusters.
        """
        campaigns = db.query(CoordinatedCampaign).all()
        denouncements = db.query(Denouncement).all()
        contributors = db.query(Contributor).all()
        projects = db.query(Project).all()

        active_investigations = [c for c in campaigns if c.status == "Active Investigation"]
        confirmed_campaigns = [c for c in campaigns if c.status == "Confirmed Coordinated Abuse"]

        # Group reports by reason/pattern to identify emerging clusters
        pattern_clusters: Dict[str, List[Denouncement]] = {}
        for d in denouncements:
            key = d.reason.lower().strip()
            if key not in pattern_clusters:
                pattern_clusters[key] = []
            pattern_clusters[key].append(d)

        emerging_signals = []
        for reason, reports in pattern_clusters.items():
            if len(reports) >= 2:
                affected_pids = list({r.reporting_project_id for r in reports})
                affected_cids = list({r.contributor_id for r in reports})
                emerging_signals.append({
                    "pattern": reason,
                    "report_count": len(reports),
                    "affected_projects_count": len(affected_pids),
                    "contributor_count": len(affected_cids),
                    "correlation_strength": min(0.95, 0.4 + (len(reports) * 0.15))
                })

        return {
            "total_campaigns": len(campaigns),
            "active_investigations_count": len(active_investigations),
            "confirmed_campaigns_count": len(confirmed_campaigns),
            "emerging_signals": emerging_signals,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
