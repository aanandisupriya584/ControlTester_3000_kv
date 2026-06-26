import OverviewChartCard from "./OverviewChartCard";
import OverviewDonutChart from "./OverviewDonutChart";
import type { OverviewChartDatum } from "./overview.types";

export default function ReportsTypePanel({
  title,
  data,
  totalReports,
}: {
  title: string;
  data: OverviewChartDatum[];
  totalReports: string;
}) {
  return (
    <OverviewChartCard title={title} footerLabel="Total Reports" footerValue={totalReports}>
      <OverviewDonutChart data={data} />
    </OverviewChartCard>
  );
}
