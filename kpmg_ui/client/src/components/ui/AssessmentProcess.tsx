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
            background: var(--arrow-color, #d1d5db); /* fallback grey */
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
            border-left: 8px solid var(--arrow-color, #d1d5db);
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
          }
        `}
            </style>

            <div style={styles.container}>
                <div style={{height:'2rem', width:'100%', display:'flex', position:'relative'}}>
                    <div style={styles.heading}>Assessment Process</div>
                    <div style={{position:'absolute', right:0}}>
                        <a href="/all-assessments" className="view-all-link">
                            View all assessments →
                        </a>
                    </div>
                </div>


                <div style={styles.stepsRow}>
                    {steps.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div style={styles.stepBlock}>
                                <div style={{width:'49px', marginTop:'1rem'}}>
                                    {step.id<=2?<div style={styles.circle}>{step.id}</div>:<div style={styles.circle2}>{step.id}</div>}
                                </div>
                                <div style={{width:'150px', marginLeft:'0.5rem'}}>
                                    <span style={styles.stepTitle}>{step.title}</span><br/>
                                    <span style={styles.stepDescription}>{step.description}</span>
                                </div>
                            </div>
                            {index < steps.length - 1 && <div className="long-arrow" style={{
                                // Example: if step.id === 1, use purple, else default grey
                                "--arrow-color": step.id === 1 ? "#7213EA" : "#d1d5db",
                            } as React.CSSProperties}/>}
                        </React.Fragment>
                    ))}
                </div>

                {/*<div style={styles.footer}>*/}
                {/*    <a href="#" className="view-all-link">*/}
                {/*        View all assessments →*/}
                {/*    </a>*/}
                {/*</div>*/}
            </div>
        </>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        width: "100%",                 // Full width
        padding: "10px 48px",          // Comfortable side padding
        boxSizing: "border-box",
        borderRadius: '6px',
        // marginBottom:'1.5rem',
        paddingBottom:'1.2rem',
        background: "#ffffff",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)", // Optional card effect
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    heading: {
        fontSize: "1.1rem",
        fontWeight: "600",
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
        marginTop:'1rem'
    },
    stepBlock: {
        flex: "1 1 180px",
        display: "flex",
        // flexDirection: "column",
        alignItems: "center",
        // textAlign: "center",
        minWidth: "140px",
        maxWidth:"200px"
    },
    circle: {
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        background: "#7213EA",//"#eef2ff",
        color: "#eef2ff",
        border: "2px solid #7213EA",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "600",
        fontSize: "20px",
        marginBottom: "16px",
        flexShrink: 0,
    },
    circle2: {
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        background: "#eef2ff",
        color: "#7213EA",
        border: "2px solid #7213EA",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "600",
        fontSize: "20px",
        marginBottom: "16px",
        flexShrink: 0,
    },
    stepTitle: {
        fontSize: "0.9rem",
        // fontWeight: "500",
        color: "#1a1a2e",
        margin: "0 0 6px 0",
    },
    stepDescription: {
        fontSize: "0.8rem",
        color: "#6b7280",
        margin: "0",
        lineHeight: "1.5",
    },
    footer: {
        marginTop: "40px",
        // borderTop: "1px solid #e5e7eb",
        paddingTop: "20px",
        textAlign: "right",
    },
};

export default AssessmentProcess;
