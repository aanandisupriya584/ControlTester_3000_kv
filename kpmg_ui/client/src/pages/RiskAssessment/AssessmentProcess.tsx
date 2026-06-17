import React from 'react';

const AssessmentProcess: React.FC = () => {
    const steps = [
        {
            number: 1,
            title: 'Create Assessment',
            description: 'Define scope and assets',
        },
        {
            number: 2,
            title: 'Answer Questionnaire',
            description: 'Capture risk responses',
        },
        {
            number: 3,
            title: 'Review Output',
            description: 'Validate findings & score',
        },
        {
            number: 4,
            title: 'Generate Report',
            description: 'Publish and share report',
        },
    ];

    return (
        <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Assessment Process</h2>

            {/* Steps container - responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {steps.map((step) => (
                    <div
                        key={step.number}
                        className="flex flex-col items-center text-center p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:shadow-md transition-shadow"
                    >
                        {/* Circle with step number */}
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-semibold mb-3">
                            {step.number}
                        </div>
                        <h3 className="font-semibold text-gray-800 text-lg">{step.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                    </div>
                ))}
            </div>

            {/* View all assessments button */}
            <div className="text-center md:text-right">
                <button className="inline-flex items-center px-5 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                    View all assessments
                    <svg
                        className="ml-2 -mr-1 w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default AssessmentProcess;