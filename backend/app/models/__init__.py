from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database.session import Base

def utc_now():
    return datetime.now(timezone.utc)

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    slug = Column(String(128), unique=True, index=True, nullable=False)
    description = Column(Text, default="")
    repo_url = Column(String(255), default="")
    category = Column(String(64), default="Infrastructure")
    stars = Column(Integer, default=0)

    # GitHub Integration metadata
    is_github_connected = Column(Boolean, default=False, index=True)
    github_owner = Column(String(128), default="")
    github_repo = Column(String(128), default="")
    default_branch = Column(String(64), default="main")
    visibility = Column(String(32), default="public") # "public" or "private"
    github_created_at = Column(DateTime, nullable=True)
    github_updated_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String(32), default="IDLE") # IDLE, SYNCING, SUCCESS, ERROR
    sync_error = Column(Text, default="")

    # JSON-encoded dictionary: { "min_confidence": 0.6, "peer_weights": {"proj-xyz": 0.8}, "strictness": "balanced" }
    trust_policy_json = Column(Text, default="{}")

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    vouches_given = relationship("Vouch", back_populates="source_project", foreign_keys="Vouch.source_project_id")
    denouncements_made = relationship("Denouncement", back_populates="reporting_project", foreign_keys="Denouncement.reporting_project_id")
    pull_requests = relationship("GitHubPullRequest", back_populates="project", cascade="all, delete-orphan")

    @property
    def trust_policy(self):
        try:
            return json.loads(self.trust_policy_json or "{}")
        except Exception:
            return {}

    @trust_policy.setter
    def trust_policy(self, value):
        self.trust_policy_json = json.dumps(value)


class Contributor(Base):
    __tablename__ = "contributors"

    id = Column(String(64), primary_key=True, index=True)
    username = Column(String(128), unique=True, index=True, nullable=False)
    display_name = Column(String(128), default="")
    avatar_url = Column(String(255), default="")
    github_url = Column(String(255), default="")
    bio = Column(Text, default="")
    skills_json = Column(Text, default="[]")

    # Explicit states: NEWCOMER, INSUFFICIENT EVIDENCE, ESTABLISHED, UNDER REVIEW
    reputation_state = Column(String(32), default="NEWCOMER", index=True)
    first_seen_at = Column(DateTime, default=utc_now)
    total_contributions = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    vouches = relationship("Vouch", back_populates="contributor", cascade="all, delete-orphan")
    denouncements = relationship("Denouncement", back_populates="contributor", cascade="all, delete-orphan")

    @property
    def skills(self):
        try:
            return json.loads(self.skills_json or "[]")
        except Exception:
            return []

    @skills.setter
    def skills(self, value):
        self.skills_json = json.dumps(value)


class Vouch(Base):
    __tablename__ = "vouches"

    id = Column(String(64), primary_key=True, index=True)
    contributor_id = Column(String(64), ForeignKey("contributors.id"), nullable=False, index=True)
    source_project_id = Column(String(64), ForeignKey("projects.id"), nullable=False, index=True)
    reason = Column(String(255), nullable=False)
    evidence_url = Column(String(512), nullable=False)
    context = Column(Text, default="")
    confidence = Column(Float, default=1.0)
    provenance_hash = Column(String(128), default="")
    created_at = Column(DateTime, default=utc_now)

    contributor = relationship("Contributor", back_populates="vouches")
    source_project = relationship("Project", back_populates="vouches_given", foreign_keys=[source_project_id])


class Denouncement(Base):
    __tablename__ = "denouncements"

    id = Column(String(64), primary_key=True, index=True)
    contributor_id = Column(String(64), ForeignKey("contributors.id"), nullable=False, index=True)
    reporting_project_id = Column(String(64), ForeignKey("projects.id"), nullable=False, index=True)
    reason = Column(String(255), nullable=False)
    evidence_url = Column(String(512), nullable=False)
    details = Column(Text, default="")

    # Status: Pending Review, Under Investigation, Reviewed, Dismissed
    status = Column(String(32), default="Pending Review", index=True)
    review_notes = Column(Text, default="")
    reviewed_by = Column(String(128), default="")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    contributor = relationship("Contributor", back_populates="denouncements")
    reporting_project = relationship("Project", back_populates="denouncements_made", foreign_keys=[reporting_project_id])


class CoordinatedCampaign(Base):
    __tablename__ = "coordinated_campaigns"

    id = Column(String(64), primary_key=True, index=True)
    campaign_code = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    pattern_type = Column(String(64), nullable=False)
    description = Column(Text, default="")
    signal_strength = Column(Float, default=0.85)

    affected_projects_json = Column(Text, default="[]")
    contributor_ids_json = Column(Text, default="[]")
    evidence_records_json = Column(Text, default="[]")

    # Status: Active Investigation, Confirmed Coordinated Abuse, Dismissed
    status = Column(String(32), default="Active Investigation", index=True)
    detected_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    @property
    def affected_projects(self):
        try:
            return json.loads(self.affected_projects_json or "[]")
        except Exception:
            return []

    @affected_projects.setter
    def affected_projects(self, value):
        self.affected_projects_json = json.dumps(value)

    @property
    def contributor_ids(self):
        try:
            return json.loads(self.contributor_ids_json or "[]")
        except Exception:
            return []

    @contributor_ids.setter
    def contributor_ids(self, value):
        self.contributor_ids_json = json.dumps(value)

    @property
    def evidence_records(self):
        try:
            return json.loads(self.evidence_records_json or "[]")
        except Exception:
            return []

    @evidence_records.setter
    def evidence_records(self, value):
        self.evidence_records_json = json.dumps(value)


class ProjectTrustEdge(Base):
    __tablename__ = "project_trust_edges"

    id = Column(String(64), primary_key=True, index=True)
    source_project_id = Column(String(64), ForeignKey("projects.id"), nullable=False, index=True)
    target_project_id = Column(String(64), ForeignKey("projects.id"), nullable=False, index=True)
    trust_weight = Column(Float, default=1.0) # 0.0 to 1.0
    notes = Column(String(255), default="")
    created_at = Column(DateTime, default=utc_now)


class GitHubPullRequest(Base):
    __tablename__ = "github_pull_requests"

    id = Column(String(128), primary_key=True, index=True) # e.g. "ghpr-{project_id}-{pr_number}"
    project_id = Column(String(64), ForeignKey("projects.id"), nullable=False, index=True)
    pr_number = Column(Integer, nullable=False, index=True)
    title = Column(String(512), nullable=False)
    description = Column(Text, default="")
    author_username = Column(String(128), nullable=False, index=True)
    author_avatar_url = Column(String(255), default="")
    state = Column(String(32), default="open", index=True) # "open", "closed", "merged"
    is_merged = Column(Boolean, default=False)
    merged_at = Column(DateTime, nullable=True)
    base_branch = Column(String(64), default="main")
    head_branch = Column(String(64), default="")
    html_url = Column(String(512), nullable=False)
    commit_count = Column(Integer, default=1)
    review_status = Column(String(64), default="PENDING") # "APPROVED", "CHANGES_REQUESTED", "COMMENTED", "PENDING"
    ci_status = Column(String(64), default="UNKNOWN") # "SUCCESS", "FAILURE", "PENDING", "UNKNOWN"

    # Distinct verification statuses: "Verified GitHub record", "Unable to verify", "Verification unavailable"
    verification_status = Column(String(64), default="Verified GitHub record", index=True)
    verification_details = Column(Text, default="")
    verified_at = Column(DateTime, default=utc_now)

    # To clearly distinguish actual GitHub records from synthetic demo records
    is_synthetic = Column(Boolean, default=False)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="pull_requests")


class GitHubCredential(Base):
    __tablename__ = "github_credentials"

    id = Column(String(64), primary_key=True) # e.g. "default"
    encrypted_access_token = Column(Text, nullable=False)
    token_type = Column(String(32), default="bearer")
    scope = Column(String(255), default="")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True) # e.g. "usr-..."
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True) # None for pure OAuth users
    name = Column(String(128), default="")
    github_username = Column(String(128), default="")
    is_verified = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False, index=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    last_login_at = Column(DateTime, nullable=True)

    activity_logs = relationship("ActivityLog", back_populates="user")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(64), primary_key=True, index=True) # e.g. "act-..."
    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email = Column(String(255), default="", index=True)
    user_name = Column(String(128), default="")
    github_username = Column(String(128), default="")
    event_type = Column(String(64), nullable=False, index=True)
    event_description = Column(Text, nullable=False)
    resource_type = Column(String(64), default="", index=True)
    resource_id = Column(String(128), default="")
    project_name = Column(String(128), default="")
    timestamp = Column(DateTime, default=utc_now, index=True)
    status = Column(String(32), default="SUCCESS", index=True) # SUCCESS, FAILED, SUSPICIOUS, WARNING
    metadata_json = Column(Text, default="{}")

    user = relationship("User", back_populates="activity_logs")
    email_notifications = relationship("EmailNotification", back_populates="activity_log")

    @property
    def metadata_dict(self):
        try:
            return json.loads(self.metadata_json or "{}")
        except Exception:
            return {}

    @metadata_dict.setter
    def metadata_dict(self, value):
        self.metadata_json = json.dumps(value or {})


class EmailNotification(Base):
    __tablename__ = "email_notifications"

    id = Column(String(64), primary_key=True, index=True) # e.g. "eml-..."
    activity_log_id = Column(String(64), ForeignKey("activity_logs.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient = Column(String(255), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    html_content = Column(Text, default="")
    status = Column(String(32), default="SENT", index=True) # SENT, FAILED, RATE_LIMITED, SIMULATED
    resend_id = Column(String(128), default="")
    error_message = Column(Text, default="")
    attempt_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=utc_now)
    sent_at = Column(DateTime, nullable=True)

    activity_log = relationship("ActivityLog", back_populates="email_notifications")
