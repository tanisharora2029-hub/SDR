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
  Sparkles
} from "lucide-react";
import { useAuth } from "../context/AuthContext.js";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", path: "/leads", icon: Users },
  { name: "Omnichannel Inbox", path: "/conversations", icon: MessageSquare },
  { name: "Phone Studio", path: "/phone-studio", icon: PhoneCall, badge: "Voice AI" },
  { name: "Follow-up Cadences", path: "/follow-ups", icon: Repeat },
  { name: "Appointments & Tasks", path: "/tasks", icon: CalendarCheck },
  { name: "Human Handoff", path: "/handoff", icon: UserCheck, alert: true },
  { name: "AI SDR Setup", path: "/sdr-setup", icon: Brain },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Billing & Plans", path: "/billing", icon: CreditCard },
  { name: "Settings", path: "/settings", icon: Settings },
  { name: "Admin Area", path: "/admin", icon: ShieldCheck }
];

export const Sidebar: React.FC = () => {
  const { organization } = useAuth();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-lg tracking-tight flex items-center gap-1.5">
            Nexus<span className="text-indigo-400">SDR</span>
          </h1>
          <p className="text-xs text-slate-400 truncate max-w-[140px]">
            {organization?.name || "AI Sales Org"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div className="text-xs">
            <p className="font-medium text-slate-300">AI SDR Active</p>
            <p className="text-slate-400 text-[11px]">Qwen 2.5 3B (Low Latency)</p>
          </div>
        </div>
      </div>
    </aside>
  );
};