import type { ReactNode } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { TracePanel } from "@/components/TraceAnalysisPrimitives";
import type { Risk } from "@/contexts/RiskAssessmentContext";

const BAND_CLASS: Record<string, string> = {
  Critical: "border-[#F3C6CF] bg-[#FEEBED] text-[#E5001B]",
  High: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  Medium: "border-[#F8E8B7] bg-[#FFF9E8] text-[#8A6A00]",
  Low: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
};

interface IdentifyRiskPageProps {
  mode: "analysis" | "identified";
  risks: Risk[];
  primaryButtonClassName: string;
  onApplyControls: () => void;
}

function SectionShell({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#DCE3EE] bg-white p-6 shadow-[0_18px_42px_-34px_rgba(12,35,60,0.26)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#00338D]">{eyebrow}</p>
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0C233C]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BandBadge({ band }: { band: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${BAND_CLASS[band] ?? BAND_CLASS.Medium}`}>
      {band}
    </span>
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

function RunningRiskAnalysis() {
  return (
    <SectionShell eyebrow="Analysis" title="Running Risk Analysis">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" data-risk-assessment-analysis="true">
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
    </SectionShell>
  );
}

export default function IdentifyRiskPage({
  mode,
  risks,
  primaryButtonClassName,
  onApplyControls,
}: IdentifyRiskPageProps) {
  if (mode === "analysis") return <RunningRiskAnalysis />;

  return (
    <SectionShell
      eyebrow="Risks"
      title={`Identified Risks (${risks.length})`}
      action={
        <button className={primaryButtonClassName} onClick={onApplyControls} data-risk-assessment-risks="true">
          Apply Controls
          <ArrowRight className="h-4 w-4" />
        </button>
      }
    >
      {risks.length > 0 ? (
        <div className="risk-identified-glass-list grid gap-4 rounded-[22px] border p-4">
          {risks.map((risk) => (
            <RiskSummaryCard key={risk.id} risk={risk} />
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
          No risks have been identified for this assessment yet.
        </div>
      )}
    </SectionShell>
  );
}
