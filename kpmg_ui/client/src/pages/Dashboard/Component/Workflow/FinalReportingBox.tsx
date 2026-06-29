import { FileBarChart } from "lucide-react";
import WorkflowBoxFrame from "./WorkflowBoxFrame";

export default function FinalReportingBox({
  reports,
  allReports,
  outputs,
  testing,
  onClick,
}: {
  reports: string;
  allReports: string;
  outputs: string;
  testing: string;
  onClick: () => void;
}) {
  return (
    <WorkflowBoxFrame
      title="Final Reporting"
      accent="#00338D"
      tint="#EEF2FF"
      icon={<FileBarChart className="h-5 w-5" />}
      onClick={onClick}
      metrics={[
        { label: "reports", value: reports },
        { label: "all reports", value: allReports },
        { label: "outputs", value: outputs },
        { label: "testing", value: testing },
      ]}
    />
  );
}
