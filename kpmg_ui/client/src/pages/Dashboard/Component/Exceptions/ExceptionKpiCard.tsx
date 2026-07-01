import OverviewKpiCard from "../Overview/OverviewKpiCard";
import type { ExceptionKpiItem } from "./exceptions.types";

export default function ExceptionKpiCard(props: ExceptionKpiItem) {
  return <OverviewKpiCard {...props} />;
}
