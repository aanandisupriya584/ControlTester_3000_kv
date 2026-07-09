import type { OverviewChartDatum, OverviewTone } from "../Overview/overview.types";

export type ExceptionChartDatum = OverviewChartDatum;

export type ExceptionKpiItem = {
  label: string;
  value: string;
  subLabel: string;
  badge?: string;
  tone: OverviewTone;
  onClick: () => void;
};
