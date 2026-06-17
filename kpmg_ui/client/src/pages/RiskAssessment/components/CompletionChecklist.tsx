import type { ReactNode } from "react";
import { CheckCircle2, Lightbulb } from "lucide-react";

interface CompletionChecklistProps {
  answeredQuestions: number;
  totalQuestions: number;
  actions?: ReactNode;
}

export default function CompletionChecklist({
  answeredQuestions,
  totalQuestions,
  actions,
}: CompletionChecklistProps) {
  const answerPct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const readyForRiskReview = answeredQuestions >= totalQuestions && totalQuestions > 0;
  const rows = [
    ["Questions answered", answeredQuestions, totalQuestions, "#009A44", answerPct],
    ["Ready for risk review", readyForRiskReview ? 1 : 0, 1, "#8492A6", readyForRiskReview ? 100 : 0],
  ] as const;

  return (
    <section className={`${actions ? "" : "flex flex-1 flex-col"} rounded-[8px] border border-[#D8E0ED] bg-white p-4`}>
      <h3 className="mb-3 text-[15px] font-bold text-[#0C233C]">Completion checklist</h3>
      {rows.map(([label, current, total, color, pct]) => (
        <div key={label} className="mb-3 last:mb-0">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {pct >= 100 ? (
                <CheckCircle2 className="h-4 w-4 text-[#009A44]" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-[#B4C1D6]" />
              )}
              <span className="text-[12px] font-semibold text-[#0C233C]">{label}</span>
            </div>
            <span className="text-[11px] font-bold text-[#6E7787]">{current} / {total}</span>
          </div>
          <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-[#E8EDF5]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}
      <div className={`${actions ? "mt-4" : "mt-auto"} rounded-[6px] border border-[#F6D3A0] bg-[#FFFBEE] p-2.5`}>
        <div className="flex gap-2 text-[12px] leading-5 text-[#7A5E00]">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Complete all questions to proceed to Risk Review.</span>
        </div>
      </div>
      {actions ? <div className="mt-3 flex flex-col gap-2.5">{actions}</div> : null}
    </section>
  );
}
