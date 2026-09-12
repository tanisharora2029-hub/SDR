import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.js";
import { Navbar } from "./Navbar.js";

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Automatically close mobile sidebar whenever route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#06060c] text-slate-100 overflow-hidden relative selection:bg-violet-600 selection:text-white">
      {/* Background ambient lighting fields matching reference */}
      <div className="fixed top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/[0.08] blur-[150px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-indigo-600/[0.07] blur-[160px] pointer-events-none -z-0" />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden relative z-10">
        <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-5 md:p-6 bg-transparent">
          <Outlet />
        </main>
      </div>
    </div>
  );
};