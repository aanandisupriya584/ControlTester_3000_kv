"""Celery tasks for the risk assessment agentic pipeline.

Phase 1 — suggest_context_questions (Security Architect → Regulatory Analyst → Quality Analyst)
Phase 2 — identify_risks_agentic    (same agent chain, answer-driven)

Each task:
  1. Pulls the RA from MongoDB (fresh read inside the worker)
  2. Builds the context pack and resolves assets
  3. Runs the LangGraph pipeline
  4. Writes results back to MongoDB
  5. Updates pipeline_status to "complete" or "failed"

The FastAPI endpoints return 202 immediately with a task_id.
The frontend polls GET /{ra_id}/pipeline-status until status is complete.
"""
from __future__ import annotations

import datetime as dt
import logging
import os

import pymongo

from utils.ra_celery_app import celery_app

logger = logging.getLogger(__name__)

_MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")


def _get_col():
    return pymongo.MongoClient(_MONGO_URI)["trace_db"]["risk_assessments"]


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _set_pipeline_status(ra_id: str, phase: str, status: str, error: str = "") -> None:
    field = f"pipeline_{phase}_status"
    upd: dict = {field: status, "pipeline_updated_at": _now()}
    if error:
        upd[f"pipeline_{phase}_error"] = error
    _get_col().update_one({"_id": ra_id}, {"$set": upd})


@celery_app.task(name="ra_tasks.run_phase1")
def run_phase1(ra_id: str) -> dict:
    """Background task for Phase 1: suggest context questions."""
    _set_pipeline_status(ra_id, "phase1", "running")
    try:
        from utils.ra_store import get_store
        from utils.ra_models import SuggestedQuestion
        from utils.ra_context_builder import (
            _build_ra_context_pack,
            _resolve_subject_profile,
            _fallback_suggested_questions,
        )
        from utils.agentic_pipeline import run_phase1_pipeline
        from utils.assessment_questions import get_sections

        store = get_store()
        ra = store.get(ra_id)
        if not ra:
            _set_pipeline_status(ra_id, "phase1", "failed", "Assessment not found")
            return {"error": "Assessment not found"}

        matches = store.find_similar_assessments(ra)
        store.set_historical_matches(ra_id, matches)
        ra = store.get(ra_id) or ra

        chunks = store.get_context_chunks(ra_id)
        context_pack = _build_ra_context_pack(ra, chunks)

        assets: list[dict] = []
        if ra.asset_ids:
            from api.routers.assets import get_store as get_asset_store
            asset_store = get_asset_store()
            ad_hoc_map = {a["id"]: a for a in (ra.ad_hoc_applications or [])}
            assets = [_resolve_subject_profile(asset_store, aid, ad_hoc_map) for aid in ra.asset_ids]
        elif ra.ad_hoc_applications:
            from api.routers.assets import get_store as get_asset_store
            asset_store = get_asset_store()
            ad_hoc_map = {a["id"]: a for a in ra.ad_hoc_applications}
            assets = [_resolve_subject_profile(asset_store, a["id"], ad_hoc_map) for a in ra.ad_hoc_applications]

        try:
            ai_questions = run_phase1_pipeline(ra_id, context_pack, assets, get_sections(), store)
        except Exception as exc:
            logger.error(f"Phase 1 LangGraph failed for {ra_id}: {exc}")
            ai_questions = _fallback_suggested_questions(ra, chunks)
            for q in ai_questions:
                q["is_ai_generated"] = True

        # Build a token set for each static question for dedup comparison.
        # Jaccard similarity > 0.45 on 4+ char word tokens = near-duplicate.
        import re as _re

        def _tokens(text: str) -> set[str]:
            return set(_re.findall(r"[a-z]{4,}", text.lower()))

        static_token_sets: list[set[str]] = []
        for _sec in get_sections():
            for _q in _sec.get("questions", []):
                toks = _tokens(_q.get("text", ""))
                if toks:
                    static_token_sets.append(toks)

        def _is_duplicate_of_static(text: str, threshold: float = 0.45) -> bool:
            candidate_toks = _tokens(text)
            if not candidate_toks:
                return False
            for static_toks in static_token_sets:
                union = candidate_toks | static_toks
                if not union:
                    continue
                jaccard = len(candidate_toks & static_toks) / len(union)
                if jaccard >= threshold:
                    return True
            return False

        normalized: list[dict] = []
        seen_ids: set[str] = set()
        seen_texts: list[set[str]] = []   # for cross-AI dedup
        for i, item in enumerate(ai_questions[:25], start=1):
            if not isinstance(item, dict):
                continue
            candidate = dict(item)
            candidate.setdefault("question_id", f"dyn_agent_{i:03d}")
            candidate.setdefault("text", "")
            text = str(candidate.get("text", "")).strip()
            if not text:
                continue
            # Drop if semantically too close to a static bank question
            if _is_duplicate_of_static(text):
                logger.info(f"[Dedup] Dropped AI question (static match): {text[:80]}")
                continue
            # Drop if semantically too close to an already-accepted AI question
            candidate_toks = _tokens(text)
            is_ai_dup = False
            for prev_toks in seen_texts:
                union = candidate_toks | prev_toks
                if union and len(candidate_toks & prev_toks) / len(union) >= 0.55:
                    is_ai_dup = True
                    break
            if is_ai_dup:
                logger.info(f"[Dedup] Dropped AI question (inter-AI duplicate): {text[:80]}")
                continue
            seen_texts.append(candidate_toks)
            qid = str(candidate["question_id"]).strip() or f"dyn_agent_{i:03d}"
            if qid in seen_ids:
                qid = f"{qid}_{i}"
            candidate["question_id"] = qid
            seen_ids.add(qid)
            candidate["is_ai_generated"] = True
            normalized.append(SuggestedQuestion(**candidate).model_dump())

        logger.info(f"[Phase1] {len(ai_questions)} raw AI questions → {len(normalized)} after dedup for {ra_id}")
        store.set_suggested_questions(ra_id, normalized)
        _set_pipeline_status(ra_id, "phase1", "complete")
        return {"assessment_id": ra_id, "suggested_questions": normalized}

    except Exception as exc:
        logger.exception(f"Phase 1 task failed for {ra_id}: {exc}")
        _set_pipeline_status(ra_id, "phase1", "failed", str(exc))
        raise


@celery_app.task(name="ra_tasks.run_phase2")
def run_phase2(ra_id: str) -> dict:
    """Background task for Phase 2: identify risks from questionnaire answers."""
    _set_pipeline_status(ra_id, "phase2", "running")
    try:
        from utils.ra_store import get_store
        from utils.ra_context_builder import _build_ra_context_pack, _resolve_subject_profile
        from utils.agentic_pipeline import run_phase2_pipeline
        from datetime import datetime

        store = get_store()
        ra = store.get(ra_id)
        if not ra:
            _set_pipeline_status(ra_id, "phase2", "failed", "Assessment not found")
            return {"error": "Assessment not found"}

        chunks = store.get_context_chunks(ra_id)
        context_pack = _build_ra_context_pack(ra, chunks)

        assets: list[dict] = []
        if ra.asset_ids:
            from api.routers.assets import get_store as get_asset_store
            asset_store = get_asset_store()
            ad_hoc_map = {a["id"]: a for a in (ra.ad_hoc_applications or [])}
            assets = [_resolve_subject_profile(asset_store, aid, ad_hoc_map) for aid in ra.asset_ids]
        elif ra.ad_hoc_applications:
            from api.routers.assets import get_store as get_asset_store
            asset_store = get_asset_store()
            ad_hoc_map = {a["id"]: a for a in ra.ad_hoc_applications}
            assets = [_resolve_subject_profile(asset_store, a["id"], ad_hoc_map) for a in ra.ad_hoc_applications]

        # Build lookup so static responses get their full question text + type.
        # Responses in MongoDB only store question_id — not text or question_type.
        from utils.assessment_questions import get_sections as _get_sections
        _static_q_map: dict[str, dict] = {}
        for _sec in _get_sections():
            for _q in _sec.get("questions", []):
                _static_q_map[_q["id"]] = {
                    "text": _q.get("text", ""),
                    "question_type": _q.get("question_type", "Control"),
                }

        questionnaire_answers: list[dict] = []
        for response in (ra.responses or []):
            qid = response.get("question_id", "")
            _q_meta = _static_q_map.get(qid, {})
            questionnaire_answers.append({
                "question_id": qid,
                "section_id": response.get("section_id", ""),
                "text": _q_meta.get("text") or response.get("text", qid),
                "question_type": _q_meta.get("question_type", "Control"),
                "answer": response.get("answer", ""),
                "details": response.get("details", ""),
                "is_ai_generated": False,
                "rationale": "",
            })

        # Include answered AI-generated questions — context-specific, document-grounded,
        # highest-signal answers for risk identification.
        for sq in (ra.suggested_questions or []):
            if sq.get("status") == "answered" and sq.get("answer") in ("yes", "no", "na"):
                questionnaire_answers.append({
                    "question_id": sq.get("question_id", ""),
                    "section_id": sq.get("section_id", "dynamic_context"),
                    "text": sq.get("text", sq.get("question_id", "")),
                    "question_type": sq.get("question_type", "Context"),
                    "answer": sq.get("answer", ""),
                    "details": sq.get("details", ""),
                    "is_ai_generated": True,
                    "rationale": sq.get("rationale", ""),
                })

        from utils.controls_library import MongoControlsStore
        controls_store = MongoControlsStore()
        raw_controls = controls_store.all_controls() if hasattr(controls_store, "all_controls") else []
        controls_dicts = [c if isinstance(c, dict) else (c.model_dump() if hasattr(c, "model_dump") else dict(c)) for c in raw_controls[:100]]

        result = run_phase2_pipeline(ra_id, context_pack, assets, questionnaire_answers, controls_dicts, store)
        validated_risks = result.get("validated_risks", [])

        # Normalise agent output to the Risk shape the frontend Risk interface requires.
        # Agents produce title/description/score/band but omit id, asset_id, likelihood_score,
        # impact_score, residual_*, source, status — all required by IdentifyRiskPage.
        import math
        import uuid as _uuid
        primary_asset_id = ra.asset_ids[0] if ra.asset_ids else ""
        ui_risks: list[dict] = []
        for risk in validated_risks:
            raw_score = max(1, min(25, int(risk.get("inherent_risk_score") or 9)))
            # Decompose a 1-25 composite score into likelihood × impact (both 1-5)
            likelihood = max(1, min(5, round(math.sqrt(raw_score))))
            impact = max(1, min(5, round(raw_score / likelihood)))
            ui_risks.append({
                "id": str(_uuid.uuid4()),
                "asset_id": primary_asset_id,
                "title": risk.get("title") or "Unnamed Risk",
                "description": risk.get("description") or "",
                "risk_category": risk.get("risk_category") or "Technical",
                "likelihood_score": likelihood,
                "impact_score": impact,
                "inherent_risk_score": raw_score,
                "inherent_risk_band": risk.get("inherent_risk_band") or "Medium",
                "residual_risk_score": 0,
                "residual_risk_band": "Low",
                "source": "agentic_pipeline",
                "human_rationale": "",
                "status": "open",
                # Preserve agent-specific fields for audit / control suggestion
                "applicable_regulations": risk.get("applicable_regulations") or [],
                "source_questions": risk.get("source_questions") or [],
                "suggested_controls": risk.get("suggested_controls") or [],
                "recommended_control_domain": risk.get("recommended_control_domain") or "",
            })

        # Build a lookup of every valid control ID in the library so we can
        # validate QA's suggestions and replace any hallucinated IDs with
        # the best keyword-matched real control.
        import re as _re

        _valid_controls: dict[str, dict] = {}
        for _c in controls_dicts:
            _cid = (_c.get("control_id") or _c.get("id") or "").strip()
            if _cid:
                _valid_controls[_cid] = _c

        def _tokenize(text: str) -> set[str]:
            return set(_re.findall(r"[a-z]{3,}", text.lower()))

        def _keyword_fallback(risk: dict) -> dict | None:
            """Return the best-matching control from the library for a given risk."""
            rtokens = _tokenize(" ".join([
                risk.get("title", ""),
                risk.get("description", ""),
                risk.get("risk_category", ""),
            ]))
            best_score, best_ctrl = 0, None
            for ctrl in _valid_controls.values():
                ctokens = _tokenize(" ".join([
                    ctrl.get("control_title") or ctrl.get("title") or "",
                    ctrl.get("description") or "",
                    " ".join(ctrl.get("keywords") or []),
                ]))
                score = len(rtokens & ctokens)
                if score > best_score:
                    best_score, best_ctrl = score, ctrl
            if best_ctrl is None and _valid_controls:
                best_ctrl = next(iter(_valid_controls.values()))
            return best_ctrl

        # Validate QA's suggested control IDs and fix any that don't exist in the library.
        flat_suggestions: list[dict] = []
        for risk in ui_risks:
            validated_ctrls: list[dict] = []
            seen_ids: set[str] = set()
            for ctrl in (risk.get("suggested_controls") or []):
                cid = (ctrl.get("control_id") or "").strip()
                if cid in _valid_controls and cid not in seen_ids:
                    validated_ctrls.append(ctrl)
                    seen_ids.add(cid)
                else:
                    # QA hallucinated or duplicated this ID — replace with keyword match
                    fallback = _keyword_fallback(risk)
                    if fallback:
                        fb_id = (fallback.get("control_id") or fallback.get("id") or "").strip()
                        if fb_id and fb_id not in seen_ids:
                            validated_ctrls.append({
                                "control_id": fb_id,
                                "control_title": fallback.get("control_title") or fallback.get("title") or "",
                                "rationale": ctrl.get("rationale") or f"Keyword-matched control for: {risk.get('title', '')}",
                                "relevance_score": max(1, ctrl.get("relevance_score", 3) - 1),
                            })
                            seen_ids.add(fb_id)

            # If QA produced nothing valid at all, use keyword fallback
            if not validated_ctrls:
                fallback = _keyword_fallback(risk)
                if fallback:
                    fb_id = (fallback.get("control_id") or fallback.get("id") or "").strip()
                    if fb_id:
                        validated_ctrls.append({
                            "control_id": fb_id,
                            "control_title": fallback.get("control_title") or fallback.get("title") or "",
                            "rationale": f"Best keyword-matched control for: {risk.get('title', '')}",
                            "relevance_score": 2,
                        })

            risk["suggested_controls"] = validated_ctrls

            for ctrl in validated_ctrls:
                flat_suggestions.append({
                    "risk_id": risk["id"],
                    "control_id": ctrl.get("control_id", ""),
                    "control_title": ctrl.get("control_title", ""),
                    "rationale": ctrl.get("rationale", ""),
                    "relevance_score": ctrl.get("relevance_score", 4),
                })

        now = datetime.now(dt.timezone.utc).isoformat()
        # Keep raw agentic output for audit trail
        _get_col().update_one(
            {"_id": ra_id},
            {"$set": {"agentic_risks": validated_risks, "updated_at": now}},
        )
        # Write normalised risks to the `risks` field (what the UI reads) and
        # advance status to risks_identified (unlocks the Risk Review workflow step).
        store.set_risks(ra_id, ui_risks, status="risks_identified")

        # Pre-populate ra.suggested_controls from QA's context-aware suggestions
        # so the Apply Controls panel is ready without needing the Persona 6 endpoint.
        if flat_suggestions:
            store.set_suggested_controls(ra_id, flat_suggestions)

        _set_pipeline_status(ra_id, "phase2", "complete")
        return {"assessment_id": ra_id, "risk_count": len(ui_risks)}

    except Exception as exc:
        logger.exception(f"Phase 2 task failed for {ra_id}: {exc}")
        _set_pipeline_status(ra_id, "phase2", "failed", str(exc))
        raise
