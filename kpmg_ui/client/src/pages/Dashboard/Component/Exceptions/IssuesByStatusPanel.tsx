import OverviewBarChart from "../Overview/OverviewBarChart";
import ExceptionPanelCard from "./ExceptionPanelCard";
import type { ExceptionChartDatum } from "./exceptions.types";

export default function IssuesByStatusPanel({ data, total }: { data: ExceptionChartDatum[]; total: string }) {
  return (
    <ExceptionPanelCard title="Issues By Status" footerLabel="Open Issues" footerValue={total}>
      <OverviewBarChart data={data} />
    </ExceptionPanelCard>
  );
}
