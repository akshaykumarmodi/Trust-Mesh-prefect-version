import hashlib
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import Project, Contributor, Vouch, Denouncement, CoordinatedCampaign, ProjectTrustEdge

def make_hash(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()[:16]

def seed_database(db: Session, reset: bool = False):
    if reset:
        db.query(Vouch).delete()
        db.query(Denouncement).delete()
        db.query(ProjectTrustEdge).delete()
        db.query(CoordinatedCampaign).delete()
        db.query(Contributor).delete()
        db.query(Project).delete()
        db.commit()

    if db.query(Project).count() > 0:
        return

    now = datetime.now(timezone.utc)

    # 1. Projects
    projects = [
        Project(
            id="proj-hyperflow",
            name="HyperFlow Engine",
            slug="hyperflow-engine",
            description="High-performance async distributed task workflow execution runtime written in Rust and C++.",
            repo_url="https://github.com/hyperflow-org/hyperflow",
            category="Distributed Systems",
            stars=14200,
            trust_policy_json=json.dumps({
                "strictness": "high",
                "min_confidence": 0.70,
                "peer_weights": {
                    "proj-cloudnative": 1.0,
                    "proj-cryptomesh": 0.85,
                    "proj-devpulse": 0.80,
                    "proj-tensorserve": 0.20
                }
            }),
            created_at=now - timedelta(days=120)
        ),
        Project(
            id="proj-cryptomesh",
            name="CryptoMesh Core",
            slug="cryptomesh-core",
            description="Zero-knowledge peer identity verification & verifiable credential transport protocol.",
            repo_url="https://github.com/cryptomesh/core",
            category="Cryptography",
            stars=9800,
            trust_policy_json=json.dumps({
                "strictness": "maximum",
                "min_confidence": 0.85,
                "peer_weights": {
                    "proj-hyperflow": 0.90,
                    "proj-cloudnative": 0.80,
                    "proj-devpulse": 0.50,
                    "proj-tensorserve": 0.10
                }
            }),
            created_at=now - timedelta(days=95)
        ),
        Project(
            id="proj-devpulse",
            name="DevPulse CLI",
            slug="devpulse-cli",
            description="Next-generation developer productivity telemetry & code-health diagnostic suite.",
            repo_url="https://github.com/devpulse/cli",
            category="Developer Tools",
            stars=7600,
            trust_policy_json=json.dumps({
                "strictness": "balanced",
                "min_confidence": 0.60,
                "peer_weights": {
                    "proj-hyperflow": 0.85,
                    "proj-cloudnative": 0.80,
                    "proj-cryptomesh": 0.75,
                    "proj-tensorserve": 0.60
                }
            }),
            created_at=now - timedelta(days=70)
        ),
        Project(
            id="proj-cloudnative",
            name="CloudNative Router",
            slug="cloudnative-router",
            description="Modern ultra-low latency eBPF ingress controller & service mesh proxy.",
            repo_url="https://github.com/cloudnative/router",
            category="Cloud Native",
            stars=18400,
            trust_policy_json=json.dumps({
                "strictness": "high",
                "min_confidence": 0.75,
                "peer_weights": {
                    "proj-hyperflow": 1.0,
                    "proj-cryptomesh": 0.90,
                    "proj-devpulse": 0.70,
                    "proj-tensorserve": 0.40
                }
            }),
            created_at=now - timedelta(days=150)
        ),
        Project(
            id="proj-tensorserve",
            name="TensorServe ML",
            slug="tensor-serve",
            description="Lightweight GPU-accelerated local LLM & embedding inference server.",
            repo_url="https://github.com/tensorserve/inference",
            category="Machine Learning",
            stars=5200,
            trust_policy_json=json.dumps({
                "strictness": "permissive",
                "min_confidence": 0.50,
                "peer_weights": {
                    "proj-hyperflow": 0.90,
                    "proj-devpulse": 0.80,
                    "proj-cloudnative": 0.80,
                    "proj-cryptomesh": 0.60
                }
            }),
            created_at=now - timedelta(days=45)
        )
    ]
    db.add_all(projects)
    db.commit()

    # 2. Project Trust Edges (explicit peering weights)
    edges = [
        # Hyperflow peers
        ProjectTrustEdge(id="edge-1", source_project_id="proj-hyperflow", target_project_id="proj-cloudnative", trust_weight=1.0, notes="Core upstream dependency - full trust"),
        ProjectTrustEdge(id="edge-2", source_project_id="proj-hyperflow", target_project_id="proj-cryptomesh", trust_weight=0.85, notes="High cryptographic verification standards"),
        ProjectTrustEdge(id="edge-3", source_project_id="proj-hyperflow", target_project_id="proj-devpulse", trust_weight=0.80, notes="Trusted tooling partner"),
        # CryptoMesh peers
        ProjectTrustEdge(id="edge-4", source_project_id="proj-cryptomesh", target_project_id="proj-hyperflow", trust_weight=0.90, notes="Strict engineering reviews"),
        ProjectTrustEdge(id="edge-5", source_project_id="proj-cryptomesh", target_project_id="proj-cloudnative", trust_weight=0.80, notes="Established infrastructure project"),
        # DevPulse peers
        ProjectTrustEdge(id="edge-6", source_project_id="proj-devpulse", target_project_id="proj-hyperflow", trust_weight=0.85, notes="Peer maintainer exchange"),
        ProjectTrustEdge(id="edge-7", source_project_id="proj-devpulse", target_project_id="proj-tensorserve", trust_weight=0.60, notes="Experimental integration"),
        # CloudNative peers
        ProjectTrustEdge(id="edge-8", source_project_id="proj-cloudnative", target_project_id="proj-hyperflow", trust_weight=1.0, notes="Shared maintainer circle"),
        ProjectTrustEdge(id="edge-9", source_project_id="proj-cloudnative", target_project_id="proj-cryptomesh", trust_weight=0.90, notes="Security audited partner")
    ]
    db.add_all(edges)
    db.commit()

    # 3. Contributors
    contributors = [
        Contributor(
            id="contrib-elena",
            username="elena-rustacean",
            display_name="Elena Rostova",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            github_url="https://github.com/elena-rustacean",
            bio="Systems engineer specializing in lock-free concurrency, eBPF telemetry, and memory-safe runtimes.",
            skills_json=json.dumps(["Rust", "C++", "eBPF", "Distributed Systems"]),
            reputation_state="ESTABLISHED",
            total_contributions=48,
            first_seen_at=now - timedelta(days=180),
            created_at=now - timedelta(days=180)
        ),
        Contributor(
            id="contrib-sarah",
            username="sarah-sec",
            display_name="Dr. Sarah Lin",
            avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
            github_url="https://github.com/sarah-sec",
            bio="Security auditor & formal verification researcher. Focuses on side-channel analysis and zero-knowledge proofs.",
            skills_json=json.dumps(["Security Auditing", "ZK Proofs", "Cryptography", "Go"]),
            reputation_state="ESTABLISHED",
            total_contributions=32,
            first_seen_at=now - timedelta(days=140),
            created_at=now - timedelta(days=140)
        ),
        Contributor(
            id="contrib-marcus",
            username="marcus-dev",
            display_name="Marcus Vance",
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            github_url="https://github.com/marcus-dev",
            bio="Junior systems programmer eager to contribute to open-source infrastructure tools.",
            skills_json=json.dumps(["Python", "Rust", "Documentation"]),
            reputation_state="NEWCOMER",
            total_contributions=1,
            first_seen_at=now - timedelta(days=3),
            created_at=now - timedelta(days=3)
        ),
        Contributor(
            id="contrib-alex",
            username="alex-polyglot",
            display_name="Alex Chen",
            avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
            github_url="https://github.com/alex-polyglot",
            bio="Full-stack engineer contributing CLI improvements and SDK bindings across multiple open-source ecosystems.",
            skills_json=json.dumps(["TypeScript", "Go", "Python", "CLI Design"]),
            reputation_state="UNDER REVIEW", # Conflicting signals: vouched by DevPulse, denounced by CryptoMesh
            total_contributions=19,
            first_seen_at=now - timedelta(days=60),
            created_at=now - timedelta(days=60)
        ),
        Contributor(
            id="contrib-slop-bot",
            username="slop-bot-99",
            display_name="AutoRefactorAI",
            avatar_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
            github_url="https://github.com/slop-bot-99",
            bio="Automated code polishing agent. Optimizing docstrings and syntax globally.",
            skills_json=json.dumps(["Automated Scripting", "Markdown"]),
            reputation_state="UNDER REVIEW",
            total_contributions=112,
            first_seen_at=now - timedelta(days=5),
            created_at=now - timedelta(days=5)
        ),
        Contributor(
            id="contrib-sybil",
            username="sybil-vector-42",
            display_name="DocOptimizerPro",
            avatar_url="https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=150&auto=format&fit=crop&q=80",
            github_url="https://github.com/sybil-vector-42",
            bio="Docstring enhancement bot. Enhancing clarity across open source repos.",
            skills_json=json.dumps(["Docstrings", "Regex"]),
            reputation_state="UNDER REVIEW",
            total_contributions=89,
            first_seen_at=now - timedelta(days=4),
            created_at=now - timedelta(days=4)
        ),
        Contributor(
            id="contrib-chen",
            username="chen-ux",
            display_name="Li Chen",
            avatar_url="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
            github_url="https://github.com/chen-ux",
            bio="UI/UX developer with a passion for web accessible developer tools and dashboard visualization.",
            skills_json=json.dumps(["React", "TypeScript", "TailwindCSS", "Accessibility"]),
            reputation_state="INSUFFICIENT EVIDENCE",
            total_contributions=6,
            first_seen_at=now - timedelta(days=22),
            created_at=now - timedelta(days=22)
        )
    ]
    db.add_all(contributors)
    db.commit()

    # 4. Vouches (Positive endorsements with provenance)
    vouches = [
        Vouch(
            id="vouch-1",
            contributor_id="contrib-elena",
            source_project_id="proj-hyperflow",
            reason="Authored high-throughput zero-copy ring buffer PR that improved async throughput by 42%.",
            evidence_url="https://github.com/hyperflow-org/hyperflow/pull/412",
            context="Thorough test coverage included, passed all deterministic concurrency fuzzers.",
            confidence=1.0,
            provenance_hash=make_hash("elena-hyperflow-pr412"),
            created_at=now - timedelta(days=90)
        ),
        Vouch(
            id="vouch-2",
            contributor_id="contrib-elena",
            source_project_id="proj-cloudnative",
            reason="Contributed eBPF kernel packet filter telemetry driver with zero regressions.",
            evidence_url="https://github.com/cloudnative/router/pull/188",
            context="Reviewed and verified by senior kernel maintainers.",
            confidence=1.0,
            provenance_hash=make_hash("elena-cloudnative-pr188"),
            created_at=now - timedelta(days=65)
        ),
        Vouch(
            id="vouch-3",
            contributor_id="contrib-sarah",
            source_project_id="proj-cryptomesh",
            reason="Discovered and responsibly disclosed subtle elliptic curve nonce reuse edge-case in audit.",
            evidence_url="https://github.com/cryptomesh/core/security/advisories/GHSA-78x9-v2",
            context="Exemplary responsible disclosure and authored formal verification proof.",
            confidence=1.0,
            provenance_hash=make_hash("sarah-cryptomesh-sec"),
            created_at=now - timedelta(days=80)
        ),
        Vouch(
            id="vouch-4",
            contributor_id="contrib-sarah",
            source_project_id="proj-cloudnative",
            reason="Conducted TLS 1.3 handshake timing analysis and hardened connection state machine.",
            evidence_url="https://github.com/cloudnative/router/pull/205",
            context="High-quality cryptographic review.",
            confidence=1.0,
            provenance_hash=make_hash("sarah-cloudnative-tls"),
            created_at=now - timedelta(days=40)
        ),
        Vouch(
            id="vouch-5",
            contributor_id="contrib-alex",
            source_project_id="proj-devpulse",
            reason="Redesigned interactive terminal CLI output with graceful fallbacks for headless CI environments.",
            evidence_url="https://github.com/devpulse/cli/pull/89",
            context="Active contributor in DevPulse Discord, responsive to code review comments.",
            confidence=0.85,
            provenance_hash=make_hash("alex-devpulse-pr89"),
            created_at=now - timedelta(days=35)
        ),
        Vouch(
            id="vouch-6",
            contributor_id="contrib-chen",
            source_project_id="proj-devpulse",
            reason="Implemented keyboard accessibility navigation for telemetry dashboards.",
            evidence_url="https://github.com/devpulse/cli/pull/104",
            context="Clean PR with comprehensive Jest test suite.",
            confidence=0.90,
            provenance_hash=make_hash("chen-devpulse-pr104"),
            created_at=now - timedelta(days=14)
        )
    ]
    db.add_all(vouches)
    db.commit()

    # 5. Denouncements (Allegations with review statuses)
    denouncements = [
        Denouncement(
            id="denounce-1",
            contributor_id="contrib-slop-bot",
            reporting_project_id="proj-hyperflow",
            reason="Coordinated AI Slop: Mass spamming of trivial docstring whitespace PRs across repos.",
            evidence_url="https://github.com/hyperflow-org/hyperflow/pull/589",
            details="Account opened 8 identical pull requests within 6 minutes altering harmless comments with hallucinatory AI rephrasing.",
            status="Reviewed",
            review_notes="Confirmed automated spam. Correlated with identical submissions in DevPulse and TensorServe.",
            reviewed_by="maintainer@hyperflow.org",
            created_at=now - timedelta(days=3)
        ),
        Denouncement(
            id="denounce-2",
            contributor_id="contrib-slop-bot",
            reporting_project_id="proj-devpulse",
            reason="Templated AI PR Slop Burst: Automated typo-fix bot without actual repo testing.",
            evidence_url="https://github.com/devpulse/cli/pull/142",
            details="Identical PR text generated by script across 3 repos. Fails local linting rules.",
            status="Reviewed",
            review_notes="Matched signature hash with campaign CMP-2026-AI-SLOP-CLUSTER-A.",
            reviewed_by="admin@devpulse.io",
            created_at=now - timedelta(days=2)
        ),
        Denouncement(
            id="denounce-3",
            contributor_id="contrib-sybil",
            reporting_project_id="proj-tensorserve",
            reason="Sybil Campaign Participant: Automated PR swarm with slop-bot-99.",
            evidence_url="https://github.com/tensorserve/inference/pull/77",
            details="Submitting identical rephrased comments right after slop-bot-99 was blocked.",
            status="Under Investigation",
            review_notes="Investigating IP/SSH key similarity and commit header fingerprints.",
            reviewed_by="lead@tensorserve.ai",
            created_at=now - timedelta(days=1)
        ),
        Denouncement(
            id="denounce-4",
            contributor_id="contrib-alex",
            reporting_project_id="proj-cryptomesh",
            reason="Unverified Dependency Injection: Attempted to add external untrusted npm package in crypto core.",
            evidence_url="https://github.com/cryptomesh/core/pull/231",
            details="PR introduced an unverified 3rd-party utility package with telemetry calls. Closed by maintainer as potential supply chain risk.",
            status="Pending Review", # Illustrates Conflicting Signals!
            review_notes="Awaiting contributor response on whether this was inadvertent or intentional.",
            reviewed_by="security@cryptomesh.io",
            created_at=now - timedelta(days=8)
        )
    ]
    db.add_all(denouncements)
    db.commit()

    # 6. Coordinated Campaigns
    campaigns = [
        CoordinatedCampaign(
            id="cmp-slop-cluster-a",
            campaign_code="CMP-2026-AI-SLOP-CLUSTER-A",
            name="Automated Docstring & Typo-Fix AI Slop Wave",
            pattern_type="Templated AI PR Burst",
            description=(
                "A cluster of automated accounts generating superficial markdown edits, "
                "rephrased docstrings, and trivial typo fixes across multiple independent repositories. "
                "The pull requests share identical template phrasing ('refactor: enhance documentation clarity') "
                "and occur in synchronized burst windows without running local test suites."
            ),
            signal_strength=0.88,
            affected_projects_json=json.dumps(["proj-hyperflow", "proj-devpulse", "proj-tensorserve"]),
            contributor_ids_json=json.dumps(["contrib-slop-bot", "contrib-sybil"]),
            evidence_records_json=json.dumps([
                {
                    "repo": "hyperflow-org/hyperflow",
                    "pr_url": "https://github.com/hyperflow-org/hyperflow/pull/589",
                    "pattern": "Identical commit message 'docs: optimize docstring phrasing'",
                    "diff_sample": "- // Lock-free ring buffer for async events\n+ // Optimized concurrency ring buffer for event telemetry"
                },
                {
                    "repo": "devpulse/cli",
                    "pr_url": "https://github.com/devpulse/cli/pull/142",
                    "pattern": "Identical timestamp burst: 4 commits in 180 seconds",
                    "diff_sample": "- # Run diagnostic checks\n+ # Execute diagnostics on telemetry data"
                },
                {
                    "repo": "tensorserve/inference",
                    "pr_url": "https://github.com/tensorserve/inference/pull/77",
                    "pattern": "Matching author email domain pattern (@temp-agent-mail.xyz)",
                    "diff_sample": "- // Initialize CUDA context\n+ // Setup GPU memory pipeline buffer"
                }
            ]),
            status="Confirmed Coordinated Abuse",
            detected_at=now - timedelta(days=3)
        ),
        CoordinatedCampaign(
            id="cmp-sybil-swarm-b",
            campaign_code="CMP-2026-SYBIL-SWARM-B",
            name="Fast-Follow Sybil Account Swarm",
            pattern_type="Sybil Cluster Correlation",
            description=(
                "Coordinated secondary accounts spinning up immediately following repository blocks "
                "on primary automated spam accounts. Accounts share identical SSH public key fingerprints "
                "and git commit email domain patterns."
            ),
            signal_strength=0.74,
            affected_projects_json=json.dumps(["proj-tensorserve", "proj-hyperflow"]),
            contributor_ids_json=json.dumps(["contrib-sybil"]),
            evidence_records_json=json.dumps([
                {
                    "repo": "tensorserve/inference",
                    "pr_url": "https://github.com/tensorserve/inference/pull/81",
                    "pattern": "Git committer time zone anomaly and rapid-fire fork creation",
                    "diff_sample": "docs/readme.md whitespace modification batch"
                }
            ]),
            status="Active Investigation",
            detected_at=now - timedelta(days=1)
        )
    ]
    db.add_all(campaigns)
    db.commit()
