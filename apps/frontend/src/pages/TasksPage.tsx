import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { CalendarCheck, Clock, User, Calendar, Plus, CheckCircle2 } from "lucide-react";

export const TasksPage: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAppointments() {
      try {
        const res = await api.getAppointments();
        setAppointments(res.appointments);
      } catch (err) {
        console.error("Failed to load appointments:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAppointments();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <CalendarCheck className="w-6 h-6 text-amber-400 shrink-0" />
          <span>Appointments & Booked Demos</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Meetings scheduled autonomously by your AI SDR into the sales team calendar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appointments.map((appt) => (
          <div key={appt.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {appt.status}
                </span>
                <span className="text-xs text-slate-400">{appt.durationMinutes} minutes</span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-1">{appt.title}</h3>
              <p className="text-xs text-slate-400">
                Attendee: <span className="text-slate-200 font-semibold">{appt.attendeeEmail}</span>
              </p>

              <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{new Date(appt.scheduledAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">{appt.lead?.companyName}</span>
              <Link
                to={`/leads/${appt.leadId}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                View Lead Dossier →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};