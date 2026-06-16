type FeatureCardsProps = {
  activeAssessments: number;
  highCriticalRisks: number;
  drafts: number;
  totalAssessments: number;
  totalRisks: number;
  assetCount: number;
};

// Renders the landing KPI cards shown before the assessment workspace.
export function FeatureCards({
  activeAssessments,
  highCriticalRisks,
  drafts,
  totalAssessments,
  totalRisks,
  assetCount,
}: FeatureCardsProps) {
  const cards = [
    {
      label: "ACTIVE ASSESSMENTS",
      value: activeAssessments,
      detail: "Sessions currently progressing",
      badge: `${totalAssessments} total sessions`,
      accent: "#00338D",
      badgeClassName: "bg-[#EEF2FF] text-[#1E49E2]",
    },
    {
      label: "DRAFT ASSESSMENTS",
      value: drafts,
      detail: "Waiting to begin questionnaire capture",
      badge: `${assetCount} asset registry applications available`,
      accent: "#1E49E2",
      badgeClassName: "bg-[#EDFBF5] text-[#009A44]",
    },
    {
      label: "HIGH / CRITICAL RISKS",
      value: highCriticalRisks,
      detail: "Across all fetched assessments",
      badge: `${totalRisks} total recorded risks`,
      accent: "#00B8F5",
      badgeClassName: "bg-[#FFF9E8] text-[#8A6A00]",
    },
    {
      label: "TOTAL ASSESSMENTS",
      value: totalAssessments,
      detail: "Includes active, complete, and draft assessments",
      badge: `${totalAssessments} total assessments`,
      accent: "#ACEAFF",
      badgeClassName: "bg-[#EEF2FF] text-[#1E49E2]",
    },
    {
      label: "TOTAL RISKS",
      value: totalRisks,
      detail: "Risks identified across all assessments",
      badge: `${totalRisks} total risks identified`,
      accent: "#7213EA",
      badgeClassName: "bg-[#EEF2FF] text-[#1E49E2]",
    },
    {
      label: "ASSET COUNT",
      value: assetCount,
      detail: "Total assets in scope across all assessments",
      badge: `${assetCount} total assets`,
      accent: "#0C233C",
      badgeClassName: "bg-[#EEF2FF] text-[#1E49E2]",
    },
  ];

  return (
    <section className="mb-9 grid gap-5 md:grid-cols-3 xl:grid-cols-6" data-risk-assessment-feature-cards="true">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative min-h-[200px] overflow-hidden rounded-[18px] border border-[#DCE3EE] bg-white px-6 py-7 shadow-sm"
        >
          <div className="absolute left-0 right-0 top-0 h-1" style={{ background: card.accent }} />
          <div className="min-h-[45px]">
            <p className="text-[13px] font-bold uppercase leading-6 tracking-[0.1em] text-[#6D7EA8]">
              {card.label}
            </p>
          </div>
          <div className="mt-5 text-[30px] font-bold leading-none tracking-[-0.05em] text-[#001B3A]">{card.value}</div>
          <p className="mt-4 max-w-full text-[15px] leading-4 text-[#5D6FA4]">{card.detail}</p>
          <div className={`mt-6 inline-flex max-w-full rounded-full px-4 py-2 text-[8px] font-bold ${card.badgeClassName}`}>
            <span className="break-words">{card.badge}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

