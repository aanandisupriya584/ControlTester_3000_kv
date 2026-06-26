import AssessmentsStatusPanel from "./AssessmentsStatusPanel";
import AssetsCriticalityPanel from "./AssetsCriticalityPanel";
import DomainCoveragePanel from "./DomainCoveragePanel";
import IssuesSeverityPanel from "./IssuesSeverityPanel";
import OverviewKpiCard from "./OverviewKpiCard";
import ReportsTypePanel from "./ReportsTypePanel";
import type { OverviewChartDatum, OverviewKpiItem, OverviewPanelLabels } from "./overview.types";

export default function DashboardOverview({
  kpis,
  labels,
  kpiGridClassName,
  assetsByCriticality,
  assessmentsByStatus,
  issuesBySeverity,
  reportsByType,
  domainCoverageData,
  totalAssets,
  totalAssessments,
  totalIssues,
  totalReports,
  gapObligations,
}: {
  kpis: OverviewKpiItem[];
  labels: OverviewPanelLabels;
  kpiGridClassName: string;
  assetsByCriticality: OverviewChartDatum[];
  assessmentsByStatus: OverviewChartDatum[];
  issuesBySeverity: OverviewChartDatum[];
  reportsByType: OverviewChartDatum[];
  domainCoverageData: OverviewChartDatum[];
  totalAssets: string;
  totalAssessments: string;
  totalIssues: string;
  totalReports: string;
  gapObligations: string;
}) {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both] space-y-5">
      <section className={kpiGridClassName}>
        {kpis.map(item => <OverviewKpiCard key={item.label} {...item} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <AssetsCriticalityPanel title={labels.assetsByCriticality} data={assetsByCriticality} totalAssets={totalAssets} />
        <AssessmentsStatusPanel title={labels.assessmentsByStatus} data={assessmentsByStatus} totalAssessments={totalAssessments} />
        <IssuesSeverityPanel title={labels.issuesBySeverity} data={issuesBySeverity} totalIssues={totalIssues} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.32fr]">
        <ReportsTypePanel title={labels.reportsByType} data={reportsByType} totalReports={totalReports} />
        <DomainCoveragePanel title={labels.domainCoverage} data={domainCoverageData} gapObligations={gapObligations} />
      </section>
    </div>
  );
}
