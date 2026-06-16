import type { HTMLAttributes, ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { TracePanel } from "@/components/TraceAnalysisPrimitives";
import type {
  ResidualResult,
  Risk,
  SuggestedControl,
} from "@/contexts/RiskAssessmentContext";
import { BandBadge } from "./Badges";

type SurfaceSectionProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

// Shared white panel used by the main workflow stages.
export function SurfaceSection({
  eyebrow,
  title,
  action,
  children,
  className = "",
  ...sectionProps
}: SurfaceSectionProps) {
  return (
    <section
      {...sectionProps}
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

// Displays one inherent risk with score, band, and explanation.
export function RiskSummaryCard({ risk }: { risk: Risk }) {
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

// Small pill for controls already linked to the assessment.
export function AppliedControlChip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#BFE7D1] bg-[#EDFBF5] px-3 py-1.5 text-[11px] font-bold text-[#009A44]">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

type SuggestedControlRowProps = {
  suggestion: SuggestedControl;
  alreadyApplied: boolean;
  onApply: () => Promise<void>;
};

// Shows one suggested control and lets the user apply it to a risk.
export function SuggestedControlRow({
  suggestion,
  alreadyApplied,
  onApply,
}: SuggestedControlRowProps) {
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

// Displays residual risk after controls are applied.
export function ResidualCard({ result }: { result: ResidualResult }) {
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

