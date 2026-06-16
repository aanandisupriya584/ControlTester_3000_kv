import { ArrowRight, FileBarChart, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { TracePanel } from "@/components/TraceAnalysisPrimitives";
import type {
  ResidualResult,
  RiskAssessment,
  SuggestedControl,
} from "@/contexts/RiskAssessmentContext";
import { BandBadge } from "./Badges";
import {
  AppliedControlChip,
  ResidualCard,
  RiskSummaryCard,
  SuggestedControlRow,
  SurfaceSection,
} from "./WorkflowParts";

// Shows the in-progress analysis screen while risk identification is running.
export function AnalysisStep() {
  return (
    <SurfaceSection eyebrow="Analysis" title="Running Risk Analysis" data-risk-assessment-analysis="true">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
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
    </SurfaceSection>
  );
}

type RiskReviewStepProps = {
  assessment: RiskAssessment;
  primaryButtonClassName: string;
  onApplyControls: () => void;
};

// Lists identified inherent risks before control mapping.
export function RiskReviewStep({
  assessment,
  primaryButtonClassName,
  onApplyControls,
}: RiskReviewStepProps) {
  return (
    <SurfaceSection
      eyebrow="Risks"
      title={`Identified Risks (${assessment.risks.length})`}
      action={
        <button className={primaryButtonClassName} onClick={onApplyControls} data-risk-assessment-risks="true">
          Apply Controls
          <ArrowRight className="h-4 w-4" />
        </button>
      }
    >
      {assessment.risks.length > 0 ? (
        <div className="risk-identified-glass-list grid gap-4 rounded-[22px] border p-4">
          {assessment.risks.map((risk) => (
            <RiskSummaryCard key={risk.id} risk={risk} />
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
          No risks have been identified for this assessment yet.
        </div>
      )}
    </SurfaceSection>
  );
}

type ControlsStepProps = {
  assessment: RiskAssessment;
  primaryButtonClassName: string;
  softButtonClassName: string;
  onRefreshSuggestions: () => void;
  onCalculateResidual: () => void;
  onApplySuggestion: (riskId: string, suggestion: SuggestedControl) => Promise<void>;
};

// Shows suggested controls for each risk and lets users apply them.
export function ControlsStep({
  assessment,
  primaryButtonClassName,
  softButtonClassName,
  onRefreshSuggestions,
  onCalculateResidual,
  onApplySuggestion,
}: ControlsStepProps) {
  return (
    <SurfaceSection
      eyebrow="Controls"
      title="Apply Controls To Risks"
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
      {assessment.risks.length > 0 ? (
        <div className="risk-controls-glass-stage space-y-5 rounded-[22px] border p-4">
          {assessment.risks.map((risk) => {
            const suggestions = (assessment.suggested_controls ?? []).filter(
              (suggestion) => suggestion.risk_id === risk.id,
            );
            const applied = assessment.applied_controls.filter((control) => control.risk_id === risk.id);
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
    </SurfaceSection>
  );
}

type ResidualStepProps = {
  residualResults: ResidualResult[];
  primaryButtonClassName: string;
  softButtonClassName: string;
  onRefreshResidual: () => void;
  onGenerateReport: () => void;
};

// Shows residual risk scores after controls are applied.
export function ResidualStep({
  residualResults,
  primaryButtonClassName,
  softButtonClassName,
  onRefreshResidual,
  onGenerateReport,
}: ResidualStepProps) {
  return (
    <SurfaceSection
      eyebrow="Residual"
      title="Residual Risk Review"
      action={
        <div className="flex flex-wrap gap-2" data-risk-assessment-residual="true">
          <button className={softButtonClassName} onClick={onRefreshResidual}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button className={primaryButtonClassName} onClick={onGenerateReport}>
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
  );
}

type FinalReportStepProps = {
  currentReport: string | null;
  isGeneratingReport: boolean;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  onCancel: () => void;
  onGenerateReport: () => void;
  onViewReport: () => void;
};

// Final stage that generates the report and opens the report preview.
export function FinalReportStep({
  currentReport,
  isGeneratingReport,
  primaryButtonClassName,
  secondaryButtonClassName,
  onCancel,
  onGenerateReport,
  onViewReport,
}: FinalReportStepProps) {
  return (
    <SurfaceSection
      eyebrow="Report"
      title="Risk Assessment Report"
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
          {currentReport
            ? "The report is ready. Open the preview popup to review the formatted output."
            : "Generate the report to open the formatted assessment output in a preview popup."}
        </p>
        {currentReport ? (
          <button className="risk-view-report-glass-button mt-5" onClick={onViewReport}>
            View Report
          </button>
        ) : null}
      </div>
    </SurfaceSection>
  );
}

