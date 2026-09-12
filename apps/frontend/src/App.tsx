import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { Layout } from "./components/Layout.js";
import { LandingPage } from "./pages/LandingPage.js";
import { AuthPage } from "./pages/AuthPage.js";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage.js";
import { TermsPage } from "./pages/TermsPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LeadsPage } from "./pages/LeadsPage.js";
import { LeadDetailPage } from "./pages/LeadDetailPage.js";
import { ConversationsPage } from "./pages/ConversationsPage.js";
import { PhoneStudioPage } from "./pages/PhoneStudioPage.js";
import { FollowUpsPage } from "./pages/FollowUpsPage.js";
import { TasksPage } from "./pages/TasksPage.js";
import { HandoffInboxPage } from "./pages/HandoffInboxPage.js";
import { SdrSetupPage } from "./pages/SdrSetupPage.js";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { BillingPage } from "./pages/BillingPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { AdminPage } from "./pages/AdminPage.js";
import { LeadSimulatorPage } from "./pages/LeadSimulatorPage.js";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        Loading workspace session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Dashboard Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="leads/:id" element={<LeadDetailPage />} />
            <Route path="conversations" element={<ConversationsPage />} />
            <Route path="phone-studio" element={<PhoneStudioPage />} />
            <Route path="follow-ups" element={<FollowUpsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="handoff" element={<HandoffInboxPage />} />
            <Route path="sdr-setup" element={<SdrSetupPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="lead-simulator" element={<LeadSimulatorPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;