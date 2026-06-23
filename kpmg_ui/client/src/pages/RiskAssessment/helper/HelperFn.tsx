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
    barColor?: string;   // Tailwind background class
    textColor?: string;  // Tailwind text class for percentage
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
/**
 * Process an array of assessment objects (as returned by the API)
 * and produce data for the RiskDistribution component.
 * Colours are now handled inside the component itself.
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

    // 2. Mapping from band to the label that should appear in the UI.
    //    The labels must match the keys used in RISK_COLORS inside RiskDistribution.
    //    Currently supported: "Low", "Medium", "High", "Very High".
    const bandToLabel: Record<string, string> = {
        High: 'High',
        Medium: 'Medium',
        Low: 'Low',
        'Very High': 'Very High',
        // You can add more bands here if needed, e.g.:
        // 'Very Low': 'Low',  // map to an existing label
    };

    // 3. Build risk items in the order: High → Medium → Low → Very High
    const order = [ 'Very High','High', 'Medium', 'Low'];
    const riskItems: RiskItem[] = [];

    order.forEach((band) => {
        const count = bandCounts[band] || 0;
        const percentage = totalRisks > 0 ? Math.round((count / totalRisks) * 100) : 0;
        const label = bandToLabel[band];

        // Only include if we have a label mapping (otherwise skip or handle separately)
        if (label) {
            riskItems.push({
                label,
                count,
                percentage,
            });
        }
    });

    // Optional: handle any remaining bands that are not in the order
    // (e.g., "Unknown" or "Very Low") – you could add them with a fallback label.
    // For example, you might want to include them as "Other" or map to an existing one.
    // Here we skip them, but you can adjust based on your requirements.

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
 * Processes an array of assessment objects and returns a 5x5 matrix.
 * - Counts risks by (likelihood, impact) position.
 * - Colors are fixed by position (matches the dummy data pattern).
 */
export function processRiskHeatmapData(assessments: any[]): HeatmapCell[][] {
    // 1. Initialize a 5x5 matrix with counts only
    const matrix: number[][] = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => 0)
    );

    // 2. Count risks per cell (ignoring their risk band)
    assessments.forEach((assessment) => {
        const risks = assessment?.risks || [];
        risks.forEach((risk: any) => {
            const likelihood = risk.likelihood_score ?? 1;
            const impact = risk.impact_score ?? 1;
            const lIndex = Math.min(Math.max(likelihood - 1, 0), 4);
            const iIndex = Math.min(Math.max(impact - 1, 0), 4);
            matrix[lIndex][iIndex] += 1;
        });
    });

    // 3. Define the fixed colour pattern (same as dummy data)
    // Rows = Likelihood (0=Rare … 4=Almost Certain)
    // Cols = Impact      (0=Insignificant … 4=Severe)
    const positionRiskClass: string[][] = [
        ["Low", "Low", "Low", "Medium", "Medium"],
        ["Low", "Low", "Medium", "Medium", "High"],
        ["Low", "Medium", "Medium", "High", "High"],
        ["Medium", "Medium", "High", "High", "Very High"],
        ["Medium", "High", "High", "Very High", "Very High"],
    ];

    // 4. Build the final HeatmapCell matrix with fixed colours and counts
    const result: HeatmapCell[][] = matrix.map((row, rowIdx) =>
        row.map((count, colIdx) => ({
            count: count,
            riskClass: positionRiskClass[rowIdx][colIdx],
        }))
    );

    return result;
}
// // types/riskHeatmap.ts (or inline)
// export interface HeatmapCell {
//     count: number;
//     riskClass: string;
// }
//
// /**
//  * Processes an array of assessment objects (as returned by the API)
//  * and returns a 5x5 matrix for the RiskHeatmap component.
//  *
//  * The matrix rows correspond to Likelihood (index 0 = Rare, 4 = Almost Certain)
//  * and columns correspond to Impact (index 0 = Insignificant, 4 = Severe).
//  *
//  * Each cell contains:
//  *   - count: number of risks with that likelihood/impact combination
//  *   - riskClass: the highest risk band among risks in that cell
//  *                (mapped to "Low", "Medium", "High", "Very High")
//  */
// export function processRiskHeatmapData(assessments: any[]): HeatmapCell[][] {
//     // 1. Initialize a 5x5 matrix with empty data
//     const matrix: {
//         count: number;
//         bands: Set<string>;
//     }[][] = Array.from({ length: 5 }, () =>
//         Array.from({ length: 5 }, () => ({
//             count: 0,
//             bands: new Set<string>(),
//         }))
//     );
//
//     // 2. Mapping from inherent_risk_band to the class used in the heatmap
//     const bandToClass: Record<string, string> = {
//         'Very High': 'Very High',
//         High: 'High',
//         Medium: 'Medium',
//         Low: 'Low',
//         'Very Low': 'Low', // treat Very Low as Low
//         // Add any other bands you might receive
//     };
//
//     // 3. Severity order for selecting the highest band per cell
//     const severityOrder = ['Very High', 'High', 'Medium', 'Low'];
//
//     // 4. Iterate over all assessments and their risks
//     assessments.forEach((assessment) => {
//         const risks = assessment?.risks || [];
//         risks.forEach((risk: any) => {
//             const likelihood = risk.likelihood_score ?? 1;
//             const impact = risk.impact_score ?? 1;
//             // Clamp to 1–5 range (just in case)
//             const lIndex = Math.min(Math.max(likelihood - 1, 0), 4);
//             const iIndex = Math.min(Math.max(impact - 1, 0), 4);
//
//             const cell = matrix[lIndex][iIndex];
//             cell.count += 1;
//
//             const band = risk.inherent_risk_band || 'Low';
//             const cls = bandToClass[band] || 'Low';
//             cell.bands.add(cls);
//         });
//     });
//
//     // 5. Build the final HeatmapCell matrix
//     const result: HeatmapCell[][] = matrix.map((row) =>
//         row.map((cell) => {
//             // Choose the highest risk class from the set
//             let riskClass = 'Low';
//             for (const level of severityOrder) {
//                 if (cell.bands.has(level)) {
//                     riskClass = level;
//                     break;
//                 }
//             }
//             return {
//                 count: cell.count,
//                 riskClass: riskClass,
//             };
//         })
//     );
//
//     return result;
// }


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



//Recent Assessment
// utils/activityUtils.ts

export interface ActivityItem {
    id: string | number;
    title: string;
    subtitle: string;
    timestamp: string;
    status?: "draft" | "completed" | "high-risk" | "imported";
}

/**
 * Process assessments into recent activity items, sorted by latest update.
 * Returns at most 4 items.
 */
export function processRecentActivity(assessments: any[]): ActivityItem[] {
    if (!assessments || assessments.length === 0) {
        return [];
    }

    // Map each assessment to an activity
    const activities: ActivityItem[] = assessments.map((assessment) => {
        const id = assessment.id;
        const title = assessment.title || "Untitled Assessment";
        const status = assessment.status?.toLowerCase();
        const updatedAt = assessment.updated_at || assessment.created_at;
        const hasHighRisk = assessment.risks?.some(
            (risk: any) => risk.inherent_risk_band === "High"
        );

        // Determine subtitle and activity status
        let subtitle = "";
        let activityStatus: ActivityItem["status"] = undefined;

        if (status === "complete") {
            subtitle = "Assessment completed";
            activityStatus = "completed";
        } else if (status === "draft") {
            subtitle = "Draft updated";
            activityStatus = "draft";
        } else {
            subtitle = "Assessment updated";
        }

        // If there are high risks, override status to "high-risk" (but only if not already draft/complete?)
        // We can keep it separate; we'll set status to "high-risk" if any high risk exists, regardless of assessment status?
        // In the component, "high-risk" dot is red; we can use that for high-risk items.
        if (hasHighRisk && status !== "complete") {
            // If it's complete, we might still want to show as completed; but we can combine: "Completed with high risks"
            // For simplicity, we will use "high-risk" if any high risks exist, overriding other statuses.
            // But maybe we want to show "Assessment completed" even with high risks? Let's prioritize: if status === "complete", keep completed.
            // Else if high risks exist, show "high-risk".
            // Let's implement: if status === "complete", it's completed; else if high risks, it's high-risk; else draft.
            if (status !== "complete") {
                activityStatus = "high-risk";
                subtitle = "High risk identified";
            } else {
                // For complete assessments with high risks, we can still keep completed, but maybe add note: "High risks found" in subtitle?
                // For now, keep subtitle as "Assessment completed" and status completed.
            }
        }

        // Format timestamp
        const timestamp = formatTimestamp(updatedAt);

        return {
            id,
            title,
            subtitle,
            timestamp,
            status: activityStatus,
        };
    });

    // Sort by updated_at descending (most recent first)
    activities.sort((a, b) => {
        const dateA = new Date(
            assessments.find((ass) => ass.id === a.id)?.updated_at ||
            assessments.find((ass) => ass.id === a.id)?.created_at ||
            0
        );
        const dateB = new Date(
            assessments.find((ass) => ass.id === b.id)?.updated_at ||
            assessments.find((ass) => ass.id === b.id)?.created_at ||
            0
        );
        return dateB.getTime() - dateA.getTime();
    });

    // Return first 4
    return activities.slice(0, 4);
}

/**
 * Format a timestamp to a human-readable string: "10:24 AM", "Yesterday", or "May 12, 2026"
 */
function formatTimestamp(dateString: string): string {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) {
        // Today: show time
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (date >= yesterday) {
        return "Yesterday";
    } else {
        // Show date
        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }
}



//Card Data
// utils/riskStatsUtils.ts

export function processRiskStats(assessments: any[]) {
    if (!assessments || !Array.isArray(assessments) || assessments.length === 0) {
        return {
            activeAssessments: 0,
            highCriticalRisks: 0,
            drafts: 0,
            totalAssessments: 0,
            totalRisks: 0,
            assetCount: 0,
            addedThisWeek: 0,
            addedThisMonth: 0,    // NEW
            avgRiskScore: 0,
            avgRiskLabel: "Low",
            trend: "Stable",
        };
    }

    let totalAssessments = assessments.length;
    let activeAssessments = assessments.filter(
        (a) => a.status !== "draft" && a.status !== "complete"
    ).length;
    let drafts = assessments.filter((a) => a.status === "draft").length;

    let totalRisks = 0;
    let highCriticalRisks = 0;
    let sumRiskScores = 0;

    assessments.forEach((assessment) => {
        const risks = assessment?.risks || [];
        totalRisks += risks.length;
        risks.forEach((risk: any) => {
            const band = risk.inherent_risk_band || "Low";
            if (band === "High" || band === "Very High") highCriticalRisks++;
            const score = risk.inherent_risk_score ?? bandToScore(band);
            sumRiskScores += score;
        });
    });

    const avgScore = totalRisks > 0 ? sumRiskScores / totalRisks : 0;
    let avgLabel = "Low";
    if (avgScore >= 4.5) avgLabel = "Very High";
    else if (avgScore >= 3.5) avgLabel = "High";
    else if (avgScore >= 2.5) avgLabel = "Medium";
    else avgLabel = "Low";

    // Trend based on avgScore vs baseline 3.0
    const baseline = 3.0;
    let trend = "Stable";
    if (avgScore > baseline + 0.5) trend = "Trending up";
    else if (avgScore < baseline - 0.5) trend = "Trending down";

    // Assessments added this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const addedThisWeek = assessments.filter((a) => {
        const created = new Date(a.created_at);
        return created >= oneWeekAgo;
    }).length;

    // --- NEW: Assessments added this month ---
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const addedThisMonth = assessments.filter((a) => {
        const created = new Date(a.created_at);
        return created >= firstDayOfMonth;
    }).length;

    // Unique assets
    const assetIds = new Set<string>();
    assessments.forEach((a) => {
        (a.asset_ids || []).forEach((id: string) => assetIds.add(id));
    });
    const assetCount = assetIds.size;

    return {
        activeAssessments,
        highCriticalRisks,
        drafts,
        totalAssessments,
        totalRisks,
        assetCount,
        addedThisWeek,
        addedThisMonth,          // NEW
        avgRiskScore: avgScore,
        avgRiskLabel: avgLabel,
        trend,
    };
}

function bandToScore(band: string): number {
    const map: Record<string, number> = {
        "Very Low": 1,
        Low: 2,
        Medium: 3,
        High: 4,
        "Very High": 5,
    };
    return map[band] || 2;
}
//

// export function processRiskStats(assessments: any[]) {
//     if (!assessments || !Array.isArray(assessments) || assessments.length === 0) {
//         return {
//             activeAssessments: 0,
//             highCriticalRisks: 0,
//             drafts: 0,
//             totalAssessments: 0,
//             totalRisks: 0,
//             assetCount: 0,
//             addedThisWeek: 0,
//             avgRiskScore: 0,
//             avgRiskLabel: "Low",
//             trend: "Stable",
//         };
//     }
//
//     let totalAssessments = assessments.length;
//     let activeAssessments = assessments.filter(
//         (a) => a.status !== "draft" && a.status !== "complete"
//     ).length;
//     let drafts = assessments.filter((a) => a.status === "draft").length;
//
//     let totalRisks = 0;
//     let highCriticalRisks = 0;
//     let sumRiskScores = 0;
//
//     assessments.forEach((assessment) => {
//         const risks = assessment?.risks || [];
//         totalRisks += risks.length;
//         risks.forEach((risk: any) => {
//             const band = risk.inherent_risk_band || "Low";
//             if (band === "High" || band === "Very High") highCriticalRisks++;
//             const score = risk.inherent_risk_score ?? bandToScore(band);
//             sumRiskScores += score;
//         });
//     });
//
//     const avgScore = totalRisks > 0 ? sumRiskScores / totalRisks : 0;
//     let avgLabel = "Low";
//     if (avgScore >= 4.5) avgLabel = "Very High";
//     else if (avgScore >= 3.5) avgLabel = "High";
//     else if (avgScore >= 2.5) avgLabel = "Medium";
//     else avgLabel = "Low";
//
//     // Compute a simple trend based on average relative to a baseline (3.0)
//     const baseline = 3.0;
//     let trend = "Stable";
//     if (avgScore > baseline + 0.5) trend = "Trending up";
//     else if (avgScore < baseline - 0.5) trend = "Trending down";
//
//     // Assessments added this week
//     const oneWeekAgo = new Date();
//     oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
//     const addedThisWeek = assessments.filter((a) => {
//         const created = new Date(a.created_at);
//         return created >= oneWeekAgo;
//     }).length;
//
//     // Unique assets
//     const assetIds = new Set<string>();
//     assessments.forEach((a) => {
//         (a.asset_ids || []).forEach((id: string) => assetIds.add(id));
//     });
//     const assetCount = assetIds.size;
//
//     return {
//         activeAssessments,
//         highCriticalRisks,
//         drafts,
//         totalAssessments,
//         totalRisks,
//         assetCount,
//         addedThisWeek,
//         avgRiskScore: avgScore,
//         avgRiskLabel: avgLabel,   // "Low", "Medium", "High", "Very High"
//         trend,                    // "Trending up", "Trending down", "Stable"
//     };
// }
//
// function bandToScore(band: string): number {
//     const map: Record<string, number> = {
//         "Very Low": 1,
//         Low: 2,
//         Medium: 3,
//         High: 4,
//         "Very High": 5,
//     };
//     return map[band] || 2;
// }
