import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
} from "lucide-react";
import type {
  AnswerType,
  RiskAssessment,
  Section,
} from "@/contexts/RiskAssessmentContext";
import { GuidanceCard } from "./GuidanceCard";

type LocalAnswer = {
  answer: AnswerType;
  details: string;
};

type QuestionnaireStepProps = {
  assessment: RiskAssessment;
  sections: Section[];
  answers: Record<string, Record<string, Record<string, LocalAnswer>>>;
  currentAssetId: string;
  expandedSection: string | null;
  currentAnsweredCount: number;
  currentTotalQuestions: number;
  submittingQa: boolean;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  onExpandedSectionChange: (sectionId: string | null) => void;
  onAnswerChange: (assetId: string, sectionId: string, questionId: string, answer: AnswerType) => void;
  onSaveProgress: () => void;
  onSubmitQuestionnaire: () => void;
  getSectionProgress: (
    answers: Record<string, Record<string, Record<string, LocalAnswer>>>,
    assetId: string,
    section: Section,
    savedResponses?: RiskAssessment["responses"],
  ) => number;
};

// Renders the active questionnaire step and keeps answer clicks local to this section.
export function QuestionnaireStep({
  assessment,
  sections,
  answers,
  currentAssetId,
  expandedSection,
  currentAnsweredCount,
  currentTotalQuestions,
  submittingQa,
  primaryButtonClassName,
  secondaryButtonClassName,
  onExpandedSectionChange,
  onAnswerChange,
  onSaveProgress,
  onSubmitQuestionnaire,
  getSectionProgress,
}: QuestionnaireStepProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" data-risk-assessment-questionnaire="true">
      <section className="min-w-0">
        {assessment.asset_ids.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[#DCE3EE] bg-white px-4 py-8 text-center text-[13px] leading-6 text-[#7388A8]">
            No Asset Registry applications were selected for questionnaire capture.
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => {
              const completed = getSectionProgress(answers, currentAssetId, section, assessment.responses);
              const total = section.questions.length;
              const isOpen = expandedSection === section.id;
              return (
                <div
                  key={section.id}
                  className={`risk-questionnaire-glass-section overflow-hidden rounded-[8px] border ${
                    isOpen ? "border-[#1E49E2] shadow-[0_18px_34px_-30px_rgba(30,73,226,0.36)]" : "border-[#D8E0ED]"
                  }`}
                >
                  <button
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => onExpandedSectionChange(isOpen ? null : section.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#1E49E2]">
                        {section.title.toLowerCase().includes("access") ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[16px] font-bold text-[#0C233C]">{section.title}</span>
                          <HelpCircle className="h-3.5 w-3.5 flex-shrink-0 text-[#8492A6]" />
                        </div>
                        <p className="mt-1 text-[12px] text-[#5A6478]">Controls and risk questions for this section.</p>
                      </div>
                    </div>
                    <div className="flex w-full flex-shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                          completed === total
                            ? "bg-[#EDFBF5] text-[#009A44]"
                            : completed > 0
                              ? "bg-[#FFF4E8] text-[#AB5C00]"
                              : "bg-[#FEEBED] text-[#E5001B]"
                        }`}
                      >
                        {completed} / {total} answered
                      </span>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-[#7E91AE]" /> : <ChevronRight className="h-4 w-4 text-[#7E91AE]" />}
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-[#E8EDF5] px-5 py-4">
                      <div className="space-y-5">
                        {section.questions.map((question, questionIndex) => {
                          const local = answers[currentAssetId]?.[section.id]?.[question.id];
                          return (
                            <div key={question.id} className="border-t border-[#EFF2F7] pt-4 first:border-t-0 first:pt-0">
                              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
                                <div className="flex gap-3">
                                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#AFC1F8] bg-white text-[12px] font-bold text-[#1E49E2]">
                                    {questionIndex + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-[14px] font-semibold leading-6 text-[#0C233C]">{question.text}</p>
                                  </div>
                                </div>
                                <div className="grid min-w-0 grid-cols-3 gap-3">
                                  {(["yes", "no", "na"] as AnswerType[]).map((answer) => (
                                    <button
                                      key={answer}
                                      className={`risk-question-answer-button h-11 rounded-[8px] border text-[12px] font-bold transition-all ${
                                        local?.answer === answer
                                          ? answer === "yes"
                                            ? "risk-question-answer-button--yes-selected"
                                            : answer === "no"
                                              ? "risk-question-answer-button--no-selected"
                                              : "risk-question-answer-button--na-selected"
                                          : "risk-question-answer-button--idle"
                                      }`}
                                      onClick={() => onAnswerChange(currentAssetId, section.id, question.id, answer)}
                                    >
                                      {answer === "yes" ? "Yes" : answer === "no" ? "No" : "NA"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <div>
        <GuidanceCard answeredQuestions={currentAnsweredCount} totalQuestions={currentTotalQuestions} />
        {currentAssetId ? (
          <div className="mt-4 flex flex-col gap-3 rounded-[8px] border border-[#D8E0ED] bg-white p-4 sm:flex-row">
            <button className={secondaryButtonClassName} onClick={onSaveProgress}>
              <Save className="h-4 w-4" />
              Save Progress
            </button>
            <button className={primaryButtonClassName} onClick={onSubmitQuestionnaire} disabled={submittingQa}>
              {submittingQa ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

