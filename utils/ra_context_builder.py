"""Context-pack building and subject-profile resolution for risk assessments.

Kept in utils/ so both the FastAPI router and the Celery worker can import
these functions without any cross-package dependency on api/.
"""
from __future__ import annotations

import json
import re as _re
from typing import Any

from utils.risk_scorer import compute_cia_total, compute_criticality


# ── Text helper (also re-exported for use in the store) ───────────────────────

def _clean_report_text(value: str) -> str:
    # All non-ASCII characters written as \u escapes so the source stays ASCII-safe.
    replacements = [
        ("â€”", "-"),  # CP1252 mojibake for em dash U+2014
        ("â€“", "-"),  # CP1252 mojibake for en dash U+2013
        ("—", "-"),              # em dash
        ("–", "-"),              # en dash
        ("â€™", "'"),  # CP1252 mojibake for right single quote U+2019
        ("’", "'"),              # right single quote
        ("â€œ", '"'),  # CP1252 mojibake for left double quote U+201C
        ("â€\x9d",   '"'),  # CP1252 mojibake for right double quote U+201D
        ("“", '"'),              # left double quote
        ("”", '"'),              # right double quote
    ]
    for old, new in replacements:
        value = value.replace(old, new)
    return value


def _tokenize_match_text(text: str) -> set[str]:
    cleaned = _clean_report_text(str(text or "")).lower()
    return {token for token in _re.findall(r"[a-z0-9]+", cleaned) if len(token) > 2}


# ── CIA / criticality helper ──────────────────────────────────────────────────

def _cia_band_from_values(confidentiality: int, integrity: int, availability: int) -> tuple[int, str]:
    total = compute_cia_total(confidentiality, integrity, availability)
    return total, compute_criticality(total)


# ── LLM context-window registry ──────────────────────────────────────────────

_LLM_CONTEXT_WINDOWS: dict[str, int] = {
    # Gemini
    "gemini-1.5-pro":    1_000_000,
    "gemini-1.5-flash":  1_000_000,
    "gemini-2.0-flash":  1_000_000,
    "gemini-2.5-pro":    1_000_000,
    "gemini-2.5-flash":  1_000_000,
    "gemini-1.0-pro":       32_768,
    # OpenAI
    "gpt-4o":            128_000,
    "gpt-4o-mini":       128_000,
    "gpt-4-turbo":       128_000,
    "gpt-4":               8_192,
    "gpt-3.5-turbo":      16_385,
    # Anthropic
    "claude-3-5-sonnet": 200_000,
    "claude-3-5-haiku":  200_000,
    "claude-3-opus":     200_000,
    "claude-3-sonnet":   200_000,
    "claude-3-haiku":    200_000,
    "claude-sonnet-4":   200_000,
    "claude-opus-4":     200_000,
    # Ollama local models (conservative -- actual varies by quant)
    "llama3.1:8b":         8_192,
    "llama3.1:70b":       32_768,
    "llama3:8b":           8_192,
    "llama3:70b":         32_768,
    "mistral:7b":          8_192,
    "mixtral:8x7b":       32_768,
    "phi3:mini":           4_096,
    "phi3:medium":        16_384,
    "qwen2:7b":           32_768,
    "qwen2:72b":          32_768,
    "deepseek-r1:8b":      8_192,
    "deepseek-r1:70b":    32_768,
    "gemma2:9b":           8_192,
    "gemma2:27b":         32_768,
}
_DEFAULT_CONTEXT_WINDOW = 32_768
_CHARS_PER_TOKEN = 4


def _get_active_context_window() -> tuple[int, str]:
    """Return (context_window_tokens, model_id) for the currently active LLM."""
    try:
        from utils.llm_provider import get_llm
        llm = get_llm()
        model_id = (
            getattr(llm, "model", None)
            or getattr(llm, "model_name", None)
            or ""
        ).lower()
        if model_id in _LLM_CONTEXT_WINDOWS:
            return _LLM_CONTEXT_WINDOWS[model_id], model_id
        for key, window in _LLM_CONTEXT_WINDOWS.items():
            if model_id.startswith(key) or key in model_id:
                return window, model_id
        return _DEFAULT_CONTEXT_WINDOW, model_id
    except Exception:
        return _DEFAULT_CONTEXT_WINDOW, "unknown"


def _compute_per_doc_text_budget(context_window_tokens: int, num_docs: int) -> int:
    """How many raw full_text chars each document gets in the context pack."""
    doc_budget_chars = int(context_window_tokens * 0.35 * _CHARS_PER_TOKEN)
    per_doc = doc_budget_chars // max(1, num_docs)

    if context_window_tokens >= 500_000:
        per_doc = min(per_doc, 80_000)
    elif context_window_tokens >= 100_000:
        per_doc = min(per_doc, 24_000)
    elif context_window_tokens >= 32_000:
        per_doc = min(per_doc, 6_000)
    else:
        per_doc = min(per_doc, 2_500)

    return max(per_doc, 1_500)


def _build_ra_context_pack(ra: Any, chunks: list[dict]) -> str:
    """Build the combined context string passed to all pipeline agents.

    `ra` is duck-typed -- accepts RiskAssessment or any object with the same
    attributes (context_profile, context_sources, historical_matches).
    """
    context_window_tokens, model_id = _get_active_context_window()
    context_profile = json.dumps(ra.context_profile or {}, indent=2, sort_keys=True)

    accepted_sources = [s for s in (ra.context_sources or []) if s.get("relevance") != "rejected"]
    accepted_sources.sort(key=lambda s: -len((s.get("doc_metadata") or {}).get("risk_flags") or []))

    per_doc_text_chars = _compute_per_doc_text_budget(context_window_tokens, len(accepted_sources))
    if context_window_tokens >= 100_000:
        max_chunk_chars, max_chunks = 3_000, 50
    elif context_window_tokens >= 32_000:
        max_chunk_chars, max_chunks = 1_500, 25
    else:
        max_chunk_chars, max_chunks = 800, 12

    doc_sections: list[str] = []
    covered_chunk_ids: set[str] = set()

    for source in accepted_sources:
        meta = source.get("doc_metadata") or {}
        llm_ext = source.get("doc_llm_extraction") or {}
        src_id = source.get("id", "")
        doc_type = meta.get("document_type") or llm_ext.get("document_type") or "unknown"
        lines = [f"=== {source.get('filename', 'document')} (type: {doc_type}) ==="]

        if meta.get("technologies") or llm_ext.get("technologies"):
            techs = meta.get("technologies") or llm_ext.get("technologies") or []
            lines.append(f"  Technologies/services: {', '.join(techs)}")
        if meta.get("regulations") or llm_ext.get("regulations"):
            regs = meta.get("regulations") or llm_ext.get("regulations") or []
            lines.append(f"  Regulations & standards: {', '.join(regs)}")
        if meta.get("data_types") or llm_ext.get("data_types"):
            dts = meta.get("data_types") or llm_ext.get("data_types") or []
            lines.append(f"  Data categories: {', '.join(dts)}")
        if meta.get("third_parties") or llm_ext.get("third_parties"):
            tps = meta.get("third_parties") or llm_ext.get("third_parties") or []
            lines.append(f"  Third parties/integrations: {', '.join(tps)}")
        if meta.get("risk_flags") or llm_ext.get("risk_flags"):
            flags = meta.get("risk_flags") or llm_ext.get("risk_flags") or []
            lines.append(f"  RISK FLAGS -- specific gaps: {'; '.join(flags)}")

        for field, label in [
            ("project_context",         "Architecture/technical context"),
            ("business_impact",         "Business impact"),
            ("overall_project_summary", "Summary"),
            ("jira_context",            "Delivery/Jira context"),
            ("free_text_context",       "Additional risk context"),
        ]:
            val = llm_ext.get(field, "").strip()
            if val:
                lines.append(f"  [{label}]\n{val}")

        full_text = source.get("full_text", "").strip()
        if full_text:
            allowed = per_doc_text_chars
            truncated = len(full_text) > allowed
            snippet = full_text[:allowed]
            suffix = f"\n  [... {len(full_text) - allowed:,} chars truncated]" if truncated else ""
            lines.append(f"  Raw document text ({model_id}, budget {allowed:,} chars/doc):\n{snippet}{suffix}")
            for chunk in chunks:
                if chunk.get("source_id") == src_id:
                    covered_chunk_ids.add(chunk.get("id", ""))
        elif source.get("summary"):
            lines.append(f"  Summary: {source['summary'][:400]}")

        doc_sections.append("\n".join(lines))

    docs_block = "\n\n".join(doc_sections) if doc_sections else "No documents uploaded yet."

    extra_chunks = [c for c in chunks if c.get("id", "") not in covered_chunk_ids]
    chunk_supplement = "\n".join(
        f"- {str(chunk.get('text', ''))[:max_chunk_chars]}" for chunk in extra_chunks[:max_chunks]
    )
    historical_summary = "\n".join(
        f"- {match.get('title', '')} ({match.get('similarity_score', 0)}): "
        f"{', '.join(match.get('matched_terms', [])[:8])}"
        for match in (ra.historical_matches or [])[:5]
    )
    supplement_block = (
        "\n=== ADDITIONAL DOCUMENT EXCERPTS (supplementary) ===\n" + chunk_supplement
        if chunk_supplement.strip() else ""
    )
    return (
        "=== CONTEXT PROFILE (AI-extracted + user-edited) ===\n"
        + context_profile
        + "\n\n=== UPLOADED DOCUMENTS ===\n"
        + docs_block
        + supplement_block
        + "\n=== SIMILAR HISTORICAL ASSESSMENTS ===\n"
        + (historical_summary or "None")
    ).strip()


def _fallback_suggested_questions(ra: Any, chunks: list[dict]) -> list[dict]:
    context_text = " ".join([
        ra.title, ra.description,
        json.dumps(ra.context_profile or {}, sort_keys=True),
        " ".join(str(chunk.get("text", "")) for chunk in chunks[:10]),
    ]).lower()
    questions: list[dict] = []

    def add(question_id: str, section_id: str, text: str, question_type: str, priority: str, rationale: str) -> None:
        questions.append({
            "question_id": question_id, "section_id": section_id,
            "section_title": "Context Driven Questions", "text": text,
            "question_type": question_type, "priority": priority,
            "source": "context_rule", "rationale": rationale, "status": "suggested",
        })

    if any(t in context_text for t in ["gdpr", "personal data", "pii", "data subject", "privacy"]):
        add("dyn_gdpr_001", "privacy_regulatory", "Does the project process personal data for EU or UK data subjects?", "Exposure", "high", "Privacy or GDPR context was detected.")
        add("dyn_gdpr_002", "privacy_regulatory", "Has the lawful basis for personal data processing been documented?", "Control", "high", "GDPR requires a documented lawful basis.")
        add("dyn_gdpr_003", "privacy_regulatory", "Are data retention, subprocessors, and cross-border transfers documented?", "Control", "high", "GDPR obligations may apply to retention and third-party processing.")
    if any(t in context_text for t in ["jira", "ticket", "defect", "bug", "incident", "backlog"]):
        add("dyn_jira_001", "delivery_risk", "Are unresolved high-priority Jira items relevant to security, privacy, or availability?", "Exposure", "medium", "Jira or delivery issue context was detected.")
        add("dyn_jira_002", "delivery_risk", "Are owners and due dates assigned for open remediation or security tickets?", "Control", "medium", "Open delivery items may affect the current risk posture.")
    if any(t in context_text for t in ["mfa", "encryption", "logging", "vulnerability", "secrets", "iam", "authentication"]):
        add("dyn_sec_001", "security_requirements", "Are explicit security requirements mapped to implemented controls and evidence?", "Control", "high", "Security requirements were detected in the context.")
        add("dyn_sec_002", "security_requirements", "Are logging, monitoring, encryption, secrets management, and access controls covered by the design?", "Control", "high", "Core security-control topics were detected.")
    if not questions:
        add("dyn_context_001", "business_context", "What business outcome would be impacted if this project or application failed?", "Context", "medium", "Additional impact context improves risk scoring.")
        add("dyn_context_002", "business_context", "Are there regulatory, privacy, security, or contractual requirements that must be considered?", "Context", "medium", "No specific compliance trigger was detected yet.")
    return questions


def _resolve_subject_profile(asset_store: Any, asset_id: str, ad_hoc_map: dict[str, dict]) -> dict[str, Any]:
    asset = asset_store.get(asset_id)
    ad_hoc = ad_hoc_map.get(asset_id)
    if asset:
        return {
            "id": asset_id,
            "name": asset.name,
            "description": getattr(asset, "description", ""),
            "use": getattr(asset, "use", ""),
            "type": getattr(asset, "type", "Registered Asset"),
            "owner": getattr(asset, "owner", ""),
            "custodian": getattr(asset, "custodian", ""),
            "support_type": getattr(asset, "support_type", None),
            "hosting_type": getattr(asset, "hosting_type", None),
            "location": getattr(asset, "location", ""),
            "classification": getattr(asset, "classification", ""),
            "jurisdiction": getattr(asset, "jurisdiction", ""),
            "confidentiality": getattr(asset, "confidentiality", 0),
            "integrity": getattr(asset, "integrity", 0),
            "availability": getattr(asset, "availability", 0),
            "cia_total": getattr(asset, "cia_total", 0),
            "criticality": getattr(asset, "criticality", "Unknown"),
        }
    if ad_hoc:
        cia_total, criticality = _cia_band_from_values(
            ad_hoc.get("confidentiality", 3),
            ad_hoc.get("integrity", 3),
            ad_hoc.get("availability", 3),
        )
        return {
            "id": asset_id,
            "name": ad_hoc.get("name", asset_id),
            "description": ad_hoc.get("description", ""),
            "type": "Ad hoc application",
            "owner": ad_hoc.get("owner", ""),
            "support_type": ad_hoc.get("support_type", None),
            "hosting_type": ad_hoc.get("hosting_type", None),
            "classification": ad_hoc.get("classification", ""),
            "jurisdiction": ad_hoc.get("jurisdiction", ""),
            "confidentiality": ad_hoc.get("confidentiality", 3),
            "integrity": ad_hoc.get("integrity", 3),
            "availability": ad_hoc.get("availability", 3),
            "cia_total": cia_total,
            "criticality": criticality,
        }
    return {
        "id": asset_id,
        "name": asset_id,
        "description": "",
        "type": "Unknown subject",
        "owner": "",
        "support_type": None,
        "hosting_type": None,
        "classification": "",
        "jurisdiction": "",
        "confidentiality": 0,
        "integrity": 0,
        "availability": 0,
        "cia_total": 0,
        "criticality": "Unknown",
    }
