import OverviewBarChart from "../Overview/OverviewBarChart";
import type { OverviewChartDatum } from "../Overview/overview.types";
import WorkflowPanelCard from "./WorkflowPanelCard";

export default function ControlTestResultsPanel({ data, total }: { data: OverviewChartDatum[]; total: string }) {
  return (
    <WorkflowPanelCard title="Control Test Results" footerLabel="Controls In Sessions" footerValue={total}>
      <OverviewBarChart data={data} />
    </WorkflowPanelCard>
  );
}
