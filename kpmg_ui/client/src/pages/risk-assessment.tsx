import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Loader2,
  Play,
  Plus,
  Save,
  ShieldAlert,
} from "lucide-react";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import {
  TracePanel,
} from "@/components/TraceAnalysisPrimitives";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CiaRatingWidget from "@/components/CiaRatingWidget";
import { useToast } from "@/hooks/use-toast";
import { useAssetRegistry } from "@/contexts/AssetRegistryContext";
import {
  BandBadge,
  CommandDeckMetric,
  WORKFLOW_PROGRESS_STEP_COUNT,
  WORKFLOW_STEP_BY_LABEL,
  WORKFLOW_STEP_BY_SLUG,
  FeatureCards,
  GuidanceCard,
  AnalysisStep,
  ControlsStep,
  FinalReportStep,
  QuestionnaireStep,
  NewButton,
  RecentAssessments,
  ResidualStep,
  ReportPreviewDialog,
  RiskReviewStep,
  WorkspaceHeader,
  STATUS_LABELS,
  SurfaceSection,
  WorkflowContextBar,
  WorkflowStepper,
  workflowLabelForAssessmentStatus,
  workflowLabelFromWizardStep,
  workflowSlugFromLocation,
  type WorkflowStepLabel,
} from "@/pages/risk-assessment/components";
import {
  type AdHocApplication,
  type AnswerType,
  type RiskAssessment,
  type Section,
  type SuggestedControl,
  useRiskAssessment,
} from "@/contexts/RiskAssessmentContext";

const PRIMARY_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#1E49E2] px-5 py-3 text-[14px] font-bold text-white transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-[#8EA4D9] sm:w-auto";
const SECONDARY_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#DCE3EE] bg-white px-5 py-3 text-[14px] font-bold text-[#0C233C] transition-colors hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:text-[#9AA8BC] sm:w-auto";
const SOFT_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#EEF2FF] px-4 py-2.5 text-[13px] font-bold text-[#1E49E2] transition-colors hover:bg-[#E3EBFF] disabled:cursor-not-allowed disabled:text-[#93A6D8] sm:w-auto";

interface LocalAnswer {
  answer: AnswerType;
  details: string;
}

// Maps an assessment status to the wizard step used by the page controller.
function statusToStep(status: RiskAssessment["status"]) {
  switch (status) {
    case "draft":
      return 0;
    case "in_progress":
      return 1;
    case "risks_identified":
      return 3;
    case "controls_applied":
      return 5;
    case "complete":
      return 6;
    default:
      return 0;
  }
}

// Formats API dates for the recent assessment rows.
function formatDate(value?: string | null) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Counts both registry assets and ad hoc systems in an assessment.
function assessmentAppCount(assessment: RiskAssessment) {
  return assessment.asset_ids.length + (assessment.ad_hoc_applications?.length ?? 0);
}

// Picks the short status title used in setup/progress panels.
function statusToneTitle(assessment: RiskAssessment | null) {
  if (!assessment) return "Ready To Begin";
  return STATUS_LABELS[assessment.status] ?? "Assessment Selected";
}

// Counts answered questions for one asset and one questionnaire section.
function sectionProgress(
  answers: Record<string, Record<string, Record<string, LocalAnswer>>>,
  assetId: string,
  section: Section,
  savedResponses: RiskAssessment["responses"] = [],
) {
  const answeredQuestionIds = new Set<string>();
  for (const response of savedResponses) {
    if (response.asset_id === assetId && response.section_id === section.id && response.answer) {
      answeredQuestionIds.add(response.question_id);
    }
  }
  for (const questionId of Object.keys(answers[assetId]?.[section.id] ?? {})) {
    answeredQuestionIds.add(questionId);
  }
  return answeredQuestionIds.size;
}

// Parent page: owns data, workflow state, and hands rendering to child components.
export default function RiskAssessmentPage() {
  const {
    assessments,
    selectedAssessment,
    sections,
    residualResults,
    isLoading,
    isAnalyzing,
    isGeneratingReport,
    error,
    report,
    fetchAssessments,
    selectAssessment,
    createAssessment,
    fetchSections,
    submitResponseBatch,
    analyzeAssessment,
    applyControl,
    fetchResidual,
    suggestControls,
    generateReport,
    deleteAssessment,
  } = useRiskAssessment();
  const { assets, fetchAssets } = useAssetRegistry();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const isCreatePage = location === "/risk-assessment/new";

  const [wizardStep, setWizardStep] = useState(0);
  const [showCreate, setShowCreate] = useState(isCreatePage);
  const [form, setForm] = useState<{ title: string; description: string; selectedAssetIds: string[] }>({
    title: "",
    description: "",
    selectedAssetIds: [],
  });
  const [adHocApps, setAdHocApps] = useState<AdHocApplication[]>([]);
  const [showAdHocForm, setShowAdHocForm] = useState(false);
  const [adHocDraft, setAdHocDraft] = useState<AdHocApplication>({
    name: "",
    description: "",
    assessment_context: "",
    confidentiality: 3,
    integrity: 3,
    availability: 3,
  });
  const [qaAssetIdx, setQaAssetIdx] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, Record<string, LocalAnswer>>>>({});
  const [submittingQa, setSubmittingQa] = useState(false);
  const [submittedQuestionnaireAssetIds, setSubmittedQuestionnaireAssetIds] = useState<Set<string>>(new Set());
  const [showReportDialog, setShowReportDialog] = useState(false);
  const workflowContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchAssessments();
    fetchAssets();
    fetchSections();
  }, [fetchAssessments, fetchAssets, fetchSections]);

  useEffect(() => {
    if (!isCreatePage) return;
    // Keep the standalone create page focused on entering new assessment details, not a selected prior session.
    setShowCreate(true);
    selectAssessment(null);
    setWizardStep(0);
  }, [isCreatePage]);

  useEffect(() => {
    setSubmittedQuestionnaireAssetIds(new Set());
  }, [selectedAssessment?.id]);

  useEffect(() => {
    if (wizardStep !== 2 || !selectedAssessment || isAnalyzing) return;
    if (selectedAssessment.risks.length > 0) {
      setWizardStep(3);
      return;
    }
    analyzeAssessment(selectedAssessment.id).then(() => setWizardStep(3)).catch(() => {});
  }, [analyzeAssessment, isAnalyzing, selectedAssessment, wizardStep]);

  useEffect(() => {
    if (wizardStep !== 4 || !selectedAssessment) return;
    if ((selectedAssessment.suggested_controls ?? []).length === 0) {
      suggestControls(selectedAssessment.id).catch(() => {});
    }
  }, [selectedAssessment, suggestControls, wizardStep]);

  useEffect(() => {
    if (wizardStep !== 5 || !selectedAssessment) return;
    fetchResidual(selectedAssessment.id).catch(() => {});
  }, [fetchResidual, selectedAssessment, wizardStep]);

  const selectedHighRisks = selectedAssessment
    ? selectedAssessment.risks.filter(
        (risk) => risk.inherent_risk_band === "Critical" || risk.inherent_risk_band === "High",
      ).length
    : 0;

  // Feed the three feature boxes from already-loaded assessments and assets so their counts stay current.
  const allRisks = assessments.flatMap((assessment) => assessment.risks ?? []);
  const activeAssessments = assessments.filter((assessment) => assessment.status !== "complete").length;
  const highCriticalRisks = allRisks.filter(
    (risk) => risk.inherent_risk_band === "Critical" || risk.inherent_risk_band === "High",
  ).length;
  const draftAssessments = assessments.filter((assessment) => assessment.status === "draft").length;
  const landingAssessment = assessments[0] ?? null;
  const currentAssetId = selectedAssessment?.asset_ids[qaAssetIdx] ?? "";
  const currentReport = report ?? selectedAssessment?.report_markdown ?? null;
  const currentTotalQuestions = sections.reduce((acc, section) => acc + section.questions.length, 0);
  const currentAnsweredCount = currentAssetId ? answeredCount(currentAssetId) : 0;
  const assetName = (id: string) =>
    assets.find((asset) => asset.id === id)?.name ??
    selectedAssessment?.ad_hoc_applications?.find((app) => app.id === id)?.name ??
    id;

  const hasAssetsInScope = Boolean(selectedAssessment && selectedAssessment.asset_ids.length > 0);
  const hasRisksIdentified = Boolean(
    selectedAssessment &&
      (selectedAssessment.risks.length > 0 ||
        selectedAssessment.status === "risks_identified" ||
        selectedAssessment.status === "controls_applied" ||
        selectedAssessment.status === "complete"),
  );
  const hasFindingsReady = hasRisksIdentified;
  const hasQuestionnaireSubmitted = Boolean(
    selectedAssessment &&
      selectedAssessment.asset_ids.length > 0 &&
      selectedAssessment.asset_ids.every((assetId) => isAssetQuestionnaireSubmitted(assetId)),
  );
  const hasReportPrerequisites = Boolean(
    selectedAssessment &&
      (selectedAssessment.status === "controls_applied" ||
        selectedAssessment.status === "complete" ||
        residualResults.length > 0 ||
        currentReport),
  );
  const activeWorkflowStep = workflowLabelFromWizardStep(wizardStep, location);
  const completedWorkflowSteps: Record<WorkflowStepLabel, boolean> = {
    Create: Boolean(selectedAssessment),
    Assets: hasAssetsInScope,
    Questionnaire: hasQuestionnaireSubmitted || hasRisksIdentified,
    "Risk Review": hasFindingsReady,
    Findings: hasReportPrerequisites,
    "Final Report": Boolean(currentReport || selectedAssessment?.status === "complete"),
  };
  const disabledWorkflowSteps: Record<WorkflowStepLabel, boolean> = {
    Create: false,
    Assets: false,
    Questionnaire: !hasAssetsInScope,
    "Risk Review": !hasRisksIdentified,
    Findings: !hasFindingsReady,
    "Final Report": !hasReportPrerequisites,
  };

  // Moves the user to a workflow stage and keeps the URL in sync.
  function navigateWorkflowStep(label: WorkflowStepLabel, pushHistory = true) {
    if (label === "Create") {
      openCreate();
      return;
    }
    const nextStep = WORKFLOW_STEP_BY_LABEL[label].targetStep;
    if (label === "Questionnaire") {
      setExpandedSection(sections[0]?.id ?? null);
    }
    if (label === "Final Report" && disabledWorkflowSteps[label]) {
      toast({
        title: "Report not ready",
        description: "Generate the final report before opening the audit output.",
      });
    }
    setWizardStep(nextStep);
    if (pushHistory) {
      setLocation(`/risk-assessment?step=${WORKFLOW_STEP_BY_LABEL[label].slug}`);
    }
  }

  // Handles clicks from the workflow stepper.
  function handleWorkflowStepSelect(label: WorkflowStepLabel) {
    navigateWorkflowStep(label);
  }

  useEffect(() => {
    if (!selectedAssessment || showCreate || isCreatePage) return;
    const slug = workflowSlugFromLocation(location);
    if (!slug) return;
    const step = WORKFLOW_STEP_BY_SLUG[slug];
    if (!step) return;
    if (step.targetStep !== wizardStep) {
      if (step.label === "Questionnaire") {
        setExpandedSection(sections[0]?.id ?? null);
      }
      setWizardStep(step.targetStep);
    }
  }, [
    location,
    selectedAssessment?.id,
    selectedAssessment?.status,
    selectedAssessment?.risks.length,
    residualResults.length,
    currentReport,
    showCreate,
    isCreatePage,
    sections,
    wizardStep,
  ]);

  useEffect(() => {
    if (!selectedAssessment || showCreate) return;
    window.requestAnimationFrame(() => {
      workflowContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [wizardStep, selectedAssessment?.id, showCreate]);

  // Clears the create dialog back to its default blank state.
  function resetCreateState() {
    setForm({ title: "", description: "", selectedAssetIds: [] });
    setAdHocApps([]);
    setAdHocDraft({
      name: "",
      description: "",
      assessment_context: "",
      confidentiality: 3,
      integrity: 3,
      availability: 3,
    });
    setShowAdHocForm(false);
  }

  // Stores a questionnaire answer locally before it is submitted.
  function setAnswer(assetId: string, sectionId: string, questionId: string, answer: AnswerType) {
    setAnswers((prev) => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? {}),
        [sectionId]: {
          ...(prev[assetId]?.[sectionId] ?? {}),
          [questionId]: {
            answer,
            details: prev[assetId]?.[sectionId]?.[questionId]?.details ?? "",
          },
        },
      },
    }));
  }

  // Counts answered questions for a selected asset.
  function answeredCount(assetId: string) {
    const answeredQuestionIds = new Set<string>();
    for (const response of selectedAssessment?.responses ?? []) {
      if (response.asset_id === assetId && response.answer) {
        answeredQuestionIds.add(`${response.section_id}:${response.question_id}`);
      }
    }
    for (const [sectionId, sectionAnswers] of Object.entries(answers[assetId] ?? {})) {
      for (const questionId of Object.keys(sectionAnswers)) {
        answeredQuestionIds.add(`${sectionId}:${questionId}`);
      }
    }
    return answeredQuestionIds.size;
  }

  // Checks local and saved responses for a single question.
  function hasQuestionAnswer(assetId: string, sectionId: string, questionId: string) {
    return Boolean(getQuestionAnswer(assetId, sectionId, questionId));
  }

  // Reads the current answer for rendering the selected Yes/No/NA state.
  function getQuestionAnswer(assetId: string, sectionId: string, questionId: string): LocalAnswer | null {
    const localAnswer = answers[assetId]?.[sectionId]?.[questionId];
    if (localAnswer?.answer) return localAnswer;
    const savedResponse = selectedAssessment?.responses.find(
      (response) =>
        response.asset_id === assetId &&
        response.section_id === sectionId &&
        response.question_id === questionId &&
        response.answer,
    );
    if (!savedResponse) return null;
    return {
      answer: savedResponse.answer,
      details: savedResponse.details ?? "",
    };
  }

  // Returns true only when every question for the asset has an answer.
  function isAssetQuestionnaireComplete(assetId: string) {
    return (
      currentTotalQuestions > 0 &&
      sections.every((section) =>
        section.questions.every((question) => hasQuestionAnswer(assetId, section.id, question.id)),
      )
    );
  }

  // Checks whether the completed questionnaire has already been saved.
  function isAssetQuestionnaireSubmitted(assetId: string) {
    const savedQuestionIds = new Set(
      (selectedAssessment?.responses ?? [])
        .filter((response) => response.asset_id === assetId && response.answer)
        .map((response) => `${response.section_id}:${response.question_id}`),
    );
    const savedComplete = currentTotalQuestions > 0 && savedQuestionIds.size >= currentTotalQuestions;
    return isAssetQuestionnaireComplete(assetId) && (submittedQuestionnaireAssetIds.has(assetId) || savedComplete);
  }

  // Finds the first questionnaire section that still needs an answer.
  function firstIncompleteQuestionnaireSection(assetId: string) {
    return sections.find((section) =>
      section.questions.some((question) => !hasQuestionAnswer(assetId, section.id, question.id)),
    );
  }

  // Creates the assessment after scope and setup details are ready.
  async function handleCreate() {
    if (!form.title.trim() || (form.selectedAssetIds.length === 0 && adHocApps.length === 0)) {
      toast({ title: "Title and at least one application required", variant: "destructive" });
      return;
    }

    try {
      const assessment = await createAssessment({
        title: form.title,
        description: form.description,
        asset_ids: form.selectedAssetIds,
        ad_hoc_applications: adHocApps,
      });
      selectAssessment(assessment);
      setShowCreate(false);
      setLocation("/risk-assessment?step=assets");
      setWizardStep(statusToStep(assessment.status));
      setQaAssetIdx(0);
      setExpandedSection(sections[0]?.id ?? null);
      resetCreateState();
      toast({ title: "Assessment created" });
    } catch {
      toast({ title: "Failed to create assessment", variant: "destructive" });
    }
  }

  // Adds a temporary application to this assessment without touching the registry.
  function handleAddAdHoc() {
    if (!adHocDraft.name?.trim()) return;
    setAdHocApps((prev) => [...prev, { ...adHocDraft }]);
    setAdHocDraft({
      name: "",
      description: "",
      assessment_context: "",
      confidentiality: 3,
      integrity: 3,
      availability: 3,
    });
    setShowAdHocForm(false);
  }

  // Saves questionnaire answers and blocks progress if anything is incomplete.
  async function handleSubmitQa() {
    if (!selectedAssessment || !currentAssetId) return;
    if (!isAssetQuestionnaireComplete(currentAssetId)) {
      const incompleteSection = firstIncompleteQuestionnaireSection(currentAssetId);
      setExpandedSection(incompleteSection?.id ?? sections[0]?.id ?? null);
      toast({
        title: "Please complete all the questions",
        description: "Answer every questionnaire item before continuing to the next step.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingQa(true);

    try {
      const responses = sections.flatMap((section) =>
        section.questions.map((question) => {
          const local = getQuestionAnswer(currentAssetId, section.id, question.id);
          return {
            asset_id: currentAssetId,
            section_id: section.id,
            question_id: question.id,
            answer: local!.answer,
            details: local?.details ?? "",
          };
        }),
      );

      await submitResponseBatch(selectedAssessment.id, responses);
      setSubmittedQuestionnaireAssetIds((prev) => {
        const next = new Set(prev);
        next.add(currentAssetId);
        return next;
      });

      if (qaAssetIdx < selectedAssessment.asset_ids.length - 1) {
        setQaAssetIdx((prev) => prev + 1);
        setExpandedSection(sections[0]?.id ?? null);
        toast({ title: "Responses saved for this application" });
      } else {
        setLocation("/risk-assessment?step=risk-review");
        setWizardStep(2);
        toast({ title: "All responses submitted. Starting analysis." });
      }
    } catch {
      toast({ title: "Failed to save responses", variant: "destructive" });
    } finally {
      setSubmittingQa(false);
    }
  }

  // Reloads the selected assessment after a server-side update.
  async function refreshAssessment(assessmentId: string) {
    try {
      const response = await fetch(`/api/risk-assessment/${assessmentId}`);
      if (!response.ok) return;
      const updated = await response.json();
      selectAssessment(updated);
    } catch {
      // Non-critical UI refresh path.
    }
  }

  // Generates the final report and opens the report preview dialog.
  async function handleGenerateReport() {
    if (!selectedAssessment) return;
    try {
      await generateReport(selectedAssessment.id);
      setShowReportDialog(true);
      toast({ title: "Report generated" });
    } catch {
      toast({ title: "Report failed", variant: "destructive" });
    }
  }

  // Applies one suggested control, then refreshes residual risk results.
  async function handleApplySuggestion(riskId: string, suggestion: SuggestedControl) {
    if (!selectedAssessment) return;
    try {
      await applyControl(selectedAssessment.id, riskId, suggestion.control_id, "suggested", suggestion.rationale);
      await refreshAssessment(selectedAssessment.id);
      toast({ title: "Control applied" });
    } catch {
      toast({ title: "Failed to apply control", variant: "destructive" });
    }
  }

  // Opens the standalone create assessment dialog route.
  function openCreate() {
    // Route the create icon to the dedicated create URL while showing the existing setup dialog.
    setLocation("/risk-assessment/new");
    setShowCreate(true);
    selectAssessment(null);
    setWizardStep(0);
  }

  // Closes create mode and returns to either the selected assessment or landing page.
  function closeCreate() {
    // Return to the Risk Assessment landing workspace when the popup closes.
    setLocation("/risk-assessment");
    setShowCreate(false);
    resetCreateState();
  }

  // Opens an existing assessment and positions the workflow at the right stage.
  function selectExistingAssessment(assessment: RiskAssessment) {
    setShowCreate(false);
    selectAssessment(assessment);
    const nextStep = statusToStep(assessment.status);
    const nextLabel = workflowLabelForAssessmentStatus(assessment.status);
    setLocation(`/risk-assessment?step=${WORKFLOW_STEP_BY_LABEL[nextLabel].slug}`);
    setWizardStep(nextStep);
    setQaAssetIdx(0);
    setExpandedSection(sections[0]?.id ?? null);
  }

  // Deletes an assessment after browser confirmation.
  async function handleDeleteAssessment(assessment: RiskAssessment) {
    const confirmed = window.confirm(`Delete "${assessment.title}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteAssessment(assessment.id);
      if (selectedAssessment?.id === assessment.id) {
        selectAssessment(null);
        setWizardStep(0);
      }
      toast({ title: "Assessment deleted" });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message ?? "Unable to delete this assessment.",
        variant: "destructive",
      });
    }
  }

  return (
    <div
      className={`relative h-full overflow-auto bg-[#F0F2F7] ${isCreatePage ? "risk-create-animated-bg" : ""}`}
      data-risk-assessment-page="true"
    >
      {isCreatePage ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="risk-create-grid absolute inset-0" />
          <div className="risk-create-blueprint absolute inset-0" />
          <div className="risk-create-sheen absolute inset-0" />
          <span className="risk-create-glow risk-create-glow-one" />
          <span className="risk-create-glow risk-create-glow-two" />
          <span className="risk-create-line risk-create-line-one" />
          <span className="risk-create-line risk-create-line-two" />
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={`track-${index}`} className={`risk-create-track risk-create-track-${index + 1}`} />
          ))}
          {Array.from({ length: 14 }).map((_, index) => (
            <span key={`node-${index}`} className={`risk-create-node risk-create-node-${index + 1}`} />
          ))}
        </div>
      ) : null}

      <div className="relative z-10">
        <HeroSection
          title="Risk Assessment"
          subtitle="Application risk assessments, structured questionnaires, inherent scoring, residual analysis, and reporting."
          icon={ShieldAlert}
        />
      </div>

      <main className="relative z-10 mx-auto max-w-[1460px] px-3 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-8 lg:px-10 lg:pb-5 lg:pt-10">
        {!isCreatePage && !selectedAssessment ? (
          <>
            <FeatureCards
              activeAssessments={activeAssessments}
              highCriticalRisks={highCriticalRisks}
              drafts={draftAssessments}
              totalAssessments={assessments.length}
              totalRisks={allRisks.length}
              assetCount={assets.length}
            />

            <HowItWorks
              defaultOpen
              steps={[
                {
                  number: 1,
                  title: "Create Assessment",
                  desc: "Start a new assessment and choose the applications or ad hoc systems in scope.",
                  color: "#1E49E2",
                },
                {
                  number: 2,
                  title: "Answer Questionnaire",
                  desc: "Capture control and risk responses with evidence notes for each selected asset.",
                  color: "#098E7E",
                },
                {
                  number: 3,
                  title: "Review Output",
                  desc: "Validate risks, findings, residual scoring, and the final report.",
                  color: "#EAAA00",
                },
              ]}
            />
          </>
        ) : null}

        <div className="min-w-0 space-y-6">
            {!selectedAssessment ? (
              <section className="overflow-hidden rounded-[10px] border border-[#D8E0ED] bg-white shadow-[0_20px_48px_-38px_rgba(12,35,60,0.28)]">
                <div className="flex flex-col items-stretch justify-between gap-4 border-b border-[#123863] bg-[#0C233C] px-4 py-5 sm:flex-row sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/48">Assessment</p>
                    <h2 className="text-[24px] font-bold tracking-[-0.03em] text-white">Risk Assessment Workspace</h2>
                    <p className="mt-2 text-[13px] leading-6 text-white/68">Open an existing assessment or create a new assessment to begin the guided workflow.</p>
                  </div>
                  <NewButton className={PRIMARY_BUTTON} onClick={openCreate} />
                </div>

                <WorkflowContextBar
                  assessment={landingAssessment}
                  assetLabel={landingAssessment ? assetName(landingAssessment.asset_ids[0] ?? "") : "Select an assessment"}
                  progress={landingAssessment ? Math.min(100, Math.max(17, Math.round(((statusToStep(landingAssessment.status) + 1) / WORKFLOW_PROGRESS_STEP_COUNT) * 100))) : 0}
                  currentStage={workflowLabelForAssessmentStatus(landingAssessment?.status)}
                />

                <div className="grid gap-5 bg-[#F7F9FC] p-3 sm:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="flex h-full min-w-0 flex-col">
                    <RecentAssessments
                      assessments={assessments}
                      error={error}
                      isLoading={isLoading}
                      primaryButtonClassName={PRIMARY_BUTTON}
                      onOpenNew={openCreate}
                      onSelectAssessment={selectExistingAssessment}
                      onDeleteAssessment={(assessment) => void handleDeleteAssessment(assessment)}
                      getAssessmentAppCount={assessmentAppCount}
                      formatAssessmentDate={formatDate}
                    />
                  </div>

                  <GuidanceCard answeredQuestions={0} totalQuestions={sections.reduce((acc, section) => acc + section.questions.length, 0) || 12} />
                </div>
              </section>
            ) : null}

            {showCreate ? (
              <Dialog open={showCreate} onOpenChange={(open) => (open ? setShowCreate(true) : closeCreate())}>
                <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[1280px] flex-col overflow-hidden rounded-[18px] border border-[#BFD0E5] bg-white p-0 shadow-[0_34px_100px_-42px_rgba(2,10,24,0.72)] sm:w-[calc(100vw-80px)] sm:rounded-[24px]">
                  <DialogHeader className="flex-shrink-0 border-b border-[#123863] bg-[#0C233C] px-5 py-6 text-left text-white sm:px-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-white">New Assessment</p>
                        <DialogTitle className="mt-4 text-[26px] font-bold tracking-[-0.04em] text-white">
                          Create New Assessment
                        </DialogTitle>
                        <DialogDescription className="mt-4 max-w-[760px] text-[14px] leading-7 text-white">
                          Define scope, select applications, and prepare the questionnaire workflow.
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="min-h-0 flex-1 overflow-y-auto bg-[#F4F7FB] px-4 py-5 sm:px-6" data-risk-assessment-create="true">
                    <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="flex min-h-full flex-col gap-5">
                    <div className="risk-assessment-setup-glass overflow-hidden rounded-[8px] border p-6">
                      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.32em] text-[#1E49E2]">Assessment Details</p>
                      <h3 className="text-[22px] font-bold tracking-[-0.04em] text-[#001B3A]">Define Scope Before We Ask Anything</h3>
                      <p className="mt-4 max-w-[640px] text-[13px] leading-7 text-[#33415C]">
                        Name the session, choose the core applications in scope, and add any ad hoc systems that need to be assessed without touching the wider registry.
                      </p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <CommandDeckMetric
                          label="Registry Assets"
                          value={form.selectedAssetIds.length}
                          detail="Selected from the live registry"
                        />
                        <CommandDeckMetric
                          label="Ad Hoc Systems"
                          value={adHocApps.length}
                          detail="Scoped only to this assessment"
                        />
                        <CommandDeckMetric
                          label="Questionnaire Path"
                        value={Math.max(form.selectedAssetIds.length, 0)}
                          detail="Registry-backed applications will enter the guided questionnaire"
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                        Assessment Title
                      </label>
                      <Input
                        value={form.title}
                        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="FY2026 Cloud Payments Review"
                        className="h-14 rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                      />
                    </div>
                    <div className="group">
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                        Description
                      </label>
                      <Textarea
                        value={form.description}
                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Describe the scope, timing, and assessment objective."
                        rows={4}
                        className="max-h-32 overflow-y-auto rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                      />
                    </div>
                    <TracePanel
                      title="Applications In Scope"
                      subtitle="Select existing applications from the Asset Registry. These drive the questionnaire path."
                      className="rounded-[22px] shadow-none"
                    >
                      <div
                        data-risk-assessment-scope-asset-scroll="true"
                        className="max-h-[112px] space-y-3 overflow-y-auto pr-2"
                      >
                        {assets.length === 0 ? (
                          <div className="rounded-[16px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-6 text-[13px] leading-6 text-[#7388A8]">
                            No applications are available in the Asset Registry yet.
                          </div>
                        ) : (
                          assets.map((asset) => {
                            const checked = form.selectedAssetIds.includes(asset.id);
                            return (
                              <label
                                key={asset.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-[18px] border px-4 py-4 transition-colors ${
                                  checked ? "border-[#AFC1F8] bg-[#EEF2FF]" : "border-[#E2E6EF] bg-white hover:bg-[#F8FAFF]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-[#B4C1D6]"
                                  checked={checked}
                                  onChange={(event) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      selectedAssetIds: event.target.checked
                                        ? [...prev.selectedAssetIds, asset.id]
                                        : prev.selectedAssetIds.filter((value) => value !== asset.id),
                                    }))
                                  }
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[14px] font-bold text-[#0C233C]">{asset.name}</p>
                                      <p className="mt-1 text-[12px] leading-6 text-[#7388A8]">
                                        {asset.description || asset.use || "Application in the asset registry"}
                                      </p>
                                    </div>
                                    <BandBadge band={asset.criticality} />
                                  </div>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </TracePanel>
                  </div>

                  <div className="flex min-h-full flex-col gap-5">
                    <TracePanel
                      title="Ad Hoc Applications"
                      subtitle="Add systems not yet in the registry. They remain part of scope without touching other features."
                      className="rounded-[8px] shadow-none"
                    >
                      <div className="mb-4 flex flex-col items-start gap-3">
                        <div className="text-[13px] text-[#7388A8]">
                          {adHocApps.length} ad hoc application{adHocApps.length === 1 ? "" : "s"} added
                        </div>
                        <button className={SOFT_BUTTON} onClick={() => setShowAdHocForm((prev) => !prev)}>
                          <Plus className="h-4 w-4" />
                          Add Entry
                        </button>
                      </div>

                      {adHocApps.length > 0 ? (
                        <div className="max-h-[184px] space-y-2 overflow-y-auto pr-1">
                          {adHocApps.map((application, index) => (
                            <div
                              key={`${application.name}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-[8px] border border-[#E2E6EF] bg-[#FBFCFE] px-4 py-3"
                            >
                              <div>
                                <p className="text-[13px] font-bold text-[#0C233C]">{application.name}</p>
                                <p className="text-[12px] text-[#7388A8]">
                                  CIA {application.confidentiality}/{application.integrity}/{application.availability}
                                </p>
                              </div>
                              <button
                                className="text-[12px] font-bold text-[#8492A6] transition-colors hover:text-[#E5001B]"
                                onClick={() => setAdHocApps((prev) => prev.filter((_, appIndex) => appIndex !== index))}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                    </TracePanel>
                  </div>
                </div>
                  </div>

                <Dialog open={showAdHocForm} onOpenChange={setShowAdHocForm}>
                  <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[920px] flex-col overflow-hidden rounded-[18px] border border-[#BFD0E5] bg-white p-0 shadow-[0_34px_100px_-42px_rgba(2,10,24,0.72)] sm:w-[calc(100vw-48px)] [&>button]:text-white [&>button]:opacity-80 [&>button:hover]:opacity-100">
                    {/* Keep the ad hoc popup readable on mobile by letting the shell size from the viewport. */}
                    <DialogHeader className="flex-shrink-0 border-b border-[#123863] bg-[#0C233C] px-5 py-6 text-left text-white sm:px-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-white">Ad Hoc Application</p>
                      <DialogTitle className="mt-4 text-[26px] font-bold tracking-[-0.04em] text-white">
                        Add Application Details
                      </DialogTitle>
                      <DialogDescription className="mt-4 max-w-[780px] text-[14px] leading-7 text-white">
                        Capture systems that are not yet in the Asset Registry and include the CIA rating needed for this assessment scope.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-[#F4F7FB] px-4 py-5 sm:px-6 sm:py-10">
                      {/* Stack form and CIA panels until there is enough room for a stable two-column layout. */}
                      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
                        <div className="min-h-[504px] space-y-5 rounded-[8px] border border-[#D6E0EF] bg-white p-5 sm:p-6">
                          <div>
                            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                              Application Name
                            </label>
                            <Input
                              value={adHocDraft.name ?? ""}
                              onChange={(event) => setAdHocDraft((prev) => ({ ...prev, name: event.target.value }))}
                              placeholder="Payments orchestration platform"
                              className="h-12 rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                              Application Description
                            </label>
                            <Textarea
                              value={adHocDraft.description ?? ""}
                              onChange={(event) => setAdHocDraft((prev) => ({ ...prev, description: event.target.value }))}
                              placeholder="Describe the application, users, data, and core business process."
                              rows={4}
                              className="rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                              Assessment Context
                            </label>
                            <Textarea
                              value={adHocDraft.assessment_context ?? ""}
                              onChange={(event) =>
                                setAdHocDraft((prev) => ({ ...prev, assessment_context: event.target.value }))
                              }
                              placeholder="Explain why this system is in scope and what should be considered during risk review."
                              rows={4}
                              className="rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                            />
                          </div>
                        </div>

                        <div className="min-w-0 space-y-4">
                          <div className="min-w-0 rounded-[8px] border border-[#D6E0EF] bg-white p-4 sm:p-5">
                            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                              CIA Rating
                            </p>
                            <CiaRatingWidget
                              confidentiality={adHocDraft.confidentiality ?? 3}
                              confidentiality_min={adHocDraft.confidentiality ?? 3}
                              integrity={adHocDraft.integrity ?? 3}
                              integrity_min={adHocDraft.integrity ?? 3}
                              availability={adHocDraft.availability ?? 3}
                              availability_min={adHocDraft.availability ?? 3}
                              onChange={(field, _minValue, maxValue) =>
                                setAdHocDraft((prev) => ({ ...prev, [field]: maxValue }))
                              }
                            />
                          </div>
                          <div className="min-w-0 rounded-[8px] border border-[#D6E0EF] bg-white p-4 sm:p-5">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">Current Summary</p>
                            <p className="mt-3 break-words text-[14px] font-bold text-[#0C233C]">
                              {adHocDraft.name?.trim() || "Unnamed application"}
                            </p>
                            <p className="mt-2 text-[12px] leading-6 text-[#7388A8]">
                              CIA {adHocDraft.confidentiality ?? 3}/{adHocDraft.integrity ?? 3}/{adHocDraft.availability ?? 3}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="flex-shrink-0 border-t border-[#253244] bg-[#2F3947] px-4 py-4 sm:px-6">
                      {/* Stack footer actions on narrow screens so both controls remain easy to tap. */}
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#4C596B] bg-[#465162] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#526073] sm:w-auto" onClick={() => setShowAdHocForm(false)}>
                        Cancel
                      </button>
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#1E49E2] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#00338D] disabled:cursor-not-allowed disabled:bg-[#8EA4D9] sm:w-auto" onClick={handleAddAdHoc} disabled={!adHocDraft.name?.trim()}>
                        Add Application
                      </button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                  <DialogFooter className="flex-shrink-0 border-t border-[#253244] bg-[#2F3947] px-4 py-4 sm:px-6">
                    <button className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#4C596B] bg-[#465162] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#526073] sm:w-auto" onClick={closeCreate}>
                      Cancel
                    </button>
                    <button
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#66758A] bg-transparent px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
                      onClick={() => toast({ title: "Draft retained", description: "Your entries are still available in this create form." })}
                    >
                      <Save className="h-4 w-4" />
                      Save Draft
                    </button>
                    <button className={PRIMARY_BUTTON} onClick={() => void handleCreate()}>
                      <Play className="h-4 w-4" />
                      Create Assessment
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}

            {selectedAssessment && !showCreate ? (
              <div ref={workflowContentRef} className="space-y-6" data-risk-assessment-active-workspace="true">
                <section className="overflow-hidden rounded-[10px] border border-[#D8E0ED] bg-white shadow-[0_20px_48px_-38px_rgba(12,35,60,0.28)]">
                  <WorkspaceHeader
                    title={selectedAssessment.title}
                    onBack={() => {
                      selectAssessment(null);
                      setLocation("/risk-assessment");
                      setWizardStep(0);
                    }}
                  />
                  <WorkflowContextBar
                    assessment={selectedAssessment}
                    assetLabel={assetName(currentAssetId || selectedAssessment.asset_ids[0] || "")}
                    progress={Math.min(100, Math.max(17, Math.round(((Math.min(wizardStep, WORKFLOW_PROGRESS_STEP_COUNT - 1) + 1) / WORKFLOW_PROGRESS_STEP_COUNT) * 100)))}
                    currentStage={activeWorkflowStep}
                  />
                  <WorkflowStepper
                    activeStep={activeWorkflowStep}
                    completedSteps={completedWorkflowSteps}
                    disabledSteps={disabledWorkflowSteps}
                    onStepSelect={handleWorkflowStepSelect}
                  />
                </section>

                {wizardStep === 0 ? (
                  <SurfaceSection
                    eyebrow="Scope"
                    title="Assessment Summary"
                    action={
                      selectedAssessment.asset_ids.length > 0 ? (
                        <button
                          className={PRIMARY_BUTTON}
                          onClick={() => navigateWorkflowStep("Questionnaire")}
                        >
                          Start Questionnaire
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ) : null
                    }
                  >
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <TracePanel
                        title="Applications In Scope"
                        subtitle="Asset Registry applications drive the questionnaire path for this assessment."
                        className="risk-summary-scope-glass-panel"
                      >
                        <div className="flex flex-wrap gap-2">
                          {selectedAssessment.asset_ids.length > 0 ? (
                            selectedAssessment.asset_ids.map((assetId) => (
                              <Badge key={assetId} variant="outline" className="rounded-full px-3 py-1.5 text-[12px]">
                                {assetName(assetId)}
                              </Badge>
                            ))
                          ) : (
                            <div className="text-[13px] text-[#7388A8]">No Asset Registry applications selected.</div>
                          )}
                        </div>
                        {selectedAssessment.ad_hoc_applications?.length ? (
                          <div className="mt-4 border-t border-[#E2E6EF] pt-4">
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7E91AE]">
                              Ad Hoc Applications
                            </p>
                            <div className="space-y-2">
                              {selectedAssessment.ad_hoc_applications.map((application, index) => (
                                <div
                                  key={`${application.name}-${index}`}
                                  className="rounded-[16px] border border-[#E2E6EF] bg-[#FBFCFE] px-4 py-3"
                                >
                                  <p className="text-[13px] font-bold text-[#0C233C]">{application.name}</p>
                                  <p className="mt-1 text-[12px] text-[#7388A8]">
                                    {application.assessment_context || application.description || "Added as scope context"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </TracePanel>

                      <TracePanel
                        title="Readiness"
                        subtitle="Questionnaire can begin once at least one registry application is in scope."
                        className="risk-summary-readiness-glass-panel"
                      >
                        <div className="space-y-3">
                          <div className="rounded-[18px] bg-[#F7F9FC] px-4 py-4">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8492A6]">Registry Applications</div>
                            <div className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#0C233C]">
                              {selectedAssessment!.asset_ids.length}
                            </div>
                          </div>
                          <div className="rounded-[18px] bg-[#F7F9FC] px-4 py-4">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8492A6]">Ad Hoc Context Entries</div>
                            <div className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#0C233C]">
                              {selectedAssessment.ad_hoc_applications?.length ?? 0}
                            </div>
                          </div>
                          {selectedAssessment.asset_ids.length === 0 ? (
                            <div className="rounded-[16px] border border-[#F6D3A0] bg-[#FFF9E8] px-4 py-3 text-[12px] leading-6 text-[#8A6A00]">
                              Questionnaire capture currently runs against Asset Registry applications only.
                            </div>
                          ) : null}
                        </div>
                      </TracePanel>
                    </div>
                  </SurfaceSection>
                ) : null}

                {wizardStep === 1 ? (
                  <QuestionnaireStep
                    assessment={selectedAssessment}
                    sections={sections}
                    answers={answers}
                    currentAssetId={currentAssetId}
                    expandedSection={expandedSection}
                    currentAnsweredCount={currentAnsweredCount}
                    currentTotalQuestions={currentTotalQuestions}
                    submittingQa={submittingQa}
                    primaryButtonClassName={PRIMARY_BUTTON}
                    secondaryButtonClassName={SECONDARY_BUTTON}
                    onExpandedSectionChange={setExpandedSection}
                    onAnswerChange={setAnswer}
                    onSaveProgress={() => toast({ title: "Progress saved" })}
                    onSubmitQuestionnaire={() => void handleSubmitQa()}
                    getSectionProgress={sectionProgress}
                  />
                ) : null}


                {wizardStep === 2 ? (
                  <AnalysisStep />
                ) : null}

                {wizardStep === 3 ? (
                  <RiskReviewStep
                    assessment={selectedAssessment}
                    primaryButtonClassName={PRIMARY_BUTTON}
                    onApplyControls={() => navigateWorkflowStep("Findings")}
                  />
                ) : null}

                {wizardStep === 4 ? (
                  <ControlsStep
                    assessment={selectedAssessment}
                    primaryButtonClassName={PRIMARY_BUTTON}
                    softButtonClassName={SOFT_BUTTON}
                    onRefreshSuggestions={() =>
                      void suggestControls(selectedAssessment.id)
                        .then(() => toast({ title: "Suggestions refreshed" }))
                        .catch(() => toast({ title: "Failed to refresh suggestions", variant: "destructive" }))
                    }
                    onCalculateResidual={() => {
                      setLocation("/risk-assessment?step=findings");
                      setWizardStep(5);
                    }}
                    onApplySuggestion={handleApplySuggestion}
                  />
                ) : null}

                {wizardStep === 5 ? (
                  <ResidualStep
                    residualResults={residualResults}
                    primaryButtonClassName={PRIMARY_BUTTON}
                    softButtonClassName={SOFT_BUTTON}
                    onRefreshResidual={() => void fetchResidual(selectedAssessment.id)}
                    onGenerateReport={() => navigateWorkflowStep("Final Report")}
                  />
                ) : null}

                {wizardStep === 6 ? (
                  <FinalReportStep
                    currentReport={currentReport}
                    isGeneratingReport={isGeneratingReport}
                    primaryButtonClassName={PRIMARY_BUTTON}
                    secondaryButtonClassName={SECONDARY_BUTTON}
                    onCancel={() => {
                      setLocation("/risk-assessment");
                      setShowCreate(false);
                      selectAssessment(null);
                      setWizardStep(0);
                    }}
                    onGenerateReport={() => void handleGenerateReport()}
                    onViewReport={() => setShowReportDialog(true)}
                  />
                ) : null}

                <ReportPreviewDialog
                  open={showReportDialog}
                  onOpenChange={setShowReportDialog}
                  title={selectedAssessment.title}
                  report={currentReport}
                  secondaryButtonClassName={SECONDARY_BUTTON}
                />
              </div>
            ) : null}
          </div>
      </main>
      <style>{`
        .risk-create-animated-bg {
          background:
            linear-gradient(145deg, rgba(12, 35, 60, 0.06), transparent 42%),
            radial-gradient(ellipse at 16% 14%, rgba(30, 73, 226, 0.13), transparent 34%),
            radial-gradient(ellipse at 86% 28%, rgba(0, 184, 245, 0.10), transparent 36%),
            radial-gradient(ellipse at 52% 88%, rgba(9, 142, 126, 0.08), transparent 38%),
            #F0F2F7;
        }

        .risk-create-grid {
          background-image:
            linear-gradient(rgba(30, 73, 226, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30, 73, 226, 0.055) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(180deg, transparent, black 16%, black 82%, transparent);
          animation: riskCreateGridDrift 18s linear infinite;
        }

        .risk-create-blueprint {
          background-image:
            linear-gradient(115deg, transparent 0 32%, rgba(30, 73, 226, 0.10) 32.12%, transparent 32.4% 64%, rgba(0, 184, 245, 0.08) 64.12%, transparent 64.4%),
            linear-gradient(25deg, transparent 0 44%, rgba(12, 35, 60, 0.08) 44.12%, transparent 44.45%);
          background-size: 620px 420px, 520px 360px;
          opacity: 0.58;
          mask-image: radial-gradient(ellipse at 50% 42%, black, transparent 78%);
          animation: riskCreateBlueprintShift 22s ease-in-out infinite alternate;
        }

        .risk-create-sheen {
          background: linear-gradient(105deg, transparent 18%, rgba(255, 255, 255, 0.16) 44%, transparent 62%);
          opacity: 0.42;
          transform: translateX(-64%);
          animation: riskCreateSheen 11s ease-in-out infinite;
        }

        .risk-create-glow {
          position: absolute;
          filter: blur(12px);
          opacity: 0.42;
          animation: riskCreateGlowFloat 10s ease-in-out infinite;
        }

        .risk-create-glow-one {
          left: 6%;
          top: 14%;
          width: 360px;
          height: 220px;
          background: linear-gradient(135deg, rgba(30, 73, 226, 0.24), rgba(0, 184, 245, 0.05), transparent 72%);
          transform: rotate(-12deg);
        }

        .risk-create-glow-two {
          right: 5%;
          top: 28%;
          width: 420px;
          height: 250px;
          background: linear-gradient(135deg, rgba(0, 184, 245, 0.18), rgba(9, 142, 126, 0.09), transparent 72%);
          transform: rotate(13deg);
          animation-delay: 1.8s;
        }

        .risk-create-line {
          position: absolute;
          height: 1px;
          width: 36%;
          background: linear-gradient(90deg, transparent, rgba(30, 73, 226, 0.18), transparent);
          animation: riskCreateLinePulse 6s ease-in-out infinite;
        }

        .risk-create-line-one {
          left: 6%;
          top: 34%;
          transform: rotate(10deg);
        }

        .risk-create-line-two {
          right: 5%;
          top: 58%;
          transform: rotate(-9deg);
          animation-delay: 1.2s;
        }

        .risk-create-track {
          position: absolute;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 184, 245, 0.18), rgba(30, 73, 226, 0.34), transparent);
          box-shadow: 0 0 18px rgba(0, 184, 245, 0.12);
          animation: riskCreateTrackPulse 7.5s ease-in-out infinite;
        }

        .risk-create-track-1 { left: 8%; top: 24%; width: 38%; transform: rotate(7deg); }
        .risk-create-track-2 { right: 7%; top: 33%; width: 34%; transform: rotate(-8deg); animation-delay: 900ms; }
        .risk-create-track-3 { left: 12%; top: 58%; width: 44%; transform: rotate(-5deg); animation-delay: 1.8s; }
        .risk-create-track-4 { right: 12%; top: 70%; width: 42%; transform: rotate(6deg); animation-delay: 2.6s; }
        .risk-create-track-5 { left: 30%; top: 86%; width: 46%; transform: rotate(1deg); animation-delay: 3.2s; }

        .risk-create-node {
          position: absolute;
          width: 6px;
          height: 6px;
          border: 1px solid rgba(30, 73, 226, 0.45);
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.68);
          box-shadow: 0 0 16px rgba(0, 184, 245, 0.28);
          animation: riskCreateNodePulse 5.2s ease-in-out infinite;
        }

        .risk-create-node-1 { left: 9%; top: 26%; }
        .risk-create-node-2 { left: 18%; top: 42%; animation-delay: 300ms; }
        .risk-create-node-3 { left: 28%; top: 18%; animation-delay: 700ms; }
        .risk-create-node-4 { left: 39%; top: 63%; animation-delay: 1.1s; }
        .risk-create-node-5 { left: 48%; top: 33%; animation-delay: 1.5s; }
        .risk-create-node-6 { left: 57%; top: 79%; animation-delay: 1.9s; }
        .risk-create-node-7 { left: 68%; top: 22%; animation-delay: 2.3s; }
        .risk-create-node-8 { left: 82%; top: 47%; animation-delay: 2.7s; }
        .risk-create-node-9 { left: 90%; top: 74%; animation-delay: 3.1s; }
        .risk-create-node-10 { left: 15%; top: 81%; animation-delay: 3.5s; }
        .risk-create-node-11 { left: 34%; top: 88%; animation-delay: 3.9s; }
        .risk-create-node-12 { left: 73%; top: 86%; animation-delay: 4.3s; }
        .risk-create-node-13 { left: 88%; top: 18%; animation-delay: 4.7s; }
        .risk-create-node-14 { left: 6%; top: 60%; animation-delay: 5.1s; }

        .risk-create-glass-field {
          border-color: rgba(0, 184, 245, 0.20);
          background: linear-gradient(135deg, rgba(2, 10, 24, 0.92), rgba(12, 35, 60, 0.82));
          color: #FFFFFF;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 16px 34px -28px rgba(0, 51, 141, 0.65);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .risk-create-glass-field:focus,
        .risk-create-glass-field:focus-visible {
          border-color: rgba(0, 184, 245, 0.62);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.10),
            0 0 0 3px rgba(0, 184, 245, 0.12),
            0 18px 38px -30px rgba(0, 51, 141, 0.78);
        }

        .risk-create-glass-field::placeholder {
          color: rgba(226, 240, 255, 0.48);
        }

        .risk-assessment-setup-glass {
          position: relative;
          border-color: #D6E0EF;
          background: #FFFFFF;
          box-shadow: none;
        }

        .risk-assessment-setup-glass::before {
          content: none;
        }

        .risk-assessment-setup-glass > * {
          position: relative;
          z-index: 1;
        }

        .risk-assessment-setup-glass [class*="CommandDeckMetric"],
        .risk-assessment-setup-glass .rounded-\\[18px\\] {
          background: #F8FAFD;
          border-color: #D6E0EF;
        }

        .risk-ad-hoc-glass-panel,
        .risk-scope-glass-panel {
          position: relative;
          overflow: hidden;
          border-color: rgba(0, 184, 245, 0.22);
          background:
            linear-gradient(135deg, rgba(12, 35, 60, 0.94), rgba(0, 51, 141, 0.74) 56%, rgba(2, 10, 24, 0.88)),
            rgba(12, 35, 60, 0.82);
          color: white;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 24px 54px -36px rgba(0, 51, 141, 0.66);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .risk-ad-hoc-glass-panel::before,
        .risk-scope-glass-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 18% 0%, rgba(0, 184, 245, 0.24), transparent 34%),
            linear-gradient(115deg, transparent, rgba(255, 255, 255, 0.08), transparent 58%);
          pointer-events: none;
        }

        .risk-ad-hoc-glass-panel > *,
        .risk-scope-glass-panel > * {
          position: relative;
          z-index: 1;
        }

        .risk-ad-hoc-glass-panel h2,
        .risk-scope-glass-panel h2 {
          color: #FFFFFF;
        }

        .risk-ad-hoc-glass-panel header p,
        .risk-scope-glass-panel header p,
        .risk-ad-hoc-glass-panel .text-\\[13px\\],
        .risk-scope-glass-panel .text-\\[13px\\],
        .risk-ad-hoc-glass-panel .text-\\[12px\\],
        .risk-scope-glass-panel .text-\\[12px\\] {
          color: rgba(226, 240, 255, 0.74);
        }

        .risk-ad-hoc-glass-panel button {
          border: 1px solid rgba(0, 184, 245, 0.26);
          background: rgba(255, 255, 255, 0.10);
          color: #FFFFFF;
          box-shadow: 0 0 22px rgba(0, 184, 245, 0.12);
        }

        .risk-ad-hoc-glass-panel button:hover {
          background: rgba(255, 255, 255, 0.16);
        }

        .risk-scope-glass-panel label {
          border-color: rgba(0, 184, 245, 0.22);
          background: rgba(255, 255, 255, 0.10);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .risk-scope-glass-panel label:hover {
          background: rgba(255, 255, 255, 0.16);
        }

        .risk-scope-glass-panel label:has(input:checked) {
          border-color: rgba(0, 184, 245, 0.52);
          background: rgba(30, 73, 226, 0.30);
        }

        .risk-scope-glass-panel label p:first-child {
          color: #FFFFFF;
        }

        .risk-scope-glass-panel .bg-\\[\\#FBFCFE\\] {
          border-color: rgba(0, 184, 245, 0.20);
          background: rgba(255, 255, 255, 0.08);
          color: rgba(226, 240, 255, 0.78);
        }

        .risk-summary-scope-glass-panel,
        .risk-summary-readiness-glass-panel {
          position: relative;
          overflow: hidden;
          border-color: rgba(0, 184, 245, 0.24);
          background:
            radial-gradient(circle at 18% 8%, rgba(0, 184, 245, 0.20), transparent 34%),
            radial-gradient(circle at 88% 0%, rgba(30, 73, 226, 0.22), transparent 30%),
            linear-gradient(135deg, rgba(2, 10, 24, 0.94), rgba(0, 51, 141, 0.78) 54%, rgba(12, 35, 60, 0.92));
          color: #FFFFFF;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.13),
            0 26px 58px -40px rgba(0, 51, 141, 0.78);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .risk-summary-scope-glass-panel {
          min-height: 354px;
        }

        .risk-summary-scope-glass-panel::before,
        .risk-summary-readiness-glass-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 16% 0%, rgba(0, 184, 245, 0.18), transparent 34%),
            linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.08) 44%, transparent 62%);
          pointer-events: none;
        }

        .risk-summary-scope-glass-panel > *,
        .risk-summary-readiness-glass-panel > * {
          position: relative;
          z-index: 1;
        }

        .risk-summary-scope-glass-panel h2,
        .risk-summary-readiness-glass-panel h2 {
          color: #FFFFFF;
        }

        .risk-summary-scope-glass-panel header p,
        .risk-summary-readiness-glass-panel header p,
        .risk-summary-scope-glass-panel .text-\\[13px\\],
        .risk-summary-readiness-glass-panel .text-\\[13px\\],
        .risk-summary-readiness-glass-panel .text-\\[11px\\],
        .risk-summary-scope-glass-panel .text-\\[12px\\] {
          color: rgba(226, 240, 255, 0.76);
        }

        .risk-summary-scope-glass-panel .rounded-full {
          border-color: rgba(0, 184, 245, 0.32);
          background: rgba(255, 255, 255, 0.10);
          color: #EAF7FF;
          box-shadow: 0 0 18px rgba(0, 184, 245, 0.12);
        }

        .risk-summary-scope-glass-panel .border-t {
          border-color: rgba(0, 184, 245, 0.20);
        }

        .risk-summary-scope-glass-panel .bg-\\[\\#FBFCFE\\] {
          border-color: rgba(0, 184, 245, 0.22);
          background: rgba(255, 255, 255, 0.08);
        }

        .risk-summary-readiness-glass-panel .bg-\\[\\#F7F9FC\\] {
          border: 1px solid rgba(0, 184, 245, 0.20);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .risk-summary-readiness-glass-panel .text-\\[28px\\] {
          color: #FFFFFF;
        }

        .risk-summary-readiness-glass-panel .border-\\[\\#F6D3A0\\] {
          border-color: rgba(234, 170, 0, 0.34);
          background: rgba(234, 170, 0, 0.12);
          color: rgba(255, 242, 198, 0.92);
        }

        .risk-question-answer-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          color: #33415C;
          background: #FFFFFF;
          border-color: #D6E0EF;
          box-shadow: none;
          position: relative;
          overflow: hidden;
        }

        .risk-question-answer-button::before {
          content: none;
        }

        .risk-question-answer-button--idle:hover {
          border-color: #1E49E2;
          background: #F8FBFF;
          box-shadow: none;
        }

        .risk-question-answer-button--yes-selected {
          border-color: #009A44;
          color: #007A36;
          background: #EDFBF5;
          box-shadow: none;
        }

        .risk-question-answer-button--no-selected {
          border-color: #E5001B;
          color: #B80016;
          background: #FEEBED;
          box-shadow: none;
        }

        .risk-question-answer-button--na-selected {
          border-color: #8492A6;
          color: #33415C;
          background: #F3F6FA;
          box-shadow: none;
        }

        .risk-question-answer-button > * {
          position: relative;
          z-index: 1;
        }

        .risk-question-answer-button:focus-visible {
          outline: 2px solid rgba(30, 73, 226, 0.45);
          outline-offset: 2px;
        }

        .risk-question-answer-button:active {
          transform: translateY(1px);
        }

        .risk-questionnaire-glass-section {
          background: #FFFFFF;
          box-shadow: none;
        }

        .risk-questionnaire-glass-section > button {
          background: #FFFFFF;
        }

        .risk-questionnaire-glass-section > div {
          background: #FFFFFF;
        }

        .risk-identify-glass-panel,
        .risk-identified-glass-list {
          position: relative;
          overflow: hidden;
          border-color: rgba(0, 184, 245, 0.24);
          background:
            radial-gradient(circle at 18% 0%, rgba(0, 184, 245, 0.22), transparent 34%),
            radial-gradient(circle at 86% 18%, rgba(30, 73, 226, 0.20), transparent 32%),
            linear-gradient(135deg, rgba(2, 10, 24, 0.94), rgba(0, 51, 141, 0.78) 54%, rgba(12, 35, 60, 0.92));
          color: #FFFFFF;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.13),
            0 26px 58px -40px rgba(0, 51, 141, 0.78);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .risk-identify-glass-panel::before,
        .risk-identified-glass-list::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.08) 44%, transparent 64%);
          pointer-events: none;
        }

        .risk-identify-glass-panel > *,
        .risk-identified-glass-list > * {
          position: relative;
          z-index: 1;
        }

        .risk-identify-glass-panel h2,
        .risk-identify-glass-panel h3,
        .risk-identify-glass-panel .text-\\[24px\\],
        .risk-identify-glass-panel .text-\\[13px\\],
        .risk-identify-glass-panel .text-\\[15px\\] {
          color: #FFFFFF;
        }

        .risk-identify-glass-panel p,
        .risk-identify-glass-panel header p {
          color: rgba(226, 240, 255, 0.76);
        }

        .risk-identify-glass-panel .bg-\\[\\#F3F0FF\\] {
          background: rgba(255, 255, 255, 0.10);
          color: #ACEAFF;
          box-shadow: 0 0 24px rgba(0, 184, 245, 0.18);
        }

        .risk-identify-glass-panel .bg-\\[\\#DCE3EE\\] {
          background: rgba(255, 255, 255, 0.14);
        }

        .risk-identify-run-panel .bg-\\[\\#F7F9FC\\] {
          border: 1px solid rgba(216, 224, 237, 0.88);
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 14px 28px -24px rgba(12, 35, 60, 0.28);
        }

        .risk-identify-run-panel .text-\\[\\#0C233C\\] {
          color: #0C233C;
        }

        .risk-identified-glass-list > .rounded-\\[22px\\],
        .risk-identified-glass-list > div {
          border-color: rgba(216, 224, 237, 0.88);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 34px -30px rgba(12, 35, 60, 0.32);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .risk-controls-glass-stage {
          position: relative;
          overflow: hidden;
          border-color: rgba(0, 184, 245, 0.24);
          background:
            radial-gradient(circle at 16% 0%, rgba(0, 184, 245, 0.22), transparent 34%),
            radial-gradient(circle at 90% 16%, rgba(30, 73, 226, 0.20), transparent 32%),
            linear-gradient(135deg, rgba(2, 10, 24, 0.94), rgba(0, 51, 141, 0.78) 54%, rgba(12, 35, 60, 0.92));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.13),
            0 26px 58px -40px rgba(0, 51, 141, 0.78);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .risk-controls-glass-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.08) 44%, transparent 64%);
          pointer-events: none;
        }

        .risk-controls-glass-stage > * {
          position: relative;
          z-index: 1;
        }

        .risk-controls-risk-panel {
          border-color: rgba(216, 224, 237, 0.88);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 34px -30px rgba(12, 35, 60, 0.34);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .risk-controls-risk-panel .bg-\\[\\#FBFCFE\\] {
          background: rgba(247, 249, 252, 0.92);
        }

        .risk-control-apply-glass-button {
          display: inline-flex;
          min-height: 38px;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid #1E49E2;
          background: #1E49E2;
          padding: 0 16px;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 800;
          box-shadow: none;
          transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 160ms ease;
        }

        .risk-control-apply-glass-button:hover {
          border-color: #00338D;
          background: #00338D;
          color: #FFFFFF;
          box-shadow: none;
        }

        .risk-control-apply-glass-button:active {
          transform: translateY(1px);
        }

        .risk-control-applied-glass-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 999px;
          border: 1px solid #009A44;
          background: #009A44;
          padding: 4px 12px;
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 800;
          box-shadow: none;
        }

        .risk-residual-glass-stage {
          position: relative;
          overflow: hidden;
          border-color: rgba(0, 184, 245, 0.24);
          background:
            radial-gradient(circle at 16% 0%, rgba(0, 184, 245, 0.22), transparent 34%),
            radial-gradient(circle at 90% 16%, rgba(30, 73, 226, 0.20), transparent 32%),
            linear-gradient(135deg, rgba(2, 10, 24, 0.94), rgba(0, 51, 141, 0.78) 54%, rgba(12, 35, 60, 0.92));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.13),
            0 26px 58px -40px rgba(0, 51, 141, 0.78);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .risk-residual-glass-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.08) 44%, transparent 64%);
          pointer-events: none;
        }

        .risk-residual-glass-stage > * {
          position: relative;
          z-index: 1;
        }

        .risk-residual-glass-stage > div {
          background: rgba(255, 255, 255, 0.96);
          border-color: rgba(216, 224, 237, 0.88);
        }

        .risk-report-glass-box {
          position: relative;
          overflow: hidden;
          border-color: rgba(0, 184, 245, 0.24);
          background:
            radial-gradient(circle at 20% 0%, rgba(0, 184, 245, 0.22), transparent 34%),
            radial-gradient(circle at 86% 18%, rgba(30, 73, 226, 0.24), transparent 32%),
            linear-gradient(135deg, rgba(2, 10, 24, 0.94), rgba(0, 51, 141, 0.78) 54%, rgba(12, 35, 60, 0.92));
          color: rgba(226, 240, 255, 0.80);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.13),
            0 26px 58px -40px rgba(0, 51, 141, 0.78);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .risk-report-glass-box::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.08) 44%, transparent 64%);
          pointer-events: none;
        }

        .risk-report-glass-box > * {
          position: relative;
          z-index: 1;
        }

        .risk-report-glass-box svg {
          color: #ACEAFF;
          filter: drop-shadow(0 0 18px rgba(0, 184, 245, 0.28));
        }

        .risk-view-report-glass-button {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background:
            linear-gradient(135deg, rgba(2, 6, 12, 0.94), rgba(14, 18, 26, 0.88) 58%, rgba(0, 0, 0, 0.92));
          padding: 0 18px;
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 800;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.13),
            0 16px 32px -24px rgba(0, 0, 0, 0.72);
          transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
        }

        .risk-view-report-glass-button:hover {
          border-color: rgba(255, 255, 255, 0.32);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            0 18px 36px -24px rgba(0, 0, 0, 0.82);
        }

        .risk-view-report-glass-button:active {
          transform: translateY(1px);
        }

        @keyframes riskCreateGridDrift {
          from { background-position: 0 0, 0 0; }
          to { background-position: 42px 42px, 42px 42px; }
        }

        @keyframes riskCreateBlueprintShift {
          from { background-position: 0 0, 0 0; }
          to { background-position: 86px -42px, -62px 38px; }
        }

        @keyframes riskCreateSheen {
          0%, 18% { transform: translateX(-70%); opacity: 0; }
          42% { opacity: 0.42; }
          68%, 100% { transform: translateX(70%); opacity: 0; }
        }

        @keyframes riskCreateGlowFloat {
          0%, 100% { opacity: 0.34; }
          50% { opacity: 0.54; }
        }

        @keyframes riskCreateLinePulse {
          0%, 100% { opacity: 0.16; }
          50% { opacity: 0.46; }
        }

        @keyframes riskCreateTrackPulse {
          0%, 100% { opacity: 0.12; filter: saturate(1); }
          50% { opacity: 0.52; filter: saturate(1.45); }
        }

        @keyframes riskCreateNodePulse {
          0%, 100% { opacity: 0.24; transform: scale(0.86); }
          50% { opacity: 0.86; transform: scale(1.18); }
        }
      `}</style>
    </div>
  );
}
