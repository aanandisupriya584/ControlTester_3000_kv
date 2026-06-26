import type { OverviewKpiItem, OverviewTone } from "./overview.types";

const TONE_COLORS: Record<OverviewTone, string> = {
  blue: "#1E49E2",
  cyan: "#00B8F5",
  purple: "#7213EA",
  green: "#009A44",
  amber: "#EAAA00",
  red: "#E5001B",
  navy: "#00338D",
  teal: "#098E7E",
};

const TONE_TINTS: Record<OverviewTone, string> = {
  blue: "#EEF2FF",
  cyan: "#EFF8FF",
  purple: "#F3F0FF",
  green: "#EDFBF5",
  amber: "#FFFBEB",
  red: "#FEEBED",
  navy: "#EEF2FF",
  teal: "#E6F4F2",
};

export default function OverviewKpiCard({ label, value, subLabel, badge, tone, onClick }: OverviewKpiItem) {
  const accent = TONE_COLORS[tone];

  return (
    <button
      type="button"
      data-dashboard-kpi-style="reference-number-card"
      onClick={onClick}
      className="group relative min-h-[168px] overflow-hidden rounded-[18px] border border-[#D9E1EC] bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="absolute left-0 right-0 top-0 h-[3px] rounded-t-[18px]" style={{ background: accent }} />
      <p className="text-[11px] font-bold uppercase leading-4 tracking-[2.2px] text-[#8492A6]">{label}</p>
      <p className="mt-4 text-[42px] font-bold leading-none tracking-tight text-[#0C233C]">{value}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-[#6B7890]">{subLabel}</p>
      {badge ? (
        <span
          className="mt-4 inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-bold"
          style={{ background: TONE_TINTS[tone], color: accent }}
        >
          <span className="truncate">{badge}</span>
        </span>
      ) : null}
    </button>
  );
}
