"""MongoDB store for risk assessments.

Kept in utils/ so both the FastAPI router and the Celery worker can import
get_store() without any cross-package dependency on api/.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import uuid
from datetime import datetime
from typing import Any

import pymongo

from utils.ra_models import RiskAssessment, RiskAssessmentCreate, SuggestedQuestion
from utils.ra_context_builder import _clean_report_text, _tokenize_match_text


# ── Store ─────────────────────────────────────────────────────────────────────

def _context_profile_from_create(data: RiskAssessmentCreate) -> dict[str, str]:
    profile = data.context_profile.model_dump()
    for key in ("project_context", "business_impact", "overall_project_summary",
                "regulatory_context", "security_requirements", "jira_context", "free_text_context"):
        value = str(getattr(data, key, "") or "").strip()
        if value:
            profile[key] = value
    return profile


class MongoRiskAssessmentStore:
    def __init__(self, mongo_uri: str | None = None):
        uri = mongo_uri or os.environ.get("MONGO_URI", "mongodb://localhost:27017")
        client = pymongo.MongoClient(uri)
        db = client["trace_db"]
        self._col = db["risk_assessments"]
        self._col.create_index("status")
        self._col.create_index("created_at")
        self._context_chunks = db["risk_assessment_context_chunks"]
        self._context_chunks.create_index("ra_id")
        self._context_chunks.create_index("source_id")
        self._col.create_index("context_profile.regulatory_context")
        self._col.create_index("context_profile.security_requirements")

    def _to_ra(self, doc: dict) -> RiskAssessment:
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id"))
        doc.setdefault("responses", [])
        doc.setdefault("risks", [])
        doc.setdefault("applied_controls", [])
        doc.setdefault("suggested_controls", [])
        doc.setdefault("report_markdown", None)
        doc.setdefault("ad_hoc_applications", [])
        doc.setdefault("asset_ids", [])
        doc.setdefault("suggested_questions", [])
        doc.setdefault("context_profile", {})
        doc.setdefault("context_sources", [])
        doc.setdefault("historical_matches", [])
        return RiskAssessment(**doc)

    def create(self, data: RiskAssessmentCreate) -> RiskAssessment:
        now = datetime.utcnow().isoformat()
        ad_hoc = []
        for app in data.ad_hoc_applications:
            d = app.model_dump()
            if not d.get("id"):
                d["id"] = str(uuid.uuid4())
            ad_hoc.append(d)
        all_asset_ids = list(data.asset_ids) + [a["id"] for a in ad_hoc]
        doc: dict[str, Any] = {
            "_id": str(uuid.uuid4()),
            "title": data.title,
            "description": data.description,
            "status": "draft",
            "asset_ids": all_asset_ids,
            "ad_hoc_applications": ad_hoc,
            "responses": [],
            "risks": [],
            "applied_controls": [],
            "suggested_controls": [],
            "report_markdown": None,
            "suggested_questions": [],
            "context_profile": _context_profile_from_create(data),
            "context_sources": [],
            "historical_matches": [],
            "created_at": now,
            "updated_at": now,
        }
        self._col.insert_one(doc)
        return self._to_ra(dict(doc))

    def list(self, status_f: str | None = None) -> list[RiskAssessment]:
        q: dict = {}
        if status_f:
            q["status"] = status_f
        return [self._to_ra(d) for d in self._col.find(q).sort("created_at", -1)]

    def get(self, ra_id: str) -> RiskAssessment | None:
        doc = self._col.find_one({"_id": ra_id})
        return self._to_ra(doc) if doc else None

    def delete(self, ra_id: str) -> bool:
        result = self._col.delete_one({"_id": ra_id})
        return result.deleted_count == 1

    def add_response(self, ra_id: str, response: dict) -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$push": {"responses": response},
             "$set": {"status": "in_progress", "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def set_risks(self, ra_id: str, risks: list[dict], status: str = "risks_identified") -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$set": {"risks": risks, "status": status, "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def add_risk(self, ra_id: str, risk: dict) -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$push": {"risks": risk}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def add_control(self, ra_id: str, control: dict) -> bool:
        result = self._col.update_one(
            {
                "_id": ra_id,
                "applied_controls": {
                    "$not": {
                        "$elemMatch": {
                            "risk_id": control.get("risk_id"),
                            "control_id": control.get("control_id"),
                        }
                    }
                },
            },
            {"$push": {"applied_controls": control},
             "$set": {"status": "controls_applied", "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def set_suggested_controls(self, ra_id: str, suggestions: list[dict]) -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$set": {"suggested_controls": suggestions, "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def update_context_profile(self, ra_id: str, context_profile: dict) -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$set": {"context_profile": context_profile, "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def add_context_source(self, ra_id: str, source: dict, chunks: list[dict]) -> bool:
        now = datetime.utcnow().isoformat()
        source = {**source, "uploaded_at": now}
        if chunks:
            self._context_chunks.insert_many([
                {**chunk, "ra_id": ra_id, "source_id": source["id"], "created_at": now}
                for chunk in chunks
            ])
        result = self._col.update_one(
            {"_id": ra_id},
            {"$push": {"context_sources": source}, "$set": {"updated_at": now}},
        )
        return result.modified_count == 1

    def remove_context_source(self, ra_id: str, source_id: str) -> bool:
        now = datetime.now(dt.timezone.utc).isoformat()
        self._context_chunks.delete_many({"ra_id": ra_id, "source_id": source_id})
        result = self._col.update_one(
            {"_id": ra_id},
            {"$pull": {"context_sources": {"id": source_id}}, "$set": {"updated_at": now}},
        )
        return result.modified_count == 1

    def get_context_chunks(self, ra_id: str, limit: int = 30) -> list[dict]:
        return list(self._context_chunks.find({"ra_id": ra_id}, {"_id": 0}).limit(limit))

    def set_suggested_questions(self, ra_id: str, questions: list[dict]) -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$set": {"suggested_questions": questions, "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def set_historical_matches(self, ra_id: str, matches: list[dict]) -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$set": {"historical_matches": matches, "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def answer_suggested_question(self, ra_id: str, question_id: str, answer: str, details: str = "") -> bool:
        ra = self.get(ra_id)
        if not ra:
            return False
        questions: list[dict] = []
        changed = False
        for question in ra.suggested_questions:
            item = dict(question)
            if item.get("question_id") == question_id:
                item["answer"] = answer
                item["details"] = details
                item["status"] = "answered"
                changed = True
            questions.append(item)
        if not changed:
            return False
        return self.set_suggested_questions(ra_id, questions)

    def find_similar_assessments(self, ra: RiskAssessment, limit: int = 5) -> list[dict]:
        query_text = " ".join([
            ra.title,
            ra.description,
            json.dumps(ra.context_profile, sort_keys=True),
            json.dumps(ra.ad_hoc_applications, sort_keys=True),
        ])
        query_tokens = _tokenize_match_text(query_text)
        if not query_tokens:
            return []
        matches: list[dict] = []
        cursor = self._col.find({"_id": {"$ne": ra.id}}).sort("created_at", -1).limit(100)
        for doc in cursor:
            candidate_text = " ".join([
                str(doc.get("title", "")),
                str(doc.get("description", "")),
                json.dumps(doc.get("context_profile", {}), sort_keys=True),
                json.dumps(doc.get("ad_hoc_applications", []), sort_keys=True),
                json.dumps(doc.get("risks", []), sort_keys=True),
                json.dumps(doc.get("suggested_questions", []), sort_keys=True),
            ])
            candidate_tokens = _tokenize_match_text(candidate_text)
            if not candidate_tokens:
                continue
            overlap = query_tokens.intersection(candidate_tokens)
            score = len(overlap) / max(len(query_tokens), 1)
            if score <= 0:
                continue
            matches.append({
                "ra_id": str(doc.get("_id")),
                "title": doc.get("title", ""),
                "similarity_score": round(score, 3),
                "matched_terms": sorted(overlap)[:20],
                "prior_risks": doc.get("risks", [])[:5],
                "prior_questions": doc.get("suggested_questions", [])[:10],
            })
        return sorted(matches, key=lambda item: item["similarity_score"], reverse=True)[:limit]

    def add_responses_batch(self, ra_id: str, asset_id: str, new_responses: list[dict], status: str = "in_progress") -> bool:
        ra = self.get(ra_id)
        if not ra:
            return False
        existing_other = [r for r in ra.responses if r.get("asset_id") != asset_id]
        all_responses = existing_other + new_responses
        result = self._col.update_one(
            {"_id": ra_id},
            {"$set": {"responses": all_responses, "status": status,
                      "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1

    def set_report(self, ra_id: str, markdown: str) -> bool:
        result = self._col.update_one(
            {"_id": ra_id},
            {"$set": {"report_markdown": markdown, "status": "complete", "updated_at": datetime.utcnow().isoformat()}},
        )
        return result.modified_count == 1


_store: MongoRiskAssessmentStore | None = None


def get_store() -> MongoRiskAssessmentStore:
    global _store
    if _store is None:
        _store = MongoRiskAssessmentStore()
    return _store
