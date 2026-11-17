const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const AUTH_TIMEOUT_MS = 65_000;

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 25_000
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });

    let data: any;
    const rawText = await response.text();
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { error: rawText.slice(0, 120) || `Server returned HTTP ${response.status}: ${response.statusText}` };
    }

    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (err: any) {
    if (err.name === "AbortError") {
      if (controller.signal.aborted && timeoutMs === AUTH_TIMEOUT_MS) {
        throw new Error("The sign-in service did not respond in time. Please wait a moment and try again.");
      }
      throw new Error("Request timed out. The server is taking longer than expected to respond.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  // Auth
  login: (credentials: any) =>
    apiRequest("/auth/login", { method: "POST", body: JSON.stringify(credentials) }, AUTH_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(4_000),
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
    apiRequest("/billing/verify-payment", { method: "POST", body: JSON.stringify({ tier, paymentId }) }),

  // Email Integration Settings (Ethereal Sandbox & Resend LIVE)
  getEmailSettings: () => apiRequest("/organization/email-settings"),
  selectEmailProvider: (provider: "RESEND" | "ETHEREAL") =>
    apiRequest("/organization/select-email-provider", { method: "POST", body: JSON.stringify({ provider }) }),
  testEmailConnection: (provider?: "RESEND" | "ETHEREAL") =>
    apiRequest("/organization/test-email-connection", { method: "POST", body: JSON.stringify({ provider }) }),
  sendTestEmail: (to?: string, provider?: "RESEND" | "ETHEREAL") =>
    apiRequest("/organization/send-test-email", { method: "POST", body: JSON.stringify({ to, provider }) }),

  // Inbound Email Webhooks (Resend)
  getInboundWebhookStatus: () => apiRequest("/webhooks/resend/inbound/status"),
  testInboundWebhook: (payload: any) =>
    apiRequest("/webhooks/resend/inbound/test", { method: "POST", body: JSON.stringify({ payload }) }),

  // Domain & DNS Checklist
  getDomainDns: () => apiRequest("/organization/domain-dns"),

  // Generic HTTP helpers
  get: <T = any>(endpoint: string) => apiRequest<T>(endpoint),
  post: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(endpoint: string) => apiRequest<T>(endpoint, { method: "DELETE" }),

  // Opportunity Engine Endpoints
  getOpportunities: (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.tier) params.append("tier", filters.tier);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return apiRequest(`/opportunities${qs ? `?${qs}` : ""}`);
  },
  getOpportunityById: (id: string) => apiRequest(`/opportunities/${id}`),
  runAutopilot: () => apiRequest("/opportunities/autopilot", { method: "POST" }),
  analyzeBusinessUrl: (url: string) =>
    apiRequest("/opportunities/analyze-url", { method: "POST", body: JSON.stringify({ url }) }),
  generateTop10Leads: () => apiRequest("/opportunities/generate-top-10", { method: "POST" }),
  approveOpportunity: (id: string, data?: any) =>
    apiRequest(`/opportunities/${id}/approve`, { method: "POST", body: JSON.stringify(data || {}) }),
  rejectOpportunity: (id: string) =>
    apiRequest(`/opportunities/${id}/reject`, { method: "POST" }),
  sendOpportunityOutreach: (id: string) =>
    apiRequest(`/opportunities/${id}/send`, { method: "POST" })
};
