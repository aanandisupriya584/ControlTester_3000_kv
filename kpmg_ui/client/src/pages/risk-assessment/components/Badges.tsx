import type { RiskAssessment } from "@/contexts/RiskAssessmentContext";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  risks_identified: "Risks Identified",
  controls_applied: "Controls Applied",
  complete: "Complete",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "border-[#DCE3EE] bg-[#F3F6FA] text-[#6A748A]",
  in_progress: "border-[#C9D7FF] bg-[#EEF2FF] text-[#1E49E2]",
  risks_identified: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  controls_applied: "border-[#D7C0FA] bg-[#F3F0FF] text-[#7213EA]",
  complete: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
};

const BAND_CLASS: Record<string, string> = {
  Critical: "border-[#F3C6CF] bg-[#FEEBED] text-[#E5001B]",
  High: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
  Medium: "border-[#F8E8B7] bg-[#FFF9E8] text-[#8A6A00]",
  Low: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
};

// Keeps assessment status labels and colors consistent wherever they are shown.
export function StatusBadge({ status }: { status: RiskAssessment["status"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${STATUS_CLASS[status] ?? STATUS_CLASS.draft}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// Shows the risk band with the same color treatment used across the page.
export function BandBadge({ band }: { band: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${BAND_CLASS[band] ?? BAND_CLASS.Medium}`}
    >
      {band}
    </span>
  );
}

