import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AXIS_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  GRID_STYLE,
} from "@/lib/chartTheme";
import OverviewEmptyChart from "./OverviewEmptyChart";
import { shortenOverviewAxisLabel } from "./overviewFormatters";
import type { OverviewBarLabelMode, OverviewChartDatum } from "./overview.types";

function hasChartData(data: OverviewChartDatum[]) {
  return data.some(item => item.value > 0);
}

export default function OverviewBarChart({
  data,
  height = 210,
  labelMode = "default",
}: {
  data: OverviewChartDatum[];
  height?: number;
  labelMode?: OverviewBarLabelMode;
}) {
  if (!hasChartData(data)) return <OverviewEmptyChart />;

  const rotate = labelMode === "rotate";
  const compact = labelMode === "compact";
  const xAxisHeight = rotate ? 76 : 40;
  const tickFontSize = compact ? 9 : 10;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -4, bottom: rotate ? 28 : 12 }} barCategoryGap={compact ? "22%" : "18%"}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis
          dataKey="name"
          tick={{ ...AXIS_STYLE, fontSize: tickFontSize }}
          interval={0}
          tickMargin={rotate ? 14 : 10}
          height={xAxisHeight}
          angle={rotate ? -28 : 0}
          textAnchor={rotate ? "end" : "middle"}
          tickFormatter={value => shortenOverviewAxisLabel(String(value), rotate ? 18 : compact ? 12 : 16)}
          minTickGap={compact ? 4 : 8}
        />
        <YAxis tick={{ ...AXIS_STYLE, fontSize: 10 }} width={30} allowDecimals={false} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} cursor={{ fill: "var(--osint-glow)" }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out">
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
