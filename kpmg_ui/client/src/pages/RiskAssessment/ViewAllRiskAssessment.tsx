import React, {useMemo} from "react";
import { useLocation } from "wouter";
import RecentRiskTable, { Assessment } from "./RecentRiskTable"; // adjust import path
import HeroSubSection from "@/components/HeroSubSection.tsx";
import {AssessmentTableRow, mapAssessmentsToTableData} from "@/pages/RiskAssessment/helper/HelperFn.tsx";
import {useRiskAssessment} from "@/contexts/RiskAssessmentContext.tsx";

// Sample data (you can replace with API data)
const sampleData: Assessment[] = [
    {
        id: "1",
        name: "HRMS Risk Assessment",
        application: "HRMS Application",
        status: "Draft",
        riskScore: "Medium",
        lastUpdated: "May 14, 2026",
        owner: "Anita Sharma",
    },
    {
        id: "2",
        name: "Payment Gateway Assessment",
        application: "Payment Gateway",
        status: "In Progress",
        riskScore: "High",
        lastUpdated: "May 14, 2026",
        owner: "Anita Sharma",
    },
    {
        id: "3",
        name: "Vendor Portal Assessment",
        application: "Vendor Portal",
        status: "Review",
        riskScore: "Medium",
        lastUpdated: "May 13, 2026",
        owner: "Rahul Verma",
    },
    {
        id: "4",
        name: "Finance Application Review",
        application: "Finance Application",
        status: "Completed",
        riskScore: "Low",
        lastUpdated: "May 10, 2026",
        owner: "Anita Sharma",
    },
];



const ViewAllAssessmentsPage: React.FC = () => {
    const [, setLocation] = useLocation();
    const {
        assessments,
        // selectedAssessment,
        // sections,
        // residualResults,
        // isLoading,
        // isAnalyzing,
        // isGeneratingReport,
        // error,
        // report,
        // fetchAssessments,
        // selectAssessment,
        // createAssessment,
        // fetchSections,
        // submitResponseBatch,
        // analyzeAssessment,
        // applyControl,
        // fetchResidual,
        // suggestControls,
        // generateReport,
        // deleteAssessment,
    } = useRiskAssessment();
    const tableData = useMemo<AssessmentTableRow[]>(
        () => mapAssessmentsToTableData(assessments),
        [assessments]
    );
    // Action handlers (optional – you can replace with your own logic)
    const handleView = (id: string) => {
        setLocation(`/risk-assessment/${encodeURIComponent(id)}`);
    };
    const handleEdit = (id: string) => {
        console.log("Edit assessment", id);
    };
    const handleDelete = (id: string) => {
        console.log("Delete assessment", id);
    };

    return (
        <div className="relative h-full overflow-auto bg-[#F0F2F7]">
            {/* Hero section with title and back button */}
            <HeroSubSection
                title="All Risk Assessments"
                subtitle="Review all assessments across the organization – search, filter, and take action."
            />

            <div className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
                {/* The table component takes full width */}

                <div className={'mb-4'}>
                    <a
                        href={"/risk-assessment"}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline text-sm font-medium "
                    >
                        ← Back
                    </a>
                </div>
                <RecentRiskTable
                    title={"All Assessments"}
                    assessments={tableData}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>
        </div>
    );
};

export default ViewAllAssessmentsPage;
