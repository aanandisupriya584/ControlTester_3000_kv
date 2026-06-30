import OverviewDonutChart from "../Overview/OverviewDonutChart";
import type { OverviewChartDatum } from "../Overview/overview.types";
import WorkflowPanelCard from "./WorkflowPanelCard";

export default function ReportsByTypePanel({ data, total }: { data: OverviewChartDatum[]; total: string }) {
  return (
    <WorkflowPanelCard title="Reports By Type" footerLabel="Generated Reports" footerValue={total}>
      <OverviewDonutChart data={data} />
    </WorkflowPanelCard>
  );
}
