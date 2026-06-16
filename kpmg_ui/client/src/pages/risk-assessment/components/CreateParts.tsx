type CommandDeckMetricProps = {
  label: string;
  value: string | number;
  detail: string;
};

// Compact metric block used in the create assessment dialog.
export function CommandDeckMetric({
  label,
  value,
  detail,
}: CommandDeckMetricProps) {
  return (
    <div className="min-h-[180px] rounded-[8px] border border-[#D6E0EF] bg-[#F8FAFD] px-4 py-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#50627F]">{label}</div>
      <div className="mt-5 text-[30px] font-bold tracking-[-0.04em] text-[#001B3A]">{value}</div>
      <div className="mt-4 text-[12px] leading-6 text-[#33415C]">{detail}</div>
    </div>
  );
}

