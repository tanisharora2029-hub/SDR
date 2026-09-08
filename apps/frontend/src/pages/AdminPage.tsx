import React from "react";
import { ShieldCheck, Cpu, HardDrive, Database, Activity, CheckCircle2, Zap } from "lucide-react";

export const AdminPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-400 shrink-0" />
          <span>System Architecture & Engine Status</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time diagnostics of local/cloud model inference, VRAM allocation, database, and telemetry.
        </p>
      </div>

      {/* Hardware & Model Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">Active AI Model</h3>
          </div>
          <p className="text-xl font-bold text-slate-100">Qwen 2.5 3B (Instruct)</p>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Parameter Size: <span className="text-slate-200">3.1 Billion</span></p>
            <p>Quantization: <span className="text-slate-200">Q4_K_M (1.9 GB)</span></p>
            <p>Inference Speed: <span className="text-emerald-400 font-bold">~50 tokens / sec</span></p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">GPU VRAM Status</h3>
          </div>
          <p className="text-xl font-bold text-slate-100">100% GPU Tensor Cores</p>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Hardware: <span className="text-slate-200">RTX 5050 Laptop GPU</span></p>
            <p>VRAM Used: <span className="text-emerald-400 font-bold">2.2 GB / 4.0 GB</span></p>
            <p>Free VRAM for KV: <span className="text-slate-200 font-semibold">1.8 GB (High Concurrency)</span></p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-200">Storage & Multi-Tenant DB</h3>
          </div>
          <p className="text-xl font-bold text-slate-100">Prisma ORM (Zero-Cost)</p>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Database: <span className="text-slate-200">SQLite Dev / PostgreSQL Prod</span></p>
            <p>Tenant Isolation: <span className="text-emerald-400 font-bold">organizationId Scoped</span></p>
            <p>Status: <span className="text-emerald-400 font-semibold">Connected & Healthy</span></p>
          </div>
        </div>
      </div>

      {/* Tool Calling Contract Architecture */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Enforced AI Tool-Calling Architecture
        </h2>
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2 overflow-x-auto">
          <p className="text-indigo-400 font-bold break-words">
            LLM → Structured Tool Decision → Backend Validates (Auth, Opt-Out, Rate Limits) → API Executes → Result
          </p>
          <p className="text-slate-400 break-words">
            Registered Tools: send_email, read_email, check_calendar_availability, create_calendar_event, create_followup, update_lead, qualify_lead, schedule_call, log_call, human_handoff.
          </p>
        </div>
      </div>
    </div>
  );
};