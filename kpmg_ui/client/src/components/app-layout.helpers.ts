import {
  AlertTriangle,
  BookOpen,
  Database,
  FileBarChart,
  FileSearch,
  LayoutDashboard,
  Library,
  MessageSquare,
  Scale,
  ShieldCheck,
  TestTube,
  type LucideIcon,
} from "lucide-react";

export type AppNavigationTab = {
  title?: string | null;
  fullTitle?: string | null;
  path?: string | null;
  icon: LucideIcon;
};

export const APP_LAYOUT_CONTENT_CLASSNAME = "flex-1 flex flex-col min-w-0 min-h-0";
export const APP_LAYOUT_MAIN_CLASSNAME = "flex-1 min-h-0 overflow-hidden";
export const ACTIVE_PAGE_CLASSNAME = "h-full min-h-0 overflow-hidden";
export const HIDDEN_PAGE_CLASSNAME = "hidden";

export const HIDEABLE_TABS: AppNavigationTab[] = [
  { title: "Dashboard", fullTitle: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Regulatory Library", fullTitle: "Regulatory Library", path: "/regulatory-library", icon: Library },
  { title: "Controls Library", fullTitle: "Controls Library", path: "/controls-library", icon: ShieldCheck },
  { title: "Frameworks Library", fullTitle: "Frameworks Library", path: "/frameworks-library", icon: BookOpen },
  { title: "Regulatory Testing", fullTitle: "Regulatory Testing", path: "/regulatory-testing", icon: Scale },
  { title: "Reports", fullTitle: "Reports", path: "/reports", icon: FileBarChart },
  { title: "Asset Registry", fullTitle: "Asset Registry", path: "/asset-registry", icon: Database },
  { title: "Risk Assessment", fullTitle: "Risk Assessment", path: "/risk-assessment", icon: FileSearch },
  { title: "Final Report", fullTitle: "Final Report", path: "/evidence-assessment", icon: FileSearch },
  { title: "Control Testing", fullTitle: "Control Testing", path: "/control-testing", icon: TestTube },
  { title: "Chat", fullTitle: "AI Chat", path: "/chat", icon: MessageSquare },
  { title: "Issue Management", fullTitle: "Issue Management", path: "/issue-management", icon: AlertTriangle },
];

const ROUTE_CONTEXTS: Record<string, { title: string; workspacePath?: string }> = {
  "/risk-report": { title: "Risk Assessment / Risk Report", workspacePath: "/risk-assessment" },
  "/all-assessments": { title: "Risk Assessment / All Assessments", workspacePath: "/risk-assessment" },
  "/controls-assurance/new": { title: "Controls Assurance / New Assessment", workspacePath: "/controls-assurance" },
};

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeAppPath(value: unknown): string {
  const path = nonEmpty(value)?.split(/[?#]/, 1)[0]?.replace(/\/+$/, "");
  if (!path || path === "") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function humanizeRouteSegment(segment: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment).trim();
  } catch {
    decoded = segment.trim();
  }
  if (!decoded || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(decoded)) {
    return undefined;
  }

  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function resolveAppNavigation(
  location: unknown,
  tabs: readonly AppNavigationTab[] = HIDEABLE_TABS,
): { title?: string; workspacePath?: string } {
  const currentPath = normalizeAppPath(location);
  const validTabs = tabs
    .map((tab) => ({ ...tab, normalizedPath: nonEmpty(tab.path) ? normalizeAppPath(tab.path) : undefined }))
    .filter((tab) => tab.normalizedPath);

  const workspace = validTabs
    .filter((tab) =>
      tab.normalizedPath === "/"
        ? currentPath === "/"
        : currentPath === tab.normalizedPath || currentPath.startsWith(`${tab.normalizedPath}/`),
    )
    .sort((left, right) => right.normalizedPath!.length - left.normalizedPath!.length)[0];

  const explicitContext = ROUTE_CONTEXTS[currentPath];
  if (explicitContext) {
    return explicitContext;
  }

  const workspaceTitle = nonEmpty(workspace?.fullTitle) ?? nonEmpty(workspace?.title);
  if (workspaceTitle) {
    if (currentPath === workspace?.normalizedPath) {
      return { title: workspaceTitle, workspacePath: workspace.normalizedPath };
    }

    const leafTitle = humanizeRouteSegment(currentPath.split("/").filter(Boolean).at(-1) ?? "");
    return {
      title: leafTitle && leafTitle !== workspaceTitle ? `${workspaceTitle} / ${leafTitle}` : workspaceTitle,
      workspacePath: workspace.normalizedPath,
    };
  }

  const fallbackTitle = humanizeRouteSegment(currentPath.split("/").filter(Boolean).at(-1) ?? "");
  return { title: fallbackTitle, workspacePath: workspace?.normalizedPath };
}
