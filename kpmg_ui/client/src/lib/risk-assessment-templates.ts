export const ASSESSMENT_TEMPLATES = [
  {
    id: "itgc",
    title: "ITGC Assessment",
    shortTitle: "ITGC",
    description: "Access, change, operations, backup, and monitoring coverage.",
    guidance:
      "Use this when the audit scope is focused on IT general controls. It helps reviewers explain whether access, production changes, batch operations, backup, and monitoring controls are designed strongly enough for the application.",
    focus: ["Access", "Change", "Operations"],
    graph: [
      { label: "Access", sectionIds: ["identity_access"], riskScore: 82, vulnerabilities: 9 },
      { label: "Change", sectionIds: ["secure_build_change"], riskScore: 74, vulnerabilities: 6 },
      { label: "Operations", sectionIds: ["business_criticality", "logging_monitoring", "resilience_backup"], riskScore: 68, vulnerabilities: 5 },
    ],
    metrics: [
      { label: "Privileged Access", value: 82 },
      { label: "Emergency Change", value: 74 },
      { label: "Job Monitoring", value: 68 },
      { label: "Backup Evidence", value: 76 },
    ],
    logs: [
      "Access recertification evidence should be checked for reviewer sign-off and completion date.",
      "Change tickets should include approval, testing, implementation, and rollback evidence.",
      "Operations review should confirm failed jobs, backups, and monitoring alerts are investigated.",
    ],
  },
  {
    id: "cloud",
    title: "Cloud Risk",
    shortTitle: "Cloud",
    description: "Cloud configuration, identity, logging, resilience, and data protection.",
    guidance:
      "Use this when the assessment scope includes cloud-hosted applications or cloud infrastructure. It highlights identity posture, logging coverage, resilience, encryption, and misconfiguration exposure.",
    focus: ["Identity", "Logging", "Resilience"],
    graph: [
      { label: "Identity", sectionIds: ["identity_access"], riskScore: 79, vulnerabilities: 8 },
      { label: "Logging", sectionIds: ["logging_monitoring"], riskScore: 66, vulnerabilities: 7 },
      { label: "Resilience", sectionIds: ["resilience_backup"], riskScore: 71, vulnerabilities: 4 },
    ],
    metrics: [
      { label: "MFA Coverage", value: 79 },
      { label: "Audit Logging", value: 66 },
      { label: "Encryption", value: 73 },
      { label: "Recovery Readiness", value: 71 },
    ],
    logs: [
      "Cloud identity review should validate MFA, privileged roles, stale users, and service accounts.",
      "Logging review should confirm cloud audit logs are enabled, retained, and monitored.",
      "Resilience review should confirm backup frequency, restore testing, and region failover readiness.",
    ],
  },
  {
    id: "cyber",
    title: "Cyber Risk",
    shortTitle: "Cyber",
    description: "Threat exposure, vulnerability response, incident readiness, and monitoring.",
    guidance:
      "Use this when the discussion is about cyber exposure rather than only ITGC control operation. It shows threat surfaces, vulnerability ageing, monitoring, and incident response readiness.",
    focus: ["Threats", "Vulnerability", "Incident"],
    graph: [
      { label: "Threats", sectionIds: ["exposure_architecture", "special_risk_indicators"], riskScore: 84, vulnerabilities: 12 },
      { label: "Vulnerability", sectionIds: ["secure_build_change"], riskScore: 77, vulnerabilities: 10 },
      { label: "Incident", sectionIds: ["logging_monitoring", "special_risk_indicators"], riskScore: 69, vulnerabilities: 6 },
    ],
    metrics: [
      { label: "External Exposure", value: 84 },
      { label: "Patch Ageing", value: 77 },
      { label: "Detection Coverage", value: 69 },
      { label: "Incident Readiness", value: 72 },
    ],
    logs: [
      "Threat review should confirm internet-facing services, third-party access, and sensitive integrations.",
      "Vulnerability review should check critical findings, SLA breaches, and remediation ownership.",
      "Incident review should confirm playbooks, alert triage, lessons learned, and evidence retention.",
    ],
  },
] as const;

export type AssessmentTemplateId = (typeof ASSESSMENT_TEMPLATES)[number]["id"];

export function getAssessmentTemplate(templateId?: string) {
  return ASSESSMENT_TEMPLATES.find((template) => template.id === templateId) ?? ASSESSMENT_TEMPLATES[0];
}
