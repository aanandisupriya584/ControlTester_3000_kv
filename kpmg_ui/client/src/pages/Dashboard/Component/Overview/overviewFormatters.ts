export function formatOverviewNumber(value: number) {
  return value.toLocaleString();
}

export function formatOverviewPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function clampOverviewPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function shortenOverviewAxisLabel(value: string, maxChars: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}
