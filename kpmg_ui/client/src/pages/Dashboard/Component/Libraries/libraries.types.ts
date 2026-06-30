import type { OverviewChartDatum } from "../Overview/overview.types";

export type LibraryTone = "blue" | "green" | "purple" | "teal";

export type LibraryKpiItem = {
  label: string;
  value: string;
  subLabel: string;
  badge?: string;
  tone: LibraryTone;
  onClick: () => void;
};

export type LibraryDomainDatum = {
  domain: string;
  Regulations: number;
  Controls: number;
};

export type LibraryChartDatum = OverviewChartDatum;
