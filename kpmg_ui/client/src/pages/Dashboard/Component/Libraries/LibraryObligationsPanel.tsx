import OverviewDonutChart from "../Overview/OverviewDonutChart";
import LibraryPanelCard from "./LibraryPanelCard";
import type { LibraryChartDatum } from "./libraries.types";

export default function LibraryObligationsPanel({ data, total }: { data: LibraryChartDatum[]; total: string }) {
  return (
    <LibraryPanelCard title="Obligations By Domain" footerLabel="Total Obligations" footerValue={total}>
      <OverviewDonutChart data={data} />
    </LibraryPanelCard>
  );
}
