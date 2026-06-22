import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { TDocumentDefinitions } from "pdfmake/interfaces";

// ✅ Load the fonts (this registers Roboto and other default fonts)
// pdfMake.vfs = pdfFonts.pdfMake.vfs;

// Reuse your Risk type (or import it)
export interface Risk {
    id: string | number;
    name: string;
    description?: string;
    likelihood: string;
    impact: string;
    riskClass: string;
    status: string;
    dateIdentified: string;
    owner?: string;
}

/**
 * Generates a PDF report using pdfMake from the given risk data.
 */
export function PdfCodeHelper(
    risks: Risk[],
    totalRisks: number,
    draftsCount: number,
    highRisksCount: number,
    title: string = "Risk Report"
) {
    // Color mapping for risk class badges (tailwind-like colors)
    const classColors: Record<string, string> = {
        Low: "#dcfce7",
        Medium: "#fef9c3",
        High: "#ffedd5",
        "Very High": "#fee2e2",
    };
    const classTextColors: Record<string, string> = {
        Low: "#166534",
        Medium: "#854d0e",
        High: "#9a3412",
        "Very High": "#991b1b",
    };

    // Build table rows: each row is an array of cell definitions
    const riskTableRows = risks.map((risk) => {
        const cls = risk.riskClass;
        const bg = classColors[cls] || "#e5e7eb";
        const textColor = classTextColors[cls] || "#1f2937";

        // Combine name and description with a line break
        const nameWithDesc = risk.description
            ? `${risk.name}\n${risk.description}`
            : risk.name;

        return [
            { text: String(risk.id), alignment: "center", fontSize: 9 },
            { text: nameWithDesc, fontSize: 9 },
            { text: risk.likelihood, alignment: "center", fontSize: 9 },
            { text: risk.impact, alignment: "center", fontSize: 9 },
            {
                text: cls,
                fillColor: bg,
                color: textColor,
                fontSize: 10,
                bold: true,
                alignment: "center",
                margin: [2, 2, 2, 2],
            },
            { text: risk.status, alignment: "center", fontSize: 9 },
            {
                text: new Date(risk.dateIdentified).toLocaleDateString(),
                alignment: "center",
                fontSize: 9,
            },
            { text: risk.owner || "—", alignment: "center", fontSize: 9 },
        ];
    });

    // Document definition
    const docDefinition: TDocumentDefinitions = {
        pageSize: "A4",
        pageMargins: [40, 60, 40, 60],
        header: {
            text: title,
            style: "header",
            alignment: "center",
            margin: [0, 20, 0, 10],
        },
        content: [
            // Generation date
            {
                text: `Generated on ${new Date().toLocaleString()}`,
                alignment: "right",
                fontSize: 9,
                color: "#6b7280",
                margin: [0, 0, 0, 20],
            },

            // Summary cards (simple table with no borders)
            {
                table: {
                    widths: ["*", "*", "*"],
                    body: [
                        [
                            { text: "Total Risks", alignment: "center", fontSize: 10, bold: true, color: "#6d7ea8" },
                            { text: "Drafts", alignment: "center", fontSize: 10, bold: true, color: "#6d7ea8" },
                            { text: "High Risks", alignment: "center", fontSize: 10, bold: true, color: "#6d7ea8" },
                        ],
                        [
                            { text: String(totalRisks), alignment: "center", fontSize: 24, bold: true, color: "#001b3a" },
                            { text: String(draftsCount), alignment: "center", fontSize: 24, bold: true, color: "#001b3a" },
                            { text: String(highRisksCount), alignment: "center", fontSize: 24, bold: true, color: "#001b3a" },
                        ],
                    ],
                },
                layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: () => 10,
                    paddingRight: () => 10,
                    paddingTop: () => 6,
                    paddingBottom: () => 6,
                },
                margin: [0, 0, 0, 20],
            },

            // Risk table
            // {
            //     table: {
            //         widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto", "auto"],
            //         body: [
            //             // Header row
            //             [
            //                 { text: "ID", style: "tableHeader", alignment: "center" },
            //                 { text: "Risk Name", style: "tableHeader" },
            //                 { text: "Likelihood", style: "tableHeader", alignment: "center" },
            //                 { text: "Impact", style: "tableHeader", alignment: "center" },
            //                 { text: "Risk Class", style: "tableHeader", alignment: "center" },
            //                 { text: "Status", style: "tableHeader", alignment: "center" },
            //                 { text: "Date", style: "tableHeader", alignment: "center" },
            //                 { text: "Owner", style: "tableHeader", alignment: "center" },
            //             ],
            //             // ⚠️ The `as any` cast silences TypeScript's complex union type issues
            //             ...riskTableRows,
            //         ] as any,
            //     },
            //     layout: {
            //         fillColor: (rowIndex: number) =>
            //             rowIndex === 0 ? "#7213EA" : rowIndex % 2 === 0 ? "#f9fafb" : undefined,
            //         hLineWidth: (i: number) => (i === 0 ? 1 : 0.5),
            //         vLineWidth: () => 0.5,
            //         hLineColor: () => "#d1d5db",
            //         vLineColor: () => "#d1d5db",
            //         paddingLeft: () => 4,
            //         paddingRight: () => 4,
            //         paddingTop: () => 4,
            //         paddingBottom: () => 4,
            //     },
            // },

            // Footer note
            {
                text: "Confidential – For internal use only",
                alignment: "center",
                fontSize: 8,
                color: "#9ca3af",
                margin: [0, 30, 0, 0],
            },
        ],
        styles: {
            header: {
                fontSize: 22,
                bold: true,
                color: "#1f2937",
            },
            tableHeader: {
                fontSize: 9,
                bold: true,
                color: "white",
                fillColor: "#7213EA",
                alignment: "left",
                margin: [4, 4, 4, 4],
            },
        },
    };

    // Generate and download the PDF
    pdfMake.createPdf(docDefinition).download(`Risk_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
