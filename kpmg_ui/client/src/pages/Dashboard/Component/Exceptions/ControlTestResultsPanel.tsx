import OverviewBarChart from "../Overview/OverviewBarChart";
import ExceptionPanelCard from "./ExceptionPanelCard";
import type { ExceptionChartDatum } from "./exceptions.types";

export default function ControlTestResultsPanel({ data, total }: { data: ExceptionChartDatum[]; total: string }) {
  return (
    <ExceptionPanelCard title="Control Test Results" footerLabel="Failed Controls" footerValue={total}>
      <OverviewBarChart data={data} />
    </ExceptionPanelCard>
  );
}
