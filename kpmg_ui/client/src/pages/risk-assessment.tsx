import { type ReactNode, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileBarChart,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import HeroSection from "@/components/HeroSection";
import CompletionChecklist from "@/pages/RiskAssessment/components/CompletionChecklist";
import RecentAssessments from "@/pages/RiskAssessment/components/RecentAssessments";
import RiskAssessmentOverview from "@/pages/RiskAssessment/components/RiskAssessmentOverview";
import RiskAssessmentWorkspace, { STATUS_LABELS } from "@/pages/RiskAssessment/components/RiskAssessmentWorkspace";
import AssessmentSummaryForm from "@/pages/RiskAssessment/components/workflow/AssessmentSummaryForm";
import CreateAssessmentPage, {
  type CreateAssessmentFormState,
} from "@/pages/RiskAssessment/components/workflow/CreateAssessmentPage";
import QuestionnaireForm from "@/pages/RiskAssessment/components/workflow/QuestionnaireForm";
import WorkflowStepper, {
  WORKFLOW_PROGRESS_STEP_COUNT,
  WORKFLOW_STEP_BY_LABEL,
  WORKFLOW_STEP_BY_SLUG,
  assessmentIdFromLocation,
  isCreateRoute,
  workflowLabelFromWizardStep,
  workflowPathForAssessment,
  workflowSlugFromLocation,
  type WorkflowStepLabel,
} from "@/pages/RiskAssessment/components/workflow/WorkflowStepper";
import {
  TracePanel,
} from "@/components/TraceAnalysisPrimitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAssetRegistry } from "@/contexts/AssetRegistryContext";
import {
  type AdHocApplication,
  type AnswerType,
  type ResidualResult,
  type Risk,
  type RiskAssessment,
  type SuggestedControl,
  useRiskAssessment,
} from "@/contexts/RiskAssessmentContext";

const BAND_CLASS: Record<string, string> = {
  Critical: "border-[#F3C6CF] bg-[#FEEBED] text-[#E5001B]",
  High: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  Medium: "border-[#F8E8B7] bg-[#FFF9E8] text-[#8A6A00]",
  Low: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
};

const ANSWER_CLASS: Record<AnswerType, string> = {
  yes: "border-[#F3C6CF] bg-[#FEEBED] text-[#E5001B]",
  no: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
  na: "border-[#DCE3EE] bg-[#F3F6FA] text-[#6A748A]",
};

// Buttons become full-width on mobile to prevent cramped or clipped action text.
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

const SELECTED_ASSESSMENT_STORAGE_KEY = "risk-assessment:selected-assessment-id";

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

function statusToneTitle(assessment: RiskAssessment | null) {
  if (!assessment) return "Ready To Begin";
  return STATUS_LABELS[assessment.status] ?? "Assessment Selected";
}

function getAssessmentRiskSummary(assessment: RiskAssessment | null) {
  if (!assessment) return "Select or create a risk assessment to begin the workflow.";
  if (assessment.status === "draft") return "Assessment scope is set. Start the questionnaire when the selected applications are confirmed.";
  if (assessment.status === "in_progress") return "Questionnaire responses are being captured across the applications in scope.";
  if (assessment.status === "risks_identified") return "Inherent risks are available and ready for control application.";
  if (assessment.status === "controls_applied") return "Controls have been applied and the residual view is available for review.";
  if (assessment.status === "complete") return "The assessment is complete and ready for report review or rerun.";
  return "Assessment selected.";
}

function workflowLabelForAssessmentStatus(status?: RiskAssessment["status"]): WorkflowStepLabel {
  if (status === "complete") return "Final Report";
  if (status === "controls_applied") return "Findings";
  if (status === "risks_identified") return "Risk Review";
  if (status === "in_progress") return "Questionnaire";
  if (status === "draft") return "Assets";
  return "Create";
}

function BandBadge({ band }: { band: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${BAND_CLASS[band] ?? BAND_CLASS.Medium}`}
    >
      {band}
    </span>
  );
}

function SurfaceSection({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-[#DCE3EE] bg-white p-6 shadow-[0_18px_42px_-34px_rgba(12,35,60,0.26)] ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#00338D]">{eyebrow}</p>
          ) : null}
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0C233C]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RiskSummaryCard({ risk }: { risk: Risk }) {
  return (
    <div className="rounded-[20px] border border-[#DCE3EE] bg-white p-5 shadow-[0_16px_34px_-30px_rgba(12,35,60,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold tracking-[-0.02em] text-[#0C233C]">{risk.title}</h3>
          <p className="mt-2 text-[13px] leading-6 text-[#5A6478]">{risk.description}</p>
        </div>
        <BandBadge band={risk.inherent_risk_band} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[#7388A8]">
        <span>Likelihood {risk.likelihood_score}/5</span>
        <span>Impact {risk.impact_score}/5</span>
        <span>Score {risk.inherent_risk_score}</span>
        <span>{risk.risk_category}</span>
      </div>
    </div>
  );
}

function AppliedControlChip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#BFE7D1] bg-[#EDFBF5] px-3 py-1.5 text-[11px] font-bold text-[#009A44]">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function SuggestedControlRow({
  suggestion,
  alreadyApplied,
  onApply,
}: {
  suggestion: SuggestedControl;
  alreadyApplied: boolean;
  onApply: () => Promise<void>;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E6EF] bg-[#FBFCFE] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[#0C233C]">{suggestion.control_title}</p>
          <p className="mt-1.5 text-[12px] leading-6 text-[#7388A8]">{suggestion.rationale}</p>
          <div className="mt-3 inline-flex rounded-full border border-[#DCE3EE] bg-white px-3 py-1 text-[11px] font-bold text-[#6A748A]">
            Relevance {suggestion.relevance_score}/5
          </div>
        </div>
        {alreadyApplied ? (
          <span className="risk-control-applied-glass-pill">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Applied
          </span>
        ) : (
          <button className="risk-control-apply-glass-button" onClick={() => void onApply()}>
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

function ResidualCard({ result }: { result: ResidualResult }) {
  const inherentWidth = Math.min(100, result.inherent_risk_score * 4);
  const residualWidth = Math.min(100, result.residual_risk_score * 4);
  const residualBarClass =
    result.residual_risk_band === "Low"
      ? "bg-[linear-gradient(90deg,#009A44_0%,#098E7E_100%)]"
      : result.residual_risk_band === "Medium"
        ? "bg-[linear-gradient(90deg,#EAAA00_0%,#F2B100_100%)]"
        : "bg-[linear-gradient(90deg,#EAAA00_0%,#E5001B_100%)]";

  return (
    <div className="rounded-[20px] border border-[#DCE3EE] bg-white p-5 shadow-[0_16px_34px_-30px_rgba(12,35,60,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold tracking-[-0.02em] text-[#0C233C]">{result.risk_title}</h3>
          <p className="mt-1 text-[12px] text-[#7388A8]">{result.controls_applied} controls applied</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BandBadge band={result.inherent_risk_band} />
          <BandBadge band={result.residual_risk_band} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8492A6]">Inherent</div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#DCE3EE]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#E5001B_0%,#F05A6C_100%)]" style={{ width: `${inherentWidth}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8492A6]">Residual</div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#DCE3EE]">
            <div className={`h-full rounded-full ${residualBarClass}`} style={{ width: `${residualWidth}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[#7388A8]">
        <span>Avg effectiveness {(result.avg_effectiveness * 100).toFixed(0)}%</span>
        <span>Residual score {result.residual_risk_score}</span>
      </div>
    </div>
  );
}

function SetupProgressReport({
  answeredQuestions,
  totalQuestions,
  registryCount,
  adHocCount,
  notesCount,
  className = "",
}: {
  answeredQuestions: number;
  totalQuestions: number;
  registryCount: number;
  adHocCount: number;
  notesCount: number;
  className?: string;
}) {
  const rows = [
    {
      label: "Questions submission",
      complete: totalQuestions > 0 && answeredQuestions >= totalQuestions,
      value: `${answeredQuestions}/${totalQuestions} answered`,
      progress: totalQuestions > 0 ? answeredQuestions / totalQuestions : 0,
    },
    {
      label: "Not answered",
      complete: totalQuestions > 0 && answeredQuestions >= totalQuestions,
      value: `${Math.max(totalQuestions - answeredQuestions, 0)} remaining`,
      progress: totalQuestions > 0 ? answeredQuestions / totalQuestions : 0,
    },
    {
      label: "Evidence notes",
      complete: notesCount > 0,
      value: `${notesCount} added`,
      progress: Math.min(1, notesCount / Math.max(registryCount + adHocCount, 1)),
    },
    {
      label: "Context notes",
      complete: notesCount > 0,
      value: `${notesCount} added`,
      progress: Math.min(1, notesCount / Math.max(registryCount + adHocCount, 1)),
    },
  ];
  const completed = rows.filter((row) => row.complete).length;
  // Clamp setup progress so the circular graph never renders beyond a full 100% ring.
  const progress = Math.min(100, Math.max(0, Math.round((completed / rows.length) * 100)));
  const progressColor = progress === 0 ? "#FFFFFF" : `hsl(150, ${52 + Math.round(progress * 0.34)}%, ${62 - Math.round(progress * 0.20)}%)`;
  const progressLabel = progress === 0 ? "Not Started" : progress >= 100 ? "Complete" : "In Progress";

  return (
    <div className={`overflow-hidden rounded-[22px] border border-[#123863] bg-[linear-gradient(135deg,#0C233C_0%,#163B67_58%,#1E49E2_100%)] p-6 text-white shadow-[0_20px_44px_-30px_rgba(12,35,60,0.48)] ${className}`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-white/46">Progress Report</p>
      <h3 className="text-[24px] font-bold tracking-[-0.04em] text-white">Submitted Progress</h3>
      <p className="mt-3 text-[14px] leading-7 text-white/66">Review the current assessment setup before creating the session.</p>

      <div className="mt-8 flex flex-1 flex-col justify-between gap-8">
        <div className="flex justify-center">
          <div
            className="grid h-44 w-44 place-items-center rounded-full shadow-[0_18px_34px_-24px_rgba(0,184,245,0.55)]"
            style={{
              background: `conic-gradient(${progressColor} ${progress * 3.6}deg, rgba(255,255,255,0.16) 0deg)`,
            }}
            aria-label={`Setup progress ${progress}%`}
          >
            <div className="grid h-36 w-36 place-items-center rounded-full bg-[#0C233C] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
              <div className="text-center">
                <div className="text-[38px] font-bold tracking-[-0.04em]" style={{ color: progressColor }}>{progress}%</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/58">{progressLabel}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0 rounded-[16px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <p className="min-w-0 text-[11px] font-bold uppercase tracking-[0.14em] text-white/48">{row.label}</p>
              </div>
              <p className="break-words text-[13px] font-semibold leading-5 text-white">{row.value}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.round(row.progress * 100)))}%`,
                    background: row.progress === 0 ? "#FFFFFF" : `hsl(150, ${52 + Math.round(row.progress * 34)}%, ${62 - Math.round(row.progress * 20)}%)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// The context strip recreates the screenshot's top summary band without changing assessment data flow.
function WorkflowContextBar({
  assessment,
  assetLabel,
  progress,
  currentStage,
}: {
  assessment: RiskAssessment | null;
  assetLabel: string;
  progress: number;
  currentStage: string;
}) {
  // Clamp workflow progress at the component boundary so every caller displays 100% at most.
  const cappedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  // Use blue while work is in progress and green once the workflow reaches completion.
  const progressColor = cappedProgress >= 100 ? "#009A44" : "#1E49E2";
  const riskLabel = !assessment
    ? "Risk Level: Not selected"
    : assessment.risks.length === 0
      ? "Risk Level: Not assessed"
      : assessment.risks.some((risk) => risk.inherent_risk_band === "Critical" || risk.inherent_risk_band === "High")
        ? "Risk Level: High"
        : assessment.risks.some((risk) => risk.inherent_risk_band === "Medium")
          ? "Risk Level: Medium"
          : "Risk Level: Low";

  return (
    <section className="border-b border-[#D8E0ED] bg-white" data-risk-assessment-context-strip="true">
      <div className="grid min-h-[156px] grid-cols-1 divide-y divide-[#DCE4F0] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-[1.25fr_1.1fr_1fr_1fr_1.15fr]">
        {[
          ["Assessment", assessment?.title || "New Risk Assessment"],
          ["Asset", assetLabel],
          ["Current Stage", currentStage],
          ["Risk Level", riskLabel],
          ["Progress", `${cappedProgress}% Complete`],
        ].map(([label, value]) => (
          <div key={label} className={`min-w-0 px-5 py-5 ${label === "Progress" ? "flex flex-col items-center" : ""}`}>
            {/* Center the Progress label above its circle while preserving normal alignment for other context fields. */}
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#5A6478] ${label === "Progress" ? "text-center" : ""}`}>
              {label}
            </p>
            {label === "Progress" ? (
              // Render progress as a compact circular graph to match the requested visual treatment.
              <div className="flex w-full items-center justify-center" data-risk-assessment-progress-ring="true">
                <div
                  className="grid h-24 w-24 flex-shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(${progressColor} ${cappedProgress * 3.6}deg, #E8EEF8 0deg)`,
                  }}
                  aria-label={`Workflow progress ${cappedProgress}%`}
                >
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-white px-1 text-center" style={{ color: progressColor }}>
                    {/* Keep the full completion state inside the larger circular progress indicator. */}
                    <span className="text-[12px] font-bold leading-4">
                      {cappedProgress >= 100 ? "100% Complete" : `${cappedProgress}% In-Progress`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className={`mt-1 truncate text-[13px] font-bold ${label === "Risk Level" ? "text-[#AB5C00]" : "text-[#001B44]"}`}>
                {value}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// Keep guidance and completion progress beside the questionnaire on desktop and stacked on mobile.
function GuidanceCard({
  answeredQuestions,
  totalQuestions,
  actions,
}: {
  answeredQuestions: number;
  totalQuestions: number;
  actions?: ReactNode;
}) {
  return (
    <aside className="flex h-full flex-col gap-4">
      <section className="rounded-[8px] border border-[#D8E0ED] bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-[#0C233C]">Guidance</h3>
          <HelpCircle className="h-4 w-4 text-[#8492A6]" />
        </div>
        <p className="mb-4 text-[12px] leading-5 text-[#5A6478]">Answer each question based on the current state of controls for the selected asset.</p>
        <div className="space-y-3 rounded-[6px] border border-[#D8E8FF] bg-[#F8FBFF] p-3">
          {/* Keep questionnaire guidance aligned to the Yes/No/NA answer design. */}
          {["Provide accurate and factual responses.", "Select Yes, No, or NA for each question.", "You can save progress anytime and return later."].map((item) => (
            <div key={item} className="flex gap-2 text-[12px] leading-5 text-[#0C233C]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1E49E2]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <CompletionChecklist answeredQuestions={answeredQuestions} totalQuestions={totalQuestions} actions={actions} />
    </aside>
  );
}

// Escape fallback report text before placing it into a printable document.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Show generated reports in a focused popup so the main workflow page stays clean after generation.
function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  report,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  report: string | null;
}) {
  function handleDownloadPdf() {
    if (!report) return;

    // Open a browser print document so users can save the generated report as a PDF file locally.
    const renderedReport = document.getElementById("risk-assessment-report-print-content")?.innerHTML;
    const reportBody = renderedReport || `<pre>${escapeHtml(report)}</pre>`;
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(title)} - Risk Assessment Report</title>
          <style>
            @page { margin: 18mm; }
            body { font-family: Arial, sans-serif; color: #0C233C; line-height: 1.55; }
            h1, h2, h3 { color: #0C233C; page-break-after: avoid; }
            h1 { font-size: 28px; }
            h2 { margin-top: 28px; font-size: 20px; }
            h3 { margin-top: 22px; font-size: 16px; }
            p, li { font-size: 12px; color: #344563; }
            table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11px; }
            th, td { border: 1px solid #D8E0ED; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #F7F9FC; color: #00338D; text-transform: uppercase; letter-spacing: 0.08em; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12px; color: #344563; }
            .report-cover { border-bottom: 2px solid #1E49E2; margin-bottom: 24px; padding-bottom: 16px; }
            .eyebrow { color: #00338D; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <section class="report-cover">
            <div class="eyebrow">Risk Assessment Report</div>
            <h1>${escapeHtml(title)}</h1>
          </section>
          ${reportBody}
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[1040px] overflow-hidden rounded-[24px] border border-[#DCE3EE] bg-white p-0 shadow-[0_30px_80px_-44px_rgba(12,35,60,0.58)]">
        <DialogHeader className="bg-[linear-gradient(135deg,#0C233C_0%,#163B67_58%,#1E49E2_100%)] px-6 py-6 text-left text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/46">Generated Output</p>
              <DialogTitle className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-white">
                Risk Assessment Report
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[720px] text-[14px] leading-7 text-white/66">
                Review the generated report in a focused preview without replacing the main assessment workflow.
              </DialogDescription>
            </div>
            {/* Keep the PDF action visible at the top of the report popup instead of hiding it below long report content. */}
            <button
              className="inline-flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-bold text-[#1E49E2] shadow-sm transition-colors hover:bg-[#EEF2FF] disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-[#7E91AE] sm:w-auto"
              onClick={handleDownloadPdf}
              disabled={!report}
              data-risk-assessment-report-download="true"
            >
              <Download className="h-4 w-4" />
              Print PDF
            </button>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(88vh-180px)] overflow-y-auto px-6 py-6" data-risk-assessment-report-preview="true">
          <div className="mb-5 border-b border-[#E2E6EF] pb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#00338D]">Formatted Report</p>
            <h3 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#0C233C]">{title}</h3>
          </div>
          {report ? (
            <div
              id="risk-assessment-report-print-content"
              className="prose prose-sm max-w-none text-[#4D6485] [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:tracking-[-0.03em] [&_h1]:text-[#0C233C] [&_h2]:mt-8 [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_h2]:text-[#0C233C] [&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:text-[#0C233C] [&_li]:leading-7 [&_p]:leading-7 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#E2E6EF] [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-[#E2E6EF] [&_th]:bg-[#F7F9FC] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.18em] [&_th]:text-[#7E91AE]"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
              The report is still being prepared.
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[#E2E6EF] bg-[#FBFCFE] px-6 py-4">
          <button className={SECONDARY_BUTTON} onClick={() => onOpenChange(false)}>
            Close Preview
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const isCreatePage = isCreateRoute(location);
  const routeAssessmentId = assessmentIdFromLocation(location);

  const [wizardStep, setWizardStep] = useState(0);
  const [showCreate, setShowCreate] = useState(isCreatePage);
  const [form, setForm] = useState<CreateAssessmentFormState>({
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
    if (isCreatePage || !routeAssessmentId) return;
    const routeAssessment = assessments.find((assessment) => assessment.id === routeAssessmentId);
    if (!routeAssessment) return;

    setShowCreate(false);
    if (selectedAssessment?.id !== routeAssessment.id) {
      selectAssessment(routeAssessment);
      setQaAssetIdx(0);
      setExpandedSection(sections[0]?.id ?? null);
    }

    const slug = workflowSlugFromLocation(location);
    const routeStep = slug ? WORKFLOW_STEP_BY_SLUG[slug] : null;
    const nextStep = routeStep?.targetStep ?? statusToStep(routeAssessment.status);
    if (wizardStep !== nextStep) {
      setWizardStep(nextStep);
    }
  }, [
    assessments,
    isCreatePage,
    location,
    routeAssessmentId,
    sections,
    selectAssessment,
    selectedAssessment?.id,
    wizardStep,
  ]);

  useEffect(() => {
    if (isCreatePage || routeAssessmentId || selectedAssessment || assessments.length === 0) return;
    const slug = workflowSlugFromLocation(location);
    if (!slug) return;
    const storedAssessmentId = window.localStorage.getItem(SELECTED_ASSESSMENT_STORAGE_KEY);
    const storedAssessment = assessments.find((assessment) => assessment.id === storedAssessmentId);
    if (!storedAssessment) return;

    selectAssessment(storedAssessment);
    setShowCreate(false);
    setQaAssetIdx(0);
    setExpandedSection(sections[0]?.id ?? null);

    const routeStep = WORKFLOW_STEP_BY_SLUG[slug];
    setWizardStep(routeStep?.targetStep ?? statusToStep(storedAssessment.status));
  }, [
    assessments,
    isCreatePage,
    location,
    routeAssessmentId,
    sections,
    selectAssessment,
    selectedAssessment,
  ]);

  useEffect(() => {
    if (selectedAssessment) {
      window.localStorage.setItem(SELECTED_ASSESSMENT_STORAGE_KEY, selectedAssessment.id);
    }
  }, [selectedAssessment]);

  useEffect(() => {
    const pathname = location.split("?")[0] ?? "";
    if (pathname !== "/risk-assessment" || isCreatePage || showCreate || !selectedAssessment) return;
    window.localStorage.removeItem(SELECTED_ASSESSMENT_STORAGE_KEY);
    selectAssessment(null);
    setWizardStep(0);
    setQaAssetIdx(0);
    setExpandedSection(sections[0]?.id ?? null);
  }, [isCreatePage, location, sections, selectAssessment, selectedAssessment, showCreate]);

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
    Questionnaire: hasRisksIdentified,
    "Risk Review": hasFindingsReady,
    Findings: hasReportPrerequisites,
    "Final Report": Boolean(currentReport || selectedAssessment?.status === "complete"),
  };
  const disabledWorkflowSteps: Record<WorkflowStepLabel, boolean> = {
    Create: false,
    Assets: false,
    Questionnaire: false,
    "Risk Review": !hasRisksIdentified,
    Findings: !hasFindingsReady,
    "Final Report": !hasReportPrerequisites,
  };

  function navigateWorkflowStep(label: WorkflowStepLabel, pushHistory = true) {
    if (label === "Create") {
      openCreate();
      return;
    }
    if (!selectedAssessment) return;
    const nextStep = WORKFLOW_STEP_BY_LABEL[label].targetStep;
    if (nextStep > 1 && !isQuestionnaireComplete()) {
      showQuestionnaireIncompleteToast();
      setWizardStep(1);
      if (pushHistory) {
        setLocation(workflowPathForAssessment(selectedAssessment.id, "Questionnaire"));
      }
      return;
    }
    setShowCreate(false);
    if (label === "Questionnaire") {
      setQaAssetIdx(0);
      setExpandedSection(sections[0]?.id ?? null);
    }
    if (label === "Final Report" && disabledWorkflowSteps[label]) {
      toast({
        title: "Report not ready",
        description: "Generate the final report before opening the audit output.",
      });
      return;
    }
    setWizardStep(nextStep);
    if (pushHistory) {
      setLocation(workflowPathForAssessment(selectedAssessment?.id, label));
    }
  }

  function handleWorkflowStepOpen(label: WorkflowStepLabel, targetStep: number) {
    if (targetStep > 1 && !isQuestionnaireComplete()) {
      showQuestionnaireIncompleteToast();
      setWizardStep(1);
      return false;
    }
    setShowCreate(false);
    if (label === "Questionnaire") {
      setQaAssetIdx(0);
      setExpandedSection(sections[0]?.id ?? null);
    }
    setWizardStep(targetStep);
    return true;
  }

  function handleBlockedFinalReport() {
    toast({
      title: "Report not ready",
      description: "Generate the final report before opening the audit output.",
    });
  }

  useEffect(() => {
    if (!selectedAssessment || showCreate || isCreatePage) return;
    const slug = workflowSlugFromLocation(location);
    if (!slug) return;
    const step = WORKFLOW_STEP_BY_SLUG[slug];
    if (!step) return;
    if (step.targetStep > 1 && !isQuestionnaireComplete()) {
      showQuestionnaireIncompleteToast();
      setLocation(workflowPathForAssessment(selectedAssessment.id, "Questionnaire"));
      setWizardStep(1);
      setExpandedSection(sections[0]?.id ?? null);
      return;
    }
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

  function answeredCount(assetId: string) {
    return sections.reduce((count, section) => {
      const answeredInSection = section.questions.filter((question) =>
        isQuestionAnswered(assetId, section.id, question.id),
      ).length;
      return count + answeredInSection;
    }, 0);
  }

  function isQuestionAnswered(assetId: string, sectionId: string, questionId: string) {
    const localAnswer = answers[assetId]?.[sectionId]?.[questionId]?.answer;
    if (localAnswer) return true;
    return Boolean(
      selectedAssessment?.responses.some(
        (response) =>
          response.asset_id === assetId &&
          response.section_id === sectionId &&
          response.question_id === questionId &&
          Boolean(response.answer),
      ),
    );
  }

  function findFirstIncompleteQuestion() {
    if (!selectedAssessment || sections.length === 0) return null;
    for (let assetIndex = 0; assetIndex < selectedAssessment.asset_ids.length; assetIndex += 1) {
      const assetId = selectedAssessment.asset_ids[assetIndex];
      for (const section of sections) {
        for (const question of section.questions) {
          if (!isQuestionAnswered(assetId, section.id, question.id)) {
            return { assetIndex, assetId, sectionId: section.id };
          }
        }
      }
    }
    return null;
  }

  function isQuestionnaireComplete() {
    if (!selectedAssessment || selectedAssessment.asset_ids.length === 0 || sections.length === 0) return false;
    return findFirstIncompleteQuestion() === null;
  }

  function showQuestionnaireIncompleteToast() {
    const firstIncomplete = findFirstIncompleteQuestion();
    if (firstIncomplete) {
      setQaAssetIdx(firstIncomplete.assetIndex);
      setExpandedSection(firstIncomplete.sectionId);
    }
    toast({
      title: "Complete questionnaire first",
      description: "Answer every question for each application before moving to the next workflow step.",
      variant: "destructive",
    });
  }

  async function handleCreate() {
    if (!form.title.trim() || (form.selectedAssetIds.length === 0 && adHocApps.length === 0)) {
      toast({ title: "Title and at least one application required", variant: "destructive" });
      return;
    }
    const normalizedTitle = form.title.trim().toLowerCase();
    const duplicateAssessment = assessments.find((assessment) => assessment.title.trim().toLowerCase() === normalizedTitle);
    if (duplicateAssessment) {
      toast({
        title: "Assessment name already exists",
        description: "Use a unique assessment name to avoid duplicate sessions.",
        variant: "destructive",
      });
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
      setLocation(workflowPathForAssessment(assessment.id, "Assets"));
      setWizardStep(statusToStep(assessment.status));
      setQaAssetIdx(0);
      setExpandedSection(sections[0]?.id ?? null);
      resetCreateState();
      toast({ title: "Assessment created" });
    } catch {
      toast({ title: "Failed to create assessment", variant: "destructive" });
    }
  }

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

  async function handleSubmitQa() {
    if (!selectedAssessment || !currentAssetId) return;
    if (answeredCount(currentAssetId) < currentTotalQuestions) {
      const firstIncomplete = findFirstIncompleteQuestion();
      if (firstIncomplete?.assetId === currentAssetId) {
        setExpandedSection(firstIncomplete.sectionId);
      }
      toast({
        title: "Answer all questions",
        description: "Complete every question for this application before continuing.",
        variant: "destructive",
      });
      return;
    }
    setSubmittingQa(true);

    try {
      const responses = sections.flatMap((section) =>
        section.questions.map((question) => {
          const local = answers[currentAssetId]?.[section.id]?.[question.id];
          const saved = selectedAssessment.responses.find(
            (response) =>
              response.asset_id === currentAssetId &&
              response.section_id === section.id &&
              response.question_id === question.id,
          );
          return {
            asset_id: currentAssetId,
            section_id: section.id,
            question_id: question.id,
            answer: (local?.answer ?? saved?.answer) as AnswerType,
            details: local?.details ?? saved?.details ?? "",
          };
        }),
      );

      await submitResponseBatch(selectedAssessment.id, responses);

      if (qaAssetIdx < selectedAssessment.asset_ids.length - 1) {
        setQaAssetIdx((prev) => prev + 1);
        setExpandedSection(sections[0]?.id ?? null);
        toast({ title: "Responses saved for this application" });
      } else {
        setLocation(workflowPathForAssessment(selectedAssessment.id, "Risk Review"));
        setWizardStep(2);
        toast({ title: "All responses submitted. Starting analysis." });
      }
    } catch {
      toast({ title: "Failed to save responses", variant: "destructive" });
    } finally {
      setSubmittingQa(false);
    }
  }

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

  function openCreate() {
    // Route the create icon to the dedicated create URL while showing the existing setup dialog.
    setLocation(workflowPathForAssessment(null, "Create"));
    setShowCreate(true);
    selectAssessment(null);
    setWizardStep(0);
  }

  function closeCreate() {
    // Return to the Risk Assessment landing workspace when the popup closes.
    setLocation("/risk-assessment");
    setShowCreate(false);
    resetCreateState();
  }

  function selectExistingAssessment(assessment: RiskAssessment) {
    setShowCreate(false);
    selectAssessment(assessment);
    const nextStep = statusToStep(assessment.status);
    const nextLabel = workflowLabelForAssessmentStatus(assessment.status);
    setLocation(workflowPathForAssessment(assessment.id, nextLabel));
    setWizardStep(nextStep);
    setQaAssetIdx(0);
    setExpandedSection(sections[0]?.id ?? null);
  }

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
          <RiskAssessmentOverview
            activeAssessments={activeAssessments}
            highCriticalRisks={highCriticalRisks}
            drafts={draftAssessments}
            totalAssessments={assessments.length}
            totalRisks={allRisks.length}
            assetCount={assets.length}
          />
        ) : null}

        <div className="min-w-0 space-y-6">
            {!selectedAssessment ? (
              <RiskAssessmentWorkspace primaryButtonClassName={PRIMARY_BUTTON} onCreate={openCreate}>
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
                      onCreate={openCreate}
                      onOpen={selectExistingAssessment}
                      onDelete={(assessment) => void handleDeleteAssessment(assessment)}
                    />
                  </div>

                  <GuidanceCard answeredQuestions={0} totalQuestions={sections.reduce((acc, section) => acc + section.questions.length, 0) || 12} />
                </div>
              </RiskAssessmentWorkspace>
            ) : null}
            {showCreate ? (
              <CreateAssessmentPage
                open={showCreate}
                form={form}
                assets={assets}
                adHocApps={adHocApps}
                adHocDraft={adHocDraft}
                showAdHocForm={showAdHocForm}
                primaryButtonClassName={PRIMARY_BUTTON}
                softButtonClassName={SOFT_BUTTON}
                onOpenChange={(open) => (open ? setShowCreate(true) : closeCreate())}
                onFormChange={setForm}
                onAdHocAppsChange={setAdHocApps}
                onAdHocDraftChange={setAdHocDraft}
                onShowAdHocFormChange={setShowAdHocForm}
                onAddAdHoc={handleAddAdHoc}
                onCancel={closeCreate}
                onSaveDraft={() => toast({ title: "Draft retained", description: "Your entries are still available in this create form." })}
                onCreate={() => void handleCreate()}
              />
            ) : null}

            {selectedAssessment && !showCreate ? (
              <div ref={workflowContentRef}>
                <RiskAssessmentWorkspace
                  primaryButtonClassName={PRIMARY_BUTTON}
                  onCreate={openCreate}
                  showCreateButton={false}
                >
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
                    selectedAssessmentId={selectedAssessment.id}
                    onCreate={openCreate}
                    onStepOpen={handleWorkflowStepOpen}
                    onBlockedFinalReport={handleBlockedFinalReport}
                  />
                </RiskAssessmentWorkspace>

                {wizardStep === 0 ? (
                  <AssessmentSummaryForm
                    assessment={selectedAssessment}
                    primaryButtonClassName={PRIMARY_BUTTON}
                    assetName={assetName}
                    onStartQuestionnaire={() => navigateWorkflowStep("Questionnaire")}
                  />
                ) : null}

                {wizardStep === 1 ? (
                  <QuestionnaireForm
                    assessment={selectedAssessment}
                    sections={sections}
                    answers={answers}
                    currentAssetId={currentAssetId}
                    currentAnsweredCount={currentAnsweredCount}
                    currentTotalQuestions={currentTotalQuestions}
                    expandedSection={expandedSection}
                    submittingQa={submittingQa}
                    primaryButtonClassName={PRIMARY_BUTTON}
                    secondaryButtonClassName={SECONDARY_BUTTON}
                    onExpandedSectionChange={setExpandedSection}
                    onAnswer={setAnswer}
                    onSaveProgress={() => toast({ title: "Progress saved" })}
                    onContinue={() => void handleSubmitQa()}
                  />
                ) : null}

                {wizardStep === 2 ? (
                  <SurfaceSection eyebrow="Analysis" title="Running Risk Analysis" data-risk-assessment-analysis="true">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                      <div className="risk-identify-glass-panel rounded-[22px] border px-8 py-10 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F0FF] text-[#7213EA]">
                          <Sparkles className="h-8 w-8 animate-pulse" />
                        </div>
                        <h3 className="mt-5 text-[24px] font-bold tracking-[-0.03em] text-[#0C233C]">
                          Scoring Inherent Risk Across Selected Applications
                        </h3>
                        <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-7 text-[#7388A8]">
                          Applying rule-based scoring and the current risk assessment analysis flow to turn questionnaire responses into structured risk candidates.
                        </p>
                        <div className="mx-auto mt-7 max-w-[420px] overflow-hidden rounded-full bg-[#DCE3EE]">
                          <div className="h-3 w-[58%] rounded-full bg-[linear-gradient(90deg,#1E49E2_0%,#00B8F5_100%)]" />
                        </div>
                        <div className="mt-5 flex items-center justify-center gap-2 text-[13px] font-bold text-[#1E49E2]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analysis in progress
                        </div>
                      </div>

                      <TracePanel
                        title="Current Run"
                        subtitle="The page remains inside Risk Assessment while analysis completes."
                        className="risk-identify-glass-panel risk-identify-run-panel"
                      >
                        <div className="space-y-3">
                          {[
                            ["Responses validated", "Done", "done"],
                            ["Exposure patterns grouped", "Running", "running"],
                            ["Draft risks generated", "Queued", "queued"],
                            ["Bands assigned", "Queued", "queued"],
                          ].map(([label, state, tone]) => (
                            <div key={label} className="flex items-center justify-between rounded-[16px] bg-[#F7F9FC] px-4 py-3">
                              <span className="text-[13px] font-medium text-[#0C233C]">{label}</span>
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${
                                  tone === "done"
                                    ? "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]"
                                    : tone === "running"
                                      ? "border-[#C9D7FF] bg-[#EEF2FF] text-[#1E49E2]"
                                      : "border-[#DCE3EE] bg-white text-[#6A748A]"
                                }`}
                              >
                                {state}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TracePanel>
                    </div>
                  </SurfaceSection>
                ) : null}

                {wizardStep === 3 ? (
                  <SurfaceSection
                    eyebrow="Risks"
                    title={`Identified Risks (${selectedAssessment.risks.length})`}
                    action={
                      <button className={PRIMARY_BUTTON} onClick={() => navigateWorkflowStep("Findings")} data-risk-assessment-risks="true">
                        Apply Controls
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    }
                  >
                    {selectedAssessment.risks.length > 0 ? (
                      <div className="risk-identified-glass-list grid gap-4 rounded-[22px] border p-4">
                        {selectedAssessment.risks.map((risk) => (
                          <RiskSummaryCard key={risk.id} risk={risk} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
                        No risks have been identified for this assessment yet.
                      </div>
                    )}
                  </SurfaceSection>
                ) : null}

                {wizardStep === 4 ? (
                  <SurfaceSection
                    eyebrow="Controls"
                    title="Apply Controls To Risks"
                    action={
                      <div className="flex flex-wrap gap-2" data-risk-assessment-controls="true">
                        <button
                          className={SOFT_BUTTON}
                          onClick={() =>
                            void suggestControls(selectedAssessment.id)
                              .then(() => toast({ title: "Suggestions refreshed" }))
                              .catch(() => toast({ title: "Failed to refresh suggestions", variant: "destructive" }))
                          }
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh Suggestions
                        </button>
                        <button
                          className={PRIMARY_BUTTON}
                          onClick={() => {
                            setLocation(workflowPathForAssessment(selectedAssessment.id, "Findings"));
                            setWizardStep(5);
                          }}
                        >
                          Calculate Residual
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    }
                  >
                    {selectedAssessment.risks.length > 0 ? (
                      <div className="risk-controls-glass-stage space-y-5 rounded-[22px] border p-4">
                        {selectedAssessment.risks.map((risk) => {
                          const suggestions = (selectedAssessment.suggested_controls ?? []).filter(
                            (suggestion) => suggestion.risk_id === risk.id,
                          );
                          const applied = selectedAssessment.applied_controls.filter((control) => control.risk_id === risk.id);
                          return (
                            <TracePanel
                              key={risk.id}
                              title={risk.title}
                              subtitle={risk.description}
                              className="risk-controls-risk-panel"
                            >
                              <div className="mb-4 flex flex-wrap items-center gap-2">
                                <BandBadge band={risk.inherent_risk_band} />
                                <span className="text-[12px] text-[#7388A8]">
                                  {applied.length} applied · {suggestions.length} suggested
                                </span>
                              </div>

                              {applied.length > 0 ? (
                                <div className="mb-4">
                                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7E91AE]">
                                    Applied Controls
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {applied.map((control) => (
                                      <AppliedControlChip key={control.id} label={control.control_id} />
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <div className="space-y-3">
                                {suggestions.length > 0 ? (
                                  suggestions.map((suggestion) => (
                                    <SuggestedControlRow
                                      key={`${risk.id}-${suggestion.control_id}`}
                                      suggestion={suggestion}
                                      alreadyApplied={applied.some((control) => control.control_id === suggestion.control_id)}
                                      onApply={() => handleApplySuggestion(risk.id, suggestion)}
                                    />
                                  ))
                                ) : (
                                  <div className="rounded-[16px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-6 text-[13px] text-[#7388A8]">
                                    Loading suggestions or no control suggestions are available yet.
                                  </div>
                                )}
                              </div>
                            </TracePanel>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
                        No risks are available for control application.
                      </div>
                    )}
                  </SurfaceSection>
                ) : null}

                {wizardStep === 5 ? (
                  <SurfaceSection
                    eyebrow="Residual"
                    title="Residual Risk Review"
                    action={
                      <div className="flex flex-wrap gap-2" data-risk-assessment-residual="true">
                        <button className={SOFT_BUTTON} onClick={() => void fetchResidual(selectedAssessment.id)}>
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </button>
                        <button className={PRIMARY_BUTTON} onClick={() => navigateWorkflowStep("Final Report")}>
                          Generate Report
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    }
                  >
                    {residualResults.length > 0 ? (
                      <div className="risk-residual-glass-stage grid gap-4 rounded-[22px] border p-4 lg:grid-cols-2">
                        {residualResults.map((result) => (
                          <ResidualCard key={result.risk_id} result={result} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-10 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-[#7E91AE]" />
                        <p className="text-[13px] text-[#7388A8]">Calculating residual risk.</p>
                      </div>
                    )}
                  </SurfaceSection>
                ) : null}

                {wizardStep === 6 ? (
                  <SurfaceSection
                    eyebrow="Report"
                    title="Risk Assessment Report"
                    action={
                      <div className="flex flex-col gap-3 sm:flex-row">
                        {/* Let users leave the active workflow and return to the recent assessments workspace. */}
                        <button
                          className={SECONDARY_BUTTON}
                          onClick={() => {
                            setLocation("/risk-assessment");
                            setShowCreate(false);
                            selectAssessment(null);
                            setWizardStep(0);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className={PRIMARY_BUTTON}
                          onClick={() => void handleGenerateReport()}
                          disabled={isGeneratingReport}
                          data-risk-assessment-report="true"
                        >
                          {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
                          Generate Report
                        </button>
                      </div>
                    }
                  >
                    {/* Keep the generated report out of the main page and launch it through the animated preview dialog. */}
                    <div className="risk-report-glass-box rounded-[18px] border px-4 py-8 text-center text-[13px] leading-6">
                      <FileBarChart className="mx-auto mb-3 h-8 w-8 text-[#1E49E2]" />
                      <p>
                        {currentReport
                          ? "The report is ready. Open the preview popup to review the formatted output."
                          : "Generate the report to open the formatted assessment output in a preview popup."}
                      </p>
                      {currentReport ? (
                        <button className="risk-view-report-glass-button mt-5" onClick={() => setShowReportDialog(true)}>
                          View Report
                        </button>
                      ) : null}
                    </div>
                  </SurfaceSection>
                ) : null}

                <ReportPreviewDialog
                  open={showReportDialog}
                  onOpenChange={setShowReportDialog}
                  title={selectedAssessment.title}
                  report={currentReport}
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
