import type { Dispatch, SetStateAction } from "react";
import { Play, Plus, Save } from "lucide-react";
import CiaRatingWidget from "@/components/CiaRatingWidget";
import { TracePanel } from "@/components/TraceAnalysisPrimitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Asset } from "@/contexts/AssetRegistryContext";
import type { AdHocApplication } from "@/contexts/RiskAssessmentContext";

export interface CreateAssessmentFormState {
  title: string;
  description: string;
  selectedAssetIds: string[];
}

interface CreateAssessmentPageProps {
  open: boolean;
  form: CreateAssessmentFormState;
  assets: Asset[];
  adHocApps: AdHocApplication[];
  adHocDraft: AdHocApplication;
  showAdHocForm: boolean;
  primaryButtonClassName: string;
  softButtonClassName: string;
  onOpenChange: (open: boolean) => void;
  onFormChange: Dispatch<SetStateAction<CreateAssessmentFormState>>;
  onAdHocAppsChange: Dispatch<SetStateAction<AdHocApplication[]>>;
  onAdHocDraftChange: Dispatch<SetStateAction<AdHocApplication>>;
  onShowAdHocFormChange: Dispatch<SetStateAction<boolean>>;
  onAddAdHoc: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onCreate: () => void;
}

function CreateMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="min-h-[180px] rounded-[8px] border border-[#D6E0EF] bg-[#F8FAFD] px-4 py-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#50627F]">{label}</div>
      <div className="mt-5 text-[30px] font-bold tracking-[-0.04em] text-[#001B3A]">{value}</div>
      <div className="mt-4 text-[12px] leading-6 text-[#33415C]">{detail}</div>
    </div>
  );
}

function AssetBandBadge({ band }: { band: Asset["criticality"] }) {
  const classNameByBand: Record<Asset["criticality"], string> = {
    Critical: "border-[#F3C6CF] bg-[#FEEBED] text-[#E5001B]",
    High: "border-[#F6D3A0] bg-[#FFF4E8] text-[#AB5C00]",
    Medium: "border-[#F8E8B7] bg-[#FFF9E8] text-[#8A6A00]",
    Low: "border-[#BFE7D1] bg-[#EDFBF5] text-[#009A44]",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${classNameByBand[band]}`}>
      {band}
    </span>
  );
}

export default function CreateAssessmentPage({
  open,
  form,
  assets,
  adHocApps,
  adHocDraft,
  showAdHocForm,
  primaryButtonClassName,
  softButtonClassName,
  onOpenChange,
  onFormChange,
  onAdHocAppsChange,
  onAdHocDraftChange,
  onShowAdHocFormChange,
  onAddAdHoc,
  onCancel,
  onSaveDraft,
  onCreate,
}: CreateAssessmentPageProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[1280px] flex-col overflow-hidden rounded-[18px] border border-[#BFD0E5] bg-white p-0 shadow-[0_34px_100px_-42px_rgba(2,10,24,0.72)] sm:w-[calc(100vw-80px)] sm:rounded-[24px]">
        <DialogHeader className="flex-shrink-0 border-b border-[#123863] bg-[#0C233C] px-5 py-6 text-left text-white sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-white">New Assessment</p>
              <DialogTitle className="mt-4 text-[26px] font-bold tracking-[-0.04em] text-white">
                Create New Assessment
              </DialogTitle>
              <DialogDescription className="mt-4 max-w-[760px] text-[14px] leading-7 text-white">
                Define scope, select applications, and prepare the questionnaire workflow.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F4F7FB] px-4 py-5 sm:px-6" data-risk-assessment-create="true">
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="flex min-h-full flex-col gap-5">
              <div className="risk-assessment-setup-glass overflow-hidden rounded-[8px] border p-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.32em] text-[#1E49E2]">Assessment Details</p>
                <h3 className="text-[22px] font-bold tracking-[-0.04em] text-[#001B3A]">Define Scope Before We Ask Anything</h3>
                <p className="mt-4 max-w-[640px] text-[13px] leading-7 text-[#33415C]">
                  Name the session, choose the core applications in scope, and add any ad hoc systems that need to be assessed without touching the wider registry.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <CreateMetric label="Registry Assets" value={form.selectedAssetIds.length} detail="Selected from the live registry" />
                  <CreateMetric label="Ad Hoc Systems" value={adHocApps.length} detail="Scoped only to this assessment" />
                  <CreateMetric
                    label="Questionnaire Path"
                    value={Math.max(form.selectedAssetIds.length, 0)}
                    detail="Registry-backed applications will enter the guided questionnaire"
                  />
                </div>
              </div>

              <div className="group">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                  Assessment Title
                </label>
                <Input
                  value={form.title}
                  onChange={(event) => onFormChange((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="FY2026 Cloud Payments Review"
                  className="h-14 rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                />
              </div>

              <div className="group">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                  Description
                </label>
                <Textarea
                  value={form.description}
                  onChange={(event) => onFormChange((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Describe the scope, timing, and assessment objective."
                  rows={4}
                  className="max-h-32 overflow-y-auto rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                />
              </div>

              <TracePanel
                title="Applications In Scope"
                subtitle="Select existing applications from the Asset Registry. These drive the questionnaire path."
                className="rounded-[22px] shadow-none"
              >
                <div data-risk-assessment-scope-asset-scroll="true" className="max-h-[112px] space-y-3 overflow-y-auto pr-2">
                  {assets.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[#DCE3EE] bg-[#FBFCFE] px-4 py-6 text-[13px] leading-6 text-[#7388A8]">
                      No applications are available in the Asset Registry yet.
                    </div>
                  ) : (
                    assets.map((asset) => {
                      const checked = form.selectedAssetIds.includes(asset.id);
                      return (
                        <label
                          key={asset.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-[18px] border px-4 py-4 transition-colors ${
                            checked ? "border-[#AFC1F8] bg-[#EEF2FF]" : "border-[#E2E6EF] bg-white hover:bg-[#F8FAFF]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-[#B4C1D6]"
                            checked={checked}
                            onChange={(event) =>
                              onFormChange((prev) => ({
                                ...prev,
                                selectedAssetIds: event.target.checked
                                  ? [...prev.selectedAssetIds, asset.id]
                                  : prev.selectedAssetIds.filter((value) => value !== asset.id),
                              }))
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[14px] font-bold text-[#0C233C]">{asset.name}</p>
                                <p className="mt-1 text-[12px] leading-6 text-[#7388A8]">
                                  {asset.description || asset.use || "Application in the asset registry"}
                                </p>
                              </div>
                              <AssetBandBadge band={asset.criticality} />
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </TracePanel>
            </div>

            <div className="flex min-h-full flex-col gap-5">
              <TracePanel
                title="Ad Hoc Applications"
                subtitle="Add systems not yet in the registry. They remain part of scope without touching other features."
                className="rounded-[8px] shadow-none"
              >
                <div className="mb-4 flex flex-col items-start gap-3">
                  <div className="text-[13px] text-[#7388A8]">
                    {adHocApps.length} ad hoc application{adHocApps.length === 1 ? "" : "s"} added
                  </div>
                  <button className={softButtonClassName} onClick={() => onShowAdHocFormChange((prev) => !prev)}>
                    <Plus className="h-4 w-4" />
                    Add Entry
                  </button>
                </div>

                {adHocApps.length > 0 ? (
                  <div className="max-h-[184px] space-y-2 overflow-y-auto pr-1">
                    {adHocApps.map((application, index) => (
                      <div key={`${application.name}-${index}`} className="flex items-center justify-between gap-3 rounded-[8px] border border-[#E2E6EF] bg-[#FBFCFE] px-4 py-3">
                        <div>
                          <p className="text-[13px] font-bold text-[#0C233C]">{application.name}</p>
                          <p className="text-[12px] text-[#7388A8]">
                            CIA {application.confidentiality}/{application.integrity}/{application.availability}
                          </p>
                        </div>
                        <button
                          className="text-[12px] font-bold text-[#8492A6] transition-colors hover:text-[#E5001B]"
                          onClick={() => onAdHocAppsChange((prev) => prev.filter((_, appIndex) => appIndex !== index))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </TracePanel>
            </div>
          </div>
        </div>

        <Dialog open={showAdHocForm} onOpenChange={onShowAdHocFormChange}>
          <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[920px] flex-col overflow-hidden rounded-[18px] border border-[#BFD0E5] bg-white p-0 shadow-[0_34px_100px_-42px_rgba(2,10,24,0.72)] sm:w-[calc(100vw-48px)] [&>button]:text-white [&>button]:opacity-80 [&>button:hover]:opacity-100">
            <DialogHeader className="flex-shrink-0 border-b border-[#123863] bg-[#0C233C] px-5 py-6 text-left text-white sm:px-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-white">Ad Hoc Application</p>
              <DialogTitle className="mt-4 text-[26px] font-bold tracking-[-0.04em] text-white">
                Add Application Details
              </DialogTitle>
              <DialogDescription className="mt-4 max-w-[780px] text-[14px] leading-7 text-white">
                Capture systems that are not yet in the Asset Registry and include the CIA rating needed for this assessment scope.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F4F7FB] px-4 py-5 sm:px-6 sm:py-10">
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
                <div className="min-h-[504px] space-y-5 rounded-[8px] border border-[#D6E0EF] bg-white p-5 sm:p-6">
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                      Application Name
                    </label>
                    <Input
                      value={adHocDraft.name ?? ""}
                      onChange={(event) => onAdHocDraftChange((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Payments orchestration platform"
                      className="h-12 rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                      Application Description
                    </label>
                    <Textarea
                      value={adHocDraft.description ?? ""}
                      onChange={(event) => onAdHocDraftChange((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Describe the application, users, data, and core business process."
                      rows={4}
                      className="rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">
                      Assessment Context
                    </label>
                    <Textarea
                      value={adHocDraft.assessment_context ?? ""}
                      onChange={(event) => onAdHocDraftChange((prev) => ({ ...prev, assessment_context: event.target.value }))}
                      placeholder="Explain why this system is in scope and what should be considered during risk review."
                      rows={4}
                      className="rounded-[8px] border-[#C9D7E8] bg-white text-[#0C233C] placeholder:text-[#7388A8] focus-visible:ring-[#00B8F5]"
                    />
                  </div>
                </div>

                <div className="min-w-0 space-y-4">
                  <div className="min-w-0 rounded-[8px] border border-[#D6E0EF] bg-white p-4 sm:p-5">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">CIA Rating</p>
                    <CiaRatingWidget
                      confidentiality={adHocDraft.confidentiality ?? 3}
                      confidentiality_min={adHocDraft.confidentiality ?? 3}
                      integrity={adHocDraft.integrity ?? 3}
                      integrity_min={adHocDraft.integrity ?? 3}
                      availability={adHocDraft.availability ?? 3}
                      availability_min={adHocDraft.availability ?? 3}
                      onChange={(field, _minValue, maxValue) => onAdHocDraftChange((prev) => ({ ...prev, [field]: maxValue }))}
                    />
                  </div>
                  <div className="min-w-0 rounded-[8px] border border-[#D6E0EF] bg-white p-4 sm:p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#33415C]">Current Summary</p>
                    <p className="mt-3 break-words text-[14px] font-bold text-[#0C233C]">
                      {adHocDraft.name?.trim() || "Unnamed application"}
                    </p>
                    <p className="mt-2 text-[12px] leading-6 text-[#7388A8]">
                      CIA {adHocDraft.confidentiality ?? 3}/{adHocDraft.integrity ?? 3}/{adHocDraft.availability ?? 3}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 border-t border-[#253244] bg-[#2F3947] px-4 py-4 sm:px-6">
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#4C596B] bg-[#465162] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#526073] sm:w-auto" onClick={() => onShowAdHocFormChange(false)}>
                Cancel
              </button>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#1E49E2] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#00338D] disabled:cursor-not-allowed disabled:bg-[#8EA4D9] sm:w-auto" onClick={onAddAdHoc} disabled={!adHocDraft.name?.trim()}>
                Add Application
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DialogFooter className="flex-shrink-0 border-t border-[#253244] bg-[#2F3947] px-4 py-4 sm:px-6">
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#4C596B] bg-[#465162] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#526073] sm:w-auto" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#66758A] bg-transparent px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
            onClick={onSaveDraft}
          >
            <Save className="h-4 w-4" />
            Save Draft
          </button>
          <button className={primaryButtonClassName} onClick={onCreate}>
            <Play className="h-4 w-4" />
            Create Assessment
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
