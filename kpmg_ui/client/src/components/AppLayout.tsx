import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  FileStack, ShieldOff,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import Footer from "@/components/Footer";
import KPMGImg from '../assets/Picture1.png';
import HeroSection from "@/components/HeroSection.tsx";
import {
  HIDEABLE_TABS as SHARED_HIDEABLE_TABS,
  normalizeAppPath,
  resolveAppNavigation,
  type AppNavigationTab,
} from "@/components/app-layout.helpers";

interface AppLayoutProps {
  children: React.ReactNode;
}

interface TraceTab extends AppNavigationTab {
  badge?: string;
  tooltip?: string;
}

export const HIDEABLE_TABS: TraceTab[] = [
  ...SHARED_HIDEABLE_TABS,
  { title: "Controls Assurance", fullTitle: "Controls Assurance", path: "/controls-assurance", icon: ShieldCheck, badge: "NEW" },
  {
    title: "SOP Uplift",
    fullTitle: "SOP Uplift",
    path: "/sop-uplift",
    icon: FilePenLine,
    tooltip: "SOP Uplift - Superseded by Document Uplift. Migrate when ready.",
  },
  { title: "Document Uplift", fullTitle: "Document Uplift", path: "/document-uplift", icon: FileStack, badge: "NEW" },
];

const COMING_SOON_TABS: TraceTab[] = [];
const SETTINGS_TAB: TraceTab = { title: "Settings", fullTitle: "Settings", path: "/settings", icon: Settings };
const NAV_HIDDEN_KEY = "nav_hidden_pages";

function readHiddenPages(): string[] {
  try {
    const pages = JSON.parse(localStorage.getItem(NAV_HIDDEN_KEY) || "[]");
    return Array.isArray(pages) ? pages.filter((page): page is string => typeof page === "string") : [];
  } catch {
    return [];
  }
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  l2:    "L2 — Lead",
  l1:    "L1 — User",
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [hiddenPages, setHiddenPages] = useState<string[]>(readHiddenPages);

  const userInitial = user?.name?.[0]?.toUpperCase() ?? "U";

  useEffect(() => {
    const handler = () => setHiddenPages(readHiddenPages());
    window.addEventListener(NAV_HIDDEN_KEY, handler);
    return () => window.removeEventListener(NAV_HIDDEN_KEY, handler);
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/settings/nav-visibility?email=${encodeURIComponent(user.email)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const pages: string[] = Array.isArray(data.hidden_pages)
          ? data.hidden_pages.filter((page: unknown): page is string => typeof page === "string")
          : [];
        localStorage.setItem(NAV_HIDDEN_KEY, JSON.stringify(pages));
        setHiddenPages(pages);
        window.dispatchEvent(new Event(NAV_HIDDEN_KEY));
      })
      .catch(() => {});
  }, [user?.email]);

  const visibleTabs = HIDEABLE_TABS.filter((tab) => !tab.path || !hiddenPages.includes(tab.path));
  const allTabs = [...visibleTabs, ...COMING_SOON_TABS, SETTINGS_TAB];
  const navigation = resolveAppNavigation(location, [...HIDEABLE_TABS, SETTINGS_TAB]);

  return (
    <div className="kpmg-shell flex h-screen bg-background">
      <aside
        className="kpmg-shell-sidebar sticky top-0 flex h-full flex-shrink-0 flex-col overflow-x-hidden border-r border-border bg-sidebar transition-[width] duration-300 ease-in-out"
        style={{ width: collapsed ? 68 : 288 }}
      >
        <div
          className="trace-sidebar-brand relative z-10 flex items-center border-b border-white/8 px-3 flex-shrink-0"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2 pr-10">
              <span className="text-[16px] font-bold tracking-tight text-white"><img src={KPMGImg} width={"55px"} /></span>
              <span className="text-[#1E49E2] text-[18px] font-light select-none">|</span>
              <span className="text-[16px] font-bold tracking-tight text-[#00B8F5]">APEX</span>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/8 text-[#C8D8F0] hover:text-white hover:bg-white/14 transition-colors flex-shrink-0 ${collapsed ? "" : "absolute right-3 top-1/2 -translate-y-1/2"}`}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav
          className="relative z-10 flex-1 py-4 overflow-y-auto overflow-x-hidden"
          style={{ paddingLeft: collapsed ? 4 : 8, paddingRight: collapsed ? 4 : 8 }}
        >
          <div className="space-y-0.5">
            {allTabs.map((tab) => {
              const tabPath = tab.path ? normalizeAppPath(tab.path) : undefined;
              const comingSoon = !!tabPath && COMING_SOON_TABS.some((candidate) => candidate.path === tabPath);
              const isActive = !!tabPath && navigation.workspacePath === tabPath && !comingSoon;

              const button = (
                <button
                  key={tabPath ?? tab.title ?? "navigation-item"}
                  onClick={() => {
                    if (!comingSoon && tabPath) setLocation(tabPath);
                  }}
                  data-testid={`tab-${(tabPath ?? "unavailable").replace(/\//g, "-").replace(/^-/, "") || "dashboard"}`}
                  disabled={comingSoon || !tabPath}
                  data-active={isActive}
                  className={`kpmg-sidebar-link w-full flex items-center rounded-xl text-sm font-medium transition-all duration-150 ${
                    collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-2.5"
                  } ${
                    comingSoon
                      ? `opacity-40 cursor-not-allowed text-[#93A9C9] ${collapsed ? "" : "border-l-[3px] border-transparent"}`
                      : isActive
                        ? `text-white bg-[linear-gradient(90deg,rgba(0,184,245,0.18)_0%,rgba(0,184,245,0.08)_100%)] ${collapsed ? "ring-1 ring-[#00B8F5]/40" : "border-l-[3px] border-[#00B8F5]"}`
                        : `text-[#C8D8F0] hover:bg-white/7 hover:text-white ${collapsed ? "" : "border-l-[3px] border-transparent"}`
                  }`}
                >
                  <tab.icon className="h-4 w-4 flex-shrink-0 z-[100]" />
                  {!collapsed && <span className="flex-1 text-left text-[13px] leading-5">{tab.title?.trim() || tab.fullTitle?.trim() || "Untitled page"}</span>}
                  {!collapsed && tab.badge && !comingSoon && (
                    <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-[#1E49E2] text-white flex-shrink-0">
                      {tab.badge}
                    </span>
                  )}
                  {!collapsed && comingSoon && (
                    <span className="text-[9px] font-semibold tracking-wide px-1 py-0.5 rounded bg-white/10 text-[#C8D8F0] flex-shrink-0">
                      SOON
                    </span>
                  )}
                </button>
              );

              const safeTitle = tab.fullTitle?.trim() || tab.title?.trim() || "Page unavailable";
              const tooltipLabel = comingSoon ? `${safeTitle} - Coming Soon` : (tab.tooltip ?? safeTitle);

              return collapsed ? (
                <Tooltip key={tabPath ?? safeTitle} delayDuration={0}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {tooltipLabel}
                  </TooltipContent>
                </Tooltip>
              ) : (
                button
              );
            })}
          </div>
        </nav>

        <div className="trace-sidebar-user relative z-10 border-t border-white/8 flex-shrink-0" style={{ padding: collapsed ? "6px 4px" : "6px 8px" }}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex justify-center py-0.5 cursor-default">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-[#00338D] text-white text-xs font-bold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {user?.name ?? "User"} · {ROLE_LABELS[user?.role ?? "l1"] ?? "User"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/6 overflow-hidden">
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarFallback className="bg-[#00338D] text-white text-xs font-bold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/80 truncate leading-none mb-0.5">{user?.name ?? "User"}</p>
                <p className="text-[10px] text-[#A6BCD9] leading-none">{ROLE_LABELS[user?.role ?? "l1"] ?? "User"}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="trace-shell-main flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <HeroSection
            collapsed={collapsed}
            title={navigation.title}
            // subtitle="Log, review, and disposition control exceptions and waivers"
            icon={ShieldOff}
        />
        <main className="trace-shell-canvas flex-1 min-h-0 overflow-hidden flex flex-col">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
