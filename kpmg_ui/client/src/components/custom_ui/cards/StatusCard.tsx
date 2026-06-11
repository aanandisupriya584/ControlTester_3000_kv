import React from 'react';
import {
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Clock,
    AlertTriangle,
    Info,
    LucideIcon,
    ClipboardList
} from 'lucide-react';

// Define the possible status types
type StatusType = 'complaint' | 'pending' | 'danger' | 'info';

// Configuration for each status type
interface StatusConfig {
    icon: LucideIcon;
    bgGradient: string;
    borderColor: string;
    textColor: string;
    percentageBg: string;
    progressColor: string;
    accentBg: string;
}

const statusConfigs: Record<StatusType, StatusConfig> = {
    complaint: {
        icon: ClipboardList,//AlertCircle,
        bgGradient: '#1E49E2',//'from-red-50 to-orange-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-700',
        percentageBg: 'bg-red-100',
        progressColor: 'bg-red-500',
        accentBg: 'bg-red-50',
    },
    pending: {
        icon: Clock,
        bgGradient: 'from-yellow-50 to-amber-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-700',
        percentageBg: 'bg-yellow-100',
        progressColor: 'bg-yellow-500',
        accentBg: 'bg-yellow-50',
    },
    danger: {
        icon: AlertTriangle,
        bgGradient: 'from-rose-50 to-red-50',
        borderColor: 'border-rose-200',
        textColor: 'text-rose-700',
        percentageBg: 'bg-rose-100',
        progressColor: 'bg-rose-500',
        accentBg: 'bg-rose-50',
    },
    info: {
        icon: Info,
        bgGradient: 'from-blue-50 to-sky-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700',
        percentageBg: 'bg-blue-100',
        progressColor: 'bg-blue-500',
        accentBg: 'bg-blue-50',
    },
};

export interface StatusCardProps {
    /** Title of the metric (e.g., "Complaints", "Pending Tasks") */
    title: string;
    /** Main numeric value */
    value: number;
    /** Percentage change compared to previous period (positive = increase, negative = decrease) */
    percentChange?: number;
    /** The type of status that determines color scheme and icon */
    status: StatusType;
    /** Optional text to replace "vs last month" */
    comparisonText?: string;
    /** Optional className for additional styling */
    className?: string;
    /** Optional icon override (if not provided, uses default for status type) */
    customIcon?: LucideIcon;
    /** Optional formatter for the value (e.g., currency, compact notation) */
    formatValue?: (value: number) => string;
}

/**
 * Dynamic Status Card - A flexible card component for displaying KPIs with
 * different status themes (complaint, pending, danger, info).
 *
 * @example
 * // Complaint card
 * <StatusCard title="Complaints" value={98} percentChange={8} status="complaint" />
 *
 * @example
 * // Pending tasks
 * <StatusCard title="Pending" value={23} percentChange={-12} status="pending" />
 *
 * @example
 * // Danger (critical issues)
 * <StatusCard title="Critical Failures" value={5} percentChange={40} status="danger" />
 *
 * @example
 * // Info (system messages)
 * <StatusCard title="Active Users" value={1247} percentChange={3.5} status="info" formatValue={(v) => v.toLocaleString()} />
 */
const StatusCard: React.FC<StatusCardProps> = ({
                                                   title,
                                                   value,
                                                   percentChange,
                                                   status,
                                                   comparisonText = 'vs last month',
                                                   className = '',
                                                   customIcon,
                                                   formatValue = (val) => val.toLocaleString(),
                                               }) => {
    const config = statusConfigs[status];
    const Icon = customIcon || config.icon;

    const isPositiveChange = percentChange !== undefined && percentChange > 0;
    const isNegativeChange = percentChange !== undefined && percentChange < 0;
    const hasChange = percentChange !== undefined && percentChange !== 0;

    const formattedPercent =
        percentChange !== undefined
            ? `${isPositiveChange ? '+' : ''}${percentChange}%`
            : null;

    const changeColor =
        status === 'complaint' || status === 'danger'
            ? isPositiveChange
                ? 'text-red-600'
                : isNegativeChange
                    ? 'text-green-600'
                    : 'text-gray-500'
            : status === 'pending'
                ? isPositiveChange
                    ? 'text-yellow-600'
                    : isNegativeChange
                        ? 'text-green-600'
                        : 'text-gray-500'
                : // info status - positive is good (blue), negative is bad
                isPositiveChange
                    ? 'text-green-600'
                    : isNegativeChange
                        ? 'text-blue-600'
                        : 'text-gray-500';

    const TrendIcon = hasChange
        ? isPositiveChange
            ? TrendingUp
            : TrendingDown
        : null;

    // Progress bar width capped at 100% and absolute value
    const progressWidth =
        percentChange !== undefined ? Math.min(Math.abs(percentChange), 100) : 0;

    const formattedValue = formatValue(value);

    return (
        <div
            className={`relative overflow-hidden rounded-2xl bg-white p-6 shadow-md
        transition-all duration-200 hover:shadow-lg
        border ${config.borderColor}
        bg-gradient-to-br [${config.bgGradient}]
        ${className}
      `}
    role="article"
    aria-label={`${title} status card: ${formattedValue}`}
>
    {/* Decorative floating circle */}
    <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full ${config.accentBg} opacity-60`}
    />

    {/* Header with title and icon */}
    <div className="relative flex items-center justify-between">
    <h3
        className={`text-sm font-semibold uppercase tracking-wide ${config.textColor}`}
>
    {title}
    </h3>
    <Icon className={`h-5 w-5 ${config.textColor}`} aria-hidden="true" />
        </div>

    {/* Main value */}
    <div className="relative mt-2">
    <p className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
        {formattedValue}
        </p>
        </div>

    {/* Change indicator */}
    {hasChange && (
        <div className="relative mt-3 flex items-center space-x-1">
        {TrendIcon && <TrendIcon className={`h-4 w-4 ${changeColor}`} />}
    <span className={`text-sm font-medium ${changeColor}`}>
        {formattedPercent}
        </span>
        <span className="text-sm text-gray-500">{comparisonText}</span>
        </div>
    )}

        {/* Progress bar (visualizing magnitude of change) */}
        {hasChange && (
            <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${config.progressColor}`}
            style={{ width: `${progressWidth}%` }}
            aria-hidden="true"
                />
                </div>
        )}

        {/* Screen reader announcement for changes */}
        {hasChange && (
            <div className="sr-only" role="status">
            {`${title}: ${formattedValue}. ${
                isPositiveChange ? 'Increased' : 'Decreased'
            } by ${Math.abs(percentChange!)}% compared to last month.`}
            </div>
        )}
        </div>
    );
    };

    export default StatusCard;
