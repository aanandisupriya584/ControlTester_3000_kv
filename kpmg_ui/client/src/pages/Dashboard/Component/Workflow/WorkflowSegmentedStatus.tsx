import type { CSSProperties } from "react";
import OverviewEmptyChart from "../Overview/OverviewEmptyChart";
import type { OverviewChartDatum } from "../Overview/overview.types";

export default function WorkflowSegmentedStatus({ data }: { data: OverviewChartDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return <OverviewEmptyChart />;

  return (
    <div className="space-y-5">
      <div className="flex h-11 overflow-hidden rounded-md border border-[#D9E1EC]">
        {data.filter(item => item.value > 0).map((item, index) => {
          const percentage = (item.value / total) * 100;
          const style: CSSProperties = {
            width: `${percentage}%`,
            background: item.fill,
            animation: `dashboardScaleX 950ms cubic-bezier(0.2, 1, 0.3, 1) ${index * 90}ms both`,
            transformOrigin: "left",
          };

          return (
            <div
              key={item.name}
              className="flex min-w-[42px] items-center justify-center border-r border-white/60 text-[12px] font-bold text-white last:border-r-0"
              style={style}
              title={`${item.name}: ${item.value.toLocaleString()}`}
            >
              {Math.round(percentage)}%
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {data.map(item => (
          <div key={item.name} className="flex items-center gap-2 text-[12px] text-[#5A6478]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
