import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { LogOut, User as UserIcon, Plus, PhoneCall } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="text-sm">
          <span className="text-slate-400">Workspace:</span>{" "}
          <span className="font-semibold text-slate-200">{organization?.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/phone-studio"
          className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Launch Phone Studio</span>
        </Link>

        <Link
          to="/leads"
          className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Lead</span>
        </Link>

        <div className="h-4 w-px bg-slate-800 mx-1"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
            {user?.name?.slice(0, 2).toUpperCase() || "US"}
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-slate-200">{user?.name}</p>
            <p className="text-slate-400">{user?.role}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};