import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import (
    Project, Contributor, Vouch, Denouncement, CoordinatedCampaign,
    ProjectTrustEdge, User, ActivityLog, EmailNotification,
    GitHubCredential, GitHubPullRequest
)

def make_hash(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()[:16]

def _bootstrap_from_authoritative_seed(db: Session) -> bool:
    seed_path = Path(__file__).resolve().parent.parent / "database" / "authoritative_seed.json"
    if not seed_path.is_file():
        return False
    try:
        with open(seed_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        ordered_models = [
            User,
            Project,
            Contributor,
            GitHubCredential,
            ProjectTrustEdge,
            Vouch,
            Denouncement,
            CoordinatedCampaign,
            GitHubPullRequest,
            ActivityLog,
            EmailNotification,
        ]

        total_imported = 0
        for model in ordered_models:
            mname = model.__name__
            records = data.get(mname, [])
            cols = {c.name: c for c in model.__table__.columns}
            for rec in records:
                inst_kwargs = {}
                for col_name, col in cols.items():
                    val = rec.get(col_name)
                    if val is not None and str(col.type).startswith("DATETIME"):
                        try:
                            val = datetime.fromisoformat(val)
                        except Exception:
                            pass
                    inst_kwargs[col_name] = val
                db.merge(model(**inst_kwargs))
                total_imported += 1
        db.commit()
        print(f"[TrustMesh Bootstrap] Successfully bootstrapped {total_imported} canonical records from authoritative_seed.json")
        return True
    except Exception as exc:
        db.rollback()
        print(f"[TrustMesh Bootstrap Warning] Failed loading authoritative_seed.json: {exc}")
        return False

def seed_database(db: Session, reset: bool = False):
    now = datetime.now(timezone.utc)

    if reset:
        db.query(EmailNotification).delete()
        db.query(ActivityLog).delete()
        db.query(GitHubPullRequest).delete()
        db.query(User).delete()
        db.query(Vouch).delete()
        db.query(Denouncement).delete()
        db.query(ProjectTrustEdge).delete()
        db.query(CoordinatedCampaign).delete()
        db.query(Contributor).delete()
        db.query(Project).delete()
        db.commit()

    if db.query(Project).count() > 0:
        return

    # Attempt to bootstrap full canonical database from authoritative_seed.json if present
    if _bootstrap_from_authoritative_seed(db):
        return

    # 0. Ensure Admin User exists
    admin_email = (settings.current_admin_email or "admin@trustmesh.network").strip().lower()
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if not admin_user:
        from app.services.auth_service import hash_password
        admin_user = User(
            id="usr-admin-primary",
            email=admin_email,
            hashed_password=hash_password("TrustMesh2026!"),
            name="TrustMesh Administrator",
            github_username="admin",
            is_verified=True,
            is_admin=True,
            failed_login_attempts=0,
            created_at=now - timedelta(days=60),
            last_login_at=now - timedelta(minutes=10)
        )
        db.add(admin_user)
        db.commit()

    return
