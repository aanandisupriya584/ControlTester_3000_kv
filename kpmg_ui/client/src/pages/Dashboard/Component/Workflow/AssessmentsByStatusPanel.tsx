import OverviewBarChart from "../Overview/OverviewBarChart";
import type { OverviewChartDatum } from "../Overview/overview.types";
import WorkflowPanelCard from "./WorkflowPanelCard";

export default function AssessmentsByStatusPanel({ data, subjects }: { data: OverviewChartDatum[]; subjects: string }) {
  return (
    <WorkflowPanelCard title="Assessments By Status" footerLabel="Assessment Subjects" footerValue={subjects}>
      <OverviewBarChart data={data} labelMode="rotate" height={226} />
    </WorkflowPanelCard>
  );
}
