import OverviewBarChart from "../Overview/OverviewBarChart";
import type { OverviewChartDatum } from "../Overview/overview.types";
import WorkflowPanelCard from "./WorkflowPanelCard";

export default function SopCasesByStatusPanel({ data, total }: { data: OverviewChartDatum[]; total: string }) {
  return (
    <WorkflowPanelCard title="SOP Cases By Status" footerLabel="Total Cases" footerValue={total}>
      <OverviewBarChart data={data} />
    </WorkflowPanelCard>
  );
}
