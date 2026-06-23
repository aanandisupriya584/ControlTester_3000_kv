import { ArrowRight } from "lucide-react";
import { TracePanel } from "@/components/TraceAnalysisPrimitives";
import { Badge } from "@/components/ui/badge";
import type { RiskAssessment } from "@/contexts/RiskAssessmentContext";

interface AssessmentSummaryFormProps {
  assessment: RiskAssessment;
  primaryButtonClassName: string;
  assetName: (id: string) => string;
  onStartQuestionnaire: () => void;
}

export default function AssessmentSummaryForm({
  assessment,
  primaryButtonClassName,
  assetName,
  onStartQuestionnaire,
}: AssessmentSummaryFormProps) {
  return (
    <section className="rounded-[24px] border border-[#DCE3EE] bg-white p-6 shadow-[0_18px_42px_-34px_rgba(12,35,60,0.26)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#00338D]">Scope</p>
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[#0C233C]">Assessment Summary</h2>
        </div>
        {assessment.asset_ids.length > 0 ? (
          <button className={primaryButtonClassName} onClick={onStartQuestionnaire}>
            Start Questionnaire
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <TracePanel
          title="Applications In Scope"
          subtitle="Asset Registry applications drive the questionnaire path for this assessment."
          className="risk-summary-scope-glass-panel"
        >
          <div className="flex flex-wrap gap-2">
            {assessment.asset_ids.length > 0 ? (
              assessment.asset_ids.map((assetId) => (
                <Badge
                  key={assetId}
                  variant="outline"
                  className="risk-summary-scope-badge rounded-full border-[#AFC1F8] bg-[#EAF2FF] px-3 py-1.5 text-[12px] font-bold text-[#0C233C]"
                >
                  {assetName(assetId)}
                </Badge>
              ))
            ) : (
              <div className="text-[13px] text-[#7388A8]">No Asset Registry applications selected.</div>
            )}
          </div>
          {assessment.ad_hoc_applications?.length ? (
            <div className="mt-4 border-t border-[#E2E6EF] pt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7E91AE]">
                Ad Hoc Applications
              </p>
              <div className="space-y-2">
                {assessment.ad_hoc_applications.map((application, index) => (
                  <div
                    key={`${application.name}-${index}`}
                    className="rounded-[16px] border border-[#E2E6EF] bg-[#FBFCFE] px-4 py-3"
                  >
                    <p className="text-[13px] font-bold text-[#0C233C]">{application.name}</p>
                    <p className="mt-1 text-[12px] text-[#7388A8]">
                      {application.assessment_context || application.description || "Added as scope context"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </TracePanel>

        <TracePanel
          title="Readiness"
          subtitle="Questionnaire can begin once at least one registry application is in scope."
          className="risk-summary-readiness-glass-panel"
        >
          <div className="space-y-3">
            <div className="rounded-[18px] bg-[#F7F9FC] px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8492A6]">Registry Applications</div>
              <div className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#0C233C]">
                {assessment.asset_ids.length}
              </div>
            </div>
            <div className="rounded-[18px] bg-[#F7F9FC] px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8492A6]">Ad Hoc Context Entries</div>
              <div className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#0C233C]">
                {assessment.ad_hoc_applications?.length ?? 0}
              </div>
            </div>
            {assessment.asset_ids.length === 0 ? (
              <div className="rounded-[16px] border border-[#F6D3A0] bg-[#FFF9E8] px-4 py-3 text-[12px] leading-6 text-[#8A6A00]">
                Questionnaire capture currently runs against Asset Registry applications only.
              </div>
            ) : null}
          </div>
        </TracePanel>
      </div>
    </section>
  );
}
