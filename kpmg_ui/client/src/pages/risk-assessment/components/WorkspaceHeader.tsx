import { ArrowRight } from "lucide-react";

type WorkspaceHeaderProps = {
  title: string;
  onBack: () => void;
};

// Header for an opened assessment, including the return action to recent assessments.
export function WorkspaceHeader({ title, onBack }: WorkspaceHeaderProps) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-4 border-b border-[#123863] bg-[#0C233C] px-4 py-5 sm:flex-row sm:items-center sm:px-6">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/48">Assessment</p>
        <h2 className="text-[24px] font-bold tracking-[-0.03em] text-white">Risk Assessment Workspace</h2>
        <p className="mt-2 truncate text-[13px] leading-6 text-white/68">
          {title} - continue the guided workflow from the current stage.
        </p>
      </div>
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-white/18 bg-white/10 px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-white/16 sm:w-auto"
        onClick={onBack}
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        Recent Assessments
      </button>
    </div>
  );
}

