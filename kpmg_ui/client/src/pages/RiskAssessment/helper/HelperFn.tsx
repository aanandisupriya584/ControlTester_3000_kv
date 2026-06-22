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


// HeatMap

// types/riskHeatmap.ts (or inline)
export interface HeatmapCell {
    count: number;
    riskClass: string;
}

/**
 * Processes an array of assessment objects (as returned by the API)
 * and returns a 5x5 matrix for the RiskHeatmap component.
 *
 * The matrix rows correspond to Likelihood (index 0 = Rare, 4 = Almost Certain)
 * and columns correspond to Impact (index 0 = Insignificant, 4 = Severe).
 *
 * Each cell contains:
 *   - count: number of risks with that likelihood/impact combination
 *   - riskClass: the highest risk band among risks in that cell
 *                (mapped to "Low", "Medium", "High", "Very High")
 */
export function processRiskHeatmapData(assessments: any[]): HeatmapCell[][] {
    // 1. Initialize a 5x5 matrix with empty data
    const matrix: {
        count: number;
        bands: Set<string>;
    }[][] = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => ({
            count: 0,
            bands: new Set<string>(),
        }))
    );

    // 2. Mapping from inherent_risk_band to the class used in the heatmap
    const bandToClass: Record<string, string> = {
        'Very High': 'Very High',
        High: 'High',
        Medium: 'Medium',
        Low: 'Low',
        'Very Low': 'Low', // treat Very Low as Low
        // Add any other bands you might receive
    };

    // 3. Severity order for selecting the highest band per cell
    const severityOrder = ['Very High', 'High', 'Medium', 'Low'];

    // 4. Iterate over all assessments and their risks
    assessments.forEach((assessment) => {
        const risks = assessment?.risks || [];
        risks.forEach((risk: any) => {
            const likelihood = risk.likelihood_score ?? 1;
            const impact = risk.impact_score ?? 1;
            // Clamp to 1–5 range (just in case)
            const lIndex = Math.min(Math.max(likelihood - 1, 0), 4);
            const iIndex = Math.min(Math.max(impact - 1, 0), 4);

            const cell = matrix[lIndex][iIndex];
            cell.count += 1;

            const band = risk.inherent_risk_band || 'Low';
            const cls = bandToClass[band] || 'Low';
            cell.bands.add(cls);
        });
    });

    // 5. Build the final HeatmapCell matrix
    const result: HeatmapCell[][] = matrix.map((row) =>
        row.map((cell) => {
            // Choose the highest risk class from the set
            let riskClass = 'Low';
            for (const level of severityOrder) {
                if (cell.bands.has(level)) {
                    riskClass = level;
                    break;
                }
            }
            return {
                count: cell.count,
                riskClass: riskClass,
            };
        })
    );

    return result;
}


// Risk Report
// utils/riskReportUtils.ts

// Reuse the Risk type from your component – or define it here
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

export interface RiskReportData {
    risks: Risk[];
    draftsCount: number;
    highRisksCount: number;
    totalAssessmentsCount: number; // actually total risks, but kept as prop name for compatibility
}

/**
 * Process an array of assessments (from the API) into data for the RiskReport component.
 */
export function processRiskReportData(assessments: any[]): RiskReportData {
    const allRisks: Risk[] = [];
    let draftsCount = 0;
    let highRisksCount = 0;

    // Score to label mapping
    const scoreToLabel: Record<number, Risk['likelihood']> = {
        1: "Very Low",
        2: "Low",
        3: "Medium",
        4: "High",
        5: "Very High",
    };

    // Band to riskClass (ensure it's one of the allowed values)
    const bandToRiskClass: Record<string, Risk['riskClass']> = {
        "Very High": "Very High",
        "High": "High",
        "Medium": "Medium",
        "Low": "Low",
        // if you have "Very Low", treat as "Low"
        "Very Low": "Low",
    };

    // Status mapping (API status -> component status)
    const statusMap: Record<string, Risk['status']> = {
        "identified": "Open",
        // add others if needed, e.g., "mitigated" -> "Mitigated"
        "mitigated": "Mitigated",
        "closed": "Closed",
        "in_progress": "In Progress",
    };

    assessments.forEach((assessment) => {
        // Count drafts
        if (assessment.status?.toLowerCase() === "draft") {
            draftsCount++;
        }

        const risks = assessment?.risks || [];
        risks.forEach((risk: any) => {
            // Convert likelihood & impact scores
            const likelihoodScore = risk.likelihood_score ?? 1;
            const impactScore = risk.impact_score ?? 1;
            const likelihoodLabel = scoreToLabel[likelihoodScore] || "Medium";
            const impactLabel = scoreToLabel[impactScore] || "Medium";

            // Map risk band to riskClass
            const band = risk.inherent_risk_band || "Low";
            const riskClass = bandToRiskClass[band] || "Low";

            // Count high risks (band === "High")
            if (band === "High") {
                highRisksCount++;
            }

            // Build the Risk object
            allRisks.push({
                id: risk.id || `risk-${Math.random()}`,
                name: risk.title || "Unnamed Risk",
                description: risk.description || undefined,
                likelihood: likelihoodLabel,
                impact: impactLabel,
                riskClass: riskClass,
                status: statusMap[risk.status?.toLowerCase()] || "Open",
                dateIdentified: assessment.created_at
                    ? new Date(assessment.created_at).toISOString().slice(0, 10)
                    : new Date().toISOString().slice(0, 10),
                owner: "", // no owner field in API; you can leave empty or assign something else
            });
        });
    });

    // Total risks = allRisks.length
    const totalRisks = allRisks.length;

    return {
        risks: allRisks,
        draftsCount,
        highRisksCount,
        totalAssessmentsCount: totalRisks, // the first summary card shows "Total Risks"
    };
}


