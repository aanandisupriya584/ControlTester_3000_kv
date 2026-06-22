import React from "react";

interface RiskItem {
    label: string;
    count: number;
    percentage: number;
    barColor: string; // Tailwind background colour class
    textColor: string; // Tailwind text colour class for percentage
}
interface RiskDistributionProps {
    setRiskHeatMap: (value: boolean) => void;   // <-- add this
}

interface RiskDistributionProps {
    riskItems: RiskItem[];          // processed data
    totalAssessments: number;       // total number of assessments
    setRiskHeatMap: (value: boolean) => void;
}
const RiskDistribution: React.FC<RiskDistributionProps> = ({riskItems, totalAssessments,setRiskHeatMap }) => {
    // const risks: RiskItem[] = [
    //     { label: "High Risk", count: 8, percentage: 15, barColor: "bg-red-500", textColor: "text-red-600" },
    //     { label: "Medium Risk", count: 18, percentage: 35, barColor: "bg-yellow-500", textColor: "text-yellow-600" },
    //     { label: "Low Risk", count: 20, percentage: 38, barColor: "bg-green-500", textColor: "text-green-600" },
    //     { label: "Very Low Risk", count: 6, percentage: 12, barColor: "bg-blue-500", textColor: "text-blue-600" },
    // ];

    // Find max percentage for bar scaling (if needed)
    const maxPercentage = Math.max(...riskItems.map(r => r.percentage));

    return (
        <div className="w-full bg-white rounded-lg mt-5 shadow-md p-4 sm:p-6 h-[380px]">
            {/* Header */}
            <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-8">
                Risk Distribution
            </h3>

            {/* Total row */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 mb-3 "  >
                <span className="text-sm sm:text-base font-medium text-gray-700">Total</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">52 Assessments</span>
            </div>

            {/* Bar chart */}
            <div className="space-y-3">
                {riskItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 sm:gap-3">
                        {/* Label */}
                        <span className="text-xs sm:text-sm text-gray-700 w-20 sm:w-24 flex-shrink-0">
              {item.label}
            </span>

                        {/* Bar container */}
                        <div className="flex-1 h-4 sm:h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${item.barColor} rounded-full transition-all duration-500`}
                                style={{ width: `${item.percentage}%` }}
                            />
                        </div>

                        {/* Count and percentage */}
                        <span className={`text-xs sm:text-sm font-medium ${item.textColor} w-12 sm:w-16 text-right flex-shrink-0`}>
              {item.count} ({item.percentage}%)
            </span>
                    </div>
                ))}
            </div>

            {/* Footer link */}
            <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
                <a
                    href="#"
                    onClick={(e)=>{setRiskHeatMap(false)}}
                    className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs sm:text-sm font-medium"
                >
                    View risk heatmap →
                </a>
            </div>
        </div>
    );
};

export default RiskDistribution;
