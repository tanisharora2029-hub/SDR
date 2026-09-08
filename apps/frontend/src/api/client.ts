const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "An unexpected error occurred");
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: any) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (data: any) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => apiRequest("/auth/me"),

  // Organization & SDR
  getOrg: () => apiRequest("/organization"),
  updateOrg: (data: any) => apiRequest("/organization", { method: "PUT", body: JSON.stringify(data) }),
  getSdr: () => apiRequest("/sdr"),
  updateSdr: (data: any) => apiRequest("/sdr", { method: "PUT", body: JSON.stringify(data) }),

  // Leads
  getLeads: (status?: string) => apiRequest(`/leads${status ? `?status=${status}` : ""}`),
  getLead: (id: string) => apiRequest(`/leads/${id}`),
  createLead: (data: any) => apiRequest("/leads", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id: string, data: any) => apiRequest(`/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLead: (id: string) => apiRequest(`/leads/${id}`, { method: "DELETE" }),
  importLeadsCsv: (leads: any[]) => apiRequest("/leads/import-csv", { method: "POST", body: JSON.stringify({ leads }) }),
  triggerOutreach: (leadId: string) => apiRequest(`/leads/${leadId}/outreach`, { method: "POST" }),

  // Conversations
  getConversations: () => apiRequest("/conversations"),
  getConversation: (id: string) => apiRequest(`/conversations/${id}`),
  simulateReply: (leadId: string, content: string, channel: string = "EMAIL") =>
    apiRequest("/conversations/simulate-reply", { method: "POST", body: JSON.stringify({ leadId, content, channel }) }),
  sendHumanMessage: (conversationId: string, content: string) =>
    apiRequest(`/conversations/${conversationId}/human-message`, { method: "POST", body: JSON.stringify({ content }) }),
  resumeAi: (conversationId: string) =>
    apiRequest(`/conversations/${conversationId}/resume-ai`, { method: "POST" }),
  getChannelStatuses: () => apiRequest("/conversations/channels/status"),
  getSimulatorLeads: () => apiRequest("/conversations/simulator/leads"),

  // Phone Studio
  getVoices: () => apiRequest("/calls/voices"),
  fetchTtsAudio: async (text: string, voice?: string): Promise<Blob> => {
    if (voice === "browser-native") {
      throw new Error("USE_BROWSER_SPEECH");
    }
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/calls/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ text, voice })
    });
    if (!response.ok) throw new Error("TTS failed");
    return await response.blob();
  },
  initiateCall: (leadId: string, direction: "OUTBOUND" | "INBOUND" = "OUTBOUND") =>
    apiRequest("/calls/initiate", { method: "POST", body: JSON.stringify({ leadId, direction }) }),
  sendCallTurn: (callSid: string, utterance: string) =>
    apiRequest("/calls/turn", { method: "POST", body: JSON.stringify({ callSid, utterance }) }),
  sendAudioTurn: (callSid: string, audioBase64: string, mimeType = "audio/wav") =>
    apiRequest("/calls/turn", { method: "POST", body: JSON.stringify({ callSid, audioBase64, mimeType }) }),
  completeCall: (callSid: string, durationSeconds: number) =>
    apiRequest("/calls/complete", { method: "POST", body: JSON.stringify({ callSid, durationSeconds }) }),
  getWhisperDossier: (callSid: string) =>
    apiRequest(`/calls/whisper/${callSid}`),
  setCallTakeover: (callSid: string, takeover: boolean) =>
    apiRequest("/calls/takeover", { method: "POST", body: JSON.stringify({ callSid, takeover }) }),

  // Follow-ups
  getFollowUpRules: () => apiRequest("/follow-ups/rules"),
  createFollowUpRule: (rule: any) => apiRequest("/follow-ups/rules", { method: "POST", body: JSON.stringify(rule) }),
  getPendingTasks: () => apiRequest("/follow-ups/pending"),
  runPendingTasks: () => apiRequest("/follow-ups/run-now", { method: "POST" }),

  // Handoffs
  getEscalations: () => apiRequest("/handoff"),
  getLeadDossier: (leadId: string) => apiRequest(`/handoff/${leadId}/dossier`),
  resolveEscalation: (leadId: string, resolution: string) =>
    apiRequest(`/handoff/${leadId}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }),

  // Appointments
  getAppointments: () => apiRequest("/appointments"),
  createAppointment: (data: any) => apiRequest("/appointments", { method: "POST", body: JSON.stringify(data) }),

  // Analytics & Billing
  getAnalytics: () => apiRequest("/analytics/overview"),
  getBilling: () => apiRequest("/billing"),
  createCheckout: (targetTier: string) => apiRequest("/billing/checkout", { method: "POST", body: JSON.stringify({ targetTier }) }),
  verifyPayment: (tier: string, paymentId?: string) =>
    apiRequest("/billing/verify-payment", { method: "POST", body: JSON.stringify({ tier, paymentId }) })
};