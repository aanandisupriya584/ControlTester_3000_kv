import type { OverviewChartDatum } from "../Overview/overview.types";
import WorkflowPanelCard from "./WorkflowPanelCard";
import WorkflowSegmentedStatus from "./WorkflowSegmentedStatus";

export default function TestingSessionsByStatusPanel({ data, total }: { data: OverviewChartDatum[]; total: string }) {
  return (
    <WorkflowPanelCard title="Testing Sessions By Status" footerLabel="Total Sessions" footerValue={total}>
      <WorkflowSegmentedStatus data={data} />
    </WorkflowPanelCard>
  );
}
