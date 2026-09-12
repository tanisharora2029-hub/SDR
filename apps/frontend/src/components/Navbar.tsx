import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { LogOut, Plus, PhoneCall, Menu, Sparkles } from "lucide-react";

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-white/[0.06] bg-[#090914]/80 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 min-w-0 shadow-lg shadow-black/20">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -ml-1 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl md:hidden transition shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm truncate min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-slate-400 hidden sm:inline text-xs font-medium">Workspace:</span>
          <span className="font-semibold text-white truncate text-xs sm:text-sm tracking-tight">
            {organization?.name || "Production Workspace"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link
          to="/phone-studio"
          title="Launch Phone Studio"
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition shadow-sm shrink-0"
        >
          <PhoneCall className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
          <span className="hidden sm:inline">Phone Studio</span>
        </Link>

        <Link
          to="/leads"
          title="Add Lead"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition shadow-md shadow-violet-600/30 border border-violet-400/30 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Add Lead</span>
        </Link>

        <div className="h-4 w-px bg-white/[0.08] mx-0.5 sm:mx-1 shrink-0"></div>

        <div className="flex items-center gap-2 sm:gap-3 pl-1 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#16162a] border border-white/[0.1] flex items-center justify-center text-violet-300 font-bold text-xs shrink-0 shadow-inner">
            {user?.name?.slice(0, 2).toUpperCase() || "TA"}
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-white truncate max-w-[120px]">{user?.name || "Tanish Arora"}</p>
            <p className="text-slate-400 text-[10px] truncate max-w-[120px]">{user?.role || "Owner"}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-white/[0.06] transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};