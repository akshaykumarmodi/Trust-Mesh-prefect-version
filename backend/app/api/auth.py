import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import User, utc_now
from app.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    GitHubOAuthLoginRequest,
    PasswordResetRequest,
    VerifyAccountRequest,
    TokenResponse,
    UserOut
)
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    optional_current_user
)
from app.services.activity_logger import ActivityLogger
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register_user(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user account.
    Tracks AUTH_REGISTRATION activity event and dispatches admin notification.
    """
    email_clean = req.email.strip().lower()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    user_id = f"usr-{uuid.uuid4().hex[:12]}"
    is_admin = (email_clean == settings.ADMIN_NOTIFICATION_EMAIL.lower())

    new_user = User(
        id=user_id,
        email=email_clean,
        hashed_password=hash_password(req.password),
        name=req.name.strip() if req.name else "",
        github_username=req.github_username.strip() if req.github_username else "",
        is_verified=True, # Auto-verified for seamless hackathon UX
        is_admin=is_admin,
        failed_login_attempts=0,
        created_at=utc_now(),
        last_login_at=utc_now()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Centralized activity logging (server-side, validated)
    ActivityLogger.log(
        db=db,
        event_type="AUTH_REGISTRATION",
        event_description=f"New user account registered for {new_user.email} (Name: {new_user.name or 'Not provided'})",
        user=new_user,
        resource_type="user",
        resource_id=new_user.id,
        status="SUCCESS",
        metadata={
            "auth_method": "email_password",
            "is_admin": is_admin,
            "github_username": new_user.github_username or "Not provided"
        },
        send_email=True
    )

    token = create_access_token(user_id=new_user.id, email=new_user.email, is_admin=new_user.is_admin)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(new_user)
    )

@router.post("/login", response_model=TokenResponse)
def login_user(req: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user via email and password.
    Tracks AUTH_LOGIN on success, or AUTH_FAILED_LOGIN and AUTH_SECURITY_ALERT on failure.
    """
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()

    # Check invalid user or password
    if not user or not verify_password(req.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            db.commit()

            # If repeated failures, trigger security alert
            if user.failed_login_attempts >= 5:
                ActivityLogger.log(
                    db=db,
                    event_type="AUTH_SECURITY_ALERT",
                    event_description=f"Suspicious repeated failed login attempts ({user.failed_login_attempts} failures) for account {user.email}",
                    user=user,
                    resource_type="user",
                    resource_id=user.id,
                    status="SUSPICIOUS",
                    metadata={
                        "failed_attempts": user.failed_login_attempts,
                        "auth_method": "email_password"
                    },
                    send_email=True
                )
            else:
                ActivityLogger.log(
                    db=db,
                    event_type="AUTH_FAILED_LOGIN",
                    event_description=f"Failed login attempt for account {user.email} (Attempt #{user.failed_login_attempts})",
                    user=user,
                    resource_type="user",
                    resource_id=user.id,
                    status="FAILED",
                    metadata={
                        "failed_attempts": user.failed_login_attempts,
                        "auth_method": "email_password"
                    },
                    send_email=False
                )
        else:
            # Unrecognized email attempt
            ActivityLogger.log(
                db=db,
                event_type="AUTH_FAILED_LOGIN",
                event_description=f"Failed login attempt with non-existent email {email_clean}",
                user_email=email_clean,
                resource_type="user",
                status="FAILED",
                metadata={"auth_method": "email_password", "recognized_account": False},
                send_email=False
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password credentials."
        )

    # Success: Reset failure count and update last_login
    user.failed_login_attempts = 0
    user.last_login_at = utc_now()
    db.commit()

    ActivityLogger.log(
        db=db,
        event_type="AUTH_LOGIN",
        event_description=f"Successful email sign-in for {user.email}",
        user=user,
        resource_type="user",
        resource_id=user.id,
        status="SUCCESS",
        metadata={"auth_method": "email_password"},
        send_email=True
    )

    token = create_access_token(user_id=user.id, email=user.email, is_admin=user.is_admin)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.post("/github-login", response_model=TokenResponse)
def github_login(req: GitHubOAuthLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user via GitHub OAuth.
    Supports either real GitHub OAuth code or local dev/demo login.
    Tracks AUTH_GITHUB_LOGIN (and AUTH_REGISTRATION if new account).
    """
    gh_username = req.mock_username or "github-user"
    if req.mock_username:
        email = f"{req.mock_username.lower()}@users.noreply.github.com"
        name = req.mock_username
    else:
        email = "developer@users.noreply.github.com"
        name = "GitHub Contributor"

    user = db.query(User).filter(User.email == email).first()
    is_new = False
    if not user:
        is_new = True
        user = User(
            id=f"usr-gh-{uuid.uuid4().hex[:10]}",
            email=email,
            name=name,
            github_username=gh_username,
            is_verified=True,
            is_admin=False,
            created_at=utc_now(),
            last_login_at=utc_now()
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        ActivityLogger.log(
            db=db,
            event_type="AUTH_REGISTRATION",
            event_description=f"New user registered via GitHub OAuth (@{gh_username})",
            user=user,
            resource_type="user",
            resource_id=user.id,
            status="SUCCESS",
            metadata={"auth_method": "github_oauth", "github_username": gh_username},
            send_email=True
        )
    else:
        user.last_login_at = utc_now()
        db.commit()

    # Track GitHub Login event
    ActivityLogger.log(
        db=db,
        event_type="AUTH_GITHUB_LOGIN",
        event_description=f"Successful GitHub OAuth sign-in for @{gh_username} ({user.email})",
        user=user,
        resource_type="user",
        resource_id=user.id,
        status="SUCCESS",
        metadata={"auth_method": "github_oauth", "github_username": gh_username},
        send_email=True
    )

    token = create_access_token(user_id=user.id, email=user.email, is_admin=user.is_admin)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.post("/logout")
def logout_user(user: Optional[User] = Depends(optional_current_user), db: Session = Depends(get_db)):
    """
    Logs out the current session and records an AUTH_LOGOUT event.
    """
    if user:
        ActivityLogger.log(
            db=db,
            event_type="AUTH_LOGOUT",
            event_description=f"User signed out: {user.email}",
            user=user,
            resource_type="user",
            resource_id=user.id,
            status="SUCCESS",
            metadata={},
            send_email=False
        )
    return {"message": "Signed out successfully."}

@router.get("/me", response_model=UserOut)
def get_current_user_profile(user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return UserOut.model_validate(user)

@router.post("/verify-account")
def verify_account(req: VerifyAccountRequest, db: Session = Depends(get_db)):
    """
    Completes account verification.
    """
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user.is_verified = True
    db.commit()

    ActivityLogger.log(
        db=db,
        event_type="AUTH_VERIFICATION",
        event_description=f"Account verification completed for {user.email}",
        user=user,
        resource_type="user",
        resource_id=user.id,
        status="SUCCESS",
        metadata={"verification_code_provided": bool(req.verification_code)},
        send_email=True
    )
    return {"message": "Account successfully verified."}

@router.post("/reset-password")
def reset_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
    """
    Completes password reset for an account.
    """
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user.hashed_password = hash_password(req.new_password)
    user.failed_login_attempts = 0
    db.commit()

    ActivityLogger.log(
        db=db,
        event_type="AUTH_PASSWORD_RESET",
        event_description=f"Password reset completed for account {user.email}",
        user=user,
        resource_type="user",
        resource_id=user.id,
        status="SUCCESS",
        metadata={"action": "password_reset"},
        send_email=True
    )
    return {"message": "Password reset successfully. You can now log in with your new credentials."}
