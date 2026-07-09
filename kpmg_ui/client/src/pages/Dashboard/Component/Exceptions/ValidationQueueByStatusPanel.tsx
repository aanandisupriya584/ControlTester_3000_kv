import OverviewBarChart from "../Overview/OverviewBarChart";
import ExceptionPanelCard from "./ExceptionPanelCard";
import type { ExceptionChartDatum } from "./exceptions.types";

export default function ValidationQueueByStatusPanel({ data, total }: { data: ExceptionChartDatum[]; total: string }) {
  return (
    <ExceptionPanelCard title="Validation Queue By Status" footerLabel="Pending Queue" footerValue={total}>
      <OverviewBarChart data={data} />
    </ExceptionPanelCard>
  );
}
