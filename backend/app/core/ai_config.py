import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Setup logger for safe, credential-free telemetry
logger = logging.getLogger("trustmesh.ai.config")

# Resolve workspace directory and load environment variables safely
_CURRENT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CURRENT_DIR.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent

_env_root = _ROOT_DIR / ".env"
_env_backend = _BACKEND_DIR / ".env"

if _env_root.is_file():
    load_dotenv(dotenv_path=_env_root, override=False)
elif _env_backend.is_file():
    load_dotenv(dotenv_path=_env_backend, override=False)
else:
    load_dotenv(override=False)

# Verified Groq model catalog
SUPPORTED_GROQ_MODELS = {
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
}

class AISettings(BaseModel):
    """
    Centralized, provider-independent configuration for TrustMesh AI services.
    Enforces strict backend isolation for secrets and safe logging.
    """
    AI_ENABLED: bool = Field(default=True)
    AI_PROVIDER: str = Field(default="groq")
    AI_MODEL_NAME: str = Field(default="llama-3.3-70b-versatile")
    AI_API_BASE_URL: str = Field(default="https://api.groq.com/openai/v1")
    GROQ_API_KEY: str = Field(default="")
    AI_TEMPERATURE: float = Field(default=0.2)
    AI_MAX_TOKENS: int = Field(default=2048)
    AI_REQUEST_TIMEOUT_SECONDS: float = Field(default=10.0)

    @classmethod
    def load_from_env(cls) -> "AISettings":
        enabled_str = os.getenv("AI_ENABLED", "true").lower()
        ai_enabled = enabled_str not in {"false", "0", "no", "off"}

        provider = os.getenv("AI_PROVIDER", "groq").strip().lower()
        model_name = os.getenv("AI_MODEL_NAME", "llama-3.3-70b-versatile").strip()
        base_url = os.getenv("AI_API_BASE_URL", "https://api.groq.com/openai/v1").strip().rstrip("/")
        api_key = os.getenv("GROQ_API_KEY", "").strip()

        try:
            temperature = float(os.getenv("AI_TEMPERATURE", "0.2"))
        except ValueError:
            temperature = 0.2

        try:
            max_tokens = int(os.getenv("AI_MAX_TOKENS", "2048"))
        except ValueError:
            max_tokens = 2048

        settings = cls(
            AI_ENABLED=ai_enabled,
            AI_PROVIDER=provider,
            AI_MODEL_NAME=model_name,
            AI_API_BASE_URL=base_url,
            GROQ_API_KEY=api_key,
            AI_TEMPERATURE=temperature,
            AI_MAX_TOKENS=max_tokens
        )
        settings.verify_model()
        return settings

    def verify_model(self) -> bool:
        """
        Verifies configured model against provider catalog.
        Never silently substitutes another model.
        """
        if self.AI_PROVIDER == "groq":
            if self.AI_MODEL_NAME not in SUPPORTED_GROQ_MODELS:
                logger.warning(
                    f"[TrustMesh AI] Configured model '{self.AI_MODEL_NAME}' is not in known Groq catalog. "
                    "Proceeding with user-configured model ID without silent substitution."
                )
                return False
        return True

    @property
    def masked_api_key(self) -> str:
        """Safe masked display of API key to prevent secret leakage in logs/telemetry."""
        if not self.GROQ_API_KEY:
            return "[NOT_CONFIGURED]"
        if len(self.GROQ_API_KEY) <= 8:
            return "gsk_****"
        return f"{self.GROQ_API_KEY[:4]}...{self.GROQ_API_KEY[-4:]}"

ai_settings = AISettings.load_from_env()
