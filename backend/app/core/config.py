import os
import sys
from pathlib import Path
from dotenv import load_dotenv, dotenv_values
from pydantic import BaseModel

# Resolve workspace directories
_CURRENT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CURRENT_DIR.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent

# Securely load .env from root first, then backend
_env_root = _ROOT_DIR / ".env"
_env_backend = _BACKEND_DIR / ".env"

is_testing = "PYTEST_CURRENT_TEST" in os.environ or "pytest" in sys.modules or any("pytest" in arg for arg in sys.argv)
override_env = not is_testing

if _env_root.is_file():
    load_dotenv(dotenv_path=_env_root, override=override_env)
if _env_backend.is_file():
    load_dotenv(dotenv_path=_env_backend, override=override_env)
if not _env_root.is_file() and not _env_backend.is_file():
    load_dotenv(override=override_env)

def get_live_env(key: str, default: str = "") -> str:
    """Reads the latest live environment variable value from process env or .env file."""
    if "PYTEST_CURRENT_TEST" in os.environ:
        return os.environ.get(key, "")
    # 1. Check process environment first
    val = os.environ.get(key)
    if val is not None and val.strip():
        return val.strip()
    # 2. Check root .env file on disk
    if _env_root.is_file():
        vals = dotenv_values(_env_root)
        if vals.get(key):
            return str(vals[key]).strip()
    # 3. Check backend .env file on disk
    if _env_backend.is_file():
        vals = dotenv_values(_env_backend)
        if vals.get(key):
            return str(vals[key]).strip()
    return default

def update_env_file(key: str, value: str):
    """Safely updates or appends a key-value pair in .env and os.environ."""
    os.environ[key] = value
    if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        return
    try:
        target_env = _env_root if _env_root.is_file() else (_BACKEND_DIR / ".env")
        lines = []
        found = False
        if target_env.is_file():
            with open(target_env, "r", encoding="utf-8") as f:
                lines = f.readlines()
            new_lines = []
            for line in lines:
                stripped = line.strip()
                if stripped.startswith(f"{key}=") or stripped == key:
                    new_lines.append(f"{key}={value}\n")
                    found = True
                else:
                    new_lines.append(line)
            if not found:
                new_lines.append(f"{key}={value}\n")
            with open(target_env, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        else:
            with open(target_env, "w", encoding="utf-8") as f:
                f.write(f"{key}={value}\n")
    except Exception:
        pass

def reload_env():
    """Reloads environment variables from .env if updated."""
    if "PYTEST_CURRENT_TEST" in os.environ:
        return
    if _env_root.is_file():
        load_dotenv(dotenv_path=_env_root, override=True)
    if _env_backend.is_file():
        load_dotenv(dotenv_path=_env_backend, override=True)
    if not _env_root.is_file() and not _env_backend.is_file():
        load_dotenv(override=True)

def is_filesystem_readonly() -> bool:
    """Detects whether running in a serverless or read-only filesystem environment."""
    if any(os.getenv(k) for k in ("VERCEL", "VERCEL_ENV", "NOW_REGION", "AWS_LAMBDA_FUNCTION_NAME", "LAMBDA_TASK_ROOT")):
        return True
    probe = Path("._write_probe.tmp")
    try:
        probe.touch()
        probe.unlink()
        return False
    except (OSError, PermissionError):
        return True

def get_database_url() -> str:
    """
    Returns a production-safe database URL.
    - Inspects DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, and related env vars.
    - Resolves PostgreSQL scheme compatibility (postgres:// -> postgresql://).
    - If in serverless or read-only filesystem without PostgreSQL, ensures SQLite path uses /tmp/trustmesh.db.
    - Automatically copies existing seeded database to /tmp if available.
    """
    raw_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PRISMA_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
        or ""
    ).strip()

    if not raw_url:
        raw_url = (
            get_live_env("DATABASE_URL")
            or get_live_env("POSTGRES_URL")
            or ""
        ).strip()

    # 1. PostgreSQL normalization for SQLAlchemy 2.0+
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql://", 1)
    if raw_url.startswith("postgresql://") or raw_url.startswith("mysql://"):
        return raw_url

    # 2. Serverless / Read-only environment handling (fallback if no remote DB configured)
    if is_filesystem_readonly() or (raw_url and "sqlite" in raw_url and "/tmp/" not in raw_url and is_filesystem_readonly()):
        tmp_db = Path("/tmp/trustmesh.db")
        # Attempt to copy pre-existing database from repository if available
        if not tmp_db.is_file():
            bundled_candidates = [
                _BACKEND_DIR / "trustmesh.db",
                _ROOT_DIR / "trustmesh.db",
                Path("trustmesh.db"),
            ]
            for candidate in bundled_candidates:
                if candidate.is_file():
                    try:
                        import shutil
                        shutil.copyfile(candidate, tmp_db)
                        break
                    except Exception:
                        pass
        return "sqlite:////tmp/trustmesh.db"

    # 3. Default local development SQLite
    if raw_url:
        return raw_url
    return "sqlite:///./trustmesh.db"

class Settings(BaseModel):
    PROJECT_NAME: str = "TrustMesh"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = get_database_url()

    # Open-Weight AI Model Settings (GPT-OSS-120B)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    AI_MODEL_NAME: str = os.getenv("AI_MODEL_NAME", "gpt-oss-120b")
    AI_API_BASE_URL: str = os.getenv("AI_API_BASE_URL", "https://openrouter.ai/api/v1")

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # GitHub Integration Settings
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_WEBHOOK_SECRET: str = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    GITHUB_API_BASE: str = os.getenv("GITHUB_API_BASE", "https://api.github.com")
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "") # Optional backend token for elevated rate limits

    # Admin Activity Monitoring & Email Settings
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "auto") # "auto" | "resend" | "smtp" | "database"
    EMAIL_AUTOMATION_ENABLED: bool = True
    ADMIN_NOTIFICATION_EMAIL: str = os.getenv("ADMIN_NOTIFICATION_EMAIL", os.getenv("ADMIN_EMAIL", "admin@trustmesh.network"))
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", os.getenv("ADMIN_NOTIFICATION_EMAIL", "admin@trustmesh.network"))
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "TrustMesh Alerts <onboarding@resend.dev>")
    
    # Gmail SMTP & Direct SMTP Settings (Works with Gmail App Passwords & Nodemailer)
    GMAIL_USER: str = os.getenv("GMAIL_USER", os.getenv("SMTP_USER", ""))
    GMAIL_APP_PASSWORD: str = os.getenv("GMAIL_APP_PASSWORD", os.getenv("SMTP_PASSWORD", ""))
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", os.getenv("GMAIL_USER", ""))
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", os.getenv("GMAIL_APP_PASSWORD", ""))
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1")

    ADMIN_SECRET_KEY: str = os.getenv("ADMIN_SECRET_KEY", "trustmesh_admin_secret_key_2026")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "trustmesh_jwt_secret_key_2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7 # 7 days

    @property
    def current_email_provider(self) -> str:
        return get_live_env("EMAIL_PROVIDER", self.EMAIL_PROVIDER).lower()

    @property
    def current_resend_api_key(self) -> str:
        return get_live_env("RESEND_API_KEY", self.RESEND_API_KEY)

    @property
    def current_gmail_user(self) -> str:
        if "PYTEST_CURRENT_TEST" in os.environ:
            return os.environ.get("GMAIL_USER", os.environ.get("SMTP_USER", ""))
        return get_live_env("GMAIL_USER", get_live_env("SMTP_USER", self.GMAIL_USER))

    @property
    def current_gmail_app_password(self) -> str:
        if "PYTEST_CURRENT_TEST" in os.environ:
            raw = os.environ.get("GMAIL_APP_PASSWORD", os.environ.get("SMTP_PASSWORD", ""))
            return raw.replace(" ", "").strip()
        # Strip all spaces from 16-character Google App Passwords automatically
        raw = get_live_env("GMAIL_APP_PASSWORD", get_live_env("SMTP_PASSWORD", self.GMAIL_APP_PASSWORD))
        return raw.replace(" ", "").strip()

    @property
    def current_admin_email(self) -> str:
        return get_live_env("ADMIN_EMAIL", get_live_env("ADMIN_NOTIFICATION_EMAIL", self.ADMIN_EMAIL or "admin@trustmesh.network"))

    @property
    def current_email_from(self) -> str:
        return get_live_env("EMAIL_FROM", f"TrustMesh Security Alerts <{self.current_gmail_user}>" if self.current_gmail_user else self.EMAIL_FROM)

    @property
    def current_smtp_host(self) -> str:
        return get_live_env("SMTP_HOST", self.SMTP_HOST or "smtp.gmail.com")

    @property
    def current_smtp_port(self) -> int:
        val = get_live_env("SMTP_PORT", str(self.SMTP_PORT or 587))
        try:
            return int(val)
        except ValueError:
            return 587

settings = Settings()
