import OverviewBarChart from "../Overview/OverviewBarChart";
import LibraryPanelCard from "./LibraryPanelCard";
import type { LibraryChartDatum } from "./libraries.types";

export default function LibraryFrameworkElementsPanel({ data, total }: { data: LibraryChartDatum[]; total: string }) {
  return (
    <LibraryPanelCard title="Framework Elements By Category" footerLabel="Total Elements" footerValue={total}>
      <OverviewBarChart data={data} labelMode="rotate" height={242} />
    </LibraryPanelCard>
  );
}
