import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
} from "lucide-react";
import CompletionChecklist from "@/pages/RiskAssessment/components/CompletionChecklist";
import type { AnswerType, RiskAssessment, Section } from "@/contexts/RiskAssessmentContext";

interface LocalAnswer {
  answer: AnswerType;
  details: string;
}

interface QuestionnaireFormProps {
  assessment: RiskAssessment;
  sections: Section[];
  answers: Record<string, Record<string, Record<string, LocalAnswer>>>;
  currentAssetId: string;
  currentAnsweredCount: number;
  currentTotalQuestions: number;
  expandedSection: string | null;
  submittingQa: boolean;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  onExpandedSectionChange: (sectionId: string | null) => void;
  onAnswer: (assetId: string, sectionId: string, questionId: string, answer: AnswerType, details?: string) => void;
  onSaveProgress: () => void;
  onContinue: () => void;
}

const ANSWER_LABEL: Record<AnswerType, string> = {
  yes: "YES",
  no: "NO",
  na: "NA",
};

function sectionProgress(
  answers: Record<string, Record<string, Record<string, LocalAnswer>>>,
  assetId: string,
  section: Section,
) {
  return Object.values(answers[assetId]?.[section.id] ?? {}).length;
}

function GuidanceCard({
  answeredQuestions,
  totalQuestions,
  actions,
}: {
  answeredQuestions: number;
  totalQuestions: number;
  actions?: ReactNode;
}) {
  return (
    <aside className="flex h-full flex-col gap-4">
      <section className="rounded-[8px] border border-[#D8E0ED] bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-[#0C233C]">Guidance</h3>
          <HelpCircle className="h-4 w-4 text-[#8492A6]" />
        </div>
        <p className="mb-4 text-[12px] leading-5 text-[#5A6478]">Answer each question based on the current state of controls for the selected asset.</p>
        <div className="space-y-3 rounded-[6px] border border-[#D8E8FF] bg-[#F8FBFF] p-3">
          {["Provide accurate and factual responses.", "Select Yes, No, or NA for each question.", "You can save progress anytime and return later."].map((item) => (
            <div key={item} className="flex gap-2 text-[12px] leading-5 text-[#0C233C]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1E49E2]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <CompletionChecklist answeredQuestions={answeredQuestions} totalQuestions={totalQuestions} actions={actions} />
    </aside>
  );
}

export default function QuestionnaireForm({
  assessment,
  sections,
  answers,
  currentAssetId,
  currentAnsweredCount,
  currentTotalQuestions,
  expandedSection,
  submittingQa,
  primaryButtonClassName,
  secondaryButtonClassName,
  onExpandedSectionChange,
  onAnswer,
  onSaveProgress,
  onContinue,
}: QuestionnaireFormProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, AnswerType>>({});
  const [openNaDetails, setOpenNaDetails] = useState<Record<string, boolean>>({});
  const allQuestionsAnswered = currentTotalQuestions > 0 && currentAnsweredCount >= currentTotalQuestions;

  useEffect(() => {
    const restoredSelections: Record<string, AnswerType> = {};
    Object.entries(answers[currentAssetId] ?? {}).forEach(([sectionId, questionAnswers]) => {
      Object.entries(questionAnswers).forEach(([questionId, localAnswer]) => {
        restoredSelections[`${sectionId}:${questionId}`] = localAnswer.answer;
      });
    });
    setSelectedAnswers(restoredSelections);
  }, [answers, currentAssetId]);

  function selectAnswer(sectionId: string, questionId: string, answer: AnswerType) {
    const key = `${sectionId}:${questionId}`;
    const existingDetails = answers[currentAssetId]?.[sectionId]?.[questionId]?.details ?? "";
    setSelectedAnswers((previous) => ({
      ...previous,
      [key]: answer,
    }));
    /* Bug fix: clicking NA opens only that question's description box. */
    setOpenNaDetails((previous) => ({
      ...previous,
      [key]: answer === "na",
    }));
    onAnswer(currentAssetId, sectionId, questionId, answer, answer === "na" ? existingDetails : "");
  }

  function updateNaDetails(sectionId: string, questionId: string, details: string) {
    const key = `${sectionId}:${questionId}`;
    setSelectedAnswers((previous) => ({
      ...previous,
      [key]: "na",
    }));
    setOpenNaDetails((previous) => ({
      ...previous,
      [key]: true,
    }));
    onAnswer(currentAssetId, sectionId, questionId, "na", details);
  }

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
              const completed = sectionProgress(answers, currentAssetId, section);
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
                          const questionKey = `${section.id}:${question.id}`;
                          const selectedAnswer = selectedAnswers[questionKey] ?? local?.answer;
                          const showNaDetails = openNaDetails[questionKey] || selectedAnswer === "na";
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
                                      type="button"
                                      key={answer}
                                      className={`risk-question-answer-button h-11 cursor-pointer rounded-[8px] border text-[12px] font-bold transition-all duration-150 active:translate-y-px ${
                                        selectedAnswer === answer
                                          ? answer === "yes"
                                            ? "risk-question-answer-button--yes-selected border-[#009A44] bg-[#009A44] text-white shadow-sm"
                                            : answer === "no"
                                              ? "risk-question-answer-button--no-selected border-[#E5001B] bg-[#E5001B] text-white shadow-sm"
                                              : "risk-question-answer-button--na-selected border-[#1E49E2] bg-[#1E49E2] text-white shadow-sm"
                                          : "risk-question-answer-button--idle border-[#D6E0EF] bg-white text-[#33415C] hover:border-[#1E49E2] hover:bg-[#F8FBFF]"
                                      }`}
                                      onClick={() => selectAnswer(section.id, question.id, answer)}
                                      aria-label={`Answer ${ANSWER_LABEL[answer]}`}
                                      aria-pressed={selectedAnswer === answer}
                                      data-risk-question-answer="true"
                                      data-answer={answer}
                                      style={
                                        selectedAnswer === answer
                                          ? {
                                              backgroundColor:
                                                answer === "yes" ? "#009A44" : answer === "no" ? "#E5001B" : "#1E49E2",
                                              borderColor:
                                                answer === "yes" ? "#009A44" : answer === "no" ? "#E5001B" : "#1E49E2",
                                              color: "#FFFFFF",
                                            }
                                          : undefined
                                      }
                                    >
                                      <span className="relative z-10 block text-current">{ANSWER_LABEL[answer]}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Bug fix: show the free-text rationale field when NA is selected. */}
                              {showNaDetails ? (
                                <div className="mt-3 lg:ml-10">
                                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6478]">
                                    NA rationale
                                  </label>
                                  <textarea
                                    value={local?.details ?? ""}
                                    onChange={(event) => updateNaDetails(section.id, question.id, event.target.value)}
                                    className="mt-1 min-h-20 w-full resize-y rounded-[8px] border border-[#D6E0EF] bg-white px-3 py-2 text-[12px] leading-5 text-[#0C233C] outline-none focus:border-[#1E49E2] focus:ring-2 focus:ring-[#1E49E2]/15"
                                    placeholder="Add why this question is not applicable for the selected asset."
                                  />
                                </div>
                              ) : null}
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
        <GuidanceCard
          answeredQuestions={currentAnsweredCount}
          totalQuestions={currentTotalQuestions}
          actions={
            currentAssetId ? (
              <>
                <button className={secondaryButtonClassName} onClick={onSaveProgress}>
                  <Save className="h-4 w-4" />
                  Save Progress
                </button>
                <button
                  className={primaryButtonClassName}
                  onClick={onContinue}
                  disabled={submittingQa}
                  aria-disabled={!allQuestionsAnswered}
                  title={allQuestionsAnswered ? "Continue to the next step" : "Answer every question before continuing"}
                >
                  {submittingQa ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : null
          }
        />
      </div>
    </div>
  );
}
