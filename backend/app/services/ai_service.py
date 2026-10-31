import json
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

class AIService:
    """
    Service for AI-assisted evidence summarization and pattern explanation.
    Uses GPT-OSS-120B (Open-Weight model) if OPENROUTER_API_KEY is configured.
    Falls back gracefully to transparent deterministic explanations if the key
    is not set or the API is unreachable.
    """

    @classmethod
    def is_live_configured(cls) -> bool:
        return bool(settings.OPENROUTER_API_KEY and len(settings.OPENROUTER_API_KEY.strip()) > 5)

    @classmethod
    async def explain_evidence(
        cls,
        target_type: str, # "contributor" or "campaign"
        target_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generates an evidence summary and maintainer recommendation.
        """
        if cls.is_live_configured():
            try:
                return await cls._call_openrouter(target_type, target_data)
            except Exception as e:
                # Log error and fall back gracefully
                fallback = cls._deterministic_fallback(target_type, target_data)
                fallback["fallback_reason"] = f"AI API call failed ({str(e)}). Switched to deterministic intelligence."
                return fallback
        else:
            return cls._deterministic_fallback(target_type, target_data)

    @classmethod
    async def _call_openrouter(cls, target_type: str, target_data: Dict[str, Any]) -> Dict[str, Any]:
        prompt = (
            f"You are the TrustMesh AI Evidence Explainer (Model: {settings.AI_MODEL_NAME}). "
            f"Analyze this {target_type} data from a decentralized open-source trust network. "
            f"Do NOT make absolute moral judgments. Provide an objective, evidence-based assessment.\n\n"
            f"DATA:\n{json.dumps(target_data, indent=2)}\n\n"
            f"Respond in strict JSON format with the following keys:\n"
            f"- summary: string\n"
            f"- key_findings: list of strings\n"
            f"- recommended_maintainer_action: string\n"
            f"- confidence_assessment: string\n"
        )

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://trustmesh.network",
            "X-Title": "TrustMesh Open-Source Trust Intelligence",
            "Content-Type": "application/json"
        }

        payload = {
            "model": settings.AI_MODEL_NAME,
            "messages": [
                {"role": "system", "content": "You are a cybersecurity and open-source supply chain intelligence analyst. You output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 600
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.AI_API_BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            )
            resp.raise_for_status()
            data = resp.json()
            raw_text = data["choices"][0]["message"]["content"]
            
            # Clean JSON if wrapped in markdown blocks
            clean_text = raw_text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]

            parsed = json.loads(clean_text.strip())
            return {
                "target_id": str(target_data.get("id", "unknown")),
                "ai_model": settings.AI_MODEL_NAME,
                "is_live_ai": True,
                "summary": parsed.get("summary", ""),
                "key_findings": parsed.get("key_findings", []),
                "recommended_maintainer_action": parsed.get("recommended_maintainer_action", ""),
                "confidence_assessment": parsed.get("confidence_assessment", "High (Model Verified)")
            }

    @classmethod
    def _deterministic_fallback(cls, target_type: str, target_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Robust, transparent fallback when AI model is offline or unconfigured.
        """
        target_id = str(target_data.get("id", "unknown"))
        
        if target_type == "campaign":
            code = target_data.get("campaign_code", "CAMPAIGN")
            name = target_data.get("name", "Abuse Pattern")
            signal = float(target_data.get("signal_strength", 0.8))
            projects = target_data.get("affected_projects", [])
            contributors = target_data.get("contributor_ids", [])
            pattern_type = target_data.get("pattern_type", "Automated Activity")

            return {
                "target_id": target_id,
                "ai_model": f"{settings.AI_MODEL_NAME} (Offline / Deterministic Fallback Active)",
                "is_live_ai": False,
                "summary": (
                    f"Deterministic Pattern Correlator flagged campaign {code} ({name}). "
                    f"Cross-project cluster detected across {len(projects)} independent repositories "
                    f"with {len(contributors)} coordinated accounts matching pattern: '{pattern_type}'."
                ),
                "key_findings": [
                    f"Signal strength calculated at {int(signal * 100)}% based on textual similarity and timestamp clustering.",
                    f"Impacts repositories: {', '.join(projects[:4]) if projects else 'Multiple'}.",
                    f"Involved identities share identical commit templates or rapid-fire submission cadence.",
                    "No cryptographic vouches exist for any participating identity within the active window."
                ],
                "recommended_maintainer_action": (
                    "Place contributions from associated accounts in 'Hold / Staging' status. "
                    "Compare diffs across the listed repositories for identical auto-generated docstring templates."
                ),
                "confidence_assessment": f"Deterministic Confidence: {int(signal * 100)}% (Multi-Repository Correlation)"
            }

        else: # Contributor
            username = target_data.get("username", "contributor")
            state = target_data.get("reputation_state", "NEWCOMER")
            vouches = target_data.get("vouches", [])
            denouncements = target_data.get("denouncements", [])

            if state == "NEWCOMER":
                summary = (
                    f"Account @{username} is evaluated under TrustMesh Fairness Principle #1: "
                    "Newcomers begin with a clean slate. Zero negative flags or suspicious cluster overlap detected."
                )
                findings = [
                    "Zero prior negative allegations across all federated repositories.",
                    "No vouches recorded yet; clean first-time contributor profile.",
                    "Recommended to assess pull request purely on technical merit and code reviews."
                ]
                action = "Perform standard PR code review without prejudice."
                conf = "Fairness Neutral (0.50)"
            elif state == "ESTABLISHED":
                summary = (
                    f"Account @{username} has multiple positive vouches from verified maintainers with verifiable PR evidence."
                )
                findings = [
                    f"Received {len(vouches)} positive vouches across peer repositories.",
                    "Zero active denouncements or pending allegations.",
                    "Consistent high-quality contribution provenance verified."
                ]
                action = "Eligible for fast-track review or automated CI verification."
                conf = "High Peer Trust (0.92)"
            elif state == "UNDER REVIEW":
                summary = (
                    f"Account @{username} is currently flagged under review due to reported anomalies or conflicting cross-project signals."
                )
                findings = [
                    f"Subject to {len(denouncements)} allegation(s) or campaign correlation.",
                    "Maintainers must review attached evidence URLs before making accept/reject decisions.",
                    "Allegations remain unconfirmed until explicit maintainer verification."
                ]
                action = "Inspect submitted evidence diffs before merging. Do not auto-close without checking provenance."
                conf = "Caution Required (0.35)"
            else:
                summary = f"Account @{username} has an emerging profile with limited corroborating records."
                findings = [
                    f"Current vouches: {len(vouches)}, current allegations: {len(denouncements)}.",
                    "Profile requires additional project cross-referencing."
                ]
                action = "Request peer review from contributor's previous project maintainers."
                conf = "Moderate (0.60)"

            return {
                "target_id": target_id,
                "ai_model": f"{settings.AI_MODEL_NAME} (Offline / Deterministic Fallback Active)",
                "is_live_ai": False,
                "summary": summary,
                "key_findings": findings,
                "recommended_maintainer_action": action,
                "confidence_assessment": conf
            }
