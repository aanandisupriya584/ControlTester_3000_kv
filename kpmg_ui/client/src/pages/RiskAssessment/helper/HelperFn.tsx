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
