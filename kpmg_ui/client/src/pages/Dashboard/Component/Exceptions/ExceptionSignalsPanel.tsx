import WorkflowSegmentedStatus from "../Workflow/WorkflowSegmentedStatus";
import ExceptionPanelCard from "./ExceptionPanelCard";
import type { ExceptionChartDatum } from "./exceptions.types";

export default function ExceptionSignalsPanel({ data, total }: { data: ExceptionChartDatum[]; total: string }) {
  return (
    <ExceptionPanelCard title="Exception Signals" footerLabel="Total Signals" footerValue={total}>
      <WorkflowSegmentedStatus data={data} />
    </ExceptionPanelCard>
  );
}
