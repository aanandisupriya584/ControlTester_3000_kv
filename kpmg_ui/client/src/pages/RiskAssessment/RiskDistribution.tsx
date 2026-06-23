import React from "react";

// Updated interface – colour classes are NOT passed from parent
interface RiskItem {
    label: string;          // e.g. "Low", "Medium", "High", "Very High"
    count: number;
    percentage: number;     // 0–100
}

interface RiskDistributionProps {
    riskItems: RiskItem[];          // processed data
    totalAssessments: number;       // total number of assessments
    setRiskHeatMap?: (value: boolean) => void;
}

// Colour mapping (exactly as you specified)
const RISK_COLORS: Record<string, { bg: string; text: string }> = {
    Low: {
        bg: "bg-green-300",
        text: "text-green-900",
    },
    Medium: {
        bg: "bg-yellow-300",
        text: "text-yellow-900",
    },
    High: {
        bg: "bg-orange-300",
        text: "text-orange-900",
    },
    "Very High": {
        bg: "bg-red-400",
        text: "text-red-900",
    },
};

// Fallback colours for any unrecognised label
const FALLBACK_COLORS = {
    bg: "bg-gray-300",
    text: "text-gray-900",
};

const RiskDistribution: React.FC<RiskDistributionProps> = ({
                                                               riskItems,
                                                               totalAssessments,
                                                               setRiskHeatMap,
                                                           }) => {
    // No dummy data – all items come from props

    const maxPercentage = Math.max(...riskItems.map((r) => r.percentage), 0);

    return (
        <div className="w-full bg-white rounded-lg mt-5 shadow-md p-4 sm:p-6 h-[380px]">
            <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-8">
                Risk Distribution
            </h3>

            <div className="flex justify-between items-center pb-2 border-b border-gray-100 mb-3">
                <span className="text-sm sm:text-base font-medium text-gray-700">Total</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">
          {totalAssessments} Assessments
        </span>
            </div>

            <div className="space-y-3">
                {riskItems.map((item) => {
                    // Get colours based on label, fallback if not found
                    const colors = RISK_COLORS[item.label] || FALLBACK_COLORS;

                    return (
                        <div key={item.label} className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-gray-700 w-20 sm:w-24 flex-shrink-0">
                {item.label}
              </span>
                            <div className="flex-1 h-4 sm:h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${colors.bg} rounded-full transition-all duration-500`}
                                    style={{ width: `${item.percentage}%` }}
                                />
                            </div>
                            <span
                                className={`text-xs sm:text-sm font-medium ${colors.text} w-12 sm:w-16 text-right flex-shrink-0`}
                            >
                {item.count} ({item.percentage}%)
              </span>
                        </div>
                    );
                })}
            </div>

            {setRiskHeatMap && (
                <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            setRiskHeatMap(false);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs sm:text-sm font-medium"
                    >
                        View risk heatmap →
                    </a>
                </div>
            )}
        </div>
    );
};

export default RiskDistribution;
