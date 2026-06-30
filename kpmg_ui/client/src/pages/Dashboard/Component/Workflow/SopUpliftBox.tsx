import { Workflow } from "lucide-react";
import WorkflowBoxFrame from "./WorkflowBoxFrame";

export default function SopUpliftBox({
  cases,
  suggestions,
  outputs,
  reports,
  onClick,
}: {
  cases: string;
  suggestions: string;
  outputs: string;
  reports: string;
  onClick: () => void;
}) {
  return (
    <WorkflowBoxFrame
      title="SOP Uplift"
      accent="#098E7E"
      tint="#E6F4F2"
      icon={<Workflow className="h-5 w-5" />}
      onClick={onClick}
      metrics={[
        { label: "cases", value: cases },
        { label: "suggestions", value: suggestions },
        { label: "outputs", value: outputs },
        { label: "reports", value: reports },
      ]}
    />
  );
}
