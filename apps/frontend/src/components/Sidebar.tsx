import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  PhoneCall,
  CalendarCheck,
  UserCheck,
  Brain,
  BarChart3,
  CreditCard,
  Settings,
  ShieldCheck,
  Repeat,
  Sparkles,
  FlaskConical,
  Search,
  ChevronRight,
  Radar,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext.js";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Opportunity Engine", path: "/opportunities", icon: Radar, badge: "AI Intel" },
  { name: "Leads", path: "/leads", icon: Users },
  { name: "Omnichannel Inbox", path: "/conversations", icon: MessageSquare },
  { name: "Lead Simulator", path: "/lead-simulator", icon: FlaskConical, badge: "DEV" },
  { name: "Phone Studio", path: "/phone-studio", icon: PhoneCall, badge: "Voice AI" },
  { name: "Follow-ups", path: "/follow-ups", icon: Repeat },
  { name: "Appointments", path: "/tasks", icon: CalendarCheck },
  { name: "Human Handoff", path: "/handoff", icon: UserCheck },
  { name: "AI SDR Setup", path: "/sdr-setup", icon: Brain },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Billing & Plans", path: "/billing", icon: CreditCard },
  { name: "Settings", path: "/settings", icon: Settings },
  { name: "Admin Area", path: "/admin", icon: ShieldCheck }
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const [filter, setFilter] = React.useState("");
  const { user, organization } = useAuth();
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "TA";

  const renderNav = (isMobile: boolean) => (
    <>
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-white text-base tracking-tight flex items-center gap-1">
              Nex<span className="text-violet-400">SDR</span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[130px]">
              {organization?.name || "AI Sales Platform"}
            </p>
          </div>
        </div>

        {isMobile && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Quick Search Trigger matching reference */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#121224]/80 border border-white/[0.06] text-xs text-slate-400 hover:border-violet-500/40 transition cursor-pointer group">
          <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 transition" />
          <input type="search" aria-label="Find a workspace page" placeholder="Find a page…" value={filter}
            onChange={e => setFilter(e.target.value)} className="min-w-0 w-full bg-transparent text-xs" />
        </div>
      </div>

      {filter && !navItems.some(item => item.name.toLowerCase().includes(filter.trim().toLowerCase())) && <p role="status" className="px-4 text-xs">No matching pages.</p>}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.filter(item => item.name.toLowerCase().includes(filter.trim().toLowerCase())).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                setFilter("");
                if (isMobile && onClose) onClose();
              }}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35 border border-violet-400/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]"
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Footer Card matching reference */}
      <div className="p-3 border-t border-white/[0.06] bg-[#0c0c1a]/90">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-700 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md shadow-violet-900/40">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate max-w-[110px]">
                {user?.name || "Tanish Arora"}
              </p>
              <p className="text-[10px] text-slate-400 truncate max-w-[110px]">
                {user?.role || "Owner"}
              </p>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#090914]/90 backdrop-blur-2xl border-r border-white/[0.06] flex-col h-screen select-none shrink-0 z-20">
        {renderNav(false)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Drawer Aside */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0a0a16] border-r border-white/[0.08] flex flex-col h-full select-none transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl shadow-violet-950/50 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile Navigation"
      >
        {renderNav(true)}
      </aside>
    </>
  );
};
