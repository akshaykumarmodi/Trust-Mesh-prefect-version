from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models import Contributor, Project, Vouch, Denouncement, ProjectTrustEdge, CoordinatedCampaign
from app.schemas import TrustEvaluationOut, SignalDetail

class TrustEvaluationEngine:
    """
    Deterministic, explainable trust evaluation engine.
    Core Principles:
    1. A new contributor is not automatically suspicious.
    2. An allegation is not proof.
    3. Trust decisions are project-specific (no central authority).
    4. Every assessment must be explainable down to provenance and policy rules.
    """

    @staticmethod
    def evaluate(
        db: Session,
        contributor_id: str,
        viewing_project_id: Optional[str] = None
    ) -> TrustEvaluationOut:
        contributor = db.query(Contributor).filter(Contributor.id == contributor_id).first()
        if not contributor:
            raise ValueError(f"Contributor with id {contributor_id} not found")

        # Resolve viewing project
        viewing_project = None
        if viewing_project_id:
            viewing_project = db.query(Project).filter(Project.id == viewing_project_id).first()
        
        # If no viewing project specified, pick the first project or use default balanced policy
        if not viewing_project:
            viewing_project = db.query(Project).first()
            if viewing_project:
                viewing_project_id = viewing_project.id
            else:
                viewing_project_id = "default"

        viewing_project_name = viewing_project.name if viewing_project else "Global Default Policy"
        
        # Load project-specific trust edges (weights assigned by viewing project to other projects)
        peer_trust_weights: Dict[str, float] = {}
        if viewing_project:
            edges = db.query(ProjectTrustEdge).filter(ProjectTrustEdge.source_project_id == viewing_project.id).all()
            for edge in edges:
                peer_trust_weights[edge.target_project_id] = edge.trust_weight
            
            # Self-trust is 1.0
            peer_trust_weights[viewing_project.id] = 1.0
            
            # Merge with policy JSON if present
            policy_dict = viewing_project.trust_policy
            if "peer_weights" in policy_dict and isinstance(policy_dict["peer_weights"], dict):
                for pid, w in policy_dict["peer_weights"].items():
                    peer_trust_weights[pid] = float(w)

        # Retrieve all vouches for this contributor
        vouches = db.query(Vouch).filter(Vouch.contributor_id == contributor_id).all()
        # Retrieve all denouncements for this contributor
        denouncements = db.query(Denouncement).filter(Denouncement.contributor_id == contributor_id).all()
        
        # Retrieve campaign memberships
        all_campaigns = db.query(CoordinatedCampaign).all()
        contributor_campaigns = [
            c for c in all_campaigns 
            if contributor_id in c.contributor_ids or contributor.username in c.contributor_ids
        ]

        signals_considered: List[SignalDetail] = []
        signals_discounted: List[SignalDetail] = []
        applied_policy_rules: List[str] = []
        missing_evidence_hints: List[str] = []

        applied_policy_rules.append(
            f"Evaluated from perspective of '{viewing_project_name}' (ID: {viewing_project_id})"
        )

        effective_vouch_weight = 0.0
        effective_denounce_weight = 0.0

        # --- Process Vouches ---
        for v in vouches:
            src_proj = db.query(Project).filter(Project.id == v.source_project_id).first()
            src_name = src_proj.name if src_proj else v.source_project_id
            
            # Weight assigned by viewing project to source project
            # Default to 0.7 for known peer projects if not explicitly defined, or 1.0 if self
            weight = peer_trust_weights.get(v.source_project_id, 0.7 if v.source_project_id != viewing_project_id else 1.0)
            
            signal = SignalDetail(
                source=f"Vouch by {src_name}",
                type="VOUCH",
                source_project_id=v.source_project_id,
                source_project_name=src_name,
                reason=v.reason,
                evidence_url=v.evidence_url,
                peer_trust_weight_applied=weight,
                raw_confidence=v.confidence,
                discount_reason=None if weight > 0 else f"Source project {src_name} has zero weight in viewing project policy",
                status="Active"
            )

            if weight > 0:
                weighted_val = v.confidence * weight
                effective_vouch_weight += weighted_val
                signals_considered.append(signal)
            else:
                signals_discounted.append(signal)

        # --- Process Denouncements ---
        for d in denouncements:
            rep_proj = db.query(Project).filter(Project.id == d.reporting_project_id).first()
            rep_name = rep_proj.name if rep_proj else d.reporting_project_id
            
            weight = peer_trust_weights.get(d.reporting_project_id, 0.7 if d.reporting_project_id != viewing_project_id else 1.0)
            
            # Crucial Fairness Principle:
            # Allegations are not facts. Denouncements that are 'Dismissed' are not counted.
            # 'Pending Review' denouncements receive a discounted weight (0.35 * weight) to prevent smear campaigns.
            status_multiplier = 0.0
            discount_note = None

            if d.status == "Reviewed" or d.status == "Confirmed":
                status_multiplier = 1.0
            elif d.status == "Under Investigation":
                status_multiplier = 0.6
                discount_note = "Under Investigation (status discount: 40% reduction applied)"
            elif d.status == "Pending Review":
                status_multiplier = 0.35
                discount_note = "Unverified Allegation (status discount: 65% reduction pending maintainer review)"
            elif d.status == "Dismissed":
                status_multiplier = 0.0
                discount_note = "Dismissed Allegation: ignored in final evaluation"

            effective_w = weight * status_multiplier
            signal = SignalDetail(
                source=f"Report by {rep_name}",
                type="DENOUNCEMENT",
                source_project_id=d.reporting_project_id,
                source_project_name=rep_name,
                reason=d.reason,
                evidence_url=d.evidence_url,
                peer_trust_weight_applied=effective_w,
                raw_confidence=1.0,
                discount_reason=discount_note if discount_note else (None if weight > 0 else "Source project untrusted"),
                status=d.status
            )

            if effective_w > 0:
                effective_denounce_weight += effective_w
                signals_considered.append(signal)
            else:
                signals_discounted.append(signal)

        # --- Process Campaign Flags ---
        for cmp in contributor_campaigns:
            applied_policy_rules.append(
                f"Contributor correlated with {cmp.campaign_code} ({cmp.name}, Signal: {int(cmp.signal_strength * 100)}%)"
            )
            if cmp.status == "Active Investigation" or cmp.status == "Confirmed Coordinated Abuse":
                effective_denounce_weight += (cmp.signal_strength * 1.5)
                signals_considered.append(SignalDetail(
                    source=f"Campaign Detection: {cmp.campaign_code}",
                    type="CAMPAIGN_CORRELATION",
                    source_project_id="trustmesh-engine",
                    source_project_name="TrustMesh Intelligence",
                    reason=f"Pattern: {cmp.pattern_type} ({cmp.name})",
                    evidence_url=f"/campaigns/{cmp.id}",
                    peer_trust_weight_applied=cmp.signal_strength,
                    raw_confidence=cmp.signal_strength,
                    discount_reason=None,
                    status=cmp.status
                ))

        # --- Determine Reputation State and Confidence ---
        newcomer_fairness_applied = False
        conflicting_signals_detected = False

        total_signals = len(vouches) + len(denouncements) + len(contributor_campaigns)

        has_vouch_evidence = effective_vouch_weight >= 0.3
        has_active_reports = effective_denounce_weight >= 0.2 or any(d.status in ["Pending Review", "Under Investigation", "Reviewed"] for d in denouncements)

        if total_signals == 0:
            # Case 1: NEWCOMER
            reputation_state = "NEWCOMER"
            trust_confidence = 0.50 # Neutral midpoint
            newcomer_fairness_applied = True
            applied_policy_rules.append(
                "Newcomer Fairness Rule applied: Contributor has zero records. Neutral baseline (0.50) assigned."
            )
            missing_evidence_hints.append("No vouches recorded yet. Welcoming first-time contribution review recommended.")
            summary_explanation = (
                f"{contributor.username} is a new contributor with no prior history on TrustMesh. "
                "Following the core TrustMesh fairness principle, lack of reputation history is never treated as suspicious. "
                "Maintainers are encouraged to review pull requests based on code quality and standard tests."
            )
        elif has_vouch_evidence and has_active_reports:
            # Case 2: CONFLICTING SIGNALS
            reputation_state = "UNDER REVIEW"
            conflicting_signals_detected = True
            trust_confidence = 0.50
            applied_policy_rules.append(
                "Conflict Resolution Rule: Positive endorsements exist alongside active allegations. Flagged for human review."
            )
            missing_evidence_hints.append("Cross-project evidence discrepancy requires maintainer human oversight.")
            summary_explanation = (
                f"{contributor.username} has conflicting signals: endorsed by trusted peers "
                f"(effective vouch weight: {effective_vouch_weight:.2f}) but also subject to reports "
                f"(effective alert weight: {effective_denounce_weight:.2f}). Both sets of evidence are displayed side-by-side."
            )
        elif effective_denounce_weight >= 1.2 or (contributor_campaigns and any(c.status == "Confirmed Coordinated Abuse" for c in contributor_campaigns)):
            # Case 3: UNDER REVIEW / SUSPICIOUS
            reputation_state = "UNDER REVIEW"
            trust_confidence = max(0.10, 0.45 - (effective_denounce_weight * 0.15))
            applied_policy_rules.append(
                f"Abuse Precaution Rule: Accumulated verified alerts ({effective_denounce_weight:.2f}) exceed policy threshold."
            )
            summary_explanation = (
                f"Elevated risk signals detected for {contributor.username}. "
                f"Correlated reports or automated campaign patterns require careful inspection before merging contributions."
            )
        elif effective_vouch_weight >= 1.0 and effective_denounce_weight == 0.0:
            # Case 4: ESTABLISHED
            reputation_state = "ESTABLISHED"
            trust_confidence = min(0.98, 0.70 + (effective_vouch_weight * 0.10))
            applied_policy_rules.append(
                f"Peer Endorsement Rule: Contributor has {len(vouches)} positive vouches from trusted ecosystem peers."
            )
            summary_explanation = (
                f"{contributor.username} has verified positive contributions corroborated across multiple projects. "
                f"High confidence peer vouches with attached evidence."
            )
        elif effective_vouch_weight > 0 and effective_vouch_weight < 1.0:
            # Case 5: INSUFFICIENT EVIDENCE
            reputation_state = "INSUFFICIENT EVIDENCE"
            trust_confidence = 0.60
            applied_policy_rules.append(
                "Evidence Depth Rule: Limited vouches received, below the multi-peer threshold for ESTABLISHED."
            )
            missing_evidence_hints.append("Additional cross-project vouches needed to qualify for fully ESTABLISHED status.")
            summary_explanation = (
                f"{contributor.username} has some positive interactions, but insufficient data to establish a firm ecosystem profile."
            )
        else:
            # Default fallback
            reputation_state = "INSUFFICIENT EVIDENCE"
            trust_confidence = 0.50
            summary_explanation = f"Evaluation reflects limited signal depth for {contributor.username}."

        return TrustEvaluationOut(
            contributor_id=contributor.id,
            username=contributor.username,
            viewing_project_id=viewing_project_id,
            viewing_project_name=viewing_project_name,
            reputation_state=reputation_state,
            trust_confidence=round(trust_confidence, 2),
            effective_vouch_weight=round(effective_vouch_weight, 2),
            effective_denounce_weight=round(effective_denounce_weight, 2),
            conflicting_signals_detected=conflicting_signals_detected,
            newcomer_fairness_applied=newcomer_fairness_applied,
            summary_explanation=summary_explanation,
            signals_considered=signals_considered,
            signals_discounted=signals_discounted,
            missing_evidence_hints=missing_evidence_hints,
            applied_policy_rules=applied_policy_rules
        )
