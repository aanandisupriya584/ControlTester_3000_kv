import React from "react";

// ===== Types =====
export interface HeatmapCell {
    count: number;
    riskClass: string;
}

export interface RiskHeatmapProps {
    data?: HeatmapCell[][];
    likelihoodLabels?: string[];
    impactLabels?: string[];
    riskClassMapping?: {
        [key: string]: {
            label: string;
            bgColor: string;
            textColor?: string;
        };
    };
    title?: string;
    subtitle?: string;
    footerLink?: {
        text: string;
        href: string;
    };
    setRiskHeatMap: (value: boolean) => void;
}

// ===== Dummy Data =====
const dummyData: HeatmapCell[][] = [
    [
        { count: 0, riskClass: "Low" },
        { count: 0, riskClass: "Low" },
        { count: 0, riskClass: "Low" },
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "Medium" },
    ],
    [
        { count: 0, riskClass: "Low" },
        { count: 0, riskClass: "Low" },
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "High" },
    ],
    [
        { count: 0, riskClass: "Low" },
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "High" },
        { count: 0, riskClass: "High" },
    ],
    [
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "High" },
        { count: 0, riskClass: "High" },
        { count: 0, riskClass: "Very High" },
    ],
    [
        { count: 0, riskClass: "Medium" },
        { count: 0, riskClass: "High" },
        { count: 0, riskClass: "High" },
        { count: 0, riskClass: "Very High" },
        { count: 0, riskClass: "Very High" },
    ],
];

const dummyLikelihoodLabels = [
    "Rare",
    "Unlikely",
    "Possible",
    "Likely",
    "Almost Certain",
];

const dummyImpactLabels = [
    "Insignificant",
    "Minor",
    "Moderate",
    "Major",
    "Severe",
];

const dummyRiskMapping = {
    Low: {
        label: "Low",
        bgColor: "bg-green-300",
        textColor: "text-green-900",
    },
    Medium: {
        label: "Medium",
        bgColor: "bg-yellow-300",
        textColor: "text-yellow-900",
    },
    High: {
        label: "High",
        bgColor: "bg-orange-300",
        textColor: "text-orange-900",
    },
    "Very High": {
        label: "Very High",
        bgColor: "bg-red-400",
        textColor: "text-red-900",
    },
};

// ===== Component =====
const RiskHeatMap: React.FC<RiskHeatmapProps> = ({
                                                     data = dummyData,
                                                     likelihoodLabels = dummyLikelihoodLabels,
                                                     impactLabels = dummyImpactLabels,
                                                     riskClassMapping = dummyRiskMapping,
                                                     title = "Risk Heatmap",
                                                     subtitle = "Likelihood vs. Impact • Numbers indicate risk count",
                                                     footerLink = { text: "View full report →", href: "/risk-report" },
                                                     setRiskHeatMap,
                                                 }) => {
    // ✅ Helper to safely access the mapping with a fallback
    const getMapping = (cls: string) => {
        // Use 'as any' to bypass index signature error; we know the object is valid
        const mapping = (riskClassMapping as any)[cls];
        return mapping || {
            label: cls || "Unknown",
            bgColor: "bg-gray-200",
            textColor: "text-gray-800",
        };
    };

    // If no data or empty, show message
    if (!data || data.length === 0) {
        return (
            <div className="w-full bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                No risk data available.
            </div>
        );
    }

    // Normalise rows to same length
    const colCount = Math.max(...data.map((row) => row.length));
    const normalizedData = data.map((row) => {
        const newRow = [...row];
        while (newRow.length < colCount) {
            newRow.push({ count: 0, riskClass: "Unknown" });
        }
        return newRow;
    });

    // Unique risk classes for legend
    const allClasses = new Set<string>();
    normalizedData.forEach((row) =>
        row.forEach((cell) => {
            if (cell.riskClass) allClasses.add(cell.riskClass);
        })
    );
    const sortedClasses = Array.from(allClasses).sort();

    // Ensure labels match data dimensions
    const likelihoods =
        likelihoodLabels.length >= normalizedData.length
            ? likelihoodLabels
            : Array.from({ length: normalizedData.length }, (_, i) => `Row ${i + 1}`);
    const impacts =
        impactLabels.length >= colCount
            ? impactLabels
            : Array.from({ length: colCount }, (_, i) => `Col ${i + 1}`);

    return (
        <div className="w-full bg-white rounded-lg mt-5 shadow-md p-4 sm:p-6 h-[380px]">
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    height: "2rem",
                    position: "relative",
                }}
            >
                <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-1">
                    {title}
                </h3>
                {/* Legend */}
                {sortedClasses.length > 0 && (
                    <div
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-center sm:justify-start"
                        style={{ position: "absolute", right: 0, top: 0 }}
                    >
                        <span className="text-xs text-gray-600 mr-1">Risk Level:</span>
                        {sortedClasses.map((cls) => {
                            const mapping = getMapping(cls);
                            const bgColor = mapping.bgColor;
                            const label = mapping.label;
                            return (
                                <div key={cls} className="flex items-center gap-1">
                                    <div className={`w-4 h-4 ${bgColor} rounded-sm`} />
                                    <span className="text-xs text-gray-600">{label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {subtitle && (
                <p className="text-xs sm:text-sm text-gray-500">{subtitle}</p>
            )}
            {footerLink && (
                <div className=" ">
                    <a
                        href={footerLink.href}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs sm:text-sm font-medium"
                    >
                        {footerLink.text} →
                    </a>
                </div>
            )}

            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                    {/* Impact header */}
                    <div className="grid grid-cols-6 gap-1 mb-1">
                        <div className="col-span-1" />
                        {impacts.map((label) => (
                            <div
                                key={label}
                                className="text-xs font-medium text-gray-600 text-center px-1 py-1"
                            >
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {normalizedData.map((row, rowIdx) => (
                        <div
                            key={likelihoods[rowIdx] || `row-${rowIdx}`}
                            className="grid grid-cols-6 gap-1 mb-1"
                        >
                            <div className="flex items-center justify-end pr-2 text-xs font-medium text-gray-600">
                                {likelihoods[rowIdx] || `Row ${rowIdx + 1}`}
                            </div>

                            {row.map((cell, colIdx) => {
                                const mapping = getMapping(cell.riskClass);
                                const bgColor = mapping.bgColor;
                                const textColor = mapping.textColor;
                                const displayLabel = mapping.label;

                                return (
                                    <div
                                        key={`${rowIdx}-${colIdx}`}
                                        className={`${bgColor} rounded-md p-1 sm:p-2 text-center transition-colors relative group`}
                                    >
                    <span
                        className={`text-xs sm:text-sm font-bold ${textColor} inline-block min-w-[16px]`}
                    >
                      {cell.count > 0 ? cell.count : ""}
                    </span>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                            {displayLabel} risk {cell.count > 0 && `(${cell.count})`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer link - back to Risk Distribution */}
            <div className="w-[120px]" onClick={() => setRiskHeatMap(true)}>
                <a
                    href="#"
                    className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs sm:text-sm font-medium"
                >
                    ← Risk Distribution
                </a>
            </div>
        </div>
    );
};

export default RiskHeatMap;
