import { TestTube } from "lucide-react";
import WorkflowBoxFrame from "./WorkflowBoxFrame";

export default function ControlTestingBox({
  sessions,
  controls,
  evidence,
  reports,
  onClick,
}: {
  sessions: string;
  controls: string;
  evidence: string;
  reports: string;
  onClick: () => void;
}) {
  return (
    <WorkflowBoxFrame
      title="Control Testing"
      accent="#009A44"
      tint="#EDFBF5"
      icon={<TestTube className="h-5 w-5" />}
      onClick={onClick}
      metrics={[
        { label: "sessions", value: sessions },
        { label: "controls", value: controls },
        { label: "evidence", value: evidence },
        { label: "reports", value: reports },
      ]}
    />
  );
}
