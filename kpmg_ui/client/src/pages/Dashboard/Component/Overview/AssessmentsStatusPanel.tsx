import OverviewBarChart from "./OverviewBarChart";
import OverviewChartCard from "./OverviewChartCard";
import type { OverviewChartDatum } from "./overview.types";

export default function AssessmentsStatusPanel({
  title,
  data,
  totalAssessments,
}: {
  title: string;
  data: OverviewChartDatum[];
  totalAssessments: string;
}) {
  return (
    <OverviewChartCard title={title} footerLabel="Total Assessments" footerValue={totalAssessments}>
      <OverviewBarChart data={data} labelMode="rotate" height={226} />
    </OverviewChartCard>
  );
}
