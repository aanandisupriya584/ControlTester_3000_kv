"""Shared Pydantic models for the risk assessment domain.

Kept in utils/ so both the FastAPI router (api/routers/risk_assessment.py)
and the Celery worker (utils/ra_tasks.py) can import them without any
cross-package dependency.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator

StatusType = Literal["draft", "in_progress", "risks_identified", "controls_applied", "complete"]
RiskBand   = Literal["Low", "Medium", "High", "Critical"]
AnswerType = Literal["yes", "no", "na"]


class AdHocApplication(BaseModel):
    id: str = ""
    name: str
    description: str = ""
    assessment_context: str = ""
    business_context: str = ""
    purpose: str = ""
    use: str = ""
    confidentiality: int = Field(default=3, ge=1, le=5)
    integrity: int = Field(default=3, ge=1, le=5)
    availability: int = Field(default=3, ge=1, le=5)
    hosting_type: Optional[str] = None
    support_type: Optional[str] = None
    owner: str = ""
    custodian: str = ""
    jurisdiction: str = ""
    classification: str = ""
    internet_exposure: bool = False
    data_sensitivity_summary: str = ""
    primary_users: str = ""
    key_integrations: str = ""


class RiskAssessmentContextProfile(BaseModel):
    project_context: str = ""
    business_impact: str = ""
    overall_project_summary: str = ""
    regulatory_context: str = ""
    security_requirements: str = ""
    jira_context: str = ""
    free_text_context: str = ""


class RiskAssessmentContextUpdate(BaseModel):
    context_profile: RiskAssessmentContextProfile


class SuggestedQuestion(BaseModel):
    question_id: str
    section_id: str = "dynamic_context"
    section_title: str = "Context Driven Questions"
    text: str
    question_type: Literal["Exposure", "Control", "Context"] = "Context"
    priority: Literal["low", "medium", "high"] = "medium"
    source: str = "context"
    rationale: str = ""
    status: Literal["suggested", "answered"] = "suggested"
    answer: Optional[Literal["yes", "no", "na"]] = None
    details: str = ""
    is_ai_generated: bool = False
    source_agent: str = ""


class SuggestedQuestionAnswer(BaseModel):
    answer: Literal["yes", "no", "na"]
    details: str = ""


class RiskAssessmentCreate(BaseModel):
    title: str
    description: str
    asset_ids: list[str] = []
    ad_hoc_applications: list[AdHocApplication] = []
    context_profile: RiskAssessmentContextProfile = Field(default_factory=RiskAssessmentContextProfile)
    project_context: str = ""
    business_impact: str = ""
    overall_project_summary: str = ""
    regulatory_context: str = ""
    security_requirements: str = ""
    jira_context: str = ""
    free_text_context: str = ""

    @model_validator(mode="after")
    def _at_least_one_subject(self) -> "RiskAssessmentCreate":
        if not self.asset_ids and not self.ad_hoc_applications:
            raise ValueError("At least one asset_id or ad_hoc_application is required")
        return self


class ResponseSubmit(BaseModel):
    asset_id: str
    section_id: str
    question_id: str
    answer: AnswerType
    details: str = ""


class RiskOverride(BaseModel):
    asset_id: str
    title: str
    description: str
    risk_category: str
    likelihood_score: int
    impact_score: int
    human_rationale: str


class ControlApplication(BaseModel):
    risk_id: str
    control_id: str
    source: str
    human_rationale: str = ""


class ResponseBatch(BaseModel):
    responses: list[ResponseSubmit]
    save_as_draft: bool = False


class RiskAssessment(BaseModel):
    id: str
    title: str
    description: str
    status: StatusType
    asset_ids: list[str]
    ad_hoc_applications: list[dict] = []
    responses: list[dict]
    risks: list[dict]
    applied_controls: list[dict]
    suggested_controls: list[dict] = []
    report_markdown: Optional[str] = None
    suggested_questions: list[dict] = []
    context_profile: dict = {}
    context_sources: list[dict] = []
    historical_matches: list[dict] = []
    agent_notes_phase1: dict = {}
    agent_notes_phase2: dict = {}
    created_at: str
    updated_at: str
