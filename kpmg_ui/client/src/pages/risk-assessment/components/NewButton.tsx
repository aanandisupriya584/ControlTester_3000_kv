import { Plus } from "lucide-react";

type NewButtonProps = {
  className: string;
  onClick: () => void;
  extraClassName?: string;
};

// Single source for the New Assessment action button.
export function NewButton({
  className,
  onClick,
  extraClassName = "",
}: NewButtonProps) {
  return (
    <button
      className={`${className} ${extraClassName}`.trim()}
      onClick={onClick}
      data-risk-assessment-new="true"
    >
      <Plus className="h-4 w-4" />
      New Assessment
    </button>
  );
}

