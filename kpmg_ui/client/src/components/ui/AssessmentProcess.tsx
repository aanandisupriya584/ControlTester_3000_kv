import React from "react";

interface Step {
    id: number;
    title: string;
    description: string;
}

const AssessmentProcess: React.FC = () => {
    const steps: Step[] = [
        { id: 1, title: "Create Assessment", description: "Define scope and assets" },
        { id: 2, title: "Answer Questionnaire", description: "Capture risk responses" },
        { id: 3, title: "Review Output", description: "Validate findings & score" },
        { id: 4, title: "Generate Report", description: "Publish and share report" },
    ];

    return (
        <>
            <style>
                {`
          .view-all-link {
            color: #4f46e5;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: color 0.2s;
          }
          .view-all-link:hover {
            color: #4338ca;
            text-decoration: underline;
          }
          /* Custom long arrow styles */
          .long-arrow {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 60px;
            height: 2px;
            background: #d1d5db;
            position: relative;
            align-self: center;
            margin: 0 8px;
          }
          .long-arrow::after {
            content: "";
            position: absolute;
            right: -6px;
            top: -5px;
            width: 0;
            height: 0;
            border-left: 8px solid #d1d5db;
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
          }
        `}
            </style>

            <div style={styles.container}>
                <h2 style={styles.heading}>Assessment Process</h2>

                <div style={styles.stepsRow}>
                    {steps.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div style={styles.stepBlock}>
                                <div style={styles.circle}>{step.id}</div>
                                <h3 style={styles.stepTitle}>{step.title}</h3>
                                <p style={styles.stepDescription}>{step.description}</p>
                            </div>
                            {index < steps.length - 1 && <div className="long-arrow" />}
                        </React.Fragment>
                    ))}
                </div>

                <div style={styles.footer}>
                    <a href="#" className="view-all-link">
                        View all assessments →
                    </a>
                </div>
            </div>
        </>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        width: "100%",                 // Full width
        padding: "32px 48px",          // Comfortable side padding
        boxSizing: "border-box",
        background: "#ffffff",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)", // Optional card effect
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    heading: {
        fontSize: "2rem",
        // fontWeight: "600",
        color: "#1a1a2e",
        marginBottom: "32px",
        marginTop: "0",
    },
    stepsRow: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "0",
        flexWrap: "wrap",
        width: "100%",
    },
    stepBlock: {
        flex: "1 1 180px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        minWidth: "140px",
    },
    circle: {
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        background: "#eef2ff",
        color: "#4f46e5",
        border: "2px solid #4f46e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "600",
        fontSize: "20px",
        marginBottom: "16px",
        flexShrink: 0,
    },
    stepTitle: {
        fontSize: "18px",
        fontWeight: "500",
        color: "#1a1a2e",
        margin: "0 0 6px 0",
    },
    stepDescription: {
        fontSize: "15px",
        color: "#6b7280",
        margin: "0",
        lineHeight: "1.5",
    },
    footer: {
        marginTop: "40px",
        borderTop: "1px solid #e5e7eb",
        paddingTop: "20px",
        textAlign: "right",
    },
};

export default AssessmentProcess;
