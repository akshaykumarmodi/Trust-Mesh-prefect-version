import os
import pytest
from unittest.mock import patch, MagicMock
import httpx
from app.models import ActivityLog, EmailNotification, User
from app.core.config import settings

def test_signup_generates_one_event_and_notification(client, db_session):
    test_email = "newuser_test_unique@example.com"
    payload = {
        "email": test_email,
        "password": "Password123!",
        "name": "Test Contributor",
        "github_username": "testcontrib"
    }

    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == test_email

    # Check ActivityLog
    reg_log = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.event_type == "AUTH_REGISTRATION", ActivityLog.user_email == test_email)
        .first()
    )
    assert reg_log is not None
    assert reg_log.status == "SUCCESS"
    assert reg_log.user_name == "Test Contributor"
    assert reg_log.github_username == "testcontrib"

    # Check EmailNotification
    email_notif = (
        db_session.query(EmailNotification)
        .filter(EmailNotification.activity_log_id == reg_log.id)
        .first()
    )
    assert email_notif is not None
    assert email_notif.recipient == settings.ADMIN_NOTIFICATION_EMAIL
    assert "AUTH_REGISTRATION" in email_notif.subject
    assert email_notif.status in {"SENT", "SIMULATED"}

def test_successful_email_login_generates_event(client, db_session):
    test_email = "login_test_user@example.com"
    client.post("/api/auth/register", json={
        "email": test_email,
        "password": "SecretPass456!",
        "name": "Login User"
    })

    # Perform login
    resp = client.post("/api/auth/login", json={
        "email": test_email,
        "password": "SecretPass456!"
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    # Check ActivityLog
    login_log = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.event_type == "AUTH_LOGIN", ActivityLog.user_email == test_email)
        .first()
    )
    assert login_log is not None
    assert login_log.status == "SUCCESS"
    assert login_log.metadata_dict.get("auth_method") == "email_password"

def test_existing_user_login_does_not_generate_signup_notification(client, db_session):
    test_email = "existing_user_check@example.com"
    client.post("/api/auth/register", json={
        "email": test_email,
        "password": "ExistingPass789!",
        "name": "Existing User"
    })

    initial_reg_count = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_REGISTRATION",
        ActivityLog.user_email == test_email
    ).count()
    assert initial_reg_count == 1

    # Login multiple times
    client.post("/api/auth/login", json={"email": test_email, "password": "ExistingPass789!"})
    client.post("/api/auth/login", json={"email": test_email, "password": "ExistingPass789!"})

    # Verify no new registration events created
    later_reg_count = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_REGISTRATION",
        ActivityLog.user_email == test_email
    ).count()
    assert later_reg_count == 1

def test_github_login_generates_event(client, db_session):
    resp = client.post("/api/auth/github-login", json={
        "mock_username": "octocat-engineer"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["github_username"] == "octocat-engineer"

    gh_log = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.event_type == "AUTH_GITHUB_LOGIN", ActivityLog.github_username == "octocat-engineer")
        .first()
    )
    assert gh_log is not None
    assert gh_log.status == "SUCCESS"
    assert gh_log.metadata_dict.get("auth_method") == "github_oauth"

def test_failed_operations_do_not_generate_successful_operation_events(client, db_session):
    test_email = "victim_account@example.com"
    client.post("/api/auth/register", json={
        "email": test_email,
        "password": "CorrectPassword123!",
        "name": "Victim Account"
    })

    # Attempt login with WRONG password
    resp = client.post("/api/auth/login", json={
        "email": test_email,
        "password": "WRONG_PASSWORD_SUBMISSION"
    })
    assert resp.status_code == 401

    # Confirm NO AUTH_LOGIN was logged for this failure
    success_logs = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_LOGIN",
        ActivityLog.user_email == test_email
    ).all()
    assert len(success_logs) == 0

    # Confirm AUTH_FAILED_LOGIN was logged
    fail_log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_FAILED_LOGIN",
        ActivityLog.user_email == test_email
    ).first()
    assert fail_log is not None
    assert fail_log.status == "FAILED"

def test_repeated_failed_logins_trigger_security_alert(client, db_session):
    test_email = "bruteforce_target@example.com"
    client.post("/api/auth/register", json={
        "email": test_email,
        "password": "ValidPassword999!",
        "name": "Bruteforce Target"
    })

    # Fail 5 times
    for i in range(5):
        client.post("/api/auth/login", json={
            "email": test_email,
            "password": f"incorrect_attempt_{i}"
        })

    # Check for AUTH_SECURITY_ALERT
    alert = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_SECURITY_ALERT",
        ActivityLog.user_email == test_email
    ).first()
    assert alert is not None
    assert alert.status == "SUSPICIOUS"
    assert "Suspicious repeated failed login attempts" in alert.event_description

def test_sensitive_credentials_never_appear_in_logs_or_emails(client, db_session):
    secret_pass = "SuperSecretPlainTextPassword999!"
    test_email = "privacy_test@example.com"
    client.post("/api/auth/register", json={
        "email": test_email,
        "password": secret_pass,
        "name": "Privacy User"
    })

    # Query all activity logs and email notifications for this user
    logs = db_session.query(ActivityLog).filter(ActivityLog.user_email == test_email).all()
    for l in logs:
        assert secret_pass not in l.event_description
        assert secret_pass not in l.metadata_json

    emails = (
        db_session.query(EmailNotification)
        .join(ActivityLog, EmailNotification.activity_log_id == ActivityLog.id)
        .filter(ActivityLog.user_email == test_email)
        .all()
    )
    for em in emails:
        assert secret_pass not in em.subject
        assert secret_pass not in em.html_content

def test_repository_import_generates_event(client, db_session):
    mock_repo_payload = {
        "name": "distributed-mesh",
        "description": "High performance mesh",
        "default_branch": "main",
        "private": False,
        "stargazers_count": 2100,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-02-01T00:00:00Z"
    }

    with patch("httpx.Client.get") as mock_get:
        mock_resp_repo = MagicMock(status_code=200, json=lambda: mock_repo_payload)
        mock_resp_pulls = MagicMock(status_code=200, json=lambda: [])
        mock_get.side_effect = [mock_resp_repo, mock_resp_pulls]

        resp = client.post("/api/github/import-repo", json={
            "repo_url": "https://github.com/hyperflow-org/distributed-mesh",
            "category": "Infrastructure"
        })
        assert resp.status_code == 200
    gh_import_log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "GITHUB_REPO_IMPORTED",
        ActivityLog.project_name == "hyperflow-org/distributed-mesh"
    ).first()
    assert gh_import_log is not None
    assert gh_import_log.status == "SUCCESS"
    assert "distributed-mesh" in gh_import_log.event_description

def test_vouch_and_denouncement_generate_events(client, db_session):
    # Submit vouch
    v_resp = client.post("/api/vouches", json={
        "contributor_username": "elena-rustacean",
        "source_project_id": "proj-hyperflow",
        "reason": "Outstanding async runtime optimization",
        "evidence_url": "https://github.com/hyperflow-org/hyperflow/pull/99"
    })
    assert v_resp.status_code == 201

    vouch_log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "VOUCH_SUBMITTED",
        ActivityLog.project_name == "HyperFlow Engine"
    ).first()
    assert vouch_log is not None
    assert vouch_log.status == "SUCCESS"

    # Submit denouncement
    d_resp = client.post("/api/denouncements", json={
        "contributor_username": "slop-bot-99",
        "reporting_project_id": "proj-hyperflow",
        "reason": "Automated synchronized typo slop",
        "evidence_url": "https://github.com/hyperflow-org/hyperflow/pull/105"
    })
    assert d_resp.status_code == 201

    denounce_log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "DENOUNCEMENT_SUBMITTED",
        ActivityLog.project_name == "HyperFlow Engine"
    ).first()
    assert denounce_log is not None
    assert denounce_log.status == "WARNING"

def test_unauthorized_users_cannot_access_admin_activity_logs(client, db_session):
    # Non-admin user registers and tries to access /api/admin/activities
    non_admin_email = "regular_user@example.com"
    reg_resp = client.post("/api/auth/register", json={
        "email": non_admin_email,
        "password": "RegularUserPass123!"
    })
    token = reg_resp.json()["access_token"]

    # 1. Unauthenticated request -> 401
    unauth_resp = client.get("/api/admin/activities")
    assert unauth_resp.status_code in {401, 403}

    # 2. Regular user token -> 403 Forbidden
    forbidden_resp = client.get(
        "/api/admin/activities",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert forbidden_resp.status_code == 403
    assert "Administrator privileges required" in forbidden_resp.json()["detail"]

    # 3. Authorized request using X-Admin-Key -> 200 OK
    admin_resp = client.get(
        "/api/admin/activities",
        headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY}
    )
    assert admin_resp.status_code == 200
    assert "items" in admin_resp.json()
    assert "total" in admin_resp.json()

def test_email_delivery_failure_does_not_break_main_operation(client, db_session):
    # Mock EmailService to raise an unhandled provider exception
    with patch("app.services.email_service.EmailService.send_notification", side_effect=RuntimeError("SMTP Outage")):
        resp = client.post("/api/auth/register", json={
            "email": "resilience_check@example.com",
            "password": "ResiliencePass123!",
            "name": "Resilient Account"
        })
        # Operation MUST succeed and return 200 despite email provider failure
        assert resp.status_code == 200
        assert "access_token" in resp.json()

def test_admin_metrics_and_privacy_notice(client):
    # Privacy notice is publicly disclosed
    p_resp = client.get("/api/admin/privacy-notice")
    assert p_resp.status_code == 200
    data = p_resp.json()
    assert "TrustMesh Activity Monitoring" in data["title"]
    assert len(data["collected_events"]) > 0

    # Metrics endpoint with Admin Key
    m_resp = client.get("/api/admin/metrics", headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY})
    assert m_resp.status_code == 200
    m_data = m_resp.json()
    assert m_data["admin_email"] == settings.ADMIN_NOTIFICATION_EMAIL
    assert m_data["total_activities"] > 0

def test_admin_test_email_trigger(client, db_session):
    resp = client.post(
        "/api/admin/test-email",
        headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY},
        json={"recipient": "akshay123modi@gmail.com"}
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["admin_email"] == "akshay123modi@gmail.com"
    assert res_data["success"] is True
    assert res_data["status"] in {"SENT", "SIMULATED"}

def test_resend_mocked_success_delivery(client, db_session):
    """Verifies successful delivery via mocked Resend HTTP client."""
    mock_resend_response = MagicMock(
        status_code=200,
        json=lambda: {"id": "re_mock_abc12345"}
    )

    with patch.dict(os.environ, {"RESEND_API_KEY": "re_test_mock_secret_key"}), \
         patch("app.services.email_service.EmailService._send_resend_request", return_value=mock_resend_response) as mock_send:
        resp = client.post(
            "/api/admin/test-email",
            headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY},
            json={"recipient": "akshay123modi@gmail.com"}
        )
        assert resp.status_code == 200
        res_data = resp.json()
        assert res_data["success"] is True
        assert res_data["status"] == "SENT"
        assert "re_mock_abc12345" in res_data["message"]

        # Verify the database record
        notif = db_session.query(EmailNotification).filter(
            EmailNotification.id == res_data["notification_id"]
        ).first()
        assert notif is not None
        assert notif.status == "SENT"
        assert notif.resend_id == "re_mock_abc12345"
        assert notif.sent_at is not None
        assert notif.recipient == settings.ADMIN_NOTIFICATION_EMAIL

        # Verify method was called with correct parameters
        assert mock_send.called
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs["admin_email"] == settings.ADMIN_NOTIFICATION_EMAIL
        assert call_kwargs["api_key"] == "re_test_mock_secret_key"

def test_resend_mocked_error_handling_403(client, db_session):
    """Verifies that an upstream Resend 403 (e.g. unverified domain) is handled gracefully without crashing."""
    mock_error_resp = MagicMock(
        status_code=403,
        json=lambda: {
            "statusCode": 403,
            "message": "Domain not verified. You can only send from onboarding@resend.dev until your domain is verified."
        }
    )

    with patch.dict(os.environ, {"RESEND_API_KEY": "re_test_mock_secret_key"}), \
         patch("app.services.email_service.EmailService._send_resend_request", return_value=mock_error_resp):
        resp = client.post(
            "/api/admin/test-email",
            headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY},
            json={"recipient": "akshay123modi@gmail.com"}
        )
        assert resp.status_code == 200
        res_data = resp.json()
        assert res_data["success"] is False
        assert res_data["status"] == "FAILED"
        assert "Domain not verified" in res_data["message"]

        # Audit entry accurately records failure reason
        notif = db_session.query(EmailNotification).filter(
            EmailNotification.id == res_data["notification_id"]
        ).first()
        assert notif is not None
        assert notif.status == "FAILED"
        assert notif.sent_at is None
        assert "Domain not verified" in notif.error_message

def test_resend_network_timeout_retry_handling(client, db_session):
    """Verifies that network exceptions trigger retries and record failure without breaking the app."""
    with patch.dict(os.environ, {"RESEND_API_KEY": "re_test_mock_secret_key"}), \
         patch("app.services.email_service.EmailService._send_resend_request", side_effect=httpx.ConnectTimeout("Connection timed out to api.resend.com")):
        resp = client.post(
            "/api/admin/test-email",
            headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY},
            json={"recipient": "akshay123modi@gmail.com"}
        )
        assert resp.status_code == 200
        res_data = resp.json()
        assert res_data["success"] is False
        assert res_data["status"] == "FAILED"

        notif = db_session.query(EmailNotification).filter(
            EmailNotification.id == res_data["notification_id"]
        ).first()
        assert notif is not None
        assert notif.status == "FAILED"
        assert notif.attempt_count == 2 # Retried
        assert "Connection timed out" in notif.error_message

def test_resend_not_configured_records_simulated(client, db_session):
    """Verifies that when RESEND_API_KEY is omitted/empty and provider is resend, simulation is clearly recorded."""
    with patch.dict(os.environ, {"RESEND_API_KEY": "", "EMAIL_PROVIDER": "resend"}):
        resp = client.post(
            "/api/admin/test-email",
            headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY},
            json={"recipient": "akshay123modi@gmail.com"}
        )
        assert resp.status_code == 200
        res_data = resp.json()
        assert res_data["status"] == "SIMULATED"
        assert "Resend API key is not configured" in res_data["message"]

        notif = db_session.query(EmailNotification).filter(
            EmailNotification.id == res_data["notification_id"]
        ).first()
        assert notif is not None
        assert notif.status == "SIMULATED"
        assert notif.sent_at is None

def test_database_automated_email_dispatch(client, db_session):
    """Verifies that our Database Automated Email Engine sends and records notifications autonomously without Resend."""
    with patch.dict(os.environ, {"EMAIL_PROVIDER": "database", "RESEND_API_KEY": ""}):
        resp = client.post(
            "/api/admin/test-email",
            headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY},
            json={"recipient": "akshay123modi@gmail.com"}
        )
        assert resp.status_code == 200
        res_data = resp.json()
        assert res_data["status"] == "SENT"
        assert res_data["success"] is True
        assert "Database" in res_data["message"]

        notif = db_session.query(EmailNotification).filter(
            EmailNotification.id == res_data["notification_id"]
        ).first()
        assert notif is not None
        assert notif.status == "SENT"
        assert notif.sent_at is not None
        assert notif.resend_id.startswith("db-auto-")

    # Also test the automated queue processing endpoint
    queue_resp = client.post(
        "/api/admin/emails/process-queue",
        headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY}
    )
    assert queue_resp.status_code == 200
    assert queue_resp.json()["success"] is True

# ==============================================================================
# Comprehensive Data Mapping & Event-Specific Template Validation Tests
# ==============================================================================

def test_registration_notification_with_missing_name_uses_not_provided_never_na(client, db_session):
    """Verifies that an account registered without a name uses 'Not provided' and NEVER displays 'N/A'."""
    test_email = "noname_contributor@example.com"
    resp = client.post("/api/auth/register", json={
        "email": test_email,
        "password": "SecurePassword123!",
        "name": "", # Intentionally omitted name
        "github_username": ""
    })
    assert resp.status_code == 200

    log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_REGISTRATION",
        ActivityLog.user_email == test_email
    ).first()
    assert log is not None
    assert log.user_name == ""  # Never 'N/A' in database
    assert "N/A" not in log.event_description

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == log.id
    ).first()
    assert email_notif is not None
    assert "N/A" not in email_notif.html_content
    assert "Not provided" in email_notif.html_content
    assert test_email in email_notif.html_content
    assert "New User Registration" in email_notif.html_content

def test_registration_notification_with_authenticated_user_and_github(client, db_session):
    """Verifies registration email contains actual name, email, registration method, and linked GitHub handle."""
    test_email = "alexander.dev@example.com"
    resp = client.post("/api/auth/register", json={
        "email": test_email,
        "password": "Password12345!",
        "name": "Alexander Hamilton",
        "github_username": "ahamilton-dev"
    })
    assert resp.status_code == 200

    log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_REGISTRATION",
        ActivityLog.user_email == test_email
    ).first()
    assert log is not None
    assert log.user_name == "Alexander Hamilton"
    assert log.github_username == "ahamilton-dev"

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == log.id
    ).first()
    assert email_notif is not None
    assert "Alexander Hamilton" in email_notif.html_content
    assert test_email in email_notif.html_content
    assert "@ahamilton-dev" in email_notif.html_content
    assert "Email & Password" in email_notif.html_content
    assert "Active &bull; Verified" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_login_notification_contains_user_details_and_method(client, db_session):
    """Verifies login email template displays user's real name, email, login method, and timestamp."""
    test_email = "sophia.maintainer@example.com"
    client.post("/api/auth/register", json={
        "email": test_email,
        "password": "MaintainerPass789!",
        "name": "Sophia Rodriguez",
        "github_username": "s-rodriguez"
    })

    # Clear notifications from registration
    db_session.query(EmailNotification).delete()
    db_session.commit()

    resp = client.post("/api/auth/login", json={
        "email": test_email,
        "password": "MaintainerPass789!"
    })
    assert resp.status_code == 200

    log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_LOGIN",
        ActivityLog.user_email == test_email
    ).first()
    assert log is not None

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == log.id
    ).first()
    assert email_notif is not None
    assert "Sophia Rodriguez" in email_notif.html_content
    assert test_email in email_notif.html_content
    assert "@s-rodriguez" in email_notif.html_content
    assert "Email & Password" in email_notif.html_content
    assert "Sign-In Session Details" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_github_login_notification_contains_github_handle(client, db_session):
    """Verifies GitHub OAuth login email contains GitHub handle, auto-generated email, and OAuth method."""
    resp = client.post("/api/auth/github-login", json={
        "mock_username": "sarah-kernel"
    })
    assert resp.status_code == 200

    log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "AUTH_GITHUB_LOGIN",
        ActivityLog.github_username == "sarah-kernel"
    ).first()
    assert log is not None

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == log.id
    ).first()
    assert email_notif is not None
    assert "@sarah-kernel" in email_notif.html_content
    assert "GitHub OAuth" in email_notif.html_content
    assert "sarah-kernel@users.noreply.github.com" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_vouch_notification_correctly_maps_submitter_and_recipient(client, db_session):
    """Verifies that VOUCH_SUBMITTED clearly distinguishes submitter vs recipient and shows project and evidence."""
    # Register an authenticated maintainer
    maintainer_email = "voucher_maintainer@example.com"
    reg_resp = client.post("/api/auth/register", json={
        "email": maintainer_email,
        "password": "VoucherPassword123!",
        "name": "Marcus Vance",
        "github_username": "marcus-vance"
    })
    token = reg_resp.json()["access_token"]

    # Submit vouch while authenticated
    vouch_resp = client.post(
        "/api/vouches",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "contributor_username": "elena-rustacean",
            "source_project_id": "proj-hyperflow",
            "reason": "Outstanding lock-free async queue optimization",
            "evidence_url": "https://github.com/hyperflow-org/hyperflow/pull/99",
            "confidence": 0.95
        }
    )
    assert vouch_resp.status_code == 201

    vouch_log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "VOUCH_SUBMITTED",
        ActivityLog.resource_id == vouch_resp.json()["id"]
    ).first()
    assert vouch_log is not None
    # Submitter must be Marcus Vance, NOT the recipient elena-rustacean
    assert vouch_log.user_email == maintainer_email
    assert vouch_log.user_name == "Marcus Vance"
    assert vouch_log.github_username == "marcus-vance"

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == vouch_log.id
    ).first()
    assert email_notif is not None
    # Email body must clearly distinguish submitter and recipient
    assert "Marcus Vance" in email_notif.html_content
    assert maintainer_email in email_notif.html_content
    assert "@elena-rustacean" in email_notif.html_content
    assert "HyperFlow Engine" in email_notif.html_content
    assert "Outstanding lock-free async queue optimization" in email_notif.html_content
    assert "https://github.com/hyperflow-org/hyperflow/pull/99" in email_notif.html_content
    assert "0.95" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_denouncement_notification_correctly_maps_reporter_and_reported(client, db_session):
    """Verifies that DENOUNCEMENT_SUBMITTED clearly distinguishes reporter from reported account and never shows 'Announcement'."""
    reporter_email = "security_lead@example.com"
    reg_resp = client.post("/api/auth/register", json={
        "email": reporter_email,
        "password": "SecurityLead123!",
        "name": "Dr. Sarah Chen",
        "github_username": "schen-security"
    })
    token = reg_resp.json()["access_token"]

    denounce_resp = client.post(
        "/api/denouncements",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "contributor_username": "malicious-actor-99",
            "reporting_project_id": "proj-hyperflow",
            "reason": "Synthetic AI hallucinations in memory safety critical section",
            "evidence_url": "https://github.com/hyperflow-org/hyperflow/pull/112",
            "details": "Synchronized PR storm across 5 forks with identical hallucinated unsafe blocks"
        }
    )
    assert denounce_resp.status_code == 201

    denounce_log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "DENOUNCEMENT_SUBMITTED",
        ActivityLog.resource_id == denounce_resp.json()["id"]
    ).first()
    assert denounce_log is not None
    # Submitter must be Dr. Sarah Chen, NOT the reported malicious-actor-99
    assert denounce_log.user_email == reporter_email
    assert denounce_log.user_name == "Dr. Sarah Chen"
    assert denounce_log.github_username == "schen-security"

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == denounce_log.id
    ).first()
    assert email_notif is not None
    # Must show Trust Denouncement (never 'Announcement')
    assert "Trust Denouncement" in email_notif.html_content
    assert "Dr. Sarah Chen" in email_notif.html_content
    assert reporter_email in email_notif.html_content
    assert "@malicious-actor-99" in email_notif.html_content
    assert "HyperFlow Engine" in email_notif.html_content
    assert "Synthetic AI hallucinations" in email_notif.html_content
    assert "Pending Review" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_project_imported_notification_maps_actor_and_repository(client, db_session):
    """Verifies that GITHUB_REPO_IMPORTED email shows importer name, email, repository name, canonical URL, branch, and PR count."""
    importer_email = "importer_dev@example.com"
    reg_resp = client.post("/api/auth/register", json={
        "email": importer_email,
        "password": "ImporterPass123!",
        "name": "David Thorne",
        "github_username": "dthorne"
    })
    token = reg_resp.json()["access_token"]

    mock_repo_payload = {
        "name": "trustmesh-core",
        "description": "Autonomous trust protocol",
        "default_branch": "develop",
        "private": False,
        "stargazers_count": 3400,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-02-01T00:00:00Z"
    }

    with patch("httpx.Client.get") as mock_get:
        mock_resp_repo = MagicMock(status_code=200, json=lambda: mock_repo_payload)
        mock_resp_pulls = MagicMock(status_code=200, json=lambda: [])
        mock_get.side_effect = [mock_resp_repo, mock_resp_pulls]

        resp = client.post(
            "/api/github/import-repo",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "repo_url": "https://github.com/nexora-org/trustmesh-core",
                "category": "Core Protocol"
            }
        )
        assert resp.status_code == 200

    log = db_session.query(ActivityLog).filter(
        ActivityLog.event_type == "GITHUB_REPO_IMPORTED",
        ActivityLog.project_name == "nexora-org/trustmesh-core"
    ).first()
    assert log is not None
    assert log.user_email == importer_email
    assert log.user_name == "David Thorne"

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == log.id
    ).first()
    assert email_notif is not None
    assert "David Thorne" in email_notif.html_content
    assert importer_email in email_notif.html_content
    assert "nexora-org/trustmesh-core" in email_notif.html_content
    assert "https://github.com/nexora-org/trustmesh-core" in email_notif.html_content
    assert "develop" in email_notif.html_content
    assert "Public Repository Imported" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_campaign_detected_notification_renders_all_forensic_details(client, db_session):
    """Verifies that CAMPAIGN_DETECTED email renders full threat intelligence, affected projects, coordinated accounts, and evidence count."""
    admin_user = db_session.query(User).filter(User.is_admin == True).first()
    if not admin_user:
        admin_user = User(
            id="usr-test-admin",
            email=settings.ADMIN_NOTIFICATION_EMAIL,
            name="Platform SecOps",
            is_admin=True,
            created_at=settings.APP_LAUNCH_TIME if hasattr(settings, "APP_LAUNCH_TIME") else None
        )
        db_session.add(admin_user)
        db_session.commit()

    # Log a CAMPAIGN_DETECTED event with rich metadata
    from app.services.activity_logger import ActivityLogger
    act = ActivityLogger.log(
        db=db_session,
        event_type="CAMPAIGN_DETECTED",
        event_description="Forensic radar flagged 1 coordinated spam cluster across 3 projects",
        user=admin_user,
        resource_type="campaign",
        resource_id="cmp-test-sybil-01",
        status="SUSPICIOUS",
        metadata={
            "campaign_name": "Synchronized Typosquatting Slop Cluster",
            "campaign_code": "CMP-2026-SYBIL-99",
            "pattern_type": "Cross-Repository Template Burst",
            "signal_strength": "0.94",
            "affected_projects": ["HyperFlow Engine", "VectorGuard AI", "OmniMesh Bridge"],
            "contributor_usernames": ["slop-bot-01", "slop-bot-02", "slop-bot-03"],
            "evidence_count": "14 correlated records across 3 repositories"
        },
        send_email=True
    )

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == act.id
    ).first()
    assert email_notif is not None
    assert "Coordinated Campaign Detected" in email_notif.html_content
    assert "Synchronized Typosquatting Slop Cluster" in email_notif.html_content
    assert "CMP-2026-SYBIL-99" in email_notif.html_content
    assert "Cross-Repository Template Burst" in email_notif.html_content
    assert "0.94" in email_notif.html_content
    assert "HyperFlow Engine" in email_notif.html_content
    assert "@slop-bot-01" in email_notif.html_content
    assert "14 correlated records across 3 repositories" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_github_connected_notification_template(client, db_session):
    """Verifies GITHUB_CONNECTED email renders connected user, github username, scope, and timestamp."""
    user = User(
        id="usr-gh-conn-test",
        email="gh_integrator@example.com",
        name="Grace Hopper",
        github_username="grace-hopper",
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()

    from app.services.activity_logger import ActivityLogger
    act = ActivityLogger.log(
        db=db_session,
        event_type="GITHUB_CONNECTED",
        event_description="GitHub OAuth authorization granted and credentials securely saved",
        user=user,
        resource_type="integration",
        resource_id="github-oauth",
        status="SUCCESS",
        metadata={"scope": "repo, read:user"}
    )

    email_notif = db_session.query(EmailNotification).filter(
        EmailNotification.activity_log_id == act.id
    ).first()
    assert email_notif is not None
    assert "GitHub Account Connected" in email_notif.html_content
    assert "Grace Hopper" in email_notif.html_content
    assert "gh_integrator@example.com" in email_notif.html_content
    assert "@grace-hopper" in email_notif.html_content
    assert "repo, read:user" in email_notif.html_content
    assert "N/A" not in email_notif.html_content

def test_admin_login_with_both_passwords_and_aliases(client):
    """Ensure admin account can authenticate with both standard and demo password variants."""
    admin_email = settings.ADMIN_NOTIFICATION_EMAIL

    # 1. Test login with TrustMesh2026!
    res1 = client.post("/api/auth/login", json={"email": admin_email, "password": "TrustMesh2026!"})
    assert res1.status_code == 200
    token1 = res1.json()["access_token"]
    assert bool(token1)

    # 2. Test login with AdminTrustMesh2026!
    res2 = client.post("/api/auth/login", json={"email": admin_email, "password": "AdminTrustMesh2026!"})
    assert res2.status_code == 200
    token2 = res2.json()["access_token"]
    assert bool(token2)

    # 3. Test access to admin endpoints with token and aliases
    res_metrics = client.get("/api/admin/metrics", headers={"Authorization": f"Bearer {token1}"})
    assert res_metrics.status_code == 200

    res_deliveries = client.get("/api/admin/email-deliveries", headers={"Authorization": f"Bearer {token1}"})
    assert res_deliveries.status_code == 200

    res_emails_alias = client.get("/api/admin/emails", headers={"Authorization": f"Bearer {token1}"})
    assert res_emails_alias.status_code == 200
