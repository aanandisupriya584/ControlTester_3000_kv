import React, { useState, useMemo, useRef, useEffect } from 'react';

// ------------------------------
// 1. Type definitions
// ------------------------------
export interface Assessment {
    id: string;
    name: string;
    application: string;
    status: 'Draft' | 'In Progress' | 'Review' | 'Completed';
    riskScore: 'Low' | 'Medium' | 'High';
    lastUpdated: string;
    owner: string;
}

interface AssessmentsCardProps {
    assessments: Assessment[];
    title: string;
    // Optional callbacks for actions
    onEdit?: (id: string) => void;
    onView?: (id: string) => void;
    onDelete?: (id: string) => void;
}


// ------------------------------
// 2. Badge style helpers
// ------------------------------
const statusStyles: Record<Assessment['status'], string> = {
    Draft: 'bg-gray-100 text-gray-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    Review: 'bg-yellow-100 text-yellow-700',
    Completed: 'bg-green-100 text-green-700',
};

const riskStyles: Record<Assessment['riskScore'], string> = {
    Low: 'bg-green-100 text-green-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    High: 'bg-red-100 text-red-700',
};

// ------------------------------
// 3. Main component
// ------------------------------
const RecentRiskTable: React.FC<AssessmentsCardProps> = ({
                                                             assessments,
                                                             onEdit,
                                                             onView,
                                                             onDelete,
                                                             title
                                                         }) => {
    // Filter tab state
    const [filter, setFilter] = useState<'All' | 'Active' | 'Drafts' | 'Completed'>('All');
    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    // Advanced filter dropdown
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<Set<Assessment['status']>>(new Set());
    const [selectedRiskScores, setSelectedRiskScores] = useState<Set<Assessment['riskScore']>>(new Set());

    // Action dropdown state (which row is open)
    const [openActionId, setOpenActionId] = useState<string | null>(null);
    const actionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Close action dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openActionId && actionRefs.current[openActionId]) {
                const ref = actionRefs.current[openActionId];
                if (ref && !ref.contains(event.target as Node)) {
                    setOpenActionId(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openActionId]);

    // Compute counts for filter tabs
    const total = assessments.length;
    const activeCount = assessments.filter(a => a.status === 'In Progress' || a.status === 'Review').length;
    const draftsCount = assessments.filter(a => a.status === 'Draft').length;
    const completedCount = assessments.filter(a => a.status === 'Completed').length;

    // Filter logic: tab + search + advanced filters
    const filteredData = useMemo(() => {
        return assessments.filter(item => {
            // 1. Tab filter
            if (filter === 'Active' && !(item.status === 'In Progress' || item.status === 'Review')) return false;
            if (filter === 'Drafts' && item.status !== 'Draft') return false;
            if (filter === 'Completed' && item.status !== 'Completed') return false;

            // 2. Search filter
            if (searchTerm.trim() !== '') {
                const term = searchTerm.toLowerCase().trim();
                if (!item.name.toLowerCase().includes(term) && !item.application.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // 3. Advanced filters (status & risk)
            if (selectedStatuses.size > 0 && !selectedStatuses.has(item.status)) return false;
            if (selectedRiskScores.size > 0 && !selectedRiskScores.has(item.riskScore)) return false;

            return true;
        });
    }, [assessments, filter, searchTerm, selectedStatuses, selectedRiskScores]);

    // Toggle helper for advanced filters
    const toggleStatus = (status: Assessment['status']) => {
        const newSet = new Set(selectedStatuses);
        if (newSet.has(status)) newSet.delete(status);
        else newSet.add(status);
        setSelectedStatuses(newSet);
    };

    const toggleRisk = (risk: Assessment['riskScore']) => {
        const newSet = new Set(selectedRiskScores);
        if (newSet.has(risk)) newSet.delete(risk);
        else newSet.add(risk);
        setSelectedRiskScores(newSet);
    };

    // Action handlers
    const handleAction = (action: string, id: string) => {
        setOpenActionId(null);
        switch (action) {
            case 'edit':
                onEdit?.(id);
                break;
            case 'view':
                onView?.(id);
                break;
            case 'delete':
                onDelete?.(id);
                break;
            default:
                break;
        }
    };

    return (
        <div
            className="w-full h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible"
            style={{
                background: `
          radial-gradient(ellipse 30% 95% at 6% 115%, rgba(114, 19, 234, 0.45) 0%, transparent 68%),
          radial-gradient(ellipse 36% 95% at 92% -22%, rgba(30, 73, 226, 0.45) 0%, transparent 68%)
        `
            }}
        >
            {/* Inner white card with slight transparency */}
            <div className="overflow-visible rounded-xl bg-white/90 backdrop-blur-sm">

                {/* -------- Header with Title + Search + Filter Button -------- */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 gap-3">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{title?title:"Recent Assessments"}</h2>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* Search bar with icon */}
                        <div className="relative flex-1 sm:flex-initial sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
                            <input
                                type="text"
                                placeholder="Search assessments..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Filter button with dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                aria-label="Filter"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                            </button>

                            {showFilterDropdown && (
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-20">
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h4>
                                            <div className="space-y-1">
                                                {['Draft', 'In Progress', 'Review', 'Completed'].map((status) => (
                                                    <label key={status} className="flex items-center gap-2 text-sm text-gray-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStatuses.has(status as Assessment['status'])}
                                                            onChange={() => toggleStatus(status as Assessment['status'])}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        {status}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Risk Score</h4>
                                            <div className="space-y-1">
                                                {['Low', 'Medium', 'High'].map((risk) => (
                                                    <label key={risk} className="flex items-center gap-2 text-sm text-gray-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedRiskScores.has(risk as Assessment['riskScore'])}
                                                            onChange={() => toggleRisk(risk as Assessment['riskScore'])}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        {risk}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedStatuses(new Set());
                                                setSelectedRiskScores(new Set());
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            Clear all filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* -------- Filter tabs -------- */}
                <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 border-b border-gray-200 bg-gray-50/40">
                    <button
                        onClick={() => setFilter('All')}
                        className={`text-sm font-medium ${filter === 'All' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'} pb-1 transition`}
                    >
                        All ({total})
                    </button>
                    <button
                        onClick={() => setFilter('Active')}
                        className={`text-sm font-medium ${filter === 'Active' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'} pb-1 transition`}
                    >
                        Active ({activeCount})
                    </button>
                    <button
                        onClick={() => setFilter('Drafts')}
                        className={`text-sm font-medium ${filter === 'Drafts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'} pb-1 transition`}
                    >
                        Drafts ({draftsCount})
                    </button>
                    <button
                        onClick={() => setFilter('Completed')}
                        className={`text-sm font-medium ${filter === 'Completed' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-900'} pb-1 transition`}
                    >
                        Completed ({completedCount})
                    </button>
                </div>

                {/* -------- Table -------- */}
                <div className="overflow-x-auto md:overflow-visible">
                    <table className="w-full text-sm text-left text-gray-700">
                        <thead className="text-xs text-white uppercase bg-[#7213EA] border-b border-gray-200">
                        <tr>
                            <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Assessment Name</th>
                            <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Application / Asset</th>
                            <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Status</th>
                            <th scope="col" className="px-4 sm:px-6 py-3 font-medium">Risk Score</th>
                            <th scope="col" className="px-4 sm:px-6 py-3 font-medium hidden md:table-cell">Last Updated</th>
                            <th scope="col" className="px-4 sm:px-6 py-3 font-medium hidden md:table-cell">Owner</th>
                            <th scope="col" className="px-4 sm:px-6 py-3 font-medium text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-gray-400">No assessments match your filters.</td>
                            </tr>
                        ) : (
                            filteredData.map((item) => (
                                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition">
                                    <td className="px-4 sm:px-6 py-3 font-medium text-gray-900">{item.name}</td>
                                    <td className="px-4 sm:px-6 py-3">{item.application}</td>
                                    <td className="px-4 sm:px-6 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[item.status]}`}>
                        {item.status}
                      </span>
                                    </td>
                                    <td className="px-4 sm:px-6 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${riskStyles[item.riskScore]}`}>
                        {item.riskScore}
                      </span>
                                    </td>
                                    <td className="px-4 sm:px-6 py-3 hidden md:table-cell">{item.lastUpdated}</td>
                                    <td className="px-4 sm:px-6 py-3 hidden md:table-cell">{item.owner}</td>
                                    <td className="relative px-4 py-3 text-right sm:px-6">
                                        {/* Action button */}
                                        <button
                                            onClick={() => setOpenActionId(openActionId === item.id ? null : item.id)}
                                            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1"
                                            aria-label="Actions"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                            </svg>
                                        </button>

                                        {/* Action dropdown */}
                                        {openActionId === item.id && (
                                            <div
                                                ref={(el) => (actionRefs.current[item.id] = el)}
                                                className="absolute right-4 top-[calc(100%-4px)] z-[9999] w-48 rounded-lg border border-gray-200 bg-white py-1 text-left shadow-xl sm:right-6"
                                            >
                                                <button
                                                    onClick={() => handleAction('view', item.id)}
                                                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-left"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleAction('edit', item.id)}
                                                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-left"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleAction('delete', item.id)}
                                                    className="block w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-800 text-left"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                {/* -------- Footer link -------- */}
                {title?"":<div className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50/40">
                    <a href="/all-assessments" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                        View all assessments →
                    </a>
                </div>}
            </div>
        </div>
    );
};

export default RecentRiskTable;
