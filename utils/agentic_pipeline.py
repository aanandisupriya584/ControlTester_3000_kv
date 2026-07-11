"""
Multi-agent orchestration pipeline using LangGraph.

Graph topology (same for Phase 1 and Phase 2):

    START
      │
      ▼
  Orchestrator ──► SA ──► Orchestrator ──► RA ──► Orchestrator ──► QA
      ▲                        ▲                        │
      │                        │                        ▼
      │                   Orchestrator ◄────────────────┘
      │                        │   (round 2 starts)
      │                        ▼
      │                        SA ──► Orchestrator ──► RA ──► Orchestrator ──► QA
      │                                                                          │
      └──────────────────────────────────────────────────────────────────────────┘
                                                                                 │
                                                                                END

Key design principles:
  - Orchestrator node runs between EVERY agent call — always active
  - Orchestrator manages queue position, round tracking, and routing
  - All agent outputs are stored in a shared `outputs` dict in state
  - Every agent in every round sees ALL previous agents' outputs (bidirectional context)
  - 2 rounds × 3 agents = 6 LLM calls total per pipeline run
  - Phase 1: question generation   (called before questionnaire)
  - Phase 2: risk identification   (called after answers submitted)
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict

import pymongo

logger = logging.getLogger(__name__)


# ── Decision trail store ──────────────────────────────────────────────────────

def _trail_col():
    """Return the agent_decision_trail MongoDB collection (lazy singleton)."""
    uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    client = pymongo.MongoClient(uri)
    col = client["trace_db"]["agent_decision_trail"]
    col.create_index("ra_id")
    col.create_index("phase")
    col.create_index([("ra_id", 1), ("phase", 1), ("step", 1)])
    return col


def _record_orchestrator_step(
    ra_id: str,
    phase: str,
    step: int,
    round_number: int,
    last_agent: str,
    next_agent: str,
    action: str,
    queue_position: int,
) -> None:
    """Persist one orchestrator routing decision to the decision trail."""
    try:
        _trail_col().insert_one({
            "_id": str(uuid.uuid4()),
            "ra_id": ra_id,
            "phase": phase,
            "step": step,
            "round": round_number,
            "agent": "orchestrator",
            "role": "routing",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_ms": None,
            "status": "routing",
            "routing_decision": {
                "last_agent": last_agent,
                "next_agent": next_agent,
                "action": action,
                "queue_position": queue_position,
                "round_number": round_number,
            },
            "prompt": None,
            "raw_response": None,
            "parsed_output": None,
            "error": None,
        })
    except Exception as exc:
        logger.warning(f"[Trail] Failed to record orchestrator step: {exc}")


def _record_agent_step(
    ra_id: str,
    phase: str,
    step: int,
    round_number: int,
    agent_name: str,
    prompt: str,
    raw_response: str | None,
    parsed_output: dict | None,
    duration_ms: int,
    status: str,
    error: str | None = None,
) -> None:
    """Persist one agent execution (full prompt + response) to the decision trail."""
    try:
        _trail_col().insert_one({
            "_id": str(uuid.uuid4()),
            "ra_id": ra_id,
            "phase": phase,
            "step": step,
            "round": round_number,
            "agent": agent_name,
            "role": "execution",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_ms": duration_ms,
            "status": status,
            "routing_decision": None,
            "prompt": prompt,
            "raw_response": raw_response,
            "parsed_output": parsed_output,
            "error": error,
        })
    except Exception as exc:
        logger.warning(f"[Trail] Failed to record agent step for {agent_name}: {exc}")

# ── Helpers ──────────────────────────────────────────────────────────────────

_JSON_STRIP = re.compile(r"(^```[a-zA-Z]*\n?|\n?```$)")


def _parse_json(raw: str) -> Any:
    return json.loads(_JSON_STRIP.sub("", raw.strip()).strip())


def _asset_block(assets: "list[dict] | dict") -> str:
    if not assets:
        return "No asset registry data available."
    if isinstance(assets, dict):
        assets = [assets]

    def _single(asset: dict, index: int, total: int) -> str:
        header = f"--- Asset {index + 1} of {total} ---\n" if total > 1 else ""
        lines = [
            f"Name           : {asset.get('name', 'Unknown')}",
            f"Type           : {asset.get('type', 'Unknown')}",
            f"Description    : {asset.get('description', '')}",
            f"Business Use   : {asset.get('use', '')}",
            f"Owner          : {asset.get('owner', '')}",
            f"Custodian      : {asset.get('custodian', '')}",
            f"Classification : {asset.get('classification', '')}",
            f"Jurisdiction   : {asset.get('jurisdiction', '')}",
            f"Location       : {asset.get('location', '')}",
            f"Hosting        : {asset.get('hosting_type', '')}",
            f"Support Type   : {asset.get('support_type', '')}",
            f"Criticality    : {asset.get('criticality', 'Unknown')}",
            f"CIA            : C={asset.get('confidentiality', 0)} "
            f"I={asset.get('integrity', 0)} "
            f"A={asset.get('availability', 0)} "
            f"(total={asset.get('cia_total', 0)})",
        ]
        body = "\n".join(line for line in lines if not line.endswith(": "))
        return header + body

    return "\n\n".join(_single(a, i, len(assets)) for i, a in enumerate(assets))


_MAX_OBLIGATIONS_PER_FRAMEWORK = 40   # per applicable framework
_MAX_OBLIGATION_TEXT_CHARS = 220       # per obligation text

# Frameworks that apply universally regardless of jurisdiction or sector
_UNIVERSAL_FRAMEWORKS = frozenset({
    "iso 27001", "iso27001", "iso/iec 27001",
    "nist csf", "nist", "nist sp",
    "soc 2", "soc2", "soc",
    "cis", "cis controls",
})

# Maps asset jurisdiction keywords → framework name keywords that apply
_JURISDICTION_FRAMEWORK_MAP: dict[str, list[str]] = {
    "india":       ["dpdp", "rbi", "sebi", "cert-in", "it act", "npci", "irdai"],
    "eu":          ["gdpr", "nis2", "dora", "eudpr"],
    "europe":      ["gdpr", "nis2", "dora", "eudpr"],
    "european":    ["gdpr", "nis2", "dora"],
    "uk":          ["uk gdpr", "fca", "ico", "gdpr"],
    "singapore":   ["mas trm", "mas", "pdpa", "sgx"],
    "us":          ["hipaa", "ccpa", "glba", "ferpa", "fisma", "nist"],
    "usa":         ["hipaa", "ccpa", "glba", "ferpa", "fisma", "nist"],
    "australia":   ["apra", "privacy act", "aps"],
    "uae":         ["nesa", "cbuae", "difc"],
    "hong kong":   ["hkma", "pcpd"],
}

# Maps asset sector keywords (from description/use/type) → framework name keywords
_SECTOR_FRAMEWORK_MAP: dict[str, list[str]] = {
    "payment":        ["pci-dss", "pci dss", "pci", "rbi"],
    "financial":      ["pci-dss", "pci dss", "pci", "mas trm", "rbi"],
    "fintech":        ["pci-dss", "pci dss", "pci", "mas trm", "rbi"],
    "banking":        ["pci-dss", "pci dss", "mas trm", "rbi"],
    "card":           ["pci-dss", "pci dss", "pci"],
    "health":         ["hipaa"],
    "healthcare":     ["hipaa"],
    "medical":        ["hipaa"],
    "cloud":          ["soc 2", "csa star"],
    "saas":           ["soc 2"],
    "personal data":  ["gdpr", "dpdp"],
    "pii":            ["gdpr", "dpdp"],
    "government":     ["fisma", "nist"],
    "critical infra": ["nis2", "nist"],
}


def _asset_sector_profile(assets: list[dict]) -> str:
    """Combine all text fields across assets to build a sector-matching profile."""
    parts = []
    for a in assets:
        for field in ("type", "classification", "use", "description", "name"):
            val = a.get(field) or ""
            if val:
                parts.append(val.lower())
    return " ".join(parts)


def _framework_applicability(fw_name: str, assets: list[dict]) -> tuple[bool, str]:
    """Return (is_applicable, reason) for a framework given the asset profiles."""
    fw_lower = fw_name.lower()

    # 1 — Universal frameworks always apply
    if any(u in fw_lower for u in _UNIVERSAL_FRAMEWORKS):
        return True, "universal — applies to all technology assets"

    # 2 — Check asset jurisdictions
    for asset in assets:
        jurisdiction = (asset.get("jurisdiction") or "").lower()
        for jur_key, fw_keywords in _JURISDICTION_FRAMEWORK_MAP.items():
            if jur_key in jurisdiction:
                if any(kw in fw_lower for kw in fw_keywords):
                    return True, f"jurisdiction match — asset '{asset.get('name', '')}' is in {asset.get('jurisdiction', '')}"

    # 3 — Check asset sector profile
    sector_text = _asset_sector_profile(assets)
    for sector_key, fw_keywords in _SECTOR_FRAMEWORK_MAP.items():
        if sector_key in sector_text:
            if any(kw in fw_lower for kw in fw_keywords):
                return True, f"sector match — '{sector_key}' detected in asset profile"

    return False, "no matching jurisdiction or sector detected in asset registry"


def _log_jurisdiction_decisions(ra_id: str, phase: str, decisions: list[dict]) -> None:
    """Log per-framework jurisdiction applicability decisions to agent_decision_trail."""
    try:
        _trail_col().insert_one({
            "_id": str(uuid.uuid4()),
            "ra_id": ra_id,
            "phase": phase,
            "step": 0,
            "round": 0,
            "agent": "jurisdiction_filter",
            "role": "jurisdiction_filtering",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_ms": None,
            "status": "complete",
            "routing_decision": None,
            "prompt": None,
            "raw_response": None,
            "parsed_output": {
                "framework_decisions": decisions,
                "applicable_count": sum(1 for d in decisions if d["applicable"]),
                "excluded_count": sum(1 for d in decisions if not d["applicable"]),
            },
            "error": None,
        })
    except Exception as exc:
        logger.warning(f"[Trail] Failed to log jurisdiction decisions for {ra_id}: {exc}")


def _build_regulatory_context_for_assets(assets: list[dict], ra_id: str = "", phase: str = "") -> str:
    """Build a jurisdiction-filtered regulatory obligation block for the RA agent.

    For each framework in the regulatory library:
    - Determines if it is applicable to the given assets (by jurisdiction/sector)
    - Includes actual obligation text for applicable frameworks
    - Lists non-applicable frameworks with the reason they were excluded
    - Every applicability decision is explicit so the RA agent doesn't need to guess
    - When ra_id is provided, decisions are logged to agent_decision_trail
    """
    try:
        from utils.regulatory_library import MongoLibraryStore
        store = MongoLibraryStore()
        if not store.is_connected:
            return "Regulatory library unavailable."
        docs = store.list_documents()
        if not docs:
            return "No frameworks loaded in the regulatory library yet."

        # Fetch all mandatory + recommended obligations grouped by framework
        mandatory = store.search_obligations(enforcement_level="mandatory")
        recommended = store.search_obligations(enforcement_level="recommended")
        all_obligations = mandatory + recommended

        by_framework: dict[str, list[dict]] = {}
        for obl in all_obligations:
            fw = obl.get("framework_name") or obl.get("source_filename", "Unknown")
            by_framework.setdefault(fw, []).append(obl)

        # Also capture frameworks that were loaded but have zero obligations yet
        loaded_names = {
            (doc.get("framework_name") or doc.get("source_filename", "Unknown"))
            for doc in docs
        }

        applicable_lines: list[str] = []
        not_applicable_lines: list[str] = []
        jurisdiction_decisions: list[dict] = []

        for fw_name in sorted(loaded_names):
            is_applicable, reason = _framework_applicability(fw_name, assets)
            obligations = by_framework.get(fw_name, [])
            obligation_count = len(obligations)

            jurisdiction_decisions.append({
                "framework": fw_name,
                "applicable": is_applicable,
                "reason": reason,
                "obligation_count": obligation_count,
            })

            if is_applicable:
                applicable_lines.append(f"\n[{fw_name}]  ✓ APPLICABLE — {reason}")
                if not obligations:
                    applicable_lines.append("  (no obligations extracted yet — framework loaded but not yet analysed)")
                else:
                    # Mandatory first, then recommended, capped per framework
                    sorted_obls = sorted(
                        obligations,
                        key=lambda o: 0 if o.get("enforcement_level") == "mandatory" else 1
                    )[:_MAX_OBLIGATIONS_PER_FRAMEWORK]
                    for obl in sorted_obls:
                        ref = obl.get("section_reference", "")
                        text = (obl.get("obligation_text") or "")[:_MAX_OBLIGATION_TEXT_CHARS]
                        domain = obl.get("domain", "")
                        level = obl.get("enforcement_level", "mandatory")
                        prefix = f"  {ref}: " if ref else "  "
                        applicable_lines.append(f"{prefix}{text}  [{domain}] ({level})")
            else:
                not_applicable_lines.append(f"  • {fw_name} — {reason}")

        if ra_id and jurisdiction_decisions:
            _log_jurisdiction_decisions(ra_id, phase or "pre_pipeline", jurisdiction_decisions)

        lines = ["=== REGULATORY LIBRARY — JURISDICTION-FILTERED ==="]
        if applicable_lines:
            lines.append("\n--- APPLICABLE TO THIS ASSESSMENT ---")
            lines.extend(applicable_lines)
        else:
            lines.append("\n(No loaded frameworks matched the asset jurisdiction or sector.)")
            lines.append("⚠ ACCURACY INSTRUCTION: No frameworks are loaded for this jurisdiction.")
            lines.append("Do NOT invent regulatory obligations. You may note which frameworks are")
            lines.append("commonly required for this jurisdiction and recommend they be loaded,")
            lines.append("but do NOT assert specific clause numbers or requirements from memory.")

        if not_applicable_lines:
            lines.append("\n--- NOT APPLICABLE (excluded from analysis) ---")
            lines.extend(not_applicable_lines)

        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"[RA] Could not build regulatory context: {exc}")
        return "Regulatory library could not be loaded."


def _primary_jurisdictions(assets: "list[dict] | dict") -> str:
    """Return a comma-separated string of unique jurisdictions across all assets."""
    if isinstance(assets, dict):
        return assets.get("jurisdiction", "unknown") or "unknown"
    jurisdictions = list(dict.fromkeys(
        a.get("jurisdiction", "") for a in assets if a.get("jurisdiction")
    ))
    return ", ".join(jurisdictions) if jurisdictions else "unknown"


# ── Document Classification Agent ─────────────────────────────────────────────

# Document types the classifier maps to
_DOC_TYPE_BUCKETS = [
    "architecture_doc",
    "project_plan",
    "jira_export",
    "security_policy",
    "compliance_doc",
    "sow",
    "vapt_report",
    "threat_model",
    "incident_report",
    "data_flow_diagram",
    "vendor_assessment",
    "other",
]

# Content signals that make a document always irrelevant to a technology risk assessment.
# Checked against both the filename and the first 500 chars of extracted text.
_IRRELEVANT_CONTENT_SIGNALS = [
    # Personal / career documents
    "resume", "curriculum vitae", "cover letter", "job application",
    "personal statement", "work history", "employment history",
    "reference letter", "recommendation letter", "offer letter",
    "appointment letter", "resignation letter", "termination letter",
    # HR & people management
    "payroll", "salary", "payslip", "pay stub", "pay slip",
    "leave policy", "leave application", "attendance record",
    "performance review", "appraisal", "kra ", "kpi report",
    "employee handbook", "hr policy", "disciplinary",
    # Financial / accounting
    "tax return", "income tax", "gst invoice", "vat invoice",
    "invoice", "receipt", "purchase order", "expense report",
    "financial statement", "profit and loss", "balance sheet",
    "bank statement", "credit card statement", "salary slip",
    "audit report of accounts", "annual report (financial)",
    "budget proposal", "cost estimate",
    # Legal / personal legal
    "court order", "legal notice", "summons", "affidavit",
    "divorce decree", "will and testament", "power of attorney",
    "rental agreement", "lease agreement", "property deed",
    # Medical / health
    "medical report", "prescription", "lab report", "health certificate",
    "discharge summary", "clinical notes",
    # Marketing / sales / PR
    "marketing plan", "advertisement", "brochure", "press release",
    "product catalog", "sales pitch", "promotional material",
    "social media post", "newsletter",
    # Academic / educational
    "grade transcript", "mark sheet", "academic certificate",
    "exam result", "admit card",
    # Travel / logistics
    "travel itinerary", "boarding pass", "flight ticket",
    "hotel booking", "visa application",
    # Food / lifestyle / personal
    "recipe", "menu", "grocery",
]


def classify_document_for_risk_assessment(
    ra_id: str,
    filename: str,
    text_excerpt: str,
    doc_metadata: dict,
    user_tag: str | None = None,
) -> dict:
    """Document Classification Agent — runs at upload time, before the SA/RA/QA pipeline.

    Determines:
    1. What type of document this is (architecture_doc, vapt_report, etc.)
    2. Whether the document is relevant to a cybersecurity risk assessment
    3. Whether to override the user-provided tag

    Every decision is logged to agent_decision_trail with full reasoning.

    Returns a dict:
        {
          "relevant": bool,
          "classified_type": str,
          "user_tag": str | None,
          "overrides_user_tag": bool,
          "confidence": "high" | "medium" | "low",
          "reasoning": str,
          "rejection_reason": str   # only when relevant=False
        }
    """
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    lower_filename = filename.lower()
    risk_flags = doc_metadata.get("risk_flags", [])
    doc_type_from_vision = doc_metadata.get("document_type", "")

    # Filename-only pre-filter: skip the LLM call for files whose name alone makes
    # irrelevance unambiguous (e.g. "John_Resume_2024.pdf", "salary_slip_march.xlsx").
    # Content-based decisions — including edge cases like a resume named "document.pdf" —
    # are always delegated to the LLM below.
    for signal in _IRRELEVANT_CONTENT_SIGNALS:
        if signal in lower_filename:
            result = {
                "relevant": False,
                "classified_type": "other",
                "user_tag": user_tag,
                "overrides_user_tag": bool(user_tag and user_tag != "other"),
                "confidence": "high",
                "reasoning": f"Filename contains '{signal}' — document is clearly outside the scope of a cybersecurity risk assessment.",
                "rejection_reason": f"The filename '{filename}' indicates this is a '{signal}' document, which is not relevant to a risk assessment.",
            }
            _log_doc_classification(ra_id, filename, user_tag, result)
            return result

    # LLM-based classification for everything else
    excerpt = text_excerpt[:3000]
    metadata_summary = (
        f"Document type detected by vision: {doc_type_from_vision}\n"
        f"Technologies mentioned: {', '.join(doc_metadata.get('technologies', [])[:10])}\n"
        f"Regulations mentioned: {', '.join(doc_metadata.get('regulations', [])[:10])}\n"
        f"Data types: {', '.join(doc_metadata.get('data_types', [])[:8])}\n"
        f"Risk flags: {'; '.join(risk_flags[:5])}\n"
        f"Third parties: {', '.join(doc_metadata.get('third_parties', [])[:5])}"
    )
    user_tag_line = f"User-provided document tag: {user_tag}" if user_tag else "No user-provided tag."

    prompt = f"""You are a Document Classification Agent for a cybersecurity and technology risk assessment platform.

Your job is to READ the document content below and determine:
1. What TYPE of document this is
2. Whether this document is RELEVANT to a technology / cybersecurity risk assessment

CRITICAL INSTRUCTION: Base your decision on WHAT THE DOCUMENT ACTUALLY DESCRIBES, not on
the file format or the presence of technology keywords. A resume that lists Python and Java
as skills is NOT relevant. A grocery list saved as a PDF is NOT relevant. A security policy
saved as a plain text file IS relevant. Read the content and judge what the document IS.

=== FILENAME ===
{filename}

=== DOCUMENT CONTENT EXCERPT (first 3000 chars) ===
{excerpt}

=== METADATA EXTRACTED BY VISION/TEXT LLM ===
{metadata_summary}

=== USER-PROVIDED TAG ===
{user_tag_line}

HOW TO DECIDE RELEVANCE — ask yourself these questions about the document:

  ACCEPT if the document describes or contains ANY of:
  • A technology system, application, platform, or infrastructure (what it is, how it works,
    its architecture, components, integrations, or deployment)
  • Security controls, policies, procedures, or access management rules
  • Vulnerabilities, security findings, pen test results, or audit observations
  • Regulatory obligations, compliance requirements, or control frameworks (GDPR, PCI-DSS,
    ISO 27001, SOC 2, HIPAA, DPDP, NIST, CIS, etc.)
  • Data flows, data types processed/stored, or data sensitivity classifications
  • Risk findings, threat actors, attack surfaces, or incident records
  • Vendor or third-party security posture
  • IT project plans, SOWs, or technical specifications in scope for the assessment
  • Business continuity, disaster recovery, or resilience plans

  REJECT if the document is primarily:
  • A personal profile document (resume, CV, bio, cover letter, job application)
  • A financial record (invoice, receipt, bank statement, tax return, payroll, salary slip)
  • An HR document (leave policy, attendance, performance review, offer letter, handbook)
  • A legal/personal document (court order, will, rental agreement, property deed, NDA
    unrelated to an IT vendor relationship)
  • A medical record (prescription, lab report, clinical note)
  • A marketing/sales document (brochure, advertisement, press release, catalog)
  • An academic document (transcript, mark sheet, certificate unrelated to security)
  • A personal/lifestyle document (travel itinerary, recipe, social media post, grocery list)
  • Any document whose content has no bearing on the security, risk, or compliance posture
    of a technology system or business process

  IMPORTANT EDGE CASES:
  • A document mentioning technology tools (Python, AWS, SQL) is NOT automatically relevant —
    those tools must appear in the context of a SYSTEM being assessed, not as personal skills.
  • A generic business meeting agenda is NOT relevant unless it specifically covers security
    or IT risk topics.
  • If you are genuinely uncertain, lean toward ACCEPTING — a false accept is less harmful
    than rejecting a relevant document the assessor uploaded intentionally.

- If the user provided a tag, treat it as a hint. Override it if the content clearly shows
  a different document type. ALWAYS document your reasoning.

Return ONLY valid JSON:
{{
  "relevant": true | false,
  "classified_type": "one of: {' | '.join(_DOC_TYPE_BUCKETS)}",
  "overrides_user_tag": true | false,
  "confidence": "high | medium | low",
  "reasoning": "1-2 sentences explaining your classification and relevance decision",
  "rejection_reason": "if relevant=false: specific reason why this document is excluded"
}}"""

    t0 = time.monotonic()
    raw_response, status, error_msg = None, "success", None
    result: dict = {}
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        raw_response = response.content
        parsed = _parse_json(raw_response)
        if not isinstance(parsed, dict):
            raise ValueError("non-dict response")
        result = {
            "relevant": bool(parsed.get("relevant", True)),
            "classified_type": parsed.get("classified_type", doc_type_from_vision or "other"),
            "user_tag": user_tag,
            "overrides_user_tag": bool(parsed.get("overrides_user_tag", False)),
            "confidence": parsed.get("confidence", "medium"),
            "reasoning": parsed.get("reasoning", ""),
            "rejection_reason": parsed.get("rejection_reason", ""),
        }
    except Exception as exc:
        status, error_msg = "failed", str(exc)
        logger.warning(f"[DocClassifier] LLM classification failed for {filename}: {exc}")
        # Fallback: use vision-extracted document_type, assume relevant
        result = {
            "relevant": True,
            "classified_type": doc_type_from_vision or "other",
            "user_tag": user_tag,
            "overrides_user_tag": False,
            "confidence": "low",
            "reasoning": f"LLM classifier failed ({exc}); defaulting to vision-extracted type.",
            "rejection_reason": "",
        }

    duration_ms = int((time.monotonic() - t0) * 1000)
    _log_doc_classification(ra_id, filename, user_tag, result, raw_response, duration_ms, status, error_msg)
    return result


def _log_doc_classification(
    ra_id: str,
    filename: str,
    user_tag: str | None,
    result: dict,
    raw_response: str | None = None,
    duration_ms: int = 0,
    status: str = "success",
    error: str | None = None,
) -> None:
    """Write document classification decision to agent_decision_trail."""
    try:
        col = _trail_col()
        col.insert_one({
            "ra_id": ra_id,
            "phase": "doc_classification",
            "step": 0,
            "round_number": 0,
            "agent_name": "document_classifier",
            "filename": filename,
            "user_tag": user_tag,
            "decision": result,
            "raw_llm_response": raw_response,
            "duration_ms": duration_ms,
            "status": status,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.warning(f"[DocClassifier] Failed to log classification for {filename}: {exc}")


def _static_questions_summary(sections: list[dict]) -> str:
    lines = []
    for section in sections:
        lines.append(f"Section: {section.get('title', section.get('id', ''))}")
        for q in section.get("questions", []):
            lines.append(f"  - [{q.get('id', '')}] {q.get('text', '')}")
    return "\n".join(lines)


# ── LangGraph State ───────────────────────────────────────────────────────────

class PipelineState(TypedDict):
    # ── Fixed inputs ──────────────────────────────────────
    ra_id: str
    phase: str                      # "phase1" | "phase2"
    context_pack: str               # full document + context profile text
    asset: list                     # all asset registry profiles in scope
    static_questions_summary: str   # Phase 1 only
    regulatory_library_summary: str # obligation text from the regulatory library

    # Phase 2 specific
    questionnaire_answers: list
    controls_library: list

    # ── Orchestrator queue state ──────────────────────────
    round_number: int               # 1 or 2
    max_rounds: int                 # always 2
    current_index: int              # position in ["sa","ra","qa"]
    last_agent: str                 # which node just ran
    global_step: int                # monotonic step counter across all rounds (for trail ordering)

    # ── Accumulated outputs (all agents × all rounds) ─────
    # Structure: {"round_1": {"sa": {...}, "ra": {...}, "qa": {...}},
    #             "round_2": {"sa": {...}, "ra": {...}, "qa": {...}}}
    outputs: dict

    # ── Final results ─────────────────────────────────────
    final_questions: list           # Phase 1 output
    validated_risks: list           # Phase 2 output
    qa_final_notes: str


_QUEUE = ["sa", "ra", "qa"]

# ── Context builders — each agent sees exactly what it should ─────────────────

def _prior_rounds_block(outputs: dict, current_round: int, full_lists: bool = False) -> str:
    """Summarise ALL previous rounds' outputs for context carry-forward.

    When full_lists=True (used in Round 2 so agents can collaborate rather than
    re-derive), includes the complete question/risk lists from each agent so
    Round 2 agents know exactly what was already found and can fill gaps instead
    of repeating work.
    """
    parts = []
    for r in range(1, current_round):
        rk = f"round_{r}"
        ro = outputs.get(rk, {})

        if ro.get("sa"):
            sa = ro["sa"]
            sa_qs = sa.get("questions") or sa.get("risks") or []
            if full_lists and sa_qs:
                q_text = "\n".join(
                    f"  [{i+1}] {q.get('text') or q.get('title','')} "
                    f"[{q.get('priority','') or q.get('inherent_risk_band','')}]"
                    for i, q in enumerate(sa_qs[:12])
                )
                parts.append(
                    f"[Round {r} — Security Architect — FULL OUTPUT]\n"
                    f"Notes: {sa.get('notes', '')}\n"
                    f"All items proposed ({len(sa_qs)}):\n{q_text}"
                )
            else:
                parts.append(
                    f"[Round {r} — Security Architect]\n"
                    f"Notes: {sa.get('notes', '')}\n"
                    f"Items proposed: {len(sa_qs)}"
                )

        if ro.get("ra"):
            ra = ro["ra"]
            ra_qs = ra.get("questions") or ra.get("risks") or []
            regs = ra.get("applicable_regulations", [])
            if full_lists and ra_qs:
                q_text = "\n".join(
                    f"  [{i+1}] {q.get('text') or q.get('title','')} "
                    f"[{q.get('priority','') or q.get('inherent_risk_band','')}]"
                    for i, q in enumerate(ra_qs[:12])
                )
                parts.append(
                    f"[Round {r} — Regulatory Analyst — FULL OUTPUT]\n"
                    f"Notes: {ra.get('notes', '')}\n"
                    f"Regulations identified: {', '.join(regs)}\n"
                    f"All items proposed ({len(ra_qs)}):\n{q_text}"
                )
            else:
                parts.append(
                    f"[Round {r} — Regulatory Analyst]\n"
                    f"Notes: {ra.get('notes', '')}\n"
                    f"Regulations identified: {', '.join(regs)}"
                )

        if ro.get("qa"):
            parts.append(
                f"[Round {r} — Quality Analyst Feedback]\n"
                f"{ro['qa'].get('qa_notes', '')}"
            )

    return "\n\n".join(parts) if parts else ""


def _sa_context(state: PipelineState) -> str:
    """SA sees prior rounds — full lists in Round 2 so it can fill gaps, not repeat work."""
    full = state["round_number"] >= 2
    return _prior_rounds_block(state["outputs"], state["round_number"], full_lists=full)


def _ra_context(state: PipelineState) -> str:
    """RA sees: SA from THIS round (full list) + all previous rounds.

    In Round 2 the full prior-round lists are shown so RA can explicitly map
    each SA risk/question to a regulation rather than re-deriving the whole list.
    """
    outputs = state["outputs"]
    rk = f"round_{state['round_number']}"
    full = state["round_number"] >= 2
    parts = []
    sa_now = outputs.get(rk, {}).get("sa", {})
    if sa_now:
        sa_items = sa_now.get("questions") or sa_now.get("risks") or []
        item_text = "\n".join(
            f"  [{i+1}] {q.get('text') or q.get('title','')} [{q.get('priority','') or q.get('inherent_risk_band','')}]"
            for i, q in enumerate(sa_items[:12])
        )
        parts.append(
            f"[Round {state['round_number']} — Security Architect (just ran)]\n"
            f"Notes: {sa_now.get('notes', '')}\n"
            f"All items ({len(sa_items)}):\n{item_text}"
        )
    prior = _prior_rounds_block(outputs, state["round_number"], full_lists=full)
    if prior:
        parts.append(prior)
    return "\n\n".join(parts) if parts else ""


def _qa_context(state: PipelineState) -> str:
    """QA sees: SA + RA from THIS round + all previous rounds."""
    outputs = state["outputs"]
    rk = f"round_{state['round_number']}"
    parts = []
    sa_now = outputs.get(rk, {}).get("sa", {})
    ra_now = outputs.get(rk, {}).get("ra", {})
    if sa_now:
        parts.append(
            f"[Round {state['round_number']} — Security Architect]\n"
            f"Notes: {sa_now.get('notes', '')}"
        )
    if ra_now:
        parts.append(
            f"[Round {state['round_number']} — Regulatory Analyst]\n"
            f"Notes: {ra_now.get('notes', '')}\n"
            f"Regulations: {', '.join(ra_now.get('applicable_regulations', []))}"
        )
    prior = _prior_rounds_block(outputs, state["round_number"])
    if prior:
        parts.append(prior)
    return "\n\n".join(parts) if parts else ""


# ── Phase 1 agent nodes ───────────────────────────────────────────────────────

def _sa_phase1(state: PipelineState) -> dict:
    """Security Architect — generates security questions."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    prior = _sa_context(state)
    is_round2 = state["round_number"] >= 2
    round_mandate = (
        "ROUND 2 — COLLABORATIVE GAP-FILLING\n"
        "The Regulatory Analyst and Quality Analyst completed Round 1. Their full outputs appear "
        "below in 'PRIOR ROUND CONTEXT'. Your job in Round 2 is NOT to repeat what was already found.\n"
        "Instead:\n"
        "  • Identify security risks/questions that Round 1 MISSED entirely.\n"
        "  • Drill deeper into specific issues the QA flagged as needing more detail.\n"
        "  • Look for cross-cutting risks implied by combining RA's regulatory gaps with your technical findings.\n"
        "  • Add questions for findings in the documents that neither Round 1 SA nor RA covered."
        if is_round2 else
        "ROUND 1 — INDEPENDENT ANALYSIS\n"
        "Read ALL available context and produce your best independent analysis. "
        "The Regulatory Analyst and Quality Analyst will build on your work."
    )
    prompt = f"""You are a senior security architect conducting a formal application risk assessment.
{round_mandate}

ACCURACY RULES — READ BEFORE GENERATING:
1. Only assert what is EXPLICITLY stated in the documents or asset profile below.
2. Do NOT invent technical details, architecture components, or vulnerabilities that are not visible in the provided context.
3. Every question's rationale MUST cite either: (a) a specific section/page/finding from the uploaded documents, or (b) a named attribute from the asset profile (CIA score, jurisdiction, hosting type, classification, etc.). "Common best practice" or "general security concern" are not acceptable rationale — remove the question instead.
4. If no documents were uploaded, derive questions ONLY from the asset profile — clearly label the source as "asset profile".
5. If you cannot cite a specific grounding source, do not generate that question.

QUESTION TYPE RULES — assign question_type correctly; it controls how each answer is weighted in risk scoring:
- "Control": The question asks whether a specific security safeguard, process, or protection IS in place (e.g. "Is encryption enforced at rest?", "Are access reviews conducted quarterly?"). A NO answer will be treated as a confirmed control gap and trigger a mandatory risk.
- "Exposure": The question asks whether a specific risky condition IS present (e.g. "Is this service directly internet-facing?", "Does this system process unencrypted PII?"). A YES answer will be treated as a confirmed risk condition and trigger a mandatory risk.
- "Context": Use ONLY when neither Control nor Exposure fits — e.g. open-ended questions about architecture intent or configuration details where YES and NO are both ambiguous. Use sparingly; prefer Control or Exposure wherever possible.

=== ASSET PROFILE ===
{_asset_block(state['asset'])}

=== CONTEXT (documents + project details) ===
{state['context_pack']}

=== STATIC QUESTION BANK (do NOT duplicate) ===
{state['static_questions_summary']}

{f"=== PRIOR ROUND CONTEXT (Round 1 full outputs) ==={chr(10)}{prior}" if prior else ""}

Focus on: architecture gaps, vulnerabilities in uploaded documents, trust boundaries,
encryption weaknesses, secrets exposure, API security, third-party risks, supply chain.

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question_id": "sa_r{state['round_number']}_<snake_case>",
      "section_id": "access_control|data_protection|vulnerability_management|incident_response|third_party_risk|architecture|cloud_security|identity_management|delivery_risk|compliance",
      "section_title": "<human readable>",
      "text": "<specific question referencing document findings or asset attributes>",
      "question_type": "Exposure|Control|Context",
      "priority": "low|medium|high",
      "rationale": "<REQUIRED: cite exact document section/page/finding OR named asset attribute — no generic rationale>"
    }}
  ],
  "notes": "<1-3 paragraph summary of key security observations grounded in the provided context>"
}}

Generate up to 8 questions. Every question must be traceable to the provided context — no speculation."""

    step = state.get("global_step", 0) + 1
    t0 = time.monotonic()
    raw_response, status, error = None, "success", None
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        raw_response = response.content
        result = _parse_json(raw_response)
        if not isinstance(result, dict):
            raise ValueError("non-dict")
    except Exception as exc:
        status, error = "failed", str(exc)
        logger.warning(f"SA Phase1 Round {state['round_number']} failed: {exc}")
        result = {"questions": [], "notes": f"SA agent failed in round {state['round_number']}."}

    duration_ms = int((time.monotonic() - t0) * 1000)
    _record_agent_step(
        ra_id=state["ra_id"], phase=state["phase"],
        step=step, round_number=state["round_number"],
        agent_name="security_architect",
        prompt=prompt, raw_response=raw_response,
        parsed_output=result, duration_ms=duration_ms,
        status=status, error=error,
    )
    outputs = dict(state["outputs"])
    rk = f"round_{state['round_number']}"
    outputs[rk] = dict(outputs.get(rk, {}))
    outputs[rk]["sa"] = result
    logger.info(f"[SA] Round {state['round_number']} — {len(result.get('questions',[]))} questions ({duration_ms}ms)")
    return {"outputs": outputs, "last_agent": "sa", "global_step": step}


def _ra_phase1(state: PipelineState) -> dict:
    """Regulatory Analyst — identifies regulations and generates compliance questions."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    prior = _ra_context(state)
    is_round2 = state["round_number"] >= 2
    round_mandate = (
        "ROUND 2 — COLLABORATIVE REGULATORY DEEP-DIVE\n"
        "You have the Security Architect's Round 1 AND Round 2 questions (shown below). "
        "For each SA question that implies a regulatory obligation, explicitly call out the specific "
        "clause from the REGULATORY LIBRARY. Then add compliance questions for ANY regulatory gaps "
        "the SA did not address — especially cross-border data flows, data retention, breach notification, "
        "and sector-specific requirements. Do NOT repeat questions from Round 1."
        if is_round2 else
        "ROUND 1 — INDEPENDENT REGULATORY ANALYSIS\n"
        "Identify applicable regulations independently. The Quality Analyst will combine your output with SA's."
    )
    prompt = f"""You are a senior regulatory compliance analyst for technology risk assessments.
{round_mandate}
Identify applicable regulations and generate compliance questions NOT in the static bank.

ACCURACY RULES — READ BEFORE GENERATING:
1. PRIMARY SOURCE: Only cite regulations and clauses that appear in the REGULATORY LIBRARY section below. This is what the organisation has loaded — treat it as the authoritative source.
2. Do NOT invent regulatory obligations. If a regulation is not in the loaded library, do not assert specific clause numbers, thresholds, or requirements from memory.
3. If the REGULATORY LIBRARY shows no applicable frameworks for this asset's jurisdiction, state that explicitly in your notes. Do NOT fill the gap with invented obligations.
4. You may name a regulation as "potentially applicable" if it is commonly required for the asset's jurisdiction ({_primary_jurisdictions(state['asset'])}) but NOT in the library — label these clearly as "⚠ NOT IN LIBRARY — recommend loading" and do NOT invent specific clauses for them.
5. Every question's rationale MUST cite a specific section/clause from the REGULATORY LIBRARY or a named asset attribute that triggers applicability. "Standard compliance requirement" is not acceptable — cite the exact clause.

QUESTION TYPE RULES — assign question_type correctly; it controls how each answer is weighted in risk scoring:
- "Control": The question asks whether a specific compliance safeguard or obligation IS being met (e.g. "Is a data retention policy formally documented per Article 5(1)(e)?"). A NO answer triggers a mandatory risk.
- "Exposure": The question asks whether a specific regulatory risk condition IS present (e.g. "Does this system transfer personal data across jurisdictions without adequacy agreements?"). A YES answer triggers a mandatory risk.
- "Context": Use ONLY when YES and NO are both ambiguous in regulatory terms. Use sparingly; prefer Control or Exposure wherever the obligation is clear.

=== ASSET PROFILE ===
{_asset_block(state['asset'])}

=== REGULATORY LIBRARY (frameworks loaded by the organisation — your primary source) ===
{state['regulatory_library_summary']}

=== CONTEXT (documents + project details) ===
{state['context_pack']}

=== STATIC QUESTION BANK (do NOT duplicate) ===
{state['static_questions_summary']}

=== SHARED AGENT CONTEXT ===
{prior if prior else "No prior agent outputs yet."}

Return ONLY valid JSON:
{{
  "applicable_regulations": ["<Regulation Name — Article/Clause X.Y: one-line summary of the obligation>"],
  "questions": [
    {{
      "question_id": "ra_r{state['round_number']}_<snake_case>",
      "section_id": "compliance|data_protection|third_party_risk|governance|incident_response",
      "section_title": "<human readable>",
      "text": "<question referencing the specific regulation and clause>",
      "question_type": "Exposure|Control|Context",
      "priority": "low|medium|high",
      "rationale": "<REQUIRED: cite exact clause from the REGULATORY LIBRARY and the asset attribute that triggers applicability>"
    }}
  ],
  "notes": "<1-2 paragraph regulatory exposure summary — note any gaps where relevant frameworks are not yet loaded>"
}}

Generate up to 6 questions. Each must cite a specific regulation and clause from the loaded library. No invented obligations."""

    step = state.get("global_step", 0) + 1
    t0 = time.monotonic()
    raw_response, status, error = None, "success", None
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        raw_response = response.content
        result = _parse_json(raw_response)
        if not isinstance(result, dict):
            raise ValueError("non-dict")
    except Exception as exc:
        status, error = "failed", str(exc)
        logger.warning(f"RA Phase1 Round {state['round_number']} failed: {exc}")
        result = {"applicable_regulations": [], "questions": [], "notes": f"RA agent failed in round {state['round_number']}."}

    duration_ms = int((time.monotonic() - t0) * 1000)
    _record_agent_step(
        ra_id=state["ra_id"], phase=state["phase"],
        step=step, round_number=state["round_number"],
        agent_name="regulatory_analyst",
        prompt=prompt, raw_response=raw_response,
        parsed_output=result, duration_ms=duration_ms,
        status=status, error=error,
    )
    outputs = dict(state["outputs"])
    rk = f"round_{state['round_number']}"
    outputs[rk] = dict(outputs.get(rk, {}))
    outputs[rk]["ra"] = result
    logger.info(f"[RA] Round {state['round_number']} — {len(result.get('questions',[]))} questions, "
                f"{len(result.get('applicable_regulations',[]))} regulations ({duration_ms}ms)")
    return {"outputs": outputs, "last_agent": "ra", "global_step": step}


def _qa_phase1(state: PipelineState) -> dict:
    """Quality Analyst — validates, deduplicates, and finalises the question list."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    ctx = _qa_context(state)
    rk = f"round_{state['round_number']}"
    sa_qs = state["outputs"].get(rk, {}).get("sa", {}).get("questions", [])
    ra_qs = state["outputs"].get(rk, {}).get("ra", {}).get("questions", [])

    is_final_round = state["round_number"] >= state["max_rounds"]

    prompt = f"""You are a quality analyst reviewing a risk assessment question set.
This is Round {state['round_number']} of {state['max_rounds']}.
{"This is the FINAL round — produce the definitive validated question list." if is_final_round else "Provide feedback so agents can improve in the next round."}

YOUR PRIMARY RESPONSIBILITY IS ACCURACY — not completeness. Fewer well-grounded questions are better than many speculative ones.

=== ASSET PROFILE ===
{_asset_block(state['asset'])}

=== STATIC QUESTION BANK (remove any duplicates) ===
{state['static_questions_summary']}

=== ALL AGENT CONTEXT THIS ROUND + PRIOR ROUNDS ===
{ctx if ctx else "First round, no prior context."}

=== SECURITY ARCHITECT QUESTIONS (Round {state['round_number']}) ===
{json.dumps(sa_qs, indent=2, ensure_ascii=False)}

=== REGULATORY ANALYST QUESTIONS (Round {state['round_number']}) ===
{json.dumps(ra_qs, indent=2, ensure_ascii=False)}

YOUR TASKS (in priority order):
1. GROUNDING CHECK — Remove any question whose rationale does not cite a specific document finding (section/page), a named asset attribute, or a specific regulation clause. A rationale like "common best practice" or "general security concern" is grounds for removal.
2. Remove questions that duplicate the static bank (check meaning, not just wording).
3. Remove weak or generic questions any assessor would already know without these specific documents.
4. Merge near-duplicates into the better phrased version.
5. Correct section_id and priority where needed.
6. QUESTION TYPE VERIFICATION — For every question, verify the question_type is correct: "Control" = asks if a safeguard IS in place (NO = confirmed gap); "Exposure" = asks if a risky condition IS present (YES = confirmed exposure); "Context" = neither. Correct any misassignment. A mislabelled type causes incorrect risk weighting downstream.
7. Keep a maximum of 15 highest-value, well-grounded questions total.
{"8. This is the final round — ensure the list is complete, grounded, and ready for the assessor." if is_final_round else "8. Provide specific feedback to help SA and RA improve grounding and specificity in Round 2."}

Return ONLY valid JSON:
{{
  "final_questions": [
    {{
      "question_id": "<original id>",
      "section_id": "<corrected>",
      "section_title": "<human readable>",
      "text": "<final question text>",
      "question_type": "Exposure|Control|Context",
      "priority": "low|medium|high",
      "rationale": "<REQUIRED: cite exact document section/page/finding, named asset attribute, or regulation clause — no generic rationale>",
      "source_agent": "security_architect|regulatory_analyst"
    }}
  ],
  "qa_notes": "<what was removed and why, plus any question_type corrections made, plus feedback for next round>"
}}"""

    step = state.get("global_step", 0) + 1
    t0 = time.monotonic()
    raw_response, status, error = None, "success", None
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        raw_response = response.content
        result = _parse_json(raw_response)
        if not isinstance(result, dict):
            raise ValueError("non-dict")
    except Exception as exc:
        status, error = "failed", str(exc)
        logger.warning(f"QA Phase1 Round {state['round_number']} failed: {exc}")
        result = {"final_questions": (sa_qs + ra_qs)[:15], "qa_notes": f"QA agent failed in round {state['round_number']}."}

    duration_ms = int((time.monotonic() - t0) * 1000)
    _record_agent_step(
        ra_id=state["ra_id"], phase=state["phase"],
        step=step, round_number=state["round_number"],
        agent_name="quality_analyst",
        prompt=prompt, raw_response=raw_response,
        parsed_output=result, duration_ms=duration_ms,
        status=status, error=error,
    )
    outputs = dict(state["outputs"])
    outputs[rk] = dict(outputs.get(rk, {}))
    outputs[rk]["qa"] = result
    logger.info(f"[QA] Round {state['round_number']} — {len(result.get('final_questions',[]))} final questions ({duration_ms}ms)")

    final = result.get("final_questions", []) if is_final_round else state.get("final_questions", [])
    return {
        "outputs": outputs,
        "last_agent": "qa",
        "global_step": step,
        "final_questions": final,
        "qa_final_notes": result.get("qa_notes", ""),
    }


# ── Phase 2 agent nodes ───────────────────────────────────────────────────────

def _answers_block(answers: list[dict]) -> str:
    """Pre-classify answers into four groups so agents can derive risks mechanically.

    Group 1 — DEFINITE CONTROL GAPS:  Control question answered NO → confirmed missing control.
    Group 2 — CONFIRMED EXPOSURES:    Exposure question answered YES → confirmed risk condition.
    Group 3 — AI-CONTEXT EVIDENCE:    AI-generated Context question answered YES or NO →
                                       document-grounded evidence; same mandatory raise-a-risk
                                       weight as Groups 1 & 2.
    Group 4 — ADDITIONAL CONTEXT:     Everything else (yes-to-control, no-to-exposure, na answers,
                                       AI "na" answers) — scan for compound risk patterns.

    NOTE: Only questions the user actually answered appear here. Unanswered questions (whether
    static or AI-generated) are absent and must NOT be assumed to be YES or NO.
    """
    gaps: list[str] = []
    exposures: list[str] = []
    ai_context_evidence: list[str] = []
    context_lines: list[str] = []

    for a in answers:
        ans = (a.get("answer") or "").strip().lower()
        if ans not in ("yes", "no", "na"):
            continue
        qtype = (a.get("question_type") or "Control").strip()
        is_ai = bool(a.get("is_ai_generated"))
        rationale = (a.get("rationale") or "").strip()
        detail = (a.get("details") or "").strip()
        detail_part = f" | {detail}" if detail else ""
        rationale_line = f"\n    ↳ Document grounding: {rationale}" if (is_ai and rationale) else ""

        line = (
            f"[{a.get('section_id','')}]{'[AI-CONTEXT]' if is_ai else ''} "
            f"{a.get('text') or a.get('question_id','')} "
            f"→ {ans.upper()}{detail_part}{rationale_line}"
        )

        if qtype == "Control" and ans == "no":
            gaps.append(line)
        elif qtype == "Exposure" and ans == "yes":
            exposures.append(line)
        elif is_ai and qtype == "Context" and ans in ("yes", "no"):
            # AI Context questions answered definitively are document-grounded evidence and carry
            # the same mandatory risk-raise weight as control gaps and exposures.
            ai_context_evidence.append(line)
        else:
            context_lines.append(line)

    if not gaps and not exposures and not ai_context_evidence and not context_lines:
        return "No answers submitted yet."

    parts: list[str] = []
    if gaps:
        parts.append(
            f"=== DEFINITE CONTROL GAPS ({len(gaps)}) "
            f"— NO answer to a CONTROL question = confirmed missing control = raise a risk for EACH ==="
        )
        parts.extend(gaps)
    if exposures:
        parts.append(
            f"\n=== CONFIRMED EXPOSURES ({len(exposures)}) "
            f"— YES answer to an EXPOSURE question = confirmed risk condition = raise a risk for EACH ==="
        )
        parts.extend(exposures)
    if ai_context_evidence:
        parts.append(
            f"\n=== AI-CONTEXT EVIDENCE ({len(ai_context_evidence)}) "
            f"— document-grounded questions the user answered YES or NO; each answer is direct "
            f"asset-specific evidence = raise a distinct risk for EACH item, citing the "
            f"↳ Document grounding line ==="
        )
        parts.extend(ai_context_evidence)
    if context_lines:
        parts.append(
            f"\n=== ADDITIONAL CONTEXT ({len(context_lines)}) "
            f"— scan for compound risks; two answers together may reveal a higher-order risk ==="
        )
        parts.extend(context_lines)
    return "\n".join(parts)


def _sa_phase2(state: PipelineState) -> dict:
    """Security Architect — identifies technical risks from questionnaire answers."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    prior = _sa_context(state)
    is_round2 = state["round_number"] >= 2
    round_mandate = (
        "ROUND 2 — COLLABORATIVE DEEP-DIVE\n"
        "Round 1 SA and RA produced an initial risk set (shown in PRIOR ROUND CONTEXT below). "
        "Your job in Round 2 is to:\n"
        "  • Add technical risks that Round 1 MISSED — look at answer combinations and document context.\n"
        "  • Split overly broad risks from Round 1 into specific, actionable items.\n"
        "  • Raise the severity of any Round 1 risks that, in combination, form a higher-impact scenario.\n"
        "  • Do NOT reproduce risks already in Round 1 — only add NEW findings."
        if is_round2 else
        "ROUND 1 — INDEPENDENT ANALYSIS\n"
        "Analyse the questionnaire answers independently. The Regulatory Analyst will build on your risk list."
    )
    prompt = f"""You are a senior security architect. Analyse questionnaire answers to identify technical risks.
{round_mandate}

RISK DERIVATION RULES — APPLY THESE MECHANICALLY BEFORE ANY ANALYSIS:
1. DEFINITE CONTROL GAPS section: Raise a distinct risk for EVERY item listed. Each "NO to a control" is a confirmed missing control — do not skip any.
2. CONFIRMED EXPOSURES section: Raise a distinct risk for EVERY item listed. Each "YES to an exposure" is a confirmed risk condition — do not skip any.
3. AI-CONTEXT EVIDENCE section: Raise a distinct risk for EVERY item listed. These are document-grounded questions the user answered YES or NO — treat them with the same mandatory weight as GAPS and EXPOSURES. Always cite the ↳ Document grounding line in your risk description.
4. ADDITIONAL CONTEXT section: Scan for compound patterns — two or more answers together may reveal a higher-order risk not visible from either alone.
5. Do NOT invent risks beyond what the answers and documents evidence. Coverage of all GAPS, EXPOSURES, and AI-CONTEXT EVIDENCE is mandatory.

SCORING CALIBRATION — inherent_risk_score is a composite 1-25 scale (Likelihood × Impact, each 1-5).
Score against these thresholds — they must match the band you declare:
  • 1-4  = Low      (Likelihood 1-2 × Impact 1-2: minimal exploitability, negligible business effect)
  • 5-9  = Medium   (one factor moderate: plausible exploitation OR moderate impact but not both high)
  • 10-16 = High    (both factors moderate-high: plausible exploitation AND significant impact)
  • 17-25 = Critical (high likelihood AND high impact: easily exploitable AND major breach/outage/regulatory risk)
Do NOT inflate all risks to High/Critical. A missing optional control with low exploitability scores 2-6.
Calibrate to THIS asset's CIA scores and exposure profile — a Low-CIA internal tool scores lower than a Critical-CIA customer-facing system with the same gap.

DESCRIPTION FORMAT — every risk description must follow this structure exactly:
"Threat: [who or what could exploit this and how] | Exposure: [what is specifically unprotected or exposed, referencing the specific answer and this asset's profile] | Business Impact: [concrete consequence — data loss volume, downtime duration, regulatory action, financial penalty]"

ACCURACY RULES:
1. Every risk must trace to one or more specific question_ids from the QUESTIONNAIRE ANSWERS below.
2. Descriptions must explain WHY this specific answer creates a risk for THIS asset — no generic text.
3. Do NOT assert CVEs or attack techniques unless they appear in the uploaded documents.
4. source_questions must list the actual question_id(s) that evidence each risk.

=== ASSET PROFILE ===
{_asset_block(state['asset'])}

=== DOCUMENT CONTEXT ===
{state['context_pack']}

=== QUESTIONNAIRE ANSWERS ===
{_answers_block(state['questionnaire_answers'])}

{f"=== PRIOR ROUND CONTEXT (Round 1 full outputs) ==={chr(10)}{prior}" if prior else ""}

Return ONLY valid JSON:
{{
  "risks": [
    {{
      "title": "<specific risk title naming the threat and the exposed asset component — not just 'Access Control Risk'>",
      "description": "<Threat: ... | Exposure: ... | Business Impact: ...>",
      "risk_category": "Operational|Technical|Privacy|Regulatory|Financial|Reputational",
      "inherent_risk_score": <1-25>,
      "inherent_risk_band": "Low|Medium|High|Critical",
      "source_questions": ["<question_id that evidences this risk — required>"],
      "recommended_control_domain": "<NIST CSF function or control area>"
    }}
  ],
  "notes": "<top 3 risk themes grounded in the questionnaire answers>"
}}"""

    step = state.get("global_step", 0) + 1
    t0 = time.monotonic()
    raw_response, status, error = None, "success", None
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        raw_response = response.content
        result = _parse_json(raw_response)
        if not isinstance(result, dict):
            raise ValueError("non-dict")
    except Exception as exc:
        status, error = "failed", str(exc)
        logger.warning(f"SA Phase2 Round {state['round_number']} failed: {exc}")
        result = {"risks": [], "notes": f"SA Phase2 agent failed in round {state['round_number']}."}

    duration_ms = int((time.monotonic() - t0) * 1000)
    _record_agent_step(
        ra_id=state["ra_id"], phase=state["phase"],
        step=step, round_number=state["round_number"],
        agent_name="security_architect",
        prompt=prompt, raw_response=raw_response,
        parsed_output=result, duration_ms=duration_ms,
        status=status, error=error,
    )
    outputs = dict(state["outputs"])
    rk = f"round_{state['round_number']}"
    outputs[rk] = dict(outputs.get(rk, {}))
    outputs[rk]["sa"] = result
    logger.info(f"[SA-P2] Round {state['round_number']} — {len(result.get('risks',[]))} risks ({duration_ms}ms)")
    return {"outputs": outputs, "last_agent": "sa", "global_step": step}


def _ra_phase2(state: PipelineState) -> dict:
    """Regulatory Analyst — maps risks to regulations, adds regulatory risks."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    prior = _ra_context(state)
    rk = f"round_{state['round_number']}"
    sa_risks = state["outputs"].get(rk, {}).get("sa", {}).get("risks", [])
    is_round2 = state["round_number"] >= 2
    round_mandate = (
        "ROUND 2 — MAP EVERY RISK TO A SPECIFIC REGULATION\n"
        "The SA has now run Round 2 (new risks shown below). Your task:\n"
        "  1. For EACH SA Round 2 risk, map it to at least one specific clause in the REGULATORY LIBRARY.\n"
        "  2. Identify regulatory risks from the questionnaire answers that NEITHER Round 1 NOR Round 2 SA covered.\n"
        "  3. Escalate severity of any risk where the regulatory penalty makes it higher-impact than SA rated.\n"
        "  4. Do NOT re-list risks from Round 1 — only new additions and regulation mappings."
        if is_round2 else
        "ROUND 1 — REGULATORY ANALYSIS\n"
        "Map SA's risks to regulations and add regulatory risks the SA did not identify."
    )
    prompt = f"""You are a senior regulatory compliance analyst. Map identified risks to applicable
regulations and add any regulatory risks the Security Architect missed.
{round_mandate}

RISK DERIVATION RULES — APPLY BEFORE REGULATORY MAPPING:
1. DEFINITE CONTROL GAPS section in the QUESTIONNAIRE ANSWERS below: Each gap must be mapped to at least one regulatory obligation if the loaded library contains one. If no library clause applies, state that explicitly — do NOT leave it unmapped without explanation.
2. CONFIRMED EXPOSURES section: Every exposure must be checked against the regulatory library. If a regulation in the library explicitly covers this exposure type, raise a regulatory risk.
3. AI-CONTEXT EVIDENCE section: Treat each answered item with the same mandatory weight as GAPS and EXPOSURES. Check every AI-CONTEXT answer against the regulatory library. The ↳ Document grounding line is primary evidence — cite it when raising a regulatory risk from an AI-CONTEXT answer.
4. Identify regulatory risks from the questionnaire answers that the Security Architect missed — only if grounded in both the answers AND the loaded regulatory library.

REGULATORY PRECISION RULES:
• Every entry in applicable_regulations must follow this format: "Regulation Name — Article/Clause X.Y: one-sentence description of the specific obligation from the library text". Never cite just the regulation name without a clause.
• If a clause does not appear verbatim in the loaded library, do not cite it. Use an empty list and note the gap in the notes field.
• Severity escalation must cite the specific clause and its stated penalty threshold — not a general claim about how strict a regulation is.

ACCURACY RULES — READ BEFORE GENERATING:
1. PRIMARY SOURCE: Map risks ONLY to regulations and clauses that appear in the REGULATORY LIBRARY below. This is what the organisation has loaded.
2. Do NOT invent specific clause numbers, penalty amounts, or obligation thresholds from memory. If a regulation is not in the library, do not assert its specific requirements.
3. If a risk cannot be mapped to any loaded regulation, leave applicable_regulations as an empty list — do not fill it with invented obligations.
4. You may flag that a regulation is "⚠ NOT IN LIBRARY" if you believe it is commonly applicable, but do NOT fabricate its clauses.
5. Severity escalation based on regulatory penalty must cite a specific clause from the loaded library, not a general claim about how harsh a regulation is.

=== ASSET PROFILE ===
{_asset_block(state['asset'])}

=== REGULATORY LIBRARY (frameworks loaded by the organisation — your primary source) ===
{state['regulatory_library_summary']}

=== SHARED AGENT CONTEXT ===
{prior if prior else "No prior agent outputs."}

=== RISKS FROM SECURITY ARCHITECT (Round {state['round_number']}) ===
{json.dumps(sa_risks, indent=2, ensure_ascii=False)}

=== QUESTIONNAIRE ANSWERS ===
{_answers_block(state['questionnaire_answers'])}

Map each SA risk to specific clauses from the REGULATORY LIBRARY above.
Then identify any regulatory risks from the questionnaire answers that the SA missed — only if grounded in the loaded regulatory library or the questionnaire answers themselves.

Return ONLY valid JSON:
{{
  "risks": [
    {{
      "title": "<risk title>",
      "description": "<description grounded in questionnaire answers and regulatory library>",
      "risk_category": "Operational|Technical|Privacy|Regulatory|Financial|Reputational",
      "inherent_risk_score": <1-25>,
      "inherent_risk_band": "Low|Medium|High|Critical",
      "applicable_regulations": ["<regulation + specific clause from the loaded library — leave empty if none>"],
      "source_questions": ["<question_id>"],
      "recommended_control_domain": "<control area>"
    }}
  ],
  "notes": "<regulatory exposure summary — note if key frameworks are missing from the library>"
}}"""

    step = state.get("global_step", 0) + 1
    t0 = time.monotonic()
    raw_response, status, error = None, "success", None
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        raw_response = response.content
        result = _parse_json(raw_response)
        if not isinstance(result, dict):
            raise ValueError("non-dict")
    except Exception as exc:
        status, error = "failed", str(exc)
        logger.warning(f"RA Phase2 Round {state['round_number']} failed: {exc}")
        result = {"risks": sa_risks, "notes": f"RA Phase2 agent failed in round {state['round_number']}."}

    duration_ms = int((time.monotonic() - t0) * 1000)
    _record_agent_step(
        ra_id=state["ra_id"], phase=state["phase"],
        step=step, round_number=state["round_number"],
        agent_name="regulatory_analyst",
        prompt=prompt, raw_response=raw_response,
        parsed_output=result, duration_ms=duration_ms,
        status=status, error=error,
    )
    outputs = dict(state["outputs"])
    rk = f"round_{state['round_number']}"
    outputs[rk] = dict(outputs.get(rk, {}))
    outputs[rk]["ra"] = result
    logger.info(f"[RA-P2] Round {state['round_number']} — {len(result.get('risks',[]))} risks ({duration_ms}ms)")
    return {"outputs": outputs, "last_agent": "ra", "global_step": step}


def _qa_phase2(state: PipelineState) -> dict:
    """Quality Analyst — deduplicates risks and maps controls from library."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    ctx = _qa_context(state)
    rk = f"round_{state['round_number']}"
    ra_risks = state["outputs"].get(rk, {}).get("ra", {}).get("risks", [])
    is_final_round = state["round_number"] >= state["max_rounds"]

    def _ctrl_line(c: dict) -> str:
        cid   = c.get("control_id") or c.get("id") or ""
        title = c.get("control_title") or c.get("title") or ""
        fn    = c.get("function") or ""
        cat   = c.get("category") or ""
        desc  = str(c.get("description") or "")[:150].strip()
        kws   = ", ".join(str(k) for k in (c.get("keywords") or [])[:6])
        parts = [f"[{cid}] {title}"]
        if fn or cat:
            parts.append(f"{fn} | {cat}")
        if desc:
            parts.append(f"Desc: {desc}")
        if kws:
            parts.append(f"Keywords: {kws}")
        return " | ".join(parts)

    controls_summary = "\n".join(
        _ctrl_line(c) for c in state["controls_library"][:80]
    ) or "No controls library loaded."

    prompt = f"""You are a quality analyst with two equal primary responsibilities:
(A) VALIDATE identified risks for accuracy and completeness.
(B) MAP the best-fit controls from the controls library to each validated risk.

Round {state['round_number']} of {state['max_rounds']}.
{"FINAL ROUND — produce the definitive validated risk list with fully mapped controls." if is_final_round else "Provide feedback for improvement in the next round."}

=== ASSET PROFILE ===
{_asset_block(state['asset'])}

=== ALL AGENT CONTEXT ===
{ctx if ctx else "No prior context."}

=== RISKS TO VALIDATE ===
{json.dumps(ra_risks, indent=2, ensure_ascii=False)}

=== CONTROLS LIBRARY (id | title | function | category | description | keywords) ===
{controls_summary}

━━━ RESPONSIBILITY A — RISK VALIDATION ━━━
1. COMPLETENESS CHECK — Every item in DEFINITE CONTROL GAPS, CONFIRMED EXPOSURES, and AI-CONTEXT EVIDENCE must have at least one risk. Flag any section item that has no corresponding risk — that is a mandatory gap.
2. GROUNDING CHECK — Remove any risk lacking a valid source_questions entry or whose description cannot be traced to a specific questionnaire answer or uploaded document. Generic "best practice" risks without specific evidence are unsupported — remove them.
3. DESCRIPTION FORMAT CHECK — Every risk description should follow the structure "Threat: ... | Exposure: ... | Business Impact: ...". Rewrite any description that is generic, asset-agnostic, or missing the business impact component.
4. REGULATION CHECK — Remove any applicable_regulations entry whose clause number does not appear verbatim in the loaded regulatory library. Use an empty list rather than fabricated citations. Every remaining entry must be in format "Regulation — Article/Clause X.Y: one-sentence obligation summary".
5. [AI-CONTEXT] ANSWER CHECK — Each item in AI-CONTEXT EVIDENCE must have produced at least one risk with the ↳ Document grounding line cited in the description. Flag any that are absent.
6. Deduplicate near-identical risks — merge into the clearest, most specific version.
7. SCORE VALIDATION — Validate inherent_risk_score (1-25) against these bands: 1-4 = Low, 5-9 = Medium, 10-16 = High, 17-25 = Critical. Correct any risk where the declared band does not match the score. Also check that scores are calibrated to the asset's CIA profile — do not accept all-Critical lists for Low-CIA assets.

━━━ RESPONSIBILITY B — CONTROL MAPPING ━━━
You have full context that no other system has: the risk description, source questions, applicable regulations, and document grounding. Use ALL of it to select controls — not just the risk title.

MATCHING RULES:
• Read the control's description and keywords — match controls whose description directly addresses the specific gap or exposure, not just the domain category.
• Read source_questions — a control that closes the exact gap the question exposed is a score-5 match.
• Read applicable_regulations — prefer controls that satisfy the cited regulatory obligation.
• Use the control's keywords to confirm relevance before selecting.
• CRITICAL: control_id in your output must EXACTLY match an id from the CONTROLS LIBRARY above. Copy it character-for-character. Do not invent, abbreviate, or rephrase control IDs.
• Select 1-3 controls per risk. Write a rationale citing the specific source question or regulation the control addresses.
• relevance_score: 5 = directly closes this exact gap, 4 = strongly related, 3 = partially addresses, 2 = domain match only, 1 = last resort.
{"• FINAL ROUND — every validated risk must have at least 1 control mapped. No empty suggested_controls arrays." if is_final_round else "• Provide specific feedback so SA and RA improve gap coverage and grounding in Round 2."}

Return ONLY valid JSON:
{{
  "validated_risks": [
    {{
      "title": "<risk title>",
      "description": "<description grounded in evidence from questionnaire answers or documents>",
      "risk_category": "Operational|Technical|Privacy|Regulatory|Financial|Reputational",
      "inherent_risk_score": <1-25>,
      "inherent_risk_band": "Low|Medium|High|Critical",
      "applicable_regulations": ["<regulation + clause from loaded library — empty list if none verified>"],
      "source_questions": ["<question_id that evidences this risk>"],
      "suggested_controls": [
        {{
          "control_id": "<id EXACTLY as it appears in the CONTROLS LIBRARY above>",
          "control_title": "<title exactly as in controls library>",
          "rationale": "<why this control closes THIS specific gap — cite the source question or regulation>",
          "relevance_score": <1-5>
        }}
      ]
    }}
  ],
  "qa_notes": "<what was removed and why — call out ungrounded risks, fabricated citations, and control gaps left without coverage>"
}}"""

    step = state.get("global_step", 0) + 1
    t0 = time.monotonic()
    raw_response, status, error = None, "success", None
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        raw_response = response.content
        result = _parse_json(raw_response)
        if not isinstance(result, dict):
            raise ValueError("non-dict")
    except Exception as exc:
        status, error = "failed", str(exc)
        logger.warning(f"QA Phase2 Round {state['round_number']} failed: {exc}")
        result = {"validated_risks": ra_risks, "qa_notes": f"QA Phase2 failed in round {state['round_number']}."}

    duration_ms = int((time.monotonic() - t0) * 1000)
    _record_agent_step(
        ra_id=state["ra_id"], phase=state["phase"],
        step=step, round_number=state["round_number"],
        agent_name="quality_analyst",
        prompt=prompt, raw_response=raw_response,
        parsed_output=result, duration_ms=duration_ms,
        status=status, error=error,
    )
    outputs = dict(state["outputs"])
    outputs[rk] = dict(outputs.get(rk, {}))
    outputs[rk]["qa"] = result
    logger.info(f"[QA-P2] Round {state['round_number']} — {len(result.get('validated_risks',[]))} risks ({duration_ms}ms)")

    validated = result.get("validated_risks", []) if is_final_round else state.get("validated_risks", [])
    return {
        "outputs": outputs,
        "last_agent": "qa",
        "global_step": step,
        "validated_risks": validated,
        "qa_final_notes": result.get("qa_notes", ""),
    }


# ── Orchestrator node ─────────────────────────────────────────────────────────

def orchestrator_node(state: PipelineState) -> dict:
    """Runs between EVERY agent call. Manages queue position and round advancement.

    This is NOT an LLM — it is pure Python routing logic. It never hallucinates
    because it never calls a model. Its only job is to advance the queue pointer
    and decide when to move to the next round. Every decision is recorded to the
    agent_decision_trail collection for auditability.
    """
    last = state.get("last_agent", "")
    step = state.get("global_step", 0) + 1

    # ── Initial call (graph entry) ────────────────────────
    if not last or last == "":
        logger.info(f"[Orchestrator] START — ra_id={state['ra_id']} phase={state['phase']}")
        _record_orchestrator_step(
            ra_id=state["ra_id"], phase=state["phase"],
            step=step, round_number=1,
            last_agent="START", next_agent=_QUEUE[0],
            action="pipeline_start", queue_position=0,
        )
        return {"current_index": 0, "round_number": 1, "last_agent": "__init__", "global_step": step}

    # ── Agent just completed — advance queue ──────────────
    next_index = state["current_index"] + 1

    if next_index < len(_QUEUE):
        next_agent = _QUEUE[next_index]
        logger.info(
            f"[Orchestrator] Round {state['round_number']} — "
            f"completed '{_QUEUE[state['current_index']]}', next → '{next_agent}'"
        )
        _record_orchestrator_step(
            ra_id=state["ra_id"], phase=state["phase"],
            step=step, round_number=state["round_number"],
            last_agent=_QUEUE[state["current_index"]], next_agent=next_agent,
            action="advance_queue", queue_position=next_index,
        )
        return {"current_index": next_index, "last_agent": "__advance__", "global_step": step}

    # Round complete
    if state["round_number"] < state["max_rounds"]:
        next_round = state["round_number"] + 1
        logger.info(f"[Orchestrator] Round {state['round_number']} COMPLETE — starting Round {next_round}")
        _record_orchestrator_step(
            ra_id=state["ra_id"], phase=state["phase"],
            step=step, round_number=state["round_number"],
            last_agent=_QUEUE[-1], next_agent=_QUEUE[0],
            action="next_round", queue_position=0,
        )
        return {"current_index": 0, "round_number": next_round, "last_agent": "__next_round__", "global_step": step}

    # All rounds complete
    logger.info(f"[Orchestrator] All {state['max_rounds']} rounds COMPLETE — done")
    _record_orchestrator_step(
        ra_id=state["ra_id"], phase=state["phase"],
        step=step, round_number=state["round_number"],
        last_agent=_QUEUE[-1], next_agent="END",
        action="pipeline_complete", queue_position=-1,
    )
    return {"last_agent": "__done__", "global_step": step}


def _route_next(state: PipelineState) -> str:
    """Conditional edge from orchestrator — returns next node name or END."""
    from langgraph.graph import END as GRAPH_END
    last = state.get("last_agent", "")
    if last == "__done__":
        return GRAPH_END
    idx = state.get("current_index", 0)
    return _QUEUE[idx] if idx < len(_QUEUE) else GRAPH_END


# ── Graph builders ────────────────────────────────────────────────────────────

def _build_graph(phase: str):
    """Build and compile the LangGraph StateGraph for the given phase."""
    from langgraph.graph import StateGraph, END

    sa_fn = _sa_phase1 if phase == "phase1" else _sa_phase2
    ra_fn = _ra_phase1 if phase == "phase1" else _ra_phase2
    qa_fn = _qa_phase1 if phase == "phase1" else _qa_phase2

    graph = StateGraph(PipelineState)

    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("sa", sa_fn)
    graph.add_node("ra", ra_fn)
    graph.add_node("qa", qa_fn)

    graph.set_entry_point("orchestrator")

    # Orchestrator routes to the right agent or END
    graph.add_conditional_edges(
        "orchestrator",
        _route_next,
        {"sa": "sa", "ra": "ra", "qa": "qa", END: END},
    )

    # Every agent returns to orchestrator after running
    graph.add_edge("sa", "orchestrator")
    graph.add_edge("ra", "orchestrator")
    graph.add_edge("qa", "orchestrator")

    return graph.compile()


# ── Public API ────────────────────────────────────────────────────────────────

def run_phase1_pipeline(
    ra_id: str,
    context_pack: str,
    asset: "list[dict] | dict",
    sections: list[dict],
    store: Any,
) -> list[dict]:
    """Run Phase 1: generate AI questions via 2-round orchestrated pipeline.

    Returns the final validated list of AI-generated questions.
    Persists agent notes to MongoDB on the assessment document.
    """
    from utils.assessment_questions import get_sections as _get_sections
    static_summary = _static_questions_summary(sections or _get_sections())
    assets_list = [asset] if isinstance(asset, dict) else (asset or [])
    reg_lib_summary = _build_regulatory_context_for_assets(assets_list, ra_id=ra_id, phase="phase1")

    _log_pipeline_event(ra_id, "phase1", "started", {"asset_count": len(assets_list)})

    initial_state: PipelineState = {
        "ra_id": ra_id,
        "phase": "phase1",
        "context_pack": context_pack,
        "asset": assets_list,
        "static_questions_summary": static_summary,
        "regulatory_library_summary": reg_lib_summary,
        "questionnaire_answers": [],
        "controls_library": [],
        "round_number": 1,
        "max_rounds": 2,
        "current_index": 0,
        "last_agent": "",
        "global_step": 0,
        "outputs": {},
        "final_questions": [],
        "validated_risks": [],
        "qa_final_notes": "",
    }

    graph = _build_graph("phase1")
    final_state = graph.invoke(initial_state)

    # Persist agent notes to MongoDB
    _persist_agent_notes(store, ra_id, phase=1, outputs=final_state.get("outputs", {}))

    questions = final_state.get("final_questions", [])
    for q in questions:
        q["is_ai_generated"] = True
        q["source"] = "agentic_pipeline"
        q.setdefault("status", "suggested")

    _log_pipeline_event(ra_id, "phase1", "complete", {"question_count": len(questions)})
    logger.info(f"[Pipeline] Phase 1 complete — {len(questions)} AI questions for ra_id={ra_id}")
    return questions


def run_phase2_pipeline(
    ra_id: str,
    context_pack: str,
    asset: "list[dict] | dict",
    questionnaire_answers: list[dict],
    controls_library: list[dict],
    store: Any,
) -> dict:
    """Run Phase 2: identify risks + suggest controls via 2-round orchestrated pipeline.

    Returns dict with validated_risks and qa_notes.
    Persists agent notes to MongoDB on the assessment document.
    """
    assets_list = [asset] if isinstance(asset, dict) else (asset or [])
    reg_lib_summary = _build_regulatory_context_for_assets(assets_list, ra_id=ra_id, phase="phase2")

    _log_pipeline_event(ra_id, "phase2", "started", {
        "asset_count": len(assets_list),
        "answer_count": len(questionnaire_answers),
        "controls_count": len(controls_library),
    })

    initial_state: PipelineState = {
        "ra_id": ra_id,
        "phase": "phase2",
        "context_pack": context_pack,
        "asset": assets_list,
        "static_questions_summary": "",
        "regulatory_library_summary": reg_lib_summary,
        "questionnaire_answers": questionnaire_answers,
        "controls_library": controls_library,
        "round_number": 1,
        "max_rounds": 2,
        "current_index": 0,
        "last_agent": "",
        "global_step": 0,
        "outputs": {},
        "final_questions": [],
        "validated_risks": [],
        "qa_final_notes": "",
    }

    graph = _build_graph("phase2")
    final_state = graph.invoke(initial_state)

    _persist_agent_notes(store, ra_id, phase=2, outputs=final_state.get("outputs", {}))

    risk_count = len(final_state.get("validated_risks", []))
    _log_pipeline_event(ra_id, "phase2", "complete", {"risk_count": risk_count})
    logger.info(f"[Pipeline] Phase 2 complete — {risk_count} risks for ra_id={ra_id}")
    return {
        "validated_risks": final_state.get("validated_risks", []),
        "qa_notes": final_state.get("qa_final_notes", ""),
    }


def _log_pipeline_event(ra_id: str, phase: str, event: str, detail: dict | None = None) -> None:
    """Log pipeline-level start/complete/failed events to agent_decision_trail."""
    try:
        _trail_col().insert_one({
            "_id": str(uuid.uuid4()),
            "ra_id": ra_id,
            "phase": phase,
            "step": 0,
            "round": 0,
            "agent": "pipeline",
            "role": "lifecycle",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_ms": None,
            "status": event,
            "routing_decision": None,
            "prompt": None,
            "raw_response": None,
            "parsed_output": detail or {},
            "error": None,
        })
    except Exception as exc:
        logger.warning(f"[Trail] Failed to log pipeline event {event} for {ra_id}: {exc}")


def _persist_agent_notes(store: Any, ra_id: str, phase: int, outputs: dict) -> None:
    """Save agent outputs from all rounds to MongoDB for case continuity."""
    now = datetime.now(timezone.utc).isoformat()
    field = f"agent_notes_phase{phase}"
    try:
        store._col.update_one(
            {"_id": ra_id},
            {"$set": {field: outputs, "updated_at": now}},
        )
    except Exception as exc:
        logger.warning(f"Failed to persist agent notes for {ra_id}: {exc}")
