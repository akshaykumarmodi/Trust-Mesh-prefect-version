import logging
from typing import Optional, Dict, Any

from app.core.ai_config import AISettings, ai_settings
from app.services.ai_provider import (
    BaseAIProvider,
    GroqProvider,
    DeterministicFallbackProvider,
    AIProviderError
)
from app.schemas.ai import (
    VouchAnalysisRequest,
    VouchAnalysisResponse,
    DenouncementAnalysisRequest,
    DenouncementAnalysisResponse,
    CampaignAnalysisRequest,
    CampaignAnalysisResponse,
    ContributorSummaryRequest,
    ContributorSummaryResponse,
    ExplainDecisionRequest,
    ExplainDecisionResponse
)

logger = logging.getLogger("trustmesh.ai.service")

class TrustMeshAIService:
    """
    High-level orchestration service for TrustMesh AI features.
    Enforces input constraints, dispatches to GroqProvider, and gracefully degrades
    to DeterministicFallbackProvider upon error or when AI is disabled.
    """

    def __init__(self, settings: Optional[AISettings] = None, provider: Optional[BaseAIProvider] = None):
        self.settings = settings or ai_settings
        self._custom_provider = provider

    def _get_provider(self) -> BaseAIProvider:
        if self._custom_provider:
            return self._custom_provider

        # If AI is explicitly disabled or no API key is provided, use fallback immediately
        if not self.settings.AI_ENABLED:
            return DeterministicFallbackProvider(reason="AI is explicitly disabled in configuration (AI_ENABLED=false)")

        if not self.settings.GROQ_API_KEY:
            return DeterministicFallbackProvider(reason="GROQ_API_KEY is not configured or empty; using deterministic rules")

        return GroqProvider(settings=self.settings)

    def analyze_vouch(self, req: VouchAnalysisRequest) -> VouchAnalysisResponse:
        provider = self._get_provider()
        try:
            return provider.analyze_vouch(req)
        except AIProviderError as e:
            logger.warning(f"[TrustMesh AI] Vouch analysis inference error: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Groq inference failed ({type(e).__name__}); degraded to deterministic rules")
            return fallback.analyze_vouch(req)
        except Exception as e:
            logger.error(f"[TrustMesh AI] Unexpected error during vouch analysis: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Unexpected error ({type(e).__name__}); degraded to deterministic rules")
            return fallback.analyze_vouch(req)

    def analyze_denouncement(self, req: DenouncementAnalysisRequest) -> DenouncementAnalysisResponse:
        provider = self._get_provider()
        try:
            return provider.analyze_denouncement(req)
        except AIProviderError as e:
            logger.warning(f"[TrustMesh AI] Denouncement analysis inference error: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Groq inference failed ({type(e).__name__}); degraded to deterministic rules")
            return fallback.analyze_denouncement(req)
        except Exception as e:
            logger.error(f"[TrustMesh AI] Unexpected error during denouncement analysis: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Unexpected error ({type(e).__name__}); degraded to deterministic rules")
            return fallback.analyze_denouncement(req)

    def analyze_campaign(self, req: CampaignAnalysisRequest) -> CampaignAnalysisResponse:
        provider = self._get_provider()
        try:
            return provider.analyze_campaign(req)
        except AIProviderError as e:
            logger.warning(f"[TrustMesh AI] Campaign analysis inference error: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Groq inference failed ({type(e).__name__}); degraded to deterministic rules")
            return fallback.analyze_campaign(req)
        except Exception as e:
            logger.error(f"[TrustMesh AI] Unexpected error during campaign analysis: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Unexpected error ({type(e).__name__}); degraded to deterministic rules")
            return fallback.analyze_campaign(req)

    def summarize_contributor(self, req: ContributorSummaryRequest) -> ContributorSummaryResponse:
        provider = self._get_provider()
        try:
            return provider.summarize_contributor(req)
        except AIProviderError as e:
            logger.warning(f"[TrustMesh AI] Contributor summary inference error: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Groq inference failed ({type(e).__name__}); degraded to deterministic rules")
            return fallback.summarize_contributor(req)
        except Exception as e:
            logger.error(f"[TrustMesh AI] Unexpected error during contributor summary: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Unexpected error ({type(e).__name__}); degraded to deterministic rules")
            return fallback.summarize_contributor(req)

    def explain_decision(self, req: ExplainDecisionRequest) -> ExplainDecisionResponse:
        provider = self._get_provider()
        try:
            return provider.explain_decision(req)
        except AIProviderError as e:
            logger.warning(f"[TrustMesh AI] Explain decision inference error: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Groq inference failed ({type(e).__name__}); degraded to deterministic rules")
            return fallback.explain_decision(req)
        except Exception as e:
            logger.error(f"[TrustMesh AI] Unexpected error during decision explanation: {e}. Degrading to deterministic fallback.")
            fallback = DeterministicFallbackProvider(reason=f"Unexpected error ({type(e).__name__}); degraded to deterministic rules")
            return fallback.explain_decision(req)

    def get_health_status(self) -> Dict[str, Any]:
        """Provides status and active configuration without leaking sensitive keys."""
        is_live = bool(self.settings.AI_ENABLED and self.settings.GROQ_API_KEY)
        return {
            "status": "healthy",
            "ai_enabled": self.settings.AI_ENABLED,
            "provider": self.settings.AI_PROVIDER,
            "model": self.settings.AI_MODEL_NAME,
            "api_base_url": self.settings.AI_API_BASE_URL,
            "api_key_configured": bool(self.settings.GROQ_API_KEY),
            "masked_key": self.settings.masked_api_key,
            "mode": "LIVE_INFERENCE" if is_live else "DETERMINISTIC_FALLBACK"
        }

# Global singleton
ai_service = TrustMeshAIService()
