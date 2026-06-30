import OverviewBarChart from "../Overview/OverviewBarChart";
import LibraryPanelCard from "./LibraryPanelCard";
import type { LibraryChartDatum } from "./libraries.types";

export default function LibraryAssetsStatusPanel({ data, total }: { data: LibraryChartDatum[]; total: string }) {
  return (
    <LibraryPanelCard title="Assets By Status" footerLabel="Operational Assets" footerValue={total}>
      <OverviewBarChart data={data} labelMode="compact" />
    </LibraryPanelCard>
  );
}
