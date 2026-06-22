// import {useMemo} from "react";
//
// export interface HeatmapCell {
//     count: number;
//     riskClass: string;
// }
// // export const buildHeatMapData = (assessments: any[]): HeatmapCell[][] => {
// //     const matrix: HeatmapCell[][] = Array.from({ length: 5 }, () =>
// //         Array.from({ length: 5 }, () => ({
// //             count: 0,
// //             riskClass: "Low",
// //         }))
// //     );
// //
// //     assessments.forEach((assessment) => {
// //         assessment.risks?.forEach((risk: any) => {
// //             const likelihood = risk.inherent_likelihood;
// //             const impact = risk.inherent_impact;
// //
// //             if (
// //                 likelihood >= 1 &&
// //                 likelihood <= 5 &&
// //                 impact >= 1 &&
// //                 impact <= 5
// //             ) {
// //                 const row = likelihood - 1;
// //                 const col = impact - 1;
// //
// //                 matrix[row][col].count += 1;
// //
// //                 matrix[row][col].riskClass =
// //                     risk.inherent_risk_band || "Low";
// //             }
// //         });
// //     });
// //
// //     return matrix;
// // };
// const getRiskBand = (likelihood: number, impact: number) => {
//     const score = likelihood * impact;
//
//     if (score <= 4) return "Low";
//     if (score <= 9) return "Medium";
//     if (score <= 16) return "High";
//     return "Very High";
// };
//
// export const heatMapData = useMemo(() => {
//     const matrix: HeatmapCell[][] = Array.from(
//         { length: 5 },
//         (_, row) =>
//             Array.from({ length: 5 }, (_, col) => ({
//                 count: 0,
//                 riskClass: getRiskBand(row + 1, col + 1),
//             }))
//     );
//
//     assessments.forEach((assessment) => {
//         assessment.risks?.forEach((risk: any) => {
//             const likelihood = Number(risk.inherent_likelihood);
//             const impact = Number(risk.inherent_impact);
//
//             if (
//                 likelihood >= 1 &&
//                 likelihood <= 5 &&
//                 impact >= 1 &&
//                 impact <= 5
//             ) {
//                 matrix[likelihood - 1][impact - 1].count += 1;
//             }
//         });
//     });
//
//     return matrix;
// }, [assessments]);

export interface HeatmapCell {
    count: number;
    riskClass: string;
}

export interface AssessmentTableRow {
    id: string;
    name: string;
    application: string;
    status: 'Draft' | 'In Progress' | 'Review' | 'Completed';
    riskScore: 'Low' | 'Medium' | 'High';
    lastUpdated: string;
    owner: string;
}
// types/risk.ts (or inline)
export interface RiskItem {
    label: string;
    count: number;
    percentage: number;
    barColor: string;   // Tailwind background class
    textColor: string;  // Tailwind text class for percentage
}

export interface ProcessedRiskData {
    totalAssessments: number; // total number of assessments (not risks)
    riskItems: RiskItem[];
}

const getRiskBand = (
    likelihood: number,
    impact: number
): "Low" | "Medium" | "High" | "Very High" => {
    const score = likelihood * impact;

    if (score <= 4) return "Low";
    if (score <= 9) return "Medium";
    if (score <= 16) return "High";
    return "Very High";
};

export const buildHeatMapData = (assessments: any[]): HeatmapCell[][] => {
    // Build compliance matrix
    const matrix: HeatmapCell[][] = Array.from(
        { length: 5 },
        (_, row) =>
            Array.from({ length: 5 }, (_, col) => ({
                count: 0,
                riskClass: getRiskBand(row + 1, col + 1),
            }))
    );

    console.log("Assessments", assessments);

    assessments.forEach((assessment) => {
        console.log("Assessment", assessment);

        assessment.risks?.forEach((risk: any) => {
            console.log("Risk", risk);
        });
    });
    // assessments.forEach((assessment) => {
    //     assessment.risks?.forEach((risk: any) => {
    //         const likelihood = Number(
    //             risk.inherent_likelihood ??
    //             risk.likelihood ??
    //             risk.inherent_likelihood_score
    //         );
    //
    //         const impact = Number(
    //             risk.inherent_impact ??
    //             risk.impact ??
    //             risk.inherent_impact_score
    //         );
    //
    //         if (
    //             likelihood >= 1 &&
    //             likelihood <= 5 &&
    //             impact >= 1 &&
    //             impact <= 5
    //         ) {
    //             matrix[likelihood - 1][impact - 1].count += 1;
    //         }
    //     });
    // });

    return matrix;
};

export const mapAssessmentsToTableData = (
    assessments: any[]
): AssessmentTableRow[] => {
    return assessments.map((assessment) => {
        const risks = assessment.risks || [];

        const highestRisk =
            risks.length > 0
                ? risks.reduce(
                    (max:any, risk:any) =>
                        risk.inherent_risk_score > max.inherent_risk_score ? risk : max,
                    risks[0]
                )
                : null;

        const riskBand =
            highestRisk?.inherent_risk_band?.toLowerCase() || 'low';

        return {
            id: assessment.id,

            // Assessment Name
            name: assessment.title || 'Untitled Assessment',

            // Number of applications/assets
            application: `${assessment.asset_ids?.length || 0} Application(s)`,

            // Status mapping
            status:
                assessment.status === 'draft'
                    ? 'Draft'
                    : assessment.status === 'complete'
                        ? 'Completed'
                        : assessment.status === 'review'
                            ? 'Review'
                            : 'In Progress',

            // Highest risk found in assessment
            riskScore:
                riskBand === 'high'
                    ? 'High'
                    : riskBand === 'medium'
                        ? 'Medium'
                        : 'Low',

            // Last updated
            lastUpdated: new Date(
                assessment.updated_at
            ).toLocaleDateString(),

            // Owner not available in API
            owner: '-'
        };
    });
};




/**
 * Process an array of assessment objects (as returned by the API)
 * and produce data for the RiskDistribution component.
 */
export function processRiskDistribution(assessments: any[]): ProcessedRiskData {
    // 1. Count risks per inherent_risk_band
    const bandCounts: Record<string, number> = {};
    let totalRisks = 0;

    assessments.forEach((assessment) => {
        const risks = assessment?.risks || [];
        risks.forEach((risk: any) => {
            const band = risk.inherent_risk_band || 'Unknown';
            bandCounts[band] = (bandCounts[band] || 0) + 1;
            totalRisks++;
        });
    });

    // 2. Mapping from band to display label and colors
    const bandMapping: Record<
        string,
        { label: string; barColor: string; textColor: string }
    > = {
        High: {
            label: 'High Risk',
            barColor: 'bg-red-500',
            textColor: 'text-red-600',
        },
        Medium: {
            label: 'Medium Risk',
            barColor: 'bg-yellow-500',
            textColor: 'text-yellow-600',
        },
        Low: {
            label: 'Low Risk',
            barColor: 'bg-green-500',
            textColor: 'text-green-600',
        },
        'Very Low': {
            label: 'Very Low Risk',
            barColor: 'bg-blue-500',
            textColor: 'text-blue-600',
        },
    };

    // 3. Build risk items in the order: High → Medium → Low → Very Low
    const order = ['High', 'Medium', 'Low', 'Very Low'];
    const riskItems: RiskItem[] = [];

    order.forEach((band) => {
        const count = bandCounts[band] || 0;
        const percentage =
            totalRisks > 0 ? Math.round((count / totalRisks) * 100) : 0;
        const mapping = bandMapping[band];
        if (mapping) {
            riskItems.push({
                label: mapping.label,
                count,
                percentage,
                barColor: mapping.barColor,
                textColor: mapping.textColor,
            });
        }
        // If a band is not in the mapping (e.g., 'Critical'), you can handle it separately.
    });

    return {
        totalAssessments: assessments.length,
        riskItems,
    };
}
