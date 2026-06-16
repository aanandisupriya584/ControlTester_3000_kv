import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Activity, ArrowLeft, BarChart3, ClipboardList, Gauge, LineChart, ShieldAlert } from "lucide-react";
import { type Risk, type RiskAssessment, useRiskAssessment } from "@/contexts/RiskAssessmentContext";
import { getAssessmentTemplate } from "@/lib/risk-assessment-templates";

const bandTone: Record<string, string> = {
  Critical: "#E5001B",
  High: "#FF9E1B",
  Medium: "#FFD23F",
  Low: "#009A44",
};

const donutColors = ["#1E49E2", "#00B8F5", "#009A44", "#FF9E1B", "#E5001B"];

type DashboardGraphItem = {
  label: string;
  sectionIds: readonly string[];
  riskScore: number;
  vulnerabilities: number;
};

type DashboardMetric = {
  label: string;
  value: number;
};

type DashboardTemplate = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  guidance: string;
  focus: readonly string[];
  graph: readonly DashboardGraphItem[];
  metrics: readonly DashboardMetric[];
  logs: readonly string[];
};

function getTemplateIdFromLocation(location: string) {
  const path = location.split("?")[0] ?? "";
  return path.split("/").filter(Boolean).at(-1);
}

function getFocusFromLocation(location: string) {
  const query = location.split("?")[1] ?? "";
  return new URLSearchParams(query).get("focus");
}

const lensKeywords: Record<string, string[]> = {
  cloud: ["cloud", "aws", "azure", "gcp", "saas", "iaas", "paas", "kubernetes", "container", "storage", "iam", "logging", "resilience"],
  cyber: ["cyber", "threat", "vulnerability", "patch", "incident", "malware", "exposure", "internet", "security", "breach", "detection"],
  itgc: ["itgc", "access", "change", "operation", "backup", "job", "control", "privileged", "recertification", "production"],
};

const graphKeywords: Record<string, string[]> = {
  Access: ["access", "identity", "privileged", "mfa", "authentication", "authorization", "offboarding"],
  Change: ["change", "deployment", "production", "release", "patch", "secure build"],
  Operations: ["operation", "backup", "recovery", "availability", "monitoring", "job"],
  Identity: ["identity", "access", "privileged", "mfa", "iam"],
  Logging: ["logging", "monitoring", "alert", "detect", "audit"],
  Resilience: ["resilience", "backup", "recovery", "availability", "failover"],
  Threats: ["threat", "exposure", "internet", "third-party", "network", "breach"],
  Vulnerability: ["vulnerability", "patch", "unsupported", "penetration", "remediation", "sla"],
  Incident: ["incident", "alert", "response", "detect", "breach", "monitoring"],
};

function normalizedText(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function assessmentSearchText(assessment: RiskAssessment) {
  return [
    assessment.title,
    assessment.description,
    ...(assessment.ad_hoc_applications ?? []).flatMap((application) => [
      application.name,
      application.description,
      application.assessment_context,
      application.hosting_type,
      application.support_type,
    ]),
    ...(assessment.risks ?? []).flatMap((risk) => [risk.title, risk.description, risk.risk_category, risk.human_rationale]),
  ].map(normalizedText).join(" ");
}

function riskSearchText(risk: Risk) {
  return [risk.title, risk.description, risk.risk_category, risk.human_rationale].map(normalizedText).join(" ");
}

function containsAny(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function scoreRiskAsPercent(risks: Risk[]) {
  if (risks.length === 0) return 0;
  const average = risks.reduce((sum, risk) => sum + Number(risk.inherent_risk_score || 0), 0) / risks.length;
  return Math.min(100, Math.max(4, Math.round((average / 25) * 100)));
}

function vulnerabilityWeight(risk: Risk) {
  if (risk.inherent_risk_band === "Critical") return 3;
  if (risk.inherent_risk_band === "High") return 2;
  if (risk.inherent_risk_band === "Medium") return 1;
  return 0.5;
}

function deriveRiskGraph(template: ReturnType<typeof getAssessmentTemplate>, assessments: RiskAssessment[]) {
  const templateKeywords = lensKeywords[template.id] ?? [];
  const matchingAssessments = assessments.filter((assessment) => containsAny(assessmentSearchText(assessment), templateKeywords));
  const scopedAssessments = matchingAssessments.length > 0 ? matchingAssessments : assessments;
  const scopedRisks = scopedAssessments.flatMap((assessment) => assessment.risks ?? []);

  if (scopedRisks.length === 0) {
    return {
      graph: template.graph,
      metrics: template.metrics,
      activeAssessments: scopedAssessments.filter((assessment) => assessment.status !== "complete").length,
      highCritical: 0,
      totalVulnerabilities: template.graph.reduce((sum, item) => sum + item.vulnerabilities, 0),
      risks: scopedRisks,
    };
  }

  const graph = template.graph.map((item, index) => {
    const keywords = graphKeywords[item.label] ?? [item.label.toLowerCase()];
    let matchedRisks = scopedRisks.filter((risk) => containsAny(riskSearchText(risk), keywords));
    if (matchedRisks.length === 0) {
      matchedRisks = scopedRisks.filter((_, riskIndex) => riskIndex % template.graph.length === index);
    }
    const fallbackRisks = matchedRisks.length > 0 ? matchedRisks : scopedRisks;
    return {
      ...item,
      riskScore: scoreRiskAsPercent(fallbackRisks),
      vulnerabilities: Math.max(1, Math.round(fallbackRisks.reduce((sum, risk) => sum + vulnerabilityWeight(risk), 0))),
    };
  });

  const metrics = template.metrics.map((metric, index) => ({
    ...metric,
    value: graph[index % graph.length]?.riskScore ?? metric.value,
  }));

  return {
    graph,
    metrics,
    activeAssessments: scopedAssessments.filter((assessment) => assessment.status !== "complete").length,
    highCritical: scopedRisks.filter((risk) => risk.inherent_risk_band === "Critical" || risk.inherent_risk_band === "High").length,
    totalVulnerabilities: graph.reduce((sum, item) => sum + item.vulnerabilities, 0),
    risks: scopedRisks,
  };
}

function GaugeCard({ label, value, dark = false }: { label: string; value: number; dark?: boolean }) {
  const stroke = value >= 80 ? "#E5001B" : value >= 70 ? "#FF9E1B" : "#00B8F5";
  return (
    <div className={`rounded-[8px] border p-4 ${dark ? "border-[#1D3655] bg-[#101B2B]" : "border-[#D8E0ED] bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? "text-[#8EA7C5]" : "text-[#5A6478]"}`}>{label}</p>
        <Gauge className={`h-4 w-4 ${dark ? "text-[#00B8F5]" : "text-[#1E49E2]"}`} />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="grid h-20 w-20 place-items-center rounded-full"
          style={{ background: `conic-gradient(${stroke} ${value * 3.6}deg, ${dark ? "#22344D" : "#E8EDF5"} 0deg)` }}
        >
          <div className={`grid h-14 w-14 place-items-center rounded-full ${dark ? "bg-[#101B2B]" : "bg-white"}`}>
            <span className={`text-[16px] font-bold ${dark ? "text-white" : "text-[#0C233C]"}`}>{value}%</span>
          </div>
        </div>
        <div>
          <p className={`text-[12px] leading-6 ${dark ? "text-[#B8C7D9]" : "text-[#5A6478]"}`}>Current risk pressure</p>
          <p className={`text-[22px] font-bold ${dark ? "text-white" : "text-[#0C233C]"}`}>{value >= 80 ? "High" : value >= 70 ? "Medium" : "Stable"}</p>
        </div>
      </div>
    </div>
  );
}

function HorizontalBar({ label, value, suffix = "%", dark = false }: { label: string; value: number; suffix?: string; dark?: boolean }) {
  const color = value >= 80 ? "#E5001B" : value >= 70 ? "#FF9E1B" : dark ? "#00B8F5" : "#1E49E2";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={`text-[12px] font-bold ${dark ? "text-[#D8E8FA]" : "text-[#0C233C]"}`}>{label}</span>
        <span className={`text-[12px] font-bold ${dark ? "text-[#91A8C2]" : "text-[#5A6478]"}`}>{value}{suffix}</span>
      </div>
      <div className={`h-3 overflow-hidden rounded-full ${dark ? "bg-[#22344D]" : "bg-[#E8EDF5]"}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(value, 4), 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function SemiGauge({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "#E5001B" : value >= 70 ? "#FF9E1B" : "#00D17A";
  const clampedValue = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex min-h-[172px] flex-col overflow-hidden rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
      <p className="min-h-[32px] text-[11px] font-bold uppercase leading-4 tracking-[0.18em] text-[#8EA7C5]">{label}</p>
      <div className="relative mx-auto mt-auto h-[108px] w-full max-w-[210px]">
        <svg viewBox="0 0 220 132" className="h-full w-full overflow-visible" role="img" aria-label={`${label} ${clampedValue}%`}>
          <path
            d="M 28 108 A 82 82 0 0 1 192 108"
            fill="none"
            pathLength={100}
            stroke="#22344D"
            strokeLinecap="butt"
            strokeWidth="24"
          />
          <path
            d="M 28 108 A 82 82 0 0 1 192 108"
            fill="none"
            pathLength={100}
            stroke={color}
            strokeDasharray={`${clampedValue} 100`}
            strokeLinecap="butt"
            strokeWidth="24"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-[24px] font-bold text-white">{value}%</p>
          <p className="text-[11px] font-semibold text-[#8EA7C5]">current state</p>
        </div>
      </div>
    </div>
  );
}

function DonutPanel({ items }: { items: readonly { label: string; riskScore: number; vulnerabilities: number }[] }) {
  const total = items.reduce((sum, item) => sum + item.riskScore, 0) || 1;
  let cursor = 0;
  const segments = items.map((item, index) => {
    const start = cursor;
    const span = (item.riskScore / total) * 360;
    cursor += span;
    return `${donutColors[index % donutColors.length]} ${start}deg ${cursor}deg`;
  });

  return (
    <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">Exposure Mix</p>
      <div className="mt-4 flex items-center gap-5">
        <div className="grid h-32 w-32 flex-shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${segments.join(",")})` }}>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-[#101B2B] text-center">
            <span className="text-[18px] font-bold text-white">{items.length}</span>
            <span className="-mt-2 text-[10px] font-bold uppercase text-[#8EA7C5]">areas</span>
          </div>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: donutColors[index % donutColors.length] }} />
              <span className="text-[12px] font-semibold text-[#B8C7D9]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CloudTrendGraph({ labels, title = "Risk Trend" }: { labels: readonly string[]; title?: string }) {
  const series = [
    { color: "#00B8F5", points: "0,84 62,70 124,76 186,46 248,62 310,54 372,74 434,48 496,58 558,38 620,44" },
    { color: "#1E49E2", points: "0,112 62,94 124,105 186,72 248,86 310,70 372,92 434,64 496,76 558,56 620,62" },
    { color: "#00D17A", points: "0,132 62,124 124,128 186,112 248,118 310,108 372,122 434,104 496,114 558,96 620,106" },
  ];

  return (
    <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">{title}</p>
        <LineChart className="h-4 w-4 text-[#00B8F5]" />
      </div>
      <svg viewBox="0 0 640 170" className="h-[220px] w-full">
        {[30, 60, 90, 120, 150].map((y) => (
          <line key={y} x1="0" x2="640" y1={y} y2={y} stroke="#1D3655" strokeWidth="1" />
        ))}
        {[80, 160, 240, 320, 400, 480, 560].map((x) => (
          <line key={x} x1={x} x2={x} y1="18" y2="158" stroke="#142942" strokeWidth="1" />
        ))}
        {series.map((line) => (
          <polyline key={line.color} fill="none" stroke={line.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points={line.points} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-3">
        {labels.slice(0, 3).map((item, index) => (
          <span key={item} className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#B8C7D9]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: donutColors[index] }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniTrend({ dark = false }: { dark?: boolean }) {
  const points = [42, 50, 46, 62, 58, 71, 68, 76, 72, 82, 78, 84];
  return (
    <div className={`rounded-[8px] border p-4 ${dark ? "border-[#1D3655] bg-[#101B2B]" : "border-[#D8E0ED] bg-white"}`}>
      <div className="mb-4 flex items-center justify-between">
        <p className={`text-[12px] font-bold uppercase tracking-[0.18em] ${dark ? "text-[#8EA7C5]" : "text-[#334155]"}`}>Risk Trend</p>
        <LineChart className={`h-4 w-4 ${dark ? "text-[#00B8F5]" : "text-[#1E49E2]"}`} />
      </div>
      <div className="flex h-28 items-end gap-2">
        {points.map((point, index) => (
          <div key={`${point}-${index}`} className="flex flex-1 flex-col items-center justify-end">
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: `${point}%`,
                background: dark ? "linear-gradient(180deg,#00B8F5,#1E49E2)" : "linear-gradient(180deg,#8DDFF8,#1E49E2)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LightAnalyticsPage({
  template,
  focus,
  bandCounts,
  maxBandCount,
  totalVulnerabilities,
}: {
  template: DashboardTemplate;
  focus: string | null;
  bandCounts: { band: string; count: number }[];
  maxBandCount: number;
  totalVulnerabilities: number;
}) {
  const focusedGraph = focus ? template.graph.filter((item) => item.label.toLowerCase() === focus.toLowerCase()) : template.graph;
  const topBars = Array.from({ length: 32 }, (_, index) => 30 + ((index * 17) % 58));

  return (
    <div className="h-full overflow-y-auto bg-[#EEF3F8]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <HeaderShell title={`${template.title} Analytics`} subtitle={template.guidance} dark={false} />

        <div className="rounded-[8px] border border-[#C9D3E2] bg-white p-4 shadow-[0_18px_40px_-36px_rgba(12,35,60,0.36)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#334155]">Risk Activity Overview</p>
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-bold text-[#1E49E2]">{totalVulnerabilities} vulnerabilities</span>
          </div>
          <div className="flex h-36 items-end gap-1.5">
            {topBars.map((value, index) => (
              <div key={`${value}-${index}`} className="flex-1 rounded-t-[3px] bg-[#8DDFF8]" style={{ height: `${value}%` }} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr_0.86fr]">
          <div className="rounded-[8px] border border-[#C9D3E2] bg-white p-4">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#334155]">Risk Mix</p>
            <div className="flex items-center gap-5">
              <div
                className="h-36 w-36 rounded-full"
                style={{
                  background: `conic-gradient(${donutColors[0]} 0 82deg, ${donutColors[1]} 82deg 151deg, ${donutColors[2]} 151deg 232deg, ${donutColors[3]} 232deg 305deg, ${donutColors[4]} 305deg 360deg)`,
                }}
              />
              <div className="space-y-2">
                {template.focus.map((item, index) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: donutColors[index] }} />
                    <span className="text-[12px] font-semibold text-[#4B5565]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-[#C9D3E2] bg-white p-4">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#334155]">Graph Details</p>
            <div className="space-y-4">
              {focusedGraph.map((item) => (
                <HorizontalBar key={item.label} label={`${item.label} risk`} value={item.riskScore} />
              ))}
              {focusedGraph.map((item) => (
                <HorizontalBar key={`${item.label}-vuln`} label={`${item.label} vulnerabilities`} value={item.vulnerabilities * 7} suffix="" />
              ))}
            </div>
          </div>

          <div className="rounded-[8px] border border-[#C9D3E2] bg-white p-4">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#334155]">Risk Bands</p>
            <div className="space-y-4">
              {bandCounts.map((item) => (
                <div key={item.band}>
                  <div className="mb-2 flex justify-between text-[12px] font-bold">
                    <span className="text-[#0C233C]">{item.band}</span>
                    <span className="text-[#5A6478]">{item.count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#E8EDF5]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((item.count / maxBandCount) * 100, item.count > 0 ? 8 : 0)}%`,
                        background: bandTone[item.band],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <MiniTrend />
          <LogPanel logs={template.logs} dark={false} />
        </div>
      </div>
    </div>
  );
}

function ItgcDomainGraph({ items }: { items: readonly { label: string; riskScore: number; vulnerabilities: number }[] }) {
  const controls = ["Design", "Operating", "Evidence"];
  return (
    <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">ITGC Access, Change, Operations Graph</p>
        <BarChart3 className="h-4 w-4 text-[#00B8F5]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item, itemIndex) => (
          <div key={item.label} className="rounded-[8px] border border-[#1D3655] bg-[#0B1728] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] font-bold text-white">{item.label}</p>
              <span className="rounded-full bg-[#16243A] px-3 py-1 text-[11px] font-bold text-[#00B8F5]">{item.riskScore}%</span>
            </div>
            <div className="flex h-40 items-end gap-3">
              {controls.map((control, index) => {
                const value = Math.max(24, item.riskScore - index * 8 + itemIndex * 4);
                return (
                  <div key={control} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <div className="w-full rounded-t-[5px] bg-[linear-gradient(180deg,#00B8F5,#1E49E2)]" style={{ height: `${value}%` }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8EA7C5]">{control}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloudLoggingPanel({ logs }: { logs: readonly string[] }) {
  const rows = logs.map((log, index) => ({
    time: `10:${24 + index * 7}:0${index}`,
    level: index === 0 ? "INFO" : index === 1 ? "WARN" : "ERROR",
    source: index === 0 ? "cloud.identity" : index === 1 ? "cloud.logging" : "cloud.resilience",
    log,
  }));

  return (
    <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">Assessment Data Log</p>
        <Activity className="h-4 w-4 text-[#00B8F5]" />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Log Events", value: "30,884" },
          { label: "Error Rate", value: "2.7%" },
          { label: "Retention", value: "90d" },
        ].map((item) => (
          <div key={item.label} className="rounded-[8px] border border-[#1D3655] bg-[#0B1728] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8EA7C5]">{item.label}</p>
            <p className="mt-2 text-[20px] font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-[8px] border border-[#1D3655]">
        {rows.map((row) => (
          <div key={row.time} className="grid grid-cols-[72px_58px_128px_1fr] gap-3 border-b border-[#1D3655] bg-[#0B1728] px-3 py-2 last:border-b-0">
            <span className="font-mono text-[11px] text-[#8EA7C5]">{row.time}</span>
            <span className={`text-[11px] font-bold ${row.level === "ERROR" ? "text-[#E5001B]" : row.level === "WARN" ? "text-[#FF9E1B]" : "text-[#00D17A]"}`}>{row.level}</span>
            <span className="font-mono text-[11px] text-[#00B8F5]">{row.source}</span>
            <span className="truncate text-[11px] text-[#B8C7D9]">{row.log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CyberVulnerabilityPanel({ items }: { items: readonly { label: string; riskScore: number; vulnerabilities: number }[] }) {
  const total = items.reduce((sum, item) => sum + item.vulnerabilities, 0);
  return (
    <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">Major Vulnerabilities</p>
        <ShieldAlert className="h-4 w-4 text-[#E5001B]" />
      </div>
      <div className="mb-4 rounded-[8px] border border-[#3A1F32] bg-[#160F1C] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C992A1]">Open Vulnerability Volume</p>
        <p className="mt-2 text-[38px] font-bold text-white">{total}</p>
        <p className="mt-1 text-[12px] text-[#C992A1]">prioritized cyber exposure indicators</p>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <HorizontalBar key={item.label} label={`${item.label} vulnerabilities`} value={item.vulnerabilities * 7} suffix="" dark />
        ))}
      </div>
    </div>
  );
}

function normalizeTabLabel(value: string) {
  return value.toLowerCase().replace(/ies$/, "y").replace(/s$/, "");
}

function getItemsForTab(items: readonly DashboardGraphItem[], tab: string) {
  if (tab === "Logs" || tab === "Metrics" || tab === "Risk posture") return items;
  const normalizedTab = normalizeTabLabel(tab);
  const focused = items.filter((item) => normalizeTabLabel(item.label) === normalizedTab);
  return focused.length > 0 ? focused : items;
}

function SectionInsightPanel({
  tab,
  items,
  logs,
}: {
  tab: string;
  items: readonly DashboardGraphItem[];
  logs: readonly string[];
}) {
  const averageRisk = Math.round(items.reduce((sum, item) => sum + item.riskScore, 0) / Math.max(items.length, 1));
  const totalFindings = items.reduce((sum, item) => sum + item.vulnerabilities, 0);
  const relevantLogs = tab === "Logs" ? logs : logs.filter((log) => containsAny(log.toLowerCase(), [normalizeTabLabel(tab), tab.toLowerCase()]));
  const visibleLogs = relevantLogs.length > 0 ? relevantLogs : logs.slice(0, 2);

  return (
    <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">{tab} Data</p>
        <BarChart3 className="h-4 w-4 text-[#00B8F5]" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-[8px] border border-[#1D3655] bg-[#0B1728] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8EA7C5]">Avg Risk</p>
          <p className="mt-2 text-[24px] font-bold text-white">{averageRisk}%</p>
        </div>
        <div className="rounded-[8px] border border-[#1D3655] bg-[#0B1728] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8EA7C5]">Findings</p>
          <p className="mt-2 text-[24px] font-bold text-white">{totalFindings}</p>
        </div>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <HorizontalBar key={item.label} label={`${item.label} risk pressure`} value={item.riskScore} dark />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {visibleLogs.map((log) => (
          <div key={log} className="rounded-[8px] border border-[#1D3655] bg-[#0B1728] p-3 text-[12px] leading-6 text-[#B8C7D9]">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}

function CloudDashboardPage({
  template,
  focus,
  bandCounts,
  maxBandCount,
  activeAssessments,
  highCritical,
  totalVulnerabilities,
}: {
  template: DashboardTemplate;
  focus: string | null;
  bandCounts: { band: string; count: number }[];
  maxBandCount: number;
  activeAssessments: number;
  highCritical: number;
  totalVulnerabilities: number;
}) {
  const focusedGraph = focus ? template.graph.filter((item) => item.label.toLowerCase() === focus.toLowerCase()) : template.graph;
  const isItgc = template.id === "itgc";
  const isCloud = template.id === "cloud";
  const isCyber = template.id === "cyber";
  const tabLabels = isItgc
    ? ["Access", "Change", "Operations", "Logs"]
    : isCyber
      ? ["Vulnerabilities", "Threats", "Incident", "Logs"]
      : ["Logging", "Metrics", "Risk posture", "Logs"];
  const defaultTab = focus ? tabLabels.find((tab) => normalizeTabLabel(tab) === normalizeTabLabel(focus)) ?? tabLabels[0] : tabLabels[0];
  const [activeTab, setActiveTab] = useState(defaultTab);
  const activeItems = getItemsForTab(focusedGraph.length > 0 ? focusedGraph : template.graph, activeTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, template.id]);

  return (
    <div className="h-full overflow-y-auto bg-white text-white">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <HeaderShell title={`${template.title} Dashboard`} subtitle={template.guidance} dark />

        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[#1D3655] bg-[#0B1728] p-2">
          {tabLabels.map((tab, index) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-[6px] px-4 py-2 text-[12px] font-bold ${
                activeTab === tab ? "bg-[#1E49E2] text-white" : "text-[#8EA7C5] hover:bg-[#101B2B] hover:text-white"
              }`}
              aria-pressed={activeTab === tab}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { label: "Active Assessments", value: activeAssessments },
            { label: "High Risk", value: highCritical },
            { label: "Vulnerabilities", value: totalVulnerabilities },
            { label: `${template.shortTitle} Score`, value: "64%" },
          ].map((item) => (
            <div key={item.label} className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">{item.label}</p>
              <p className="mt-3 text-[30px] font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        {isItgc ? (
          <ItgcDomainGraph items={activeTab === "Logs" ? template.graph : activeItems} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(260px,0.9fr)_minmax(190px,0.55fr)_minmax(190px,0.55fr)]">
            {template.metrics.slice(0, 3).map((metric) => (
              <SemiGauge key={metric.label} label={metric.label} value={metric.value} />
            ))}
            <DonutPanel items={template.graph} />
            <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">Risk Score</p>
              <p className="mt-5 text-[34px] font-bold text-white">3.62</p>
              <p className="mt-2 text-[12px] leading-6 text-[#B8C7D9]">avg weighted exposure</p>
            </div>
            <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">Assessment</p>
              <p className="mt-5 text-[34px] font-bold text-white">64%</p>
              <p className="mt-2 text-[12px] leading-6 text-[#B8C7D9]">control readiness</p>
            </div>
          </div>
        )}

        <div className={`grid gap-4 ${isCyber && activeTab === "Logs" ? "" : "xl:grid-cols-[1.35fr_0.65fr]"}`}>
          <CloudTrendGraph
            labels={activeTab === "Logs" ? template.focus : activeItems.map((item) => item.label)}
            title={`${activeTab} Trend`}
          />

          {activeTab === "Logs" && !isCyber ? (
            <LogPanel logs={template.logs} dark />
          ) : isCloud && activeTab === "Logging" ? (
            <CloudLoggingPanel logs={template.logs} />
          ) : isCyber ? (
            activeTab === "Logs" ? null : <CyberVulnerabilityPanel items={activeItems} />
          ) : (
            <SectionInsightPanel tab={activeTab} items={activeItems} logs={template.logs} />
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.72fr_0.72fr_1fr]">
          <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">Risk Bands</p>
            <div className="space-y-4">
              {bandCounts.map((item) => (
                <div key={item.band}>
                  <div className="mb-2 flex justify-between text-[12px] font-bold">
                    <span className="text-[#D8E8FA]">{item.band}</span>
                    <span className="text-[#91A8C2]">{item.count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#22344D]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((item.count / maxBandCount) * 100, item.count > 0 ? 8 : 0)}%`,
                        background: bandTone[item.band],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[8px] border border-[#1D3655] bg-[#101B2B] p-4">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#8EA7C5]">KPI Rings</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Patch SLA", value: 72 },
                { label: "Alerts", value: 88 },
              ].map((item) => (
                <div key={item.label} className="rounded-[8px] border border-[#1D3655] bg-[#0B1728] p-3">
                  <div
                    className="mx-auto grid h-24 w-24 place-items-center rounded-full"
                    style={{ background: `conic-gradient(#00B8F5 ${item.value * 3.6}deg, #22344D 0deg)` }}
                  >
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-[#0B1728]">
                      <span className="text-[16px] font-bold text-white">{item.value}%</span>
                    </div>
                  </div>
                  <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#8EA7C5]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {activeTab === "Logs" ? <LogPanel logs={template.logs} dark /> : <DonutPanel items={activeItems} />}
        </div>
      </div>
    </div>
  );
}

function HeaderShell({ title, subtitle, dark }: { title: string; subtitle: string; dark: boolean }) {
  const [, setLocation] = useLocation();
  return (
    <section className={`rounded-[8px] border p-5 shadow-[0_18px_44px_-34px_rgba(12,35,60,0.6)] sm:p-6 ${dark ? "border-[#1D3655] bg-[#0B1728]" : "border-[#C9D3E2] bg-white"}`}>
      <button
        type="button"
        onClick={() => setLocation("/risk-assessment/new")}
        className={`mb-5 inline-flex w-fit items-center gap-2 rounded-[8px] border px-4 py-2 text-[12px] font-bold ${
          dark ? "border-[#1D3655] bg-[#101B2B] text-[#D8E8FA] hover:bg-[#16243A]" : "border-[#D8E0ED] bg-[#F7F9FC] text-[#0C233C] hover:bg-white"
        }`}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to guidance
      </button>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[860px]">
          <p className={`text-[11px] font-bold uppercase tracking-[0.28em] ${dark ? "text-[#8EA7C5]" : "text-[#5A6478]"}`}>Assessment Details</p>
          <h1 className={`mt-2 text-[28px] font-bold tracking-[-0.04em] sm:text-[36px] ${dark ? "text-white" : "text-[#0C233C]"}`}>{title}</h1>
          <p className={`mt-3 text-[14px] leading-7 ${dark ? "text-[#B8C7D9]" : "text-[#5A6478]"}`}>{subtitle}</p>
        </div>
      </div>
    </section>
  );
}

function LogPanel({ logs, dark }: { logs: readonly string[]; dark: boolean }) {
  return (
    <div className={`rounded-[8px] border p-4 ${dark ? "border-[#1D3655] bg-[#101B2B]" : "border-[#C9D3E2] bg-white"}`}>
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className={`h-4 w-4 ${dark ? "text-[#00B8F5]" : "text-[#1E49E2]"}`} />
        <p className={`text-[12px] font-bold uppercase tracking-[0.18em] ${dark ? "text-[#8EA7C5]" : "text-[#334155]"}`}>Metrics Logs</p>
      </div>
      <div className="space-y-3">
        {logs.map((log, index) => (
          <div key={log} className={`flex gap-3 rounded-[8px] border p-3 ${dark ? "border-[#1D3655] bg-[#0B1728]" : "border-[#D8E0ED] bg-[#FBFCFE]"}`}>
            <div className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ${dark ? "bg-[#16243A] text-[#00B8F5]" : "bg-[#EEF2FF] text-[#1E49E2]"}`}>
              {index === 0 ? <Activity className="h-4 w-4" /> : index === 1 ? <BarChart3 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            </div>
            <p className={`text-[12px] leading-6 ${dark ? "text-[#B8C7D9]" : "text-[#4B5565]"}`}>{log}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RiskAssessmentTemplateInsightsPage() {
  const [location] = useLocation();
  const { assessments, fetchAssessments } = useRiskAssessment();
  const template = getAssessmentTemplate(getTemplateIdFromLocation(location));
  const focus = getFocusFromLocation(location);

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  const derived = deriveRiskGraph(template, assessments);
  const dashboardTemplate = {
    ...template,
    graph: derived.graph,
    metrics: derived.metrics,
  };
  const bandCounts = ["Critical", "High", "Medium", "Low"].map((band) => ({
    band,
    count: derived.risks.filter((risk) => risk.inherent_risk_band === band).length,
  }));
  const maxBandCount = Math.max(...bandCounts.map((item) => item.count), 1);

  return (
    <CloudDashboardPage
      template={dashboardTemplate}
      focus={focus}
      bandCounts={bandCounts}
      maxBandCount={maxBandCount}
      activeAssessments={derived.activeAssessments}
      highCritical={derived.highCritical}
      totalVulnerabilities={derived.totalVulnerabilities}
    />
  );
}
