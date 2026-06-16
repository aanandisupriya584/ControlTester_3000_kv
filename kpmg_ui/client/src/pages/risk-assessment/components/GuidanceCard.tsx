import { CheckCircle2, HelpCircle, Lightbulb } from "lucide-react";

type GuidanceCardProps = {
  answeredQuestions: number;
  totalQuestions: number;
};

// Shows questionnaire guidance and the small completion checklist beside the workspace.
export function GuidanceCard({
  answeredQuestions,
  totalQuestions,
}: GuidanceCardProps) {
  const answerPct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  return (
    <aside className="space-y-4">
      <section className="rounded-[8px] border border-[#D8E0ED] bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-[#0C233C]">Guidance</h3>
          <HelpCircle className="h-4 w-4 text-[#8492A6]" />
        </div>
        <p className="mb-4 text-[12px] leading-5 text-[#5A6478]">Answer each question based on the current state of controls for the selected asset.</p>
        <div className="space-y-3 rounded-[6px] border border-[#D8E8FF] bg-[#F8FBFF] p-3">
          {["Provide accurate and factual responses.", "Select Yes, No, or NA for each question.", "You can save progress anytime and return later."].map((item) => (
            <div key={item} className="flex gap-2 text-[12px] leading-5 text-[#0C233C]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1E49E2]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[8px] border border-[#D8E0ED] bg-white p-5">
        <h3 className="mb-4 text-[15px] font-bold text-[#0C233C]">Completion checklist</h3>
        {[
          ["Questions answered", answeredQuestions, totalQuestions, "#009A44", answerPct],
          ["Ready for risk review", answeredQuestions >= totalQuestions && totalQuestions > 0 ? 1 : 0, 1, "#8492A6", answeredQuestions >= totalQuestions && totalQuestions > 0 ? 100 : 0],
        ].map(([label, current, total, color, pct]) => (
          <div key={String(label)} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {Number(pct) >= 100 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#009A44]" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-[#B4C1D6]" />
                )}
                <span className="text-[12px] font-semibold text-[#0C233C]">{label}</span>
              </div>
              <span className="text-[11px] font-bold text-[#6E7787]">{current} / {total}</span>
            </div>
            <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-[#E8EDF5]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: String(color) }} />
            </div>
          </div>
        ))}
        <div className="mt-5 rounded-[6px] border border-[#F6D3A0] bg-[#FFFBEE] p-3">
          <div className="flex gap-2 text-[12px] leading-5 text-[#7A5E00]">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Complete all questions to proceed to Risk Review.</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

