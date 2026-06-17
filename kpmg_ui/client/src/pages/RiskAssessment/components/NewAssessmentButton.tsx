import { Plus } from "lucide-react";

interface NewAssessmentButtonProps {
  className: string;
  onClick: () => void;
}

export default function NewAssessmentButton({ className, onClick }: NewAssessmentButtonProps) {
  return (
    <button className={className} onClick={onClick} data-risk-assessment-new="true">
      <Plus className="h-4 w-4" />
      New Assessment
    </button>
  );
}
