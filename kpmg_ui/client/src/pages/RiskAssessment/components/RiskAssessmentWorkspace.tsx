import type { ReactNode } from "react";
import NewAssessmentButton from "./NewAssessmentButton";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  risks_identified: "Risks Identified",
  controls_applied: "Controls Applied",
  complete: "Complete",
};

interface RiskAssessmentWorkspaceProps {
  primaryButtonClassName: string;
  onCreate: () => void;
  children: ReactNode;
  showCreateButton?: boolean;
}

export default function RiskAssessmentWorkspace({
  primaryButtonClassName,
  onCreate,
  children,
  showCreateButton = true,
}: RiskAssessmentWorkspaceProps) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#D8E0ED] bg-white shadow-[0_20px_48px_-38px_rgba(12,35,60,0.28)]">
      <div className="flex flex-col items-stretch justify-between gap-4 border-b border-[#123863] bg-[#0C233C] px-4 py-5 sm:flex-row sm:items-center sm:px-6">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/48">Assessment</p>
          <h2 className="text-[24px] font-bold tracking-[-0.03em] text-white">Risk Assessment Workspace</h2>
          <p className="mt-2 text-[13px] leading-6 text-white/68">Open an existing assessment or create a new assessment to begin the guided workflow.</p>
        </div>
        {showCreateButton ? <NewAssessmentButton className={primaryButtonClassName} onClick={onCreate} /> : null}
      </div>
      {children}
    </section>
  );
}
