import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReportPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  report: string | null;
  secondaryButtonClassName: string;
};

// Escapes report text before it is written into the print window.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Opens the generated report in a focused preview and lets the user print it as PDF.
export function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  report,
  secondaryButtonClassName,
}: ReportPreviewDialogProps) {
  // Builds a print-friendly document from the rendered markdown preview.
  function handleDownloadPdf() {
    if (!report) return;

    const renderedReport = document.getElementById("risk-assessment-report-print-content")?.innerHTML;
    const reportBody = renderedReport || `<pre>${escapeHtml(report)}</pre>`;
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(title)} - Risk Assessment Report</title>
          <style>
            @page { margin: 18mm; }
            body { font-family: Arial, sans-serif; color: #0C233C; line-height: 1.55; }
            h1, h2, h3 { color: #0C233C; page-break-after: avoid; }
            h1 { font-size: 28px; }
            h2 { margin-top: 28px; font-size: 20px; }
            h3 { margin-top: 22px; font-size: 16px; }
            p, li { font-size: 12px; color: #344563; }
            table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11px; }
            th, td { border: 1px solid #D8E0ED; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #F7F9FC; color: #00338D; text-transform: uppercase; letter-spacing: 0.08em; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12px; color: #344563; }
            .report-cover { border-bottom: 2px solid #1E49E2; margin-bottom: 24px; padding-bottom: 16px; }
            .eyebrow { color: #00338D; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <section class="report-cover">
            <div class="eyebrow">Risk Assessment Report</div>
            <h1>${escapeHtml(title)}</h1>
          </section>
          ${reportBody}
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[1040px] overflow-hidden rounded-[24px] border border-[#DCE3EE] bg-white p-0 shadow-[0_30px_80px_-44px_rgba(12,35,60,0.58)]">
        <DialogHeader className="bg-[linear-gradient(135deg,#0C233C_0%,#163B67_58%,#1E49E2_100%)] px-6 py-6 text-left text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/46">Generated Output</p>
              <DialogTitle className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-white">
                Risk Assessment Report
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[720px] text-[14px] leading-7 text-white/66">
                Review the generated report in a focused preview without replacing the main assessment workflow.
              </DialogDescription>
            </div>
            <button
              className="inline-flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-bold text-[#1E49E2] shadow-sm transition-colors hover:bg-[#EEF2FF] disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-[#7E91AE] sm:w-auto"
              onClick={handleDownloadPdf}
              disabled={!report}
              data-risk-assessment-report-download="true"
            >
              <Download className="h-4 w-4" />
              Print PDF
            </button>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(88vh-180px)] overflow-y-auto px-6 py-6" data-risk-assessment-report-preview="true">
          <div className="mb-5 border-b border-[#E2E6EF] pb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#00338D]">Formatted Report</p>
            <h3 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#0C233C]">{title}</h3>
          </div>
          {report ? (
            <div
              id="risk-assessment-report-print-content"
              className="prose prose-sm max-w-none text-[#4D6485] [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:tracking-[-0.03em] [&_h1]:text-[#0C233C] [&_h2]:mt-8 [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_h2]:text-[#0C233C] [&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:text-[#0C233C] [&_li]:leading-7 [&_p]:leading-7 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#E2E6EF] [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-[#E2E6EF] [&_th]:bg-[#F7F9FC] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.18em] [&_th]:text-[#7E91AE]"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
              The report is still being prepared.
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[#E2E6EF] bg-[#FBFCFE] px-6 py-4">
          <button className={secondaryButtonClassName} onClick={() => onOpenChange(false)}>
            Close Preview
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

