import LibraryAssetsStatusPanel from "./LibraryAssetsStatusPanel";
import LibraryDomainCoveragePanel from "./LibraryDomainCoveragePanel";
import LibraryFrameworkElementsPanel from "./LibraryFrameworkElementsPanel";
import LibraryKpiCard from "./LibraryKpiCard";
import LibraryObligationsPanel from "./LibraryObligationsPanel";
import type { LibraryChartDatum, LibraryDomainDatum, LibraryKpiItem } from "./libraries.types";

export default function DashboardLibraries({
  kpis,
  domainCoverage,
  obligationCoverage,
  obligationsByDomain,
  totalObligations,
  frameworkElementsByCategory,
  totalFrameworkElements,
  assetsByStatus,
  operationalAssets,
}: {
  kpis: LibraryKpiItem[];
  domainCoverage: LibraryDomainDatum[];
  obligationCoverage: string;
  obligationsByDomain: LibraryChartDatum[];
  totalObligations: string;
  frameworkElementsByCategory: LibraryChartDatum[];
  totalFrameworkElements: string;
  assetsByStatus: LibraryChartDatum[];
  operationalAssets: string;
}) {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both] space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => <LibraryKpiCard key={kpi.label} {...kpi} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <LibraryDomainCoveragePanel data={domainCoverage} coverage={obligationCoverage} />
        <LibraryObligationsPanel data={obligationsByDomain} total={totalObligations} />
        <LibraryFrameworkElementsPanel data={frameworkElementsByCategory} total={totalFrameworkElements} />
        <LibraryAssetsStatusPanel data={assetsByStatus} total={operationalAssets} />
      </section>
    </div>
  );
}
