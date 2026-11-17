import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Sparkles, ArrowRight, Lock, Mail, Building, User } from "lucide-react";
import { INDUSTRIES, INDUSTRY_IDS } from "@ai-sdr/shared";
import type { IndustryId } from "@ai-sdr/shared";

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [industry, setIndustry] = useState<IndustryId | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, register, loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await register(name, email, password, organizationName, industry || undefined);
      } else {
        await login(email, password);
      }
      navigate(isSignUp ? "/settings#business-profile" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginAsDemo();
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06060c] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 relative overflow-hidden selection:bg-violet-600 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-violet-600/[0.1] blur-[150px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-600/[0.08] blur-[150px] pointer-events-none -z-0" />

      <Link to="/" className="flex items-center gap-3 mb-8 relative z-10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
          <Sparkles className="w-5 h-5" />
        </div>
        <span className="font-bold text-2xl tracking-tight text-white">
          Nex<span className="text-violet-400">SDR</span>
        </span>
      </Link>

      <div className="w-full max-w-md bg-[#0e0e1a]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative z-10">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isSignUp ? "Create your AI SDR Account" : "Sign in to your Command Center"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp
              ? "Start deploying autonomous AI sales agents in 60 seconds"
              : "Access your pipeline, calls, and real-time SDR activity"}
          </p>
        </div>

        {/* 1-Click Demo Login */}
        <div className="mb-5">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition shadow-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>1-Click Sign In with Demo Account</span>
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-white/[0.06]"></div>
          <span className="flex-shrink mx-3 text-[11px] text-slate-500 font-medium">or continue with email</span>
          <div className="flex-grow border-t border-white/[0.06]"></div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Your Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#090914] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
                    placeholder="Tanish Arora"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Company Name</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full bg-[#090914] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
                    placeholder="NexSDR Technologies Inc."
                  />
                </div>
              </div>
              <label className="text-xs font-medium text-slate-300 block">
                Industry
                <select
                  required
                  value={industry}
                  onChange={(event) => setIndustry(INDUSTRY_IDS.find((id) => id === event.target.value) ?? "")}
                  className="mt-1 w-full bg-[#090914] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white"
                >
                  <option value="">Select your industry</option>
                  {INDUSTRY_IDS.map((id) => <option key={id} value={id}>{INDUSTRIES[id].label}</option>)}
                </select>
              </label>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#090914] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
                placeholder="alex@nexsdr.in"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#090914] border border-white/[0.08] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-violet-600/30 border border-violet-400/30 mt-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isSignUp ? "Create Workspace" : "Sign In"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          {isSignUp ? (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-violet-400 hover:underline font-semibold"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-violet-400 hover:underline font-semibold"
              >
                Create Workspace
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
