import ControlTestResultsPanel from "./ControlTestResultsPanel";
import ExceptionKpiCard from "./ExceptionKpiCard";
import ExceptionSignalsPanel from "./ExceptionSignalsPanel";
import IssuesBySeverityPanel from "./IssuesBySeverityPanel";
import IssuesByStatusPanel from "./IssuesByStatusPanel";
import RiskBandsPanel from "./RiskBandsPanel";
import ValidationQueueByStatusPanel from "./ValidationQueueByStatusPanel";
import type { ExceptionChartDatum, ExceptionKpiItem } from "./exceptions.types";

export default function DashboardExceptions({
  kpis,
  issuesBySeverity,
  issuesByStatus,
  queueByStatus,
  riskBands,
  controlResults,
  exceptionSignals,
  totalIssues,
  openIssues,
  pendingQueue,
  riskCount,
  failedControls,
  totalSignals,
}: {
  kpis: ExceptionKpiItem[];
  issuesBySeverity: ExceptionChartDatum[];
  issuesByStatus: ExceptionChartDatum[];
  queueByStatus: ExceptionChartDatum[];
  riskBands: ExceptionChartDatum[];
  controlResults: ExceptionChartDatum[];
  exceptionSignals: ExceptionChartDatum[];
  totalIssues: string;
  openIssues: string;
  pendingQueue: string;
  riskCount: string;
  failedControls: string;
  totalSignals: string;
}) {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both] space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => <ExceptionKpiCard key={kpi.label} {...kpi} />)}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <IssuesBySeverityPanel data={issuesBySeverity} total={totalIssues} />
        <IssuesByStatusPanel data={issuesByStatus} total={openIssues} />
        <ValidationQueueByStatusPanel data={queueByStatus} total={pendingQueue} />
        <RiskBandsPanel data={riskBands} total={riskCount} />
        <ControlTestResultsPanel data={controlResults} total={failedControls} />
        <ExceptionSignalsPanel data={exceptionSignals} total={totalSignals} />
      </section>
    </div>
  );
}
