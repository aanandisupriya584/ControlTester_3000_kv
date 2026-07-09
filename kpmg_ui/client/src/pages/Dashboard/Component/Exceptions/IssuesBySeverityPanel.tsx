import OverviewBarChart from "../Overview/OverviewBarChart";
import ExceptionPanelCard from "./ExceptionPanelCard";
import type { ExceptionChartDatum } from "./exceptions.types";

export default function IssuesBySeverityPanel({ data, total }: { data: ExceptionChartDatum[]; total: string }) {
  return (
    <ExceptionPanelCard title="Issues By Severity" footerLabel="Total Issues" footerValue={total}>
      <OverviewBarChart data={data} />
    </ExceptionPanelCard>
  );
}
