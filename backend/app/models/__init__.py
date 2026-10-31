from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey
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
    
    # JSON-encoded dictionary: { "min_confidence": 0.6, "peer_weights": {"proj-xyz": 0.8}, "strictness": "balanced" }
    trust_policy_json = Column(Text, default="{}")
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    vouches_given = relationship("Vouch", back_populates="source_project", foreign_keys="Vouch.source_project_id")
    denouncements_made = relationship("Denouncement", back_populates="reporting_project", foreign_keys="Denouncement.reporting_project_id")

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
