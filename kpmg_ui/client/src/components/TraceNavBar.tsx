import { useLocation } from "wouter";
import { LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import KpmgImg from '../assets/Picture1.png';

interface TraceNavBarProps {
  breadcrumb?: string;
  actions?: React.ReactNode;
  collapsed?: boolean;
}

export default function TraceNavBar({ breadcrumb, actions, collapsed }: TraceNavBarProps) {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

  const handleSignOut = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div
      className="landing-nav trace-top-ribbon fixed top-0 z-50"
      style={{ background: "#0C233C", backdropFilter: "blur(12px)", width:collapsed? '100%': 'calc(100% - 280px)', transition: "width 0.3s ease" }}
    >
      <div className="trace-top-ribbon__inner mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setLocation("/landing")}
            aria-label="Back to TRACE landing"
            title="Back to TRACE landing"
            className="trace-top-ribbon__brand flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90"
          >
            <span className="text-[18px] font-bold tracking-tight text-white"><img src={KpmgImg} width={"75px"}/></span>
            <span className="text-[#1E49E2] text-[20px] font-light select-none">|</span>
            <span className="text-[18px] font-bold tracking-tight text-[#00B8F5]">APEX</span>
          </button>
          {breadcrumb && (
            <span className="hidden min-w-0 items-center gap-1.5 text-white/40 sm:flex text-[13px]">
              <span>/</span>
              <span className="truncate text-white/60">{breadcrumb}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div className="group relative mr-[10px] hidden h-9 w-9 transition-[width] duration-200 ease-out hover:w-44 focus-within:w-44 sm:block lg:hover:w-56 lg:focus-within:w-56">
            <Search className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white/55 transition-all duration-200 group-hover:left-3 group-hover:translate-x-0 group-focus-within:left-3 group-focus-within:translate-x-0" />
            <input
              type="search"
              aria-label="Search TRACE"
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
  );
}
