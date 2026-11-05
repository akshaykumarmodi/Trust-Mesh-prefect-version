import os
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.models import User, ActivityLog, EmailNotification, utc_now
from app.services.auth_service import hash_password
from app.services.email_service import EmailService

@pytest.fixture
def test_user(db_session):
    import uuid
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=f"usr-auto-{uid}",
        email=f"alex-{uid}@nexora.org",
        name=f"Alex Engineer {uid}",
        hashed_password=hash_password("SuperSecretPass123!"),
        is_verified=True,
        is_admin=False,
        created_at=utc_now()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def test_successful_login_triggers_notification_with_required_details(client, db_session, test_user):
    """
    Requirement 3, 4, 5, 6, 8:
    Whenever a user successfully logs in, automatically send an email notification
    containing full name, email, user ID, login date and time.
    """
    resp = client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "SuperSecretPass123!"}
    )
    assert resp.status_code == 200
    token_data = resp.json()
    assert "access_token" in token_data
    assert token_data["user"]["id"] == test_user.id

    # Check database activity log
    log = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.user_id == test_user.id, ActivityLog.event_type == "AUTH_LOGIN")
        .order_by(ActivityLog.timestamp.desc())
        .first()
    )
    assert log is not None
    assert log.status == "SUCCESS"
    assert log.metadata_dict.get("user_id") == test_user.id

    # Check email notification record
    notif = (
        db_session.query(EmailNotification)
        .filter(EmailNotification.activity_log_id == log.id)
        .first()
    )
    assert notif is not None
    assert notif.status in {"SENT", "SIMULATED"}
    assert notif.recipient == (settings.current_admin_email or "akshay123modi@gmail.com")

    # Verify that email HTML content contains all 4 required details
    assert "User's Full Name" in notif.html_content
    assert test_user.name in notif.html_content
    assert "User's Email Address" in notif.html_content
    assert test_user.email in notif.html_content
    assert "User ID" in notif.html_content
    assert test_user.id in notif.html_content
    assert "Login Date and Time (UTC)" in notif.html_content

def test_failed_login_does_not_trigger_email_notification(client, db_session, test_user):
    """
    Requirement 12: Failed login attempts must not trigger email notifications.
    """
    # Count notifications before failed attempt
    notif_count_before = db_session.query(EmailNotification).count()

    resp = client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "WrongPassword999!"}
    )
    assert resp.status_code == 401

    # Verify no new email notification was created for this failed attempt
    notif_count_after = db_session.query(EmailNotification).count()
    assert notif_count_after == notif_count_before

    # Check that failed login activity is logged with status FAILED
    failed_log = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.user_id == test_user.id, ActivityLog.event_type == "AUTH_FAILED_LOGIN")
        .first()
    )
    assert failed_log is not None
    assert failed_log.status == "FAILED"

def test_login_notification_api_endpoint(client, db_session, test_user):
    """
    Requirement 6: Secure backend API route /api/auth/login-notification.
    """
    resp = client.post(
        "/api/auth/login-notification",
        json={
            "user_id": test_user.id,
            "email": test_user.email,
            "name": test_user.name,
            "auth_method": "custom_integration"
        }
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["success"] is True
    assert res_data["user_id"] == test_user.id
    assert res_data["recipient"] == (settings.current_admin_email or "akshay123modi@gmail.com")
    assert res_data["notification_id"] is not None

def test_duplicate_notification_suppression(client, db_session, test_user):
    """
    Requirement 11: Prevent duplicate notifications for the same login event within 5 seconds.
    """
    # First login -> triggers notification
    client.post("/api/auth/login", json={"email": test_user.email, "password": "SuperSecretPass123!"})
    
    first_notifs = (
        db_session.query(EmailNotification)
        .join(ActivityLog, EmailNotification.activity_log_id == ActivityLog.id)
        .filter(ActivityLog.user_id == test_user.id, ActivityLog.event_type == "AUTH_LOGIN")
        .count()
    )
    assert first_notifs >= 1

    # Immediate second call with identical payload within 5s
    client.post("/api/auth/login", json={"email": test_user.email, "password": "SuperSecretPass123!"})

    second_notifs = (
        db_session.query(EmailNotification)
        .join(ActivityLog, EmailNotification.activity_log_id == ActivityLog.id)
        .filter(ActivityLog.user_id == test_user.id, ActivityLog.event_type == "AUTH_LOGIN")
        .count()
    )
    # The duplicate login email is suppressed
    assert second_notifs == first_notifs

def test_nodemailer_dispatch_mocked(client, db_session, test_user):
    """
    Requirement 7: Nodemailer & Gmail SMTP delivery mechanism.
    """
    mock_nodemailer_result = MagicMock(
        returncode=0,
        stdout=json.dumps({"success": True, "messageId": "<test-msg-id-12345@smtp.gmail.com>"})
    )

    with patch.dict(os.environ, {
        "GMAIL_USER": "testadmin@gmail.com",
        "GMAIL_APP_PASSWORD": "abcd efgh ijkl mnop",
        "ADMIN_EMAIL": "akshay123modi@gmail.com"
    }), patch("subprocess.run", return_value=mock_nodemailer_result) as mock_subproc:
        resp = client.post(
            "/api/auth/login-notification",
            json={
                "user_id": test_user.id,
                "email": test_user.email,
                "name": test_user.name
            }
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

def test_email_failure_does_not_break_login(client, db_session, test_user):
    """
    Requirement 13: Email failures must not interrupt the user's login process.
    """
    with patch("app.services.email_service.EmailService.send_notification", side_effect=RuntimeError("SMTP Server down")):
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": "SuperSecretPass123!"}
        )
        # Login still succeeds flawlessly despite email failure
        assert resp.status_code == 200
        assert "access_token" in resp.json()

def test_smtp_status_and_config_endpoints(client, db_session):
    """
    Verifies that admin can check SMTP status and configure credentials securely.
    """
    # 1. Check status
    resp = client.get(
        "/api/admin/smtp-status",
        headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY}
    )
    assert resp.status_code == 200
    status_data = resp.json()
    assert "configured" in status_data
    assert "admin_email" in status_data

    # 2. Update config with mock
    with patch("app.core.config.update_env_file") as mock_update, \
         patch("app.core.config.reload_env") as mock_reload:
        post_resp = client.post(
            "/api/admin/smtp-config",
            headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY},
            json={
                "gmail_user": "alert-sender@gmail.com",
                "gmail_app_password": "abcd efgh ijkl mnop",
                "admin_email": "akshay123modi@gmail.com"
            }
        )
        assert post_resp.status_code == 200
        res = post_resp.json()
        assert res["success"] is True
        assert res["configured"] is True
        assert res["gmail_user"] == "alert-sender@gmail.com"
        assert mock_update.called

def test_missing_gmail_credentials_shows_clear_error_and_does_not_claim_sent(client, db_session, test_user):
    """
    Requirement 7: If Gmail credentials are missing, show a clear configuration error
    instead of silently claiming an email was sent.
    """
    with patch.dict(os.environ, {
        "GMAIL_USER": "",
        "GMAIL_APP_PASSWORD": "",
        "RESEND_API_KEY": "",
        "EMAIL_PROVIDER": "auto"
    }):
        # Check smtp-status reports unconfigured
        status_resp = client.get(
            "/api/admin/smtp-status",
            headers={"X-Admin-Key": settings.ADMIN_SECRET_KEY}
        )
        assert status_resp.status_code == 200
        assert status_resp.json()["configured"] is False

        # Trigger login
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": "SuperSecretPass123!"}
        )
        assert resp.status_code == 200

        # Check notification in database
        log = (
            db_session.query(ActivityLog)
            .filter(ActivityLog.user_id == test_user.id, ActivityLog.event_type == "AUTH_LOGIN")
            .order_by(ActivityLog.timestamp.desc())
            .first()
        )
        assert log is not None

        notif = (
            db_session.query(EmailNotification)
            .filter(EmailNotification.activity_log_id == log.id)
            .first()
        )
        assert notif is not None
        # Does NOT claim SENT
        assert notif.status == "SIMULATED"
        assert notif.sent_at is None
        assert "GMAIL_USER or GMAIL_APP_PASSWORD not configured" in notif.error_message
        assert notif.resend_id.startswith("sim-")

def test_successful_email_delivery_when_valid_credentials_available(client, db_session, test_user):
    """
    Requirement 8: If Gmail is configured, send notifications through Gmail SMTP
    and confirm delivery with status SENT.
    """
    with patch.dict(os.environ, {
        "GMAIL_USER": "test-admin@gmail.com",
        "GMAIL_APP_PASSWORD": "abcd efgh ijkl mnop",
        "ADMIN_EMAIL": "akshay123modi@gmail.com",
        "EMAIL_PROVIDER": "auto"
    }), patch("app.services.email_service.EmailService._send_smtp_email", return_value=(True, "gmail-smtp-mock12345")) as mock_smtp:
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": "SuperSecretPass123!"}
        )
        assert resp.status_code == 200

        log = (
            db_session.query(ActivityLog)
            .filter(ActivityLog.user_id == test_user.id, ActivityLog.event_type == "AUTH_LOGIN")
            .order_by(ActivityLog.timestamp.desc())
            .first()
        )
        assert log is not None

        notif = (
            db_session.query(EmailNotification)
            .filter(EmailNotification.activity_log_id == log.id)
            .first()
        )
        assert notif is not None
        assert notif.status == "SENT"
        assert notif.sent_at is not None
        assert notif.resend_id == "gmail-smtp-mock12345"
        assert notif.error_message == ""
        assert mock_smtp.called

def test_smtp_authentication_failure_handled_safely_with_local_fallback(client, db_session, test_user):
    """
    Requirement 6 & 9: Handle SMTP authentication failures safely, archive locally,
    do not break login, and do not claim email was sent.
    """
    with patch.dict(os.environ, {
        "GMAIL_USER": "test-admin@gmail.com",
        "GMAIL_APP_PASSWORD": "bad-password-xyz",
        "ADMIN_EMAIL": "akshay123modi@gmail.com",
        "EMAIL_PROVIDER": "auto"
    }), patch("app.services.email_service.EmailService._send_smtp_email", return_value=(False, "Gmail SMTP authentication failed: 535 Username and Password not accepted")), \
       patch("app.services.email_service.EmailService._save_local_mailbox_and_notify") as mock_local_mailbox:
        # Login must not crash or be interrupted
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": "SuperSecretPass123!"}
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

        log = (
            db_session.query(ActivityLog)
            .filter(ActivityLog.user_id == test_user.id, ActivityLog.event_type == "AUTH_LOGIN")
            .order_by(ActivityLog.timestamp.desc())
            .first()
        )
        assert log is not None

        notif = (
            db_session.query(EmailNotification)
            .filter(EmailNotification.activity_log_id == log.id)
            .first()
        )
        assert notif is not None
        # Does NOT claim SENT
        assert notif.status == "FAILED"
        assert notif.sent_at is None
        assert "Gmail SMTP dispatch attempted but failed" in notif.error_message
        assert mock_local_mailbox.called

def test_retry_does_not_create_duplicate_notifications(client, db_session, test_user):
    """
    Requirement 10: Do not create duplicate notifications when retrying.
    """
    from app.services.activity_logger import ActivityLogger

    act = ActivityLogger.log(
        db=db_session,
        event_type="AUTH_LOGIN",
        event_description=f"Deduplication test for {test_user.email}",
        user=test_user,
        status="SUCCESS",
        send_email=False
    )

    # First send call
    notif1 = EmailService.send_notification(db_session, act)
    assert notif1 is not None

    count1 = db_session.query(EmailNotification).filter(EmailNotification.activity_log_id == act.id).count()
    assert count1 == 1

    # Second send call (retry) on same activity
    notif2 = EmailService.send_notification(db_session, act)
    assert notif2 is not None

    count2 = db_session.query(EmailNotification).filter(EmailNotification.activity_log_id == act.id).count()
    # Still exactly 1 record: updated in place, never duplicated
    assert count2 == 1
    assert notif1.id == notif2.id

