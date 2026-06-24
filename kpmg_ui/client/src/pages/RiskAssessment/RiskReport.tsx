import React, { useState } from "react";
import HeroSubSection from "@/components/HeroSubSection.tsx";
import { FileText, ShieldAlert, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import {
    processRiskDistribution,
    processRiskHeatmapData,
    processRiskReportData
} from "@/pages/RiskAssessment/helper/HelperFn.tsx";
import { useRiskAssessment } from "@/contexts/RiskAssessmentContext.tsx";
import { PdfCodeHelper } from "@/pages/RiskAssessment/PdfCodeHelper.tsx";
import RiskHeatMap from "@/pages/RiskAssessment/RiskHeatMap.tsx";
import RiskDistribution from "@/pages/RiskAssessment/RiskDistribution.tsx";

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
    heatmapData?: any;
    totalAssessments?: any;
    riskItems?: any;
}

// ===== SummaryCards Component (updated) =====
interface SummaryCardsProps {
    totalRisks: number;
    mediumRisks: number;
    highRisks: number;      // count of "High" + "Very High"
    criticalRisks: number;  // count of "Very High"
}

const SummaryCards: React.FC<SummaryCardsProps> = ({
                                                       totalRisks,
                                                       mediumRisks,
                                                       highRisks,
                                                       criticalRisks,
                                                   }) => {
    const cards = [
        {
            label: "Total Risks",
            value: totalRisks,
            detail: "All identified risks",
            badge: `All risks identified across all assessments`,
            badgeClassName: "bg-[#E6DCF2] text-[#7213EA]",
            icon: Layers,
            iconColor: "text-[#7213EA]",
            iconBg: "#E6DCF2",
        },
        {
            label: "Medium Risks",
            value: mediumRisks,
            detail: "Risks with medium severity",
            badge: `Risks with moderate severity`,
            badgeClassName: "bg-[#FAF2DE] text-[#F5AD0A]",
            icon: FileText,
            iconColor: "text-[#5F5C61]",
            iconBg: "#E9E8EB",
        },
        {
            label: "High Risks",
            value: highRisks,
            detail: "High or Very High severity",
            badge: `${criticalRisks} Critical`,
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

// ===== Dummy Data =====
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
                                                       heatmapData,
                                                       totalAssessments,
                                                       riskItems,
                                                   }) => {
    // ---- Compute summary stats from risks ----
    const totalRisks = risks.length;
    const mediumRisks = risks.filter(r => r.riskClass === "Medium").length;
    const highRisks = risks.filter(r => r.riskClass === "High" || r.riskClass === "Very High").length;
    const criticalRisks = risks.filter(r => r.riskClass === "Very High").length;

    // ---- Sorting & Pagination State ----
    const [sortField, setSortField] = useState<keyof Risk>("riskClass");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc"); // Very High first
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Severity order for riskClass (higher index = higher severity)
    const severityRank: Record<string, number> = {
        "Very High": 4,
        "High": 3,
        "Medium": 2,
        "Low": 1,
    };

    // ---- Status breakdown (for display) ----
    const byStatus = risks.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    // ---- Sorting Logic ----
    const handleSort = (field: keyof Risk) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
        setCurrentPage(1);
    };

    const sortedRisks = [...risks].sort((a, b) => {
        let aVal = a[sortField] ?? "";
        let bVal = b[sortField] ?? "";

        if (sortField === "riskClass") {
            const aRank = severityRank[aVal as string] || 0;
            const bRank = severityRank[bVal as string] || 0;
            return sortDirection === "desc" ? bRank - aRank : aRank - bRank;
        }

        if (typeof aVal === "string" && typeof bVal === "string") {
            return sortDirection === "asc"
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }
        return 0;
    });

    // ---- Pagination ----
    const totalPages = Math.ceil(sortedRisks.length / pageSize);
    const paginatedRisks = sortedRisks.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
    }

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // ---- Export Functions ----
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

    const handleDownloadPDF = () => {
        PdfCodeHelper(
            risks,
            risks.length,
            0, // draftsCount no longer used
            highRisks,
            title
        );
    };

    // ---- Colour mapping for risk badges ----
    const classColors: Record<string, string> = {
        Low: "bg-green-100 text-green-800",
        Medium: "bg-yellow-100 text-yellow-800",
        High: "bg-orange-100 text-orange-800",
        "Very High": "bg-red-100 text-red-800",
    };

    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, sortedRisks.length);

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

                    {/* Summary Cards */}
                    <SummaryCards
                        totalRisks={totalRisks}
                        mediumRisks={mediumRisks}
                        highRisks={highRisks}
                        criticalRisks={criticalRisks}
                    />

                    {/* Status breakdown */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        {Object.entries(byStatus).map(([status, count]) => (
                            <span key={status} className="text-sm text-gray-600">
                                {status} ({count})
                            </span>
                        ))}
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap gap-3 mb-4 justify-between items-center">
                        <div className="text-sm text-gray-500">
                            {sortedRisks.length > 0
                                ? `Showing ${startIndex}–${endIndex} of ${sortedRisks.length} risks`
                                : "No risks to display"}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={exportCSV}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                            >
                                ⬇ Export CSV
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                            >
                                🖨 Download PDF
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
                            {paginatedRisks.map((risk) => (
                                <tr key={risk.id} className="hover:bg-gray-50 transition">
                                    <td className="px-4 py-3 text-sm text-gray-500">{risk.id}</td>
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
                                    <td className="px-4 py-3 text-sm w-[8rem]">
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
                            {paginatedRisks.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No risks to display.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 px-2">
                            <div className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                                            page === currentPage
                                                ? "bg-[#7213EA] text-white"
                                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Charts */}
                    <div className={'grid grid-cols-2 mt-2 gap-5'}>
                        <div className={'w-full'}>
                            <RiskHeatMap data={heatmapData} />
                        </div>
                        <div className={'w-full'}>
                            <RiskDistribution
                                riskItems={riskItems}
                                totalAssessments={totalAssessments}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 text-xs text-gray-400 text-center">
                        Report generated on {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ===== Wrapper that consumes context =====
const RiskReport: React.FC = () => {
    const { assessments } = useRiskAssessment();
    const { totalAssessments, riskItems } = processRiskDistribution(assessments);
    const heatmapData = processRiskHeatmapData(assessments);
    const { risks } = processRiskReportData(assessments); // we only need risks now

    return (
        <RiskReportPage
            risks={risks}
            heatmapData={heatmapData}
            totalAssessments={totalAssessments}
            riskItems={riskItems}
        />
    );
};

export default RiskReport;
