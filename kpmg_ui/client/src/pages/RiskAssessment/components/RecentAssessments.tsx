import { ArrowRight, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import type { RiskAssessment } from "@/contexts/RiskAssessmentContext";
import NewAssessmentButton from "./NewAssessmentButton";
import { STATUS_LABELS } from "./RiskAssessmentWorkspace";

const STATUS_CLASS: Record<string, string> = {
  draft: "border-[#DCE3EE] bg-[#F3F6FA] text-[#6A748A]",
  in_progress: "border-[#C9D7FF] bg-[#EEF2FF] text-[#1E49E2]",
  risks_identified: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  controls_applied: "border-[#D7C0FA] bg-[#F3F0FF] text-[#7213EA]",
  complete: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
};

function StatusBadge({ status }: { status: RiskAssessment["status"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${STATUS_CLASS[status] ?? STATUS_CLASS.draft}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Recently";
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

function assessmentAppCount(assessment: RiskAssessment) {
  return assessment.asset_ids.length + (assessment.ad_hoc_applications?.length ?? 0);
}

interface RecentAssessmentsProps {
  assessments: RiskAssessment[];
  error: string | null;
  isLoading: boolean;
  primaryButtonClassName: string;
  onCreate: () => void;
  onOpen: (assessment: RiskAssessment) => void;
  onDelete: (assessment: RiskAssessment) => void;
}

export default function RecentAssessments({
  assessments,
  error,
  isLoading,
  primaryButtonClassName,
  onCreate,
  onOpen,
  onDelete,
}: RecentAssessmentsProps) {
  function openAssessmentWorkspace(assessment: RiskAssessment) {
    onOpen(assessment);
  }

  return (
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
        <div className="max-h-[440px] divide-y divide-[#E8EDF5] overflow-y-auto">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="group grid min-h-[88px] w-full grid-cols-1 items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-[#F8FBFF] sm:px-7 lg:grid-cols-[minmax(0,1fr)_220px]"
              data-risk-assessment-session={assessment.id}
            >
              <button type="button" onClick={() => openAssessmentWorkspace(assessment)} className="min-w-0 text-left">
                <p className="truncate text-[15px] font-bold text-[#0C233C]">{assessment.title}</p>
                <p className="mt-1.5 text-[12px] text-[#5A6478]">
                  {assessmentAppCount(assessment)} application{assessmentAppCount(assessment) === 1 ? "" : "s"} - Updated {formatDate(assessment.updated_at)}
                </p>
              </button>
              <div className="flex w-full items-center justify-between gap-4 lg:justify-end">
                <StatusBadge status={assessment.status} />
                <button
                  type="button"
                  onClick={() => onDelete(assessment)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-[#FEEBED] text-[#E5001B] transition-colors hover:bg-[#F9D6DC]"
                  title="Delete assessment"
                  aria-label={`Delete ${assessment.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openAssessmentWorkspace(assessment)}
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
          <NewAssessmentButton className={`${primaryButtonClassName} mt-6`} onClick={onCreate} />
        </div>
      )}
    </div>
  );
}
