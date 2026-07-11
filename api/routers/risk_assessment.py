# api/routers/risk_assessment.py
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import io
import json
import os
import re as _re
import subprocess
import tempfile
import uuid
import logging
from collections import Counter
from datetime import datetime
from typing import Any, Literal, Optional

import pymongo
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from utils.assessment_questions import get_sections
from utils.risk_scorer import compute_criticality

# Domain models and store — defined in utils/ so the Celery worker can import
# them without depending on api/.  Re-exported here for backward compatibility.
from utils.ra_models import (
    AdHocApplication,
    RiskAssessmentContextProfile,
    RiskAssessmentContextUpdate,
    SuggestedQuestion,
    SuggestedQuestionAnswer,
    RiskAssessmentCreate,
    ResponseSubmit,
    RiskOverride,
    ControlApplication,
    ResponseBatch,
    RiskAssessment,
    StatusType,
    RiskBand,
    AnswerType,
)
from utils.ra_store import MongoRiskAssessmentStore, get_store
from utils.ra_context_builder import (
    _clean_report_text,
    _tokenize_match_text,
    _cia_band_from_values,
    _LLM_CONTEXT_WINDOWS,
    _DEFAULT_CONTEXT_WINDOW,
    _CHARS_PER_TOKEN,
    _get_active_context_window,
    _compute_per_doc_text_budget,
    _build_ra_context_pack,
    _fallback_suggested_questions,
    _resolve_subject_profile,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/risk-assessment", tags=["risk-assessment"])


# ── Audit trail ─────────────────────────────────────────────────────────────

def _record_user_event(ra_id: str, event: str, details: dict | None = None) -> None:
    """Write a user action to the agent_decision_trail collection.

    All user-triggered events (create, answer question, upload document, start
    pipeline, add risk, apply control, generate report, etc.) are recorded here
    so the full lifecycle of an assessment is visible in one chronological trail.
    """
    try:
        _mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
        col = pymongo.MongoClient(_mongo_uri)["trace_db"]["agent_decision_trail"]
        col.insert_one({
            "_id": str(uuid.uuid4()),
            "ra_id": ra_id,
            "phase": "user_action",
            "step": None,
            "round": None,
            "agent": None,
            "role": "user_action",
            "event": event,
            "timestamp": datetime.now(dt.timezone.utc).isoformat(),
            "details": details or {},
            "prompt": None,
            "raw_response": None,
            "parsed_output": None,
            "error": None,
        })
    except Exception as exc:
        logger.warning(f"[Audit] Failed to record user event '{event}' for {ra_id}: {exc}")


# ── Risk scoring helpers ─────────────────────────────────────────────────────

def _inherent_risk_band(score: float) -> str:
    if score <= 4:   return "Low"
    if score <= 9:   return "Medium"
    if score <= 16:  return "High"
    return "Critical"


def _rule_layer_scores(responses: list[dict]) -> tuple[int, int]:
    """Compute rule-based likelihood + impact from Exposure/Control answers."""
    section_map: dict[str, dict[str, str]] = {
        s["id"]: {q["id"]: q["question_type"] for q in s["questions"]}
        for s in get_sections()
    }
    exposure_yes = 0
    control_no = 0
    for r in responses:
        qtype = section_map.get(r.get("section_id", ""), {}).get(r.get("question_id", ""))
        if qtype == "Exposure" and r.get("answer") == "yes":
            exposure_yes += 1
        elif qtype == "Control" and r.get("answer") == "no":
            control_no += 1
    all_questions = [q for s in get_sections() for q in s["questions"]]
    exposure_total = max(1, sum(1 for q in all_questions if q["question_type"] == "Exposure"))
    control_total = max(1, sum(1 for q in all_questions if q["question_type"] == "Control"))
    likelihood = min(5, max(1, round(1 + (exposure_yes / exposure_total) * 4)))
    impact = min(5, max(1, round(1 + (control_no / control_total) * 4)))
    return likelihood, impact


def _format_calendar_date(value: str | datetime | None) -> str:
    if isinstance(value, str):
        try:
            value = dt.datetime.fromisoformat(value)
        except ValueError:
            return value
    try:
        return value.strftime("%B %d, %Y").replace(" 0", " ")
    except Exception:
        return "Unknown"



_RISK_CATEGORY_DOMAIN_HINTS: dict[str, list[str]] = {
    "Operational": ["access_control", "system_security", "cyber_operations", "business_continuity", "governance"],
    "Technical": ["system_security", "network_security", "application_security", "access_control", "cyber_operations"],
    "Privacy": ["data_security", "access_control", "cryptography", "online_services"],
    "Regulatory": ["governance", "audit", "third_party", "data_security"],
    "Financial": ["governance", "third_party", "business_continuity", "access_control"],
    "Reputational": ["governance", "incident_response", "third_party", "cyber_operations"],
}

_RISK_KEYWORD_DOMAIN_HINTS: dict[str, list[str]] = {
    "access": ["access_control"],
    "identity": ["access_control"],
    "authentication": ["access_control"],
    "authorization": ["access_control"],
    "privileged": ["access_control"],
    "mfa": ["access_control"],
    "monitoring": ["cyber_operations", "audit"],
    "logging": ["cyber_operations", "audit"],
    "incident": ["incident_response", "cyber_operations"],
    "backup": ["business_continuity"],
    "recovery": ["business_continuity"],
    "availability": ["business_continuity"],
    "encryption": ["cryptography", "data_security"],
    "data": ["data_security"],
    "network": ["network_security"],
    "vulnerability": ["Vuln. Mgmt", "system_security"],
    "patch": ["system_security", "change_management"],
    "change": ["change_management"],
    "vendor": ["third_party"],
    "third": ["third_party"],
    "party": ["third_party"],
}


# regulatory_context and security_requirements are intentionally excluded:
# they flow from asset jurisdiction + questionnaire answers + controls library (Phase 2),
# NOT from document extraction.
_CONTEXT_PROFILE_FIELDS = frozenset({"project_context", "business_impact", "overall_project_summary", "jira_context", "free_text_context"})
_DOC_METADATA_FIELDS = frozenset({"document_type", "technologies", "regulations", "data_types", "third_parties", "risk_flags"})


def _extract_context_text(filename: str, content: bytes, source_type: str = "document") -> tuple[str, dict]:
    suffix = os.path.splitext(filename.lower())[1]
    clean_suffix = suffix.lstrip(".").lower()
    # Image files have no extractable text — vision LLM handles them entirely.
    # Returning empty here prevents the binary fallback from injecting garbage into the vision prompt.
    if clean_suffix in _VISION_IMAGE_SUFFIXES:
        return "", {"extractor": "vision-only", "suffix": suffix}
    if clean_suffix in {"pdf", "docx", "doc", "xlsx", "xls"}:
        try:
            from utils.services.conversion import convert_document
            result = convert_document(content, filename, str(uuid.uuid4()), "risk_data")
            if result.status in ("success", "partial") and result.markdown:
                return result.markdown, {"extractor": "convert_document", "suffix": suffix, "page_count": result.page_count}
        except Exception as exc:
            logger.warning(f"convert_document failed for {filename}: {exc}")
    if clean_suffix in {"txt", "md", "log", "json"}:
        return content.decode("utf-8", errors="ignore"), {"extractor": "utf-8", "suffix": suffix}
    try:
        from utils.document_ingestion import load_documents
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            docs = load_documents(tmp_path, filename=filename, extra_metadata={"risk_assessment_source_type": source_type})
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        return "\n\n".join(doc.page_content for doc in docs), {"extractor": "utils.document_ingestion", "suffix": suffix, "documents": len(docs)}
    except Exception as exc:
        logger.warning(f"Context extraction failed for {filename}: {exc}")
        return content.decode("utf-8", errors="ignore"), {"extractor": "utf-8-fallback", "suffix": suffix, "warning": str(exc)}


_VISION_IMAGE_SUFFIXES = frozenset({"png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif"})
_OFFICE_SUFFIXES      = frozenset({"docx", "doc", "pptx", "ppt", "xlsx", "xls", "odp", "odt", "ods"})
_TEXT_ONLY_SUFFIXES   = frozenset({"txt", "md", "log", "json", "csv", "tsv"})
_ZIP_MEDIA_PREFIX     = {"docx": "word/media/", "doc": "word/media/",
                          "pptx": "ppt/media/",  "ppt": "ppt/media/",
                          "xlsx": "xl/media/",   "xls": "xl/media/"}


def _pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Render every PDF page to a PNG using pdf2image/poppler."""
    from pdf2image import convert_from_bytes
    pages = convert_from_bytes(pdf_bytes, dpi=150, fmt="PNG", thread_count=2)
    result = []
    for page in pages:
        buf = io.BytesIO()
        page.save(buf, format="PNG")
        result.append(buf.getvalue())
    return result


def _libreoffice_to_pdf(content: bytes, filename: str) -> bytes | None:
    """Convert any Office document to PDF via LibreOffice headless.

    Returns PDF bytes or None if conversion fails.
    """
    suffix = os.path.splitext(filename)[1]
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"input{suffix}")
        with open(input_path, "wb") as fh:
            fh.write(content)
        env = {**os.environ, "HOME": tmpdir}
        try:
            proc = subprocess.run(
                [
                    "libreoffice", "--headless", "--norestore",
                    "--nofirststartwizard", "--convert-to", "pdf",
                    "--outdir", tmpdir, input_path,
                ],
                capture_output=True, timeout=120, env=env,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            logger.warning(f"LibreOffice unavailable or timed out for {filename}: {exc}")
            return None
        if proc.returncode != 0:
            logger.warning(f"LibreOffice conversion failed for {filename}: {proc.stderr.decode()[:300]}")
            return None
        pdf_path = os.path.join(tmpdir, os.path.splitext("input" + suffix)[0] + ".pdf")
        if not os.path.exists(pdf_path):
            # LibreOffice may use the original stem
            candidates = [f for f in os.listdir(tmpdir) if f.endswith(".pdf")]
            if not candidates:
                return None
            pdf_path = os.path.join(tmpdir, candidates[0])
        with open(pdf_path, "rb") as fh:
            return fh.read()


def _render_document_to_images(filename: str, content: bytes) -> list[bytes]:
    """Return a list of PNG image bytes covering the full visual content of any document.

    Routing:
      PDF              → pdf2image renders every page at 150 dpi
      Office (DOCX etc)→ LibreOffice converts to PDF → pdf2image renders every page
                         Fallback: extract embedded media images from the ZIP archive
      Images           → returned as-is (single element list)
      Text/CSV/JSON    → empty list  (caller uses text-only extraction)
    """
    suffix = os.path.splitext(filename.lower())[1].lstrip(".")

    # ── Plain image files ─────────────────────────────────────────────────────
    if suffix in _VISION_IMAGE_SUFFIXES:
        return [content]

    # ── Text-only formats: vision adds nothing ────────────────────────────────
    if suffix in _TEXT_ONLY_SUFFIXES:
        return []

    # ── PDF: render every page ────────────────────────────────────────────────
    if suffix == "pdf":
        try:
            return _pdf_to_images(content)
        except Exception as exc:
            logger.warning(f"pdf2image failed for {filename}: {exc}")
            return []

    # ── Office formats: LibreOffice → PDF → page images ──────────────────────
    if suffix in _OFFICE_SUFFIXES:
        pdf_bytes = _libreoffice_to_pdf(content, filename)
        if pdf_bytes:
            try:
                return _pdf_to_images(pdf_bytes)
            except Exception as exc:
                logger.warning(f"pdf2image failed on LibreOffice output for {filename}: {exc}")

        # Fallback: extract embedded media images from the ZIP archive
        import zipfile
        media_prefix = _ZIP_MEDIA_PREFIX.get(suffix, "")
        images: list[bytes] = []
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                for name in zf.namelist():
                    if (media_prefix and name.startswith(media_prefix)) or (not media_prefix):
                        ext = os.path.splitext(name)[1].lstrip(".").lower()
                        if ext in _VISION_IMAGE_SUFFIXES:
                            images.append(zf.read(name))
        except Exception as exc:
            logger.warning(f"ZIP media extraction failed for {filename}: {exc}")
        return images

    # ── Unknown type: try LibreOffice → PDF as a last resort ─────────────────
    pdf_bytes = _libreoffice_to_pdf(content, filename)
    if pdf_bytes:
        try:
            return _pdf_to_images(pdf_bytes)
        except Exception:
            pass
    return []


# ── Visual content signal words — presence suggests vision adds value ─────────
_VISUAL_CONTENT_SIGNALS = frozenset({
    "diagram", "architecture", "topology", "flowchart", "swimlane", "network",
    "data flow", "dfd", "uml", "er diagram", "entity relationship",
    "chart", "graph", "heatmap", "dashboard", "screenshot", "figure",
    "table", "matrix", "spreadsheet", "schematic", "blueprint",
    "visio", "draw.io", "lucidchart", "miro",
})

# Format reasons why vision is/isn't chosen
_FORMAT_VISION_RATIONALE: dict[str, tuple[bool, str]] = {
    # (vision_valuable, justification)
    "pdf":  (True,  "PDF may contain diagrams, charts, or complex layouts not captured by text extraction"),
    "docx": (True,  "Word document may contain embedded diagrams, tables, or SmartArt"),
    "doc":  (True,  "Word document may contain embedded diagrams, tables, or SmartArt"),
    "pptx": (True,  "Presentation likely contains diagrams, slides, and visual architecture content"),
    "ppt":  (True,  "Presentation likely contains diagrams, slides, and visual architecture content"),
    "xlsx": (True,  "Spreadsheet may contain embedded charts, pivot tables, or visual dashboards not captured by text extraction"),
    "xls":  (True,  "Spreadsheet may contain embedded charts, pivot tables, or visual dashboards not captured by text extraction"),
    "ods":  (True,  "OpenDocument spreadsheet may contain embedded charts or visual content"),
    "odt":  (True,  "OpenDocument text may contain embedded diagrams or visual elements"),
    "odp":  (True,  "OpenDocument presentation likely contains diagrams and visual content"),
    "png":  (True,  "Image file requires vision — no text content to extract"),
    "jpg":  (True,  "Image file requires vision — no text content to extract"),
    "jpeg": (True,  "Image file requires vision — no text content to extract"),
    "webp": (True,  "Image file requires vision — no text content to extract"),
    "bmp":  (True,  "Image file requires vision — no text content to extract"),
    "tiff": (True,  "Image file requires vision — no text content to extract"),
    "gif":  (True,  "Image file requires vision — no text content to extract"),
    "txt":  (False, "Plain text — all content available via markdown extraction"),
    "md":   (False, "Markdown — all content available via text extraction"),
    "json": (False, "JSON — fully structured, no visual content"),
    "csv":  (False, "CSV — tabular text, no visual content"),
    "tsv":  (False, "TSV — tabular text, no visual content"),
    "log":  (False, "Log file — plain text, no visual content"),
}


def _decide_processing_strategy(
    filename: str,
    text: str,
    images_available: int,
) -> dict:
    """Evaluate whether vision, text-only, or hybrid processing is appropriate.

    Returns a dict with:
      strategy       — "vision" | "text_only" | "hybrid" | "vision_failed"
      justification  — human-readable reason for the decision
      visual_signals — list of visual content keywords found in text
      image_count    — number of page images extracted
      llm_supports_vision — bool (checked via model metadata)
    """
    suffix = os.path.splitext(filename.lower())[1].lstrip(".")
    text_lower = text.lower()

    # Check if active LLM likely supports vision
    try:
        from utils.llm_provider import get_llm
        llm = get_llm()
        model_id = getattr(llm, "model", "") or getattr(llm, "model_name", "") or ""
        # Known vision-capable model patterns
        _VISION_MODELS = {
            "gemini", "gpt-4o", "gpt-4-vision", "claude-3", "claude-sonnet",
            "claude-opus", "claude-haiku", "llava", "minicpm", "bakllava",
            "moondream", "cogvlm", "internvl", "yi-vl",
        }
        llm_supports_vision = any(v in model_id.lower() for v in _VISION_MODELS)
    except Exception:
        llm_supports_vision = False

    # Detect visual content signals in extracted text
    visual_signals = [sig for sig in _VISUAL_CONTENT_SIGNALS if sig in text_lower]

    # Look up format-level rationale
    format_vision_valuable, format_reason = _FORMAT_VISION_RATIONALE.get(
        suffix, (True, f"Unknown format '{suffix}' — attempting vision as fallback")
    )

    if not llm_supports_vision:
        return {
            "strategy": "text_only",
            "justification": (
                f"Active LLM ({model_id or 'unknown'}) does not support vision input. "
                f"Using MarkItDown text extraction only. "
                + (f"Note: document contains visual signals ({', '.join(visual_signals[:5])}) "
                   f"that vision processing could enrich — consider switching to a vision-capable model."
                   if visual_signals else "")
            ),
            "visual_signals": visual_signals,
            "image_count": images_available,
            "llm_supports_vision": False,
        }

    if not format_vision_valuable:
        return {
            "strategy": "text_only",
            "justification": (
                f"{format_reason}. MarkItDown extraction used — vision processing skipped as it adds no value for this format."
            ),
            "visual_signals": visual_signals,
            "image_count": 0,
            "llm_supports_vision": llm_supports_vision,
        }

    if images_available == 0:
        fallback_reason = (
            "LibreOffice conversion unavailable or failed — could not render to page images. "
            if suffix in _OFFICE_SUFFIXES else
            "pdf2image/poppler not available — could not render PDF pages to images. "
            if suffix == "pdf" else
            "Image rendering produced no output. "
        )
        return {
            "strategy": "text_only",
            "justification": (
                fallback_reason
                + f"Falling back to MarkItDown text extraction. "
                + (f"Visual signals detected in text ({', '.join(visual_signals[:5])}) suggest this document may contain diagrams — "
                   f"install poppler/LibreOffice for vision processing."
                   if visual_signals else "")
            ),
            "visual_signals": visual_signals,
            "image_count": 0,
            "llm_supports_vision": llm_supports_vision,
        }

    # Vision is available and valuable
    if visual_signals:
        strategy = "vision"
        justification = (
            f"{format_reason}. "
            f"Visual content signals detected in text: {', '.join(visual_signals[:8])}. "
            f"Vision processing applied across {images_available} page image(s) to capture diagrams, "
            f"tables, and architectural content that text extraction may miss."
        )
    elif suffix in _VISION_IMAGE_SUFFIXES:
        strategy = "vision"
        justification = f"{format_reason}. Vision is the primary (and only) extraction method for image files."
    else:
        strategy = "hybrid"
        justification = (
            f"{format_reason}. "
            f"No strong visual signals detected in extracted text, but vision applied to all {images_available} page(s) "
            f"as a precaution — the document may contain embedded diagrams or charts not referenced in text. "
            f"Results from both MarkItDown (text) and vision are merged; the richer content per field wins."
        )

    return {
        "strategy": strategy,
        "justification": justification,
        "visual_signals": visual_signals,
        "image_count": images_available,
        "llm_supports_vision": llm_supports_vision,
    }


def _log_processing_strategy(ra_id: str, filename: str, strategy_result: dict) -> None:
    """Log the vision vs. text processing decision to agent_decision_trail."""
    try:
        uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
        client = pymongo.MongoClient(uri)
        client["trace_db"]["agent_decision_trail"].insert_one({
            "ra_id": ra_id,
            "event_type": "document_processing_strategy",
            "filename": filename,
            "strategy": strategy_result.get("strategy"),
            "justification": strategy_result.get("justification"),
            "visual_signals": strategy_result.get("visual_signals", []),
            "image_count": strategy_result.get("image_count", 0),
            "llm_supports_vision": strategy_result.get("llm_supports_vision"),
            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.warning(f"Failed to log processing strategy for {filename}: {exc}")


_VISION_BATCH_SIZE = 10  # pages per LLM call — keeps each call within token limits

_VISION_LIST_FIELDS  = {"technologies", "regulations", "data_types", "third_parties", "risk_flags"}
_VISION_FIRST_FIELDS = {"document_type"}

_EXTRACTION_SCHEMA = """{
  "project_context": "Detailed technical description: system/project purpose, full architecture (all components and connections), complete tech stack, deployment environment, all in-scope components. 3-4 sentences minimum.",
  "business_impact": "Business criticality, all data categories processed/stored/transmitted and their sensitivity, full user and stakeholder range, financial/operational/reputational impact of breach or outage. 3-4 sentences minimum.",
  "overall_project_summary": "3-5 sentence executive summary for a risk assessment report header: what the system does, who uses it, what data it handles, its business criticality, the sensitivity of that data, the range of users affected, and why it is being assessed.",
  "jira_context": "If the document contains Jira tickets, sprints, open defects, incidents, or delivery risks — summarise them. Empty string if none present.",
  "free_text_context": "Any additional risk-relevant content: threat actors, past incidents, audit findings, pen-test observations, vulnerabilities, architectural debt, third-party risks, or any other material an assessor should know.",
  "document_type": "architecture_doc | security_policy | vapt_report | data_flow_diagram | jira_export | compliance_doc | vendor_assessment | threat_model | sow | incident_report | other",
  "technologies": ["Every specific technology, framework, language, database, cloud service, or platform named"],
  "regulations": ["Every regulation, standard, directive, or clause named — for metadata only, not auto-populated into regulatory_context"],
  "data_types": ["Every data category processed, stored, or transmitted — be specific (e.g. PII, payment card data, health records, credentials, audit logs)"],
  "third_parties": ["Every external vendor, SaaS provider, cloud provider, payment gateway, or integration partner mentioned"],
  "risk_flags": ["Every specific risk concern, control gap, vulnerability, open finding, or red flag — be concrete and name the specific issue"]
}"""

_VISION_INSTRUCTIONS = (
    "Read and interpret EVERYTHING you can see:\n"
    "  • All text — paragraphs, headings, labels, captions, footnotes, watermarks\n"
    "  • Architecture diagrams — name every component, service, and connection you can read\n"
    "  • Data-flow / network topology diagrams — describe data movement and trust boundaries\n"
    "  • Tables — extract the key data, column headers, and row values\n"
    "  • Charts and graphs — describe what metric is shown and the key trend or values\n"
    "  • Process flows and swimlane diagrams — describe each step and actor\n"
    "  • SmartArt, callouts, and annotations — include all labelled content\n"
    "  • Handwritten annotations — transcribe if legible\n\n"
    "Return ONLY a valid JSON object with ALL of these exact fields. "
    "Populate each field as richly as possible from everything you can see and read. "
    "Use \"\" or [] ONLY when the document has absolutely no relevant evidence:\n\n"
    + _EXTRACTION_SCHEMA
    + "\n\nCritical rules:\n"
    "- Be SPECIFIC and DETAILED — longer richer content always preferred over generic one-liners.\n"
    "- For architecture diagrams: name every box, arrow, protocol, and port label you can read.\n"
    "- For tables: extract the actual data values, not just 'a table is present'.\n"
    "- For charts: state the metric name, axis labels, and key data points or trends.\n"
    "- Preserve exact names, version numbers, IP ranges, clause references, and technical details.\n"
    "- Do NOT invent items not present or strongly implied in the document."
)


def _merge_vision_results(results: list[dict]) -> dict:
    """Merge extraction dicts from multiple page-batches into one combined result.

    String fields: concatenate content from different batches (each batch covers
    different pages so the content is genuinely additive, not redundant).
    List fields: union of all items, deduplicated, order-preserving.
    document_type: first non-empty value wins (from the first/cover pages).
    """
    merged: dict = {}
    for result in results:
        if not isinstance(result, dict):
            continue
        for key, value in result.items():
            if key in _VISION_LIST_FIELDS:
                existing: list = merged.get(key, [])
                seen = set(existing)
                for item in (value if isinstance(value, list) else []):
                    if item and str(item).strip() and str(item).strip() not in seen:
                        existing.append(str(item).strip())
                        seen.add(str(item).strip())
                merged[key] = existing
            elif key in _VISION_FIRST_FIELDS:
                if not merged.get(key) and value:
                    merged[key] = value
            else:
                existing_str = merged.get(key, "")
                new_str = str(value).strip() if isinstance(value, str) else ""
                if new_str:
                    merged[key] = (existing_str + "\n\n" + new_str).strip() if existing_str else new_str
                elif not existing_str:
                    merged[key] = value
    return merged


def _image_mime_type(img_bytes: bytes) -> str:
    """Detect image MIME type from magic bytes so the data-URI is correct for every format.

    Falls back to image/png when the format is unrecognised — most LLMs accept it.
    """
    if img_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if img_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if img_bytes[:4] == b"RIFF" and img_bytes[8:12] == b"WEBP":
        return "image/webp"
    if img_bytes[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if img_bytes[:2] == b"BM":
        return "image/bmp"
    if img_bytes[:4] in (b"II*\x00", b"MM\x00*"):
        return "image/tiff"
    return "image/png"


def _llm_extract_context_with_vision(text: str, images: list[bytes]) -> dict:
    """Process ALL pages of a document — no fixed page cap.

    Documents vary in length (2 pages to 50+ pages). Every page is processed by
    splitting into batches of _VISION_BATCH_SIZE and making one LLM call per batch.
    Results are merged so content from every section is captured.

    Falls back to text-only extraction if the active LLM does not support vision
    or if all batch calls fail.
    """
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm

    if not images:
        return _llm_extract_context_from_document(text)

    batches = [images[i:i + _VISION_BATCH_SIZE] for i in range(0, len(images), _VISION_BATCH_SIZE)]
    total_pages = len(images)
    logger.info(f"Vision extraction: {total_pages} page(s) split into {len(batches)} batch(es)")

    all_results: list[dict] = []
    llm = get_llm()

    for batch_idx, batch in enumerate(batches):
        page_start = batch_idx * _VISION_BATCH_SIZE + 1
        page_end   = page_start + len(batch) - 1
        batch_label = f"pages {page_start}–{page_end} of {total_pages}"

        # Include extracted text only in the first batch to provide document-wide context
        text_section = (f"Extracted text content (full document):\n{text[:5000]}\n\n" if batch_idx == 0 and text.strip() else "")

        prompt = (
            f"You are a senior technology risk assessor. You are analysing {batch_label} of a document "
            f"uploaded for a risk assessment. The document has {total_pages} page(s) total; "
            f"this batch shows {len(batch)} page(s).\n\n"
            + text_section
            + _VISION_INSTRUCTIONS
        )

        content_parts: list[dict] = [{"type": "text", "text": prompt}]
        for img_bytes in batch:
            mime = _image_mime_type(img_bytes)
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{base64.b64encode(img_bytes).decode()}"},
            })

        try:
            response = llm.invoke([HumanMessage(content=content_parts)])
            raw = response.content.strip()
            raw = _re.sub(r"^```[a-zA-Z]*\n?", "", raw)
            raw = _re.sub(r"\n?```$", "", raw).strip()
            batch_result = json.loads(raw)
            if isinstance(batch_result, dict):
                all_results.append(batch_result)
                logger.info(f"Vision batch {batch_idx + 1}/{len(batches)} succeeded")
        except Exception as exc:
            logger.warning(f"Vision batch {batch_idx + 1}/{len(batches)} failed ({exc}); skipping batch")

    if not all_results:
        logger.warning("All vision batches failed — falling back to text-only extraction")
        return _llm_extract_context_from_document(text)

    return _merge_vision_results(all_results)


def _merge_extraction_dicts(text_result: dict, vision_result: dict) -> dict:
    """Merge text-only and vision extraction results into one richer combined dict.

    When a document contains both prose AND diagrams/tables, each extractor captures
    complementary information — text extraction reads the full written content (up to
    18 000 chars of prose), while vision reads the visual layer (component diagrams,
    data-flow arrows, table cell values).  Neither is a superset of the other.

    Strategy per field type:
      - String fields: concatenate both with labelled sections so downstream agents
        see the textual explanation AND the visual interpretation side by side.
        Empty contributions are skipped so we don't add blank sections.
      - List fields: union of both, deduplicated, order-preserving.
      - document_type: vision wins when non-empty (cover-page layout is more reliable).
    """
    merged: dict = {}
    all_keys = set(text_result) | set(vision_result)
    for key in all_keys:
        t_val = text_result.get(key)
        v_val = vision_result.get(key)

        if key == "document_type":
            merged[key] = (v_val or t_val or "")

        elif key in _VISION_LIST_FIELDS:
            combined: list = []
            seen: set = set()
            for item in list(t_val or []) + list(v_val or []):
                s = str(item).strip()
                if s and s not in seen:
                    combined.append(s)
                    seen.add(s)
            merged[key] = combined

        else:
            # String fields — concatenate complementary content
            t_str = str(t_val).strip() if isinstance(t_val, str) else ""
            v_str = str(v_val).strip() if isinstance(v_val, str) else ""
            if t_str and v_str and t_str != v_str:
                merged[key] = f"{t_str}\n\n[Visual content from diagrams/tables]\n{v_str}"
            else:
                merged[key] = v_str or t_str

    return merged


def _llm_extract_context_from_document(markdown: str) -> dict:
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm
    doc_excerpt = markdown[:18000]
    prompt = f"""You are a senior technology risk assessor performing a thorough document analysis to populate a risk assessment context. Read the entire document carefully and extract rich, detailed information for every field that has relevant evidence.

Document content:
{doc_excerpt}

Return ONLY a valid JSON object with ALL of these exact fields. Populate each field as richly as possible from the document. Leave a field as "" or [] ONLY if the document contains absolutely no relevant evidence for it.

{{
  "project_context": "Detailed technical description covering: what the system/project is, its full architecture (components, layers, integrations), the complete tech stack (languages, frameworks, databases, cloud services), deployment environment (on-prem/cloud/hybrid, regions, containerisation), and all in-scope components. Write at least 3-4 sentences if evidence exists.",
  "business_impact": "Detailed description covering: business criticality and why this system matters, all categories of data it processes/stores/transmits and their sensitivity, the full range of users and stakeholders affected, and the financial, operational, and reputational impact of a breach, outage, or compliance failure. Write at least 3-4 sentences if evidence exists.",
  "overall_project_summary": "A 3-5 sentence executive summary written for a risk assessment report header. Cover: what the system does, who uses it, what data it handles, its business criticality and the financial/operational/reputational impact of a breach or outage, and why it is being assessed now.",
  "jira_context": "If the document contains Jira tickets, sprint data, delivery risks, open defects, incidents, or project management artefacts — summarise the open items, high-priority tickets, delivery risks, and any defects or incidents relevant to security or risk. Leave empty if no Jira or delivery context is present.",
  "free_text_context": "Any additional risk-relevant context from the document that does not fit the fields above: threat actors mentioned, past incidents described, audit findings, pen test observations, known vulnerabilities, architectural debt, third-party risks, or any other material that an assessor should know.",
  "document_type": "One of: architecture_doc | security_policy | vapt_report | data_flow_diagram | jira_export | compliance_doc | vendor_assessment | threat_model | sow | incident_report | other",
  "technologies": ["Every specific technology, framework, language, database, cloud service, or platform explicitly named in the document"],
  "regulations": ["Every regulation, standard, directive, or clause explicitly named"],
  "data_types": ["Every category of data processed, stored, or transmitted — be specific (e.g. PII, payment card data, health records, credentials, audit logs)"],
  "third_parties": ["Every external vendor, SaaS provider, cloud provider, payment gateway, or integration partner mentioned"],
  "risk_flags": ["Every specific risk concern, control gap, vulnerability, open finding, or red flag identified — be concrete and name the specific issue"]
}}

Critical rules:
- Be SPECIFIC and DETAILED — generic one-liners are not useful. Longer, richer content is always preferred.
- Do NOT invent items not present or strongly implied in the document.
- Use "" for string fields and [] for list fields where the document has no evidence.
- Preserve specific names, version numbers, clause references, and technical details exactly as they appear."""
    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        raw = _re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = _re.sub(r"\n?```$", "", raw).strip()
        extracted = json.loads(raw)
        if not isinstance(extracted, dict):
            return {}
        return extracted
    except Exception as exc:
        logger.warning(f"LLM document extraction failed: {exc}")
        return {}


def _chunk_context_text(text: str, chunk_size: int = 2500) -> list[str]:
    clean = _clean_report_text(text or "").strip()
    if not clean:
        return []
    return [clean[i:i + chunk_size] for i in range(0, len(clean), chunk_size) if clean[i:i + chunk_size].strip()]


def _normalize_controls_for_suggestion(raw_controls: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    seen_ids: set[str] = set()
    for control in raw_controls:
        control_id = str(control.get("control_id") or control.get("id") or "").strip()
        control_title = str(
            control.get("control_title")
            or control.get("control_name")
            or control.get("title")
            or control.get("name")
            or ""
        ).strip()
        if not control_id or not control_title or control_id in seen_ids:
            continue
        seen_ids.add(control_id)
        normalized.append({
            "control_id": control_id,
            "control_title": _clean_report_text(control_title),
            "description": _clean_report_text(str(control.get("description") or "")),
            "domain": str(control.get("domain") or "General"),
            "keywords": [str(keyword) for keyword in control.get("keywords", [])],
        })
    return normalized


def _preferred_control_domains_for_risk(risk: dict) -> list[str]:
    domains = list(_RISK_CATEGORY_DOMAIN_HINTS.get(str(risk.get("risk_category") or ""), []))
    risk_text = " ".join([
        str(risk.get("title") or ""),
        str(risk.get("description") or ""),
        str(risk.get("human_rationale") or ""),
    ])
    for token in _tokenize_match_text(risk_text):
        domains.extend(_RISK_KEYWORD_DOMAIN_HINTS.get(token, []))
    seen: set[str] = set()
    ordered: list[str] = []
    for domain in domains:
        if domain and domain not in seen:
            seen.add(domain)
            ordered.append(domain)
    return ordered


def _score_control_for_risk(risk: dict, control: dict) -> tuple[int, list[str]]:
    risk_tokens = _tokenize_match_text(
        " ".join([
            str(risk.get("title") or ""),
            str(risk.get("description") or ""),
            str(risk.get("human_rationale") or ""),
            str(risk.get("risk_category") or ""),
        ])
    )
    title_tokens = _tokenize_match_text(control.get("control_title", ""))
    description_tokens = _tokenize_match_text(control.get("description", ""))
    keyword_tokens = _tokenize_match_text(" ".join(control.get("keywords", [])))
    control_tokens = title_tokens | description_tokens | keyword_tokens
    shared_tokens = sorted(risk_tokens & control_tokens)
    preferred_domains = _preferred_control_domains_for_risk(risk)

    score = len(shared_tokens) + (2 * len(risk_tokens & title_tokens))
    reasons: list[str] = []
    if shared_tokens:
        reasons.append(f"Shared terms: {', '.join(shared_tokens[:3])}")
    if control.get("domain") in preferred_domains:
        score += 2
        reasons.append(f"Matches {control['domain']} control domain")
        if preferred_domains and control.get("domain") == preferred_domains[0]:
            score += 1
    return score, reasons


def _fallback_control_suggestions(risks: list[dict], controls: list[dict]) -> list[dict]:
    suggestions: list[dict] = []
    for risk in risks:
        scored: list[tuple[int, dict, list[str]]] = []
        for control in controls:
            score, reasons = _score_control_for_risk(risk, control)
            if score > 0:
                scored.append((score, control, reasons))

        if not scored:
            preferred_domains = _preferred_control_domains_for_risk(risk)
            for control in controls:
                if control.get("domain") in preferred_domains:
                    scored.append((1, control, [f"Matches {control['domain']} control domain"]))

        if not scored:
            scored = [(1, control, ["Selected as a baseline control-library safeguard for manual review."]) for control in controls[:3]]

        ranked_controls = sorted(
            scored,
            key=lambda item: (-item[0], item[1].get("control_title", "")),
        )[:3]

        for score, control, reasons in ranked_controls:
            suggestions.append({
                "risk_id": risk["id"],
                "control_id": control["control_id"],
                "control_title": control["control_title"],
                "rationale": "; ".join(reasons) if reasons else "Selected from the controls library for this risk.",
                "relevance_score": max(1, min(5, score)),
            })
    return suggestions


def _normalize_llm_suggestions(raw_suggestions: list[dict], risks: list[dict], controls: list[dict]) -> list[dict]:
    controls_by_id = {control["control_id"]: control for control in controls}
    valid_risk_ids = {risk["id"] for risk in risks}
    default_risk_id = risks[0]["id"] if len(risks) == 1 else None
    normalized: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()

    for item in raw_suggestions:
        if not isinstance(item, dict):
            continue
        control_id = str(item.get("control_id") or "").strip()
        if control_id not in controls_by_id:
            continue
        risk_id = str(item.get("risk_id") or "").strip()
        if risk_id not in valid_risk_ids:
            if default_risk_id is None:
                continue
            risk_id = default_risk_id
        pair = (risk_id, control_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        try:
            relevance_score = int(item.get("relevance_score", 3))
        except (TypeError, ValueError):
            relevance_score = 3
        control = controls_by_id[control_id]
        normalized.append({
            "risk_id": risk_id,
            "control_id": control_id,
            "control_title": _clean_report_text(str(item.get("control_title") or control["control_title"])),
            "rationale": _clean_report_text(str(item.get("rationale") or "Selected from the controls library.")),
            "relevance_score": max(1, min(5, relevance_score)),
        })
    return normalized


def _build_risk_assessment_report(ra: RiskAssessment, asset_store: Any, generated_at: datetime | None = None) -> str:
    generated_at = generated_at or datetime.utcnow()
    ad_hoc_map = {a["id"]: a for a in ra.ad_hoc_applications}
    responses_by_asset: dict[str, list[dict]] = {}
    for response in ra.responses:
        responses_by_asset.setdefault(response["asset_id"], []).append(response)

    risks_by_asset: dict[str, list[dict]] = {}
    for risk in ra.risks:
        risks_by_asset.setdefault(risk["asset_id"], []).append(risk)

    controls_by_risk: dict[str, list[str]] = {}
    for control in ra.applied_controls:
        controls_by_risk.setdefault(control["risk_id"], []).append(control["control_id"])

    suggestions_by_risk: dict[str, list[dict]] = {}
    for suggestion in (ra.suggested_controls or []):
        suggestions_by_risk.setdefault(suggestion["risk_id"], []).append(suggestion)

    sections = get_sections()
    sections_total = len(sections)
    question_count = sum(len(section["questions"]) for section in sections)
    answer_counts = Counter((response.get("answer") or "").lower() for response in ra.responses)
    risk_band_counts = Counter(risk.get("inherent_risk_band", "Unknown") for risk in ra.risks)
    risk_category_counts = Counter(risk.get("risk_category", "Uncategorised") for risk in ra.risks)
    subject_profiles = [
        _resolve_subject_profile(asset_store, asset_id, ad_hoc_map)
        for asset_id in ra.asset_ids
    ]
    ranked_risks = sorted(
        ra.risks,
        key=lambda risk: (-risk.get("inherent_risk_score", 0), risk.get("title", "")),
    )
    missing_suggestions = [risk for risk in ra.risks if not suggestions_by_risk.get(risk["id"])]

    lines = [
        "# Report Header",
        f"Assessment Name: {ra.title}",
        f"Assessment Description: {ra.description or 'Not provided'}",
        f"Date of Report: {_format_calendar_date(generated_at)}",
        f"Assessment Created: {_format_calendar_date(ra.created_at)}",
        f"Assessment Updated: {_format_calendar_date(ra.updated_at)}",
        f"Assessment Status: {ra.status.replace('_', ' ').title()}",
        f"Applications in Scope: {len(subject_profiles)}",
        "",
        "# Executive Summary",
    ]

    summary = [
        f"This assessment covers {len(subject_profiles)} application(s)",
        f"with {len(ra.responses)} questionnaire response(s)",
        f"and {len(ra.risks)} identified risk(s).",
    ]
    if ra.risks:
        summary.append(
            "Risk distribution by band is "
            + ", ".join(f"{band}: {count}" for band, count in sorted(risk_band_counts.items()))
            + "."
        )
    if ra.applied_controls:
        summary.append(f"{len(ra.applied_controls)} control(s) have been applied to the recorded risks.")
    else:
        summary.append("No controls have been applied yet.")
    if ra.suggested_controls:
        summary.append(f"{len(ra.suggested_controls)} suggested control option(s) are available for review.")
    else:
        summary.append("No control suggestions have been generated yet, so remediation planning still requires manual review.")
    lines.append(" ".join(summary))

    lines.extend([
        "",
        "# Assessment Scope",
        "Applications reviewed in this assessment:",
    ])
    for profile in subject_profiles:
        lines.append(
            f"- {profile['name']} ({profile['type']}) | CIA {profile['confidentiality']}/{profile['integrity']}/{profile['availability']} "
            f"(total {profile['cia_total']}, criticality {profile['criticality']})"
        )
        if profile["description"]:
            lines.append(f"  Description: {profile['description']}")
        if profile["hosting_type"] or profile["support_type"]:
            lines.append(
                f"  Hosting: {profile['hosting_type'] or 'Unspecified'} | Support: {profile['support_type'] or 'Unspecified'}"
            )
        if profile["classification"] or profile["jurisdiction"]:
            lines.append(
                f"  Classification: {profile['classification'] or 'Unspecified'} | Jurisdiction: {profile['jurisdiction'] or 'Unspecified'}"
            )

    lines.extend([
        "",
        "# Assessment Method",
        "The report is generated directly from stored assessment data to keep dates, counts, and application details exact.",
        f"The questionnaire contains {sections_total} section(s) and {question_count} total question(s) per application.",
        "Inherent risks are derived from the completed questionnaire responses and recorded risk entries.",
        "Residual risk values are based on the controls currently applied to each recorded risk.",
        "",
        "# Evidence Summary",
        f"Total Responses Recorded: {len(ra.responses)}",
        "Response Breakdown",
        f"- Yes: {answer_counts.get('yes', 0)}",
        f"- No: {answer_counts.get('no', 0)}",
        f"- N/A: {answer_counts.get('na', 0)}",
        f"- Responses with analyst notes: {sum(1 for response in ra.responses if response.get('details', '').strip())}",
        "",
        "# Application-by-Application Findings",
    ])

    for profile in subject_profiles:
        asset_id = profile["id"]
        asset_responses = responses_by_asset.get(asset_id, [])
        asset_risks = risks_by_asset.get(asset_id, [])
        asset_answer_counts = Counter((response.get("answer") or "").lower() for response in asset_responses)
        sections_answered = len({response.get("section_id") for response in asset_responses if response.get("section_id")})
        notable_details = [response.get("details", "").strip() for response in asset_responses if response.get("details", "").strip()]

        lines.extend([
            f"## {profile['name']}",
            f"Application Type: {profile['type']}",
            f"Application Identifier: {asset_id}",
            f"CIA Profile: C {profile['confidentiality']} | I {profile['integrity']} | A {profile['availability']} | Total {profile['cia_total']} ({profile['criticality']})",
            f"Responses Recorded: {len(asset_responses)}",
            "Response Breakdown",
            f"- Yes: {asset_answer_counts.get('yes', 0)}",
            f"- No: {asset_answer_counts.get('no', 0)}",
            f"- N/A: {asset_answer_counts.get('na', 0)}",
            f"- Sections Answered: {sections_answered} of {sections_total}",
        ])
        if notable_details:
            lines.append("Key Analyst Notes")
            for detail in notable_details[:5]:
                lines.append(f"- {detail}")
        lines.append("Risk Findings")
        if asset_risks:
            for risk in sorted(asset_risks, key=lambda item: (-item.get("inherent_risk_score", 0), item.get("title", ""))):
                lines.append(
                    f"- {risk['title']} | {risk['risk_category']} | Inherent {risk['inherent_risk_band']} "
                    f"({risk['inherent_risk_score']}) | Residual {risk.get('residual_risk_band', 'Unknown')} "
                    f"({risk.get('residual_risk_score', 0)})"
                )
                if risk.get("description"):
                    lines.append(f"  Description: {risk['description']}")
                if risk.get("human_rationale"):
                    lines.append(f"  Rationale: {risk['human_rationale']}")
                applied_controls = controls_by_risk.get(risk["id"], [])
                if applied_controls:
                    lines.append(f"  Applied Controls: {', '.join(applied_controls)}")
                suggested_controls = suggestions_by_risk.get(risk["id"], [])
                if suggested_controls:
                    lines.append("  Suggested Controls:")
                    for suggestion in suggested_controls[:3]:
                        lines.append(
                            f"  - {suggestion.get('control_title', suggestion.get('control_id', 'Unknown control'))} "
                            f"(relevance {suggestion.get('relevance_score', 'n/a')}/5)"
                        )
                else:
                    lines.append("  Suggested Controls: None generated")
        else:
            lines.append("- No risks recorded for this application.")
        lines.append("")

    lines.append("# Cross-Application Risk Themes")
    if not ra.risks:
        lines.append("No risk themes are available because no risks have been recorded.")
    else:
        lines.append("Risk themes observed across the assessment:")
        for category, count in sorted(risk_category_counts.items()):
            lines.append(f"- {category}: {count} risk(s)")
        lines.append("Risk severity distribution:")
        for band, count in sorted(risk_band_counts.items()):
            lines.append(f"- {band}: {count}")

    lines.extend([
        "",
        "# Prioritized Remediation Themes",
    ])
    if not ranked_risks:
        lines.append("No remediation themes are available because no risks have been identified.")
    else:
        for index, risk in enumerate(ranked_risks, start=1):
            lines.append(
                f"{index}. {risk['title']} | {risk['risk_category']} | Inherent score {risk['inherent_risk_score']} ({risk['inherent_risk_band']})"
            )
            if suggestions_by_risk.get(risk["id"]):
                top_suggestion = suggestions_by_risk[risk["id"]][0]
                lines.append(
                    f"   Recommended next control: {top_suggestion.get('control_title', top_suggestion.get('control_id', 'Unknown control'))}"
                )
            else:
                lines.append("   Recommended next control: Manual control selection required.")

    lines.extend([
        "",
        "# Issues Affecting Suggested Controls",
    ])
    if not ra.suggested_controls:
        lines.append("No suggested controls have been generated for this assessment, so remediation planning remains incomplete.")
    elif missing_suggestions:
        lines.append("The following risks do not yet have suggested controls:")
        for risk in missing_suggestions:
            lines.append(f"- {risk['title']}")
    else:
        lines.append("Suggested controls are available for every recorded risk.")
    if not ra.applied_controls:
        lines.append("No controls have been applied yet, so residual risk reduction has not been demonstrated in the report data.")

    return _clean_report_text("\n".join(lines).strip())


# ── Route handlers ───────────────────────────────────────────────────────────

@router.get("/sections")
def get_assessment_sections():
    return {"sections": get_sections()}


@router.post("", status_code=201, response_model=RiskAssessment)
def create_assessment(body: RiskAssessmentCreate):
    created = get_store().create(body)
    _record_user_event(
        created.id,
        "assessment_created",
        {"title": body.title, "asset_ids": body.asset_ids},
    )
    return created


@router.get("", response_model=list[RiskAssessment])
def list_assessments(status: str | None = None):
    return get_store().list(status)


@router.get("/{ra_id}", response_model=RiskAssessment)
def get_assessment(ra_id: str):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    return ra


@router.put("/{ra_id}/context", response_model=RiskAssessment)
def update_assessment_context(ra_id: str, body: RiskAssessmentContextUpdate):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    get_store().update_context_profile(ra_id, body.context_profile.model_dump())
    _record_user_event(ra_id, "context_profile_updated", {"fields_set": list(body.context_profile.model_fields_set)})
    updated = get_store().get(ra_id)
    if not updated:
        raise HTTPException(404, "Assessment not found")
    return updated


def _is_extraction_meaningful(extracted: dict) -> bool:
    """Return True if the extraction result contains risk-relevant content.

    Technologies alone are NOT sufficient — a resume lists Python/Java as skills but is
    irrelevant. We require at least one strong risk signal:

      1. Named document_type (not "other") — LLM recognised it as a specific technical doc
      2. risk_flags present — explicit findings/vulnerabilities cited
      3. regulations present — compliance obligations identified
      4. data_types present — sensitive data categories identified (PII, PCI, PHI, etc.)
      5. Two or more substantial narrative fields (>80 chars each) — enough context to be
         useful; one long field could still be a biography or CV work history

    Everything else (technologies only, third_parties only, all-empty) is rejected.
    """
    doc_type = extracted.get("document_type", "other")
    if doc_type and doc_type != "other":
        return True
    if extracted.get("risk_flags"):
        return True
    if extracted.get("regulations"):
        return True
    if extracted.get("data_types"):
        return True
    _NARRATIVE = ("project_context", "business_impact", "overall_project_summary", "free_text_context")
    substantial = [f for f in _NARRATIVE if len(str(extracted.get(f, "")).strip()) > 80]
    return len(substantial) >= 2


@router.post("/{ra_id}/context-files", status_code=201)
async def upload_assessment_context_file(
    ra_id: str,
    file: UploadFile = File(...),
    source_type: str = Form("document"),
):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    content = await file.read()
    if not content:
        raise HTTPException(400, "Uploaded file is empty")
    filename = file.filename or "context-upload"
    text, metadata = _extract_context_text(filename, content, source_type=source_type)
    chunks = [
        {"id": str(uuid.uuid4()), "chunk_index": i, "text": chunk, "metadata": metadata}
        for i, chunk in enumerate(_chunk_context_text(text))
    ]
    # Vision extraction: render document pages / images and send to multimodal LLM.
    # Falls back to text-only automatically if vision is unavailable or fails.
    page_images = _render_document_to_images(filename, content)
    processing_strategy = _decide_processing_strategy(filename, text, len(page_images))
    _log_processing_strategy(ra_id, filename, processing_strategy)
    doc_metadata: dict = {}
    content_relevant: bool = True
    if text.strip() or page_images:
        strategy = processing_strategy.get("strategy", "vision")
        if strategy == "hybrid" and text.strip() and page_images:
            # True hybrid: run both extractors concurrently and merge complementary content.
            # Text extraction captures the full prose (up to 18 000 chars);
            # vision extraction captures diagrams, tables, and visual layouts.
            # Both run in parallel via ThreadPoolExecutor — they read from independent data
            # (text string vs image bytes) so there is no shared mutable state.
            # Results are merged field-by-field so nothing is lost.
            # The merged doc_llm_extraction is stored in MongoDB and later included in
            # context_pack, which both SA and RA agents receive unchanged.
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=2) as _ex:
                _fut_text   = _ex.submit(_llm_extract_context_from_document, text)
                _fut_vision = _ex.submit(_llm_extract_context_with_vision, text, page_images)
                text_extracted   = _fut_text.result()
                vision_extracted = _fut_vision.result()
            extracted = _merge_extraction_dicts(text_extracted, vision_extracted)
            logger.info(f"Hybrid extraction complete for {filename} — merged text + vision results (parallel)")
        elif strategy == "text_only":
            # Plain text formats (txt, md, json, csv) and fallback when no images are available
            # or the active LLM does not support vision.  Avoids an unnecessary vision call.
            extracted = _llm_extract_context_from_document(text)
        else:
            extracted = _llm_extract_context_with_vision(text, page_images)
        content_relevant = True
        if extracted and not _is_extraction_meaningful(extracted):
            logger.warning(
                f"Extracted context from '{filename}' appears unrelated to risk assessment "
                f"(document_type='{extracted.get('document_type', '')}', all substantive fields empty). "
                f"File stored but excluded from risk assessment context."
            )
            extracted = {}
            content_relevant = False
        doc_llm_extraction: dict = {}
        merged_profile: dict | None = None
        if extracted:
            doc_metadata = {k: extracted[k] for k in _DOC_METADATA_FIELDS if k in extracted}
            # Preserve full per-document vision/text extraction on the source record.
            # Narrative fields (project_context, business_impact, free_text_context) capture
            # diagram, table, and chart interpretations that may not appear in raw full_text.
            # Stored here so _build_ra_context_pack can show them even if full_text is short.
            doc_llm_extraction = {
                k: extracted[k]
                for k in (_CONTEXT_PROFILE_FIELDS | _DOC_METADATA_FIELDS)
                if k in extracted and extracted[k]
            }
            existing = ra.context_profile or {}
            existing_dict = existing if isinstance(existing, dict) else (existing.model_dump() if hasattr(existing, "model_dump") else dict(existing))
            merged_profile = {
                **existing_dict,
                **{
                    k: extracted[k]
                    for k in _CONTEXT_PROFILE_FIELDS
                    if k in extracted
                    and isinstance(extracted[k], str)
                    and extracted[k].strip()
                    and len(extracted[k].strip()) > len(str(existing_dict.get(k, "")).strip())
                },
            }
            # Do NOT write to MongoDB yet — wait until classification confirms relevance.
            # Writing here and rolling back on rejection is not atomic; deferred write is safer.
    # Document Classification Agent — determine relevance and type before storing
    from utils.agentic_pipeline import classify_document_for_risk_assessment
    classification = classify_document_for_risk_assessment(
        ra_id=ra_id,
        filename=filename,
        text_excerpt=text[:3000],
        doc_metadata=doc_metadata,
        user_tag=source_type if source_type != "document" else None,
    )

    # Reject irrelevant documents immediately — do not store them anywhere.
    # The user should not have to manually remove files the LLM determined are irrelevant.
    document_accepted = content_relevant and classification["relevant"]
    if not document_accepted:
        return {
            "ok": False,
            "accepted": False,
            "source": None,
            "chunks_created": 0,
            "classification": classification,
            "content_relevant": content_relevant,
            "processing_strategy": processing_strategy,
            "assessment": get_store().get(ra_id),
        }

    # Document accepted — now safe to write the extracted context profile to MongoDB.
    if merged_profile:
        get_store().update_context_profile(ra_id, merged_profile)

    source = {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "content_type": file.content_type,
        "source_type": classification["classified_type"],
        "user_tag": source_type if source_type != "document" else None,
        "tag_overridden": classification["overrides_user_tag"],
        "relevance": "accepted",
        "relevance_reasoning": classification["reasoning"],
        "rejection_reason": "",
        "classification_confidence": classification["confidence"],
        "sha256": hashlib.sha256(content).hexdigest(),
        "summary": _clean_report_text(text)[:500],
        "metadata": metadata,
        "full_text": text[:60000],
        "doc_metadata": doc_metadata,
        "doc_llm_extraction": doc_llm_extraction,
    }
    get_store().add_context_source(ra_id, source, chunks)
    _record_user_event(ra_id, "document_uploaded", {
        "filename": filename,
        "source_type": classification["classified_type"],
        "processing_strategy": processing_strategy.get("strategy"),
        "chunks_created": len(chunks),
    })
    updated = get_store().get(ra_id)
    return {
        "ok": True,
        "accepted": True,
        "source": source,
        "chunks_created": len(chunks),
        "classification": classification,
        "content_relevant": content_relevant,
        "processing_strategy": processing_strategy,
        "assessment": updated,
    }


@router.delete("/{ra_id}/context-files/{source_id}", status_code=200)
def delete_assessment_context_file(ra_id: str, source_id: str):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    ok = get_store().remove_context_source(ra_id, source_id)
    if not ok:
        raise HTTPException(404, "Context source not found")
    _record_user_event(ra_id, "document_deleted", {"source_id": source_id})
    updated = get_store().get(ra_id)
    return {"ok": True, "assessment": updated}


@router.post("/{ra_id}/recompute-context-profile")
def recompute_context_profile(ra_id: str):
    """Re-extract the context profile by reading ALL accepted documents together.

    Called by the frontend after a batch upload completes so the profile fields
    reflect a holistic reading of every document, not the last-one-wins merge
    that happens during per-document uploads.
    """
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")

    accepted_sources = [s for s in (ra.context_sources or []) if s.get("relevance") != "rejected"]
    if not accepted_sources:
        return {"ok": True, "assessment": ra}

    # Build a combined text from all accepted documents.
    # For image/vision-only docs there is no full_text — use their doc_llm_extraction
    # narrative fields instead so the LLM still sees what was extracted visually.
    _NARRATIVE_FIELDS = (
        "project_context", "business_impact", "overall_project_summary",
        "jira_context", "free_text_context",
    )
    combined_parts: list[str] = []
    for source in accepted_sources:
        filename = source.get("filename", "document")
        full_text = (source.get("full_text") or "").strip()
        llm_ext = source.get("doc_llm_extraction") or {}
        parts = [f"=== {filename} ==="]
        if full_text:
            parts.append(full_text[:8_000])
        for field in _NARRATIVE_FIELDS:
            val = str(llm_ext.get(field) or "").strip()
            if val:
                parts.append(f"[{field}]: {val}")
        combined_parts.append("\n".join(parts))

    combined_text = "\n\n".join(combined_parts)
    extracted = _llm_extract_context_from_document(combined_text)
    if extracted and _is_extraction_meaningful(extracted):
        existing_dict = (ra.context_profile or {})
        if not isinstance(existing_dict, dict):
            existing_dict = existing_dict.model_dump() if hasattr(existing_dict, "model_dump") else dict(existing_dict)
        merged = {
            **existing_dict,
            **{
                k: extracted[k]
                for k in _CONTEXT_PROFILE_FIELDS
                if k in extracted and isinstance(extracted[k], str) and extracted[k].strip()
            },
        }
        get_store().update_context_profile(ra_id, merged)

    _record_user_event(ra_id, "context_profile_recomputed", {
        "document_count": len(accepted_sources),
        "extraction_meaningful": bool(extracted and _is_extraction_meaningful(extracted)),
    })
    updated = get_store().get(ra_id)
    return {"ok": True, "assessment": updated}


@router.post("/{ra_id}/historical-context")
def refresh_historical_context(ra_id: str):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    matches = get_store().find_similar_assessments(ra)
    get_store().set_historical_matches(ra_id, matches)
    return {"assessment_id": ra_id, "matches": matches}


@router.get("/{ra_id}/pipeline-status")
def get_pipeline_status(ra_id: str):
    """Poll pipeline progress for Phase 1 or Phase 2."""
    # Read directly from MongoDB — pipeline_phase1_status etc. are not part of
    # the RiskAssessment Pydantic model and would be silently dropped by get_store().get().
    doc = pymongo.MongoClient(
        os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    )["trace_db"]["risk_assessments"].find_one({"_id": ra_id})
    if not doc:
        raise HTTPException(404, "Assessment not found")
    return {
        "assessment_id": ra_id,
        "pipeline_phase1_status": doc.get("pipeline_phase1_status", "idle"),
        "pipeline_phase2_status": doc.get("pipeline_phase2_status", "idle"),
        "pipeline_phase1_error":  doc.get("pipeline_phase1_error", ""),
        "pipeline_phase2_error":  doc.get("pipeline_phase2_error", ""),
        "pipeline_updated_at":    doc.get("pipeline_updated_at", ""),
        "suggested_questions":    doc.get("suggested_questions", []),
        "agentic_risks":          doc.get("agentic_risks", []),
    }


@router.get("/{ra_id}/audit-trail")
def get_audit_trail(ra_id: str, limit: int = 200):
    """Return the full agent decision trail for an assessment.

    Includes all logged events in chronological order:
    - lifecycle: pipeline start / complete events
    - jurisdiction_filtering: per-framework applicability decisions
    - routing: orchestrator routing decisions between agents
    - execution: individual agent LLM calls (prompt, response, duration)
    - doc_classification: document type classification decisions
    - processing_strategy: vision/text/hybrid strategy choices per document
    """
    import pymongo as _pymongo
    import os as _os
    _mongo_uri = _os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    try:
        col = _pymongo.MongoClient(_mongo_uri)["trace_db"]["agent_decision_trail"]
        events = list(
            col.find({"ra_id": ra_id}, {"_id": 0})
               .sort("timestamp", 1)
               .limit(limit)
        )
    except Exception as exc:
        raise HTTPException(500, f"Could not query audit trail: {exc}")
    return {
        "assessment_id": ra_id,
        "event_count": len(events),
        "events": events,
    }


@router.post("/{ra_id}/suggest-questions", status_code=202)
def suggest_context_questions(ra_id: str):
    """Enqueue Phase 1 agentic pipeline and return immediately (HTTP 202).

    All the work — enriching historical matches, building the context pack,
    fetching all assets in scope, running the Security Architect → Regulatory
    Analyst → Quality Analyst LangGraph pipeline, normalising and deduplicating
    question IDs — happens inside the ra_worker Celery task (ra_tasks.run_phase1).

    The frontend should poll GET /{ra_id}/pipeline-status until
    pipeline_phase1_status == "complete", then reload the assessment to get
    the suggested_questions list.
    """
    store = get_store()
    ra = store.get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")

    # Mark queued immediately so the UI spinner starts before the worker picks it up
    store._col.update_one(
        {"_id": ra_id},
        {"$set": {
            "pipeline_phase1_status": "queued",
            "pipeline_phase1_error": "",
            "pipeline_updated_at": datetime.now(dt.timezone.utc).isoformat(),
        }},
    )

    from utils.ra_tasks import run_phase1
    task = run_phase1.apply_async(args=[ra_id], queue="ra_pipeline")
    _record_user_event(ra_id, "phase1_pipeline_queued", {"task_id": task.id})

    return {
        "assessment_id": ra_id,
        "task_id": task.id,
        "status": "queued",
        "message": "Phase 1 pipeline queued — poll /pipeline-status for progress",
    }


@router.post("/{ra_id}/identify-risks-agentic", status_code=202)
def identify_risks_agentic(ra_id: str):
    """Enqueue Phase 2 agentic pipeline and return immediately (HTTP 202).

    All the work — building the context pack, fetching all assets, flattening
    questionnaire answers, loading the controls library, running the LangGraph
    pipeline, and writing the validated risks back to MongoDB — happens inside
    the ra_worker Celery task (ra_tasks.run_phase2).

    The frontend should poll GET /{ra_id}/pipeline-status until
    pipeline_phase2_status == "complete", then reload the assessment to get
    the agentic_risks list.
    """
    store = get_store()
    ra = store.get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")

    # Mark queued immediately so the UI spinner starts
    store._col.update_one(
        {"_id": ra_id},
        {"$set": {
            "pipeline_phase2_status": "queued",
            "pipeline_phase2_error": "",
            "pipeline_updated_at": datetime.now(dt.timezone.utc).isoformat(),
        }},
    )

    from utils.ra_tasks import run_phase2
    task = run_phase2.apply_async(args=[ra_id], queue="ra_pipeline")
    _record_user_event(ra_id, "phase2_pipeline_queued", {"task_id": task.id})

    return {
        "assessment_id": ra_id,
        "task_id": task.id,
        "status": "queued",
        "message": "Phase 2 pipeline queued — poll /pipeline-status for progress",
    }

@router.get("/{ra_id}/decision-trail")
def get_decision_trail(ra_id: str, phase: str | None = None):
    """Return the full agent decision trail for an assessment.

    Each entry in the trail is either:
      - An orchestrator routing decision (role='routing'): shows which agent ran,
        what was next, and why (advance_queue / next_round / pipeline_complete).
      - An agent execution (role='execution'): includes the full prompt sent to the
        LLM, the raw LLM response, the parsed output, timing, and success/failure status.

    This provides complete explainability and auditability for every AI decision.
    Query params:
      phase: filter by 'phase1' or 'phase2' (optional — returns all phases if omitted)
    """
    from utils.agentic_pipeline import _trail_col
    query: dict = {"ra_id": ra_id}
    if phase:
        query["phase"] = phase
    entries = list(
        _trail_col()
        .find(query, {"_id": 0})
        .sort([("phase", 1), ("step", 1)])
    )
    return {
        "assessment_id": ra_id,
        "total_steps": len(entries),
        "trail": entries,
    }


@router.post("/{ra_id}/suggest-questions/{question_id}/respond", status_code=201)
def answer_context_question(ra_id: str, question_id: str, body: SuggestedQuestionAnswer):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    ok = get_store().answer_suggested_question(ra_id, question_id, body.answer, body.details)
    if not ok:
        raise HTTPException(404, "Suggested question not found")
    _record_user_event(ra_id, "ai_context_question_answered", {
        "question_id": question_id,
        "answer": body.answer,
        "has_details": bool(body.details),
    })
    updated = get_store().get(ra_id)
    return {"ok": True, "suggested_questions": updated.suggested_questions if updated else []}


@router.delete("/{ra_id}", status_code=204)
def delete_assessment(ra_id: str):
    _record_user_event(ra_id, "assessment_deleted", {})
    if not get_store().delete(ra_id):
        raise HTTPException(404, "Assessment not found")


@router.post("/{ra_id}/respond", status_code=201)
def submit_response(ra_id: str, body: ResponseSubmit):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    response = {
        "id": str(uuid.uuid4()),
        "asset_id": body.asset_id,
        "section_id": body.section_id,
        "question_id": body.question_id,
        "answer": body.answer,
        "details": body.details,
        "submitted_at": datetime.utcnow().isoformat(),
    }
    get_store().add_response(ra_id, response)
    _record_user_event(ra_id, "question_answered", {
        "question_id": body.question_id,
        "section_id": body.section_id,
        "answer": body.answer,
        "asset_id": body.asset_id,
    })
    return {"ok": True, "response_id": response["id"]}


@router.post("/{ra_id}/respond-batch", status_code=200)
def submit_response_batch(ra_id: str, body: ResponseBatch):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    if not body.responses:
        raise HTTPException(400, "No responses provided")
    now = datetime.utcnow().isoformat()
    asset_id = body.responses[0].asset_id
    new_responses = [
        {
            "id": str(uuid.uuid4()),
            "asset_id": r.asset_id,
            "section_id": r.section_id,
            "question_id": r.question_id,
            "answer": r.answer,
            "details": r.details,
            "submitted_at": now,
        }
        for r in body.responses
    ]
    status = "draft" if body.save_as_draft else "in_progress"
    get_store().add_responses_batch(ra_id, asset_id, new_responses, status=status)
    _record_user_event(ra_id, "questionnaire_batch_submitted", {
        "asset_id": asset_id,
        "response_count": len(new_responses),
        "saved_as_draft": body.save_as_draft,
    })
    updated = get_store().get(ra_id)
    return updated


@router.get("/{ra_id}/risks")
def get_risks(ra_id: str):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    return {"assessment_id": ra_id, "risks": ra.risks}


@router.post("/{ra_id}/risks", status_code=201)
def add_human_risk(ra_id: str, body: RiskOverride):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    score = body.likelihood_score * body.impact_score
    risk = {
        "id": str(uuid.uuid4()),
        "asset_id": body.asset_id,
        "title": body.title,
        "description": body.description,
        "risk_category": body.risk_category,
        "likelihood_score": body.likelihood_score,
        "impact_score": body.impact_score,
        "inherent_risk_score": score,
        "inherent_risk_band": _inherent_risk_band(score),
        "residual_risk_score": score,
        "residual_risk_band": _inherent_risk_band(score),
        "source": "human_added",
        "human_rationale": body.human_rationale,
        "status": "identified",
    }
    get_store().add_risk(ra_id, risk)
    _record_user_event(ra_id, "risk_manually_added", {
        "risk_id": risk["id"],
        "title": risk["title"],
        "inherent_risk_band": risk["inherent_risk_band"],
        "inherent_risk_score": risk["inherent_risk_score"],
        "asset_id": body.asset_id,
    })
    return {"ok": True, "risk": risk}


@router.post("/{ra_id}/controls", status_code=201)
def apply_control(ra_id: str, body: ControlApplication):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    # Bug fix: return the existing applied control instead of creating duplicates.
    for existing in ra.applied_controls:
        if existing.get("risk_id") == body.risk_id and existing.get("control_id") == body.control_id:
            return {"ok": True, "control": existing, "duplicate": True}
    control = {
        "id": str(uuid.uuid4()),
        "risk_id": body.risk_id,
        "control_id": body.control_id,
        "source": body.source,
        "human_rationale": body.human_rationale,
        "effectiveness_score": 0.0,
        "applied_at": datetime.utcnow().isoformat(),
    }
    inserted = get_store().add_control(ra_id, control)
    if not inserted:
        refreshed = get_store().get(ra_id)
        if refreshed:
            for existing in refreshed.applied_controls:
                if existing.get("risk_id") == body.risk_id and existing.get("control_id") == body.control_id:
                    return {"ok": True, "control": existing, "duplicate": True}
    _record_user_event(ra_id, "control_applied", {
        "control_id": body.control_id,
        "risk_id": body.risk_id,
        "source": body.source,
    })
    return {"ok": True, "control": control, "duplicate": False}


@router.get("/{ra_id}/residual")
def get_residual(ra_id: str):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    results = []
    for risk in ra.risks:
        risk_id = risk["id"]
        applied = [c for c in ra.applied_controls if c["risk_id"] == risk_id]
        avg_eff = sum(c.get("effectiveness_score", 1.0) for c in applied) / len(applied) if applied else 0.0
        inherent = risk.get("inherent_risk_score", 0)
        residual = round(inherent * (1 - avg_eff), 2)
        results.append({
            "risk_id": risk_id,
            "risk_title": risk.get("title", ""),
            "asset_id": risk.get("asset_id", ""),
            "inherent_risk_score": inherent,
            "inherent_risk_band": risk.get("inherent_risk_band", ""),
            "controls_applied": len(applied),
            "avg_effectiveness": round(avg_eff, 2),
            "residual_risk_score": residual,
            "residual_risk_band": _inherent_risk_band(residual) if residual > 0 else "Low",
        })
    return {"assessment_id": ra_id, "residual_risks": results}


@router.post("/{ra_id}/analyze")
def analyze_assessment(ra_id: str):
    """Hybrid rule-layer + LLM analysis (Persona 5: Technology Risk Assessor)."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm
    import json as _json

    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    if not ra.responses:
        logger.warning(f"[{ra_id}] analyse called with no responses — proceeding with CIA-only scoring")

    from api.routers.assets import get_store as get_asset_store
    asset_store = get_asset_store()

    by_asset: dict[str, list[dict]] = {}
    for resp in ra.responses:
        by_asset.setdefault(resp["asset_id"], []).append(resp)

    all_risks: list[dict] = []

    ad_hoc_map = {a["id"]: a for a in ra.ad_hoc_applications}

    context_chunks = get_store().get_context_chunks(ra_id)
    if not ra.historical_matches:
        get_store().set_historical_matches(ra_id, get_store().find_similar_assessments(ra))
        ra = get_store().get(ra_id) or ra
    context_pack = _build_ra_context_pack(ra, context_chunks)

    for asset_id, asset_responses in by_asset.items():
        asset = asset_store.get(asset_id)
        ad_hoc = ad_hoc_map.get(asset_id)
        asset_name = (asset.name if asset else None) or (ad_hoc.get("name") if ad_hoc else None) or asset_id
        if asset:
            cia_total = asset.cia_total
            cia_band = compute_criticality(cia_total)
        elif ad_hoc:
            cia_total, cia_band = _cia_band_from_values(
                ad_hoc.get("confidentiality", 3),
                ad_hoc.get("integrity", 3),
                ad_hoc.get("availability", 3),
            )
        else:
            cia_total = 9
            cia_band = "Medium"

        rule_likelihood, rule_impact = _rule_layer_scores(asset_responses)

        qa_text = "\n".join(
            f"[{r['section_id']}] Q:{r['question_id']} | Answer:{r['answer']} | Details: {r.get('details', '')}"
            for r in asset_responses
        )

        context_questions_text = "\n".join(
            f"{q.get('section_id','')} | {q.get('text','')} | {q.get('answer','')} | {q.get('details','')}"
            for q in (ra.suggested_questions or [])
            if q.get("answer")
        ) or "None provided"

        prompt = f"""You are a cybersecurity risk analyst. Analyse the following assessment responses for an application and identify specific risks.

Application: {asset_name}
CIA Total: {cia_total}/15 (Band: {cia_band})

Assessment Responses (section | question | answer | details):
{qa_text}

Additional Risk Assessment Context:
{context_pack}

Context-Driven Question Responses (section | question | answer | details):
{context_questions_text}

Based on these responses and the CIA profile, identify 2-4 specific, actionable risks for this application.
Score based on the CIA band: Critical=high scores (4-5), High=moderate-high (3-4), Medium=moderate (2-3), Low=lower (1-2).
For each risk return a JSON object with:
- title: short risk title (max 10 words)
- description: 1-2 sentence description of the risk
- risk_category: one of [Operational, Regulatory, Privacy, Financial, Reputational, Technical]
- likelihood_score: integer 1-5 (score independently based on application profile and answers)
- impact_score: integer 1-5 (score independently based on application profile and answers)
- rationale: one sentence explaining the score

Return ONLY a valid JSON array, no markdown, no explanation.
Example: [{{"title":"Unauthorised data access","description":"...","risk_category":"Privacy","likelihood_score":3,"impact_score":4,"rationale":"..."}}]"""

        try:
            llm = get_llm()
            response = llm.invoke([HumanMessage(content=prompt)])
            content = response.content.strip()
            content = _re.sub(r"^```[a-zA-Z]*\n?", "", content)
            content = _re.sub(r"\n?```$", "", content).strip()
            llm_risks = _json.loads(content)
            if not isinstance(llm_risks, list):
                raise ValueError(f"Expected JSON array, got {type(llm_risks).__name__}")
        except Exception as e:
            logger.error(f"LLM analysis failed for asset {asset_id}: {e}")
            llm_risks = [{
                "title": f"{asset_name} — inherent risk",
                "description": "Risk derived from rule-layer scoring (LLM analysis unavailable).",
                "risk_category": "Operational",
                "likelihood_score": rule_likelihood,
                "impact_score": rule_impact,
                "rationale": "Derived from rule-based analysis of questionnaire responses.",
            }]

        for r in llm_risks:
            likelihood = int(r.get("likelihood_score", rule_likelihood))
            impact_val = int(r.get("impact_score", rule_impact))
            score = likelihood * impact_val
            all_risks.append({
                "id": str(uuid.uuid4()),
                "asset_id": asset_id,
                "title": r.get("title", "Unnamed Risk"),
                "description": r.get("description", ""),
                "risk_category": r.get("risk_category", "Operational"),
                "likelihood_score": likelihood,
                "impact_score": impact_val,
                "inherent_risk_score": score,
                "inherent_risk_band": _inherent_risk_band(score),
                "residual_risk_score": score,
                "residual_risk_band": _inherent_risk_band(score),
                "source": "llm_generated",
                "human_rationale": r.get("rationale", ""),
                "status": "identified",
            })

    get_store().set_risks(ra_id, all_risks)
    _record_user_event(ra_id, "analysis_completed", {
        "risks_identified": len(all_risks),
        "assets_analysed": len(by_asset),
        "mode": "rule_layer_plus_llm",
    })
    return {"assessment_id": ra_id, "risks_identified": len(all_risks), "risks": all_risks}


@router.post("/{ra_id}/suggest-controls")
def suggest_controls(ra_id: str):
    """Persona 6: Control Selector — rank library controls per risk finding."""
    from langchain.schema import HumanMessage
    from utils.llm_provider import get_llm
    from utils.controls_library import MongoControlsStore
    import json as _json

    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    if not ra.risks:
        raise HTTPException(400, "No risks yet. Run /analyze first.")

    ctrl_store = MongoControlsStore()
    raw_controls = ctrl_store.all_controls() if hasattr(ctrl_store, "all_controls") else ctrl_store.list()
    all_controls = _normalize_controls_for_suggestion(raw_controls)
    if not all_controls:
        get_store().set_suggested_controls(ra_id, [])
        return {"assessment_id": ra_id, "suggestions": []}
    controls_summary = "\n".join(
        f"- [{c['control_id']}] {c['control_title']} (domain: {c.get('domain', 'General')})"
        for c in all_controls[:100]
    )

    risk_summary = "\n".join(
        f"- [{r['id']}] {r['title']} | category: {r['risk_category']} | band: {r['inherent_risk_band']}"
        for r in ra.risks
    )

    prompt = f"""You are a control selection specialist for technology risk treatment.

Select and rank controls ONLY from the provided master controls library for each identified risk.
Do not recommend controls outside the provided library.

Risks identified:
{risk_summary}

Available controls library (id | title | domain):
{controls_summary}

For each risk, return up to 3 ranked control suggestions.
Return ONLY a valid JSON array, no markdown.
Each element: {{"risk_id": "...", "control_id": "...", "control_title": "...", "rationale": "...", "relevance_score": 1-5}}"""

    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content.strip()
        content = _re.sub(r"^```[a-zA-Z]*\n?", "", content)
        content = _re.sub(r"\n?```$", "", content).strip()
        raw_suggestions = _json.loads(content)
        if not isinstance(raw_suggestions, list):
            raise ValueError(f"Expected JSON array, got {type(raw_suggestions).__name__}")
        suggestions = _normalize_llm_suggestions(raw_suggestions, ra.risks, all_controls)
        if not suggestions:
            raise ValueError("LLM returned no usable control suggestions")
    except Exception as e:
        logger.error(f"Control suggestion LLM failed for {ra_id}: {e}")
        suggestions = _fallback_control_suggestions(ra.risks, all_controls)

    get_store().set_suggested_controls(ra_id, suggestions)
    return {"assessment_id": ra_id, "suggestions": suggestions}


@router.post("/{ra_id}/generate-report")
def generate_report(ra_id: str):
    """Persona 7: Assessment Report Writer — 9-section risk assessment report."""
    from api.routers.assets import get_store as get_asset_store

    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    if not ra.risks:
        raise HTTPException(400, "No risks identified. Run /analyze first.")

    asset_store = get_asset_store()
    try:
        report_md = _build_risk_assessment_report(ra, asset_store, generated_at=datetime.utcnow())
    except Exception as e:
        logger.error(f"Report generation failed for {ra_id}: {e}")
        report_md = f"# Risk Assessment Report\n\n**Report generation failed:** {e}\n\nPlease retry."

    get_store().set_report(ra_id, report_md)
    _record_user_event(ra_id, "report_generated", {"risk_count": len(ra.risks)})
    return {"assessment_id": ra_id, "report_markdown": report_md}



@router.get("/{ra_id}/report")
def get_report(ra_id: str):
    ra = get_store().get(ra_id)
    if not ra:
        raise HTTPException(404, "Assessment not found")
    if not ra.report_markdown:
        raise HTTPException(404, "No report generated yet. Call POST /{ra_id}/generate-report first.")
    return {"assessment_id": ra_id, "report_markdown": ra.report_markdown}

