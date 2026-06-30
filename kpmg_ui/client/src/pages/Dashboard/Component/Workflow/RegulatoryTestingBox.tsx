import { Scale } from "lucide-react";
import WorkflowBoxFrame from "./WorkflowBoxFrame";

export default function RegulatoryTestingBox({
  reports,
  obligations,
  coverage,
  gaps,
  onClick,
}: {
  reports: string;
  obligations: string;
  coverage: string;
  gaps: string;
  onClick: () => void;
}) {
  return (
    <WorkflowBoxFrame
      title="Regulatory Testing"
      accent="#1E49E2"
      tint="#EEF2FF"
      icon={<Scale className="h-5 w-5" />}
      onClick={onClick}
      metrics={[
        { label: "reports", value: reports },
        { label: "obligations", value: obligations },
        { label: "coverage", value: coverage },
        { label: "gaps", value: gaps },
      ]}
    />
  );
}
