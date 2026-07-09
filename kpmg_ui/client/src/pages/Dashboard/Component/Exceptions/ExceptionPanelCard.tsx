import type { ReactNode } from "react";

export default function ExceptionPanelCard({
  title,
  footerLabel,
  footerValue,
  children,
}: {
  title: string;
  footerLabel: string;
  footerValue: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[#D9E1EC] bg-white p-7 shadow-sm">
      <div className="mb-3">
        <h3 className="text-[17px] font-bold tracking-tight text-[#0C233C]">{title}</h3>
      </div>
      {children}
      <div className="mt-4 flex items-center justify-between border-t border-[#E2E6EF] pt-3 text-[12px]">
        <span className="text-[#5A6478]">{footerLabel}</span>
        <span className="font-bold text-[#0C233C]">{footerValue}</span>
      </div>
    </section>
  );
}
