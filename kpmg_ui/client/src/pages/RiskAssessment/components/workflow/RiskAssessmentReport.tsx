import type { ReactNode } from "react";
import { FileBarChart, Loader2 } from "lucide-react";

interface RiskAssessmentReportProps {
  report: string | null;
  isGeneratingReport: boolean;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  onCancel: () => void;
  onGenerateReport: () => void;
  onViewReport: () => void;
}

function SectionShell({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#DCE3EE] bg-white p-6 shadow-[0_18px_42px_-34px_rgba(12,35,60,0.26)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#00338D]">Report</p>
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0C233C]">Risk Assessment Report</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function RiskAssessmentReport({
  report,
  isGeneratingReport,
  primaryButtonClassName,
  secondaryButtonClassName,
  onCancel,
  onGenerateReport,
  onViewReport,
}: RiskAssessmentReportProps) {
  return (
    <SectionShell
      action={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button className={secondaryButtonClassName} onClick={onCancel}>
            Cancel
          </button>
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
    >
      <div className="risk-report-glass-box rounded-[18px] border px-4 py-8 text-center text-[13px] leading-6">
        <FileBarChart className="mx-auto mb-3 h-8 w-8 text-[#1E49E2]" />
        <p>
          {report
            ? "The report is ready. Open the preview popup to review the formatted output."
            : "Generate the report to open the formatted assessment output in a preview popup."}
        </p>
        {report ? (
          <button className="risk-view-report-glass-button mt-5" onClick={onViewReport}>
            View Report
          </button>
        ) : null}
      </div>
    </SectionShell>
  );
}
