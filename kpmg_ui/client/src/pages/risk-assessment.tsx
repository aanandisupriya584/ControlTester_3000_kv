import {useEffect, useMemo, useRef, useState} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from 'framer-motion';
import StatusCard from '../../src/components/custom_ui/cards/StatusCard.tsx';
import {
  ArrowRight,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  ClipboardCheck,
  Database,
  Download,
  FileBarChart,
  HelpCircle,
  Lightbulb,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SearchCheck,
  Trash2,
  type LucideIcon, NotepadText, Layers, ChartSpline, MoveDownRight,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CiaRatingWidget from "@/components/CiaRatingWidget";
import RiskAssessmentWorkspace from "@/pages/RiskAssessment/components/RiskAssessmentWorkspace";
import ApplyControlToRiskPage from "@/pages/RiskAssessment/components/workflow/ApplyControlToRiskPage";
import IdentifyRiskPage from "@/pages/RiskAssessment/components/workflow/IdentifyRiskPage";
import RiskAssessmentReport from "@/pages/RiskAssessment/components/workflow/RiskAssessmentReport";
// import RiskAssessmentStyles from "@/pages/RiskAssessment/components/RiskAssessmentStyles";
import { useToast } from "@/hooks/use-toast";
import { useAssetRegistry } from "@/contexts/AssetRegistryContext";
import {
  type AdHocApplication,
  type AnswerType,
  type ResidualResult,
  type Risk,
  type RiskAssessment,
  type Section,
  type SuggestedControl,
  useRiskAssessment,
} from "@/contexts/RiskAssessmentContext";
import HeroSubSection from "@/components/HeroSubSection.tsx";
import AssessmentProcess from "../components/ui/AssessmentProcess.tsx";
import RecentActivity from "@/pages/RiskAssessment/RecentActivity.tsx";
import RiskDistribution from "@/pages/RiskAssessment/RiskDistribution.tsx";
import RiskHeatMap from "@/pages/RiskAssessment/RiskHeatMap.tsx";
import RiskReport from "@/pages/RiskAssessment/RiskReport.tsx";
import RecentRiskTable, { Assessment } from "@/pages/RiskAssessment/RecentRiskTable.tsx";
import {
  AssessmentTableRow,
  buildHeatMapData,
  mapAssessmentsToTableData, processRiskDistribution, processRiskHeatmapData
} from "@/pages/RiskAssessment/helper/HelperFn.tsx";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  risks_identified: "Risks Identified",
  controls_applied: "Controls Applied",
  complete: "Complete",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "border-[#DCE3EE] bg-[#F3F6FA] text-[#6A748A]",
  in_progress: "border-[#C9D7FF] bg-[#EEF2FF] text-[#1E49E2]",
  risks_identified: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  controls_applied: "border-[#D7C0FA] bg-[#F3F0FF] text-[#7213EA]",
  complete: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
};

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

// Mirror the reference workflow labels so the progress rail matches the requested UI.
const WIZARD_STEPS = ["Create", "Assets", "Questionnaire", "Risk Review", "Findings", "Final Report"];
const WORKFLOW_PROGRESS_STEP_COUNT = 6;
const WORKFLOW_STEP_CONFIG = [
  { label: "Create", slug: "create", targetStep: 0 },
  { label: "Assets", slug: "assets", targetStep: 0 },
  { label: "Questionnaire", slug: "questionnaire", targetStep: 1 },
  { label: "Risk Review", slug: "risk-review", targetStep: 3 },
  { label: "Findings", slug: "findings", targetStep: 4 },
  { label: "Final Report", slug: "final-report", targetStep: 6 },
] as const;
type WorkflowStepLabel = (typeof WORKFLOW_STEP_CONFIG)[number]["label"];

const WORKFLOW_STEP_BY_LABEL = WORKFLOW_STEP_CONFIG.reduce(
  (acc, step) => ({ ...acc, [step.label]: step }),
  {} as Record<WorkflowStepLabel, (typeof WORKFLOW_STEP_CONFIG)[number]>,
);
const WORKFLOW_STEP_BY_SLUG = WORKFLOW_STEP_CONFIG.reduce(
  (acc, step) => ({ ...acc, [step.slug]: step }),
  {} as Record<string, (typeof WORKFLOW_STEP_CONFIG)[number]>,
);

function workflowSlugFromLocation(location: string) {
  const query = location.split("?")[1] ?? "";
  return new URLSearchParams(query).get("step");
}

function workflowLabelFromWizardStep(wizardStep: number, location: string): WorkflowStepLabel {
  const slug = workflowSlugFromLocation(location);
  const urlStep = slug ? WORKFLOW_STEP_BY_SLUG[slug] : null;
  if (urlStep && urlStep.targetStep === wizardStep) return urlStep.label;
  if (wizardStep === 0) return "Assets";
  if (wizardStep === 1) return "Questionnaire";
  if (wizardStep === 3) return "Risk Review";
  if (wizardStep === 4 || wizardStep === 5) return "Findings";
  if (wizardStep === 6) return "Final Report";
  return "Risk Review";
}

// Give each workflow step a compatible icon and hover summary so the rail explains itself without extra page text.
const WORKFLOW_STEP_DETAILS: Record<string, { Icon: LucideIcon; summary: string }> = {
  Create: { Icon: CirclePlus, summary: "Create the assessment session and define the initial scope." },
  Assets: { Icon: Database, summary: "Confirm registry and ad hoc applications included in the assessment." },
  Questionnaire: { Icon: ClipboardCheck, summary: "Answer each control and risk question for selected applications." },
  "Risk Review": { Icon: ShieldAlert, summary: "Review inherent risks identified from questionnaire responses." },
  Findings: { Icon: SearchCheck, summary: "Review findings and control suggestions before residual scoring." },
  "Final Report": { Icon: FileBarChart, summary: "Generate and preview the formatted risk assessment report." },
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

// interface AssessmentTableRow {
//   id: string;
//   name: string;
//   application: string;
//   status: 'Draft' | 'In Progress' | 'Review' | 'Completed';
//   riskScore: 'Low' | 'Medium' | 'High';
//   lastUpdated: string;
//   owner: string;
// }

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

function formatDate(value?: string | null) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function assessmentAppCount(assessment: RiskAssessment) {
  return assessment.asset_ids.length + (assessment.ad_hoc_applications?.length ?? 0);
}

function statusToneTitle(assessment: RiskAssessment | null) {
  if (!assessment) return "Ready To Begin";
  return STATUS_LABELS[assessment.status] ?? "Assessment Selected";
}

function sectionProgress(
  answers: Record<string, Record<string, Record<string, LocalAnswer>>>,
  assetId: string,
  section: Section,
) {
  return Object.values(answers[assetId]?.[section.id] ?? {}).length;
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
// const mapAssessmentsToTableData = (
//     assessments: any[]
// ): AssessmentTableRow[] => {
//   return assessments.map((assessment) => {
//     const risks = assessment.risks || [];
//
//     const highestRisk =
//         risks.length > 0
//             ? risks.reduce(
//                 (max:any, risk:any) =>
//                     risk.inherent_risk_score > max.inherent_risk_score ? risk : max,
//                 risks[0]
//             )
//             : null;
//
//     const riskBand =
//         highestRisk?.inherent_risk_band?.toLowerCase() || 'low';
//
//     return {
//       id: assessment.id,
//
//       // Assessment Name
//       name: assessment.title || 'Untitled Assessment',
//
//       // Number of applications/assets
//       application: `${assessment.asset_ids?.length || 0} Application(s)`,
//
//       // Status mapping
//       status:
//           assessment.status === 'draft'
//               ? 'Draft'
//               : assessment.status === 'complete'
//                   ? 'Completed'
//                   : assessment.status === 'review'
//                       ? 'Review'
//                       : 'In Progress',
//
//       // Highest risk found in assessment
//       riskScore:
//           riskBand === 'high'
//               ? 'High'
//               : riskBand === 'medium'
//                   ? 'Medium'
//                   : 'Low',
//
//       // Last updated
//       lastUpdated: new Date(
//           assessment.updated_at
//       ).toLocaleDateString(),
//
//       // Owner not available in API
//       owner: '-'
//     };
//   });
// };

function StepPill({
  label,
  index,
  active,
  complete,
  disabled,
  onSelect,
}: {
  label: WorkflowStepLabel;
  index: number;
  active: boolean;
  complete: boolean;
  disabled: boolean;
  onSelect?: (label: WorkflowStepLabel) => void;
}) {
  const nextStepComplete = complete;
  const { Icon, summary } = WORKFLOW_STEP_DETAILS[label] ?? WORKFLOW_STEP_DETAILS.Create;
  const StepIcon = complete ? CheckCircle2 : Icon;
  const className = active
    ? "border-white bg-[#00B8F5] text-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)]"
    : complete
      ? "border-[#00C853] bg-white text-[#009A44] shadow-[0_0_0_4px_rgba(255,255,255,0.16)]"
      : disabled
        ? "border-white/20 bg-white/8 text-white/35"
        : "border-white/45 bg-white/12 text-white/78";
  const labelClass = active || complete ? "text-white" : disabled ? "text-white/35" : "text-white/68";

  return (
    <div
      className="relative flex min-w-[96px] flex-1 flex-col items-center gap-2 text-center"
      data-risk-assessment-step={label.toLowerCase()}
    >
      {/* Stack each step label below its circle so the stepper matches the requested icon-first layout. */}
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Make each workflow step a real navigation button while keeping the tooltip summary. */}
          <button
            type="button"
            role="tab"
            onClick={() => onSelect?.(label)}
            className={`relative z-10 flex min-w-0 flex-col items-center gap-2 rounded-[8px] px-1 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#AFC1F8] ${
              disabled ? "cursor-pointer opacity-70 hover:-translate-y-0.5" : "cursor-pointer hover:-translate-y-0.5"
            }`}
            data-risk-assessment-step-tooltip="true"
            aria-current={active ? "step" : undefined}
            aria-selected={active}
            aria-disabled={disabled}
          >
            {/* Completed steps switch to a tick mark so the workflow state is visible at a glance. */}
            <span
              className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-[12px] font-bold shadow-sm transition-all duration-200 ${
                disabled ? "" : "hover:scale-110 hover:shadow-[0_10px_22px_-14px_rgba(30,73,226,0.65)]"
              } ${className}`}
            >
              <StepIcon className="h-4 w-4" />
            </span>
            <span className={`max-w-[86px] text-[12px] font-semibold leading-4 ${labelClass}`}>{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] rounded-[10px] border border-[#D8E0ED] bg-white px-3 py-2 text-[#0C233C] shadow-[0_18px_42px_-28px_rgba(12,35,60,0.36)]">
          <p className="text-[12px] font-bold">{label}</p>
          <p className="mt-1 text-[11px] leading-5 text-[#5A6478]">{summary}</p>
        </TooltipContent>
      </Tooltip>
      {index < WIZARD_STEPS.length - 1 ? (
        // Keep connector lines visible on the dark workflow background; turn a segment green only after the next step is complete.
        <span
          className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[18px] h-0.5 rounded-full ${
            nextStepComplete || !disabled ? "bg-[#00C853]" : "bg-white/30"
          }`}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: RiskAssessment["status"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${STATUS_CLASS[status] ?? STATUS_CLASS.draft}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
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

function CommandDeckMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="min-h-[180px] rounded-[8px] border border-[#D6E0EF] bg-[#F8FAFD] px-4 py-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#50627F]">{label}</div>
      <div className="mt-5 text-[30px] font-bold tracking-[-0.04em] text-[#001B3A]">{value}</div>
      <div className="mt-4 text-[12px] leading-6 text-[#33415C]">{detail}</div>
    </div>
  );
}

// Show the requested three summary cards under How It Works so users see the same quick status boxes from the reference UI.
function RiskAssessmentFeatureCards({
  activeAssessments,
  highCriticalRisks,
  drafts,
  totalAssessments,
  totalRisks,
  // assetCount,
}: {
  activeAssessments: number;
  highCriticalRisks: number;
  drafts: number;
  totalAssessments: number;
  totalRisks: number;
  assetCount: number;
}) {
  const cards = [
    {
      label: "Active Assessments",//"ACTIVE ASSESSMENTS",
      value: activeAssessments,
      detail: "Sessions currently progressing",
      badgeCls:'mt-1 text-[45px] font-bold leading-none tracking-[-0.05em] text-[#001B3A]',
      badge: `${totalAssessments} added this week `,  //total sessions,
      accent: "#1E49E2",//"#00338D",
      badgeClassName: "bg-[#EDFBF5] text-[#009A44]",//"bg-[#EEF2FF] text-[#1E49E2]",
      icon:NotepadText,
      iconColor:"text-[#1E49E2]",
      iconBg:"#E1E5F5"
    },
    {
      label: "Drafts",//"DRAFTS",
      value: drafts,
      detail: "Waiting to begin questionnaire capture",
      badgeCls:'mt-1 text-[45px] font-bold leading-none tracking-[-0.05em] text-[#001B3A]',
      badge: `${totalAssessments} needs your attention`,  //asset registry applications available,
      accent: "#1E49E2",
      badgeClassName: "bg-[#FAF2DE] text-[#F5AD0A]",
      icon:FileText,
      iconColor:"text-[#5F5C61]",
      iconBg:"#E9E8EB"
    },
    {
      label: "High Risks",//"HIGH / CRITICAL RISKS",
      value: highCriticalRisks,
      detail: "Across all fetched assessments",
      badgeCls:'mt-1 text-[45px] font-bold leading-none tracking-[-0.05em] text-[#001B3A]',
      badge: `${totalRisks} Critical`,
      accent: "#00B8F5",
      badgeClassName: "bg-[#F7E4E5] text-[#E63946]",
      icon:ShieldAlert,
      iconColor:" text-[#E63946]",
      iconBg:"#F7E4E5"
    },
    {
      label: "Total Assessments",//"TOTAL ASSESSMENTS",
      value: activeAssessments,
      detail: "Includes active, & draft assessments",
      badgeCls:'mt-1 text-[45px] font-bold leading-none tracking-[-0.05em] text-[#001B3A]',
      badge: `${totalRisks} Across all assessments`,
      accent: "#ACEAFF",
      badgeClassName: "bg-[#E6DCF2] text-[#7213EA]",
      icon:Layers,
      iconColor:"text-[#7213EA]",
      iconBg:"#E6DCF2"
    },
    {
      label: "Avg Risk Score",//"TOTAL RISKS",
      value: "Medium",//totalRisks,
      detail: "Risks identified across all assessments",
      badgeCls:'mt-1 text-[20px] font-bold leading-none tracking-[-0.05em] text-[#FFBB1C]',
      badge: "Trending down",//`${totalRisks} total risks identified`,
      accent: "#7213EA",
      badgeClassName: "bg-[#EEF2FF] text-[#1E49E2]",
      icon:ChartSpline,
      iconColor:"text-[#1E49E2]",
      iconBg:"#EEF2FF"
    },
    // {
    //   label: "ASSET COUNT",
    //   value: assetCount,
    //   detail: "Total assets in scope across all assessments",
    //   badge: `${assetCount} total assets`,
    //   accent: "#0C233C",
    //   badgeClassName: "bg-[#EEF2FF] text-[#1E49E2]",
    // }
  ];

  return (
    <section className="mb-9 grid gap-5 md:grid-cols-5" data-risk-assessment-feature-cards="true">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative max-h-[150px] overflow-hidden rounded-[18px] border border-[#DCE3EE] bg-white px-6 py-7 shadow-sm"
        >
          {/*<div className="absolute left-0 right-0 top-0 h-1" style={{ background: card.accent }} />*/}
          <div style={{display:'flex', alignItems:'center', height:'60px'}}>
            <div style={{padding:'5px', borderRadius:"50%",background:card.iconBg}}>
             <card.icon className={card.iconColor}/> {/*<NotepadText color={"#1E49E2"} />*/}
            </div>
            <div style={{marginLeft:'5px'}}>
              <div className={"min-h-[30px] max-h-[45pxpx] "}>
                <p className="text-[13px] font-bold  leading-6 tracking-[0.1em] text-[#6D7EA8]">{/*uppercase*/}
                  {card.label}
                </p>
              </div>
              <div className={card.badgeCls}>{card.value}</div>

            </div>
          </div>

          <div style={{display:'flex', marginTop:'1rem'}}>

          {/*<p className="mt-4 max-w-[100%] text-[11px] leading-[1rem] text-[#5D6FA4]">{card.detail}</p>*/}
          <div  className={`mt-1 ml-4 inline-flex max-w-full rounded-full px-4 py-2 text-[9px] font-bold ${card.badgeClassName}`} >
            <span  className="break-words">{card.badge}</span> &nbsp; {card.badge === "Trending down" && <MoveDownRight size={"10px"} />}
          </div>
        </div>

        </div>
      ))}
    </section>
  );
}

function CompletionChecklist({
  totalQuestions,
  answeredQuestions,
  readyForReview,
  onSaveProgress,
  onContinue,
  continueDisabled,
  continueLabel = "Submit",
}: {
  totalQuestions: number;
  answeredQuestions: number;
  readyForReview: boolean;
  onSaveProgress?: () => void;
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
}) {
  // Keep completion tracking focused on Yes/No answers now that per-question notes are removed.
  const rows = [
    { label: "Questions answered", current: answeredQuestions, total: totalQuestions },
    { label: "Ready for risk review", current: readyForReview ? 1 : 0, total: 1 },
  ];

  const allComplete = answeredQuestions >= totalQuestions && totalQuestions > 0 && readyForReview;

  return (
    <div className="rounded-[24px] border border-[#DCE3EE] bg-white p-6 shadow-[0_18px_42px_-34px_rgba(12,35,60,0.26)]">
      <h2 className="mb-5 text-[22px] font-bold tracking-[-0.03em] text-[#0C233C]">Completion checklist</h2>

      <div className="space-y-5">
        {rows.map(({ label, current, total }) => {
          const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
          const done = current >= total && total > 0;
          const partial = current > 0 && !done;

          return (
            <div key={label}>
              <div className="mb-2 flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[#009A44]" />
                ) : partial ? (
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#F6D3A0] bg-[#FFF4E8]">
                    <span className="text-[10px] font-bold text-[#AB5C00]">!</span>
                  </div>
                ) : (
                  <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-[#DCE3EE]" />
                )}
                <span className="flex-1 text-[14px] font-medium text-[#0C233C]">{label}</span>
                <span className="text-[13px] font-bold text-[#7388A8]">{current}/{total}</span>
              </div>
              <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-[#E8EDF5]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    done ? "bg-[#009A44]" : partial ? "bg-[#EAAA00]" : "bg-[#E8EDF5]"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!allComplete ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-[14px] border border-[#E6D9A8] bg-[#FFFBEE] px-4 py-3">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8A6A00]" />
          <p className="text-[12px] leading-6 text-[#7A5E00]">
            Complete all questions to proceed to Risk Review.
          </p>
        </div>
      ) : null}

      {(onSaveProgress ?? onContinue) ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {onSaveProgress ? (
            <button className={SECONDARY_BUTTON} onClick={onSaveProgress}>
              <Save className="h-4 w-4" />
              Save
            </button>
          ) : null}
          {onContinue ? (
            <button className={PRIMARY_BUTTON} onClick={onContinue} disabled={continueDisabled}>
              {continueLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
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
  const riskLabel = assessment?.risks.some((risk) => risk.inherent_risk_band === "Critical" || risk.inherent_risk_band === "High")
    ? "Risk Level: High"
    : assessment?.risks.some((risk) => risk.inherent_risk_band === "Medium")
      ? "Risk Level: Medium"
      : "Risk Level: Low";

  return (
    <section className="border-b border-[#D8E0ED] bg-white" data-risk-assessment-context-strip="true">
      <div className="grid min-h-[156px] grid-cols-1 divide-y divide-[#DCE4F0] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-[1.2fr_1.1fr_1fr_1fr_1.15fr]">
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

// The stepper fills its container on desktop and scrolls only when smaller screens need extra room.
function WorkflowStepper({
  activeStep,
  completedSteps,
  disabledSteps,
  onStepSelect,
}: {
  activeStep: WorkflowStepLabel;
  completedSteps: Record<WorkflowStepLabel, boolean>;
  disabledSteps: Record<WorkflowStepLabel, boolean>;
  onStepSelect?: (label: WorkflowStepLabel) => void;
}) {
  return (
    // Put the workflow rail in its own card-like box so it reads as a separate workflow section.
    <section
      className="m-3 overflow-x-auto rounded-[8px] border border-[#1D5BA6] bg-[linear-gradient(135deg,#0C233C_0%,#00338D_58%,#1E49E2_100%)] px-4 py-4 shadow-[0_22px_46px_-30px_rgba(12,35,60,0.72)] ring-1 ring-white/35 sm:m-5 sm:px-5"
      data-risk-assessment-stepper="true"
      role="tablist"
      aria-label="Risk assessment workflow"
    >
      <div className="flex w-full min-w-[760px] gap-2 pb-1 pt-1">
        {WORKFLOW_STEP_CONFIG.map(({ label }, index) => (
          <StepPill
            key={label}
            label={label}
            index={index}
            active={label === activeStep}
            complete={completedSteps[label]}
            disabled={disabledSteps[label]}
            onSelect={onStepSelect}
          />
        ))}
      </div>
    </section>
  );
}

// Keep guidance and completion progress beside the questionnaire on desktop and stacked on mobile.
function GuidanceCard({
  answeredQuestions,
  totalQuestions,
}: {
  answeredQuestions: number;
  totalQuestions: number;
}) {
  const answerPct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  return (
    <aside className="space-y-4">
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

      <section className="rounded-[8px] border border-[#D8E0ED] bg-white p-5">
        <h3 className="mb-4 text-[15px] font-bold text-[#0C233C]">Completion checklist</h3>
        {[
          ["Questions answered", answeredQuestions, totalQuestions, "#009A44", answerPct],
          ["Ready for risk review", answeredQuestions >= totalQuestions && totalQuestions > 0 ? 1 : 0, 1, "#8492A6", answeredQuestions >= totalQuestions && totalQuestions > 0 ? 100 : 0],
        ].map(([label, current, total, color, pct]) => (
          <div key={String(label)} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {Number(pct) >= 100 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#009A44]" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-[#B4C1D6]" />
                )}
                <span className="text-[12px] font-semibold text-[#0C233C]">{label}</span>
              </div>
              <span className="text-[11px] font-bold text-[#6E7787]">{current} / {total}</span>
            </div>
            <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-[#E8EDF5]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: String(color) }} />
            </div>
          </div>
        ))}
        <div className="mt-5 rounded-[6px] border border-[#F6D3A0] bg-[#FFFBEE] p-3">
          <div className="flex gap-2 text-[12px] leading-5 text-[#7A5E00]">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Complete all questions to proceed to Risk Review.</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

function LandingAssessmentCard({
  assessment,
  onOpen,
}: {
  assessment: RiskAssessment;
  onOpen: () => void;
}) {
  const riskCount = assessment.risks.length;
  const highRiskCount = assessment.risks.filter(
    (risk) => risk.inherent_risk_band === "Critical" || risk.inherent_risk_band === "High",
  ).length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-[24px] border border-[#DCE3EE] bg-white p-5 text-left shadow-[0_18px_42px_-34px_rgba(12,35,60,0.28)] transition-all hover:-translate-y-1 hover:border-[#AFC1F8] hover:shadow-[0_24px_54px_-34px_rgba(12,35,60,0.38)]"
      data-risk-assessment-session={assessment.id}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8492A6]">
            {assessmentAppCount(assessment)} application{assessmentAppCount(assessment) === 1 ? "" : "s"}
          </p>
          <h3 className="line-clamp-2 text-[18px] font-bold tracking-[-0.03em] text-[#0C233C]">{assessment.title}</h3>
        </div>
        <StatusBadge status={assessment.status} />
      </div>

      <p className="line-clamp-3 flex-1 text-[13px] leading-6 text-[#5A6478]">
        {assessment.description || getAssessmentRiskSummary(assessment)}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-[16px] bg-[#F7F9FC] px-3 py-3">
          <div className="text-[18px] font-bold text-[#0C233C]">{riskCount}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8492A6]">Risks</div>
        </div>
        <div className="rounded-[16px] bg-[#FFF9E8] px-3 py-3">
          <div className="text-[18px] font-bold text-[#8A6A00]">{highRiskCount}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A6A00]">High</div>
        </div>
        <div className="rounded-[16px] bg-[#EDFBF5] px-3 py-3">
          <div className="text-[18px] font-bold text-[#009A44]">{assessment.applied_controls.length}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#009A44]">Controls</div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#E8EDF5] pt-4">
        <span className="text-[12px] font-semibold text-[#7388A8]">Updated {formatDate(assessment.updated_at)}</span>
        <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#1E49E2]">
          Open
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
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
  const isCreatePage = location === "/risk-assessment/new";

  const [wizardStep, setWizardStep] = useState(0);
  const [showCreate, setShowCreate] = useState(isCreatePage);
  const [form, setForm] = useState<{ title: string; description: string; selectedAssetIds: string[] }>({
    title: "",
    description: "",
    selectedAssetIds: [],
  });
  const sampleData: Assessment[] = [
    {
      id: '1',
      name: 'HRMS Risk Assessment',
      application: 'HRMS Application',
      status: 'Draft',
      riskScore: 'Medium',
      lastUpdated: 'May 14, 2026',
      owner: 'Anita Sharma',
    },
    {
      id: '2',
      name: 'Payment Gateway Assessment',
      application: 'Payment Gateway',
      status: 'In Progress',
      riskScore: 'High',
      lastUpdated: 'May 14, 2026',
      owner: 'Anita Sharma',
    },
    {
      id: '3',
      name: 'Vendor Portal Assessment',
      application: 'Vendor Portal',
      status: 'Review',
      riskScore: 'Medium',
      lastUpdated: 'May 13, 2026',
      owner: 'Rahul Verma',
    },
    {
      id: '4',
      name: 'Finance Application Review',
      application: 'Finance Application',
      status: 'Completed',
      riskScore: 'Low',
      lastUpdated: 'May 10, 2026',
      owner: 'Anita Sharma',
    },
  ];
  const [riskHeatMapBoolean, setRiskHeatMapBoolean] = useState(false);
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
  {console.log("assessments -> ",assessments)}
  const [qaAssetIdx, setQaAssetIdx] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, Record<string, LocalAnswer>>>>({});
  const [submittingQa, setSubmittingQa] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const workflowContentRef = useRef<HTMLDivElement | null>(null);


  // ... fetch assessments from API ...

  const { totalAssessments, riskItems } = processRiskDistribution(assessments);

  // ... fetch assessments from API ...

  const heatmapData = processRiskHeatmapData(assessments);

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

  const tableData = useMemo<AssessmentTableRow[]>(
      () => mapAssessmentsToTableData(assessments),
      [assessments]
  );
  const heatMapData = useMemo(
      () => buildHeatMapData(assessments),
      [assessments]
  );

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
    Questionnaire: !hasAssetsInScope,
    "Risk Review": !hasRisksIdentified,
    Findings: !hasFindingsReady,
    "Final Report": !hasReportPrerequisites,
  };

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
    const assetAnswers = answers[assetId] ?? {};
    return Object.values(assetAnswers).flatMap((sectionAnswer) => Object.values(sectionAnswer)).length;
  }

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
    setSubmittingQa(true);

    try {
      const responses = sections.flatMap((section) =>
        section.questions.map((question) => {
          const local = answers[currentAssetId]?.[section.id]?.[question.id];
          return {
            asset_id: currentAssetId,
            section_id: section.id,
            question_id: question.id,
            answer: (local?.answer ?? "na") as AnswerType,
            details: local?.details ?? "",
          };
        }),
      );

      await submitResponseBatch(selectedAssessment.id, responses);

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
    setLocation("/risk-assessment/new");
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

  function backToLanding() {
    setLocation("/risk-assessment");
    setShowCreate(false);
    selectAssessment(null);
    setWizardStep(0);
    setQaAssetIdx(0);
    setExpandedSection(sections[0]?.id ?? null);
  }


  // Code for table data
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

      <div className="relative ">
        <HeroSubSection title={"Risk Assessment"}
                        subtitle="Application risk assessments, structured questionnaires, inherent scoring, residual analysis, and reporting."
                        icon={ShieldAlert}
                        actionBtn={'New Assessment'}
                        actionFn={()=>{setShowCreate(true)}}/>

        {/*-----Pop-up code------*/}
        {showCreate ? (
            <Dialog open={showCreate} onOpenChange={(open) => (open ? setShowCreate(true) : closeCreate())}>
              <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[1280px] flex-col overflow-hidden rounded-[18px] border border-[#BFD0E5] bg-white p-0 shadow-[0_34px_100px_-42px_rgba(2,10,24,0.72)] sm:w-[calc(100vw-80px)] sm:rounded-[10px]">
                <DialogHeader className="flex-shrink-0 border-b  px-5 py-6 text-left text-white sm:px-6" style={{
                  background: `
      radial-gradient(ellipse 60% 95% at 6% 115%, #7213EA 0%, transparent 150%),
      radial-gradient(ellipse 36% 95% at 92% -22%, #0C233C 0%, transparent 1200%)
    `
                }}>
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
                <DialogFooter className="flex-shrink-0 border-t  px-4 py-4 sm:px-6" style={{
                  background: `
      radial-gradient(ellipse 60% 95% at 6% 115%, #0C233C  0%, transparent 500%),
      radial-gradient(ellipse 36% 95% at 92% -22%, #7213EA 0%, transparent 1200%)
    `
                }}>
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
        {/*<HeroSection*/}
        {/*  title="Risk Assessment"*/}
        {/*  subtitle="Application risk assessments, structured questionnaires, inherent scoring, residual analysis, and reporting."*/}
        {/*  icon={ShieldAlert}*/}
        {/*/>*/}
      </div>

      <main className="relative  mx-auto max-w-[1460px] px-3 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-8 lg:px-10 lg:pb-5 lg:pt-10">
        {!isCreatePage && !selectedAssessment ? (
          <>
            {/* Keep How It Works first on the landing page so users see the assessment process before entering the workspace. */}


            {/* Place the requested three KPI boxes immediately after How It Works before the main workspace begins. */}
            <RiskAssessmentFeatureCards
              activeAssessments={activeAssessments}
              highCriticalRisks={highCriticalRisks}
              drafts={draftAssessments}
              totalAssessments={assessments.length}
              totalRisks={allRisks.length}
              assetCount={assets.length}
            />
            <AssessmentProcess />
            {/*<div className={""}>*/}
            {/*  <RecentActivity />*/}
            {/*</div>*/}
            <div className="grid grid-cols-2 gap-4">
              <div><RecentActivity /></div>
              <div className="relative">
                <AnimatePresence mode="wait">
                {riskHeatMapBoolean?
                    <motion.div
                        key="heatmap"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                      <RiskDistribution
                          riskItems={riskItems}
                          totalAssessments={totalAssessments}
                          setRiskHeatMap={setRiskHeatMapBoolean}/>
                    </motion.div>:
                    <motion.div
                        key="distribution"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                      <RiskHeatMap data={heatmapData} setRiskHeatMap={setRiskHeatMapBoolean} />
                      {/*data={heatMapData}*/}
                    </motion.div>}
                </AnimatePresence>
              </div>

            </div>
            <div className={"mt-4 grid grid-cols-1"}>
              <RecentRiskTable assessments={tableData} title={""} />
            </div>






            <div className="min-w-0 space-y-6">
              {!selectedAssessment ? (
                  /* This landing workspace replaces the old dashboard while preserving New Assessment access. */
                  <section className="overflow-hidden rounded-[10px] border border-[#D8E0ED] bg-white shadow-[0_20px_48px_-38px_rgba(12,35,60,0.28)]">
                    {/* Match the workflow header background to the dark KPMG/TRACE treatment used by Recent Assessments. */}
                    <div className="flex flex-col items-stretch justify-between gap-4 border-b border-[#123863] bg-[#0C233C] px-4 py-5 sm:flex-row sm:items-center sm:px-6">
                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/48">Assessment</p>
                        <h2 className="text-[24px] font-bold tracking-[-0.03em] text-white">Risk Assessment Workspace</h2>
                        <p className="mt-2 text-[13px] leading-6 text-white/68">Open an existing assessment or create a new assessment to begin the guided workflow.</p>
                      </div>
                      <button className={PRIMARY_BUTTON} onClick={openCreate} data-risk-assessment-new="true">
                        <Plus className="h-4 w-4" />
                        New Assessment
                      </button>
                    </div>

                    <WorkflowContextBar
                        assessment={landingAssessment}
                        assetLabel={landingAssessment ? assetName(landingAssessment.asset_ids[0] ?? "") : "Select an assessment"}
                        progress={landingAssessment ? Math.min(100, Math.max(17, Math.round(((statusToStep(landingAssessment.status) + 1) / WORKFLOW_PROGRESS_STEP_COUNT) * 100))) : 0}
                        currentStage={workflowLabelForAssessmentStatus(landingAssessment?.status)}
                    />

                    {/* Stack guidance below the main content until there is enough horizontal room. */}
                    <div className="grid gap-5 bg-[#F7F9FC] p-3 sm:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="flex h-full min-w-0 flex-col">
                        {/* Keep this card sized to its own five-row list so the scroll area ends at the box bottom. */}
                        <div className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-[#D8E0ED] bg-white">
                          <div className="flex min-h-[128px] flex-col items-start justify-between gap-4 border-b border-[#123863] bg-[#0C233C] px-4 py-8 sm:flex-row sm:items-center sm:px-6">
                            <div className="flex min-w-0 items-center gap-4">
                              <ShieldCheck className="h-12 w-12 rounded-full bg-white/10 p-3 text-white" />
                              <div>
                                <h3 className="text-[18px] font-bold text-white">Recent Assessments</h3>
                                <p className="mt-1 text-[13px] text-white/68">Continue from an existing assessment or start a fresh workflow.</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#009A44]">
                          {assessments.length} available
                        </span>
                          </div>

                          {error ? (
                              <div className="mb-4 rounded-[16px] border border-[#F3C6CF] bg-[#FEEBED] px-4 py-3 text-[12px] font-medium text-[#E5001B]">
                                {error}
                              </div>
                          ) : null}

                          {isLoading ? (
                              <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-5 w-5 animate-spin text-[#1E49E2]" />
                              </div>
                          ) : assessments.length > 0 ? (
                              <div className="max-h-[352px] divide-y divide-[#E8EDF5] overflow-y-auto">
                                {assessments.map((assessment) => (
                                    <div
                                        key={assessment.id}
                                        className="group grid min-h-[88px] w-full grid-cols-1 items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-[#F8FBFF] sm:px-7 lg:grid-cols-[minmax(0,1fr)_220px]"
                                        data-risk-assessment-session={assessment.id}
                                    >
                                      <button
                                          type="button"
                                          onClick={() => selectExistingAssessment(assessment)}
                                          className="min-w-0 text-left"
                                      >
                                        <p className="truncate text-[15px] font-bold text-[#0C233C]">{assessment.title}</p>
                                        <p className="mt-1.5 text-[12px] text-[#5A6478]">
                                          {assessmentAppCount(assessment)} application{assessmentAppCount(assessment) === 1 ? "" : "s"} - Updated {formatDate(assessment.updated_at)}
                                        </p>
                                      </button>
                                      {/* Give status/action its own wider column so each assessment row looks balanced. */}
                                      <div className="flex w-full items-center justify-between gap-4 lg:justify-end">
                                        <StatusBadge status={assessment.status} />
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteAssessment(assessment)}
                                            className="grid h-8 w-8 place-items-center rounded-full bg-[#FEEBED] text-[#E5001B] transition-colors hover:bg-[#F9D6DC]"
                                            title="Delete assessment"
                                            aria-label={`Delete ${assessment.title}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => selectExistingAssessment(assessment)}
                                            className="grid h-8 w-8 place-items-center rounded-full bg-[#EEF2FF] text-[#1E49E2] transition-colors group-hover:bg-[#DDE7FF]"
                                            title="Open assessment"
                                            aria-label={`Open ${assessment.title}`}
                                        >
                                          <ArrowRight className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                ))}
                              </div>
                          ) : (
                              <div className="px-6 py-10 text-center">
                                <h3 className="text-[18px] font-bold tracking-[-0.03em] text-[#0C233C]">No Risk Assessments Yet</h3>
                                <p className="mx-auto mt-3 max-w-[520px] text-[13px] leading-6 text-[#7388A8]">
                                  Start the first assessment to define scope, run the questionnaire, analyze risk, and generate the final report.
                                </p>
                                <button className={`${PRIMARY_BUTTON} mt-6`} onClick={openCreate}>
                                  <Plus className="h-4 w-4" />
                                  New Assessment
                                </button>
                              </div>
                          )}
                        </div>
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
                  <div ref={workflowContentRef}>
                    <RiskAssessmentWorkspace
                        primaryButtonClassName={PRIMARY_BUTTON}
                        onCreate={openCreate}
                        showCreateButton={false}
                        onBack={backToLanding}
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
                          onStepSelect={handleWorkflowStepSelect}
                      />
                    </RiskAssessmentWorkspace>

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
                        /* Keep the questionnaire and guidance side-by-side on desktop and stacked on smaller screens. */
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" data-risk-assessment-questionnaire="true">
                          <section className="min-w-0">
                            {selectedAssessment.asset_ids.length === 0 ? (
                                <div className="rounded-[8px] border border-dashed border-[#DCE3EE] bg-white px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
                                  No Asset Registry applications were selected for questionnaire capture.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                  {sections.map((section) => {
                                    const completed = sectionProgress(answers, currentAssetId, section);
                                    const total = section.questions.length;
                                    const isOpen = expandedSection === section.id;
                                    return (
                                        <div
                                            key={section.id}
                                            className={`risk-questionnaire-glass-section overflow-hidden rounded-[8px] border ${
                                                isOpen ? "border-[#1E49E2] shadow-[0_18px_34px_-30px_rgba(30,73,226,0.36)]" : "border-[#D8E0ED]"
                                            }`}
                                        >
                                          <button
                                              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                                              onClick={() => setExpandedSection(isOpen ? null : section.id)}
                                          >
                                            <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#1E49E2]">
                                      {section.title.toLowerCase().includes("access") ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                                    </span>
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="truncate text-[16px] font-bold text-[#0C233C]">{section.title}</span>
                                                  <HelpCircle className="h-3.5 w-3.5 flex-shrink-0 text-[#8492A6]" />
                                                </div>
                                                <p className="mt-1 text-[12px] text-[#5A6478]">Controls and risk questions for this section.</p>
                                              </div>
                                            </div>
                                            <div className="flex w-full flex-shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                                    <span
                                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                                            completed === total
                                                ? "bg-[#EDFBF5] text-[#009A44]"
                                                : completed > 0
                                                    ? "bg-[#FFF4E8] text-[#AB5C00]"
                                                    : "bg-[#FEEBED] text-[#E5001B]"
                                        }`}
                                    >
                                      {completed} / {total} answered
                                    </span>
                                              {isOpen ? <ChevronDown className="h-4 w-4 text-[#7E91AE]" /> : <ChevronRight className="h-4 w-4 text-[#7E91AE]" />}
                                            </div>
                                          </button>

                                          {isOpen ? (
                                              <div className="border-t border-[#E8EDF5] px-5 py-4">
                                                <div className="space-y-5">
                                                  {section.questions.map((question, questionIndex) => {
                                                    const local = answers[currentAssetId]?.[section.id]?.[question.id];
                                                    return (
                                                        <div key={question.id} className="border-t border-[#EFF2F7] pt-4 first:border-t-0 first:pt-0">
                                                          {/* Stack answer controls under the question until desktop width avoids squeeze. */}
                                                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
                                                            <div className="flex gap-3">
                                                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#AFC1F8] bg-white text-[12px] font-bold text-[#1E49E2]">
                                                  {questionIndex + 1}
                                                </span>
                                                              <div className="min-w-0">
                                                                <p className="text-[14px] font-semibold leading-6 text-[#0C233C]">{question.text}</p>
                                                              </div>
                                                            </div>
                                                            {/* Keep each questionnaire answer limited to Yes/No/NA boxes, with no notes placeholder field. */}
                                                            <div className="grid min-w-0 grid-cols-3 gap-3">
                                                              {(["yes", "no", "na"] as AnswerType[]).map((answer) => (
                                                                  <button
                                                                      key={answer}
                                                                      className={`risk-question-answer-button h-11 rounded-[8px] border text-[12px] font-bold transition-all ${
                                                                          local?.answer === answer
                                                                              ? answer === "yes"
                                                                                  ? "risk-question-answer-button--yes-selected"
                                                                                  : answer === "no"
                                                                                      ? "risk-question-answer-button--no-selected"
                                                                                      : "risk-question-answer-button--na-selected"
                                                                              : "risk-question-answer-button--idle"
                                                                      }`}
                                                                      onClick={() => setAnswer(currentAssetId, section.id, question.id, answer)}
                                                                  >
                                                                    {answer === "yes" ? "Yes" : answer === "no" ? "No" : "NA"}
                                                                  </button>
                                                              ))}
                                                            </div>
                                                          </div>
                                                        </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                          ) : null}
                                        </div>
                                    );
                                  })}
                                </div>
                            )}
                          </section>
                          <div>
                            <GuidanceCard answeredQuestions={currentAnsweredCount} totalQuestions={currentTotalQuestions} />
                            {currentAssetId ? (
                                <div className="mt-4 flex flex-col gap-3 rounded-[8px] border border-[#D8E0ED] bg-white p-4 sm:flex-row">
                                  <button className={SECONDARY_BUTTON} onClick={() => toast({ title: "Progress saved" })}>
                                    <Save className="h-4 w-4" />
                                    Save Progress
                                  </button>
                                  <button className={PRIMARY_BUTTON} onClick={() => void handleSubmitQa()} disabled={submittingQa}>
                                    {submittingQa ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Continue
                                    <ArrowRight className="h-4 w-4" />
                                  </button>
                                </div>
                            ) : null}
                          </div>
                        </div>
                    ) : null}

                    {false && selectedAssessment && wizardStep === 1 ? (
                        <div className="space-y-5" data-risk-assessment-questionnaire="true">
                          <SurfaceSection
                              eyebrow="Questionnaire"
                              title="Application Response Capture"
                              action={
                                currentAssetId ? (
                                    <button className={PRIMARY_BUTTON} onClick={() => void handleSubmitQa()} disabled={submittingQa}>
                                      {submittingQa ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                      {qaAssetIdx < selectedAssessment!.asset_ids.length - 1 ? "Save And Next" : "Submit Responses"}
                                    </button>
                                ) : null
                              }
                          >
                            {selectedAssessment!.asset_ids.length === 0 ? (
                                <div className="rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
                                  No Asset Registry applications were selected for questionnaire capture.
                                </div>
                            ) : (
                                <>
                                  <div className="sticky top-0 z-10 mb-4 rounded-[18px] border border-[#DCE3EE] bg-white/95 px-4 py-3 shadow-[0_14px_28px_-24px_rgba(12,35,60,0.26)] backdrop-blur">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[14px] font-bold text-[#0C233C]">{assetName(currentAssetId)}</p>
                                        <p className="mt-1 text-[12px] text-[#7388A8]">
                                          Application {qaAssetIdx + 1} of {selectedAssessment!.asset_ids.length} · {answeredCount(currentAssetId)} answered
                                        </p>
                                      </div>
                                      <div className="rounded-full border border-[#DCE3EE] bg-[#F7F9FC] px-4 py-2 text-[12px] font-bold text-[#7388A8]">
                                        {sections.length} sections
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mb-4 flex flex-wrap gap-2">
                                    {selectedAssessment!.asset_ids.map((assetId, index) => (
                                        <button
                                            key={assetId}
                                            className={`rounded-full border px-4 py-2 text-[12px] font-bold transition-colors ${
                                                index === qaAssetIdx
                                                    ? "border-[#1E49E2] bg-[#1E49E2] text-white"
                                                    : "border-[#DCE3EE] bg-white text-[#6A748A] hover:bg-[#F7F9FC]"
                                            }`}
                                            onClick={() => setQaAssetIdx(index)}
                                        >
                                          {assetName(assetId)} <span className="opacity-70">({answeredCount(assetId)})</span>
                                        </button>
                                    ))}
                                  </div>

                                  <div className="space-y-4">
                                    {sections.map((section) => {
                                      const completed = sectionProgress(answers, currentAssetId, section);
                                      const total = section.questions.length;
                                      const isOpen = expandedSection === section.id;
                                      return (
                                          <div
                                              key={section.id}
                                              className={`overflow-hidden rounded-[20px] border bg-white ${
                                                  isOpen ? "border-[#AFC1F8] shadow-[0_16px_34px_-30px_rgba(30,73,226,0.35)]" : "border-[#E2E6EF]"
                                              }`}
                                          >
                                            <button
                                                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                                                onClick={() => setExpandedSection(isOpen ? null : section.id)}
                                            >
                                              <div className="flex items-center gap-3">
                                                {isOpen ? (
                                                    <ChevronDown className="h-4 w-4 text-[#7E91AE]" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-[#7E91AE]" />
                                                )}
                                                <span className="text-[15px] font-bold text-[#0C233C]">{section.title}</span>
                                              </div>
                                              <span
                                                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${
                                                      completed === total
                                                          ? "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]"
                                                          : "border-[#DCE3EE] bg-[#F3F6FA] text-[#6A748A]"
                                                  }`}
                                              >
                                      {completed}/{total}
                                    </span>
                                            </button>

                                            {isOpen ? (
                                                <div className="border-t border-[#E2E6EF] px-5 py-5">
                                                  <div className="space-y-5">
                                                    {section.questions.map((question) => {
                                                      const local = answers[currentAssetId]?.[section.id]?.[question.id];
                                                      return (
                                                          <div key={question.id} className="border-t border-[#EFF2F7] pt-5 first:border-t-0 first:pt-0">
                                                            <div className="mb-3 flex items-start gap-3">
                                                <span
                                                    className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                                                        question.question_type === "Exposure"
                                                            ? "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]"
                                                            : question.question_type === "Control"
                                                                ? "border-[#C9D7FF] bg-[#EEF2FF] text-[#1E49E2]"
                                                                : "border-[#DCE3EE] bg-[#F3F6FA] text-[#6A748A]"
                                                    }`}
                                                >
                                                  {question.question_type}
                                                </span>
                                                              <p className="text-[14px] leading-7 text-[#4D6485]">{question.text}</p>
                                                            </div>

                                                            {/* Keep the legacy questionnaire fallback aligned with the visible Yes/No/NA answer design. */}
                                                            <div className="mb-3 grid max-w-[330px] grid-cols-3 gap-3">
                                                              {(["yes", "no", "na"] as AnswerType[]).map((answer) => (
                                                                  <button
                                                                      key={answer}
                                                                      className={`risk-question-answer-button h-11 rounded-[8px] border px-4 text-[12px] font-bold transition-all ${
                                                                          local?.answer === answer
                                                                              ? answer === "yes"
                                                                                  ? "risk-question-answer-button--yes-selected"
                                                                                  : answer === "no"
                                                                                      ? "risk-question-answer-button--no-selected"
                                                                                      : "risk-question-answer-button--na-selected"
                                                                              : "risk-question-answer-button--idle"
                                                                      }`}
                                                                      onClick={() => setAnswer(currentAssetId, section.id, question.id, answer)}
                                                                  >
                                                                    {answer.toUpperCase()}
                                                                  </button>
                                                              ))}
                                                            </div>
                                                          </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                            ) : null}
                                          </div>
                                      );
                                    })}
                                  </div>
                                </>
                            )}
                          </SurfaceSection>
                        </div>
                    ) : null}

                    {wizardStep === 2 ? (
                        <IdentifyRiskPage
                            mode="analysis"
                            risks={selectedAssessment.risks}
                            primaryButtonClassName={PRIMARY_BUTTON}
                            onApplyControls={() => navigateWorkflowStep("Findings")}
                        />
                    ) : null}

                    {wizardStep === 3 ? (
                        <IdentifyRiskPage
                            mode="identified"
                            risks={selectedAssessment.risks}
                            primaryButtonClassName={PRIMARY_BUTTON}
                            onApplyControls={() => navigateWorkflowStep("Findings")}
                        />
                    ) : null}

                    {wizardStep === 4 ? (
                        <ApplyControlToRiskPage
                            risks={selectedAssessment.risks}
                            suggestedControls={selectedAssessment.suggested_controls ?? []}
                            appliedControls={selectedAssessment.applied_controls}
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
                        <RiskAssessmentReport
                            report={currentReport}
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
                    />
                  </div>
              ) : null}
            </div>











            {/*<div className="flex flex-wrap gap-2">*/}
              {/* Left column */}
              {/*<div className="flex-1 min-w-[300px]">*/}
              {/*  <RecentActivity />*/}
              {/*</div>*/}
              {/* Right column */}
              {/*<div className="flex-1 min-w-[300px]">*/}

                {/*<RiskDistribution />*/}
                {/*<RiskHeatMap />*/}
                {/*<RiskReport />*/}
              {/*</div>*/}
            {/*</div>*/}

            {/*<HowItWorks*/}
            {/*    defaultOpen*/}
            {/*    steps={[*/}
            {/*      {*/}
            {/*        number: 1,*/}
            {/*        title: "Create Assessment",*/}
            {/*        desc: "Start a new assessment and choose the applications or ad hoc systems in scope.",*/}
            {/*        color: "#1E49E2",*/}
            {/*      },*/}
            {/*      {*/}
            {/*        number: 2,*/}
            {/*        title: "Answer Questionnaire",*/}
            {/*        desc: "Capture control and risk responses with evidence notes for each selected asset.",*/}
            {/*        color: "#098E7E",*/}
            {/*      },*/}
            {/*      {*/}
            {/*        number: 3,*/}
            {/*        title: "Review Output",*/}
            {/*        desc: "Validate risks, findings, residual scoring, and the final report.",*/}
            {/*        color: "#EAAA00",*/}
            {/*      },*/}
            {/*    ]}*/}
            {/*/>*/}
          </>
        ) : null}



      </main>
      {/*<RiskAssessmentStyles />*/}
    </div>
  );
}


