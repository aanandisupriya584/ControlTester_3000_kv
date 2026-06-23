import type { ReactNode } from "react";
import { FileBarChart, Loader2 } from "lucide-react";

interface RiskAssessmentReportProps {
  report: string | null;
  isGeneratingReport: boolean;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  onGenerateReport: () => void;
  onViewReport: () => void;
}

function SectionShell({
  action,
}: {
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#00338D]">Report</p>
        <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0C233C]">Risk Assessment Report</h2>
      </div>
      {action}
    </div>
  );
}

export default function RiskAssessmentReport({
  report,
  isGeneratingReport,
  primaryButtonClassName,
  secondaryButtonClassName,
  onGenerateReport,
  onViewReport,
}: RiskAssessmentReportProps) {
  return (
    <SectionShell
      action={
        <div className="flex flex-col gap-3 sm:flex-row">
          {report ? (
            <button className={secondaryButtonClassName} onClick={onViewReport}>
              View Report
            </button>
          ) : null}
          <button
            className={primaryButtonClassName}
            onClick={onGenerateReport}
            disabled={isGeneratingReport}
            data-risk-assessment-report="true"
          >
            {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
            Generate Report
          </button>
        </div>
      }
    />
  );
}
