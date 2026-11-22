import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar.js";
export const Layout: React.FC = () => {
 const location = useLocation();
 return <div className="atlas-theme workspace-shell"><Navbar/><main className={`workspace-main ${location.pathname === "/phone-studio" ? "voice-room" : ""}`}><Outlet/></main></div>;
};
