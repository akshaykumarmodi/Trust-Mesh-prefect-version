from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# --- Projects ---
class ProjectBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""
    repo_url: Optional[str] = ""
    category: Optional[str] = "Infrastructure"
    stars: Optional[int] = 0
    trust_policy: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ProjectCreate(ProjectBase):
    id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    repo_url: Optional[str] = None
    category: Optional[str] = None
    stars: Optional[int] = None
    trust_policy: Optional[Dict[str, Any]] = None

class ProjectOut(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Vouches ---
class VouchCreate(BaseModel):
    contributor_username: str
    source_project_id: str
    reason: str
    evidence_url: str
    context: Optional[str] = ""
    confidence: Optional[float] = 1.0

class VouchOut(BaseModel):
    id: str
    contributor_id: str
    contributor_username: Optional[str] = None
    source_project_id: str
    source_project_name: Optional[str] = None
    reason: str
    evidence_url: str
    context: Optional[str] = ""
    confidence: float
    provenance_hash: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Denouncements ---
class DenouncementCreate(BaseModel):
    contributor_username: str
    reporting_project_id: str
    reason: str
    evidence_url: str
    details: Optional[str] = ""

class DenouncementStatusUpdate(BaseModel):
    status: str # Pending Review, Under Investigation, Reviewed, Dismissed
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None

class DenouncementOut(BaseModel):
    id: str
    contributor_id: str
    contributor_username: Optional[str] = None
    reporting_project_id: str
    reporting_project_name: Optional[str] = None
    reason: str
    evidence_url: str
    details: Optional[str] = ""
    status: str
    review_notes: Optional[str] = ""
    reviewed_by: Optional[str] = ""
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Contributors ---
class ContributorBase(BaseModel):
    username: str
    display_name: Optional[str] = ""
    avatar_url: Optional[str] = ""
    github_url: Optional[str] = ""
    bio: Optional[str] = ""
    skills: Optional[List[str]] = Field(default_factory=list)
    reputation_state: Optional[str] = "NEWCOMER"
    total_contributions: Optional[int] = 0

class ContributorCreate(ContributorBase):
    id: Optional[str] = None

class ContributorOut(ContributorBase):
    id: str
    first_seen_at: datetime
    created_at: datetime
    updated_at: datetime
    vouches: List[VouchOut] = Field(default_factory=list)
    denouncements: List[DenouncementOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

# --- Trust Evaluation ---
class SignalDetail(BaseModel):
    source: str
    type: str # VOUCH, DENOUNCEMENT, CAMPAIGN_CORRELATION
    source_project_id: str
    source_project_name: str
    reason: str
    evidence_url: str
    peer_trust_weight_applied: float
    raw_confidence: float
    discount_reason: Optional[str] = None
    status: Optional[str] = None

class TrustEvaluationOut(BaseModel):
    contributor_id: str
    username: str
    viewing_project_id: str
    viewing_project_name: str
    reputation_state: str # NEWCOMER, INSUFFICIENT EVIDENCE, ESTABLISHED, UNDER REVIEW
    trust_confidence: float # 0.0 to 1.0 (explainable)
    effective_vouch_weight: float
    effective_denounce_weight: float
    conflicting_signals_detected: bool
    newcomer_fairness_applied: bool
    summary_explanation: str
    signals_considered: List[SignalDetail]
    signals_discounted: List[SignalDetail]
    missing_evidence_hints: List[str]
    applied_policy_rules: List[str]

# --- Coordinated Campaigns ---
class CampaignOut(BaseModel):
    id: str
    campaign_code: str
    name: str
    pattern_type: str
    description: str
    signal_strength: float
    affected_projects: List[str]
    contributor_ids: List[str]
    contributor_usernames: Optional[List[str]] = None
    evidence_records: List[Dict[str, Any]]
    status: str
    detected_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Network Graph Data for React Flow ---
class GraphNode(BaseModel):
    id: str
    type: str # projectNode, contributorNode
    data: Dict[str, Any]
    position: Dict[str, float]

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = "smoothstep"
    animated: Optional[bool] = False
    label: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class NetworkGraphOut(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: Dict[str, Any]

# --- Federation ---
class FederationBundle(BaseModel):
    version: str = "1.0.0"
    exported_at: datetime
    source_project: ProjectOut
    vouches: List[VouchOut]
    denouncements: List[DenouncementOut]
    peer_edges: List[Dict[str, Any]]
    signature_envelope: Dict[str, str]

# --- AI ---
class AIExplainRequest(BaseModel):
    target_type: str # contributor, campaign, or evidence
    target_id: str
    viewing_project_id: Optional[str] = None

class AIExplainResponse(BaseModel):
    target_id: str
    ai_model: str
    is_live_ai: bool
    summary: str
    key_findings: List[str]
    recommended_maintainer_action: str
    confidence_assessment: str
