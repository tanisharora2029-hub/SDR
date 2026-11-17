import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client.js";
import type { IndustryId } from "@ai-sdr/shared";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  valueProposition?: string;
  targetCustomerIcp?: string;
  knowledgeBase?: string;
  objectionRules?: string;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  register: (name: string, email: string, password: string, organizationName: string, industry?: IndustryId) => Promise<void>;
  logout: () => void;
  refreshOrg: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        setUser(res.user);
        setOrganization(res.organization);
      } catch (err) {
        console.error("Failed to load user:", err);
        localStorage.removeItem("token");
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    localStorage.setItem("token", res.token);
    setToken(res.token);
    setUser(res.user);
    setOrganization(res.organization);
  };

  const loginAsDemo = async () => {
    try {
      await login("demo@nexsdr.in", "password123");
    } catch {
      await login("demo@nexus-sdr.com", "password123");
    }
  };

  const register = async (name: string, email: string, password: string, organizationName: string, industry?: IndustryId) => {
    const res = await api.register({ name, email, password, organizationName, industry });
    localStorage.setItem("token", res.token);
    setToken(res.token);
    setUser(res.user);
    setOrganization(res.organization);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setOrganization(null);
  };

  const refreshOrg = async () => {
    try {
      const res = await api.getOrg();
      setOrganization(res.organization);
    } catch (err) {
      console.error("Failed to refresh org:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginAsDemo,
        register,
        logout,
        refreshOrg
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
