import urllib.parse
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import HTMLResponse
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import Project, GitHubPullRequest, GitHubCredential, Contributor, User
from app.schemas import (
    GitHubRepoImportRequest,
    GitHubPullRequestOut,
    GitHubSyncResponse,
    GitHubAuthStatusOut,
    GitHubPRVerifyRequest,
    GitHubPRVerifyResponse,
    ProjectOut
)
from app.services.github_service import GitHubService
from app.services.activity_logger import ActivityLogger
from app.services.auth_service import optional_current_user

router = APIRouter(prefix="/github", tags=["github"])

@router.get("/status", response_model=GitHubAuthStatusOut)
def get_github_status(db: Session = Depends(get_db)):
    """
    Checks the status of the GitHub integration, OAuth credentials, and rate limits.
    """
    client_id_configured = bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET)
    cred = db.query(GitHubCredential).first()
    has_token = bool(cred and cred.encrypted_access_token) or bool(settings.GITHUB_TOKEN)

    rate_remaining = None
    rate_limit = None
    rate_reset = None

    token = GitHubService.get_auth_token(db)
    headers = GitHubService.get_request_headers(token)
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(f"{settings.GITHUB_API_BASE}/rate_limit", headers=headers)
            if resp.status_code == 200:
                core = resp.json().get("resources", {}).get("core", {})
                rate_remaining = core.get("remaining")
                rate_limit = core.get("limit")
                reset_ts = core.get("reset")
                if reset_ts:
                    rate_reset = datetime.fromtimestamp(reset_ts, tz=timezone.utc).isoformat()
    except Exception:
        pass

    return GitHubAuthStatusOut(
        is_configured=True,
        client_id_configured=client_id_configured,
        is_authenticated=has_token,
        authenticated_user=None,
        rate_limit_remaining=rate_remaining,
        rate_limit_limit=rate_limit,
        rate_limit_reset=rate_reset,
    )

@router.get("/oauth/authorize")
def get_oauth_authorize_url():
    """
    Generates OAuth authorization URL for GitHub user authorization.
    """
    if not settings.GITHUB_CLIENT_ID:
        return {
            "configured": False,
            "authorization_url": None,
            "message": "GitHub OAuth client ID is not configured. Public repository URL imports are active and fully supported without OAuth."
        }

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "scope": "repo,read:user",
        "state": "trustmesh_oauth_state"
    }
    auth_url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    return {
        "configured": True,
        "authorization_url": auth_url,
        "message": "Redirect user to authorization_url for GitHub authorization."
    }

@router.get("/oauth/callback", response_class=HTMLResponse)
def oauth_callback(code: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Receives OAuth callback from GitHub and exchanges code for access token.
    Stores access token securely on the backend in SQLite.
    """
    if error or not code:
        return HTMLResponse(
            content=f"<html><body><h3>GitHub Authorization Failed</h3><p>{error or 'Missing authorization code'}</p><script>window.close();</script></body></html>",
            status_code=400
        )

    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        return HTMLResponse(
            content="<html><body><h3>OAuth Configuration Error</h3><p>Client ID or Secret not configured on backend.</p></body></html>",
            status_code=500
        )

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                }
            )
            token_data = resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise ValueError(token_data.get("error_description", "Failed to retrieve access token"))

            # Store credentials securely on backend
            cred = db.query(GitHubCredential).filter(GitHubCredential.id == "default").first()
            if not cred:
                cred = GitHubCredential(
                    id="default",
                    encrypted_access_token=access_token,
                    token_type=token_data.get("token_type", "bearer"),
                    scope=token_data.get("scope", ""),
                )
                db.add(cred)
            else:
                cred.encrypted_access_token = access_token
                cred.scope = token_data.get("scope", "")
            db.commit()

            ActivityLogger.log(
                db=db,
                event_type="GITHUB_CONNECTED",
                event_description="GitHub OAuth authorization granted and credentials securely saved",
                resource_type="integration",
                resource_id="github-oauth",
                status="SUCCESS",
                metadata={"scope": cred.scope}
            )

            return HTMLResponse(
                content="""
                <html>
                  <body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; height:100vh;">
                    <div style="text-align:center; padding:2rem; border:1px solid #334155; border-radius:1rem; background:#1e293b;">
                      <h2 style="color:#10b981;">GitHub Connected Successfully</h2>
                      <p style="color:#94a3b8;">Credentials securely saved. You can close this window.</p>
                      <script>
                        if (window.opener) {
                          window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, '*');
                        }
                        setTimeout(() => window.close(), 2000);
                      </script>
                    </div>
                  </body>
                </html>
                """
            )
    except Exception as exc:
        return HTMLResponse(
            content=f"<html><body><h3>Error saving credentials</h3><p>{str(exc)}</p></body></html>",
            status_code=500
        )

@router.post("/disconnect")
def disconnect_github(
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnects stored GitHub OAuth credentials.
    """
    cred = db.query(GitHubCredential).filter(GitHubCredential.id == "default").first()
    if cred:
        db.delete(cred)
        db.commit()

    ActivityLogger.log(
        db=db,
        event_type="GITHUB_DISCONNECTED",
        event_description="GitHub authorization disconnected and stored credentials removed",
        user=user,
        resource_type="integration",
        resource_id="github-oauth",
        status="SUCCESS"
    )
    return {"message": "GitHub disconnected successfully."}

@router.post("/import-repo", response_model=ProjectOut)
def import_github_repository(
    req: GitHubRepoImportRequest,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Imports a public GitHub repository using its URL (e.g., https://github.com/owner/repository).
    Validates URL, fetches metadata, saves to database, and syncs initial PRs.
    """
    try:
        project, synced_count = GitHubService.import_repository(
            db=db,
            repo_url=req.repo_url,
            category=req.category or "Infrastructure",
            custom_policy=req.custom_policy
        )

        imported_by_name = user.name if user and user.name else "Not provided"
        imported_by_email = user.email if user else "Not provided"

        ActivityLogger.log(
            db=db,
            event_type="GITHUB_REPO_IMPORTED",
            event_description=f"Public repository {project.github_owner}/{project.github_repo} imported ({synced_count} pull requests synced)",
            user=user,
            resource_type="project",
            resource_id=project.id,
            project_name=project.name,
            status="SUCCESS",
            metadata={
                "github_owner": project.github_owner,
                "github_repo": project.github_repo,
                "repo_url": project.repo_url,
                "default_branch": project.default_branch,
                "visibility": project.visibility,
                "synced_pull_requests": synced_count,
                "category": project.category,
                "imported_by_name": imported_by_name,
                "imported_by_email": imported_by_email
            }
        )

        return ProjectOut(
            id=project.id,
            name=project.name,
            slug=project.slug,
            description=project.description or "",
            repo_url=project.repo_url or "",
            category=project.category,
            stars=project.stars,
            trust_policy=project.trust_policy,
            is_github_connected=project.is_github_connected,
            github_owner=project.github_owner,
            github_repo=project.github_repo,
            default_branch=project.default_branch,
            visibility=project.visibility,
            github_created_at=project.github_created_at,
            github_updated_at=project.github_updated_at,
            last_synced_at=project.last_synced_at,
            sync_status=project.sync_status,
            sync_error=project.sync_error,
            created_at=project.created_at,
            updated_at=project.updated_at
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.get("/projects/{project_id}/pulls", response_model=List[GitHubPullRequestOut])
def get_project_pull_requests(
    project_id: str,
    state: Optional[str] = "all",
    verification_status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Retrieves stored GitHub PR records for a project, with verification badges and commit counts.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(GitHubPullRequest).filter(GitHubPullRequest.project_id == project_id)
    if state and state != "all":
        query = query.filter(GitHubPullRequest.state == state)
    if verification_status:
        query = query.filter(GitHubPullRequest.verification_status == verification_status)

    pulls = query.order_by(GitHubPullRequest.updated_at.desc()).limit(limit).all()
    return pulls

@router.post("/projects/{project_id}/sync", response_model=GitHubSyncResponse)
def sync_project_pull_requests(
    project_id: str,
    limit: int = 30,
    user: Optional[User] = Depends(optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually triggers pull request synchronization from GitHub for a connected project.
    """
    try:
        res = GitHubService.sync_pull_requests(db, project_id, limit=limit)

        ActivityLogger.log(
            db=db,
            event_type="GITHUB_REPO_SYNCED",
            event_description=f"Synchronized {res['synced_pull_requests']} pull requests from GitHub for {res['project_name']}",
            user=user,
            resource_type="project",
            resource_id=project_id,
            project_name=res["project_name"],
            status="SUCCESS",
            metadata={"synced_pull_requests": res["synced_pull_requests"]}
        )

        return GitHubSyncResponse(
            project_id=res["project_id"],
            project_name=res["project_name"],
            synced_pull_requests=res["synced_pull_requests"],
            status=res["status"],
            message=res["message"],
            last_synced_at=res["last_synced_at"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        ActivityLogger.log(
            db=db,
            event_type="GITHUB_SYNC_FAILED",
            event_description=f"GitHub repository synchronization failed for project {project_id}: {str(exc)}",
            user=user,
            resource_type="project",
            resource_id=project_id,
            status="FAILED",
            metadata={"error": str(exc)}
        )
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/verify-pr", response_model=GitHubPRVerifyResponse)
def verify_pull_request_authenticity(req: GitHubPRVerifyRequest, db: Session = Depends(get_db)):
    """
    Verifies a PR's canonical authenticity against the live GitHub REST API.
    Confirms repo existence, PR existence, owner match, and canonical URL.
    Updates the record in SQLite if present.
    """
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Connected project not found")

    if not project.github_owner or not project.github_repo:
        try:
            owner, repo = GitHubService.parse_github_url(project.repo_url)
            project.github_owner = owner
            project.github_repo = repo
            db.commit()
        except Exception:
            raise HTTPException(status_code=400, detail="Project has invalid GitHub repository URL")

    token = GitHubService.get_auth_token(db)
    result = GitHubService.verify_pull_request(
        owner=project.github_owner,
        repo=project.github_repo,
        pr_number=req.pr_number,
        expected_url=req.canonical_url,
        token=token
    )

    # If PR record exists in database, update verification fields
    record_id = f"ghpr-{project.id}-{req.pr_number}"
    db_pr = db.query(GitHubPullRequest).filter(GitHubPullRequest.id == record_id).first()
    if db_pr:
        db_pr.verification_status = result["verification_status"]
        db_pr.verification_details = result["verification_details"]
        db_pr.verified_at = result["verified_at"]
        db.commit()

    return GitHubPRVerifyResponse(
        pr_number=result["pr_number"],
        canonical_url=result["canonical_url"],
        verification_status=result["verification_status"],
        verification_details=result["verification_details"],
        verified_at=result["verified_at"],
        repository_match=result["repository_match"],
        api_source=result["api_source"]
    )

@router.post("/webhook")
async def github_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    x_github_event: Optional[str] = Header("ping"),
    db: Session = Depends(get_db)
):
    """
    Accepts real-time GitHub webhook notifications.
    Validates HMAC-SHA256 signature against settings.GITHUB_WEBHOOK_SECRET.
    """
    payload_bytes = await request.body()

    # Verify signature if webhook secret is configured
    if settings.GITHUB_WEBHOOK_SECRET:
        if not GitHubService.verify_webhook_signature(
            payload_bytes, x_hub_signature_256, settings.GITHUB_WEBHOOK_SECRET
        ):
            raise HTTPException(status_code=401, detail="Invalid HMAC webhook signature")

    try:
        event_json = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "non-json payload"}

    if x_github_event == "ping":
        return {"status": "pong", "zen": event_json.get("zen", "")}

    if x_github_event == "pull_request":
        repo_data = event_json.get("repository", {})
        repo_owner = repo_data.get("owner", {}).get("login")
        repo_name = repo_data.get("name")
        pr_data = event_json.get("pull_request", {})

        if repo_owner and repo_name and pr_data:
            # Find matching project
            project = db.query(Project).filter(
                (Project.github_owner == repo_owner) & (Project.github_repo == repo_name)
            ).first()

            if project:
                pr_num = pr_data.get("number")
                record_id = f"ghpr-{project.id}-{pr_num}"
                merged_at = pr_data.get("merged_at")
                is_merged = bool(merged_at)
                state = "merged" if is_merged else pr_data.get("state", "open")
                user = pr_data.get("user", {})

                existing = db.query(GitHubPullRequest).filter(GitHubPullRequest.id == record_id).first()
                now = datetime.now(timezone.utc)
                if existing:
                    existing.title = pr_data.get("title")
                    existing.description = pr_data.get("body") or ""
                    existing.state = state
                    existing.is_merged = is_merged
                    existing.updated_at = now
                else:
                    new_pr = GitHubPullRequest(
                        id=record_id,
                        project_id=project.id,
                        pr_number=pr_num,
                        title=pr_data.get("title") or "Untitled",
                        description=pr_data.get("body") or "",
                        author_username=user.get("login") or "ghost",
                        author_avatar_url=user.get("avatar_url") or "",
                        state=state,
                        is_merged=is_merged,
                        html_url=pr_data.get("html_url") or "",
                        verification_status="Verified GitHub record",
                        verification_details="Received directly via signed GitHub Webhook delivery.",
                        verified_at=now,
                        created_at=now,
                        updated_at=now
                    )
                    db.add(new_pr)
                db.commit()
                return {"status": "processed", "pr_number": pr_num, "action": event_json.get("action")}

    return {"status": "received", "event": x_github_event}
