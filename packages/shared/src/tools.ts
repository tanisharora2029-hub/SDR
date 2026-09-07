import { SdrToolName } from "./types.js";

export interface SdrToolDefinition {
  name: SdrToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export const SDR_TOOLS_REGISTRY: SdrToolDefinition[] = [
  {
    name: "send_email",
    description: "Send an outbound personalized email to a lead.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        subject: { type: "string", description: "Engaging subject line" },
        body: { type: "string", description: "Professional email body under 120 words" }
      },
      required: ["lead_id", "subject", "body"]
    }
  },
  {
    name: "read_email",
    description: "Read the most recent emails and replies from the lead.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" }
      },
      required: ["lead_id"]
    }
  },
  {
    name: "check_calendar_availability",
    description: "Check sales executive calendar slots for an appointment.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Target date in YYYY-MM-DD format" }
      },
      required: ["date"]
    }
  },
  {
    name: "create_calendar_event",
    description: "Book a meeting/appointment with the lead.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        title: { type: "string", description: "Meeting title" },
        start_time: { type: "string", description: "ISO 8601 datetime string" },
        duration_minutes: { type: "integer", description: "Duration in minutes (e.g. 15, 30)" }
      },
      required: ["lead_id", "title", "start_time", "duration_minutes"]
    }
  },
  {
    name: "create_followup",
    description: "Schedule a future follow-up touchpoint in the cadence.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        cadence_step: { type: "integer", description: "Step number (e.g. 2, 3)" },
        channel: { type: "string", enum: ["EMAIL", "PHONE", "WHATSAPP"] },
        delay_days: { type: "integer", description: "Days from now to trigger follow-up" }
      },
      required: ["lead_id", "channel", "delay_days"]
    }
  },
  {
    name: "update_lead",
    description: "Update contact details, job title, company or custom fields.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        company_name: { type: "string" },
        job_title: { type: "string" },
        industry: { type: "string" },
        intent_score: { type: "integer" }
      },
      required: ["lead_id"]
    }
  },
  {
    name: "qualify_lead",
    description: "Record lead qualification assessment and BANT scorecard.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        status: { type: "string", enum: ["QUALIFIED", "UNQUALIFIED", "IN_CONVERSATION"] },
        budget: { type: "string", description: "Confirmed budget or price range" },
        authority: { type: "string", description: "Decision maker status" },
        need: { type: "string", description: "Identified pain points" },
        timeline: { type: "string", description: "Expected deployment timeframe" },
        notes: { type: "string", description: "Qualification rationale" }
      },
      required: ["lead_id", "status"]
    }
  },
  {
    name: "schedule_call",
    description: "Schedule an AI or human phone call with the lead.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        scheduled_time: { type: "string", description: "ISO 8601 datetime string" },
        purpose: { type: "string", description: "Call objective" }
      },
      required: ["lead_id", "scheduled_time"]
    }
  },
  {
    name: "log_call",
    description: "Log the outcome and audio transcript of a completed call.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        duration_seconds: { type: "integer" },
        outcome: { type: "string" },
        summary: { type: "string" },
        qualification_score: { type: "integer" }
      },
      required: ["lead_id", "duration_seconds", "summary"]
    }
  },
  {
    name: "human_handoff",
    description: "Escalate high-intent, custom enterprise requirements, or complex conversations to human sales reps.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead identifier" },
        reason: { type: "string", description: "Detailed justification for escalation" },
        priority: { type: "string", enum: ["NORMAL", "HIGH", "URGENT"] },
        recommended_action: { type: "string", description: "What the human sales rep should do next" }
      },
      required: ["lead_id", "reason", "priority", "recommended_action"]
    }
  }
];
