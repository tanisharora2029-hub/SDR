import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { LogOut, User as UserIcon, Plus, PhoneCall, Menu } from "lucide-react";

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 min-w-0">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -ml-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg md:hidden transition shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="text-xs sm:text-sm truncate min-w-0">
          <span className="text-slate-400 hidden sm:inline">Workspace: </span>
          <span className="font-semibold text-slate-200 truncate">{organization?.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <Link
          to="/phone-studio"
          title="Launch Phone Studio"
          className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition shrink-0"
        >
          <PhoneCall className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Phone Studio</span>
        </Link>

        <Link
          to="/leads"
          title="Add Lead"
          className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Add Lead</span>
        </Link>

        <div className="h-4 w-px bg-slate-800 mx-0.5 sm:mx-1 shrink-0"></div>

        <div className="flex items-center gap-1.5 sm:gap-3 pl-1 sm:pl-2 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs shrink-0">
            {user?.name?.slice(0, 2).toUpperCase() || "US"}
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-slate-200 truncate max-w-[120px]">{user?.name}</p>
            <p className="text-slate-400 text-[11px] truncate max-w-[120px]">{user?.role}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};