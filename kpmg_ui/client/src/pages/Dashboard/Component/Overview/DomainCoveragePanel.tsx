import OverviewChartCard from "./OverviewChartCard";
import OverviewHorizontalPercentPanel from "./OverviewHorizontalPercentPanel";
import type { OverviewChartDatum } from "./overview.types";

export default function DomainCoveragePanel({
  title,
  data,
  gapObligations,
}: {
  title: string;
  data: OverviewChartDatum[];
  gapObligations: string;
}) {
  return (
    <OverviewChartCard title={title} footerLabel="Gap Obligations" footerValue={gapObligations}>
      <OverviewHorizontalPercentPanel data={data} />
    </OverviewChartCard>
  );
}
