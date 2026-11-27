import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { LogOut, Sparkles } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="workspace-nav-wrap">
      <header className="workspace-nav">
        <Link to="/dashboard" className="workspace-brand">
          <span className="workspace-brand-badge" aria-hidden="true">
            <Sparkles size={19} />
          </span>
          <span>
            NexSDR
            <small>{organization?.name || "Your workspace"}</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {[
            ["/dashboard", "Dashboard"],
            ["/opportunities", "Find leads"],
            ["/leads", "Contacts"],
            ["/conversations", "Inbox"],
            ["/phone-studio", "Voice"]
          ].map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="workspace-account">
          <span title={user?.name}>{user?.name?.slice(0, 2).toUpperCase() || "ME"}</span>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
    </div>
  );
};
