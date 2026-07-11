import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowRight, Info, Loader2, Sparkles, X } from "lucide-react";
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

const SCORE_LABEL: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Medium", 4: "High", 5: "Very High" };
const SCORE_COLOR: Record<number, string> = {
  1: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
  2: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
  3: "border-[#F8E8B7] bg-[#FFF9E8] text-[#8A6A00]",
  4: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  5: "border-[#F3C6CF] bg-[#FEEBED] text-[#E5001B]",
};

function ScorePill({ label, score }: { label: string; score: number }) {
  const clampedScore = Math.min(5, Math.max(1, Math.round(score))) as 1 | 2 | 3 | 4 | 5;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6478]">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-[6px] border px-2.5 py-1 text-[12px] font-bold ${SCORE_COLOR[clampedScore]}`}>
          {SCORE_LABEL[clampedScore]}
        </span>
        <span className="text-[12px] font-semibold text-[#7388A8]">{score}/5</span>
      </div>
      {/* mini 5-dot bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${
              n <= clampedScore
                ? clampedScore <= 2
                  ? "bg-[#009A44]"
                  : clampedScore === 3
                    ? "bg-[#F0A500]"
                    : "bg-[#E5001B]"
                : "bg-[#DCE3EE]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function AgentRationalePanel({ risk, onClose }: { risk: Risk; onClose: () => void }) {
  const hasRegs = (risk.applicable_regulations?.length ?? 0) > 0;
  const hasQuestions = (risk.source_questions?.length ?? 0) > 0;
  const hasDomain = Boolean(risk.recommended_control_domain);
  const hasCategory = Boolean(risk.risk_category);
  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-[#C9D7FF] bg-[#F8FBFF]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#DCE8FF] bg-[#EEF2FF] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#1E49E2]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E49E2]">Agent Risk Reasoning</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[#7388A8] hover:bg-white hover:text-[#1E49E2]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Scoring breakdown */}
        <div>
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6478]">Risk scoring breakdown</p>
          <div className="grid grid-cols-3 gap-3">
            <ScorePill label="Likelihood" score={risk.likelihood_score} />
            <ScorePill label="Impact" score={risk.impact_score} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6478]">Overall score</span>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-[6px] border px-2.5 py-1 text-[12px] font-bold ${BAND_CLASS[risk.inherent_risk_band] ?? BAND_CLASS.Medium}`}>
                  {risk.inherent_risk_band}
                </span>
                <span className="text-[12px] font-semibold text-[#7388A8]">{risk.inherent_risk_score}</span>
              </div>
              <p className="text-[11px] leading-4 text-[#7388A8]">Likelihood × Impact</p>
            </div>
          </div>
        </div>

        {/* Risk category */}
        {hasCategory ? (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6478]">Risk category</p>
            <span className="inline-flex items-center rounded-[6px] border border-[#D8E0ED] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#0C233C]">
              {risk.risk_category}
            </span>
          </div>
        ) : null}

        {/* Evidence — which questionnaire answers triggered this */}
        {hasQuestions ? (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6478]">
              Triggered by questionnaire answers
            </p>
            <p className="mb-2 text-[11px] leading-5 text-[#7388A8]">
              These question responses were the key evidence the agent used to identify this risk.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {risk.source_questions!.map((qid) => (
                <span key={qid} className="inline-flex items-center rounded-[6px] border border-[#C9D7FF] bg-white px-2 py-0.5 font-mono text-[11px] text-[#1E49E2]">
                  {qid}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Applicable regulations */}
        {hasRegs ? (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6478]">Applicable regulatory obligations</p>
            <p className="mb-2 text-[11px] leading-5 text-[#7388A8]">
              The agent matched this risk against the following frameworks or regulations in your library.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {risk.applicable_regulations!.map((reg, i) => (
                <span key={i} className="inline-flex items-center rounded-[6px] border border-[#F6D3A0] bg-[#FFF4E8] px-2.5 py-1 text-[11px] font-semibold text-[#AB5C00]">
                  {reg}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Recommended control domain */}
        {hasDomain ? (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6478]">Recommended control domain</p>
            <p className="mb-2 text-[11px] leading-5 text-[#7388A8]">
              The agent recommends applying controls from this domain to mitigate the identified risk.
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#C9D7FF] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#1E49E2]">
              <Info className="h-3 w-3" />
              {risk.recommended_control_domain}
            </span>
          </div>
        ) : null}

        {!hasQuestions && !hasRegs && !hasDomain && !hasCategory ? (
          <p className="text-[12px] text-[#7388A8]">No detailed agent reasoning captured for this risk.</p>
        ) : null}
      </div>
    </div>
  );
}

function RiskSummaryCard({ risk }: { risk: Risk }) {
  const [showRationale, setShowRationale] = useState(false);
  const isAgentRisk = risk.source === "agentic_pipeline";
  return (
    <div className="rounded-[20px] border border-[#DCE3EE] bg-white p-5 shadow-[0_16px_34px_-30px_rgba(12,35,60,0.28)]">
      {/* Grid: [title+desc takes remaining space] [ℹ fixed 28px] [band fixed 80px] */}
      <div className="grid grid-cols-[minmax(0,1fr)_28px_80px] items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold tracking-[-0.02em] text-[#0C233C]">{risk.title}</h3>
          <p className="mt-2 text-[13px] leading-6 text-[#5A6478]">{risk.description}</p>
        </div>
        {/* ℹ column — fixed 28px, always reserved so band column stays aligned across all cards */}
        <div className="flex h-7 w-7 items-center justify-center">
          {isAgentRisk ? (
            <button
              type="button"
              onClick={() => setShowRationale((v) => !v)}
              title="Agent reasoning for this risk"
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                showRationale
                  ? "border-[#1E49E2] bg-[#EEF2FF] text-[#1E49E2]"
                  : "border-[#DCE3EE] bg-white text-[#8492A6] hover:border-[#1E49E2] hover:bg-[#EEF2FF] hover:text-[#1E49E2]"
              }`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {/* Band column — fixed 80px, right-aligned so the badge sits at the far right */}
        <div className="flex items-start justify-end">
          <BandBadge band={risk.inherent_risk_band} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[#7388A8]">
        <span>Likelihood {risk.likelihood_score}/5</span>
        <span>Impact {risk.impact_score}/5</span>
        <span>Score {risk.inherent_risk_score}</span>
        <span>{risk.risk_category}</span>
      </div>
      {showRationale ? <AgentRationalePanel risk={risk} onClose={() => setShowRationale(false)} /> : null}
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
          {/*
            Horizontal loading bar retained for reference but intentionally not rendered.
            Keep only the circular spinner below as the active loading indicator.

            <div className="mx-auto mt-7 max-w-[420px] overflow-hidden rounded-full bg-[#DCE3EE]">
              <div className="h-3 w-[58%] rounded-full bg-[linear-gradient(90deg,#1E49E2_0%,#00B8F5_100%)]" />
            </div>
          */}
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
