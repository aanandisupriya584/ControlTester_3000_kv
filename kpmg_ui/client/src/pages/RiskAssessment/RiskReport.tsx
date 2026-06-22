import React, { useState } from "react";
import HeroSubSection from "@/components/HeroSubSection.tsx";
import { FileText, ShieldAlert, Layers } from "lucide-react";
import {processRiskReportData} from "@/pages/RiskAssessment/helper/HelperFn.tsx";
import {useRiskAssessment} from "@/contexts/RiskAssessmentContext.tsx";
import {PdfCodeHelper} from "@/pages/RiskAssessment/PdfCodeHelper.tsx";

// ===== Types =====
export interface Risk {
    id: string | number;
    name: string;
    description?: string;
    likelihood: "Very Low" | "Low" | "Medium" | "High" | "Very High";
    impact: "Very Low" | "Low" | "Medium" | "High" | "Very High";
    riskClass: "Low" | "Medium" | "High" | "Very High";
    status: "Open" | "In Progress" | "Closed" | "Mitigated";
    dateIdentified: string;
    owner?: string;
}

export interface RiskReportProps {
    risks?: Risk[];
    title?: string;
    backLink?: {
        text: string;
        href: string;
    };
    draftsCount?: number;
    highRisksCount?: number;
    totalAssessmentsCount?: number;
}

// ===== SummaryCards Component =====
interface SummaryCardsProps {
    drafts: number;
    highRisks: number;
    totalAssessments: number;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({
                                                       drafts,
                                                       highRisks,
                                                       totalAssessments,
                                                   }) => {
    const cards = [
        {
            label: "Total Risks",
            value: totalAssessments,//totalAssessments,
            detail: "Includes active & draft assessments",
            badge: `${totalAssessments} total`,
            badgeClassName: "bg-[#E6DCF2] text-[#7213EA]",
            icon: Layers,
            iconColor: "text-[#7213EA]",
            iconBg: "#E6DCF2",
        }, {
            label: "Drafts",
            value: drafts,
            detail: "Waiting to begin questionnaire capture",
            badge: `${drafts} needs your attention`,
            badgeClassName: "bg-[#FAF2DE] text-[#F5AD0A]",
            icon: FileText,
            iconColor: "text-[#5F5C61]",
            iconBg: "#E9E8EB",
        },
        {
            label: "High Risks",
            value: highRisks,
            detail: "Across all fetched assessments",
            badge: `${highRisks} Critical`,
            badgeClassName: "bg-[#F7E4E5] text-[#E63946]",
            icon: ShieldAlert,
            iconColor: "text-[#E63946]",
            iconBg: "#F7E4E5",
        },

    ];

    return (
        <section className="mb-9 grid gap-5 md:grid-cols-3">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className="relative max-h-[150px] overflow-hidden rounded-[18px] border border-[#DCE3EE] bg-white px-6 py-7 shadow-sm"
                >
                    <div style={{ display: "flex", alignItems: "center", height: "60px" }}>
                        <div
                            style={{
                                padding: "5px",
                                borderRadius: "50%",
                                background: card.iconBg,
                            }}
                        >
                            <card.icon className={card.iconColor} />
                        </div>
                        <div style={{ marginLeft: "5px" }}>
                            <div className="min-h-[30px] max-h-[45px]">
                                <p className="text-[13px] font-bold leading-6 tracking-[0.1em] text-[#6D7EA8]">
                                    {card.label}
                                </p>
                            </div>
                            <div className="mt-1 text-[45px] font-bold leading-none tracking-[-0.05em] text-[#001B3A]">
                                {card.value}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", marginTop: "1rem" }}>
                        <div
                            className={`mt-1 ml-5 inline-flex max-w-full rounded-full px-4 py-2 text-[9px] font-bold ${card.badgeClassName}`}
                        >
                            <span className="break-words">{card.badge}</span>
                        </div>
                    </div>
                </div>
            ))}
        </section>
    );
};

// ===== Complete Dummy Data (restored) =====
const dummyRisks: Risk[] = [
    {
        id: 1,
        name: "Payment Gateway Failure",
        description: "Third‑party payment gateway may become unavailable.",
        likelihood: "Medium",
        impact: "High",
        riskClass: "High",
        status: "In Progress",
        dateIdentified: "2025-12-10",
        owner: "John Doe",
    },
    {
        id: 2,
        name: "Data Breach in HRMS",
        description: "Sensitive employee data exposed due to misconfiguration.",
        likelihood: "Low",
        impact: "Very High",
        riskClass: "High",
        status: "Open",
        dateIdentified: "2026-01-05",
        owner: "Jane Smith",
    },
    {
        id: 3,
        name: "Vendor API Deprecation",
        description: "Vendor to deprecate current API version in 6 months.",
        likelihood: "High",
        impact: "Medium",
        riskClass: "High",
        status: "Open",
        dateIdentified: "2026-02-15",
        owner: "Mike Johnson",
    },
    {
        id: 4,
        name: "Insufficient Security Testing",
        description: "Penetration testing not performed for new modules.",
        likelihood: "Medium",
        impact: "Medium",
        riskClass: "Medium",
        status: "In Progress",
        dateIdentified: "2026-03-01",
        owner: "Sarah Lee",
    },
    {
        id: 5,
        name: "Budget Overrun",
        description: "Project may exceed allocated budget by 20%.",
        likelihood: "High",
        impact: "Low",
        riskClass: "Medium",
        status: "Closed",
        dateIdentified: "2025-11-20",
        owner: "David Chen",
    },
    {
        id: 6,
        name: "Compliance Gap (GDPR)",
        description: "New data processing activities may violate GDPR.",
        likelihood: "Low",
        impact: "Very High",
        riskClass: "High",
        status: "Open",
        dateIdentified: "2026-02-28",
        owner: "Emma Wilson",
    },
];

// ===== RiskReport Component =====
const RiskReportPage: React.FC<RiskReportProps> = ({
                                                   risks = dummyRisks,
                                                   title = "Risk Report",
                                                   backLink = { text: "← Back", href: "/risk-assessment" },
                                                   draftsCount = 0,
                                                   highRisksCount = 0,
                                                   totalAssessmentsCount = 0,
                                               }) => {
    const [sortField, setSortField] = useState<keyof Risk>("riskClass");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    // Summary stats (for status breakdown)
    const total = risks.length;
    const byClass = risks.reduce<Record<string, number>>((acc, r) => {
        acc[r.riskClass] = (acc[r.riskClass] || 0) + 1;
        return acc;
    }, {});
    const byStatus = risks.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    // Sorting
    const handleSort = (field: keyof Risk) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const sortedRisks = [...risks].sort((a, b) => {
        let aVal = a[sortField] ?? "";
        let bVal = b[sortField] ?? "";
        if (typeof aVal === "string" && typeof bVal === "string") {
            return sortDirection === "asc"
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }
        return 0;
    });
    const handleDownloadPDF = () => {
        PdfCodeHelper(
            risks,                 // your risk array
            risks.length,          // total risks (or use totalAssessmentsCount if you want)
            draftsCount,
            highRisksCount,
            title
        );
    };
    // Export functions
    const exportCSV = () => {
        const headers = [
            "ID",
            "Name",
            "Description",
            "Likelihood",
            "Impact",
            "Risk Class",
            "Status",
            "Date Identified",
            "Owner",
        ];
        const rows = risks.map((r) => [
            r.id,
            `"${r.name}"`,
            `"${r.description || ""}"`,
            r.likelihood,
            r.impact,
            r.riskClass,
            r.status,
            new Date(r.dateIdentified).toLocaleDateString(),
            `"${r.owner || ""}"`,
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row) => row.join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute(
            "download",
            `risk_report_${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const printReport = () => {
        window.print();
    };

    // Colour mapping for risk class badges
    const classColors: Record<string, string> = {
        Low: "bg-green-100 text-green-800",
        Medium: "bg-yellow-100 text-yellow-800",
        High: "bg-orange-100 text-orange-800",
        "Very High": "bg-red-100 text-red-800",
    };

    return (
        <div className="relative h-full overflow-auto bg-[#F0F2F7]">
            <HeroSubSection
                title={title}
                subtitle="A comprehensive overview of identified risks, their classifications, and statuses."
            />
            <div className="w-full bg-white min-h-screen p-4 sm:p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                        <div className="flex items-center gap-3 mt-2 sm:mt-0">
                            <a
                                href={backLink.href}
                                className="text-indigo-600 hover:text-indigo-800 hover:underline text-sm font-medium"
                            >
                                {backLink.text}
                            </a>
                        </div>
                    </div>

                    {/* ===== REPLACED SUMMARY CARDS ===== */}
                    <SummaryCards
                        drafts={draftsCount}
                        highRisks={highRisksCount}
                        totalAssessments={totalAssessmentsCount}
                    />

                    {/* Status breakdown (optional) */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        {Object.entries(byStatus).map(([status, count]) => (
                            <span key={status} className="text-sm text-gray-600">
                {status} ({count})
              </span>
                        ))}
                    </div>

                    {/* Toolbar with export buttons */}
                    <div className="flex flex-wrap gap-3 mb-4 justify-between items-center">
                        <div className="text-sm text-gray-500">
                            {risks.length} risks displayed
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={exportCSV}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                            >
                                ⬇ Export CSV
                            </button>
                            <button
                                // onClick={handleDownloadPDF}
                                onClick={printReport}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                            >
                                🖨 Print / PDF
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto shadow-md rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-[#7213EA] text-white">
                            <tr>
                                {[
                                    { key: "id", label: "ID" },
                                    { key: "name", label: "Risk Name" },
                                    { key: "likelihood", label: "Likelihood" },
                                    { key: "impact", label: "Impact" },
                                    { key: "riskClass", label: "Risk Class" },
                                    { key: "status", label: "Status" },
                                    { key: "dateIdentified", label: "Date" },
                                    { key: "owner", label: "Owner" },
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key as keyof Risk)}
                                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-[#8738EB] transition"
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {sortField === col.key && (
                                                <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {sortedRisks.map((risk) => (
                                <tr key={risk.id} className="hover:bg-gray-50 transition">
                                    <td className="px-4 py-3 text-sm text-gray-500">{risk.id}</td>
                                    {/*<td className="px-4 py-3 text-sm font-medium text-gray-900">*/}
                                    {/*    {risk.name}*/}
                                    {/*    {risk.description && (*/}
                                    {/*        <div className="text-xs text-gray-400 truncate max-w-xs">*/}
                                    {/*            {risk.description}*/}
                                    {/*        </div>*/}
                                    {/*    )}*/}
                                    {/*</td>*/}
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {risk.name}
                                        {risk.description && (
                                            <div className="text-xs text-gray-400 whitespace-normal break-words">
                                                {risk.description}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{risk.likelihood}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{risk.impact}</td>
                                    <td className="px-4 py-3 text-sm">
                      <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                              classColors[risk.riskClass] || "bg-gray-100 text-gray-800"
                          }`}
                      >
                        {risk.riskClass}
                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{risk.status}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {new Date(risk.dateIdentified).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{risk.owner || "—"}</td>
                                </tr>
                            ))}
                            {risks.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No risks to display.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer note */}
                    <div className="mt-4 text-xs text-gray-400 text-center">
                        Report generated on {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
};

const RiskReport:any=()=>{
    const {
        assessments,
    } = useRiskAssessment();
    const { risks, draftsCount, highRisksCount, totalAssessmentsCount } =
        processRiskReportData(assessments);
    return  <RiskReportPage
        risks={risks}
        draftsCount={draftsCount}
        highRisksCount={highRisksCount}
        totalAssessmentsCount={totalAssessmentsCount}
        // title, backLink optional
    />
}
export default RiskReport;
