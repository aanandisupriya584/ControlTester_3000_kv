import React from "react";

// Type definition for each activity item
interface ActivityItem {
    id: string | number;
    title: string;
    subtitle: string;
    timestamp: string;
    status?: "draft" | "completed" | "high-risk" | "imported"; // optional for styling
}

const RecentActivity: React.FC = () => {
    const activities: ActivityItem[] = [
        {
            id: 1,
            title: "Payment Gateway Assessment",
            subtitle: "Draft updated",
            timestamp: "10:24 AM",
            status: "draft",
        },
        {
            id: 2,
            title: "HRMS Risk Review",
            subtitle: "Assessment completed",
            timestamp: "Yesterday",
            status: "completed",
        },
        {
            id: 3,
            title: "Vendor Portal Assessment",
            subtitle: "High risk identified",
            timestamp: "Yesterday",
            status: "high-risk",
        },
        {
            id: 4,
            title: "Asset Registry Imported",
            subtitle: "52 assets added",
            timestamp: "May 12, 2026",
            status: "imported",
        },
    ];

    // Helper to get colour for status dot (optional)
    const getStatusColor = (status?: string): string => {
        switch (status) {
            case "draft":
                return "#f59e0b"; // amber
            case "completed":
                return "#10b981"; // green
            case "high-risk":
                return "#ef4444"; // red
            case "imported":
                return "#3b82f6"; // blue
            default:
                return "#9ca3af"; // grey
        }
    };

    return (
        <div style={styles.card}>
            {/* Header */}
            <div style={styles.header}>
                <h3 style={styles.title}>Recent Activity</h3>
                <a href="#" style={styles.viewAllLink}>
                    View all →
                </a>
            </div>

            {/* Activity list */}
            <ul style={styles.list}>
                {activities.map((item) => (
                    <li key={item.id} style={styles.listItem}>
                        {/* Optional status indicator dot */}
                        <span
                            style={{
                                ...styles.dot,
                                backgroundColor: getStatusColor(item.status),
                            }}
                        />
                        <div style={styles.content}>
                            <div style={styles.itemTitle}>{item.title}</div>
                            <div style={styles.itemSubtitle}>{item.subtitle}</div>
                        </div>
                        <div style={styles.timestamp}>{item.timestamp}</div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// Inline styles (you can move to a .css or .module.css if preferred)
const styles: { [key: string]: React.CSSProperties } = {
    card: {
        width: "100%",
        height:"380px",
        // maxWidth: "600px",
        // margin: "30px auto",
        marginTop:"1.2rem",
        padding: "24px 28px",
        background: "#ffffff",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
    },
    title: {
        fontSize: "20px",
        fontWeight: "600",
        color: "#1a1a2e",
        margin: 0,
    },
    viewAllLink: {
        color: "#4f46e5",
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: "500",
        transition: "color 0.2s",
    },
    list: {
        listStyle: "none",
        padding: 0,
        margin: 0,
    },
    listItem: {
        display: "flex",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #f3f4f6",
        gap: "12px",
    },
    dot: {
        flexShrink: 0,
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        // backgroundColor is set dynamically
    },
    content: {
        flex: 1,
        minWidth: 0, // prevent overflow
    },
    itemTitle: {
        fontSize: "15px",
        fontWeight: "500",
        color: "#1a1a2e",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    itemSubtitle: {
        fontSize: "13px",
        color: "#6b7280",
        marginTop: "2px",
    },
    timestamp: {
        fontSize: "13px",
        color: "#9ca3af",
        flexShrink: 0,
        marginLeft: "12px",
    },
};

// Add hover effect for the link via a style tag (optional)
const styleTag = document.createElement("style");
styleTag.textContent = `
  .view-all-link:hover {
    color: #4338ca;
    text-decoration: underline;
  }
`;
document.head.appendChild(styleTag);

export default RecentActivity;
