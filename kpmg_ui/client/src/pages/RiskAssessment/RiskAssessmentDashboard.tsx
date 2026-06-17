// <StatusCard
//     title="Complaints"
//     value={98}
//     percentChange={8}
//     status="complaint"
// />

import React from 'react';
import StatusCard from "@/components/custom_ui/cards/StatusCard.tsx";
import AssessmentProcess from "@/pages/RiskAssessment/AssessmentProcess.tsx";

// Props type definition (remove if no props needed)
interface RiskAssessmentDashboardProps {
    // Example: title: string;
    // Example: onClick?: () => void;
}

const RiskAssessmentDashboard: React.FC<RiskAssessmentDashboardProps> = ({ /* destructure props here */ }) => {
    // State and logic here

    {/* Your JSX content */}
    return (
        <div className={'h-full overflow-auto bg-[#F0F2F7]'}>
            {/*<div className={'grid grid-cols-3 gap-x-2 gap-y-3'}>*/}
            {/*        <StatusCard*/}
            {/*            title="Complaints"*/}
            {/*            value={98}*/}
            {/*            percentChange={8}*/}
            {/*            status="complaint"*/}
            {/*        />*/}
            {/*        <StatusCard*/}
            {/*            title="Pending Approvals"*/}
            {/*            value={23}*/}
            {/*            percentChange={-12}*/}
            {/*            status="pending"*/}
            {/*        />*/}
            {/*        <StatusCard*/}
            {/*            title="Critical Errors"*/}
            {/*            value={5}*/}
            {/*            percentChange={40}*/}
            {/*            status="danger"*/}
            {/*        />*/}
            {/*        <StatusCard*/}
            {/*            title="System Info"*/}
            {/*            value={1247}*/}
            {/*            percentChange={3.5}*/}
            {/*            status="info"*/}
            {/*            formatValue={(v) => v.toLocaleString()}*/}
            {/*            comparisonText="vs last week"*/}
            {/*        />*/}
            {/*        <StatusCard*/}
            {/*            title="Pending Approvals"*/}
            {/*            value={23}*/}
            {/*            percentChange={-12}*/}
            {/*            status="pending"*/}
            {/*        />*/}
            {/*        <StatusCard*/}
            {/*            title="Critical Errors"*/}
            {/*            value={5}*/}
            {/*            percentChange={40}*/}
            {/*            status="danger"*/}
            {/*        />*/}
            {/*        <StatusCard*/}
            {/*            title="System Info"*/}
            {/*            value={1247}*/}
            {/*            percentChange={3.5}*/}
            {/*            status="info"*/}
            {/*            formatValue={(v) => v.toLocaleString()}*/}
            {/*            comparisonText="vs last week"*/}
            {/*        />*/}


            {/*</div>*/}
            {/*<AssessmentProcess></AssessmentProcess>*/}
        </div>
    );
};

export default RiskAssessmentDashboard;
