import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models import ActivityLog, User, Contributor, utc_now
from app.services.email_service import EmailService

# Strict list of sensitive keys that MUST NEVER be recorded or emailed
SENSITIVE_KEYS = {
    "password", "hashed_password", "token", "access_token", "refresh_token",
    "secret", "client_secret", "jwt", "authorization", "api_key", "cookie",
    "session", "private_key", "credentials"
}

def sanitize_metadata(meta: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Recursively strip any sensitive authentication secrets, keys, or passwords."""
    if not meta:
        return {}
    sanitized = {}
    for k, v in meta.items():
        if k.lower() in SENSITIVE_KEYS:
            continue
        if isinstance(v, dict):
            sanitized[k] = sanitize_metadata(v)
        elif isinstance(v, list):
            sanitized[k] = [
                sanitize_metadata(item) if isinstance(item, dict) else item
                for item in v
            ]
        else:
            sanitized[k] = v
    return sanitized

class ActivityLogger:
    @classmethod
    def log(
        cls,
        db: Session,
        event_type: str,
        event_description: str,
        user: Optional[User] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_name: Optional[str] = None,
        github_username: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        project_name: Optional[str] = None,
        status: str = "SUCCESS",
        metadata: Optional[Dict[str, Any]] = None,
        send_email: bool = True
    ) -> ActivityLog:
        """
        Centrally creates a verified server-side activity log entry.
        Cleanses sensitive metadata, prevents duplicates, and dispatches email notification.
        """
        # Smart user resolution:
        # 1. If explicit User object provided, use its fields
        # 2. If not provided, query the database by user_id, user_email, or github_username
        resolved_user = user
        if not resolved_user:
            if user_id:
                resolved_user = db.query(User).filter(User.id == user_id).first()
            elif user_email and user_email.strip():
                clean_email = user_email.strip().lower()
                resolved_user = db.query(User).filter(User.email == clean_email).first()
            elif github_username and github_username.strip():
                clean_gh = github_username.strip().lstrip("@")
                resolved_user = db.query(User).filter(User.github_username == clean_gh).first()

        if resolved_user:
            user_id = user_id or resolved_user.id
            user_email = resolved_user.email or user_email or ""
            user_name = resolved_user.name or user_name or ""
            github_username = resolved_user.github_username or github_username or ""

        # Contributor display_name fallback if name is still empty but github_username is provided
        if not user_name and github_username:
            clean_gh = github_username.strip().lstrip("@")
            contrib = db.query(Contributor).filter(Contributor.username == clean_gh).first()
            if contrib and contrib.display_name and contrib.display_name != contrib.username:
                user_name = contrib.display_name

        # Cleanse any raw "N/A" strings so that "N/A" never pollutes database records or notifications
        if user_name in {"N/A", "n/a", "None"}:
            user_name = ""
        if user_email in {"N/A", "n/a", "None"}:
            user_email = ""
        if github_username in {"N/A", "n/a", "None"}:
            github_username = ""

        # Sanitize metadata
        clean_meta = sanitize_metadata(metadata)

        # Check for immediate duplicates (within 5 seconds)
        if EmailService.is_duplicate_event(db, event_type, resource_id, user_id):
            send_email = False

        activity_id = f"act-{uuid.uuid4().hex[:12]}"
        now = utc_now()

        activity = ActivityLog(
            id=activity_id,
            user_id=user_id,
            user_email=user_email or "",
            user_name=user_name or "",
            github_username=github_username or "",
            event_type=event_type,
            event_description=event_description,
            resource_type=resource_type or "",
            resource_id=resource_id or "",
            project_name=project_name or "",
            timestamp=now,
            status=status,
            metadata_json=json.dumps(clean_meta)
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)

        # Trigger email notification if enabled
        if send_email:
            try:
                EmailService.send_notification(db, activity)
            except Exception as e:
                # Must never let email failure interrupt the main operation
                print(f"[ActivityLogger] Failed to dispatch notification: {e}")

        return activity
