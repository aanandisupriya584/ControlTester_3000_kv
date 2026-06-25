import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Cog,
  Database,
  Eye,
  FileBarChart,
  FilePenLine,
  FileSearch,
  LayoutDashboard,
  Library,
  LogOut,
  MessageSquare,
  Search,
  Scale,
  ShieldCheck,
  TestTube,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import logo from "@/assets/kpmg (1).png";
import KpmgImg from "@/assets/Picture1.png";

type FeatureCategory =
  | "Oversight and Libraries"
  | "Assessment and Testing"
  | "Reporting and Operations";

type FeatureCard = {
  title: string;
  path: string;
  description: string;
  functionLabel: string;
  accent: string;
  icon: LucideIcon;
  category: FeatureCategory;
};

type FeatureSection = {
  id: FeatureCategory;
  title: string;
  description: string;
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    title: "Dashboard",
    path: "/",
    description: "Portfolio view of regulatory content, control coverage, domain distribution, and diagnostic status across the active libraries.",
    functionLabel: "Portfolio monitoring",
    accent: "#00338D",
    icon: LayoutDashboard,
    category: "Oversight and Libraries",
  },
  {
    title: "Regulatory Library",
    path: "/regulatory-library",
    description: "Ingest regulations, extract obligations, classify domains, and maintain the regulatory knowledge base used for gap and comparison analysis.",
    functionLabel: "Regulatory ingestion",
    accent: "#1E49E2",
    icon: Library,
    category: "Oversight and Libraries",
  },
  {
    title: "Controls Library",
    path: "/controls-library",
    description: "Upload control inventories, normalize control records, evaluate mapping quality, and identify duplication across control sets.",
    functionLabel: "Control diagnostics",
    accent: "#009A44",
    icon: ShieldCheck,
    category: "Oversight and Libraries",
  },
  {
    title: "Frameworks Library",
    path: "/frameworks-library",
    description: "Manage reference frameworks and supporting metadata used to organize regulatory and control analysis workflows.",
    functionLabel: "Reference frameworks",
    accent: "#0C233C",
    icon: BookOpen,
    category: "Oversight and Libraries",
  },
  {
    title: "Asset Registry",
    path: "/asset-registry",
    description: "Maintain a central asset register with CIA ratings, business criticality, ownership data, and control linkage context.",
    functionLabel: "Asset intelligence",
    accent: "#1E49E2",
    icon: Database,
    category: "Oversight and Libraries",
  },
  {
    title: "Controls Diagnostics",
    path: "/controls-diagnostics",
    description: "Upload your GRC data once and run all four diagnostic analyses simultaneously — Risk-Controls Coverage, Control Quality, Duplicates, and Benchmarking — across your full control corpus.",
    functionLabel: "Design diagnostics",
    accent: "#7213EA",
    icon: ShieldCheck,
    category: "Assessment and Testing",
  },
  {
    title: "Control Testing",
    path: "/control-testing",
    description: "Coordinate AI-assisted control testing, validate supporting evidence, record outcomes, and generate testing workpapers.",
    functionLabel: "Testing execution",
    accent: "#0C233C",
    icon: TestTube,
    category: "Assessment and Testing",
  },
  {
    title: "SOP Uplift",
    path: "/sop-uplift",
    description: "Upload SOPs, controls, risks, evidence, and diagrams; review uplift suggestions in-document; generate DOCX and editable diagram outputs.",
    functionLabel: "Procedure uplift",
    accent: "#00B8F5",
    icon: FilePenLine,
    category: "Assessment and Testing",
  },
  {
    title: "Risk Assessment",
    path: "/risk-assessment",
    description: "Capture risk inputs, structure scoring, connect risks to controls, and generate risk assessment outputs for downstream reporting.",
    functionLabel: "Risk scoring",
    accent: "#00338D",
    icon: AlertTriangle,
    category: "Assessment and Testing",
  },
  {
    title: "Regulatory Testing",
    path: "/regulatory-testing",
    description: "Run regulation-versus-regulation comparisons or assess uploaded RCM documents against regulatory obligations from uploads or library sources.",
    functionLabel: "Comparative assessment",
    accent: "#098E7E",
    icon: Scale,
    category: "Assessment and Testing",
  },
  {
    title: "Final Report",
    path: "/evidence-assessment",
    description: "Execute evidence-based assessment workflows and compile structured final outputs from uploaded evidence packs.",
    functionLabel: "Evidence synthesis",
    accent: "#1E49E2",
    icon: FileSearch,
    category: "Assessment and Testing",
  },
  {
    title: "Chat",
    path: "/chat",
    description: "Use conversational analysis to interrogate platform context, uploaded content, and working outputs during assessment workflows.",
    functionLabel: "Analyst support",
    accent: "#00B8F5",
    icon: MessageSquare,
    category: "Assessment and Testing",
  },
  {
    title: "Reports",
    path: "/reports",
    description: "Review generated outputs for evidence assessment, control testing, regulatory testing, and related reporting artefacts in one place.",
    functionLabel: "Report retrieval",
    accent: "#0C233C",
    icon: FileBarChart,
    category: "Reporting and Operations",
  },
  {
    title: "Issue Management",
    path: "/issue-management",
    description: "Track findings, assign remediation actions, capture evidence, and monitor issue status against associated risks and controls.",
    functionLabel: "Remediation tracking",
    accent: "#EAAA00",
    icon: Workflow,
    category: "Reporting and Operations",
  },
];

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: "Oversight and Libraries",
    title: "Oversight and Libraries",
    description: "Reference data, library operations, and portfolio monitoring surfaces.",
  },
  {
    id: "Assessment and Testing",
    title: "Assessment and Testing",
    description: "Execution workflows for regulatory comparison, control testing, and evidence-led analysis.",
  },
  {
    id: "Reporting and Operations",
    title: "Reporting and Operations",
    description: "Distribution, retrieval, and remediation workflows for generated outputs.",
  },
];

const HERO_SUMMARY_STATIC = [
  {
    label: "Solution Modules",
    value: "",
    description: "Centralized access to retained modules across oversight, assessment, and reporting.",
  },
  {
    label: "Navigation bands",
    value: String(FEATURE_SECTIONS.length),
    description: "Operating capabilities are grouped into structured enterprise bands for faster orientation.",
  },
  {
    label: "Library foundations",
    value: "4",
    description: "Regulatory obligations, controls, frameworks, and asset context anchor the downstream analysis stack.",
  },
];

const AGENTIC_COMMAND_NODES = [
  { label: "Detect", icon: Eye, className: "left-[6%] top-[34%]" },
  { label: "Automate", icon: Cog, className: "left-[17%] top-[-18%]" },
  { label: "Assess", icon: ShieldCheck, className: "right-[17%] top-[-18%]" },
  { label: "Comply", icon: ClipboardCheck, className: "right-[7%] bottom-[13%]" },
  { label: "Act", icon: Zap, className: "left-1/2 bottom-[-18%] -translate-x-1/2" },
];

const NAV_HIDDEN_KEY = "nav_hidden_pages";

function readHiddenPages(): string[] {
  try { return JSON.parse(localStorage.getItem(NAV_HIDDEN_KEY) || "[]"); } catch { return []; }
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  /* Bug fix: keep landing directory tiles visible on first load. */
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURE_SECTIONS.map((s) => [s.id, false]))
  );
  const [hiddenPages, setHiddenPages] = useState<string[]>(readHiddenPages);

  useEffect(() => {
    const handler = () => setHiddenPages(readHiddenPages());
    window.addEventListener(NAV_HIDDEN_KEY, handler);
    return () => window.removeEventListener(NAV_HIDDEN_KEY, handler);
  }, []);

  const visibleCards = FEATURE_CARDS.filter((card) => !hiddenPages.includes(card.path));
  const heroSummary = [
    { ...HERO_SUMMARY_STATIC[0], value: String(visibleCards.length) },
    ...HERO_SUMMARY_STATIC.slice(1),
  ];

  const toggleSection = (id: string) =>
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const groupedSections = FEATURE_SECTIONS.map((section) => ({
    ...section,
    items: visibleCards.filter((card) => card.category === section.id),
  }));

  const handleSignOut = () => {
    logout();
    setLocation("/login");
  };

  const getSequence = (path: string) => {
    const index = visibleCards.findIndex((card) => card.path === path);
    return String(index + 1).padStart(2, "0");
  };

  return (
    /* Bug fix: landing is outside AppLayout, so it must own scrolling while body overflow is locked. */
    <div className="landing-shell flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="landing-nav sticky top-0 z-50 w-full">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-8 py-4 lg:px-14">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-bold tracking-tight text-white"><img src={KpmgImg} width={"75px"}/></span>
            <span className="text-[#1E49E2] text-[20px] font-light select-none">|</span>
            <span className="text-[18px] font-bold tracking-tight text-[#00B8F5]">APEX</span>
            <span className="hidden sm:flex items-center gap-1.5 ml-1 text-white/40 text-[13px]">
              <span>/</span>
              <span className="text-white/60">Agentic Controls Platform</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="group relative mr-[10px] hidden h-9 w-9 transition-[width] duration-200 ease-out hover:w-44 focus-within:w-44 sm:block lg:hover:w-56 lg:focus-within:w-56">
              <Search className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white/55 transition-all duration-200 group-hover:left-3 group-hover:translate-x-0 group-focus-within:left-3 group-focus-within:translate-x-0" />
              <input
                type="search"
                aria-label="Search APEX"
                placeholder="Search"
                className="h-9 w-full rounded-full border border-[#2B5CAB] bg-[#102F57] pl-8 pr-3 text-xs font-medium text-white outline-none placeholder:text-transparent focus:border-[#00B8F5]/75 focus:bg-[#123A6C] group-hover:placeholder:text-[#9DB6D5] group-focus-within:placeholder:text-[#9DB6D5]"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="kpmg-dark-outline-button rounded-full text-xs gap-1.5"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Bug fix: keep the previous hero as the upper first section and place the current module directory below it. */}
      <header className="landing-hero agentic-landing-hero relative shrink-0 overflow-hidden">
        <div className="relative z-10 mx-auto grid w-full max-w-[1400px] content-center gap-8 px-8 py-8 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[minmax(0,1.6fr)_380px] lg:px-14 lg:py-10">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00B8F5] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#ACEAFF]">Landing point to the agentic solutions</span>
            </div>
            <div className="agentic-command-stage relative min-h-[340px] overflow-visible px-3 py-5 sm:min-h-[390px] sm:px-6">
              <div className="relative z-10 mx-auto flex max-w-[720px] flex-col items-center text-center">
                <h1 className="agentic-command-title text-[48px] font-black leading-[0.95] text-white sm:text-[62px] lg:text-[70px]">
                  <span>Automate.</span>
                  <span>Detect.</span>
                  <span className="agentic-act-word">Act.</span>
                </h1>
                <p className="mt-5 text-[11px] font-bold uppercase text-[#AFC3F7]" style={{ letterSpacing: "0.32em" }}>
                  Your Agentic Control Center
                </p>
                <Button
                  type="button"
                  onClick={() => setLocation("/")}
                  className="mt-5 h-12 rounded-[8px] border border-[#55C8FF]/55 bg-transparent px-7 text-[15px] font-bold text-white shadow-[0_0_30px_rgba(0,110,255,0.34)] hover:bg-white/8"
                >
                  Enter Workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-0 mx-auto h-[178px] max-w-[680px]">
                <div className="agentic-core absolute left-1/2 top-[42%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full">
                  <span className="agentic-core-arrow" />
                </div>
                {AGENTIC_COMMAND_NODES.map((node) => {
                  const Icon = node.icon;
                  return (
                    <div key={node.label} className={`agentic-node absolute ${node.className}`}>
                      <div className="agentic-node-disc">
                        <Icon className="h-7 w-7 text-[#DFF8FF]" />
                      </div>
                      <p>{node.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="kpmg-summary-panel rounded-[18px] p-6 text-white self-start mt-1">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.34em] text-[#ACEAFF]">Operating summary</p>
            <h2 className="mt-2.5 text-[22px] font-bold leading-tight text-white">Solutions Overview</h2>
            <div className="mt-5 space-y-0">
              {heroSummary.map((item, index) => (
                <div key={item.label} className={`py-4 ${index > 0 ? "kpmg-summary-stat" : ""}`}>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.24em] text-[#BFD2EE]">{item.label}</p>
                  <p className="mt-1.5 text-[32px] font-bold leading-none text-white">{item.value}</p>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-[#DCE7FA]">{item.description}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </header>

      {/* Bug fix: expose the current landing modules as a second scrollable section instead of hiding them under the hero. */}
      <main id="landing-modules" className="shrink-0 px-8 pb-10 pt-7 lg:px-14 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-[1400px] space-y-8">
          <section className="landing-directory-intro">
            <div>
              <p className="kpmg-section-label">APEX modules</p>
              <h2 className="mt-2 text-[24px] font-bold leading-tight text-[#0C233C]">Current workspace directory</h2>
            </div>
            <p className="max-w-[640px] text-[13.5px] leading-6 text-[#5A6478]">
              Select a module below to continue into oversight, assessment, reporting, and operations workflows.
            </p>
          </section>

          {groupedSections.map((section) => {
            const isCollapsed = !!collapsedSections[section.id];
            return (
            <section key={section.id} className="landing-directory-panel rounded-[18px] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={!isCollapsed}
                className="w-full flex flex-col gap-2 border-b border-[#E2E6EF] bg-[#FAFBFD] px-7 py-5 text-left lg:flex-row lg:items-end lg:justify-between hover:bg-[#F4F6FA] transition-colors"
              >
                <div>
                  <p className="kpmg-section-label">{section.title}</p>
                  <h3 className="mt-2 text-[20px] font-bold text-[#0C233C]">{section.description}</h3>
                </div>
                <div className="flex items-center gap-3 self-start lg:self-auto">
                  <span className="landing-chip rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-[0.12em] uppercase">
                    {section.items.length} modules
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-[#0C233C] transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
                  />
                </div>
              </button>

              {!isCollapsed && (
              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
                {section.items.map((feature) => {
                  const Icon = feature.icon;
                  const seq = getSequence(feature.path);

                  return (
                    <button
                      key={feature.path}
                      type="button"
                      onClick={() => setLocation(feature.path)}
                      className="apex-card card-interactive group flex flex-col text-left"
                      style={{ ['--card-accent' as string]: feature.accent }}
                    >
                      <div className="apex-card-top">
                        <div
                          className="apex-card-icon"
                          style={{ background: feature.accent }}
                        >
                          <Icon className="h-[22px] w-[22px] text-white" />
                        </div>
                        <span className="apex-card-number">{seq}</span>
                      </div>
                      <h4 className="apex-card-title">{feature.title}</h4>
                      <p className="apex-card-description">{feature.description}</p>
                      <div className="apex-card-links">
                        <span className="apex-card-link group-hover:translate-x-0.5 transition-transform duration-200"
                          style={{ color: feature.accent }}>
                          ▶ Enter workspace
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </section>
            );
          })}

          <div className="flex items-center justify-between border-t border-[#00338D]/8 pt-6 pb-2">
            <p className="text-[11px] text-slate-400 uppercase tracking-[0.22em] font-semibold">
              KPMG APEX - Agentic Controls Platform
            </p>
            <p className="text-[11px] text-slate-400">
              {visibleCards.length} modules - centralized operating environment
            </p>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        .agentic-command-stage {
          isolation: isolate;
        }

        .agentic-command-title {
          letter-spacing: 0;
          text-shadow: 0 0 20px rgba(0, 184, 245, 0.22), 0 14px 50px rgba(0, 0, 0, 0.55);
        }

        .agentic-command-title span {
          display: block;
          animation: commandWordIn 700ms ease-out both;
        }

        .agentic-command-title span:nth-child(2) {
          animation-delay: 140ms;
        }

        .agentic-command-title span:nth-child(3) {
          animation-delay: 280ms;
        }

        .agentic-act-word {
          color: #1479ff;
          text-shadow: 0 0 18px rgba(18, 109, 255, 0.7), 0 0 56px rgba(0, 184, 245, 0.36);
        }

        .agentic-core {
          background: radial-gradient(circle, rgba(74, 245, 255, 0.9), rgba(18, 109, 255, 0.22) 42%, transparent 72%);
          box-shadow: 0 0 46px rgba(0, 184, 245, 0.78), inset 0 0 22px rgba(255, 255, 255, 0.18);
          animation: corePulse 2.8s ease-in-out infinite;
        }

        .agentic-core-arrow {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 28px;
          height: 28px;
          border-left: 4px solid #9EFFFF;
          border-top: 4px solid #9EFFFF;
          transform: translate(-50%, -36%) rotate(45deg);
          filter: drop-shadow(0 0 12px rgba(158, 255, 255, 0.85));
        }

        .agentic-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          text-transform: uppercase;
          color: #8DBAFF;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          animation: nodeFloat 4.8s ease-in-out infinite;
        }

        .agentic-node:nth-child(2n) {
          animation-delay: 800ms;
        }

        .agentic-node-disc {
          display: grid;
          place-items: center;
          width: 70px;
          height: 70px;
          border: 1px solid rgba(72, 167, 255, 0.58);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(30, 73, 226, 0.50), rgba(2, 10, 24, 0.86) 70%);
          box-shadow: 0 0 22px rgba(18, 109, 255, 0.52), inset 0 0 18px rgba(0, 184, 245, 0.22);
        }

        @keyframes commandWordIn {
          from { opacity: 0; transform: translateY(18px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes corePulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }

        @keyframes nodeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @media (max-width: 640px) {
          .agentic-command-title {
            font-size: 44px;
          }

          .agentic-node-disc {
            width: 54px;
            height: 54px;
          }

          .agentic-node {
            font-size: 9px;
          }
        }
      `}</style>
    </div>
  );
}
