import { ClipboardList } from "lucide-react";
import WorkflowBoxFrame from "./WorkflowBoxFrame";

export default function RiskAssessmentBox({
  assessments,
  risks,
  critical,
  controls,
  onClick,
}: {
  assessments: string;
  risks: string;
  critical: string;
  controls: string;
  onClick: () => void;
}) {
  return (
    <WorkflowBoxFrame
      title="Risk Assessment"
      accent="#7213EA"
      tint="#F3F0FF"
      icon={<ClipboardList className="h-5 w-5" />}
      onClick={onClick}
      metrics={[
        { label: "assessments", value: assessments },
        { label: "risks", value: risks },
        { label: "critical", value: critical },
        { label: "controls", value: controls },
      ]}
    />
  );
}
