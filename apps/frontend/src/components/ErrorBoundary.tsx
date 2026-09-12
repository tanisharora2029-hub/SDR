import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[NexSDR ErrorBoundary] Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV !== "production";

      return (
        <div className="min-h-screen bg-[#05050d] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans select-none">
          {/* Ambient Cyber Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-violet-600/20 via-indigo-600/10 to-rose-600/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Holographic Container */}
          <div className="relative z-10 max-w-lg w-full rounded-2xl border border-white/[0.1] bg-[#0c0d1b]/80 backdrop-blur-2xl p-8 shadow-2xl shadow-black/80 text-center">
            {/* Holographic Icon Badge */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-violet-500/20 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10 mb-6">
              <ShieldAlert className="w-8 h-8 text-rose-400 animate-pulse" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-semibold tracking-wide uppercase mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              System Interruption Encountered
            </span>

            <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
              Command Center Anomaly
            </h1>

            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              NexSDR encountered an unexpected runtime state. Your autonomous pipeline data and lead state remain completely secure.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 border border-violet-400/30 transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Command Center
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-medium border border-white/[0.08] transition flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>

            {/* Dev Stack Trace Details */}
            {isDev && this.state.error && (
              <details className="mt-8 text-left bg-black/40 border border-white/[0.06] rounded-xl p-3">
                <summary className="text-[11px] text-slate-400 cursor-pointer font-mono hover:text-slate-200">
                  Diagnostic Information (Development Only)
                </summary>
                <div className="mt-3 text-[11px] font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-48 scrollbar-thin">
                  {this.state.error.toString()}
                  {"\n"}
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
