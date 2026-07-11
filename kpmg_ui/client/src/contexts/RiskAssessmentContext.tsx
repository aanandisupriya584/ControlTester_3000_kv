import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ── Domain types ──────────────────────────────────────────────────────────

export type AnswerType = "yes" | "no" | "na";
export type StatusType = "draft" | "in_progress" | "risks_identified" | "controls_applied" | "complete";
export type RiskBand = "Low" | "Medium" | "High" | "Critical";
export type QuestionType = "Exposure" | "Control" | "Context";

export interface ContextProfile {
  project_context: string;
  business_impact: string;
  overall_project_summary: string;
  jira_context: string;
  free_text_context: string;
}

export interface SuggestedQuestion {
  question_id: string;
  section_id: string;
  section_title: string;
  text: string;
  question_type: QuestionType;
  priority: "low" | "medium" | "high";
  source: string;
  rationale: string;
  status: "suggested" | "answered";
  answer: AnswerType | null;
  details: string;
  is_ai_generated: boolean;
  source_agent: string;
}

export interface Question {
  id: string;
  text: string;
  question_type: QuestionType;
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export interface SectionResponse {
  id?: string;
  asset_id: string;
  section_id: string;
  question_id: string;
  answer: AnswerType;
  details: string;
  submitted_at?: string;
}

export interface Risk {
  id: string;
  asset_id: string;
  title: string;
  description: string;
  risk_category: string;
  likelihood_score: number;
  impact_score: number;
  inherent_risk_score: number;
  inherent_risk_band: RiskBand;
  residual_risk_score: number;
  residual_risk_band: RiskBand;
  source: string;
  human_rationale: string;
  status: string;
  // Agent-generated fields — populated when source === "agentic_pipeline"
  source_questions?: string[];
  applicable_regulations?: string[];
  recommended_control_domain?: string;
}

export interface AppliedControl {
  id: string;
  risk_id: string;
  control_id: string;
  source: string;
  human_rationale: string;
  effectiveness_score: number;
  applied_at: string;
}

export interface SuggestedControl {
  risk_id: string;
  control_id: string;
  control_title: string;
  rationale: string;
  relevance_score: number;
}

export interface ResidualResult {
  risk_id: string;
  risk_title: string;
  asset_id: string;
  inherent_risk_score: number;
  inherent_risk_band: RiskBand;
  controls_applied: number;
  avg_effectiveness: number;
  residual_risk_score: number;
  residual_risk_band: RiskBand;
}

export interface AdHocApplication {
  id?: string;
  name: string;
  description?: string;
  assessment_context?: string;
  business_context?: string;
  purpose?: string;
  use?: string;
  confidentiality?: number;
  integrity?: number;
  availability?: number;
  hosting_type?: string | null;
  support_type?: string | null;
  owner?: string;
  custodian?: string;
  jurisdiction?: string;
  classification?: string;
  internet_exposure?: boolean;
  data_sensitivity_summary?: string;
  primary_users?: string;
  key_integrations?: string;
}

export interface RiskAssessment {
  id: string;
  title: string;
  description: string;
  status: StatusType;
  asset_ids: string[];
  ad_hoc_applications: AdHocApplication[];
  responses: SectionResponse[];
  risks: Risk[];
  applied_controls: AppliedControl[];
  suggested_controls: SuggestedControl[];
  report_markdown: string | null;
  suggested_questions: SuggestedQuestion[];
  context_profile: ContextProfile;
  context_sources: Record<string, unknown>[];
  historical_matches: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export interface RiskAssessmentCreate {
  title: string;
  description: string;
  asset_ids?: string[];
  ad_hoc_applications?: AdHocApplication[];
}

// ── Context interface ─────────────────────────────────────────────────────

interface Ctx {
  assessments: RiskAssessment[];
  selectedAssessment: RiskAssessment | null;
  sections: Section[];
  residualResults: ResidualResult[];
  isLoading: boolean;
  isAnalyzing: boolean;
  isGeneratingReport: boolean;
  error: string | null;
  report: string | null;
  fetchAssessments: () => Promise<void>;
  selectAssessment: (a: RiskAssessment | null) => void;
  createAssessment: (data: RiskAssessmentCreate) => Promise<RiskAssessment>;
  deleteAssessment: (raId: string) => Promise<void>;
  fetchSections: () => Promise<void>;
  submitResponse: (
    raId: string,
    assetId: string,
    sectionId: string,
    questionId: string,
    answer: AnswerType,
    details: string,
  ) => Promise<void>;
  submitResponseBatch: (
    raId: string,
    responses: Array<{ asset_id: string; section_id: string; question_id: string; answer: AnswerType; details: string }>,
    options?: { saveAsDraft?: boolean },
  ) => Promise<void>;
  analyzeAssessment: (raId: string) => Promise<void>;
  addHumanRisk: (raId: string, risk: Omit<Risk, "id" | "inherent_risk_score" | "inherent_risk_band" | "residual_risk_score" | "residual_risk_band" | "source" | "status">) => Promise<void>;
  applyControl: (raId: string, riskId: string, controlId: string, source: string, rationale: string) => Promise<void>;
  fetchResidual: (raId: string) => Promise<void>;
  suggestControls: (raId: string) => Promise<void>;
  generateReport: (raId: string) => Promise<void>;
  isSuggestingQuestions: boolean;
  updateContextProfile: (raId: string, profile: ContextProfile) => Promise<void>;
  uploadContextFile: (raId: string, file: File, sourceType?: string) => Promise<{ assessment: RiskAssessment | null; classification: any | null; processing_strategy: any | null }>;
  deleteContextFile: (raId: string, sourceId: string) => Promise<RiskAssessment | null>;
  suggestContextQuestions: (raId: string) => Promise<void>;
  answerContextQuestion: (raId: string, questionId: string, answer: AnswerType, details: string) => Promise<void>;
  recomputeContextProfile: (raId: string) => Promise<RiskAssessment | null>;
}

const RiskAssessmentContext = createContext<Ctx | null>(null);

export function RiskAssessmentProvider({ children }: { children: ReactNode }) {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [residualResults, setResidualResults] = useState<ResidualResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSuggestingQuestions, setIsSuggestingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const fetchAssessments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/risk-assessment");
      if (!r.ok) throw new Error("Failed to fetch assessments");
      setAssessments(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectAssessment = useCallback((a: RiskAssessment | null) => {
    setSelectedAssessment(a);
    setResidualResults([]);
    setReport(null);
  }, []);

  const createAssessment = useCallback(async (data: RiskAssessmentCreate): Promise<RiskAssessment> => {
    const r = await fetch("/api/risk-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error("Failed to create assessment");
    const ra: RiskAssessment = await r.json();
    setAssessments(prev => [ra, ...prev]);
    return ra;
  }, []);

  const deleteAssessment = useCallback(async (raId: string): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}`, { method: "DELETE" });
    if (!r.ok) throw new Error("Failed to delete assessment");
    setAssessments(prev => prev.filter(a => a.id !== raId));
    setSelectedAssessment(prev => prev?.id === raId ? null : prev);
  }, []);

  const fetchSections = useCallback(async () => {
    try {
      const r = await fetch("/api/risk-assessment/sections");
      if (!r.ok) throw new Error("Failed to fetch sections");
      const data = await r.json();
      setSections(data.sections ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const submitResponse = useCallback(async (
    raId: string,
    assetId: string,
    sectionId: string,
    questionId: string,
    answer: AnswerType,
    details: string,
  ): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: assetId, section_id: sectionId, question_id: questionId, answer, details }),
    });
    if (!r.ok) throw new Error("Failed to submit response");
    const updated = await fetch(`/api/risk-assessment/${raId}`);
    if (updated.ok) {
      const ra: RiskAssessment = await updated.json();
      setSelectedAssessment(ra);
      setAssessments(prev => prev.map(a => a.id === raId ? ra : a));
    }
  }, []);

  const submitResponseBatch = useCallback(async (
    raId: string,
    responses: Array<{ asset_id: string; section_id: string; question_id: string; answer: AnswerType; details: string }>,
    options?: { saveAsDraft?: boolean },
  ): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}/respond-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses, save_as_draft: options?.saveAsDraft ?? false }),
    });
    if (!r.ok) throw new Error("Failed to submit responses");
    const ra: RiskAssessment = await r.json();
    setSelectedAssessment(ra);
    setAssessments(prev => prev.map(a => a.id === raId ? ra : a));
  }, []);

  // Poll pipeline-status until the given phase reaches "complete" or "failed".
  // Resolves with the final status string; rejects on network error or timeout.
  // MUST be defined before analyzeAssessment and suggestContextQuestions which depend on it.
  const pollPipelineStatus = useCallback(async (
    raId: string,
    phase: "phase1" | "phase2",
    intervalMs = 3000,
    timeoutMs = 720_000,  // 12 min — matches Celery hard limit
  ): Promise<string> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, intervalMs));
      const r = await fetch(`/api/risk-assessment/${raId}/pipeline-status`);
      if (!r.ok) continue;
      const data = await r.json();
      const status: string = data[`pipeline_${phase}_status`] ?? "idle";
      if (status === "complete" || status === "failed") {
        // Sync the full assessment into state so callers get fresh data
        const ra2 = await fetch(`/api/risk-assessment/${raId}`);
        if (ra2.ok) {
          const ra: RiskAssessment = await ra2.json();
          setSelectedAssessment(ra);
          setAssessments(prev => prev.map(a => a.id === raId ? ra : a));
        }
        if (status === "failed") throw new Error(data[`pipeline_${phase}_error`] || "Pipeline failed");
        return status;
      }
    }
    throw new Error("Pipeline timed out waiting for completion");
  }, []);

  const analyzeAssessment = useCallback(async (raId: string): Promise<void> => {
    setIsAnalyzing(true);
    try {
      // POST returns 202 — Celery ra_worker runs the agentic pipeline in background
      const r = await fetch(`/api/risk-assessment/${raId}/identify-risks-agentic`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to queue risk analysis");
      // Poll until phase2 complete — worker writes agentic_risks back to MongoDB
      await pollPipelineStatus(raId, "phase2");
      // After polling resolves, selectedAssessment is already refreshed by pollPipelineStatus
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [pollPipelineStatus]);

  const addHumanRisk = useCallback(async (raId: string, risk: any): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}/risks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(risk),
    });
    if (!r.ok) throw new Error("Failed to add risk");
    const data = await r.json();
    setSelectedAssessment(prev => prev?.id === raId ? { ...prev, risks: [...prev.risks, data.risk] } : prev);
  }, []);

  const applyControl = useCallback(async (
    raId: string,
    riskId: string,
    controlId: string,
    source: string,
    rationale: string,
  ): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}/controls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ risk_id: riskId, control_id: controlId, source, human_rationale: rationale }),
    });
    if (!r.ok) throw new Error("Failed to apply control");
  }, []);

  const fetchResidual = useCallback(async (raId: string): Promise<void> => {
    try {
      const r = await fetch(`/api/risk-assessment/${raId}/residual`);
      if (!r.ok) throw new Error("Failed to fetch residual");
      const data = await r.json();
      setResidualResults(data.residual_risks ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const suggestControls = useCallback(async (raId: string): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}/suggest-controls`, { method: "POST" });
    if (!r.ok) throw new Error("Failed to suggest controls");
    const data = await r.json();
    setSelectedAssessment(prev =>
      prev?.id === raId ? { ...prev, suggested_controls: data.suggestions ?? [] } : prev
    );
    setAssessments(prev =>
      prev.map(a => a.id === raId ? { ...a, suggested_controls: data.suggestions ?? [] } : a)
    );
  }, []);

  const generateReport = useCallback(async (raId: string): Promise<void> => {
    setIsGeneratingReport(true);
    try {
      const r = await fetch(`/api/risk-assessment/${raId}/generate-report`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to generate report");
      const data = await r.json();
      setReport(data.report_markdown ?? null);
      setSelectedAssessment(prev =>
        prev?.id === raId ? { ...prev, report_markdown: data.report_markdown, status: "complete" } : prev
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsGeneratingReport(false);
    }
  }, []);

  const updateContextProfile = useCallback(async (raId: string, profile: ContextProfile): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}/context`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context_profile: profile }),
    });
    if (!r.ok) throw new Error("Failed to update context profile");
    const ra: RiskAssessment = await r.json();
    setSelectedAssessment(ra);
    setAssessments(prev => prev.map(a => a.id === raId ? ra : a));
  }, []);

  const uploadContextFile = useCallback(async (raId: string, file: File, sourceType = "document"): Promise<{ assessment: RiskAssessment | null; classification: any | null; content_relevant: boolean; processing_strategy: any | null }> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source_type", sourceType);
    const r = await fetch(`/api/risk-assessment/${raId}/context-files`, {
      method: "POST",
      body: formData,
    });
    if (!r.ok) throw new Error("Failed to upload context file");
    const body = await r.json();
    const ra: RiskAssessment | null = body.assessment ?? null;
    // Only update assessment state when the document was accepted — rejected files
    // are not stored so the assessment is unchanged and must not trigger a re-render
    // that would repopulate fields or add the file to the uploaded list.
    if (body.accepted && ra) {
      setSelectedAssessment(ra);
      setAssessments(prev => prev.map(a => a.id === raId ? ra : a));
    }
    return {
      assessment: ra,
      classification: body.classification ?? null,
      content_relevant: body.content_relevant ?? true,
      processing_strategy: body.processing_strategy ?? null,
    };
  }, []);

  const deleteContextFile = useCallback(async (raId: string, sourceId: string): Promise<RiskAssessment | null> => {
    const r = await fetch(`/api/risk-assessment/${raId}/context-files/${sourceId}`, { method: "DELETE" });
    if (!r.ok) throw new Error("Failed to delete context file");
    const body = await r.json();
    const ra: RiskAssessment | null = body.assessment ?? null;
    if (ra) {
      setSelectedAssessment(ra);
      setAssessments(prev => prev.map(a => a.id === raId ? ra : a));
    }
    return ra;
  }, []);

  const recomputeContextProfile = useCallback(async (raId: string): Promise<RiskAssessment | null> => {
    const r = await fetch(`/api/risk-assessment/${raId}/recompute-context-profile`, { method: "POST" });
    if (!r.ok) throw new Error("Failed to recompute context profile");
    const body = await r.json();
    const ra: RiskAssessment | null = body.assessment ?? null;
    if (ra) {
      setSelectedAssessment(ra);
      setAssessments(prev => prev.map(a => a.id === raId ? ra : a));
    }
    return ra;
  }, []);

  const suggestContextQuestions = useCallback(async (raId: string): Promise<void> => {
    setIsSuggestingQuestions(true);
    try {
      // POST returns 202 immediately — the Celery ra_worker runs the pipeline
      const r = await fetch(`/api/risk-assessment/${raId}/suggest-questions`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to queue question generation");
      // Poll until the background worker marks phase1 complete
      await pollPipelineStatus(raId, "phase1");
    } finally {
      setIsSuggestingQuestions(false);
    }
  }, [pollPipelineStatus]);

  const answerContextQuestion = useCallback(async (raId: string, questionId: string, answer: AnswerType, details: string): Promise<void> => {
    const r = await fetch(`/api/risk-assessment/${raId}/suggest-questions/${questionId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, details }),
    });
    if (!r.ok) throw new Error("Failed to answer question");
    const data = await r.json();
    setSelectedAssessment(prev => prev?.id === raId ? { ...prev, suggested_questions: data.suggested_questions } : prev);
    setAssessments(prev => prev.map(a => a.id === raId ? { ...a, suggested_questions: data.suggested_questions } : a));
  }, []);

  return (
    <RiskAssessmentContext.Provider value={{
      assessments, selectedAssessment, sections, residualResults,
      isLoading, isAnalyzing, isGeneratingReport, isSuggestingQuestions, error, report,
      fetchAssessments, selectAssessment, createAssessment, deleteAssessment,
      fetchSections, submitResponse, submitResponseBatch, analyzeAssessment,
      addHumanRisk, applyControl, fetchResidual,
      suggestControls, generateReport,
      updateContextProfile, uploadContextFile, deleteContextFile, suggestContextQuestions, answerContextQuestion, recomputeContextProfile,
    }}>
      {children}
    </RiskAssessmentContext.Provider>
  );
}

export function useRiskAssessment() {
  const ctx = useContext(RiskAssessmentContext);
  if (!ctx) throw new Error("useRiskAssessment must be used inside RiskAssessmentProvider");
  return ctx;
}
