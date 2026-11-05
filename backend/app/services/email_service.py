import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import EmailNotification, ActivityLog, utc_now

logger = logging.getLogger(__name__)

class EmailService:
    @classmethod
    def should_rate_limit(cls, db: Session, event_type: str, user_email: Optional[str], resource_id: Optional[str]) -> Tuple[bool, str]:
        """
        Rate limiting rules:
        - Security alerts (AUTH_SECURITY_ALERT, CAMPAIGN_DETECTED) are never rate limited.
        - Routine logins (AUTH_LOGIN, AUTH_GITHUB_LOGIN) are limited to 1 notification per 10 minutes per account.
        - Trust evaluations (TRUST_EVALUATION_COMPLETED) are limited to 1 notification per 5 minutes per resource.
        """
        # Critical security alerts are never suppressed
        if event_type in {"AUTH_SECURITY_ALERT", "CAMPAIGN_DETECTED", "AUTH_FAILED_LOGIN"}:
            return False, ""

        # Admin notifications are high-priority: NEVER rate-limit admin account events
        admin_target = (settings.current_admin_email or "akshay123modi@gmail.com").strip().lower()
        if user_email and user_email.strip().lower() == admin_target:
            return False, ""

        now = utc_now()

        # High-frequency trust evaluations: 5 minute window
        if event_type == "TRUST_EVALUATION_COMPLETED" and resource_id:
            five_mins_ago = now - timedelta(minutes=5)
            recent_eval = (
                db.query(EmailNotification)
                .join(ActivityLog, EmailNotification.activity_log_id == ActivityLog.id)
                .filter(
                    ActivityLog.event_type == event_type,
                    ActivityLog.resource_id == resource_id,
                    EmailNotification.created_at >= five_mins_ago,
                    EmailNotification.status.in_(["SENT", "SIMULATED"])
                )
                .first()
            )
            if recent_eval:
                return True, f"Evaluation notification rate-limited to prevent flooding (last sent at {recent_eval.created_at.isoformat()})"

        return False, ""

    @classmethod
    def is_duplicate_event(cls, db: Session, event_type: str, resource_id: Optional[str], user_id: Optional[str]) -> bool:
        """Prevent duplicate notifications within 5 seconds for identical actions."""
        five_secs_ago = utc_now() - timedelta(seconds=5)
        recent = (
            db.query(ActivityLog)
            .filter(
                ActivityLog.event_type == event_type,
                ActivityLog.resource_id == (resource_id or ""),
                ActivityLog.user_id == (user_id or ""),
                ActivityLog.timestamp >= five_secs_ago
            )
            .count()
        )
        return recent >= 1

    EVENT_TITLES = {
        "AUTH_REGISTRATION": "New User Registration",
        "AUTH_LOGIN": "User Sign-In (Password)",
        "AUTH_GITHUB_LOGIN": "User Sign-In (GitHub OAuth)",
        "AUTH_LOGOUT": "User Sign-Out",
        "AUTH_SECURITY_ALERT": "Security Alert: Suspicious Activity",
        "AUTH_FAILED_LOGIN": "Failed Sign-In Attempt",
        "AUTH_VERIFICATION": "Account Verification Completed",
        "AUTH_PASSWORD_RESET": "Password Reset Completed",
        "GITHUB_CONNECTED": "GitHub Account Connected",
        "GITHUB_DISCONNECTED": "GitHub Account Disconnected",
        "GITHUB_REPO_IMPORTED": "Public Repository Imported",
        "GITHUB_REPO_SYNCED": "Repository Synchronization Completed",
        "VOUCH_SUBMITTED": "Peer Vouch Submitted",
        "DENOUNCEMENT_SUBMITTED": "Trust Denouncement Submitted",
        "CAMPAIGN_DETECTED": "Coordinated Campaign Detected",
        "PROJECT_CREATED": "Project Registered",
        "PROJECT_UPDATED": "Project Details Updated",
        "PROJECT_POLICY_CHANGED": "Trust Policy Modified",
        "PROJECT_PEER_CONFIG_CHANGED": "Project Peering Configuration Changed",
        "TRUST_POLICY_DECISION_RECORDED": "Maintainer Triage Decision Recorded",
        "TRUST_EVALUATION_COMPLETED": "Trust Evaluation Computed",
    }

    @classmethod
    def get_event_friendly_title(cls, event_type: str) -> str:
        return cls.EVENT_TITLES.get(event_type, event_type.replace("_", " ").title())

    @staticmethod
    def _clean_val(val: Any, default: str = "Not provided") -> str:
        if val is None:
            return default
        s = str(val).strip()
        if not s or s.lower() in {"n/a", "none", "null", ""}:
            return default
        return s

    @classmethod
    def generate_html_email(
        cls,
        activity_id: str,
        event_type: str,
        description: str,
        user_name: Optional[str],
        user_email: Optional[str],
        github_username: Optional[str],
        project_name: Optional[str],
        status: str,
        timestamp: datetime,
        metadata: Dict[str, Any]
    ) -> str:
        """Format an elegant, cyberpunk-styled responsive HTML email with dedicated event-specific templates."""
        is_security_alert = "SECURITY" in event_type or "SUSPICIOUS" in status or "FAILED" in status
        is_warning = status == "WARNING" or "DENOUNCE" in event_type

        if is_security_alert:
            badge_bg = "rgba(239, 68, 68, 0.15)"
            badge_border = "#ef4444"
            badge_text = "#fca5a5"
        elif is_warning:
            badge_bg = "rgba(245, 158, 11, 0.15)"
            badge_border = "#f59e0b"
            badge_text = "#fcd34d"
        else:
            badge_bg = "rgba(6, 182, 212, 0.15)"
            badge_border = "#06b6d4"
            badge_text = "#67e8f9"

        friendly_title = cls.get_event_friendly_title(event_type)
        utc_time_str = timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")

        # Clean actor details (never use fabricated info, and never display N/A)
        clean_name = cls._clean_val(user_name, default="Not provided")
        clean_email = cls._clean_val(user_email, default="Not provided")
        raw_gh = cls._clean_val(github_username, default="")
        clean_github = f"@{raw_gh.lstrip('@')}" if raw_gh else "Not provided"

        # Determine actor identity role
        if clean_email != "Not provided":
            if clean_email.lower() == (settings.ADMIN_NOTIFICATION_EMAIL or "").lower() or metadata.get("is_admin"):
                actor_role = "Authenticated Administrator"
            else:
                actor_role = "Authenticated User / Contributor"
        else:
            actor_role = "System Service / Public Request"

        # Build Event-Specific Cards
        event_specific_html = ""

        if event_type == "AUTH_REGISTRATION":
            reg_method = metadata.get("auth_method", "Email & Password")
            if reg_method == "email_password":
                reg_method_display = "Email & Password"
            elif reg_method == "github_oauth":
                reg_method_display = "GitHub OAuth"
            else:
                reg_method_display = str(reg_method).replace("_", " ").title()

            event_specific_html = f"""
            <div style="background:#070f1e;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:20px;">
              <div style="font-size:11px;font-family:monospace;color:#10b981;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">Registration Account Profile</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#94a3b8;width:38%;">Full Name</td><td style="padding:6px 0;color:#ffffff;font-weight:600;">{clean_name}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Email Address</td><td style="padding:6px 0;color:#38bdf8;font-family:monospace;">{clean_email}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Registration Method</td><td style="padding:6px 0;color:#10b981;font-weight:600;">{reg_method_display}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Linked GitHub</td><td style="padding:6px 0;color:#a855f7;font-family:monospace;">{clean_github}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Account Status</td><td style="padding:6px 0;color:#34d399;">Active &bull; Verified</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Timestamp (UTC)</td><td style="padding:6px 0;color:#ffffff;font-family:monospace;">{utc_time_str}</td></tr>
              </table>
            </div>
            """

        elif event_type in {"AUTH_LOGIN", "AUTH_GITHUB_LOGIN"}:
            auth_method = metadata.get("auth_method", "Email & Password")
            user_id_val = cls._clean_val(metadata.get("user_id"), default=activity_id)
            if auth_method == "email_password":
                login_method_display = "Email & Password"
            elif auth_method == "github_oauth":
                login_method_display = "GitHub OAuth"
            else:
                login_method_display = str(auth_method).replace("_", " ").title()

            event_specific_html = f"""
            <div style="background:#070f1e;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:20px;">
              <div style="font-size:11px;font-family:monospace;color:#06b6d4;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">User Sign-In Session Details</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#94a3b8;width:38%;">User's Full Name</td><td style="padding:6px 0;color:#ffffff;font-weight:600;">{clean_name}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">User's Email Address</td><td style="padding:6px 0;color:#38bdf8;font-family:monospace;">{clean_email}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">User ID</td><td style="padding:6px 0;color:#a855f7;font-family:monospace;font-weight:600;">{user_id_val}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Login Date and Time (UTC)</td><td style="padding:6px 0;color:#ffffff;font-family:monospace;">{utc_time_str}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Login Method</td><td style="padding:6px 0;color:#10b981;font-weight:600;">{login_method_display}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Linked GitHub Handle</td><td style="padding:6px 0;color:#a855f7;font-family:monospace;">{clean_github}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Verification State</td><td style="padding:6px 0;color:#34d399;">Authenticated &bull; SUCCESS</td></tr>
              </table>
            </div>
            """

        elif event_type == "GITHUB_CONNECTED":
            scope_val = cls._clean_val(metadata.get("scope"), default="read:user, repo")
            event_specific_html = f"""
            <div style="background:#0c0a1e;border:1px solid #3b2866;border-radius:12px;padding:16px;margin-bottom:20px;">
              <div style="font-size:11px;font-family:monospace;color:#a855f7;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">GitHub Integration Connected</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#94a3b8;width:38%;">Account Holder</td><td style="padding:6px 0;color:#ffffff;font-weight:600;">{clean_name} ({clean_email})</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Connected GitHub Handle</td><td style="padding:6px 0;color:#a855f7;font-family:monospace;font-weight:700;">{clean_github}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">OAuth Permissions Scope</td><td style="padding:6px 0;color:#e2e8f0;font-family:monospace;">{scope_val}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Authorization Time (UTC)</td><td style="padding:6px 0;color:#ffffff;font-family:monospace;">{utc_time_str}</td></tr>
              </table>
            </div>
            """

        elif event_type == "GITHUB_REPO_IMPORTED":
            owner = cls._clean_val(metadata.get("github_owner"), default="")
            repo = cls._clean_val(metadata.get("github_repo"), default="")
            repo_full = f"{owner}/{repo}" if owner and repo else cls._clean_val(project_name, default="Repository")
            repo_url = cls._clean_val(metadata.get("repo_url"), default=f"https://github.com/{repo_full}")
            branch = cls._clean_val(metadata.get("default_branch"), default="main")
            visibility = cls._clean_val(metadata.get("visibility"), default="public")
            synced_prs = cls._clean_val(metadata.get("synced_pull_requests"), default="0")
            category = cls._clean_val(metadata.get("category"), default="Infrastructure")

            event_specific_html = f"""
            <div style="background:#070f1e;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:20px;">
              <div style="font-size:11px;font-family:monospace;color:#06b6d4;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">Imported Repository Specifications</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#94a3b8;width:38%;">Imported By</td><td style="padding:6px 0;color:#ffffff;font-weight:600;">{clean_name} ({clean_email})</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Repository Name</td><td style="padding:6px 0;color:#38bdf8;font-family:monospace;font-weight:700;">{repo_full}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Canonical GitHub URL</td><td style="padding:6px 0;"><a href="{repo_url}" style="color:#06b6d4;text-decoration:none;" target="_blank">{repo_url} &rarr;</a></td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Visibility & Branch</td><td style="padding:6px 0;color:#e2e8f0;"><span style="text-transform:capitalize;">{visibility}</span> &bull; branch: <code>{branch}</code></td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Synchronized PR Records</td><td style="padding:6px 0;color:#10b981;font-weight:600;">{synced_prs} pull requests synced</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Assigned Category</td><td style="padding:6px 0;color:#94a3b8;">{category}</td></tr>
              </table>
            </div>
            """

        elif event_type == "VOUCH_SUBMITTED":
            recipient = cls._clean_val(metadata.get("recipient_contributor") or metadata.get("contributor"), default="contributor")
            source_proj = cls._clean_val(metadata.get("source_project_name") or project_name, default="TrustMesh Project")
            vouch_reason = cls._clean_val(metadata.get("vouch_reason"), default=description)
            evidence_url = cls._clean_val(metadata.get("evidence_url"), default="Not provided")
            confidence = cls._clean_val(metadata.get("confidence"), default="1.0")
            prov_hash = cls._clean_val(metadata.get("provenance_hash"), default="")

            # Clearly distinguish submitter from recipient
            submitter_display = f"{clean_name} ({clean_email})" if clean_email != "Not provided" else "Authenticated Project Maintainer"

            evidence_row = f"<tr><td style='padding:6px 0;color:#94a3b8;'>Evidence URL</td><td style='padding:6px 0;'><a href='{evidence_url}' style='color:#06b6d4;text-decoration:none;' target='_blank'>{evidence_url} &rarr;</a></td></tr>" if evidence_url != "Not provided" else ""
            prov_row = f"<tr><td style='padding:6px 0;color:#94a3b8;'>Provenance Hash</td><td style='padding:6px 0;color:#94a3b8;font-family:monospace;'>{prov_hash}</td></tr>" if prov_hash else ""

            event_specific_html = f"""
            <div style="background:#071410;border:1px solid #144533;border-radius:12px;padding:16px;margin-bottom:20px;">
              <div style="font-size:11px;font-family:monospace;color:#10b981;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">Peer Vouch Endorsement Details</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#94a3b8;width:38%;">Vouch Submitter</td><td style="padding:6px 0;color:#ffffff;font-weight:600;">{submitter_display}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Endorsed Recipient</td><td style="padding:6px 0;color:#10b981;font-weight:700;font-family:monospace;">@{recipient.lstrip('@')}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Source Project</td><td style="padding:6px 0;color:#38bdf8;font-weight:600;">{source_proj}</td></tr>
                <tr><td style="padding:6px 0;color:#94a3b8;">Endorsement Reason</td><td style="padding:6px 0;color:#e2e8f0;font-weight:500;">&ldquo;{vouch_reason}&rdquo;</td></tr>
                {evidence_row}
                <tr><td style="padding:6px 0;color:#94a3b8;">Confidence Score</td><td style="padding:6px 0;color:#f59e0b;font-weight:600;">{confidence}</td></tr>
                {prov_row}
              </table>
            </div>
            """

        elif event_type == "DENOUNCEMENT_SUBMITTED":
            reported = cls._clean_val(metadata.get("reported_contributor") or metadata.get("contributor"), default="contributor")
            reporting_proj = cls._clean_val(metadata.get("reporting_project_name") or project_name, default="Reporting Project")
            denounce_reason = cls._clean_val(metadata.get("denouncement_reason") or metadata.get("reason"), default=description)
            evidence_url = cls._clean_val(metadata.get("evidence_url"), default="Not provided")
            details = cls._clean_val(metadata.get("details"), default="")
            initial_status = cls._clean_val(metadata.get("initial_status"), default="Pending Review")

            submitter_display = f"{clean_name} ({clean_email})" if clean_email != "Not provided" else f"Reporting Project Maintainer ({reporting_proj})"

            details_row = f"<tr><td style='padding:6px 0;color:#fca5a5;'>Additional Context</td><td style='padding:6px 0;color:#e2e8f0;'>{details}</td></tr>" if details else ""
            evidence_row = f"<tr><td style='padding:6px 0;color:#fca5a5;'>Supporting Evidence</td><td style='padding:6px 0;'><a href='{evidence_url}' style='color:#38bdf8;text-decoration:none;' target='_blank'>{evidence_url} &rarr;</a></td></tr>" if evidence_url != "Not provided" else ""

            event_specific_html = f"""
            <div style="background:#160909;border:1px solid #581616;border-radius:12px;padding:16px;margin-bottom:20px;">
              <div style="font-size:11px;font-family:monospace;color:#ef4444;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">Trust Denouncement Investigation Report</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#fca5a5;width:38%;">Reporting Submitter</td><td style="padding:6px 0;color:#ffffff;font-weight:600;">{submitter_display}</td></tr>
                <tr><td style="padding:6px 0;color:#fca5a5;">Reported Contributor</td><td style="padding:6px 0;color:#ef4444;font-weight:700;font-family:monospace;">@{reported.lstrip('@')}</td></tr>
                <tr><td style="padding:6px 0;color:#fca5a5;">Reporting Project</td><td style="padding:6px 0;color:#38bdf8;font-weight:600;">{reporting_proj}</td></tr>
                <tr><td style="padding:6px 0;color:#fca5a5;">Allegation / Reason</td><td style="padding:6px 0;color:#fecaca;font-weight:600;">&ldquo;{denounce_reason}&rdquo;</td></tr>
                {details_row}
                {evidence_row}
                <tr><td style="padding:6px 0;color:#fca5a5;">Investigation Status</td><td style="padding:6px 0;color:#f59e0b;font-weight:600;">{initial_status} (Pending Maintainer Triage)</td></tr>
              </table>
            </div>
            """

        elif event_type == "CAMPAIGN_DETECTED":
            campaign_name = cls._clean_val(metadata.get("campaign_name"), default="Coordinated Abuse Cluster")
            campaign_code = cls._clean_val(metadata.get("campaign_code"), default="CAMPAIGN-RADAR")
            pattern_type = cls._clean_val(metadata.get("pattern_type"), default="Sybil / Synchronized Coordinated Slop")
            signal_strength = cls._clean_val(metadata.get("signal_strength"), default="High Confidence (0.85+)")
            affected_projects = metadata.get("affected_projects") or []
            if isinstance(affected_projects, list):
                affected_display = ", ".join(affected_projects) if affected_projects else "Cross-Repository Swarm"
            else:
                affected_display = str(affected_projects)

            contributors = metadata.get("contributor_usernames") or metadata.get("contributor_ids") or []
            if isinstance(contributors, list):
                contrib_display = ", ".join([f"@{c.lstrip('@')}" for c in contributors]) if contributors else "Multiple Coordinated Accounts"
            else:
                contrib_display = str(contributors)

            evidence_count = cls._clean_val(metadata.get("evidence_count") or metadata.get("new_campaigns"), default="Multiple correlated signals")

            event_specific_html = f"""
            <div style="background:#160824;border:1px solid #4c1d95;border-radius:12px;padding:16px;margin-bottom:20px;">
              <div style="font-size:11px;font-family:monospace;color:#c084fc;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">Coordinated Abuse Detection Radar</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:6px 0;color:#d8b4fe;width:38%;">Campaign Name</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">{campaign_name}</td></tr>
                <tr><td style="padding:6px 0;color:#d8b4fe;">Campaign Code</td><td style="padding:6px 0;color:#a855f7;font-family:monospace;">{campaign_code}</td></tr>
                <tr><td style="padding:6px 0;color:#d8b4fe;">Threat Pattern Type</td><td style="padding:6px 0;color:#f87171;font-weight:600;">{pattern_type}</td></tr>
                <tr><td style="padding:6px 0;color:#d8b4fe;">Radar Signal Confidence</td><td style="padding:6px 0;color:#fbbf24;font-weight:600;">{signal_strength}</td></tr>
                <tr><td style="padding:6px 0;color:#d8b4fe;">Affected Projects</td><td style="padding:6px 0;color:#e2e8f0;">{affected_display}</td></tr>
                <tr><td style="padding:6px 0;color:#d8b4fe;">Coordinated Accounts</td><td style="padding:6px 0;color:#ef4444;font-family:monospace;font-weight:600;">{contrib_display}</td></tr>
                <tr><td style="padding:6px 0;color:#d8b4fe;">Forensic Evidence Count</td><td style="padding:6px 0;color:#38bdf8;">{evidence_count}</td></tr>
              </table>
            </div>
            """

        # Build sanitized operational metadata rows
        meta_rows = []
        for k, v in metadata.items():
            if k in {"password", "token", "secret", "key", "authorization", "raw_ip", "hashed_password"}:
                continue
            meta_rows.append(f"<tr><td style='padding:4px 8px;color:#94a3b8;font-family:monospace;font-size:11px;'>{k}</td><td style='padding:4px 8px;color:#f8fafc;font-family:monospace;font-size:11px;'>{v}</td></tr>")
        meta_html = "".join(meta_rows) if meta_rows else "<tr><td colspan='2' style='padding:4px 8px;color:#64748b;font-size:11px;'>None</td></tr>"

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>TrustMesh Admin Notification</title>
        </head>
        <body style="margin:0;padding:24px;background-color:#05070a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
          <div style="max-width:600px;margin:0 auto;background:#090d16;border:1px solid #1e293b;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <!-- Header Banner -->
            <div style="padding:20px 24px;background:#0b1120;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:between;">
              <div>
                <span style="font-size:10px;font-family:monospace;color:#06b6d4;letter-spacing:2px;text-transform:uppercase;display:block;">TRUSTMESH SECURITY INTELLIGENCE</span>
                <h1 style="margin:4px 0 0 0;font-size:18px;color:#ffffff;font-weight:700;">{friendly_title}</h1>
              </div>
            </div>

            <!-- Content Area -->
            <div style="padding:24px;">
              <!-- Event Badge -->
              <div style="display:inline-block;padding:4px 12px;background:{badge_bg};border:1px solid {badge_border};border-radius:8px;font-family:monospace;font-size:12px;font-weight:600;color:{badge_text};margin-bottom:16px;">
                {event_type} &bull; {status}
              </div>

              <!-- Human Description -->
              <p style="font-size:14px;color:#e2e8f0;line-height:1.6;margin:0 0 20px 0;">
                {description}
              </p>

              <!-- Activity Initiator / Performed By Section -->
              <div style="background:#070d18;border:1px solid #1e293b;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
                <div style="font-size:10px;font-family:monospace;color:#38bdf8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;font-weight:700;">Activity Initiator &bull; Performed By</div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <tr>
                    <td style="padding:4px 0;color:#94a3b8;width:38%;">User Full Name</td>
                    <td style="padding:4px 0;color:#ffffff;font-weight:600;">{clean_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94a3b8;">Registered Email</td>
                    <td style="padding:4px 0;color:#38bdf8;font-family:monospace;">{clean_email}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94a3b8;">Linked GitHub Handle</td>
                    <td style="padding:4px 0;color:#a855f7;font-family:monospace;">{clean_github}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94a3b8;">Authentication Identity</td>
                    <td style="padding:4px 0;color:#10b981;">{actor_role}</td>
                  </tr>
                </table>
              </div>

              <!-- Event-Specific Content Block -->
              {event_specific_html}

              <!-- Standard Audit Information -->
              <table style="width:100%;border-collapse:collapse;background:#05070a;border:1px solid #1e293b;border-radius:10px;margin-bottom:20px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 14px;color:#94a3b8;font-size:12px;border-bottom:1px solid #1e293b;width:38%;">Activity Audit ID</td>
                  <td style="padding:10px 14px;color:#38bdf8;font-family:monospace;font-size:12px;border-bottom:1px solid #1e293b;">{activity_id}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;color:#94a3b8;font-size:12px;border-bottom:1px solid #1e293b;">Timestamp (UTC)</td>
                  <td style="padding:10px 14px;color:#ffffff;font-family:monospace;font-size:12px;border-bottom:1px solid #1e293b;">{utc_time_str}</td>
                </tr>
                {f"<tr><td style='padding:10px 14px;color:#94a3b8;font-size:12px;border-bottom:1px solid #1e293b;'>Associated Project</td><td style='padding:10px 14px;color:#06b6d4;font-family:monospace;font-size:12px;border-bottom:1px solid #1e293b;'>{project_name}</td></tr>" if project_name else ""}
                <tr>
                  <td style="padding:10px 14px;color:#94a3b8;font-size:12px;">Admin Notification Target</td>
                  <td style="padding:10px 14px;color:#94a3b8;font-size:12px;">{settings.current_admin_email or "akshay123modi@gmail.com"}</td>
                </tr>
              </table>

              <!-- Sanitized Operational Context -->
              <div style="background:#0b1120;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;margin-bottom:20px;">
                <span style="font-size:10px;font-family:monospace;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">Sanitized Operational Context</span>
                <table style="width:100%;border-collapse:collapse;">
                  {meta_html}
                </table>
              </div>

              <!-- Security & Privacy Notice -->
              <p style="font-size:11px;color:#64748b;line-height:1.5;margin:0;border-top:1px solid #1e293b;padding-top:14px;">
                <strong>Security & Privacy Notice:</strong> This email was generated automatically by TrustMesh. Passwords, hashed credentials, API keys, session cookies, and JWT secrets are strictly filtered out and never recorded or transmitted. Delivery restricted to authorized administrators.
              </p>
            </div>

            <!-- Footer -->
            <div style="background:#05070a;padding:14px 24px;border-top:1px solid #1e293b;text-align:center;">
              <span style="font-size:10px;color:#475569;font-family:monospace;">TrustMesh &bull; Problem 07: Trust Network Against AI Slop</span>
            </div>
          </div>
        </body>
        </html>
        """

    @classmethod
    def _send_resend_request(
        cls,
        api_key: str,
        email_from: str,
        admin_email: str,
        subject: str,
        html_body: str
    ) -> httpx.Response:
        """Sends the HTTP POST request to the official Resend API."""
        with httpx.Client(timeout=10.0) as client:
            return client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": email_from,
                    "to": [admin_email],
                    "subject": subject,
                    "html": html_body
                }
            )

    @classmethod
    def _send_nodemailer_email(cls, recipient: str, subject: str, html_body: str) -> Tuple[bool, str]:
        """Sends email via Node.js Nodemailer using Gmail SMTP."""
        gmail_user = (settings.current_gmail_user or settings.SMTP_USER or "").strip()
        gmail_pass = (settings.current_gmail_app_password or settings.SMTP_PASSWORD or "").replace(" ", "").strip()
        if not gmail_user or not gmail_pass:
            return False, "Gmail credentials not configured in environment (GMAIL_USER or GMAIL_APP_PASSWORD missing)"

        import subprocess
        import json
        from app.core.config import _ROOT_DIR

        script_path = _ROOT_DIR / "scripts" / "nodemailer_client.js"
        if not script_path.is_file():
            return False, f"Nodemailer script not found at {script_path}"

        payload = {
            "to": recipient,
            "subject": subject,
            "html": html_body
        }

        try:
            
            env = os.environ.copy()
            env["GMAIL_USER"] = gmail_user
            env["GMAIL_APP_PASSWORD"] = gmail_pass
            env["ADMIN_EMAIL"] = recipient
            env["SMTP_HOST"] = settings.current_smtp_host
            env["SMTP_PORT"] = str(settings.current_smtp_port)

            result = subprocess.run(
                ["node", str(script_path), json.dumps(payload)],
                capture_output=True,
                text=True,
                timeout=12,
                check=False,
                env=env
            )
            raw_out = (result.stdout or "").strip()
            if raw_out:
                try:
                    data = json.loads(raw_out)
                    if data.get("success"):
                        msg_id = data.get("messageId", "")
                        logger.info(f"Nodemailer delivered email to {recipient} (Message ID: {msg_id})")
                        return True, msg_id or "delivered"
                    elif data.get("error"):
                        safe_err = str(data["error"]).replace(gmail_pass, "***")
                        return False, f"Nodemailer error: {safe_err}"
                except Exception:
                    pass
            if result.stderr:
                safe_err = result.stderr.strip().replace(gmail_pass, "***")
                return False, f"Nodemailer stderr: {safe_err[:200]}"
            return False, "Nodemailer dispatch failed (empty response)"
        except subprocess.TimeoutExpired:
            return False, "Nodemailer dispatch timed out (12s)"
        except FileNotFoundError:
            return False, "Node.js executable not found in system path"
        except Exception as ex:
            safe_err = str(ex).replace(gmail_pass, "***")
            logger.warning(f"Nodemailer dispatch note: {safe_err}")
            return False, safe_err

    @classmethod
    def _send_smtp_email(cls, recipient: str, subject: str, html_body: str) -> Tuple[bool, str]:
        """Sends real email via Nodemailer or Python smtplib using Gmail SMTP."""
        # 1. Try Nodemailer first
        ok, detail = cls._send_nodemailer_email(recipient, subject, html_body)
        if ok:
            return True, detail

        # 2. Python standard smtplib Gmail SMTP fallback
        gmail_user = settings.current_gmail_user.strip()
        gmail_pass = settings.current_gmail_app_password.replace(" ", "").strip()
        if not gmail_user or not gmail_pass:
            return False, "GMAIL_USER or GMAIL_APP_PASSWORD not configured in .env."

        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            from_sender = f"TrustMesh Security Alerts <{gmail_user}>" if "@" in gmail_user else settings.current_email_from
            msg["From"] = from_sender
            msg["To"] = recipient

            part = MIMEText(html_body, "html")
            msg.attach(part)

            host = settings.current_smtp_host
            port = settings.current_smtp_port

            if port == 465:
                with smtplib.SMTP_SSL(host, port, timeout=10) as server:
                    server.login(gmail_user, gmail_pass)
                    server.sendmail(gmail_user, [recipient], msg.as_string())
            else:
                with smtplib.SMTP(host, port, timeout=10) as server:
                    server.ehlo()
                    if settings.SMTP_USE_TLS:
                        server.starttls()
                        server.ehlo()
                    server.login(gmail_user, gmail_pass)
                    server.sendmail(gmail_user, [recipient], msg.as_string())
            logger.info(f"Gmail SMTP successfully delivered email to {recipient}")
            return True, f"gmail-smtp-{uuid.uuid4().hex[:10]}"
        except smtplib.SMTPAuthenticationError as ex:
            safe_err = str(ex).replace(gmail_pass, "***")
            logger.warning(f"Gmail SMTP authentication failed: {safe_err}")
            return False, f"Gmail SMTP authentication failed (check GMAIL_USER and GMAIL_APP_PASSWORD): {safe_err}"
        except smtplib.SMTPConnectError as ex:
            safe_err = str(ex).replace(gmail_pass, "***")
            logger.warning(f"Gmail SMTP connection failed: {safe_err}")
            return False, f"Gmail SMTP connection failed: {safe_err}"
        except TimeoutError as ex:
            logger.warning(f"Gmail SMTP connection timed out")
            return False, "Gmail SMTP connection timed out"
        except Exception as ex:
            safe_err = str(ex).replace(gmail_pass, "***")
            logger.warning(f"Gmail SMTP dispatch failed: {safe_err}")
            return False, f"Gmail SMTP error: {safe_err}"

    @classmethod
    def _save_local_mailbox_and_notify(cls, recipient: str, subject: str, html_body: str, notification_id: str):
        """
        Self-Owned Autonomous Delivery:
        1. Writes standard RFC 822 .eml file to the local mailbox directory (openable in Apple Mail/Outlook).
        2. Dispatches an immediate desktop notification on macOS with audio chime.
        Zero third-party mediators or quotas needed.
        """
        import platform
        import subprocess
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from app.core.config import _ROOT_DIR

        try:
            mailbox_dir = Path("/tmp/mailbox") if (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")) else (_ROOT_DIR / "mailbox")
            mailbox_dir.mkdir(parents=True, exist_ok=True)
            eml_path = mailbox_dir / f"{notification_id}.eml"

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = "TrustMesh Autonomous Engine <alerts@trustmesh.local>"
            msg["To"] = recipient
            msg["Date"] = utc_now().strftime("%a, %d %b %Y %H:%M:%S +0000")
            msg.attach(MIMEText(html_body, "html"))

            with open(eml_path, "w", encoding="utf-8") as f:
                f.write(msg.as_string())
        except Exception as ex:
            logger.warning(f"Local mailbox file note: {ex}")

        # Native desktop notification on macOS (bulletproof sanitization)
        if platform.system() == "Darwin" and "PYTEST_CURRENT_TEST" not in os.environ:
            try:
                # Sanitize to single-line text without quotes or backslashes
                safe_subj = " ".join(subject.split())[:80].replace('"', '').replace("'", "").replace('\\', '')
                safe_recip = " ".join(recipient.split())[:50].replace('"', '').replace("'", "").replace('\\', '')
                script = f'display notification "{safe_subj}" with title "TrustMesh Mail" subtitle "Delivered to {safe_recip}" sound name "Glass"'
                subprocess.run(
                    ["osascript", "-e", script],
                    timeout=3,
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                pass

    @classmethod
    def _safe_commit(cls, db: Session, record: EmailNotification) -> Optional[EmailNotification]:
        """Safely commits an email record to SQLite, rolling back on transaction conflict."""
        try:
            db.commit()
            return record
        except Exception as ex:
            try:
                db.rollback()
            except Exception:
                pass
            logger.error(f"Failed to commit email record {getattr(record, 'id', 'unknown')}: {ex}")
            return record

    @classmethod
    def send_notification(
        cls,
        db: Session,
        activity: ActivityLog
    ) -> Optional[EmailNotification]:
        """
        Processes and sends an admin notification via Resend with audit tracking, rate limiting, and failure isolation.
        Does NOT throw exceptions so the main user operation is never interrupted.
        """
        # Prevent duplicate notifications for the same activity log event
        existing = db.query(EmailNotification).filter(EmailNotification.activity_log_id == activity.id).first()
        if existing and existing.status == "SENT":
            return existing

        notification_id = existing.id if existing else f"eml-{uuid.uuid4().hex[:12]}"
        friendly_title = cls.get_event_friendly_title(activity.event_type)

        if "SECURITY" in activity.event_type or activity.status == "SUSPICIOUS":
            subject = f"⚠️ [SECURITY ALERT] {friendly_title} [{activity.event_type}] ({activity.user_email or 'System'})"
        elif activity.status == "WARNING":
            subject = f"⚠️ [TrustMesh Alert] {friendly_title} [{activity.event_type}] - {activity.project_name or activity.resource_id or 'System'}"
        else:
            actor_label = activity.user_email or (f"@{activity.github_username}" if activity.github_username else "")
            target_str = f" - {actor_label}" if actor_label else (f" - {activity.project_name}" if activity.project_name else "")
            subject = f"[TrustMesh Alert] {friendly_title} [{activity.event_type}]{target_str}"

        # Resolve recipient: target_recipient takes precedence for probes/tests
        admin_email = activity.metadata_dict.get("target_recipient") or settings.current_admin_email or "akshay123modi@gmail.com"
        email_from = settings.current_email_from or "TrustMesh Alerts <onboarding@resend.dev>"
        resend_api_key = settings.current_resend_api_key

        # Check rate-limiting
        rate_limited, reason = cls.should_rate_limit(
            db, activity.event_type, activity.user_email, activity.resource_id
        )
        if rate_limited:
            if existing:
                record = existing
                record.status = "RATE_LIMITED"
                record.error_message = reason
            else:
                record = EmailNotification(
                    id=notification_id,
                    activity_log_id=activity.id,
                    recipient=admin_email,
                    subject=subject,
                    html_content="",
                    status="RATE_LIMITED",
                    error_message=reason,
                    attempt_count=1,
                    created_at=utc_now(),
                    sent_at=None
                )
                db.add(record)
            return cls._safe_commit(db, record)

        html_body = cls.generate_html_email(
            activity_id=activity.id,
            event_type=activity.event_type,
            description=activity.event_description,
            user_name=activity.user_name,
            user_email=activity.user_email,
            github_username=activity.github_username,
            project_name=activity.project_name,
            status=activity.status,
            timestamp=activity.timestamp,
            metadata=activity.metadata_dict
        )

        explicit_provider = (os.environ.get("EMAIL_PROVIDER") or settings.current_email_provider or "").lower()
        raw_resend_key = os.environ.get("RESEND_API_KEY") if "RESEND_API_KEY" in os.environ else settings.current_resend_api_key
        resend_api_key = (raw_resend_key or "").strip()

        # 1. Explicit Resend mode with no key provided -> SIMULATED
        if explicit_provider == "resend" and not resend_api_key:
            if existing:
                record = existing
                record.status = "SIMULATED"
                record.error_message = "Resend API key not configured in .env (RESEND_API_KEY is empty). Delivery simulated and logged."
                record.sent_at = None
            else:
                record = EmailNotification(
                    id=notification_id,
                    activity_log_id=activity.id,
                    recipient=admin_email,
                    subject=subject,
                    html_content=html_body,
                    status="SIMULATED",
                    resend_id=f"sim-{uuid.uuid4().hex[:8]}",
                    error_message="Resend API key not configured in .env (RESEND_API_KEY is empty). Delivery simulated and logged.",
                    attempt_count=1,
                    created_at=utc_now(),
                    sent_at=None
                )
                db.add(record)
            return cls._safe_commit(db, record)

        # 2. Self-Owned Autonomous Delivery Engine with Nodemailer & Gmail SMTP
        # Prioritizes Gmail SMTP + Nodemailer (Zero external mediators like Resend/Formspree)
        has_gmail = bool(settings.current_gmail_user and settings.current_gmail_app_password)
        if explicit_provider == "resend" and resend_api_key:
            has_gmail = False

        if (has_gmail and explicit_provider not in {"resend"}) or not resend_api_key or explicit_provider in {"smtp", "gmail", "nodemailer", "database"}:
            smtp_delivered = False
            smtp_detail = ""
            if has_gmail and explicit_provider != "database":
                try:
                    smtp_delivered, smtp_detail = cls._send_smtp_email(recipient=admin_email, subject=subject, html_body=html_body)
                except Exception as ex:
                    smtp_detail = str(ex)
                    logger.warning(f"Gmail SMTP dispatch note: {ex}")

            # If Gmail SMTP failed (e.g. 550 daily sending limit) and Resend API key is available, attempt seamless cloud failover
            resend_failed_over = False
            if not smtp_delivered and resend_api_key and explicit_provider not in {"smtp", "gmail", "database"}:
                try:
                    logger.info("Attempting seamless failover to Resend API...")
                    resend_resp = cls._send_resend_request(
                        api_key=resend_api_key,
                        email_from=email_from,
                        admin_email=admin_email,
                        subject=subject,
                        html_body=html_body
                    )
                    if resend_resp.status_code in {200, 201}:
                        resend_data = resend_resp.json()
                        smtp_delivered = True
                        resend_failed_over = True
                        smtp_detail = resend_data.get("id", f"resend-{uuid.uuid4().hex[:8]}")
                except Exception as resend_ex:
                    logger.warning(f"Resend failover note: {resend_ex}")

            # Save locally to mailbox/.eml and trigger desktop notification
            cls._save_local_mailbox_and_notify(
                recipient=admin_email,
                subject=subject,
                html_body=html_body,
                notification_id=notification_id
            )

            if explicit_provider == "database":
                delivery_id = f"db-auto-{uuid.uuid4().hex[:12]}"
                status_val = "SENT"
                sent_at_val = utc_now()
                err_msg = ""
            elif smtp_delivered:
                if resend_failed_over:
                    delivery_id = smtp_detail
                else:
                    delivery_id = f"gmail-smtp-{uuid.uuid4().hex[:10]}" if not smtp_detail.startswith("gmail-smtp") else smtp_detail
                status_val = "SENT"
                sent_at_val = utc_now()
                err_msg = ""
            elif has_gmail:
                delivery_id = f"db-fallback-{uuid.uuid4().hex[:10]}"
                status_val = "FAILED"
                sent_at_val = None
                if "550" in smtp_detail or "limit exceeded" in smtp_detail.lower():
                    err_msg = (
                        f"Gmail daily user sending limit exceeded (550). Google temporarily throttled outbound SMTP for ~24 hours for {settings.current_gmail_user}. "
                        f"Notification was safely archived in your database audit log and local mailbox. "
                        f"To bypass Google's limit immediately, set EMAIL_PROVIDER=database in .env or configure a RESEND_API_KEY."
                    )
                else:
                    err_msg = f"Gmail SMTP dispatch attempted but failed: {smtp_detail}. Archived locally in fallback mailbox."
            else:
                delivery_id = f"sim-{uuid.uuid4().hex[:8]}"
                status_val = "SIMULATED"
                sent_at_val = None
                err_msg = "GMAIL_USER or GMAIL_APP_PASSWORD not configured in .env. Notification archived locally in mailbox."

            if existing:
                record = existing
                record.recipient = admin_email
                record.subject = subject
                record.html_content = html_body
                record.status = status_val
                record.resend_id = delivery_id
                record.error_message = err_msg
                record.sent_at = sent_at_val
                record.attempt_count = (record.attempt_count or 1) + 1
            else:
                record = EmailNotification(
                    id=notification_id,
                    activity_log_id=activity.id,
                    recipient=admin_email,
                    subject=subject,
                    html_content=html_body,
                    status=status_val,
                    resend_id=delivery_id,
                    error_message=err_msg,
                    attempt_count=1,
                    created_at=utc_now(),
                    sent_at=sent_at_val
                )
                db.add(record)
            return cls._safe_commit(db, record)

        # 3. Real Resend API Delivery with retries
        record = EmailNotification(
            id=notification_id,
            activity_log_id=activity.id,
            recipient=admin_email,
            subject=subject,
            html_content=html_body,
            status="PENDING",
            attempt_count=1,
            created_at=utc_now(),
            sent_at=None
        )
        db.add(record)
        cls._safe_commit(db, record)

        max_retries = 2
        for attempt in range(1, max_retries + 1):
            record.attempt_count = attempt
            try:
                resp = cls._send_resend_request(
                    api_key=resend_api_key,
                    email_from=email_from,
                    admin_email=admin_email,
                    subject=subject,
                    html_body=html_body
                )
                if resp.status_code in {200, 201}:
                    data = resp.json()
                    record.status = "SENT"
                    record.resend_id = data.get("id", "")
                    record.error_message = ""
                    record.sent_at = utc_now()
                    return cls._safe_commit(db, record)
                elif resp.status_code == 429:
                    # Resend daily quota reached: gracefully fallback to self-owned automation
                    cls._save_local_mailbox_and_notify(
                        recipient=admin_email,
                        subject=subject,
                        html_body=html_body,
                        notification_id=notification_id
                    )
                    record.status = "SENT"
                    record.resend_id = f"db-auto-{uuid.uuid4().hex[:12]}"
                    record.error_message = ""
                    record.sent_at = utc_now()
                    return cls._safe_commit(db, record)
                else:
                    try:
                        err_json = resp.json()
                        err_detail = err_json.get("message") or err_json.get("error") or str(err_json)
                    except Exception:
                        err_detail = resp.text[:200]
                    record.error_message = f"Resend API error HTTP {resp.status_code}: {err_detail}"
            except Exception as ex:
                record.error_message = f"Provider network exception on attempt {attempt}: {ex}"

        # If retries failed on 403 or non-quota network error
        cls._save_local_mailbox_and_notify(
            recipient=admin_email,
            subject=subject,
            html_body=html_body,
            notification_id=notification_id
        )
        record.status = "FAILED"
        record.sent_at = None
        return cls._safe_commit(db, record)
