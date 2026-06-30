import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  GRID_STYLE,
} from "@/lib/chartTheme";
import OverviewEmptyChart from "../Overview/OverviewEmptyChart";
import LibraryPanelCard from "./LibraryPanelCard";
import type { LibraryDomainDatum } from "./libraries.types";

function shortenLabel(value: string, maxChars: number) {
  const trimmed = value.trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

export default function LibraryDomainCoveragePanel({
  data,
  coverage,
}: {
  data: LibraryDomainDatum[];
  coverage: string;
}) {
  return (
    <LibraryPanelCard title="Domain Coverage" footerLabel="Obligation Coverage" footerValue={coverage}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -2, bottom: 50 }} barCategoryGap="18%">
            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              dataKey="domain"
              tick={{ ...AXIS_STYLE, fontSize: 10 }}
              angle={-28}
              textAnchor="end"
              height={82}
              tickMargin={14}
              interval={0}
              tickFormatter={value => shortenLabel(String(value), 18)}
            />
            <YAxis tick={{ ...AXIS_STYLE, fontSize: 10 }} width={30} allowDecimals={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} cursor={{ fill: "var(--osint-glow)" }} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 11, fontFamily: "Arial, sans-serif", paddingBottom: 8 }} />
            <Bar dataKey="Regulations" fill="#00338D" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
            <Bar dataKey="Controls" fill="#1E49E2" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={980} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      ) : <OverviewEmptyChart />}
    </LibraryPanelCard>
  );
}
