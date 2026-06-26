export default function OverviewEmptyChart({ label = "No Records" }: { label?: string }) {
  return (
    <div className="flex h-[230px] items-center justify-center rounded-xl border border-dashed border-[#E2E6EF] bg-[#F8FAFC] text-[13px] font-semibold text-[#8492A6]">
      {label}
    </div>
  );
}
