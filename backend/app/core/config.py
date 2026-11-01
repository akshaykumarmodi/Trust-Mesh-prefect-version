import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel

# Resolve workspace directories
_CURRENT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CURRENT_DIR.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent

# Securely load .env from root first, then backend
_env_root = _ROOT_DIR / ".env"
_env_backend = _BACKEND_DIR / ".env"

if _env_root.is_file():
    load_dotenv(dotenv_path=_env_root, override=False)
elif _env_backend.is_file():
    load_dotenv(dotenv_path=_env_backend, override=False)
else:
    load_dotenv(override=False)

def reload_env():
    """Reloads environment variables from .env if updated."""
    if _env_root.is_file():
        load_dotenv(dotenv_path=_env_root, override=False)
    elif _env_backend.is_file():
        load_dotenv(dotenv_path=_env_backend, override=False)
    else:
        load_dotenv(override=False)

class Settings(BaseModel):
    PROJECT_NAME: str = "TrustMesh"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./trustmesh.db")

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

    # Admin Activity Monitoring & Resend Email Settings
    ADMIN_NOTIFICATION_EMAIL: str = os.getenv("ADMIN_NOTIFICATION_EMAIL", "akshay123modi@gmail.com")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    # Default to Resend's test sender (onboarding@resend.dev) unless verified custom domain configured
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "TrustMesh Alerts <onboarding@resend.dev>")
    ADMIN_SECRET_KEY: str = os.getenv("ADMIN_SECRET_KEY", "trustmesh_admin_secret_key_2026")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "trustmesh_jwt_secret_key_2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7 # 7 days

    @property
    def current_resend_api_key(self) -> str:
        return os.getenv("RESEND_API_KEY", self.RESEND_API_KEY).strip()

    @property
    def current_admin_email(self) -> str:
        return os.getenv("ADMIN_NOTIFICATION_EMAIL", self.ADMIN_NOTIFICATION_EMAIL).strip()

    @property
    def current_email_from(self) -> str:
        return os.getenv("EMAIL_FROM", self.EMAIL_FROM).strip()

settings = Settings()
