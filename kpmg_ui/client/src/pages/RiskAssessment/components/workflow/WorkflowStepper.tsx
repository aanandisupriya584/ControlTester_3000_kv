import {
  CheckCircle2,
  CirclePlus,
  ClipboardCheck,
  Database,
  FileBarChart,
  SearchCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const WORKFLOW_STEP_CONFIG = [
  { label: "Create", slug: "create", targetStep: 0 },
  { label: "Assets", slug: "assets", targetStep: 0 },
  { label: "Questionnaire", slug: "questionnaire", targetStep: 1 },
  { label: "Risk Review", slug: "risk-review", targetStep: 3 },
  { label: "Findings", slug: "findings", targetStep: 4 },
  { label: "Final Report", slug: "final-report", targetStep: 6 },
] as const;

export type WorkflowStepLabel = (typeof WORKFLOW_STEP_CONFIG)[number]["label"];

export const WORKFLOW_PROGRESS_STEP_COUNT = WORKFLOW_STEP_CONFIG.length;

export const WORKFLOW_STEP_BY_LABEL = WORKFLOW_STEP_CONFIG.reduce(
  (acc, step) => ({ ...acc, [step.label]: step }),
  {} as Record<WorkflowStepLabel, (typeof WORKFLOW_STEP_CONFIG)[number]>,
);

const WORKFLOW_STEP_DETAILS: Record<string, { Icon: LucideIcon; summary: string }> = {
  Create: { Icon: CirclePlus, summary: "Create the assessment session and define the initial scope." },
  Assets: { Icon: Database, summary: "Confirm registry and ad hoc applications included in the assessment." },
  Questionnaire: { Icon: ClipboardCheck, summary: "Answer each control and risk question for selected applications." },
  "Risk Review": { Icon: ShieldAlert, summary: "Review inherent risks identified from questionnaire responses." },
  Findings: { Icon: SearchCheck, summary: "Review findings and control suggestions before residual scoring." },
  "Final Report": { Icon: FileBarChart, summary: "Generate and preview the formatted risk assessment report." },
};

export function workflowLabelFromWizardStep(wizardStep: number): WorkflowStepLabel {
  if (wizardStep === 0) return "Assets";
  if (wizardStep === 1) return "Questionnaire";
  if (wizardStep === 3) return "Risk Review";
  if (wizardStep === 4 || wizardStep === 5) return "Findings";
  if (wizardStep === 6) return "Final Report";
  return "Risk Review";
}

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
  onSelect: (label: WorkflowStepLabel) => void;
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
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="tab"
            onClick={() => onSelect(label)}
            className={`relative z-10 flex min-w-0 flex-col items-center gap-2 rounded-[8px] px-1 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#AFC1F8] ${
              disabled ? "cursor-pointer opacity-70 hover:-translate-y-0.5" : "cursor-pointer hover:-translate-y-0.5"
            }`}
            data-risk-assessment-step-tooltip="true"
            aria-current={active ? "step" : undefined}
            aria-selected={active}
            aria-disabled={disabled}
          >
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
      {index < WORKFLOW_STEP_CONFIG.length - 1 ? (
        <span
          className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[18px] h-0.5 rounded-full ${
            nextStepComplete || !disabled ? "bg-[#00C853]" : "bg-white/30"
          }`}
        />
      ) : null}
    </div>
  );
}

export default function WorkflowStepper({
  activeStep,
  completedSteps,
  disabledSteps,
  selectedAssessmentId,
  onCreate,
  onStepOpen,
  onBlockedFinalReport,
}: {
  activeStep: WorkflowStepLabel;
  completedSteps: Record<WorkflowStepLabel, boolean>;
  disabledSteps: Record<WorkflowStepLabel, boolean>;
  selectedAssessmentId?: string | null;
  onCreate: () => void;
  onStepOpen: (label: WorkflowStepLabel, targetStep: number) => boolean | void;
  onBlockedFinalReport: () => void;
}) {
  function handleStepSelect(label: WorkflowStepLabel) {
    if (label === "Create") {
      onCreate();
      return;
    }

    if (!selectedAssessmentId) return;

    if (label === "Final Report" && disabledSteps[label]) {
      onBlockedFinalReport();
      return;
    }

    const targetStep = WORKFLOW_STEP_BY_LABEL[label].targetStep;
    const canOpen = onStepOpen(label, targetStep);
    if (canOpen === false) return;
  }

  return (
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
            onSelect={handleStepSelect}
          />
        ))}
      </div>
    </section>
  );
}
