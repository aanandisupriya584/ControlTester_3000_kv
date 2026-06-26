import OverviewBarChart from "./OverviewBarChart";
import OverviewChartCard from "./OverviewChartCard";
import type { OverviewChartDatum } from "./overview.types";

export default function AssetsCriticalityPanel({
  title,
  data,
  totalAssets,
}: {
  title: string;
  data: OverviewChartDatum[];
  totalAssets: string;
}) {
  return (
    <OverviewChartCard title={title} footerLabel="Total Assets" footerValue={totalAssets}>
      <OverviewBarChart data={data} />
    </OverviewChartCard>
  );
}
