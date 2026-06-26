import OverviewBarChart from "./OverviewBarChart";
import OverviewChartCard from "./OverviewChartCard";
import type { OverviewChartDatum } from "./overview.types";

export default function IssuesSeverityPanel({
  title,
  data,
  totalIssues,
}: {
  title: string;
  data: OverviewChartDatum[];
  totalIssues: string;
}) {
  return (
    <OverviewChartCard title={title} footerLabel="Total Issues" footerValue={totalIssues}>
      <OverviewBarChart data={data} />
    </OverviewChartCard>
  );
}
