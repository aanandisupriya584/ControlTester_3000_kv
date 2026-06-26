import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from "@/lib/chartTheme";
import OverviewEmptyChart from "./OverviewEmptyChart";
import { formatOverviewNumber } from "./overviewFormatters";
import type { OverviewChartDatum } from "./overview.types";

function hasChartData(data: OverviewChartDatum[]) {
  return data.some(item => item.value > 0);
}

export default function OverviewDonutChart({ data }: { data: OverviewChartDatum[] }) {
  if (!hasChartData(data)) return <OverviewEmptyChart />;

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-5 xl:grid-cols-[170px_minmax(0,1fr)] xl:items-center">
      <div className="rounded-[18px] border border-[#EEF2F7] bg-[#FBFCFE] p-3">
        <div className="relative mx-auto aspect-square w-full max-w-[158px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="92%"
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                isAnimationActive
                animationDuration={1050}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[28px] font-bold leading-none tracking-tight text-[#0C233C]">{formatOverviewNumber(total)}</div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-[2px] text-[#8492A6]">Total</div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-h-[212px] space-y-2.5 overflow-auto pr-1">
        {data.filter(item => item.value > 0).map(item => (
          <div key={item.name} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
            <span className="truncate text-[#0C233C]">{item.name}</span>
            <span className="font-bold text-[#0C233C]">
              {formatOverviewNumber(item.value)} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
