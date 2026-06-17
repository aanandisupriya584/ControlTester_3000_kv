import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { TracePanel } from "@/components/TraceAnalysisPrimitives";
import type { AppliedControl, Risk, SuggestedControl } from "@/contexts/RiskAssessmentContext";

const BAND_CLASS: Record<string, string> = {
  Critical: "border-[#F3C6CF] bg-[#FEEBED] text-[#E5001B]",
  High: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  Medium: "border-[#F8E8B7] bg-[#FFF9E8] text-[#8A6A00]",
  Low: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
};

interface ApplyControlToRiskPageProps {
  risks: Risk[];
  suggestedControls: SuggestedControl[];
  appliedControls: AppliedControl[];
  primaryButtonClassName: string;
  softButtonClassName: string;
  onRefreshSuggestions: () => void;
  onCalculateResidual: () => void;
  onApplySuggestion: (riskId: string, suggestion: SuggestedControl) => Promise<void>;
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
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#00338D]">Controls</p>
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0C233C]">Apply Controls To Risks</h2>
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

export default function ApplyControlToRiskPage({
  risks,
  suggestedControls,
  appliedControls,
  primaryButtonClassName,
  softButtonClassName,
  onRefreshSuggestions,
  onCalculateResidual,
  onApplySuggestion,
}: ApplyControlToRiskPageProps) {
  return (
    <SectionShell
      action={
        <div className="flex flex-wrap gap-2" data-risk-assessment-controls="true">
          <button className={softButtonClassName} onClick={onRefreshSuggestions}>
            <RefreshCw className="h-4 w-4" />
            Refresh Suggestions
          </button>
          <button className={primaryButtonClassName} onClick={onCalculateResidual}>
            Calculate Residual
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {risks.length > 0 ? (
        <div className="risk-controls-glass-stage space-y-5 rounded-[22px] border p-4">
          {risks.map((risk) => {
            const suggestions = suggestedControls.filter((suggestion) => suggestion.risk_id === risk.id);
            const applied = appliedControls.filter((control) => control.risk_id === risk.id);
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
                    {applied.length} applied - {suggestions.length} suggested
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
                        onApply={() => onApplySuggestion(risk.id, suggestion)}
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
    </SectionShell>
  );
}
