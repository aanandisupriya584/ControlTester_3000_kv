import type { CSSProperties } from "react";
import OverviewEmptyChart from "./OverviewEmptyChart";
import { clampOverviewPercent, formatOverviewPercent } from "./overviewFormatters";
import type { OverviewChartDatum } from "./overview.types";

function hasChartData(data: OverviewChartDatum[]) {
  return data.some(item => item.value > 0);
}

export default function OverviewHorizontalPercentPanel({ data }: { data: OverviewChartDatum[] }) {
  if (!hasChartData(data)) return <OverviewEmptyChart />;

  return (
    <div className="space-y-4">
      {data.map((item, index) => {
        const width = clampOverviewPercent(item.value);
        const animationStyle: CSSProperties = {
          width: `${width}%`,
          background: item.fill,
          transformOrigin: "left",
          animation: `dashboardScaleX 900ms cubic-bezier(0.2, 1, 0.3, 1) ${index * 90}ms both`,
        };

        return (
          <div key={item.name} className="grid grid-cols-[110px_1fr_44px] items-center gap-3 text-[12px]">
            <span className="truncate font-semibold text-[#0C233C]">{item.name}</span>
            <div className="h-8 overflow-hidden rounded-md bg-[#EEF2FF]">
              <div className="h-full rounded-md" style={animationStyle} />
            </div>
            <span className="text-right font-bold text-[#0C233C]">{formatOverviewPercent(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
