// src/utils/assessmentMapper.ts
import type { RiskAssessment as ApiAssessment } from "@/contexts/RiskAssessmentContext";
import type { Assessment as TableAssessment } from "@/pages/RiskAssessment/RecentRiskTable";

// Map API status to table status
const mapStatus = (apiStatus: string): TableAssessment['status'] => {
    switch (apiStatus) {
        case 'draft': return 'Draft';
        case 'in_progress': return 'In Progress';
        case 'risks_identified': return 'Review';
        case 'controls_applied': return 'Review';
        case 'complete': return 'Completed';
        default: return 'Draft';
    }
};

// Determine overall risk score from risks array
const mapRiskScore = (risks: ApiAssessment['risks']): TableAssessment['riskScore'] => {
    if (!risks || risks.length === 0) return 'Low';
    const bands = risks.map(r => r.inherent_risk_band);
    if (bands.some(b => b === 'Critical' || b === 'High')) return 'High';
    if (bands.some(b => b === 'Medium')) return 'Medium';
    return 'Low';
};

// Main transformer
export const transformAssessments = (
    apiAssessments: ApiAssessment[],
    assetNameMap: Record<string, string> // { assetId: assetName }
): TableAssessment[] => {
    return apiAssessments.map(assessment => {
        const firstAssetId = assessment.asset_ids?.[0];
        const application = firstAssetId ? assetNameMap[firstAssetId] || firstAssetId : 'No Asset';

        return {
            id: assessment.id,
            name: assessment.title,
            application,
            status: mapStatus(assessment.status),
            riskScore: mapRiskScore(assessment.risks),
            lastUpdated: assessment.updated_at
                ? new Date(assessment.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Recently updated',
            owner: '—', // or derive from created_by if available
        };
    });
};
