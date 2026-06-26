export type OverviewTone = "blue" | "cyan" | "purple" | "green" | "amber" | "red" | "navy" | "teal";

export type OverviewChartDatum = {
  name: string;
  value: number;
  fill: string;
};

export type OverviewBarLabelMode = "default" | "rotate" | "compact";

export type OverviewKpiItem = {
  label: string;
  value: string;
  subLabel: string;
  badge?: string;
  tone: OverviewTone;
  onClick: () => void;
};

export type OverviewPanelLabels = {
  assetsByCriticality: string;
  assessmentsByStatus: string;
  issuesBySeverity: string;
  reportsByType: string;
  domainCoverage: string;
};
