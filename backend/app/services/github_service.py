import re
import hmac
import hashlib
from datetime import datetime, timezone
from typing import Tuple, Dict, Any, List, Optional
import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import Project, Contributor, GitHubPullRequest, GitHubCredential

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # Handles 2026-10-31T12:00:00Z or similar
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)

class GitHubService:
    @staticmethod
    def parse_github_url(url: str) -> Tuple[str, str]:
        """
        Validates and parses a GitHub repository URL into (owner, repo).
        Accepts:
          - https://github.com/owner/repo
          - https://github.com/owner/repo.git
          - https://github.com/owner/repo/
        Rejects invalid domains, path structures, or malicious characters.
        """
        if not url or not isinstance(url, str):
            raise ValueError("Repository URL must be a non-empty string.")

        clean_url = url.strip()
        pattern = r"^https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(\/|\.git)?$"
        match = re.match(pattern, clean_url, re.IGNORECASE)
        if not match:
            raise ValueError(
                f"Invalid GitHub repository URL: '{url}'. Expected format: 'https://github.com/owner/repository'"
            )

        owner = match.group(2)
        repo = match.group(3)

        if repo.endswith(".git"):
            repo = repo[:-4]

        # Prevent reserved GitHub routes
        reserved = {"orgs", "users", "settings", "marketplace", "features", "topics", "collections"}
        if owner.lower() in reserved:
            raise ValueError(f"'{owner}' is a reserved GitHub namespace, not a valid repository owner.")

        return owner, repo

    @staticmethod
    def get_auth_token(db: Session = None) -> Optional[str]:
        """
        Retrieves active GitHub token from backend storage or settings.
        Never exposed to the frontend.
        """
        if db:
            cred = db.query(GitHubCredential).first()
            if cred and cred.encrypted_access_token:
                return cred.encrypted_access_token

        return settings.GITHUB_TOKEN or None

    @classmethod
    def get_request_headers(cls, token: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "TrustMesh-Decentralized-Trust-Engine/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    @classmethod
    def fetch_repo_metadata(
        cls, owner: str, repo: str, token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetches repository metadata from GitHub REST API v3.
        """
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}"
        headers = cls.get_request_headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers)

                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "owner": data.get("owner", {}).get("login", owner),
                        "name": data.get("name", repo),
                        "full_name": data.get("full_name", f"{owner}/{repo}"),
                        "description": data.get("description") or "",
                        "default_branch": data.get("default_branch") or "main",
                        "visibility": "private" if data.get("private") else "public",
                        "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
                        "stars": data.get("stargazers_count", 0),
                        "created_at": parse_iso_datetime(data.get("created_at")),
                        "updated_at": parse_iso_datetime(data.get("updated_at")),
                    }
                elif resp.status_code == 401:
                    raise RuntimeError("GitHub API authentication failed: invalid or expired GitHub token.")
                elif resp.status_code == 404:
                    raise ValueError(
                        f"GitHub repository '{owner}/{repo}' not found. Make sure the repository is public or authorize private access."
                    )
                elif resp.status_code in (403, 429):
                    rate_limit_msg = resp.headers.get("x-ratelimit-remaining", "0")
                    raise RuntimeError(
                        f"GitHub API rate limit reached (Remaining: {rate_limit_msg}). Try again later or configure backend token."
                    )
                else:
                    raise RuntimeError(
                        f"GitHub API returned error {resp.status_code}: {resp.text}"
                    )
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            raise RuntimeError(f"Network error connecting to GitHub API: {str(exc)}")

    @classmethod
    def fetch_pull_requests(
        cls,
        owner: str,
        repo: str,
        page: int = 1,
        per_page: int = 30,
        state: str = "all",
        token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetches actual pull requests for a repository from GitHub REST API.
        """
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/pulls"
        params = {
            "page": page,
            "per_page": min(per_page, 100),
            "state": state,
            "sort": "updated",
            "direction": "desc",
        }
        headers = cls.get_request_headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, params=params, headers=headers)

                if resp.status_code == 200:
                    pulls = resp.json()
                    results = []
                    for pr in pulls:
                        user = pr.get("user") or {}
                        merged_at = parse_iso_datetime(pr.get("merged_at"))
                        is_merged = bool(merged_at)
                        state_val = "merged" if is_merged else pr.get("state", "open")

                        review_status = "DRAFT" if pr.get("draft") else ("MERGED" if is_merged else ("CLOSED" if state_val == "closed" else "REVIEW_READY"))

                        results.append({
                            "pr_number": pr.get("number"),
                            "title": pr.get("title") or "Untitled Pull Request",
                            "description": pr.get("body") or "",
                            "author_username": user.get("login") or "ghost",
                            "author_avatar_url": user.get("avatar_url") or "",
                            "state": state_val,
                            "is_merged": is_merged,
                            "merged_at": merged_at,
                            "base_branch": pr.get("base", {}).get("ref") or "main",
                            "head_branch": pr.get("head", {}).get("ref") or "",
                            "html_url": pr.get("html_url") or f"https://github.com/{owner}/{repo}/pull/{pr.get('number')}",
                            "commit_count": pr.get("commits", 1),
                            "review_status": review_status,
                            "ci_status": "SUCCESS" if is_merged else "UNKNOWN",
                            "created_at": parse_iso_datetime(pr.get("created_at")),
                            "updated_at": parse_iso_datetime(pr.get("updated_at")),
                        })
                    return results
                elif resp.status_code == 401:
                    raise RuntimeError("GitHub API authentication failed: invalid or expired GitHub token.")
                elif resp.status_code == 404:
                    raise ValueError(f"Repository '{owner}/{repo}' not found on GitHub.")
                elif resp.status_code in (403, 429):
                    raise RuntimeError("GitHub API rate limit exceeded while fetching pull requests.")
                else:
                    raise RuntimeError(f"GitHub API error fetching PRs: {resp.status_code}")
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            raise RuntimeError(f"Failed to communicate with GitHub API: {str(exc)}")

    @classmethod
    def verify_pull_request(
        cls,
        owner: str,
        repo: str,
        pr_number: int,
        expected_url: Optional[str] = None,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Verification Service:
        Confirms repository existence, PR existence, owner/name match, PR number match, and canonical URL.
        Returns one of:
          - "Verified GitHub record"
          - "Unable to verify"
          - "Verification unavailable"
        """
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}"
        headers = cls.get_request_headers(token)
        now = datetime.now(timezone.utc)

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(url, headers=headers)

                if resp.status_code == 200:
                    pr_data = resp.json()
                    canonical_url = pr_data.get("html_url") or f"https://github.com/{owner}/{repo}/pull/{pr_number}"
                    base_repo = pr_data.get("base", {}).get("repo", {})
                    api_owner = base_repo.get("owner", {}).get("login", "").lower()
                    api_repo = base_repo.get("name", "").lower()
                    api_number = pr_data.get("number")

                    matches_repo = (api_owner == owner.lower() and api_repo == repo.lower())
                    matches_number = (api_number == pr_number)
                    matches_url = True
                    if expected_url:
                        clean_expected = expected_url.strip().rstrip("/")
                        clean_canonical = canonical_url.strip().rstrip("/")
                        matches_url = (clean_expected == clean_canonical)

                    if matches_repo and matches_number and matches_url:
                        return {
                            "pr_number": pr_number,
                            "canonical_url": canonical_url,
                            "verification_status": "Verified GitHub record",
                            "verification_details": (
                                f"Canonically verified via GitHub API (v3). Base repository '{owner}/{repo}', "
                                f"PR #{pr_number}, state '{pr_data.get('state')}' validated."
                            ),
                            "verified_at": now,
                            "repository_match": True,
                            "api_source": "GitHub REST API v3",
                        }
                    else:
                        return {
                            "pr_number": pr_number,
                            "canonical_url": canonical_url,
                            "verification_status": "Unable to verify",
                            "verification_details": (
                                f"Discrepancy detected: expected '{owner}/{repo}#{pr_number}', "
                                f"GitHub canonical report returned '{api_owner}/{api_repo}#{api_number}'."
                            ),
                            "verified_at": now,
                            "repository_match": False,
                            "api_source": "GitHub REST API v3",
                        }

                elif resp.status_code == 404:
                    return {
                        "pr_number": pr_number,
                        "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                        "verification_status": "Unable to verify",
                        "verification_details": f"PR #{pr_number} was not found in repository '{owner}/{repo}' via GitHub API.",
                        "verified_at": now,
                        "repository_match": False,
                        "api_source": "GitHub REST API v3",
                    }
                elif resp.status_code in (403, 429):
                    return {
                        "pr_number": pr_number,
                        "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                        "verification_status": "Verification unavailable",
                        "verification_details": "GitHub API rate limit exceeded. Verification deferred until rate reset.",
                        "verified_at": now,
                        "repository_match": False,
                        "api_source": "GitHub REST API v3",
                    }
                else:
                    return {
                        "pr_number": pr_number,
                        "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                        "verification_status": "Unable to verify",
                        "verification_details": f"GitHub API error code {resp.status_code}.",
                        "verified_at": now,
                        "repository_match": False,
                        "api_source": "GitHub REST API v3",
                    }

        except Exception as exc:
            return {
                "pr_number": pr_number,
                "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                "verification_status": "Verification unavailable",
                "verification_details": f"Network exception reaching GitHub: {str(exc)}",
                "verified_at": now,
                "repository_match": False,
                "api_source": "GitHub REST API v3",
            }

    @classmethod
    def find_project(cls, db: Session, identifier: str) -> Optional[Project]:
        """
        Flexibly resolves a project from various identifier forms:
        - Exact ID match (e.g. 'proj-gh-microsoftdocs-azure-docs' or 'proj-hyperflow')
        - Exact slug match (e.g. 'gh-microsoftdocs-azure-docs' or 'hyperflow-engine')
        - Exact name match (case-insensitive, e.g. 'MicrosoftDocs/azure-docs')
        - Slug/ID prefix variants (with or without 'proj-', 'gh-', 'proj-gh-')
        - GitHub repository URL match (e.g. 'https://github.com/MicrosoftDocs/azure-docs')
        - GitHub owner/repo combination
        """
        if not identifier or not isinstance(identifier, str):
            return None

        clean_id = identifier.strip()

        def _ensure_github_metadata(proj: Project) -> Project:
            if proj and (not proj.github_owner or not proj.github_repo) and proj.repo_url and "github.com" in proj.repo_url:
                try:
                    p_owner, p_repo = cls.parse_github_url(proj.repo_url)
                    proj.github_owner = p_owner
                    proj.github_repo = p_repo
                    proj.is_github_connected = True
                    db.commit()
                except Exception:
                    pass
            return proj

        # 1. Exact ID
        p = db.query(Project).filter(Project.id == clean_id).first()
        if p:
            return _ensure_github_metadata(p)

        # 2. Exact slug
        p = db.query(Project).filter(Project.slug == clean_id).first()
        if p:
            return _ensure_github_metadata(p)

        # 3. Exact name (case-insensitive)
        p = db.query(Project).filter(func.lower(Project.name) == clean_id.lower()).first()
        if p:
            return _ensure_github_metadata(p)

        # 4. Normalized slug / ID variations
        variants = set()
        if clean_id.startswith("proj-gh-"):
            core = clean_id[len("proj-gh-"):]
            variants.update([core, f"proj-{core}", f"gh-{core}"])
        elif clean_id.startswith("proj-"):
            core = clean_id[len("proj-"):]
            variants.update([core, f"proj-gh-{core}", f"gh-{core}"])
        elif clean_id.startswith("gh-"):
            core = clean_id[len("gh-"):]
            variants.update([core, f"proj-{core}", f"proj-gh-{core}"])
        else:
            variants.update([f"proj-{clean_id}", f"gh-{clean_id}", f"proj-gh-{clean_id}"])

        for v in variants:
            p = db.query(Project).filter((Project.id == v) | (Project.slug == v)).first()
            if p:
                return _ensure_github_metadata(p)

        # 5. Check by GitHub owner & repo or repo_url
        all_projects = db.query(Project).all()
        clean_lower = clean_id.lower()

        # If clean_id looks like a full URL
        if "github.com" in clean_lower:
            try:
                owner, repo = cls.parse_github_url(clean_id)
                for proj in all_projects:
                    if proj.github_owner and proj.github_repo:
                        if proj.github_owner.lower() == owner.lower() and proj.github_repo.lower() == repo.lower():
                            return _ensure_github_metadata(proj)
                    if proj.repo_url and f"{owner.lower()}/{repo.lower()}" in proj.repo_url.lower():
                        return _ensure_github_metadata(proj)
            except Exception:
                pass

        # If clean_id is 'owner/repo'
        if "/" in clean_id:
            parts = clean_id.split("/")
            if len(parts) == 2:
                owner, repo = parts[0].strip().lower(), parts[1].strip().lower()
                for proj in all_projects:
                    if proj.github_owner and proj.github_repo:
                        if proj.github_owner.lower() == owner and proj.github_repo.lower() == repo:
                            return _ensure_github_metadata(proj)
                    if proj.repo_url and f"{owner}/{repo}" in proj.repo_url.lower():
                        return _ensure_github_metadata(proj)

        # Check existing projects whose owner-repo combination matches clean_lower
        for proj in all_projects:
            if proj.github_owner and proj.github_repo:
                comb1 = f"{proj.github_owner.lower()}-{proj.github_repo.lower()}"
                comb2 = f"proj-gh-{comb1}"
                comb3 = f"gh-{comb1}"
                comb4 = f"proj-{comb1}"
                if clean_lower in (comb1, comb2, comb3, comb4):
                    return _ensure_github_metadata(proj)

        return None

    @classmethod
    def auto_register_github_project(cls, db: Session, identifier: str) -> Optional[Project]:
        """
        Attempts to automatically register a GitHub repository if an unregistered identifier is passed.
        Candidate formats:
          - 'https://github.com/owner/repo'
          - 'owner/repo'
          - 'proj-gh-owner-repo' or 'gh-owner-repo'
        Safely queries GitHub API to confirm repository existence before importing.
        """
        token = cls.get_auth_token(db)
        candidates: List[Tuple[str, str]] = []

        clean = identifier.strip()

        # Case 1: GitHub URL
        if "github.com" in clean:
            try:
                owner, repo = cls.parse_github_url(clean)
                candidates.append((owner, repo))
            except Exception:
                pass

        # Case 2: owner/repo
        elif "/" in clean and not clean.startswith("http"):
            parts = clean.split("/")
            if len(parts) == 2 and parts[0] and parts[1]:
                candidates.append((parts[0].strip(), parts[1].strip()))

        # Case 3: proj-gh-... or gh-...
        elif clean.startswith("proj-gh-") or clean.startswith("gh-"):
            core = clean.removeprefix("proj-gh-").removeprefix("gh-")
            tokens = core.split("-")
            for i in range(1, len(tokens)):
                cand_owner = "-".join(tokens[:i])
                cand_repo = "-".join(tokens[i:])
                candidates.append((cand_owner, cand_repo))

        # Test each candidate against GitHub API
        for cand_owner, cand_repo in candidates:
            try:
                meta = cls.fetch_repo_metadata(cand_owner, cand_repo, token=token)
                if meta and meta.get("html_url"):
                    # Confirm that candidate matched the repository name on GitHub
                    returned_owner = meta.get("owner", "").lower()
                    returned_repo = meta.get("name", "").lower()
                    if returned_owner != cand_owner.lower() or returned_repo != cand_repo.lower():
                        continue
                    # Check again if it exists by canonical URL
                    existing = cls.find_project(db, meta["html_url"])
                    if existing:
                        return existing
                    # Import repository safely without extra redundant metadata fetch
                    proj, _ = cls.import_repository(
                        db,
                        repo_url=meta["html_url"],
                        category="Infrastructure",
                        prefetched_meta=meta
                    )
                    return proj
            except Exception:
                continue

        return None

    @classmethod
    def import_repository(
        cls,
        db: Session,
        repo_url: str,
        category: str = "Infrastructure",
        custom_policy: Optional[Dict[str, Any]] = None,
        prefetched_meta: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Project, int]:
        """
        Imports public GitHub repository into TrustMesh.
        Retrieves metadata, creates or connects Project, and triggers initial PR sync.
        Prevents duplicate imports.
        """
        owner, repo = cls.parse_github_url(repo_url)
        token = cls.get_auth_token(db)
        meta = prefetched_meta or cls.fetch_repo_metadata(owner, repo, token=token)

        slug = f"gh-{owner.lower()}-{repo.lower()}"
        canonical_url = meta["html_url"]
        proj_id = f"proj-gh-{owner.lower()}-{repo.lower()}"

        existing = (
            cls.find_project(db, canonical_url)
            or cls.find_project(db, proj_id)
            or cls.find_project(db, slug)
        )

        now = datetime.now(timezone.utc)

        if existing:
            existing.is_github_connected = True
            existing.github_owner = meta["owner"]
            existing.github_repo = meta["name"]
            existing.default_branch = meta["default_branch"]
            existing.visibility = meta["visibility"]
            existing.stars = meta["stars"]
            existing.github_created_at = meta["created_at"]
            existing.github_updated_at = meta["updated_at"]
            existing.sync_status = "SYNCING"
            if custom_policy:
                existing.trust_policy = custom_policy
            db.commit()
            db.refresh(existing)
            project = existing
        else:
            proj_id = f"proj-gh-{owner.lower()}-{repo.lower()}"
            default_policy = custom_policy or {
                "strictness": "balanced",
                "min_confidence": 0.60,
                "peer_weights": {},
            }
            project = Project(
                id=proj_id,
                name=f"{meta['owner']}/{meta['name']}",
                slug=slug,
                description=meta["description"] or f"GitHub repository {meta['full_name']}",
                repo_url=canonical_url,
                category=category or "Infrastructure",
                stars=meta["stars"],
                is_github_connected=True,
                github_owner=meta["owner"],
                github_repo=meta["name"],
                default_branch=meta["default_branch"],
                visibility=meta["visibility"],
                github_created_at=meta["created_at"],
                github_updated_at=meta["updated_at"],
                sync_status="SYNCING",
                created_at=now,
            )
            project.trust_policy = default_policy
            db.add(project)
            db.commit()
            db.refresh(project)

        synced_count = 0
        try:
            sync_res = cls.sync_pull_requests(db, project.id, limit=30)
            synced_count = sync_res.get("synced_pull_requests", 0)
        except Exception as err:
            project.sync_status = "ERROR"
            project.sync_error = str(err)
            db.commit()

        return project, synced_count

    @classmethod
    def sync_pull_requests(
        cls, db: Session, project_id: str, limit: int = 30
    ) -> Dict[str, Any]:
        """
        Fetches and updates PR records in SQLite for a connected project.
        Prevents duplicates, verifies authenticity, and links contributor profiles.
        Supports flexible lookup by ID, slug, prefix variants, or GitHub owner/repo.
        """
        project = cls.find_project(db, project_id)
        if not project:
            project = cls.auto_register_github_project(db, project_id)

        if not project:
            raise ValueError(
                f"Project '{project_id}' is not registered in TrustMesh. "
                f"Please use 'Import GitHub Repo' with the repository URL (e.g. https://github.com/owner/repository) to register it."
            )

        if not project.github_owner or not project.github_repo:
            if project.repo_url:
                try:
                    owner, repo = cls.parse_github_url(project.repo_url)
                    project.github_owner = owner
                    project.github_repo = repo
                    project.is_github_connected = True
                    db.commit()
                except Exception:
                    pass

        if not project.github_owner or not project.github_repo:
            raise ValueError(
                f"Project '{project.name}' is not configured with a valid GitHub repository URL. "
                f"Please configure a valid GitHub URL (e.g. https://github.com/owner/repository) in project settings."
            )

        token = cls.get_auth_token(db)
        pulls = cls.fetch_pull_requests(
            project.github_owner, project.github_repo, page=1, per_page=limit, token=token
        )

        synced_count = 0
        now = datetime.now(timezone.utc)
        synced_contributors: Dict[str, Contributor] = {}

        for p in pulls:
            pr_num = p["pr_number"]
            record_id = f"ghpr-{project.id}-{pr_num}"

            existing_pr = db.query(GitHubPullRequest).filter(
                GitHubPullRequest.id == record_id
            ).first()

            if existing_pr:
                existing_pr.title = p["title"]
                existing_pr.description = p["description"]
                existing_pr.state = p["state"]
                existing_pr.is_merged = p["is_merged"]
                existing_pr.merged_at = p["merged_at"]
                existing_pr.base_branch = p["base_branch"]
                existing_pr.head_branch = p["head_branch"]
                existing_pr.commit_count = p["commit_count"]
                existing_pr.review_status = p["review_status"]
                existing_pr.ci_status = p["ci_status"]
                existing_pr.updated_at = p["updated_at"] or now
                existing_pr.verified_at = now
            else:
                new_pr = GitHubPullRequest(
                    id=record_id,
                    project_id=project.id,
                    pr_number=pr_num,
                    title=p["title"],
                    description=p["description"],
                    author_username=p["author_username"],
                    author_avatar_url=p["author_avatar_url"],
                    state=p["state"],
                    is_merged=p["is_merged"],
                    merged_at=p["merged_at"],
                    base_branch=p["base_branch"],
                    head_branch=p["head_branch"],
                    html_url=p["html_url"],
                    commit_count=p["commit_count"],
                    review_status=p["review_status"],
                    ci_status=p["ci_status"],
                    verification_status="Verified GitHub record",
                    verification_details="Retrieved and verified directly from GitHub REST API v3.",
                    verified_at=now,
                    is_synthetic=False,
                    created_at=p["created_at"] or now,
                    updated_at=p["updated_at"] or now,
                )
                db.add(new_pr)

            author_uname = p["author_username"]
            if author_uname and author_uname != "ghost":
                author_key = author_uname.lower()
                contrib = synced_contributors.get(author_key)
                if not contrib:
                    contrib = (
                        db.query(Contributor)
                        .filter(
                            (Contributor.id == f"contrib-gh-{author_key}")
                            | (Contributor.username == author_uname)
                        )
                        .first()
                    )
                if not contrib:
                    new_contrib = Contributor(
                        id=f"contrib-gh-{author_key}",
                        username=author_uname,
                        display_name=author_uname,
                        avatar_url=p["author_avatar_url"],
                        github_url=f"https://github.com/{author_uname}",
                        bio=f"Open-source contributor to {project.name}.",
                        reputation_state="NEWCOMER",  # Principle #1: Newcomers start with neutral baseline!
                        total_contributions=1,
                        first_seen_at=p["created_at"] or now,
                        created_at=now,
                    )
                    db.add(new_contrib)
                    db.flush()
                    synced_contributors[author_key] = new_contrib
                else:
                    contrib.total_contributions = (contrib.total_contributions or 0) + 1
                    synced_contributors[author_key] = contrib

            synced_count += 1

        project.last_synced_at = now
        project.sync_status = "SUCCESS"
        project.sync_error = ""
        db.commit()

        return {
            "project_id": project.id,
            "project_name": project.name,
            "synced_pull_requests": synced_count,
            "status": "SUCCESS",
            "message": f"Successfully synchronized {synced_count} pull requests from {project.github_owner}/{project.github_repo}.",
            "last_synced_at": now,
        }

    @staticmethod
    def verify_webhook_signature(payload_bytes: bytes, signature_header: Optional[str], secret: str) -> bool:
        """
        Validates GitHub webhook HMAC-SHA256 signature from 'X-Hub-Signature-256'.
        """
        if not signature_header or not secret:
            return False

        if not signature_header.startswith("sha256="):
            return False

        expected_sig = signature_header[7:]
        computed = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, computed)
