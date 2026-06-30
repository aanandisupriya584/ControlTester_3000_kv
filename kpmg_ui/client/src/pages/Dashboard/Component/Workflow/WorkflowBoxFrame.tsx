import type { ReactNode } from "react";

export type WorkflowBoxMetric = {
  label: string;
  value: string;
};

export default function WorkflowBoxFrame({
  title,
  metrics,
  accent,
  tint,
  icon,
  onClick,
}: {
  title: string;
  metrics: WorkflowBoxMetric[];
  accent: string;
  tint: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden rounded-lg border border-[#D9E1EC] bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="absolute left-0 right-0 top-0 h-1" style={{ background: accent }} />
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: tint, color: accent }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold uppercase tracking-[0.4px] text-[#0C233C]">{title}</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {metrics.map(metric => (
              <div key={metric.label}>
                <p className="text-[22px] font-bold leading-none" style={{ color: accent }}>{metric.value}</p>
                <p className="mt-1 text-[11px] text-[#8492A6]">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
