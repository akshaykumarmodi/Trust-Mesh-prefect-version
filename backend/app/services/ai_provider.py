import time
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import httpx

from app.core.ai_config import AISettings, ai_settings
from app.schemas.ai import (
    ExecutionMode,
    AnalysisMetadata,
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

logger = logging.getLogger("trustmesh.ai.provider")

# Custom Exceptions for Granular Error Handling
class AIProviderError(Exception):
    """Base exception for AI provider errors."""
    pass

class AIAuthenticationError(AIProviderError):
    """Raised when upstream API key is rejected (HTTP 401)."""
    pass

class AIRateLimitError(AIProviderError):
    """Raised when upstream rate limits are encountered (HTTP 429)."""
    pass

class AITimeoutError(AIProviderError):
    """Raised when upstream inference request exceeds timeout."""
    pass

class AIServerError(AIProviderError):
    """Raised when upstream returns HTTP 5xx or connection drops."""
    pass

class AIInvalidResponseError(AIProviderError):
    """Raised when upstream returns non-JSON or invalid schema."""
    pass


class BaseAIProvider(ABC):
    """Abstract base class defining the TrustMesh AI Provider interface."""

    @abstractmethod
    def analyze_vouch(self, req: VouchAnalysisRequest) -> VouchAnalysisResponse:
        pass

    @abstractmethod
    def analyze_denouncement(self, req: DenouncementAnalysisRequest) -> DenouncementAnalysisResponse:
        pass

    @abstractmethod
    def analyze_campaign(self, req: CampaignAnalysisRequest) -> CampaignAnalysisResponse:
        pass

    @abstractmethod
    def summarize_contributor(self, req: ContributorSummaryRequest) -> ContributorSummaryResponse:
        pass

    @abstractmethod
    def explain_decision(self, req: ExplainDecisionRequest) -> ExplainDecisionResponse:
        pass


class DeterministicFallbackProvider(BaseAIProvider):
    """
    Deterministic rule-based fallback provider.
    Executes locally with zero network calls and zero credentials.
    Clearly labeled to ensure users know this is a deterministic heuristic, not an LLM.
    """

    def __init__(self, reason: str = "AI inference offline / fallback active"):
        self.reason = reason

    def _build_metadata(self, start_time: float) -> AnalysisMetadata:
        latency = (time.perf_counter() - start_time) * 1000.0
        return AnalysisMetadata(
            provider="deterministic_heuristic_engine",
            model="deterministic-rules-v1",
            execution_mode=ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK,
            fallback_reason=self.reason,
            advisory_only=True,
            latency_ms=round(latency, 2)
        )

    def analyze_vouch(self, req: VouchAnalysisRequest) -> VouchAnalysisResponse:
        t0 = time.perf_counter()
        verified_ev = []
        unverified = []

        if req.cryptographic_hash:
            verified_ev.append(f"Cryptographic provenance SHA-256 present: {req.cryptographic_hash[:16]}...")
        if req.evidence_links:
            verified_ev.append(f"{len(req.evidence_links)} linked repository evidence references supplied.")

        unverified.append(f"Submitter subjective endorsement: '{req.context_notes[:120]}...'")

        has_substance = len(req.context_notes) > 50 or bool(req.evidence_links)
        quality = "HIGH_MERIT" if (has_substance and req.cryptographic_hash) else ("MODERATE" if has_substance else "INSUFFICIENT_CONTEXT")

        checklist = [
            f"Audit submitter authority ({req.submitter_id}) on project '{req.project_id}'.",
            "Verify attached PRs or commit signatures match recipient identity.",
            "Confirm vouch notes correspond to verifiable open-source contributions."
        ]

        return VouchAnalysisResponse(
            advisory_only=True,
            endorsement_quality=quality,
            verified_evidence=verified_ev,
            allegations_or_claims=unverified,
            confidence_assessment="Rule-based signal validation: verified cryptographic and commit records.",
            investigation_checklist=checklist,
            explanation=(
                f"Deterministic signal check for vouch on '{req.recipient_id}' from '{req.submitter_id}'. "
                f"Status: {quality}. Supporting verifiable items: {len(verified_ev)}, Subjective claims: {len(unverified)}."
            ),
            metadata=self._build_metadata(t0)
        )

    def analyze_denouncement(self, req: DenouncementAnalysisRequest) -> DenouncementAnalysisResponse:
        t0 = time.perf_counter()
        verified_ev = []
        allegations = [f"Reporter ({req.reporter_id}) alleged: {req.allegation_details[:180]}"]

        if req.evidence_urls:
            for url in req.evidence_urls:
                verified_ev.append(f"Referenced incident URL provided for review: {url}")
        if req.diff_snippet:
            verified_ev.append("Code diff snippet supplied for template similarity analysis.")

        has_evidence = bool(req.evidence_urls or req.diff_snippet)
        severity = "MEDIUM_RISK" if has_evidence else "INFORMATIONAL_UNVERIFIED_ALLEGATION"

        checklist = [
            f"Check reporter '{req.reporter_id}' vouch history to guard against bad-faith retaliation.",
            "Inspect referenced PR URLs to check for repeated copy-paste templates or automated AI bursts.",
            "Allow the accused contributor opportunity to respond before adjusting repository permissions."
        ]

        return DenouncementAnalysisResponse(
            advisory_only=True,
            allegation_classification=req.allegation_type,
            verified_evidence=verified_ev,
            unverified_allegations=allegations,
            severity_assessment=severity,
            investigation_checklist=checklist,
            no_automatic_punishment_notice=(
                "This assessment is advisory. Maintainer verification is strictly required before any moderation or policy action."
            ),
            explanation=(
                f"Deterministic audit of allegation against '{req.accused_id}'. "
                f"Classification: {req.allegation_type}. Severity: {severity}. "
                "Allegations are strictly distinguished from verified cryptographic proof."
            ),
            metadata=self._build_metadata(t0)
        )

    def analyze_campaign(self, req: CampaignAnalysisRequest) -> CampaignAnalysisResponse:
        t0 = time.perf_counter()
        contributor_count = len(req.suspected_contributor_ids)
        project_count = len(req.affected_project_ids)
        ts_count = len(req.activity_timestamps)

        # Evaluate heuristics
        if contributor_count >= 3 and project_count >= 2:
            signal_strength = "STRONG_CORRELATION"
        elif contributor_count >= 2:
            signal_strength = "MODERATE_CORRELATION"
        else:
            signal_strength = "WEAK_ANOMALY"

        patterns = [
            f"Observed {contributor_count} distinct contributor accounts interacting across {project_count} projects.",
            f"Activity cluster spans {ts_count} recorded lifecycle events."
        ]
        if req.similarity_indicators:
            for k, v in req.similarity_indicators.items():
                patterns.append(f"Heuristic indicator '{k}': {v}")

        templates = []
        if req.sample_pr_titles:
            templates.append(f"Inspected {len(req.sample_pr_titles)} PR title templates across the cluster.")

        checklist = [
            "Cross-reference commit author timestamps for synchronized or automated cron execution.",
            "Compare commit diff AST or token similarity to detect automated AI template duplication.",
            "Verify if accounts share identical registration windows or email domain patterns."
        ]

        return CampaignAnalysisResponse(
            advisory_only=True,
            coordination_signal_strength=signal_strength,
            cross_repo_pattern_breakdown=patterns,
            shared_template_indicators=templates,
            similarity_vs_proof_notice=(
                "Heuristic and template similarities indicate correlated behavior, not conclusive human-AI attribution. Human maintainer triage is required."
            ),
            investigation_checklist=checklist,
            explanation=(
                f"Deterministic burst and correlation analysis across {project_count} projects. "
                f"Signal strength: {signal_strength}. Requires human maintainer confirmation before actions."
            ),
            metadata=self._build_metadata(t0)
        )

    def summarize_contributor(self, req: ContributorSummaryRequest) -> ContributorSummaryResponse:
        t0 = time.perf_counter()

        # Newcomer fairness: if 0 vouches and 0 denouncements, they are NEUTRAL
        is_newcomer = (req.vouch_count == 0 and req.denouncement_count == 0)
        newcomer_statement = None

        if is_newcomer:
            status = "NEUTRAL_NEWCOMER"
            newcomer_statement = (
                "Newcomer contributors begin with an unestablished neutral baseline; "
                "lack of historical vouches is never treated as suspicious."
            )
        elif req.denouncement_count > 0 and req.vouch_count == 0:
            status = "UNDER_EVIDENCE_REVIEW"
        elif req.vouch_count >= 2:
            status = "ESTABLISHED_CONTRIBUTOR"
        else:
            status = "ACTIVE_PEER"

        merits = []
        if req.vouch_count > 0:
            merits.append(f"{req.vouch_count} verified peer vouches recorded in trust network.")
        if req.verified_pr_count > 0:
            merits.append(f"{req.verified_pr_count} merged pull requests verified via repository sync.")

        allegations = []
        if req.denouncement_count > 0:
            allegations.append(f"{req.denouncement_count} unverified or active denouncements filed.")

        checklist = [
            "Review verified repository contributions rather than judging based on account age.",
            "Examine context of any filed denouncements before altering maintainer trust weight."
        ]

        return ContributorSummaryResponse(
            advisory_only=True,
            reputation_status=status,
            is_newcomer=is_newcomer,
            newcomer_neutrality_statement=newcomer_statement,
            verified_merits=merits,
            unresolved_allegations=allegations,
            investigation_checklist=checklist,
            summary=(
                f"Summary for '{req.contributor_id}': Status is {status}. "
                f"Vouches: {req.vouch_count}, Denouncements: {req.denouncement_count}, "
                f"Verified PRs: {req.verified_pr_count} across {len(req.active_projects)} projects."
            ),
            metadata=self._build_metadata(t0)
        )

    def explain_decision(self, req: ExplainDecisionRequest) -> ExplainDecisionResponse:
        t0 = time.perf_counter()

        factors = [
            f"Deterministic mathematical trust score: {req.deterministic_score:.3f}.",
            f"Assigned trust policy tier: '{req.assigned_tier}' based on project '{req.project_id}' rules.",
            f"Effective vouch multiplier: {req.effective_vouches_weight}x, Denouncement penalty: {req.effective_denouncements_weight}x."
        ]

        if req.newcomer_baseline_applied:
            factors.append("Newcomer fairness protocol applied: contributor begins at neutral 0.00 baseline without negative penalty.")

        checklist = [
            f"Review project '{req.project_id}' custom trust policy thresholds.",
            "Verify peer project federation weights if multi-hop trust propagation was computed."
        ]

        rationale = (
            f"Contributor '{req.contributor_id}' received tier '{req.assigned_tier}' with calculated score {req.deterministic_score:.3f}. "
            "Scoring is determined strictly by deterministic graph propagation and local repository policies."
        )

        return ExplainDecisionResponse(
            advisory_only=True,
            plain_english_rationale=rationale,
            policy_factor_breakdown=factors,
            newcomer_fairness_applied=req.newcomer_baseline_applied,
            investigation_checklist=checklist,
            metadata=self._build_metadata(t0)
        )


def _safe_str_list(val: Any, default: Optional[List[str]] = None) -> List[str]:
    """Safely coerces any value into a list of strings, avoiding TypeErrors on null or single string."""
    if val is None:
        return default or []
    if isinstance(val, list):
        return [str(x) for x in val if x is not None]
    if isinstance(val, str) and val.strip():
        return [val.strip()]
    return default or []


class GroqProvider(BaseAIProvider):
    """
    Groq-compatible Chat Completions API Provider.
    Calls Groq's high-speed inference endpoint with JSON structured output format.
    Never exposes API credentials in logs or responses.
    """

    def __init__(self, settings: Optional[AISettings] = None, client: Optional[httpx.Client] = None):
        self.settings = settings or ai_settings
        self._client = client

    def _get_client(self) -> httpx.Client:
        if self._client:
            return self._client
        return httpx.Client(timeout=self.settings.AI_REQUEST_TIMEOUT_SECONDS)

    def _call_groq_chat(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """
        Executes an HTTP POST to Groq chat completions with strict JSON Mode and error handling.
        """
        if not self.settings.GROQ_API_KEY:
            raise AIAuthenticationError("GROQ_API_KEY is not configured or empty.")

        url = f"{self.settings.AI_API_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.settings.AI_MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": self.settings.AI_TEMPERATURE,
            "max_tokens": self.settings.AI_MAX_TOKENS,
            "response_format": {"type": "json_object"}
        }

        try:
            client = self._get_client()
            resp = client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException as e:
            logger.error(f"[GroqProvider] Request timed out after {self.settings.AI_REQUEST_TIMEOUT_SECONDS}s")
            raise AITimeoutError(f"Groq API request timed out: {e}") from e
        except httpx.RequestError as e:
            logger.error(f"[GroqProvider] Network request error: {e}")
            raise AIServerError(f"Network error communicating with Groq API: {e}") from e

        # Handle HTTP Status Codes
        if resp.status_code == 401:
            logger.error("[GroqProvider] HTTP 401 Unauthorized: Invalid or expired Groq API key.")
            raise AIAuthenticationError("Invalid or expired GROQ_API_KEY.")
        elif resp.status_code == 429:
            logger.warning("[GroqProvider] HTTP 429 Too Many Requests: Rate limit reached on Groq API.")
            raise AIRateLimitError("Groq API rate limit exceeded.")
        elif resp.status_code >= 500:
            logger.error(f"[GroqProvider] HTTP {resp.status_code} Upstream server error from Groq.")
            raise AIServerError(f"Groq server error: {resp.status_code}")
        elif not resp.is_success:
            logger.error(f"[GroqProvider] HTTP {resp.status_code}: {resp.text[:200]}")
            raise AIProviderError(f"Groq returned unexpected status {resp.status_code}")

        # Parse JSON output
        try:
            data = resp.json()
            content_str = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(content_str)
            if not isinstance(parsed_json, dict):
                raise ValueError("Model response root is not a JSON object")
            return parsed_json
        except (KeyError, IndexError, json.JSONDecodeError, ValueError) as e:
            logger.error(f"[GroqProvider] Failed to parse model output as JSON: {e}")
            raise AIInvalidResponseError(f"Invalid model JSON response: {e}") from e

    def _build_metadata(self, start_time: float) -> AnalysisMetadata:
        latency = (time.perf_counter() - start_time) * 1000.0
        return AnalysisMetadata(
            provider=self.settings.AI_PROVIDER,
            model=self.settings.AI_MODEL_NAME,
            execution_mode=ExecutionMode.AI_INFERENCE,
            advisory_only=True,
            latency_ms=round(latency, 2)
        )

    def analyze_vouch(self, req: VouchAnalysisRequest) -> VouchAnalysisResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are TrustMesh AI, an evidence-based vouch analysis engine for open-source maintainers. "
            "Analyze the submitted vouch and return valid JSON with keys: "
            "'endorsement_quality' (HIGH_MERIT, MODERATE, AMBIGUOUS, or INSUFFICIENT_CONTEXT), "
            "'verified_evidence' (array of strings), "
            "'allegations_or_claims' (array of strings), "
            "'confidence_assessment' (string explaining rationale), "
            "'investigation_checklist' (array of actionable maintainer checks), "
            "'explanation' (string summary). "
            "Safety: Never declare guilt or recommend automated bans. Keep advisory_only true."
        )
        user_prompt = json.dumps({
            "submitter_id": req.submitter_id,
            "recipient_id": req.recipient_id,
            "project_id": req.project_id,
            "context_notes": req.context_notes,
            "evidence_links": req.evidence_links,
            "cryptographic_hash": req.cryptographic_hash
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return VouchAnalysisResponse(
            advisory_only=True,
            endorsement_quality=str(parsed.get("endorsement_quality", "MODERATE")),
            verified_evidence=_safe_str_list(parsed.get("verified_evidence")),
            allegations_or_claims=_safe_str_list(parsed.get("allegations_or_claims")),
            confidence_assessment=str(parsed.get("confidence_assessment", "Model structured evaluation")),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Verify submitter repository authority."]),
            explanation=str(parsed.get("explanation", "Analysis completed by Groq open-weight inference.")),
            metadata=self._build_metadata(t0)
        )

    def analyze_denouncement(self, req: DenouncementAnalysisRequest) -> DenouncementAnalysisResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are TrustMesh AI, an evidence analysis engine for open-source project security. "
            "Analyze the report and return valid JSON with keys: "
            "'allegation_classification' (string), "
            "'verified_evidence' (array of strings), "
            "'unverified_allegations' (array of strings), "
            "'severity_assessment' (INFORMATIONAL, LOW_RISK, MEDIUM_RISK, or HIGH_RISK_REQUIRES_AUDIT), "
            "'investigation_checklist' (array of maintainer audit steps), "
            "'explanation' (string summary). "
            "Safety: Treat allegations as unproven claims. Strictly distinguish verified links from allegations. "
            "Never mandate automatic bans. Human oversight is mandatory."
        )
        user_prompt = json.dumps({
            "reporter_id": req.reporter_id,
            "accused_id": req.accused_id,
            "project_id": req.project_id,
            "allegation_type": req.allegation_type,
            "allegation_details": req.allegation_details,
            "evidence_urls": req.evidence_urls,
            "diff_snippet": req.diff_snippet
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return DenouncementAnalysisResponse(
            advisory_only=True,
            allegation_classification=str(parsed.get("allegation_classification", req.allegation_type)),
            verified_evidence=_safe_str_list(parsed.get("verified_evidence")),
            unverified_allegations=_safe_str_list(parsed.get("unverified_allegations")),
            severity_assessment=str(parsed.get("severity_assessment", "MEDIUM_RISK")),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Inspect PR diff manually."]),
            no_automatic_punishment_notice=(
                "This assessment is advisory. Maintainer verification is strictly required before any moderation or policy action."
            ),
            explanation=str(parsed.get("explanation", "Denouncement analyzed by Groq open-weight inference.")),
            metadata=self._build_metadata(t0)
        )

    def analyze_campaign(self, req: CampaignAnalysisRequest) -> CampaignAnalysisResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are TrustMesh AI, a cross-repository coordinated campaign analyzer. "
            "Analyze the suspect burst cluster and return valid JSON with keys: "
            "'coordination_signal_strength' (STRONG_CORRELATION, MODERATE_CORRELATION, WEAK_ANOMALY, or INCONCLUSIVE), "
            "'cross_repo_pattern_breakdown' (array of strings), "
            "'shared_template_indicators' (array of strings), "
            "'investigation_checklist' (array of strings), "
            "'explanation' (string). "
            "Safety: Emphasize that template similarity is a correlation indicator, not proof of identity or malicious intent."
        )
        user_prompt = json.dumps({
            "suspected_contributor_ids": req.suspected_contributor_ids,
            "affected_project_ids": req.affected_project_ids,
            "activity_timestamps": req.activity_timestamps,
            "similarity_indicators": req.similarity_indicators,
            "sample_pr_titles": req.sample_pr_titles
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return CampaignAnalysisResponse(
            advisory_only=True,
            coordination_signal_strength=str(parsed.get("coordination_signal_strength", "MODERATE_CORRELATION")),
            cross_repo_pattern_breakdown=_safe_str_list(parsed.get("cross_repo_pattern_breakdown")),
            shared_template_indicators=_safe_str_list(parsed.get("shared_template_indicators")),
            similarity_vs_proof_notice=(
                "Heuristic and template similarities indicate correlated behavior, not conclusive human-AI attribution. Human maintainer triage is required."
            ),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Cross-check author timestamps."]),
            explanation=str(parsed.get("explanation", "Campaign correlation analyzed by Groq inference.")),
            metadata=self._build_metadata(t0)
        )

    def summarize_contributor(self, req: ContributorSummaryRequest) -> ContributorSummaryResponse:
        t0 = time.perf_counter()
        is_newcomer = (req.vouch_count == 0 and req.denouncement_count == 0)
        system_prompt = (
            "You are TrustMesh AI, an objective contributor profile summarizer. "
            "Return valid JSON with keys: "
            "'reputation_status' (ESTABLISHED_CONTRIBUTOR, ACTIVE_PEER, NEUTRAL_NEWCOMER, or UNDER_EVIDENCE_REVIEW), "
            "'verified_merits' (array of strings), "
            "'unresolved_allegations' (array of strings), "
            "'investigation_checklist' (array of strings), "
            "'summary' (string). "
            "Safety: Newcomers with zero history must be treated as NEUTRAL_NEWCOMER. Lack of history is never guilt."
        )
        user_prompt = json.dumps({
            "contributor_id": req.contributor_id,
            "vouch_count": req.vouch_count,
            "denouncement_count": req.denouncement_count,
            "verified_pr_count": req.verified_pr_count,
            "active_projects": req.active_projects,
            "is_newcomer": is_newcomer
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        status = str(parsed.get("reputation_status", "NEUTRAL_NEWCOMER" if is_newcomer else "ACTIVE_PEER"))

        # Enforce strict newcomer neutrality guardrail regardless of LLM hallucination
        newcomer_statement = None
        if is_newcomer:
            status = "NEUTRAL_NEWCOMER"
            newcomer_statement = (
                "Newcomer contributors begin with an unestablished neutral baseline; "
                "lack of historical vouches is never treated as suspicious."
            )

        return ContributorSummaryResponse(
            advisory_only=True,
            reputation_status=status,
            is_newcomer=is_newcomer,
            newcomer_neutrality_statement=newcomer_statement,
            verified_merits=_safe_str_list(parsed.get("verified_merits")),
            unresolved_allegations=_safe_str_list(parsed.get("unresolved_allegations")),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Verify contributions against commit history."]),
            summary=str(parsed.get("summary", f"Contributor {req.contributor_id} summary generated via Groq.")),
            metadata=self._build_metadata(t0)
        )

    def explain_decision(self, req: ExplainDecisionRequest) -> ExplainDecisionResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are TrustMesh AI, an explainability assistant. "
            "Explain a deterministic trust decision in clear, transparent English. "
            "Return valid JSON with keys: "
            "'plain_english_rationale' (string), "
            "'policy_factor_breakdown' (array of strings), "
            "'investigation_checklist' (array of strings). "
            "Safety: Emphasize that scores are computed by deterministic project policies, not by AI."
        )
        user_prompt = json.dumps({
            "contributor_id": req.contributor_id,
            "project_id": req.project_id,
            "deterministic_score": req.deterministic_score,
            "assigned_tier": req.assigned_tier,
            "newcomer_baseline_applied": req.newcomer_baseline_applied,
            "effective_vouches_weight": req.effective_vouches_weight,
            "effective_denouncements_weight": req.effective_denouncements_weight,
            "policy_thresholds": req.policy_thresholds
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return ExplainDecisionResponse(
            advisory_only=True,
            plain_english_rationale=str(parsed.get("plain_english_rationale", "Deterministic decision explained by Groq.")),
            policy_factor_breakdown=_safe_str_list(parsed.get("policy_factor_breakdown"), [f"Score: {req.deterministic_score}"]),
            newcomer_fairness_applied=req.newcomer_baseline_applied,
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Verify project policy thresholds."]),
            metadata=self._build_metadata(t0)
        )
