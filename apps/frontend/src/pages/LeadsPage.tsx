import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import {
  Users,
  Plus,
  Search,
  Upload,
  Sparkles,
  Mail,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Filter
} from "lucide-react";

export const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [outreachLoading, setOutreachLoading] = useState<string | null>(null);

  // New Lead Form State
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const loadLeads = async () => {
    try {
      const res = await api.getLeads(statusFilter === "ALL" ? undefined : statusFilter);
      setLeads(res.leads);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLead({
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
        companyName: newCompany,
        jobTitle: newJobTitle,
        phone: newPhone
      });
      setShowAddModal(false);
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewCompany("");
      setNewJobTitle("");
      setNewPhone("");
      loadLeads();
    } catch (err: any) {
      alert(err.message || "Failed to create lead");
    }
  };

  const handleTriggerOutreach = async (leadId: string) => {
    setOutreachLoading(leadId);
    try {
      await api.triggerOutreach(leadId);
      await loadLeads();
    } catch (err: any) {
      alert(err.message || "Failed to trigger AI outreach");
    } finally {
      setOutreachLoading(null);
    }
  };

  const filteredLeads = leads.filter((l) => {
    const term = search.toLowerCase();
    return (
      l.firstName.toLowerCase().includes(term) ||
      l.lastName.toLowerCase().includes(term) ||
      l.companyName.toLowerCase().includes(term) ||
      l.email.toLowerCase().includes(term)
    );
  });

  const statuses = ["ALL", "NEW", "CONTACTED", "IN_CONVERSATION", "QUALIFIED", "HANDOFF_REQUIRED", "OPTED_OUT"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Leads Pipeline</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage target accounts, import contacts, and monitor autonomous outreach.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                statusFilter === s
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads or company..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No leads found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="p-3.5 font-medium">Contact</th>
                  <th className="p-3.5 font-medium">Company & Title</th>
                  <th className="p-3.5 font-medium">Status</th>
                  <th className="p-3.5 font-medium">Intent Score</th>
                  <th className="p-3.5 font-medium text-right">Autonomous Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="font-semibold text-slate-200 hover:text-indigo-400 transition"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                      <p className="text-[11px] text-slate-400">{lead.email}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="text-slate-200 font-medium">{lead.companyName}</p>
                      <p className="text-[11px] text-slate-400">{lead.jobTitle || "Executive"}</p>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          lead.status === "QUALIFIED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : lead.status === "HANDOFF_REQUIRED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            : lead.status === "IN_CONVERSATION"
                            ? "bg-violet-500/10 text-violet-400 border border-violet-500/30"
                            : lead.status === "OPTED_OUT" || lead.isOptedOut
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {lead.isOptedOut || lead.status === "OPTED_OUT" ? "OPTED OUT / DNC" : lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full"
                            style={{ width: `${lead.intentScore}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] text-slate-400">{lead.intentScore}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {lead.status === "NEW" ? (
                        <button
                          onClick={() => handleTriggerOutreach(lead.id)}
                          disabled={outreachLoading === lead.id}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition inline-flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{outreachLoading === lead.id ? "Generating..." : "Generate AI Outreach"}</span>
                        </button>
                      ) : (
                        <Link
                          to={`/leads/${lead.id}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition inline-flex items-center gap-1.5"
                        >
                          <span>Open Dossier</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4">Add Target Lead</h3>
            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                  placeholder="jane@company.com"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                  placeholder="Acme Global Inc"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Job Title</label>
                  <input
                    type="text"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    placeholder="Head of Operations"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Import Leads CSV</h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste JSON or CSV formatted leads to bulk import target prospects into your SDR pipeline.
            </p>

            <div className="space-y-4 text-xs">
              <button
                type="button"
                onClick={async () => {
                  const sampleLeads = [
                    { firstName: "Samantha", lastName: "Reed", email: `sam_${Date.now()}@sample.io`, companyName: "Reed Cloud Corp", jobTitle: "VP Tech" },
                    { firstName: "Thomas", lastName: "Wright", email: `tom_${Date.now()}@finscale.test`, companyName: "FinScale Payments", jobTitle: "Director of Ops" }
                  ];
                  await api.importLeadsCsv(sampleLeads);
                  setShowCsvModal(false);
                  loadLeads();
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                Import 2 Sample Enterprise Accounts
              </button>

              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};