import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  organizationName: z.string().min(2)
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  valueProposition: z.string().optional(),
  targetCustomerIcp: z.string().optional(),
  knowledgeBase: z.string().optional(),
  objectionRules: z.string().optional()
});

export const UpdateSdrProfileSchema = z.object({
  personaName: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  tone: z.string().min(1).optional(),
  qualificationFramework: z.enum(["BANT", "MEDDPICC", "CUSTOM"]).optional(),
  customInstructions: z.string().optional(),
  maxFollowUps: z.number().int().min(1).max(10).optional(),
  autoHandoffBudget: z.boolean().optional(),
  autoHandoffMeeting: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export const CreateLeadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  companyName: z.string().min(1),
  jobTitle: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  customData: z.record(z.any()).optional()
});

export const UpdateLeadSchema = CreateLeadSchema.partial().extend({
  status: z.enum([
    "NEW", "CONTACTED", "IN_CONVERSATION", "QUALIFIED", 
    "HANDOFF_REQUIRED", "CONVERTED", "UNQUALIFIED", "OPTED_OUT"
  ]).optional(),
  intentScore: z.number().int().min(0).max(100).optional(),
  isOptedOut: z.boolean().optional(),
  bantScorecard: z.record(z.any()).optional()
});

export const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1),
  channel: z.enum(["EMAIL", "PHONE", "WHATSAPP", "SMS"]).default("EMAIL"),
  isHumanOverride: z.boolean().optional()
});

export const MockCallInitiateSchema = z.object({
  leadId: z.string().min(1),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("OUTBOUND")
});

export const FollowUpRuleSchema = z.object({
  stepNumber: z.number().int().min(1),
  channel: z.enum(["EMAIL", "PHONE", "WHATSAPP", "SMS"]),
  delayDays: z.number().int().min(1),
  condition: z.string().optional(),
  templatePrompt: z.string().optional(),
  isActive: z.boolean().default(true)
});

export const AppointmentCreateSchema = z.object({
  leadId: z.string().min(1),
  title: z.string().min(1),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(30),
  attendeeEmail: z.string().email(),
  notes: z.string().optional()
});

export const AiActionSchema = z.object({
  intent: z.enum([
    "conversation",
    "outreach",
    "qualification",
    "meeting",
    "followup",
    "handoff",
    "optout",
    "none"
  ]),
  action: z.enum([
    "reply",
    "send_email",
    "create_followup",
    "check_calendar",
    "create_calendar_event",
    "qualify_lead",
    "human_handoff",
    "none"
  ]),
  reply: z.string(),
  reason: z.string().optional().default(""),
  tool_arguments: z.record(z.any()).optional().default({}),
  confidence: z.number().min(0).max(1).optional().default(1)
});

export type AiAction = z.infer<typeof AiActionSchema>;

