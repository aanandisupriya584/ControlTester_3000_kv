import OverviewBarChart from "../Overview/OverviewBarChart";
import ExceptionPanelCard from "./ExceptionPanelCard";
import type { ExceptionChartDatum } from "./exceptions.types";

export default function RiskBandsPanel({ data, total }: { data: ExceptionChartDatum[]; total: string }) {
  return (
    <ExceptionPanelCard title="Risk Bands" footerLabel="Risks Recorded" footerValue={total}>
      <OverviewBarChart data={data} />
    </ExceptionPanelCard>
  );
}
