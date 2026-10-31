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
    is_github_connected: Optional[bool] = False
    github_owner: Optional[str] = ""
    github_repo: Optional[str] = ""
    default_branch: Optional[str] = "main"
    visibility: Optional[str] = "public"
    github_created_at: Optional[datetime] = None
    github_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    sync_status: Optional[str] = "IDLE"
    sync_error: Optional[str] = ""

class ProjectCreate(ProjectBase):
    id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    repo_url: Optional[str] = None
    category: Optional[str] = None
    stars: Optional[int] = None
    trust_policy: Optional[Dict[str, Any]] = None
    is_github_connected: Optional[bool] = None
    default_branch: Optional[str] = None
    visibility: Optional[str] = None

class ProjectOut(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ProjectPeerWeightUpdate(BaseModel):
    target_project_id: str
    trust_weight: float = Field(ge=0.0, le=1.0)
    notes: Optional[str] = ""

class ProjectRelationshipOut(BaseModel):
    project_id: str
    project_name: str
    incoming_peers: List[Dict[str, Any]]
    outgoing_peers: List[Dict[str, Any]]
    vouches_given_count: int
    reports_lodged_count: int
    associated_contributors: List[Dict[str, Any]]


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


# --- GitHub Integration ---
class GitHubRepoImportRequest(BaseModel):
    repo_url: str
    category: Optional[str] = "Infrastructure"
    custom_policy: Optional[Dict[str, Any]] = None

class GitHubPullRequestOut(BaseModel):
    id: str
    project_id: str
    pr_number: int
    title: str
    description: Optional[str] = ""
    author_username: str
    author_avatar_url: Optional[str] = ""
    state: str
    is_merged: bool
    merged_at: Optional[datetime] = None
    base_branch: str
    head_branch: str
    html_url: str
    commit_count: int
    review_status: str
    ci_status: str
    verification_status: str # "Verified GitHub record", "Unable to verify", "Verification unavailable"
    verification_details: Optional[str] = ""
    verified_at: Optional[datetime] = None
    is_synthetic: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class GitHubSyncResponse(BaseModel):
    project_id: str
    project_name: str
    synced_pull_requests: int
    status: str
    message: str
    last_synced_at: datetime

class GitHubAuthStatusOut(BaseModel):
    is_configured: bool
    client_id_configured: bool
    is_authenticated: bool
    authenticated_user: Optional[str] = None
    rate_limit_remaining: Optional[int] = None
    rate_limit_limit: Optional[int] = None
    rate_limit_reset: Optional[str] = None

class GitHubPRVerifyRequest(BaseModel):
    project_id: str
    pr_number: int
    canonical_url: Optional[str] = None

class GitHubPRVerifyResponse(BaseModel):
    pr_number: int
    canonical_url: str
    verification_status: str
    verification_details: str
    verified_at: datetime
    repository_match: bool
    api_source: str


# --- User Authentication ---
class UserRegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: Optional[str] = ""
    github_username: Optional[str] = ""

class UserLoginRequest(BaseModel):
    email: str
    password: str

class GitHubOAuthLoginRequest(BaseModel):
    code: Optional[str] = None
    state: Optional[str] = None
    mock_username: Optional[str] = None # For testing & local dev

class PasswordResetRequest(BaseModel):
    email: str
    new_password: str = Field(min_length=6)

class VerifyAccountRequest(BaseModel):
    email: str
    verification_code: Optional[str] = "123456"

class UserOut(BaseModel):
    id: str
    email: str
    name: Optional[str] = ""
    github_username: Optional[str] = ""
    is_verified: bool = True
    is_admin: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Activity Logs ---
class ActivityLogOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = ""
    user_name: Optional[str] = ""
    github_username: Optional[str] = ""
    event_type: str
    event_description: str
    resource_type: Optional[str] = ""
    resource_id: Optional[str] = ""
    project_name: Optional[str] = ""
    timestamp: datetime
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    model_config = ConfigDict(from_attributes=True)

class ActivityLogsListResponse(BaseModel):
    items: List[ActivityLogOut]
    total: int
    limit: int
    offset: int


# --- Email Notifications ---
class EmailNotificationOut(BaseModel):
    id: str
    activity_log_id: Optional[str] = None
    recipient: str
    subject: str
    status: str
    resend_id: Optional[str] = ""
    error_message: Optional[str] = ""
    attempt_count: int = 1
    created_at: datetime
    sent_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class EmailNotificationsListResponse(BaseModel):
    items: List[EmailNotificationOut]
    total: int


# --- Admin Monitoring & Metrics ---
class AdminMetricsResponse(BaseModel):
    total_activities: int
    total_users: int
    total_logins: int
    total_security_alerts: int
    emails_sent: int
    emails_failed: int
    emails_rate_limited: int
    emails_simulated: int
    resend_configured: bool
    admin_email: str

class TestEmailRequest(BaseModel):
    recipient: Optional[str] = None
    subject: Optional[str] = None

class TestEmailResponse(BaseModel):
    success: bool
    status: str
    message: str
    notification_id: Optional[str] = None
    admin_email: str

class PrivacyNoticeResponse(BaseModel):
    title: str
    effective_date: str
    disclosure: str
    collected_events: List[str]
    retention_policy: str
    security_controls: str
